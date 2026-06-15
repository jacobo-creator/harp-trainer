// App shell: tab navigation + module wiring.

import { initTuner, stopTuner } from "./tuner.js";
import { initSongs, refreshSongs } from "./songs.js";
import { bindHarpKeySelectors } from "./settings.js";

const views = {
  tuner: document.getElementById("view-tuner"),
  songs: document.getElementById("view-songs"),
};
const tabs = document.querySelectorAll(".tabbar button");

function show(name) {
  Object.entries(views).forEach(([k, v]) =>
    v.classList.toggle("hidden", k !== name)
  );
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name !== "tuner") stopTuner();
  if (name === "songs") refreshSongs();
  location.hash = name;
}

tabs.forEach((t) =>
  t.addEventListener("click", () => show(t.dataset.view))
);

bindHarpKeySelectors();
initTuner();
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
