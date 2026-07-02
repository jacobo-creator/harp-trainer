// Convert imported music files into ABC notation for the editor.
//
// Two-phase for multi-track sources (MIDI / MusicXML):
//   parseImport(file)  -> { kind:'tracks', ... , tracks:[meta] }  (show picker)
//   transcribeTrack(parsed, trackIndex, {collapse, shift}) -> { abc, title, notes }
// Single-line sources (.abc, audio) return { kind:'abc', abc, title }.
//
// Harmonica is monophonic, so transcription reduces any chords/overlap to a
// single line: the highest ("top") or lowest ("bottom") note at each moment.

import { detectPitch } from "./pitch.js";
import { nameFromMidi } from "./notes.js";
import { HARP_KEYS, techniquesForMidi, offsetForKey } from "./harmonica.js";

// Parse pasted kalimba number notation into ABC. Numbers 1–7 = C D E F G A B;
// an octave dot/mark ABOVE raises an octave (' ° * + or a combining dot), a
// mark BELOW lowers it (. _ or a combining dot below); two above = top octave.
// Chords in ( ) are reduced to their top note. Rhythm isn't encoded in kalimba
// tabs, so notes come out even (quarter notes) for you to tidy.
const KALIMBA_DEG_PC = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 };
export function kalimbaTabToAbc(text, title) {
  const events = [];
  const tokens = String(text || "").replace(/[\r\n]+/g, " ").match(/\([^)]*\)|[^\s|]+/g) || [];
  for (const raw of tokens) {
    const chord = [];
    const re = /([.̣_]*)([1-7])(['’°*+̇̈".̣_]*)/g;
    let m;
    while ((m = re.exec(raw))) {
      const marks = (m[1] || "") + (m[3] || "");
      const above2 = (marks.match(/["̈]/g) || []).length;
      const above1 = (marks.match(/['’°*+̇]/g) || []).length;
      const below = (marks.match(/[._̣]/g) || []).length;
      const octave = 4 + above1 + 2 * above2 - below;
      chord.push((octave + 1) * 12 + KALIMBA_DEG_PC[+m[2]]);
    }
    if (chord.length) events.push({ midi: Math.max(...chord), len: 4 });
  }
  if (!events.length) throw new Error("No kalimba numbers found — paste digits 1–7 (with octave dots).");
  return assembleAbc(title || "Pasted tab", 4, 4, events, 16);
}

// Shift a melody (events with .midi) by whole octaves so its median note sits
// in the harp's comfortable register (~G4–C6). Extracted vocals are often well
// below harmonica range, which is why nothing was playable.
function fitOctave(events) {
  const ms = events.filter((e) => e.midi != null).map((e) => e.midi).sort((a, b) => a - b);
  if (!ms.length) return;
  const median = ms[Math.floor(ms.length / 2)];
  let shift = 0;
  while (median + shift < 67) shift += 12;
  while (median + shift > 84) shift -= 12;
  if (shift) events.forEach((e) => { if (e.midi != null) e.midi += shift; });
}

// Pick the harp key on which the most notes are playable (exact preferred over
// a near substitute), so an imported melody opens already in a sensible key.
function bestHarpKey(events) {
  const ms = events.filter((e) => e.midi != null).map((e) => e.midi);
  if (!ms.length) return "C";
  let best = "C";
  let bestScore = -1;
  for (const k of HARP_KEYS) {
    const off = offsetForKey(k.key);
    let score = 0;
    for (const m of ms) {
      if (techniquesForMidi(m, off).length) score += 2;
      else if (techniquesForMidi(m - 1, off).length || techniquesForMidi(m + 1, off).length) score += 1;
    }
    if (score > bestScore) { bestScore = score; best = k.key; }
  }
  return best;
}

const SHARP = ["C", "^C", "D", "^D", "E", "F", "^F", "G", "^G", "A", "^A", "B"];
const STEP_SEMITONE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// MIDI number -> ABC pitch token (e.g. 60 -> "C", 78 -> "^f", 59 -> "B,").
function midiToAbcToken(m) {
  const pc = ((m % 12) + 12) % 12;
  const oct = Math.floor(m / 12) - 1; // MIDI 60 = C4
  const raw = SHARP[pc];
  const acc = raw[0] === "^" ? "^" : "";
  const letter = raw.replace("^", "");
  return oct >= 5
    ? acc + letter.toLowerCase() + "'".repeat(oct - 5)
    : acc + letter + ",".repeat(4 - oct);
}

function sanitize(t) {
  return String(t || "Imported").replace(/[\r\n]+/g, " ").trim() || "Imported";
}

// Flat list of {midi|null, len} (len in sixteenths) -> ABC body, with barlines
// every `cellsPerBar` sixteenths and ties across barlines. L is 1/16.
function eventsToAbc(events, cellsPerBar) {
  let out = "";
  let cell = 0;
  let bars = 0;
  for (const ev of events) {
    let remaining = ev.len;
    while (remaining > 0) {
      const inBar = cell % cellsPerBar;
      const take = Math.min(remaining, cellsPerBar - inBar);
      const tok = ev.midi == null ? "z" : midiToAbcToken(ev.midi);
      cell += take;
      remaining -= take;
      const crossing = remaining > 0 && ev.midi != null;
      out += tok + (take > 1 ? take : "") + (crossing ? "-" : "") + " ";
      if (cell % cellsPerBar === 0) {
        out += "|";
        bars++;
        out += bars % 4 === 0 ? "\n" : " ";
      }
    }
  }
  return out.trim();
}

function assembleAbc(title, num, den, events, cellsPerBar) {
  const body = eventsToAbc(events, cellsPerBar);
  return `X:1\nT:${sanitize(title)}\nM:${num}/${den}\nL:1/16\nK:C\n${body}\n`;
}

// Collapse a chord (array of midis) to a single note per the chosen voice.
function collapsePick(midis, mode) {
  if (!midis || !midis.length) return null;
  return mode === "bottom" ? Math.min(...midis) : Math.max(...midis);
}

// Apply transpose and gather the resulting (non-rest) note numbers.
function shiftAndCollect(events, shift) {
  const notes = [];
  const out = events.map((e) => {
    if (e.midi == null) return { midi: null, len: e.len };
    const m = e.midi + shift;
    notes.push(m);
    return { midi: m, len: e.len };
  });
  return { events: out, notes };
}

// ---------- MIDI ----------
// Reduce a track's (possibly overlapping) notes to a monophonic sixteenth grid.
function midiEvents(notes, ppq, collapse) {
  const tps16 = ppq / 4 || 1;
  const top = collapse !== "bottom";
  const cells = [];
  let maxEnd = 0;
  for (const n of notes) {
    const s = Math.round(n.ticks / tps16);
    let e = Math.round((n.ticks + n.durationTicks) / tps16);
    if (e <= s) e = s + 1;
    for (let i = s; i < e; i++) {
      if (cells[i] == null) cells[i] = n.midi;
      else cells[i] = top ? Math.max(cells[i], n.midi) : Math.min(cells[i], n.midi);
    }
    if (e > maxEnd) maxEnd = e;
  }

  // Mark cells where a note of the *chosen* line re-articulates, so repeated
  // notes of the same pitch stay separate instead of merging into one held note.
  const onsets = new Set();
  for (const n of notes) {
    const s = Math.round(n.ticks / tps16);
    if (cells[s] === n.midi) onsets.add(s);
  }

  const events = [];
  let i = 0;
  while (i < maxEnd) {
    const v = cells[i] == null ? null : cells[i];
    let j = i + 1;
    while (j < maxEnd && (cells[j] == null ? null : cells[j]) === v && !onsets.has(j)) j++;
    events.push({ midi: v, len: j - i });
    i = j;
  }
  return events;
}

function parseMidi(arrayBuffer, fallbackTitle) {
  if (typeof Midi === "undefined") throw new Error("MIDI library not loaded.");
  const midi = new Midi(arrayBuffer);
  const ts = midi.header.timeSignatures[0];
  const num = ts ? ts.timeSignature[0] : 4;
  const den = ts ? ts.timeSignature[1] : 4;

  const tracks = [];
  midi.tracks.forEach((t, index) => {
    if (!t.notes.length) return;
    const ms = t.notes.map((n) => n.midi);
    const low = Math.min(...ms);
    const high = Math.max(...ms);
    tracks.push({
      index,
      name: (t.name || (t.instrument && t.instrument.name) || "Track " + (index + 1)).trim(),
      drums: t.channel === 9,
      noteCount: t.notes.length,
      low,
      high,
      lowLabel: nameFromMidi(low).label,
      highLabel: nameFromMidi(high).label,
    });
  });
  if (!tracks.length) throw new Error("No playable notes found in this MIDI file.");
  return {
    kind: "tracks",
    source: "midi",
    title: sanitize(midi.header.name || fallbackTitle),
    num,
    den,
    _midi: midi,
    tracks,
  };
}

// ---------- MusicXML ----------
function parseMusicXml(xmlText, fallbackTitle) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("This file isn't valid MusicXML.");
  const partEls = [...doc.querySelectorAll("part")];
  if (!partEls.length) throw new Error("No music part found in this MusicXML.");

  const title =
    doc.querySelector("work work-title")?.textContent ||
    doc.querySelector("movement-title")?.textContent ||
    fallbackTitle;

  const nameById = {};
  doc.querySelectorAll("part-list score-part").forEach((sp) => {
    nameById[sp.getAttribute("id")] = sp.querySelector("part-name")?.textContent?.trim();
  });

  let num = 4;
  let den = 4;
  const parts = partEls
    .map((part, idx) => {
      const events = [];
      let divisions = 1;
      let lo = Infinity;
      let hi = -Infinity;
      let count = 0;
      part.querySelectorAll(":scope > measure").forEach((m) => {
        const div = m.querySelector("attributes > divisions");
        if (div) divisions = +div.textContent || divisions;
        const beats = m.querySelector("attributes > time > beats");
        const bt = m.querySelector("attributes > time > beat-type");
        if (beats) num = +beats.textContent || num;
        if (bt) den = +bt.textContent || den;
        m.querySelectorAll(":scope > note").forEach((n) => {
          const durEl = n.querySelector("duration");
          const dur = durEl ? +durEl.textContent : 0;
          const sixteenths = Math.max(1, Math.round((dur / divisions) * 4));
          const isChord = !!n.querySelector("chord");
          if (n.querySelector("rest")) {
            events.push({ midis: [], len: sixteenths });
            return;
          }
          const step = n.querySelector("pitch > step")?.textContent;
          const octave = +(n.querySelector("pitch > octave")?.textContent);
          const alter = +(n.querySelector("pitch > alter")?.textContent || 0);
          if (step == null || Number.isNaN(octave)) return;
          const midi = (octave + 1) * 12 + STEP_SEMITONE[step] + alter;
          count++;
          lo = Math.min(lo, midi);
          hi = Math.max(hi, midi);
          if (isChord) {
            const prev = events[events.length - 1];
            if (prev && prev.midis) prev.midis.push(midi);
            return;
          }
          events.push({ midis: [midi], len: sixteenths });
        });
      });
      return {
        name: nameById[part.getAttribute("id")] || "Part " + (idx + 1),
        events,
        count,
        low: lo,
        high: hi,
      };
    })
    .filter((p) => p.count > 0);

  if (!parts.length) throw new Error("No notes found in this MusicXML.");
  const tracks = parts.map((p, index) => ({
    index,
    name: p.name,
    drums: false,
    noteCount: p.count,
    low: p.low,
    high: p.high,
    lowLabel: nameFromMidi(p.low).label,
    highLabel: nameFromMidi(p.high).label,
  }));
  return { kind: "tracks", source: "xml", title: sanitize(title), num, den, _parts: parts, tracks };
}

function mxlToXml(uint8) {
  if (typeof fflate === "undefined") throw new Error("Unzip library not loaded.");
  const files = fflate.unzipSync(uint8);
  const dec = new TextDecoder();
  let path = null;
  if (files["META-INF/container.xml"]) {
    const c = dec.decode(files["META-INF/container.xml"]);
    path = new DOMParser()
      .parseFromString(c, "application/xml")
      .querySelector("rootfile")
      ?.getAttribute("full-path");
  }
  if (!path || !files[path]) {
    path = Object.keys(files).find(
      (f) => /\.(musicxml|xml)$/i.test(f) && !f.startsWith("META-INF")
    );
  }
  if (!path) throw new Error("No MusicXML found inside the .mxl archive.");
  return dec.decode(files[path]);
}

// ---------- transcribe a chosen track ----------
export function transcribeTrack(parsed, trackIndex, opts = {}) {
  const collapse = opts.collapse === "bottom" ? "bottom" : "top";
  const shift = opts.shift | 0;

  let events;
  if (parsed.source === "midi") {
    const track = parsed._midi.tracks[trackIndex];
    const notes = track.notes.slice().sort((a, b) => a.ticks - b.ticks);
    const minTick = notes.length ? notes[0].ticks : 0;
    const shifted = notes.map((n) => ({
      midi: n.midi,
      ticks: n.ticks - minTick,
      durationTicks: n.durationTicks,
    }));
    events = midiEvents(shifted, parsed._midi.header.ppq, collapse);
  } else {
    events = parsed._parts[trackIndex].events.map((e) => ({
      midi: collapsePick(e.midis, collapse),
      len: e.len,
    }));
  }

  const { events: finalEvents, notes } = shiftAndCollect(events, shift);
  const cellsPerBar = parsed.num * (16 / parsed.den);
  const abc = assembleAbc(parsed.title, parsed.num, parsed.den, finalEvents, cellsPerBar);
  return { abc, title: parsed.title, notes };
}

// ---------- Audio (experimental, single melody line) ----------
async function audioToAbc(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let buf;
  try {
    buf = await ctx.decodeAudioData(arrayBuffer);
  } finally {
    ctx.close();
  }
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const win = 2048;
  const hop = 1024;
  // Cap analysis (pitch tracking is heavy) so a long file doesn't freeze the
  // phone — we only look at the first ~45 seconds.
  const maxLen = Math.min(data.length, Math.floor(sr * 45));

  const seq = [];
  for (let i = 0; i + win <= maxLen; i += hop) {
    const f = detectPitch(data.subarray(i, i + win), sr);
    seq.push(f > 0 ? Math.round(69 + 12 * Math.log2(f / 440)) : null);
  }
  const sm = seq.map((v, i) => {
    if (i === 0 || i === seq.length - 1) return v;
    const w = [seq[i - 1], v, seq[i + 1]].filter((x) => x != null).sort((a, b) => a - b);
    return w.length ? w[Math.floor(w.length / 2)] : null;
  });

  const hopSec = hop / sr;
  const sixteenthSec = 0.125; // assume 120 BPM
  const events = [];
  let i = 0;
  while (i < sm.length) {
    let j = i + 1;
    while (j < sm.length && sm[j] === sm[i]) j++;
    const frames = j - i;
    if (frames >= 2) {
      events.push({ midi: sm[i], len: Math.max(1, Math.round((frames * hopSec) / sixteenthSec)) });
    }
    i = j;
  }
  if (!events.some((e) => e.midi != null))
    throw new Error("Couldn't detect a clear melody in this audio.");
  return assembleAbc("Imported audio (rough)", 4, 4, events, 16);
}

// ---------- AI melody extraction (lazy-loaded, online) ----------
// Spotify's basic-pitch (audio -> notes) runs in the browser via TensorFlow.js.
// We load it from a CDN only when needed so the core app stays small/offline.
const BP_MODULE = "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/+esm";
const BP_MODEL = "https://cdn.jsdelivr.net/npm/@spotify/basic-pitch@1.0.1/model/model.json";
const AI_MAX_SECONDS = 30; // bound processing time
let _bp = null;

async function loadBasicPitch() {
  if (!_bp) _bp = await import(/* @vite-ignore */ BP_MODULE);
  return _bp;
}

// Decode + downmix to mono + resample to 22050 Hz (what the model expects),
// capped to the first AI_MAX_SECONDS.
async function decodeMono22050(arrayBuffer) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const tmp = new Ctx();
  let decoded;
  try {
    decoded = await tmp.decodeAudioData(arrayBuffer);
  } finally {
    tmp.close();
  }
  const dur = Math.min(decoded.duration, AI_MAX_SECONDS);
  const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const off = new Off(1, Math.max(1, Math.ceil(dur * 22050)), 22050);
  const src = off.createBufferSource();
  src.buffer = decoded;
  src.connect(off.destination);
  src.start(0);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);
}

export async function audioToMelodyAbc(arrayBuffer, onProgress) {
  const report = (msg, pct) => onProgress && onProgress(msg, pct);
  report("Preparing audio…", 0);
  const audio = await decodeMono22050(arrayBuffer);

  report("Loading AI model…", 0);
  const bp = await loadBasicPitch();
  const basicPitch = new bp.BasicPitch(BP_MODEL);

  const frames = [];
  const onsets = [];
  const contours = [];
  await basicPitch.evaluateModel(
    audio,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (p) => report("Finding the melody…", Math.round((p <= 1 ? p * 100 : p)))
  );

  const notes = bp.noteFramesToTime(
    bp.addPitchBendsToNoteEvents(contours, bp.outputToNotesPoly(frames, onsets, 0.5, 0.3, 11))
  );
  if (!notes.length) throw new Error("No notes detected in this audio.");

  // Reduce the (polyphonic) note events to a single melody line: the highest
  // pitch sounding in each sixteenth-note cell, re-articulated at onsets.
  const sixteenth = 0.125; // assume 120 BPM
  const cells = [];
  let maxCell = 0;
  for (const n of notes) {
    const s = Math.round(n.startTimeSeconds / sixteenth);
    let e = Math.round((n.startTimeSeconds + n.durationSeconds) / sixteenth);
    if (e <= s) e = s + 1;
    for (let i = s; i < e; i++) {
      if (cells[i] == null || n.pitchMidi > cells[i]) cells[i] = n.pitchMidi;
    }
    if (e > maxCell) maxCell = e;
  }
  const onCells = new Set();
  for (const n of notes) {
    const s = Math.round(n.startTimeSeconds / sixteenth);
    if (cells[s] === n.pitchMidi) onCells.add(s);
  }
  const events = [];
  let i = 0;
  while (i < maxCell) {
    const v = cells[i] == null ? null : cells[i];
    let j = i + 1;
    while (j < maxCell && (cells[j] == null ? null : cells[j]) === v && !onCells.has(j)) j++;
    events.push({ midi: v, len: j - i });
    i = j;
  }
  while (events.length && events[0].midi == null) events.shift(); // trim leading rest

  fitOctave(events); // bring the melody up into the harmonica's range
  const harpKey = bestHarpKey(events); // and pick a harp it actually plays on
  return { abc: assembleAbc("Extracted melody", 4, 4, events, 16), harpKey };
}

// ---------- entry point ----------
export async function parseImport(file, onProgress) {
  const lower = file.name.toLowerCase();
  const base = file.name.replace(/\.[^.]+$/, "");

  if (lower.endsWith(".json")) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error("That .json file isn't valid.");
    }
    const list = Array.isArray(data) ? data : data.songs;
    if (!Array.isArray(list)) throw new Error("Expected a JSON list of songs.");
    return { kind: "bulk", songs: list };
  }
  if (lower.endsWith(".abc")) return { kind: "abc", abc: await file.text(), title: base };
  if (lower.endsWith(".mid") || lower.endsWith(".midi"))
    return parseMidi(await file.arrayBuffer(), base);
  if (lower.endsWith(".musicxml") || lower.endsWith(".xml"))
    return parseMusicXml(await file.text(), base);
  if (lower.endsWith(".mxl"))
    return parseMusicXml(mxlToXml(new Uint8Array(await file.arrayBuffer())), base);
  if (
    /\.(mp3|wav|m4a|mp4|aac|ogg|flac|webm)$/i.test(lower) ||
    file.type.startsWith("audio/") ||
    file.type === "video/mp4"
  ) {
    const ab = await file.arrayBuffer();
    try {
      const { abc, harpKey } = await audioToMelodyAbc(ab.slice(0), onProgress);
      return {
        kind: "abc",
        abc,
        title: base,
        key: harpKey,
        warning:
          "AI melody extraction is best-effort. The melody was shifted into the harmonica's range and set to a " +
          harpKey +
          " harp (the best fit) — change the Harmonica key or use Transpose if you have a different harp. It does better on a clear lead/vocal than a dense mix; review and tidy the result.",
      };
    } catch (err) {
      console.warn("AI extraction failed, falling back to basic pitch tracking", err);
      return {
        kind: "abc",
        abc: await audioToAbc(ab.slice(0)),
        title: base,
        warning:
          "Couldn't run AI extraction (needs an internet connection the first time). Fell back to basic pitch tracking, which only follows a single clear melody line — expect to tidy the result.",
      };
    }
  }
  throw new Error("Unsupported file type. Use .mid, .musicxml/.mxl, .abc, audio, or .mp4.");
}
