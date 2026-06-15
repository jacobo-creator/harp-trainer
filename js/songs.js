// Songs / tabs library: list, create, edit, delete. Each song can hold
// harmonica tab text, ABC notation (rendered + playable via abcjs), free
// notes, and photos of sheet music.

import { getAllSongs, getSong, saveSong, deleteSong } from "./store.js";
import { HARP_KEYS } from "./harmonica.js";
import { getHarpKey } from "./settings.js";
import { renderTabbedNotation } from "./tablature.js";

const el = {};
let current = null; // song being edited
let renderTimer = null;
let currentTune = null; // last rendered abcjs tune, for playback
let synth = null;
let synthCtx = null;

export function initSongs() {
  el.listView = document.getElementById("songs-list-view");
  el.editorView = document.getElementById("song-editor-view");
  el.list = document.getElementById("songs-list");
  el.search = document.getElementById("song-search");
  el.newBtn = document.getElementById("song-new");

  el.title = document.getElementById("song-title");
  el.key = document.getElementById("song-key");
  el.tab = document.getElementById("song-tab");
  el.abc = document.getElementById("song-abc");
  el.notation = document.getElementById("song-notation");
  el.tabToggle = document.getElementById("tab-overlay-toggle");
  el.notes = document.getElementById("song-notes");
  el.photos = document.getElementById("song-photos");
  el.photoInput = document.getElementById("photo-input");
  el.play = document.getElementById("abc-play");

  el.key.innerHTML = HARP_KEYS.map(
    (k) => `<option value="${k.key}">${k.key}</option>`
  ).join("");

  el.newBtn.addEventListener("click", () => openEditor(null));
  el.search.addEventListener("input", renderList);
  document.getElementById("editor-back").addEventListener("click", closeEditor);
  document.getElementById("editor-save").addEventListener("click", save);
  document.getElementById("editor-delete").addEventListener("click", removeCurrent);

  el.abc.addEventListener("input", scheduleNotation);
  el.key.addEventListener("change", renderNotation); // tab depends on harp key
  el.tabToggle.addEventListener("change", renderNotation);
  el.play.addEventListener("click", playAbc);
  document
    .getElementById("abc-template")
    .addEventListener("click", insertAbcTemplate);

  el.photoInput.addEventListener("change", onPhotosPicked);

  // Edit/delete via delegation on the list.
  el.list.addEventListener("click", (e) => {
    const card = e.target.closest("[data-id]");
    if (card) openEditor(card.dataset.id);
  });

  // Remove photo via delegation.
  el.photos.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-photo-idx]");
    if (btn) {
      current.photos.splice(+btn.dataset.photoIdx, 1);
      renderPhotos();
    }
  });

  renderList();
}

export async function refreshSongs() {
  if (!el.editorView.classList.contains("hidden")) return;
  renderList();
}

async function renderList() {
  const q = (el.search.value || "").toLowerCase();
  const songs = await getAllSongs();
  const filtered = songs.filter(
    (s) =>
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.tab || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q)
  );

  if (!filtered.length) {
    el.list.innerHTML = `<p class="empty">${
      songs.length ? "No songs match your search." : "No saved songs yet. Tap + New song to add tabs, notation, or a photo of sheet music."
    }</p>`;
    return;
  }

  el.list.innerHTML = filtered
    .map((s) => {
      const date = new Date(s.updatedAt).toLocaleDateString();
      const badges = [
        s.tab ? "tab" : null,
        s.abc ? "notation" : null,
        s.photos && s.photos.length ? `${s.photos.length}📷` : null,
      ].filter(Boolean);
      return `<button class="song-card" data-id="${s.id}">
        <div class="song-card-main">
          <span class="song-card-title">${escapeHtml(s.title || "Untitled")}</span>
          <span class="song-card-sub">${s.key} harp · ${date}</span>
        </div>
        <div class="song-card-badges">${badges
          .map((b) => `<span class="badge">${b}</span>`)
          .join("")}</div>
      </button>`;
    })
    .join("");
}

function openEditor(id) {
  if (id) {
    getSong(id).then((s) => {
      current = { ...s, photos: [...(s.photos || [])] };
      fillEditor();
    });
  } else {
    current = {
      id: null,
      title: "",
      key: getHarpKey(),
      tab: "",
      abc: "",
      notes: "",
      photos: [],
    };
    fillEditor();
  }
}

function fillEditor() {
  el.title.value = current.title || "";
  el.key.value = current.key || "C";
  el.tab.value = current.tab || "";
  el.abc.value = current.abc || "";
  el.notes.value = current.notes || "";
  document.getElementById("editor-delete").style.display = current.id
    ? ""
    : "none";
  renderPhotos();
  renderNotation();
  el.listView.classList.add("hidden");
  el.editorView.classList.remove("hidden");
  el.editorView.scrollTop = 0;
}

function closeEditor() {
  el.editorView.classList.add("hidden");
  el.listView.classList.remove("hidden");
  stopAbc();
  current = null;
  renderList();
}

async function save() {
  if (!current) return;
  current.title = el.title.value.trim() || "Untitled";
  current.key = el.key.value;
  current.tab = el.tab.value;
  current.abc = el.abc.value;
  current.notes = el.notes.value;
  const saved = await saveSong(current);
  current = saved;
  document.getElementById("editor-delete").style.display = "";
  flash("Saved ✓");
}

async function removeCurrent() {
  if (!current || !current.id) return;
  if (!confirm("Delete this song?")) return;
  await deleteSong(current.id);
  closeEditor();
}

// ---- ABC notation ----
function scheduleNotation() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNotation, 300);
}

function renderNotation() {
  const abc = el.abc.value.trim();
  if (!abc || typeof ABCJS === "undefined") {
    el.notation.innerHTML = abc
      ? "<p class='muted'>Notation engine loading…</p>"
      : "<p class='muted'>Type ABC notation above to see it rendered here — with the harmonica tab under each note.</p>";
    el.play.disabled = !abc;
    currentTune = null;
    return;
  }
  const harpKey = el.tabToggle.checked ? el.key.value : null;
  currentTune = renderTabbedNotation(el.notation, abc, harpKey);
  if (!currentTune) {
    el.notation.innerHTML = "<p class='muted'>Couldn't render that notation.</p>";
  }
  el.play.disabled = !currentTune;
}

async function playAbc() {
  if (typeof ABCJS === "undefined" || !ABCJS.synth.supportsAudio()) {
    flash("Audio playback not supported here");
    return;
  }
  try {
    stopAbc();
    if (!currentTune) renderNotation();
    if (!currentTune) return;
    synthCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (synthCtx.state === "suspended") await synthCtx.resume();
    synth = new ABCJS.synth.CreateSynth();
    await synth.init({ audioContext: synthCtx, visualObj: currentTune });
    await synth.prime();
    synth.start();
    flash("Playing…");
  } catch (err) {
    flash("Playback error");
    console.error(err);
  }
}

function stopAbc() {
  try {
    if (synth) synth.stop();
    if (synthCtx) synthCtx.close();
  } catch {}
  synth = null;
  synthCtx = null;
}

function insertAbcTemplate() {
  if (el.abc.value.trim()) return;
  el.abc.value = `X:1
T:My Tune
M:4/4
L:1/4
K:C
C D E F | G A B c |`;
  renderNotation();
}

// ---- Photos ----
async function onPhotosPicked(e) {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    try {
      const dataUrl = await fileToResizedDataUrl(f, 1400, 0.82);
      current.photos.push(dataUrl);
    } catch (err) {
      console.error(err);
    }
  }
  el.photoInput.value = "";
  renderPhotos();
}

function renderPhotos() {
  if (!current.photos || !current.photos.length) {
    el.photos.innerHTML = "<p class='muted'>No photos attached.</p>";
    return;
  }
  el.photos.innerHTML = current.photos
    .map(
      (src, i) => `<div class="photo">
        <img src="${src}" alt="sheet music ${i + 1}" />
        <button class="photo-del" data-photo-idx="${i}" aria-label="Remove">✕</button>
      </div>`
    )
    .join("");
}

function fileToResizedDataUrl(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxDim / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ---- misc ----
let flashTimer = null;
function flash(msg) {
  const f = document.getElementById("toast");
  f.textContent = msg;
  f.classList.add("show");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => f.classList.remove("show"), 1600);
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}
