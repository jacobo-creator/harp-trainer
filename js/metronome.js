// Practice metronome. Uses the Web Audio clock with look-ahead scheduling
// (Chris Wilson's "A Tale of Two Clocks") so clicks stay rock-steady even if
// the JS timer jitters. The downbeat is accented.
//
// The engine is a singleton so only one click ever plays at a time. Both the
// Metronome tab and the compact control on the song page bind to it and stay in
// sync through the state/beat listeners.

let ctx = null;
let running = false;
let bpm = 100;
let beatsPerBar = 4;
let currentBeat = 0;
let nextNoteTime = 0;
let timerId = null;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12; // seconds
const visualQueue = [];

let tapTimes = [];
const stateListeners = new Set(); // fn({ bpm, beatsPerBar, running })
const beatListeners = new Set(); // fn(activeBeat, beatsPerBar)  (-1 = none)

// ---- Engine (shared) --------------------------------------------------------

export function getBpm() {
  return bpm;
}
export function getBeats() {
  return beatsPerBar;
}
export function isMetroRunning() {
  return running;
}

export function onMetroState(fn) {
  stateListeners.add(fn);
  return () => stateListeners.delete(fn);
}
export function onMetroBeat(fn) {
  beatListeners.add(fn);
  return () => beatListeners.delete(fn);
}

function notifyState() {
  stateListeners.forEach((fn) => fn({ bpm, beatsPerBar, running }));
}
function notifyBeat(active) {
  beatListeners.forEach((fn) => fn(active, beatsPerBar));
}

function clampBpm(v) {
  return Math.max(40, Math.min(240, Math.round(v)));
}

export function setBpm(v) {
  bpm = clampBpm(v);
  localStorage.setItem("metro-bpm", String(bpm));
  notifyState();
}

export function setBeats(v) {
  beatsPerBar = Math.max(1, Math.min(12, Math.round(+v) || 4));
  localStorage.setItem("metro-beats", String(beatsPerBar));
  currentBeat = 0;
  notifyState();
  notifyBeat(-1);
}

export function tapTempo() {
  const now = performance.now();
  tapTimes = tapTimes.filter((t) => now - t < 2000);
  tapTimes.push(now);
  if (tapTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    setBpm(60000 / avg);
  }
}

function scheduleClick(beat, time) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = beat === 0 ? 1600 : 1000; // accent the downbeat
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(beat === 0 ? 0.7 : 0.45, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.06);
}

function scheduler() {
  while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleClick(currentBeat, nextNoteTime);
    visualQueue.push({ beat: currentBeat, time: nextNoteTime });
    nextNoteTime += 60 / bpm;
    currentBeat = (currentBeat + 1) % beatsPerBar;
  }
  timerId = setTimeout(scheduler, LOOKAHEAD_MS);
}

export async function startMetronome() {
  if (running) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") await ctx.resume();
  running = true;
  currentBeat = 0;
  nextNoteTime = ctx.currentTime + 0.06;
  notifyState();
  scheduler();
  requestAnimationFrame(draw);
}

function draw() {
  if (!running) return;
  const now = ctx.currentTime;
  while (visualQueue.length && visualQueue[0].time <= now) {
    notifyBeat(visualQueue.shift().beat);
  }
  requestAnimationFrame(draw);
}

export function stopMetronome() {
  if (!running) return;
  running = false;
  if (timerId) clearTimeout(timerId);
  if (ctx) ctx.close();
  ctx = null;
  visualQueue.length = 0;
  notifyState();
  notifyBeat(-1);
}

export function toggleMetronome() {
  return running ? stopMetronome() : startMetronome();
}

// Build/refresh the beat dots inside `host`, highlighting `active` (-1 = none).
function renderDots(host, active) {
  if (!host) return;
  host.innerHTML = "";
  for (let i = 0; i < beatsPerBar; i++) {
    const dot = document.createElement("span");
    dot.className =
      "metro-dot" + (i === 0 ? " accent" : "") + (i === active ? " on" : "");
    host.appendChild(dot);
  }
}

// ---- Metronome tab UI -------------------------------------------------------

export function initMetronome() {
  const bpmEl = document.getElementById("metro-bpm");
  const slider = document.getElementById("metro-slider");
  const dec = document.getElementById("metro-dec");
  const inc = document.getElementById("metro-inc");
  const tap = document.getElementById("metro-tap");
  const beats = document.getElementById("metro-beats");
  const toggle = document.getElementById("metro-toggle");
  const dots = document.getElementById("metro-dots");

  bpm = clampBpm(parseInt(localStorage.getItem("metro-bpm")) || 100);
  beatsPerBar = parseInt(localStorage.getItem("metro-beats")) || 4;

  slider.addEventListener("input", () => setBpm(+slider.value));
  dec.addEventListener("click", () => setBpm(bpm - 1));
  inc.addEventListener("click", () => setBpm(bpm + 1));
  beats.addEventListener("change", () => setBeats(+beats.value));
  tap.addEventListener("click", tapTempo);
  toggle.addEventListener("click", toggleMetronome);

  const sync = () => {
    bpmEl.textContent = bpm;
    slider.value = bpm;
    beats.value = String(beatsPerBar);
    toggle.textContent = running ? "Stop" : "Start";
    toggle.classList.toggle("active", running);
    renderDots(dots, -1);
  };
  onMetroState(sync);
  onMetroBeat((active) => renderDots(dots, active));
  sync();
}

// ---- Compact song-page control ---------------------------------------------

export function bindSongMetronome() {
  const bpmEl = document.getElementById("song-metro-bpm");
  const slider = document.getElementById("song-metro-slider");
  const dec = document.getElementById("song-metro-dec");
  const inc = document.getElementById("song-metro-inc");
  const tap = document.getElementById("song-metro-tap");
  const beats = document.getElementById("song-metro-beats");
  const toggle = document.getElementById("song-metro-toggle");
  const dots = document.getElementById("song-metro-dots");
  if (!toggle) return;

  slider.addEventListener("input", () => setBpm(+slider.value));
  dec.addEventListener("click", () => setBpm(bpm - 1));
  inc.addEventListener("click", () => setBpm(bpm + 1));
  beats.addEventListener("change", () => setBeats(+beats.value));
  tap.addEventListener("click", tapTempo);
  toggle.addEventListener("click", toggleMetronome);

  const sync = () => {
    bpmEl.textContent = bpm;
    slider.value = bpm;
    beats.value = String(beatsPerBar);
    toggle.textContent = running ? "◼ Stop" : "▶ Start";
    toggle.classList.toggle("active", running);
    renderDots(dots, -1);
  };
  onMetroState(sync);
  onMetroBeat((active) => renderDots(dots, active));
  sync();
}
