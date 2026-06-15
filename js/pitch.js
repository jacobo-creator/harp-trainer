// Monophonic pitch detection via the YIN algorithm (de Cheveigné & Kawahara).
// YIN's cumulative-mean-normalized difference function avoids the octave
// errors that plague raw autocorrelation — important for a harmonica's
// harmonic-rich mid-range (holes 4–6, ~520–880 Hz on a C harp). Returns the
// frequency in Hz, or -1 when there's no clear pitch (silence / noise).

const YIN_THRESHOLD = 0.12;

export function detectPitch(buf, sampleRate) {
  const SIZE = buf.length;
  const W = SIZE >> 1; // analysis window / max lag

  // RMS gate: ignore frames too quiet to be a played note.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // Only search lags within the musical range we care about (~50–3000 Hz).
  const maxTau = Math.min(W, Math.ceil(sampleRate / 50));
  const minTau = Math.max(2, Math.floor(sampleRate / 3000));

  // 1) Difference function d(tau).
  const yin = new Float32Array(maxTau);
  for (let tau = 1; tau < maxTau; tau++) {
    let sum = 0;
    for (let j = 0; j < W; j++) {
      const diff = buf[j] - buf[j + tau];
      sum += diff * diff;
    }
    yin[tau] = sum;
  }

  // 2) Cumulative mean normalized difference d'(tau).
  yin[0] = 1;
  let running = 0;
  for (let tau = 1; tau < maxTau; tau++) {
    running += yin[tau];
    yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running;
  }

  // 3) Absolute threshold: first dip below threshold, then walk to its bottom.
  let tau = -1;
  for (let t = minTau; t < maxTau; t++) {
    if (yin[t] < YIN_THRESHOLD) {
      while (t + 1 < maxTau && yin[t + 1] < yin[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    // No confident dip — fall back to the global minimum, if it's clear enough.
    let min = Infinity;
    let pos = -1;
    for (let t = minTau; t < maxTau; t++) {
      if (yin[t] < min) { min = yin[t]; pos = t; }
    }
    if (pos === -1 || min > 0.5) return -1;
    tau = pos;
  }

  // 4) Parabolic interpolation around the dip for sub-sample precision.
  let betterTau = tau;
  const x0 = tau > 0 ? yin[tau - 1] : yin[tau];
  const x2 = tau + 1 < maxTau ? yin[tau + 1] : yin[tau];
  const a = x0 + x2 - 2 * yin[tau];
  const b = (x2 - x0) / 2;
  if (a) betterTau = tau - b / (2 * a);

  const freq = sampleRate / betterTau;
  if (freq < 50 || freq > 5000) return -1;
  return freq;
}

// Exponential + outlier-rejecting smoother to steady the displayed reading
// while still tracking quick note changes and bends.
export class Smoother {
  constructor(alpha = 0.25) {
    this.alpha = alpha;
    this.value = null;
  }
  push(freq) {
    if (freq <= 0) { this.value = null; return null; }
    if (this.value == null) { this.value = freq; return freq; }
    // If the new reading jumps more than ~ a fifth, treat it as a real
    // note change and snap rather than smoothing slowly.
    const ratio = freq / this.value;
    if (ratio > 1.4 || ratio < 0.71) {
      this.value = freq;
    } else {
      this.value = this.value + this.alpha * (freq - this.value);
    }
    return this.value;
  }
  reset() { this.value = null; }
}
