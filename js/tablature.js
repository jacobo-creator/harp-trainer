// Overlay harmonica tab under each note of an abcjs-rendered staff, so a song
// can be learned as tab *with* the sheet music's timing/rhythm.
//
// Strategy: abcjs gives us the parsed tune (diatonic pitches) and renders an
// SVG whose note elements carry stable per-line classes. We resolve each note
// to a real MIDI pitch (folding in the key signature + in-measure accidental
// persistence that abcjs does not pre-apply), turn it into a harmonica tab via
// harmonica.js, then inject <text> into the SVG aligned under each note. Text
// lives in the SVG's own coordinate space, so it scales with the music.

import { techniquesForMidi, offsetForKey } from "./harmonica.js";
import { nameFromMidi } from "./notes.js";
import { getInstrument } from "./settings.js";

// 21-key kalimba: C-major, F3–E6. Number notation 1–7 = C D E F G A B, with an
// octave dot above (higher) or below (lower) the digit. Returns the tab string,
// or null if the note isn't on the instrument (a sharp/flat or out of range).
const KALIMBA_DEGREE = { 0: 1, 2: 2, 4: 3, 5: 4, 7: 5, 9: 6, 11: 7 }; // C..B
export function kalimbaTab(midi) {
  if (midi < 53 || midi > 88) return null; // F3..E6
  const pc = ((midi % 12) + 12) % 12;
  const deg = KALIMBA_DEGREE[pc];
  if (!deg) return null; // not a C-major note
  const octave = Math.floor(midi / 12) - 1; // 60 = C4
  const dot =
    octave === 5 ? "̇" :        // one dot above
    octave === 6 ? "̈" :        // two dots above (C6–E6)
    octave === 3 ? "̣" : "";    // one dot below (F3–B3); octave 4 = no dot
  return String(deg) + dot;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const DIATONIC_SEMITONE = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B from C
const ACC = {
  sharp: 1, dblsharp: 2, doublesharp: 2,
  flat: -1, dblflat: -2, doubleflat: -2,
  natural: 0,
};

// abcjs pitch: 0 = middle C (C4 / MIDI 60), +1 per diatonic step, +7 per octave.
function midiFromPitch(p, keyAcc, measureAcc) {
  const pitch = p.pitch;
  const degree = ((pitch % 7) + 7) % 7;
  const octave = Math.floor(pitch / 7);
  let midi = 60 + octave * 12 + DIATONIC_SEMITONE[degree];
  const letter = LETTERS[degree];

  let acc = null;
  if (p.accidental) {
    acc = p.accidental;
    measureAcc.set(pitch, acc); // persists for the rest of the measure
  } else if (measureAcc.has(pitch)) {
    acc = measureAcc.get(pitch);
  } else if (keyAcc.has(letter)) {
    acc = keyAcc.get(letter);
  }
  if (acc) midi += ACC[acc] || 0;
  return midi;
}

function keyAccMap(key) {
  const m = new Map();
  ((key && key.accidentals) || []).forEach((a) =>
    m.set(String(a.note).toUpperCase(), a.acc)
  );
  return m;
}

// A 4-string violin (open strings G3 D4 A4 E5), first position. Returns
// string + finger (0 = open), e.g. "A2" = A string, 2nd finger. The finger
// number is right for any note; the staff shows whether it's a high/low
// placement (a sharp/flat). Returns null below G3 or above first position.
const VIOLIN_STRINGS = [
  { name: "E", open: 76 },
  { name: "A", open: 69 },
  { name: "D", open: 62 },
  { name: "G", open: 55 },
];
const VIOLIN_FINGER = { 0: "0", 1: "1", 2: "1", 3: "2", 4: "2", 5: "3", 6: "3", 7: "4" };
export function violinTab(midi) {
  const s = VIOLIN_STRINGS.find((st) => midi >= st.open);
  if (!s) return null;
  const finger = VIOLIN_FINGER[midi - s.open];
  if (finger === undefined) return null;
  return s.name + finger;
}

// A 19/21-string lyre harp: open strings tuned to the C-major (white) notes.
// The common large lyre spans C3–B5 (three octaves). Each string IS a note, so
// the tab is simply the note letter + octave, e.g. "C4" or "G5". Sharps/flats
// have no string (as on the kalimba), so pickTechnique substitutes the nearest.
export const LYRE_LOW = 48; // C3
export const LYRE_HIGH = 83; // B5
const LYRE_WHITE = new Set([0, 2, 4, 5, 7, 9, 11]); // C D E F G A B
export function lyreTab(midi) {
  if (midi < LYRE_LOW || midi > LYRE_HIGH) return null;
  const pc = ((midi % 12) + 12) % 12;
  if (!LYRE_WHITE.has(pc)) return null; // no string for a sharp/flat
  return nameFromMidi(midi).label; // e.g. "C4"
}

// Pick a tab for a MIDI note on the current instrument. If the exact note isn't
// reachable (a harmonica overblow / a kalimba sharp or out-of-range note), fall
// back to the nearest playable note so the player has something to play instead
// of skipping. `substitute` flags the swap.
function pickTechnique(midi, offset) {
  if (getInstrument() === "violin") {
    // chromatic instrument — any in-range note is exactly playable
    return { tab: violinTab(midi), substitute: false };
  }
  if (getInstrument() === "kalimba") {
    const k = kalimbaTab(midi);
    if (k) return { tab: k, substitute: false };
    for (let d = 1; d <= 4; d++) {
      for (const m of [midi - d, midi + d]) {
        const kk = kalimbaTab(m);
        if (kk) return { tab: kk, substitute: true };
      }
    }
    return { tab: null, substitute: false };
  }
  if (getInstrument() === "lyre") {
    const l = lyreTab(midi);
    if (l) return { tab: l, substitute: false };
    for (let d = 1; d <= 4; d++) {
      for (const m of [midi - d, midi + d]) {
        const ll = lyreTab(m);
        if (ll) return { tab: ll, substitute: true };
      }
    }
    return { tab: null, substitute: false };
  }
  let t = techniquesForMidi(midi, offset);
  if (t.length) return { tab: t[0].tab, substitute: false };
  for (let d = 1; d <= 4; d++) {
    for (const m of [midi - d, midi + d]) {
      t = techniquesForMidi(m, offset);
      if (t.length) return { tab: t[0].tab, substitute: true };
    }
  }
  return { tab: null, substitute: false };
}

// Walk the parsed tune (voice 0) in document order, producing one token per
// non-rest note: the matching tab, or the note name if it's not reachable on
// this harp (e.g. an overblow).
function tabTokens(tune, harpKey) {
  const offset = offsetForKey(harpKey);
  const tokens = [];
  for (const line of tune.lines.filter((l) => l.staff)) {
    for (const staff of line.staff) {
      const keyAcc = keyAccMap(staff.key);
      const voice = staff.voices && staff.voices[0] ? staff.voices[0] : [];
      let measureAcc = new Map();
      for (const el of voice) {
        if (el.el_type === "bar") { measureAcc = new Map(); continue; }
        if (el.el_type !== "note" || el.rest || !el.pitches || !el.pitches.length)
          continue;
        // melody = highest sounding pitch of a chord
        let top = el.pitches[0];
        for (const pp of el.pitches) if (pp.pitch > top.pitch) top = pp;
        const midi = midiFromPitch(top, keyAcc, measureAcc);
        const pick = pickTechnique(midi, offset);
        tokens.push({
          tab: pick.tab,
          substitute: pick.substitute,
          label: nameFromMidi(midi).label,
        });
      }
      break; // only annotate the first (melody) voice
    }
  }
  return tokens;
}

// The melody as absolute MIDI note numbers (resolves key sig + accidentals).
// Used to work out how to transpose a song onto a given harp.
export function melodyMidisFromTune(tune) {
  if (!tune || !tune.lines) return [];
  const out = [];
  for (const line of tune.lines.filter((l) => l.staff)) {
    for (const staff of line.staff) {
      const keyAcc = keyAccMap(staff.key);
      const voice = staff.voices && staff.voices[0] ? staff.voices[0] : [];
      let measureAcc = new Map();
      for (const el of voice) {
        if (el.el_type === "bar") { measureAcc = new Map(); continue; }
        if (el.el_type !== "note" || el.rest || !el.pitches || !el.pitches.length) continue;
        let top = el.pitches[0];
        for (const pp of el.pitches) if (pp.pitch > top.pitch) top = pp;
        out.push(midiFromPitch(top, keyAcc, measureAcc));
      }
      break;
    }
  }
  return out;
}

// Build a readable harmonica-tab string from a parsed tune (bars included),
// e.g. "+4 -4 +5 | +6 -6 +7". Unplayable notes show as their note name.
export function tabStringFromTune(tune, harpKey) {
  if (!tune || !tune.lines) return "";
  const offset = offsetForKey(harpKey);
  const parts = [];
  for (const line of tune.lines.filter((l) => l.staff)) {
    for (const staff of line.staff) {
      const keyAcc = keyAccMap(staff.key);
      const voice = staff.voices && staff.voices[0] ? staff.voices[0] : [];
      let measureAcc = new Map();
      for (const el of voice) {
        if (el.el_type === "bar") { measureAcc = new Map(); parts.push("|"); continue; }
        if (el.el_type !== "note" || el.rest || !el.pitches || !el.pitches.length) continue;
        let top = el.pitches[0];
        for (const pp of el.pitches) if (pp.pitch > top.pitch) top = pp;
        const midi = midiFromPitch(top, keyAcc, measureAcc);
        const pick = pickTechnique(midi, offset);
        parts.push(
          pick.tab
            ? pick.substitute ? pick.tab + "*" : pick.tab
            : `(${nameFromMidi(midi).label})`
        );
      }
      break; // melody voice only
    }
  }
  return parts
    .join(" ")
    .replace(/\|(\s*\|)+/g, "|")        // collapse empty bars
    .replace(/^\s*\|\s*/, "")           // drop a leading barline
    .replace(/\s*\|\s*$/, "")           // and a trailing one
    .replace(/\s+/g, " ")
    .replace(/\|/g, " |")
    .trim();
}

// Render `abc` into `container` and, if harpKey is given, overlay the tab.
// Returns the abcjs tune object (or null on failure).
export function renderTabbedNotation(container, abc, harpKey, transpose = 0) {
  if (typeof ABCJS === "undefined") return null;
  // Render a bit narrower than the container so the SVG scales *up* to fill it
  // (bigger notes), and wrap long songs onto multiple lines instead of cramming
  // everything onto one tiny line.
  const cw = container.clientWidth || 360;
  const width = Math.max(240, Math.round(cw * 0.82));
  const hasLyrics = /^w:/m.test(abc); // leave room for a lyric row under the staff
  let tune;
  try {
    tune = ABCJS.renderAbc(container, abc, {
      add_classes: true,
      staffwidth: width,
      paddingleft: 6,
      paddingright: 6,
      paddingtop: 4,
      staffsep: hasLyrics ? 120 : 90,
      visualTranspose: transpose || 0,
      wrap: { minSpacing: 1.8, maxSpacing: 2.7, preferredMeasuresPerLine: 4 },
    })[0];
  } catch (e) {
    console.error(e);
    return null;
  }
  const svg = container.querySelector("svg");
  if (svg) {
    makeResponsive(svg);
    if (harpKey) overlay(svg, tune, harpKey, hasLyrics);
  }
  return tune;
}

// abcjs (without its own resize observer) emits a fixed px width/height and no
// viewBox. Convert to a viewBox so the staff — and the tab text we inject in
// the same coordinate space — scale to fit the container via CSS.
function makeResponsive(svg) {
  if (!svg.getAttribute("viewBox")) {
    const w = parseFloat(svg.getAttribute("width"));
    const h = parseFloat(svg.getAttribute("height"));
    if (w && h) svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
}

function overlay(svg, tune, harpKey, hasLyrics) {
  const tokens = tabTokens(tune, harpKey);

  // Baseline for each rendered line: just under the staff, or below the lyric
  // row when there are lyrics (note on top, word under it, tab below the word).
  let gap = 13;
  if (hasLyrics) {
    const fs = svg.querySelector("g.abcjs-staff");
    const fl = svg.querySelector(".abcjs-lyric");
    if (fs && fl) {
      const sb = fs.getBBox();
      const lb = fl.getBBox();
      gap = lb.y + lb.height - (sb.y + sb.height) + 8; // just below the lyric row
    } else {
      gap = 30;
    }
  }
  const baseline = {};
  svg.querySelectorAll("g.abcjs-staff").forEach((g) => {
    const m = (g.getAttribute("class") || "").match(/abcjs-l(\d+)/);
    if (!m) return;
    const b = g.getBBox();
    baseline[+m[1]] = b.y + b.height + gap;
  });

  const notes = svg.querySelectorAll(".abcjs-note.abcjs-v0:not(.abcjs-grace)");
  const layer = document.createElementNS(SVG_NS, "g");
  layer.setAttribute("class", "harp-tab-layer");
  let maxY = 0;

  notes.forEach((el, i) => {
    const tok = tokens[i];
    if (!tok) return;
    const b = el.getBBox();
    const cx = b.x + b.width / 2;
    const lm = (el.getAttribute("class") || "").match(/abcjs-l(\d+)/);
    const ln = lm ? +lm[1] : 0;
    const y = baseline[ln] != null ? baseline[ln] : b.y + b.height + gap;

    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", cx.toFixed(2));
    t.setAttribute("y", y.toFixed(2));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "12");
    t.setAttribute("font-family", "ui-monospace, Menlo, monospace");
    t.setAttribute("font-weight", "700");
    t.setAttribute(
      "fill",
      tok.tab ? (tok.substitute ? "#2563eb" : "#b45309") : "#94a3b8"
    );
    t.textContent = tok.tab ? tok.tab : tok.label;
    layer.appendChild(t);
    if (y > maxY) maxY = y;
  });

  svg.appendChild(layer);

  // Grow the viewBox so the tab row under the last staff line isn't clipped.
  const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  if (vb.length === 4 && maxY + 8 > vb[3]) {
    svg.setAttribute("viewBox", `${vb[0]} ${vb[1]} ${vb[2]} ${maxY + 8}`);
  }
}
