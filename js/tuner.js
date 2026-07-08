// Live tuner: microphone -> pitch -> note + cents + harmonica technique.

import { detectPitch, Smoother } from "./pitch.js";
import { noteFromFrequency, nameFromMidi, frequencyFromMidi } from "./notes.js";
import { techniquesForMidi, offsetForKey } from "./harmonica.js";
import { getHarpKey, getInstrument, onInstrumentChange } from "./settings.js";
import { kalimbaTab, violinTab, lyreTab } from "./tablature.js";

let audioCtx = null;
let analyser = null;
let micStream = null;
let rafId = null;
let running = false;
const smoother = new Smoother(0.3);
let buf = null;
let micGate = parseFloat(localStorage.getItem("mic-gate")) || 0.025;

// Violin guided tuning: the MIDI of the open string being tuned, or null =
// "Auto" (plain chromatic naming). Persisted so it survives reloads.
let tuningTarget = null;
{
  const saved = localStorage.getItem("violin-tune-string");
  if (saved) tuningTarget = parseInt(saved) || null;
}

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
  el.sensitivity = document.getElementById("mic-sensitivity");

  if (el.sensitivity) {
    el.sensitivity.value = String(micGate);
    el.sensitivity.addEventListener("change", () => {
      micGate = parseFloat(el.sensitivity.value) || 0.025;
      localStorage.setItem("mic-gate", String(micGate));
    });
  }

  el.toggle.addEventListener("click", () => (running ? stop() : start()));

  // Violin string selector (G D A E, or Auto). Picking a string switches the
  // display into guided open-string tuning.
  el.strings = document.getElementById("tuner-strings");
  if (el.strings) {
    el.strings.querySelectorAll("[data-string]").forEach((b) =>
      b.addEventListener("click", () => selectTuningString(b.dataset.string))
    );
  }
  onInstrumentChange(() => applyTuningSelection());

  // The detection loop re-reads the harp key every frame, so changing it
  // updates the technique hint live with no extra wiring.
  reset();
}

function selectTuningString(val) {
  tuningTarget = val === "auto" ? null : parseInt(val);
  localStorage.setItem("violin-tune-string", tuningTarget == null ? "" : String(tuningTarget));
  applyTuningSelection();
}

// Reflect the current selection on the buttons, and when a string is picked
// (and we're idle) show it as the goal so it's clear what to bow.
function applyTuningSelection() {
  if (!el.strings) return;
  const cur = tuningTarget == null ? "auto" : String(tuningTarget);
  el.strings.querySelectorAll("[data-string]").forEach((b) =>
    b.classList.toggle("active", b.dataset.string === cur)
  );
  if (getInstrument() === "violin" && tuningTarget != null && !running) {
    const t = nameFromMidi(tuningTarget);
    el.note.textContent = t.name;
    el.octave.textContent = t.octave;
    el.technique.innerHTML =
      `<span class="tune-guide">Bow the ${t.name} string steadily…</span>`;
  }
}

async function start() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    el.status.textContent =
      "This browser can't reach the microphone here. Open the page in Safari over HTTPS.";
    return;
  }

  // On iOS Home-Screen (standalone) apps the mic prompt sometimes never
  // appears and getUserMedia hangs — surface a hint instead of waiting forever.
  let slowHint = setTimeout(() => {
    el.status.innerHTML =
      "Still waiting for the mic… iPhone Home-Screen apps can't show the prompt " +
      "themselves. In <strong>Safari</strong>, open this site → tap " +
      "<strong>“aA”</strong> → Website Settings → Microphone → " +
      "<strong>Allow</strong> (this site only), then reopen the app.";
  }, 5000);

  try {
    el.status.textContent = "Requesting microphone…";
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    clearTimeout(slowHint);
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
    clearTimeout(slowHint);
    const name = (err && err.name) || "";
    if (name === "NotAllowedError" || name === "SecurityError") {
      el.status.innerHTML =
        "No microphone permission. On iPhone, grant it for just this site: in " +
        "<strong>Safari</strong>, tap <strong>“aA”</strong> in the address bar → " +
        "Website Settings → Microphone → <strong>Allow</strong>, then reopen. " +
        "(Home-Screen apps can't show the prompt themselves.)";
    } else if (name === "NotFoundError" || name === "OverconstrainedError") {
      el.status.textContent = "No microphone was found on this device.";
    } else {
      el.status.textContent =
        "Couldn't start the microphone (" +
        (name || "error") +
        "). Make sure you're on HTTPS — and on iPhone, open it in Safari rather than from the Home Screen.";
    }
    el.toggle.textContent = "Start tuner";
    el.toggle.classList.remove("active");
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
  applyTuningSelection(); // keep showing the chosen string as the goal when idle
}

function loop() {
  if (!running) return;
  analyser.getFloatTimeDomainData(buf);
  const raw = detectPitch(buf, audioCtx.sampleRate, micGate);
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
  // Violin guided tuning: compare against the chosen open string instead of
  // naming whatever note is closest.
  if (getInstrument() === "violin" && tuningTarget != null) {
    renderViolinTuning(freq);
    return;
  }

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

  // Instrument-specific hint: violin string+finger, kalimba number, or harp.
  if (getInstrument() === "violin") {
    const v = violinTab(n.midi);
    if (v) {
      const str = v[0];
      const fin = v.slice(1);
      el.technique.innerHTML =
        `<span class="tech-chip"><span class="tech-tab">${v}</span>` +
        `<span class="tech-text">${str} string · ${fin === "0" ? "open" : "finger " + fin}</span></span>`;
    } else {
      el.technique.innerHTML =
        `<span class="tech-chip none">${n.label} ` +
        `<span class="tech-text">(not in first position)</span></span>`;
    }
    return;
  }
  if (getInstrument() === "kalimba") {
    const k = kalimbaTab(n.midi);
    el.technique.innerHTML = k
      ? `<span class="tech-chip"><span class="tech-tab">${k}</span>` +
        `<span class="tech-text">kalimba key</span></span>`
      : `<span class="tech-chip none">${n.label} ` +
        `<span class="tech-text">not on a 21-key kalimba</span></span>`;
    return;
  }
  if (getInstrument() === "lyre") {
    const l = lyreTab(n.midi);
    el.technique.innerHTML = l
      ? `<span class="tech-chip"><span class="tech-tab">${l}</span>` +
        `<span class="tech-text">lyre string</span></span>`
      : `<span class="tech-chip none">${n.label} ` +
        `<span class="tech-text">no string for this note</span></span>`;
    return;
  }
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

// Guided open-string tuning: measure how far the bowed string is from its
// target pitch and say which way (and roughly how far) to adjust.
function renderViolinTuning(freq) {
  const a4 = parseFloat(el.a4.value) || 440;
  const target = frequencyFromMidi(tuningTarget, a4);
  const cents = Math.round(1200 * Math.log2(freq / target));
  const t = nameFromMidi(tuningTarget);

  el.note.textContent = t.name;
  el.octave.textContent = t.octave;
  el.freq.textContent = freq.toFixed(1) + " Hz";
  el.cents.textContent = (cents >= 0 ? "+" : "") + cents + "¢";
  setNeedle(cents, true);

  if (Math.abs(cents) <= 5) {
    el.intune.textContent = "In tune";
    el.intune.className = "in-tune ok";
    el.technique.innerHTML =
      `<span class="tune-guide ok">✓ ${t.name} string is in tune</span>`;
    return;
  }

  const low = cents < 0; // string is flat → needs tightening
  el.intune.textContent = low ? "♭ flat" : "♯ sharp";
  el.intune.className = low ? "in-tune flat" : "in-tune sharp";

  const abs = Math.abs(cents);
  const amount = abs > 45 ? " a lot" : abs > 15 ? "" : " a little";
  const action = low ? "Tighten" : "Loosen";
  const arrow = low ? "▲" : "▼";
  const how = low
    ? "raise it — fine tuner clockwise"
    : "lower it — fine tuner anti-clockwise";
  const farOff = abs > 250 ? ` (make sure you're bowing the ${t.name} string)` : "";
  el.technique.innerHTML =
    `<span class="tune-guide ${low ? "low" : "high"}">${arrow} ${action}${amount}` +
    `<span class="tune-sub">${t.name} string is ${low ? "too low" : "too high"} — ${how}${farOff}</span></span>`;
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
