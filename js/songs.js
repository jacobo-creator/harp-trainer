// Songs / tabs library: list, create, edit, delete. Each song can hold
// harmonica tab text, ABC notation (rendered + playable via abcjs), free
// notes, and photos of sheet music.

import { getAllSongs, getSong, saveSong, deleteSong, seedStarterSongs } from "./store.js";
import { HARP_KEYS, techniquesForMidi, offsetForKey } from "./harmonica.js";
import { getHarpKey } from "./settings.js";
import { renderTabbedNotation } from "./tablature.js";
import { parseImport, transcribeTrack } from "./importers.js";
import { searchTunes, fetchTuneAbc } from "./tunesearch.js";

const el = {};
let current = null; // song being edited
let renderTimer = null;
let currentTune = null; // last rendered abcjs tune, for playback
let synth = null;
let synthCtx = null;
let picker = null; // import-picker state
let diffFilter = "all"; // songs-list difficulty filter
let previewSynth = null;
let previewCtx = null;
let previewDiv = null;

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
  el.difficulty = document.getElementById("song-difficulty");
  el.photos = document.getElementById("song-photos");
  el.photoInput = document.getElementById("photo-input");
  el.play = document.getElementById("abc-play");
  el.diffFilter = document.getElementById("diff-filter");

  el.key.innerHTML = HARP_KEYS.map(
    (k) => `<option value="${k.key}">${k.key}</option>`
  ).join("");

  el.importBtn = document.getElementById("song-import");
  el.importInput = document.getElementById("import-input");
  el.findBtn = document.getElementById("song-find");
  el.onlinePanel = document.getElementById("online-panel");
  el.onlineQuery = document.getElementById("online-query");
  el.onlineGo = document.getElementById("online-go");
  el.onlineResults = document.getElementById("online-results");

  el.newBtn.addEventListener("click", () => openEditor(null));
  el.search.addEventListener("input", renderList);

  el.diffFilter.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-diff]");
    if (!chip) return;
    diffFilter = chip.dataset.diff;
    el.diffFilter.querySelectorAll(".diff-chip").forEach((c) =>
      c.classList.toggle("active", c === chip)
    );
    renderList();
  });

  el.importBtn.addEventListener("click", () => el.importInput.click());
  el.importInput.addEventListener("change", onImportFile);
  el.findBtn.addEventListener("click", () => {
    el.onlinePanel.classList.toggle("hidden");
    if (!el.onlinePanel.classList.contains("hidden")) el.onlineQuery.focus();
  });
  el.onlineGo.addEventListener("click", runOnlineSearch);
  el.onlineQuery.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runOnlineSearch();
  });
  el.onlineResults.addEventListener("click", (e) => {
    const card = e.target.closest("[data-tune-id]");
    if (card) loadOnlineTune(card.dataset.tuneId, card.dataset.tuneName);
  });

  // ---- import picker ----
  el.importModal = document.getElementById("import-modal");
  el.importModalTitle = document.getElementById("import-modal-title");
  el.importTracks = document.getElementById("import-tracks");
  el.importHarp = document.getElementById("import-harp");
  el.importCollapse = document.getElementById("import-collapse");
  el.importShift = document.getElementById("import-shift");
  el.importPlayability = document.getElementById("import-playability");
  el.importPreview = document.getElementById("import-preview");
  el.importConfirm = document.getElementById("import-confirm");
  el.importCancel = document.getElementById("import-cancel");

  el.importHarp.innerHTML = HARP_KEYS.map(
    (k) => `<option value="${k.key}">${k.key} harp</option>`
  ).join("");

  el.importTracks.addEventListener("change", (e) => {
    if (e.target.name === "imptrack") {
      picker.trackIndex = +e.target.value;
      refreshPicker();
    }
  });
  el.importHarp.addEventListener("change", () => {
    picker.harpKey = el.importHarp.value;
    refreshPicker();
  });
  el.importCollapse.addEventListener("change", () => {
    picker.collapse = el.importCollapse.value;
    refreshPicker();
  });
  el.importModal.querySelectorAll("[data-shift]").forEach((b) =>
    b.addEventListener("click", () => {
      picker.shift = Math.max(-36, Math.min(36, picker.shift + +b.dataset.shift));
      refreshPicker();
    })
  );
  el.importPreview.addEventListener("click", () => {
    if (picker.abc) previewAbc(picker.abc);
  });
  el.importConfirm.addEventListener("click", confirmImport);
  el.importCancel.addEventListener("click", closeImportPicker);
  document.getElementById("editor-back").addEventListener("click", closeEditor);
  document.getElementById("editor-save").addEventListener("click", save);
  document.getElementById("editor-delete").addEventListener("click", removeCurrent);

  el.abc.addEventListener("input", scheduleNotation);
  el.key.addEventListener("change", renderNotation); // tab depends on harp key
  el.tabToggle.addEventListener("change", renderNotation);
  el.play.addEventListener("click", playAbc);

  el.transposeReadout = document.getElementById("transpose-readout");
  document.querySelectorAll("#song-editor-view [data-tr]").forEach((b) =>
    b.addEventListener("click", () => {
      if (!current) return;
      current.transpose = Math.max(-24, Math.min(24, (current.transpose || 0) + +b.dataset.tr));
      updateTransposeReadout();
      renderNotation();
    })
  );
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

  seedStarterSongs().then(renderList, renderList);
}

export async function refreshSongs() {
  if (!el.editorView.classList.contains("hidden")) return;
  renderList();
}

async function renderList() {
  const q = (el.search.value || "").toLowerCase();
  const songs = await getAllSongs();
  const filtered = songs.filter((s) => {
    if (diffFilter !== "all" && (s.difficulty || "") !== diffFilter) return false;
    return (
      !q ||
      (s.title || "").toLowerCase().includes(q) ||
      (s.tab || "").toLowerCase().includes(q) ||
      (s.notes || "").toLowerCase().includes(q)
    );
  });

  if (!filtered.length) {
    const msg = !songs.length
      ? "No saved songs yet. Tap + New song to add tabs, notation, or a photo of sheet music."
      : diffFilter !== "all" && !q
      ? `No ${diffFilter} songs.`
      : "No songs match your search.";
    el.list.innerHTML = `<p class="empty">${msg}</p>`;
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
      const diff = s.difficulty
        ? `<span class="diff diff-${s.difficulty}">${s.difficulty}</span>`
        : "";
      return `<button class="song-card" data-id="${s.id}">
        <div class="song-card-main">
          <span class="song-card-title">${escapeHtml(s.title || "Untitled")}</span>
          <span class="song-card-sub">${diff}${s.key} harp · ${date}</span>
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

// Open the editor for a brand-new song pre-filled from an import / online tune.
function openEditorWithContent({ abc = "", title = "", tab = "", key }) {
  current = {
    id: null,
    title,
    key: key || getHarpKey(),
    tab,
    abc,
    notes: "",
    photos: [],
  };
  fillEditor();
}

async function onImportFile(e) {
  const file = e.target.files && e.target.files[0];
  el.importInput.value = "";
  if (!file) return;
  flash("Reading " + file.name + "…");
  try {
    const parsed = await parseImport(file);
    if (parsed.kind === "abc") {
      openEditorWithContent({ abc: parsed.abc, title: parsed.title });
      if (parsed.warning) setTimeout(() => alert(parsed.warning), 50);
      else flash("Imported — review and Save");
    } else {
      openImportPicker(parsed);
    }
  } catch (err) {
    console.error(err);
    alert("Couldn't import this file:\n" + (err.message || err));
  }
}

// ---- import picker: choose which track/voice becomes the tab line ----
function openImportPicker(parsed) {
  const nonDrum = parsed.tracks.filter((t) => !t.drums);
  const pool = nonDrum.length ? nonDrum : parsed.tracks;
  const def = pool.reduce((a, b) => (b.noteCount > a.noteCount ? b : a));
  picker = {
    parsed,
    trackIndex: def.index,
    collapse: "top",
    shift: 0,
    harpKey: getHarpKey(),
    abc: "",
  };
  el.importModalTitle.textContent = parsed.title || "Import melody";
  el.importHarp.value = picker.harpKey;
  el.importCollapse.value = "top";
  renderImportTracks();
  refreshPicker();
  el.importModal.classList.remove("hidden");
}

function renderImportTracks() {
  el.importTracks.innerHTML = picker.parsed.tracks
    .map(
      (t) => `<label class="track-row${t.index === picker.trackIndex ? " sel" : ""}">
        <input type="radio" name="imptrack" value="${t.index}" ${
        t.index === picker.trackIndex ? "checked" : ""
      } />
        <span class="track-main">
          <span class="track-name">${escapeHtml(t.name)}${t.drums ? " · drums" : ""}</span>
          <span class="track-sub">${t.noteCount} notes · range ${t.lowLabel}–${t.highLabel}</span>
        </span>
      </label>`
    )
    .join("");
}

// Re-transcribe with current options and update the readouts.
function refreshPicker() {
  el.importShift.textContent =
    (picker.shift > 0 ? "+" : "") + picker.shift + (picker.shift ? " st" : "");
  el.importTracks.querySelectorAll(".track-row").forEach((row) => {
    const checked = row.querySelector("input").checked;
    row.classList.toggle("sel", checked);
  });

  const { abc, notes } = transcribeTrack(picker.parsed, picker.trackIndex, {
    collapse: picker.collapse,
    shift: picker.shift,
  });
  picker.abc = abc;

  const offset = offsetForKey(picker.harpKey);
  const total = notes.length;
  const playable = notes.filter((m) => techniquesForMidi(m, offset).length).length;
  el.importPlayability.textContent = total
    ? `♪ ${playable} of ${total} notes playable on a ${picker.harpKey} harp` +
      (playable < total ? " — try ±8va or a different harp key" : " ✓")
    : "No notes in this track.";
  el.importPlayability.classList.toggle("good", total > 0 && playable === total);
}

function confirmImport() {
  const { abc, title } = transcribeTrack(picker.parsed, picker.trackIndex, {
    collapse: picker.collapse,
    shift: picker.shift,
  });
  const key = picker.harpKey;
  closeImportPicker();
  openEditorWithContent({ abc, title, key });
  flash("Imported — review and Save");
}

function closeImportPicker() {
  stopPreview();
  el.importModal.classList.add("hidden");
  picker = null;
}

async function previewAbc(abc) {
  stopPreview();
  if (typeof ABCJS === "undefined" || !ABCJS.synth.supportsAudio()) {
    flash("Preview not supported here");
    return;
  }
  try {
    if (!previewDiv) {
      previewDiv = document.createElement("div");
      previewDiv.style.display = "none";
      document.body.appendChild(previewDiv);
    }
    const visual = ABCJS.renderAbc(previewDiv, abc, {})[0];
    previewCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (previewCtx.state === "suspended") await previewCtx.resume();
    previewSynth = new ABCJS.synth.CreateSynth();
    await previewSynth.init({ audioContext: previewCtx, visualObj: visual });
    await previewSynth.prime();
    previewSynth.start();
  } catch (err) {
    console.error(err);
    flash("Preview error");
  }
}

function stopPreview() {
  try {
    if (previewSynth) previewSynth.stop();
    if (previewCtx) previewCtx.close();
  } catch {}
  previewSynth = null;
  previewCtx = null;
}

async function runOnlineSearch() {
  const q = el.onlineQuery.value.trim();
  if (!q) return;
  el.onlineResults.innerHTML = "<p class='muted'>Searching…</p>";
  try {
    const tunes = await searchTunes(q);
    if (!tunes.length) {
      el.onlineResults.innerHTML =
        "<p class='empty'>No tunes found. This database is folk/traditional — modern songs won't appear. Import a MIDI for those.</p>";
      return;
    }
    el.onlineResults.innerHTML = tunes
      .map(
        (t) =>
          `<button class="song-card" data-tune-id="${t.id}" data-tune-name="${escapeHtml(
            t.name
          )}">
            <div class="song-card-main">
              <span class="song-card-title">${escapeHtml(t.name)}</span>
              <span class="song-card-sub">${escapeHtml(t.type || "tune")}</span>
            </div>
            <span class="badge">import →</span>
          </button>`
      )
      .join("");
  } catch (err) {
    console.error(err);
    el.onlineResults.innerHTML =
      "<p class='empty'>Search failed — check your connection.</p>";
  }
}

async function loadOnlineTune(id, name) {
  flash("Loading " + (name || "tune") + "…");
  try {
    const { abc, title } = await fetchTuneAbc(id);
    openEditorWithContent({ abc, title });
    flash("Loaded — review and Save");
  } catch (err) {
    console.error(err);
    alert("Couldn't load that tune:\n" + (err.message || err));
  }
}

function fillEditor() {
  el.title.value = current.title || "";
  el.key.value = current.key || "C";
  el.tab.value = current.tab || "";
  el.abc.value = current.abc || "";
  el.notes.value = current.notes || "";
  el.difficulty.value = current.difficulty || "";
  current.transpose = current.transpose || 0;
  updateTransposeReadout();
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
  current.difficulty = el.difficulty.value;
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
  const transpose = current ? current.transpose || 0 : 0;
  currentTune = renderTabbedNotation(el.notation, abc, harpKey, transpose);
  if (!currentTune) {
    el.notation.innerHTML = "<p class='muted'>Couldn't render that notation.</p>";
  }
  el.play.disabled = !currentTune;
}

function updateTransposeReadout() {
  const t = current ? current.transpose || 0 : 0;
  el.transposeReadout.textContent = (t > 0 ? "+" : "") + t + (t ? " st" : "");
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
