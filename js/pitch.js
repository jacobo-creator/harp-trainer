// Monophonic pitch detection via normalized autocorrelation with
// parabolic interpolation. Returns frequency in Hz, or -1 when no clear
// pitch is present (silence / noise). Tuned for a single sustained tone
// like a harmonica reed.

export function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length;

  // RMS gate: ignore frames that are too quiet to be a played note.
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return -1;

  // Trim near-silent edges of the window.
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buf[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }
  const b = buf.slice(r1, r2);
  const n = b.length;
  if (n < 2) return -1;

  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n - i; j++) sum += b[j] * b[j + i];
    c[i] = sum;
  }

  // Walk down from the zero-lag peak, then find the next strongest peak.
  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;
  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < n; i++) {
    if (c[i] > maxval) { maxval = c[i]; maxpos = i; }
  }
  if (maxpos <= 0) return -1;

  let T0 = maxpos;
  // Parabolic interpolation around the peak for sub-sample accuracy.
  const x1 = c[T0 - 1] || 0;
  const x2 = c[T0];
  const x3 = c[T0 + 1] || 0;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bb = (x3 - x1) / 2;
  if (a) T0 = T0 - bb / (2 * a);

  const freq = sampleRate / T0;
  if (freq < 50 || freq > 5000) return -1; // outside musical range we care about
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
