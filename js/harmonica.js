// Diatonic (10-hole, Richter-tuned) harmonica layout + note->technique mapping.
//
// Everything is defined relative to a C harp, then transposed by the chosen
// harp key's semitone offset. This lets us tell the player, for any detected
// note, which hole + breath direction + bend produces it.

import { nameFromMidi } from "./notes.js";

// Reference C harp, MIDI note numbers. Holes 1..10.
const C_BLOW = [60, 64, 67, 72, 76, 79, 84, 88, 91, 96]; // C E G C E G C E G C
const C_DRAW = [62, 67, 71, 74, 77, 81, 83, 86, 89, 93]; // D G B D F A B D F A

// How many semitone bends are available on each hole (Richter standard).
const DRAW_BENDS = [1, 2, 3, 1, 0, 1, 0, 0, 0, 0];
const BLOW_BENDS = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2];

// Harp key -> semitone offset from a C harp (conventional pitch ranges).
export const HARP_KEYS = [
  { key: "G", offset: -5 },
  { key: "Ab", offset: -4 },
  { key: "A", offset: -3 },
  { key: "Bb", offset: -2 },
  { key: "B", offset: -1 },
  { key: "C", offset: 0 },
  { key: "Db", offset: 1 },
  { key: "D", offset: 2 },
  { key: "Eb", offset: 3 },
  { key: "E", offset: 4 },
  { key: "F", offset: 5 },
  { key: "F#", offset: 6 },
];

export function offsetForKey(key) {
  const found = HARP_KEYS.find((k) => k.key === key);
  return found ? found.offset : 0;
}

const BEND_LABEL = { 1: "½-step bend", 2: "whole-step bend", 3: "1½-step bend" };

function tabNotation(hole, dir, bend) {
  const base = (dir === "blow" ? "+" : "-") + hole;
  return base + "'".repeat(bend);
}

// Return every harmonica technique on the given harp that produces `midi`.
// Usually one match; bends/octaves can yield a couple.
export function techniquesForMidi(midi, offset = 0) {
  const target = midi - offset; // compare against the C reference
  const out = [];
  for (let h = 0; h < 10; h++) {
    const hole = h + 1;

    if (C_BLOW[h] === target) out.push(make(hole, "blow", 0));
    for (let b = 1; b <= BLOW_BENDS[h]; b++) {
      if (C_BLOW[h] - b === target) out.push(make(hole, "blow", b));
    }

    if (C_DRAW[h] === target) out.push(make(hole, "draw", 0));
    for (let b = 1; b <= DRAW_BENDS[h]; b++) {
      if (C_DRAW[h] - b === target) out.push(make(hole, "draw", b));
    }
  }
  return out;
}

function make(hole, dir, bend) {
  return {
    hole,
    dir, // "blow" | "draw"
    bend, // 0..3 semitones
    bendLabel: bend ? BEND_LABEL[bend] : null,
    tab: tabNotation(hole, dir, bend),
    text:
      `Hole ${hole} ${dir}` + (bend ? ` (${BEND_LABEL[bend]})` : ""),
  };
}

// Full note layout for a harp in `key`, for a reference chart. Returns
// holes with their blow/draw note labels (no bends).
export function layoutForKey(key) {
  const offset = offsetForKey(key);
  return C_BLOW.map((bm, i) => ({
    hole: i + 1,
    blow: nameFromMidi(bm + offset).label,
    draw: nameFromMidi(C_DRAW[i] + offset).label,
  }));
}
