// App shell: tab navigation + module wiring.

import { initTuner, stopTuner } from "./tuner.js";
import { initSongs, refreshSongs } from "./songs.js";
import { initMetronome, stopMetronome } from "./metronome.js";
import { bindHarpKeySelectors, bindInstrumentSelectors } from "./settings.js";

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
