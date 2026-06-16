// Practice metronome. Uses the Web Audio clock with look-ahead scheduling
// (Chris Wilson's "A Tale of Two Clocks") so clicks stay rock-steady even if
// the JS timer jitters. The downbeat is accented.

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

const el = {};
let tapTimes = [];

export function initMetronome() {
  el.bpm = document.getElementById("metro-bpm");
  el.slider = document.getElementById("metro-slider");
  el.dec = document.getElementById("metro-dec");
  el.inc = document.getElementById("metro-inc");
  el.tap = document.getElementById("metro-tap");
  el.beats = document.getElementById("metro-beats");
  el.toggle = document.getElementById("metro-toggle");
  el.dots = document.getElementById("metro-dots");

  bpm = clampBpm(parseInt(localStorage.getItem("metro-bpm")) || 100);
  beatsPerBar = parseInt(localStorage.getItem("metro-beats")) || 4;
  el.slider.value = bpm;
  el.beats.value = String(beatsPerBar);
  el.bpm.textContent = bpm;
  renderDots(-1);

  el.slider.addEventListener("input", () => setBpm(+el.slider.value));
  el.dec.addEventListener("click", () => setBpm(bpm - 1));
  el.inc.addEventListener("click", () => setBpm(bpm + 1));
  el.beats.addEventListener("change", () => {
    beatsPerBar = +el.beats.value;
    localStorage.setItem("metro-beats", String(beatsPerBar));
    currentBeat = 0;
    renderDots(-1);
  });
  el.tap.addEventListener("click", tapTempo);
  el.toggle.addEventListener("click", () => (running ? stop() : start()));
}

function clampBpm(v) {
  return Math.max(40, Math.min(240, Math.round(v)));
}

function setBpm(v) {
  bpm = clampBpm(v);
  el.bpm.textContent = bpm;
  el.slider.value = bpm;
  localStorage.setItem("metro-bpm", String(bpm));
}

function tapTempo() {
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

function renderDots(active) {
  el.dots.innerHTML = "";
  for (let i = 0; i < beatsPerBar; i++) {
    const dot = document.createElement("span");
    dot.className = "metro-dot" + (i === 0 ? " accent" : "") + (i === active ? " on" : "");
    el.dots.appendChild(dot);
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

async function start() {
  if (running) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") await ctx.resume();
  running = true;
  currentBeat = 0;
  nextNoteTime = ctx.currentTime + 0.06;
  el.toggle.textContent = "Stop";
  el.toggle.classList.add("active");
  scheduler();
  requestAnimationFrame(draw);
}

function draw() {
  if (!running) return;
  const now = ctx.currentTime;
  while (visualQueue.length && visualQueue[0].time <= now) {
    renderDots(visualQueue.shift().beat);
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
  el.toggle.textContent = "Start";
  el.toggle.classList.remove("active");
  renderDots(-1);
}

const stop = stopMetronome;
