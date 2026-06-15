// Note <-> frequency conversion utilities.

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const NOTE_NAMES_FLAT = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

// MIDI 69 = A4. Convert a frequency to the nearest note + cents deviation.
export function noteFromFrequency(freq, a4 = 440) {
  if (!freq || freq <= 0) return null;
  const exact = 69 + 12 * Math.log2(freq / a4);
  const midi = Math.round(exact);
  const cents = Math.round((exact - midi) * 100);
  return { midi, cents, ...nameFromMidi(midi), freq };
}

export function nameFromMidi(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return {
    name: NOTE_NAMES[pc],
    nameFlat: NOTE_NAMES_FLAT[pc],
    pitchClass: pc,
    octave,
    label: NOTE_NAMES[pc] + octave,
  };
}

export function frequencyFromMidi(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - 69) / 12);
}
