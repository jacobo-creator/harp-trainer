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
        const techs = techniquesForMidi(midi, offset);
        tokens.push({
          tab: techs.length ? techs[0].tab : null,
          label: nameFromMidi(midi).label,
          playable: techs.length > 0,
        });
      }
      break; // only annotate the first (melody) voice
    }
  }
  return tokens;
}

// Render `abc` into `container` and, if harpKey is given, overlay the tab.
// Returns the abcjs tune object (or null on failure).
export function renderTabbedNotation(container, abc, harpKey, transpose = 0) {
  if (typeof ABCJS === "undefined") return null;
  const width = Math.max(320, Math.min(900, (container.clientWidth || 360) - 8));
  let tune;
  try {
    tune = ABCJS.renderAbc(container, abc, {
      add_classes: true,
      staffwidth: width,
      paddingleft: 8,
      paddingright: 8,
      paddingtop: 4,
      visualTranspose: transpose || 0,
    })[0];
  } catch (e) {
    console.error(e);
    return null;
  }
  const svg = container.querySelector("svg");
  if (svg) {
    makeResponsive(svg);
    if (harpKey) overlay(svg, tune, harpKey);
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

function overlay(svg, tune, harpKey) {
  const tokens = tabTokens(tune, harpKey);

  // Baseline (just under the 5-line staff) for each rendered line.
  const baseline = {};
  svg.querySelectorAll("g.abcjs-staff").forEach((g) => {
    const m = (g.getAttribute("class") || "").match(/abcjs-l(\d+)/);
    if (!m) return;
    const b = g.getBBox();
    baseline[+m[1]] = b.y + b.height + 9;
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
    const y = baseline[ln] != null ? baseline[ln] : b.y + b.height + 9;

    const t = document.createElementNS(SVG_NS, "text");
    t.setAttribute("x", cx.toFixed(2));
    t.setAttribute("y", y.toFixed(2));
    t.setAttribute("text-anchor", "middle");
    t.setAttribute("font-size", "8.5");
    t.setAttribute("font-family", "ui-monospace, Menlo, monospace");
    t.setAttribute("font-weight", "700");
    t.setAttribute("fill", tok.playable ? "#b45309" : "#94a3b8");
    t.textContent = tok.playable ? tok.tab : tok.label;
    layer.appendChild(t);
    if (y > maxY) maxY = y;
  });

  svg.appendChild(layer);

  // Grow the viewBox so the tab row under the last staff line isn't clipped.
  const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  if (vb.length === 4 && maxY + 5 > vb[3]) {
    svg.setAttribute("viewBox", `${vb[0]} ${vb[1]} ${vb[2]} ${maxY + 5}`);
  }
}
