// Live tuner: microphone -> pitch -> note + cents + harmonica technique.

import { autoCorrelate, Smoother } from "./pitch.js";
import { noteFromFrequency } from "./notes.js";
import { techniquesForMidi, offsetForKey } from "./harmonica.js";
import { getHarpKey } from "./settings.js";

let audioCtx = null;
let analyser = null;
let micStream = null;
let rafId = null;
let running = false;
const smoother = new Smoother(0.3);
let buf = null;

const el = {};

export function initTuner() {
  el.toggle = document.getElementById("tuner-toggle");
  el.status = document.getElementById("tuner-status");
  el.note = document.getElementById("note-name");
  el.octave = document.getElementById("note-octave");
  el.freq = document.getElementById("freq-value");
  el.cents = document.getElementById("cents-value");
  el.needle = document.getElementById("needle");
  el.intune = document.getElementById("in-tune");
  el.technique = document.getElementById("technique");
  el.a4 = document.getElementById("a4-ref");
  el.gauge = document.getElementById("gauge");

  el.toggle.addEventListener("click", () => (running ? stop() : start()));
  // The detection loop re-reads the harp key every frame, so changing it
  // updates the technique hint live with no extra wiring.
  reset();
}

async function start() {
  try {
    el.status.textContent = "Requesting microphone…";
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const source = audioCtx.createMediaStreamSource(micStream);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    buf = new Float32Array(analyser.fftSize);

    running = true;
    el.toggle.textContent = "Stop";
    el.toggle.classList.add("active");
    el.status.textContent = "Listening… play a note.";
    el.gauge.classList.add("live");
    loop();
  } catch (err) {
    el.status.textContent =
      "Microphone blocked. Allow mic access in Safari settings, and make sure the page is served over HTTPS.";
    console.error(err);
  }
}

function stop() {
  running = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (micStream) micStream.getTracks().forEach((t) => t.stop());
  if (audioCtx) audioCtx.close();
  audioCtx = analyser = micStream = null;
  smoother.reset();
  el.toggle.textContent = "Start tuner";
  el.toggle.classList.remove("active");
  el.gauge.classList.remove("live");
  el.status.textContent = "Tuner stopped.";
  reset();
}

function reset() {
  el.note.textContent = "–";
  el.octave.textContent = "";
  el.freq.textContent = "— Hz";
  el.cents.textContent = "";
  el.intune.textContent = "";
  el.intune.className = "in-tune";
  el.technique.innerHTML = "";
  setNeedle(0, false);
}

function loop() {
  if (!running) return;
  analyser.getFloatTimeDomainData(buf);
  const raw = autoCorrelate(buf, audioCtx.sampleRate);
  const a4 = parseFloat(el.a4.value) || 440;

  if (raw === -1) {
    smoother.reset();
    el.freq.textContent = "— Hz";
    el.intune.textContent = "…";
    el.intune.className = "in-tune";
    setNeedle(0, false);
  } else {
    const freq = smoother.push(raw);
    const n = noteFromFrequency(freq, a4);
    render(n, freq);
  }
  rafId = requestAnimationFrame(loop);
}

function render(n, freq) {
  el.note.textContent = n.name;
  el.octave.textContent = n.octave;
  el.freq.textContent = freq.toFixed(1) + " Hz";

  const cents = n.cents;
  el.cents.textContent = (cents >= 0 ? "+" : "") + cents + "¢";
  setNeedle(cents, true);

  if (Math.abs(cents) <= 5) {
    el.intune.textContent = "In tune";
    el.intune.className = "in-tune ok";
  } else if (cents < 0) {
    el.intune.textContent = "♭ flat";
    el.intune.className = "in-tune flat";
  } else {
    el.intune.textContent = "♯ sharp";
    el.intune.className = "in-tune sharp";
  }

  // Harmonica technique hint for the current harp key.
  const offset = offsetForKey(getHarpKey());
  const techs = techniquesForMidi(n.midi, offset);
  if (techs.length) {
    el.technique.innerHTML = techs
      .map(
        (t) =>
          `<span class="tech-chip ${t.dir}${t.bend ? " bend" : ""}">` +
          `<span class="tech-tab">${t.tab}</span>` +
          `<span class="tech-text">${t.text}</span></span>`
      )
      .join("");
  } else {
    el.technique.innerHTML =
      `<span class="tech-chip none">Not on a ${getHarpKey()} harp` +
      ` <span class="tech-text">(out of range or overblow)</span></span>`;
  }
}

function setNeedle(cents, active) {
  const clamped = Math.max(-50, Math.min(50, cents));
  const pct = ((clamped + 50) / 100) * 100;
  el.needle.style.left = pct + "%";
  el.needle.classList.toggle("active", active);
  el.needle.classList.toggle("ok", active && Math.abs(cents) <= 5);
}

export function stopTuner() {
  if (running) stop();
}
