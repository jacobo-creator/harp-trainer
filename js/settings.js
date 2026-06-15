// Shared app settings (currently just the selected harp key), persisted to
// localStorage and observable so the tuner + song views stay in sync.

import { HARP_KEYS } from "./harmonica.js";

const KEY_STORAGE = "harp-key";
let harpKey = localStorage.getItem(KEY_STORAGE) || "C";
const listeners = new Set();

export function getHarpKey() {
  return harpKey;
}

export function setHarpKey(key) {
  harpKey = key;
  localStorage.setItem(KEY_STORAGE, key);
  listeners.forEach((fn) => fn(key));
}

export function onHarpKeyChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Wire up any <select data-harp-key> elements to the shared setting.
export function bindHarpKeySelectors() {
  const selects = document.querySelectorAll("select[data-harp-key]");
  selects.forEach((sel) => {
    sel.innerHTML = HARP_KEYS.map(
      (k) => `<option value="${k.key}">${k.key} harp</option>`
    ).join("");
    sel.value = harpKey;
    sel.addEventListener("change", () => setHarpKey(sel.value));
  });
  // Keep all selectors and the stored value mirrored.
  onHarpKeyChange((key) => {
    selects.forEach((sel) => {
      if (sel.value !== key) sel.value = key;
    });
  });
}
