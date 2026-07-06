// Songs / tabs library: list, create, edit, delete. Each song can hold
// harmonica tab text, ABC notation (rendered + playable via abcjs), free
// notes, and photos of sheet music.

import { getAllSongs, getSong, saveSong, deleteSong, seedStarterSongs } from "./store.js";
import { HARP_KEYS, techniquesForMidi, offsetForKey } from "./harmonica.js";
import { getHarpKey, getInstrument, onInstrumentChange } from "./settings.js";
import { renderTabbedNotation, tabStringFromTune, melodyMidisFromTune, kalimbaTab, violinTab } from "./tablature.js";
import { parseImport, transcribeTrack, kalimbaTabToAbc } from "./importers.js";
import { searchTunes, browseTunes, fetchTuneAbc } from "./tunesearch.js";
import {
  bindSongMetronome,
  setBpm,
  setBeats,
  onMetroState,
  stopMetronome,
} from "./metronome.js";

const el = {};
let current = null; // song being edited
let renderTimer = null;
let currentTune = null; // last rendered abcjs tune, for playback
let synth = null;
let synthCtx = null;
let picker = null; // import-picker state
let diffFilter = "all"; // songs-list difficulty filter
let online = { mode: null, page: 1 }; // online browse/search state
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
  el.lyrics = document.getElementById("song-lyrics");
  el.difficulty = document.getElementById("song-difficulty");
  el.tabCustom = document.getElementById("tab-custom");
  el.tabHint = document.getElementById("tab-hint");
  el.photos = document.getElementById("song-photos");
  el.photoInput = document.getElementById("photo-input");
  el.play = document.getElementById("abc-play");
  el.diffFilter = document.getElementById("diff-filter");

  el.key.innerHTML = HARP_KEYS.map(
    (k) => `<option value="${k.key}">${k.key}</option>`
  ).join("");

  el.importBtn = document.getElementById("song-import");
  el.importInput = document.getElementById("import-input");
  el.aiProgress = document.getElementById("ai-progress");
  el.aiMsg = document.getElementById("ai-progress-msg");
  el.aiBar = document.getElementById("ai-bar-fill");
  el.findBtn = document.getElementById("song-find");
  el.onlinePanel = document.getElementById("online-panel");
  el.onlineQuery = document.getElementById("online-query");
  el.onlineGo = document.getElementById("online-go");
  el.onlineResults = document.getElementById("online-results");
  el.onlineBrowse = document.getElementById("online-browse");
  el.onlineType = document.getElementById("online-type");

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

  // paste-tab
  el.pasteBtn = document.getElementById("song-paste");
  el.pastePanel = document.getElementById("paste-panel");
  el.pasteTitle = document.getElementById("paste-title");
  el.pasteText = document.getElementById("paste-text");
  el.pasteCreate = document.getElementById("paste-create");
  el.pasteBtn.addEventListener("click", () => {
    el.pastePanel.classList.toggle("hidden");
    if (!el.pastePanel.classList.contains("hidden")) el.pasteText.focus();
  });
  el.pasteCreate.addEventListener("click", createFromPastedTab);

  // reference link (in the editor)
  el.refUrl = document.getElementById("song-refurl");
  el.refUrlOpen = document.getElementById("song-refurl-open");
  el.refUrl.addEventListener("input", updateRefLink);
  el.onlineGo.addEventListener("click", runOnlineSearch);
  el.onlineQuery.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runOnlineSearch();
  });
  el.onlineBrowse.addEventListener("click", () => browsePopular(1));
  el.onlineType.addEventListener("change", () => {
    if (online.mode === "browse") browsePopular(1);
    else if (online.mode === "search") runOnlineSearch();
  });
  el.onlineResults.addEventListener("click", (e) => {
    if (e.target.closest("[data-loadmore]")) {
      browsePopular(online.page + 1);
      return;
    }
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
  el.lyrics.addEventListener("input", scheduleNotation); // lyrics render under notes
  el.key.addEventListener("change", renderNotation); // tab depends on harp key
  el.tabToggle.addEventListener("change", renderNotation);
  el.tabCustom.addEventListener("change", () => {
    if (!current) return;
    current.customTab = el.tabCustom.checked;
    applyTabMode();
    if (!current.customTab) renderNotation(); // re-derive from the notation
  });
  el.tab.addEventListener("input", autosizeTab);
  window.addEventListener("resize", () => {
    if (!el.editorView.classList.contains("hidden")) autosizeTab();
  });
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
  document.getElementById("fit-harp").addEventListener("click", fitToHarp);
  onInstrumentChange(() => {
    updateFitLabel();
    if (!el.editorView.classList.contains("hidden")) renderNotation();
  });
  updateFitLabel();

  // Practice metronome on the song page: bind the shared engine, and remember
  // whatever tempo the player dials in with each song.
  bindSongMetronome();
  el.metroHint = document.getElementById("song-metro-hint");
  onMetroState(({ bpm, beatsPerBar }) => {
    if (current && !el.editorView.classList.contains("hidden")) {
      current.tempo = bpm;
      current.beats = beatsPerBar;
    }
  });
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
        s.refUrl ? "🔗" : null,
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
  const isAudio =
    /\.(mp3|wav|m4a|mp4|aac|ogg|flac|webm)$/i.test(file.name) ||
    file.type.startsWith("audio/") ||
    file.type === "video/mp4";
  if (isAudio) showAiProgress("Preparing audio…", 0);
  else flash("Reading " + file.name + "…");
  try {
    const parsed = await parseImport(file, (msg, pct) => updateAiProgress(msg, pct));
    hideAiProgress();
    if (parsed.kind === "bulk") {
      await importBulk(parsed.songs);
    } else if (parsed.kind === "abc") {
      openEditorWithContent({ abc: parsed.abc, title: parsed.title, key: parsed.key });
      if (parsed.warning) setTimeout(() => alert(parsed.warning), 50);
      else flash("Imported — review and Save");
    } else {
      openImportPicker(parsed);
    }
  } catch (err) {
    hideAiProgress();
    console.error(err);
    alert("Couldn't import this file:\n" + (err.message || err));
  }
}

// Create many songs at once from a JSON list ({title, refUrl, tab, abc, ...}).
async function importBulk(list) {
  let n = 0;
  for (const s of list) {
    if (!s || !s.title) continue;
    try {
      await saveSong({
        title: String(s.title),
        key: s.key || "C",
        tab: s.tab || "",
        abc: s.abc || "",
        notes: s.notes || "",
        lyrics: s.lyrics || "",
        difficulty: s.difficulty || "",
        refUrl: s.refUrl || s.url || "",
        customTab: !!s.customTab,
      });
      n++;
    } catch (e) {
      console.warn("Skipped a bulk song", e);
    }
  }
  flash(`Imported ${n} song${n === 1 ? "" : "s"}`);
  renderList();
}

// Turn pasted kalimba numbers into a new song.
function createFromPastedTab() {
  const text = el.pasteText.value.trim();
  if (!text) {
    flash("Paste some kalimba numbers first");
    return;
  }
  const title = el.pasteTitle.value.trim() || "Pasted tab";
  try {
    const abc = kalimbaTabToAbc(text, title);
    el.pastePanel.classList.add("hidden");
    el.pasteText.value = "";
    el.pasteTitle.value = "";
    openEditorWithContent({ abc, title, key: "C" });
    flash("Created — review and Save");
  } catch (err) {
    alert(err.message || err);
  }
}

function updateRefLink() {
  const url = el.refUrl.value.trim();
  const ok = /^https?:\/\//i.test(url);
  el.refUrlOpen.style.display = ok ? "" : "none";
  if (ok) el.refUrlOpen.href = url;
}

function showAiProgress(msg, pct) {
  el.aiMsg.textContent = msg;
  el.aiBar.style.width = (pct || 0) + "%";
  el.aiProgress.classList.remove("hidden");
}
function updateAiProgress(msg, pct) {
  if (msg) el.aiMsg.textContent = msg;
  if (typeof pct === "number") el.aiBar.style.width = Math.max(0, Math.min(100, pct)) + "%";
}
function hideAiProgress() {
  el.aiProgress.classList.add("hidden");
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
  online = { mode: "search", page: 1 };
  el.onlineResults.innerHTML = "<p class='muted'>Searching…</p>";
  try {
    const res = await searchTunes(q, el.onlineType.value);
    if (!res.tunes.length) {
      el.onlineResults.innerHTML =
        "<p class='empty'>No tunes found. This catalogue is folk/traditional — modern songs won't appear. Import a MIDI for those.</p>";
      return;
    }
    renderOnlineResults(res, false);
  } catch (err) {
    console.error(err);
    el.onlineResults.innerHTML =
      "<p class='empty'>Search failed — check your connection.</p>";
  }
}

async function browsePopular(page) {
  online = { mode: "browse", page };
  if (page === 1) el.onlineResults.innerHTML = "<p class='muted'>Loading tunes…</p>";
  const loadMore = el.onlineResults.querySelector("[data-loadmore]");
  if (loadMore) loadMore.textContent = "Loading…";
  try {
    const res = await browseTunes(page, el.onlineType.value);
    online.page = res.page;
    online.pages = res.pages;
    renderOnlineResults(res, page > 1);
  } catch (err) {
    console.error(err);
    if (page === 1)
      el.onlineResults.innerHTML = "<p class='empty'>Couldn't load tunes — check your connection.</p>";
  }
}

function renderOnlineResults(res, append) {
  const cards = res.tunes
    .map(
      (t) =>
        `<button class="song-card" data-tune-id="${t.id}" data-tune-name="${escapeHtml(
          t.name
        )}">
          <div class="song-card-main">
            <span class="song-card-title">${escapeHtml(t.name)}</span>
            <span class="song-card-sub">${escapeHtml(t.type || "tune")}</span>
          </div>
          <span class="badge">open →</span>
        </button>`
    )
    .join("");
  const more =
    online.mode === "browse" && res.page < res.pages
      ? `<button class="ghost load-more" data-loadmore="1">Load more tunes</button>`
      : "";

  if (append) {
    const old = el.onlineResults.querySelector("[data-loadmore]");
    if (old) old.remove();
    el.onlineResults.insertAdjacentHTML("beforeend", cards + more);
  } else {
    el.onlineResults.innerHTML = cards + more;
    el.onlineResults.scrollTop = 0;
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
  el.lyrics.value = current.lyrics || "";
  el.refUrl.value = current.refUrl || "";
  updateRefLink();
  el.difficulty.value = current.difficulty || "";
  current.transpose = current.transpose || 0;
  current.customTab = !!current.customTab;
  updateTransposeReadout();
  applyTabMode();
  document.getElementById("editor-delete").style.display = current.id
    ? ""
    : "none";
  renderPhotos();
  renderNotation();
  el.listView.classList.add("hidden");
  el.editorView.classList.remove("hidden");
  el.editorView.scrollTop = 0;
  autosizeTab(); // now that the field is visible, size it to its content
  seedMetronome(); // dial the practice tempo to this song
}

// Set the practice metronome for the song now open: a saved practice tempo
// wins; otherwise fall back to the written Q:/M: in the notation. Also surface
// the sheet's written tempo as a one-tap "snap back".
function seedMetronome() {
  const written = parseAbcTempo(el.abc.value);
  const beats = current.beats || written.beats;
  const tempo = current.tempo || written.bpm;
  if (beats) setBeats(beats);
  if (tempo) setBpm(tempo); // onMetroState records the clamped value onto `current`
  if (!el.metroHint) return;
  if (written.bpm) {
    el.metroHint.style.display = "";
    el.metroHint.innerHTML =
      `Sheet tempo: ♩ = ${written.bpm} · ` +
      `<button type="button" class="link-btn" id="song-metro-use">use</button>`;
    document
      .getElementById("song-metro-use")
      .addEventListener("click", () => setBpm(written.bpm));
  } else {
    el.metroHint.style.display = "none";
  }
}

// Read a beats-per-bar and a beats-per-minute out of ABC headers, if present.
// Q: forms handled: "Q:120", "Q:1/4=120", 'Q:"Allegro" 1/4=120'. M: forms:
// "M:4/4", "M:6/8", "M:C" (=4/4), "M:C|" (cut time = 2/2).
function parseAbcTempo(abc) {
  let bpm = null;
  let beats = null;
  const q = (abc || "").match(/^\s*Q:\s*(.+)$/im);
  if (q) {
    const eq = q[1].match(/=\s*(\d+)/); // "…=120"
    const bare = q[1].match(/(\d+)\s*$/); // trailing bare number
    if (eq) bpm = +eq[1];
    else if (bare) bpm = +bare[1];
  }
  const m = (abc || "").match(/^\s*M:\s*(\S+)/im);
  if (m) {
    const v = m[1];
    if (/^C\|/i.test(v)) beats = 2;
    else if (/^C$/i.test(v)) beats = 4;
    else {
      const num = v.match(/^(\d+)/);
      if (num) beats = +num[1];
    }
    // The beats select only offers 1,2,3,4,6 — map anything else to a sensible
    // felt pulse so the accent still lands on the downbeat.
    if (beats && ![1, 2, 3, 4, 6].includes(beats)) {
      if (beats % 3 === 0) beats = beats / 3; // compound meters → felt pulses
      if (![1, 2, 3, 4, 6].includes(beats)) beats = 4;
    }
  }
  return { bpm, beats };
}

function closeEditor() {
  el.editorView.classList.add("hidden");
  el.listView.classList.remove("hidden");
  stopAbc();
  stopMetronome();
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
  current.lyrics = el.lyrics.value;
  current.refUrl = el.refUrl.value.trim();
  current.difficulty = el.difficulty.value;
  current.customTab = el.tabCustom.checked;
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
  const overlayKey = el.tabToggle.checked ? el.key.value : null;
  const transpose = current ? current.transpose || 0 : 0;
  const lyrics = el.lyrics.value.trim();
  const abcToRender = lyrics ? injectLyrics(abc, lyrics) : abc;
  currentTune = renderTabbedNotation(el.notation, abcToRender, overlayKey, transpose);
  if (!currentTune) {
    el.notation.innerHTML = "<p class='muted'>Couldn't render that notation.</p>";
  }
  el.play.disabled = !currentTune;

  // Auto-fill the tab field from the notation unless the user marked it custom.
  if (currentTune && current && !current.customTab) {
    el.tab.value = tabStringFromTune(currentTune, el.key.value);
  }
  autosizeTab();
}

// Put the lyrics under the notes: join the music body onto one source line and
// append a `w:` line, so abcjs aligns each syllable to a note and wraps both
// together. (The music body is everything after the K: header.)
function injectLyrics(abc, lyrics) {
  const lines = abc.replace(/\r/g, "").split("\n");
  const header = [];
  const body = [];
  let inBody = false;
  for (const ln of lines) {
    if (!inBody) {
      header.push(ln);
      if (/^\s*K:/.test(ln)) inBody = true;
    } else if (ln.trim() && !/^\s*w:/i.test(ln)) {
      body.push(ln.trim());
    }
  }
  if (!body.length) return abc; // no melody yet
  const w = lyrics.replace(/\s+/g, " ").trim();
  return `${header.join("\n")}\n${body.join(" ")}\nw: ${w}\n`;
}

// Grow the tab textarea to fit its content so the whole tab is visible at once
// (no inner scrolling) — important on a phone.
function autosizeTab() {
  if (!el.tab) return;
  el.tab.style.height = "auto";
  el.tab.style.height = el.tab.scrollHeight + 4 + "px";
}

// Reflect custom/auto mode on the tab field (read-only + hint) without
// overwriting its contents.
function applyTabMode() {
  const custom = current ? !!current.customTab : false;
  const hasAbc = !!el.abc.value.trim();
  el.tabCustom.checked = custom;
  el.tab.readOnly = !custom && hasAbc;
  el.tab.classList.toggle("auto", !custom && hasAbc);
  el.tabHint.textContent =
    custom || !hasAbc
      ? "Edit the tab freely — it won't be overwritten."
      : "Auto-filled from the notation. * (blue on the staff) = nearest playable note for a chromatic. Tick “Custom” to edit.";
}

function updateTransposeReadout() {
  const t = current ? current.transpose || 0 : 0;
  el.transposeReadout.textContent = (t > 0 ? "+" : "") + t + (t ? " st" : "");
}

function updateFitLabel() {
  const inst = getInstrument();
  const b = document.getElementById("fit-harp");
  if (b) {
    b.textContent =
      inst === "kalimba"
        ? "🎯 Fit to my kalimba"
        : inst === "violin"
        ? "🎯 Fit to first position"
        : "🎯 Fit to my harp key";
  }
  // Keep the tab-field labels honest for whichever instrument is selected.
  const word = inst === "kalimba" ? "Kalimba" : inst === "violin" ? "Violin" : "Harmonica";
  const fieldLabel = document.getElementById("tab-field-label");
  if (fieldLabel) fieldLabel.textContent = `${word} tab`;
  const toggleLabel = document.getElementById("tab-toggle-label");
  if (toggleLabel) {
    toggleLabel.textContent =
      inst === "violin"
        ? "Show string + finger under each note"
        : inst === "kalimba"
        ? "Show kalimba number under each note"
        : "Show harmonica tab under each note (uses the key above)";
  }
}

// One tap: transpose the song so it lays out best on the selected harp key
// (first position), searching whole+semitone shifts for the most playable notes.
function fitToHarp() {
  if (!current || !currentTune) {
    flash("Add some notation first");
    return;
  }
  const inst = getInstrument();
  const offset = offsetForKey(el.key.value);
  // Score how playable a note is on the current instrument (exact = 2, a near
  // substitute = 1).
  const playable = (m) => {
    if (inst === "violin") return violinTab(m) ? 2 : 0; // first-position range
    if (inst === "kalimba") {
      if (kalimbaTab(m)) return 2;
      return kalimbaTab(m - 1) || kalimbaTab(m + 1) ? 1 : 0;
    }
    if (techniquesForMidi(m, offset).length) return 2;
    return techniquesForMidi(m - 1, offset).length || techniquesForMidi(m + 1, offset).length ? 1 : 0;
  };

  const t0 = current.transpose || 0;
  const base = melodyMidisFromTune(currentTune).map((m) => m - t0);
  if (!base.length) {
    flash("No notes to fit");
    return;
  }
  let bestT = t0;
  let bestScore = -Infinity;
  for (let T = -24; T <= 24; T++) {
    let score = 0;
    for (const m of base) score += playable(m + T);
    score -= Math.abs(T) * 0.001; // tie-break toward the smallest shift
    if (score > bestScore) {
      bestScore = score;
      bestT = T;
    }
  }
  current.transpose = bestT;
  updateTransposeReadout();
  renderNotation();
  flash(
    inst === "violin"
      ? "Fitted to first position"
      : inst === "kalimba"
      ? "Fitted to your kalimba"
      : `Fitted to your ${el.key.value} harp`
  );
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
