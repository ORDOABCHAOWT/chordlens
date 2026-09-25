// Local synthesis only: a plucked string (Karplus–Strong) for guitar shapes and a
// soft sine tone for keys. Nothing is recorded or loaded, so no permission is needed.

let context: AudioContext | null = null;
let output: GainNode | null = null;
const plucks = new Map<number, AudioBuffer>();

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!context) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    context = new Ctx();
    output = context.createGain();
    output.gain.value = 0.9;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -16;
    limiter.ratio.value = 3;
    output.connect(limiter);
    limiter.connect(context.destination);
  }
  if (context.state === "suspended") void context.resume();
  return output ? { ctx: context, out: output } : null;
}

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function pluckBuffer(ctx: AudioContext, midi: number): AudioBuffer {
  const cached = plucks.get(midi);
  if (cached) return cached;
  const rate = ctx.sampleRate;
  const period = Math.max(2, Math.round(rate / frequency(midi)));
  const length = Math.floor(rate * 2.6);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  const ring = new Float32Array(period);
  let smooth = 0;
  for (let i = 0; i < period; i += 1) {
    smooth = smooth * 0.5 + (Math.random() * 2 - 1) * 0.5;
    ring[i] = smooth;
  }
  // Higher strings lose energy faster, as on a real guitar.
  const decay = 0.9978 - Math.min(0.0035, Math.max(0, midi - 40) * 0.00009);
  for (let i = 0, j = 0; i < length; i += 1) {
    const current = ring[j];
    const next = ring[(j + 1) % period];
    data[i] = current;
    ring[j] = decay * 0.5 * (current + next);
    j = (j + 1) % period;
  }
  const fade = Math.floor(rate * 0.08);
  for (let i = 0; i < fade; i += 1) data[length - 1 - i] *= i / fade;
  plucks.set(midi, buffer);
  return buffer;
}

function pluckAt(ctx: AudioContext, out: GainNode, midi: number, when: number, gain: number) {
  const source = ctx.createBufferSource();
  source.buffer = pluckBuffer(ctx, midi);
  const level = ctx.createGain();
  level.gain.value = gain;
  source.connect(level);
  level.connect(out);
  source.start(when);
}

export function pluck(midi: number) {
  const a = audio();
  if (a) pluckAt(a.ctx, a.out, midi, a.ctx.currentTime + 0.01, 0.5);
}

/** Down-strum from the lowest sounding string. */
export function strum(midis: number[]) {
  const a = audio();
  if (!a) return;
  const start = a.ctx.currentTime + 0.03;
  [...midis].sort((x, y) => x - y).forEach((midi, index) => pluckAt(a.ctx, a.out, midi, start + index * 0.032, 0.42));
}

export function keyTone(midi: number, delay = 0) {
  const a = audio();
  if (!a) return;
  const { ctx, out } = a;
  const start = ctx.currentTime + 0.01 + delay;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(0.3, start + 0.012);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  ([[1, 1], [2, 0.24], [3, 0.07]] as const).forEach(([multiple, amount]) => {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency(midi) * multiple;
    const level = ctx.createGain();
    level.gain.value = amount;
    oscillator.connect(level);
    level.connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + 1.6);
  });
  envelope.connect(tone);
  tone.connect(out);
}

export function playKeys(midis: number[]) {
  [...midis].sort((a, b) => a - b).forEach((midi, index) => keyTone(midi, index * 0.04));
}
