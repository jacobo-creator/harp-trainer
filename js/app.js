// App shell: tab navigation + module wiring.

import { initTuner, stopTuner } from "./tuner.js";
import { initSongs, refreshSongs } from "./songs.js";
import { initMetronome, stopMetronome } from "./metronome.js";
import { bindHarpKeySelectors, bindInstrumentSelectors } from "./settings.js";
import { kalimbaTab } from "./tablature.js";

// Build the 21-key kalimba reference: tines in real physical order (lowest note
// in the centre, alternating outward), taller = lower/longer tine.
function renderKalimbaLayout() {
  const host = document.getElementById("kalimba-tines");
  if (!host) return;
  const notes = [];
  for (let m = 53; m <= 88; m++) {
    const num = kalimbaTab(m);
    if (num) notes.push({ midi: m, num });
  }
  const n = notes.length;
  const center = Math.floor(n / 2);
  const pos = new Array(n);
  pos[0] = center;
  let left = center;
  let right = center;
  for (let i = 1; i < n; i++) {
    if (i % 2 === 1) pos[i] = ++right;
    else pos[i] = --left;
  }
  const phys = new Array(n);
  for (let i = 0; i < n; i++) phys[pos[i]] = notes[i];
  host.innerHTML = phys
    .map((t) => {
      const h = 30 + Math.round(((88 - t.midi) / (88 - 53)) * 64);
      return `<span class="kalimba-tine"><span class="ktine-bar" style="height:${h}px"></span><span class="ktine-num">${t.num}</span></span>`;
    })
    .join("");
}

const views = {
  tuner: document.getElementById("view-tuner"),
  metronome: document.getElementById("view-metronome"),
  songs: document.getElementById("view-songs"),
};
const tabs = document.querySelectorAll(".tabbar button");

function show(name) {
  Object.entries(views).forEach(([k, v]) =>
    v.classList.toggle("hidden", k !== name)
  );
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name !== "tuner") stopTuner();
  if (name !== "metronome") stopMetronome();
  if (name === "songs") refreshSongs();
  location.hash = name;
}

tabs.forEach((t) =>
  t.addEventListener("click", () => show(t.dataset.view))
);

bindHarpKeySelectors();
bindInstrumentSelectors();
renderKalimbaLayout();
initTuner();
initMetronome();
initSongs();

show(location.hash.replace("#", "") in views ? location.hash.replace("#", "") : "tuner");

// Register the service worker for offline / installable behavior.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((e) =>
      console.warn("SW registration failed", e)
    );
  });
}
