import { Chord, Note } from "@tonaljs/tonal";
import type { ChordEvent, NoteEvent, TranscriptionEngine, TranscriptionResult } from "../../music/types";
import { assertAudioDuration } from "./audioPolicy";

const PITCH_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

function waveformPeaks(channel: Float32Array, count = 520) {
  const blockSize = Math.max(1, Math.floor(channel.length / count));
  return Array.from({ length: count }, (_, index) => {
    let peak = 0;
    const start = index * blockSize;
    const end = Math.min(channel.length, start + blockSize);
    for (let i = start; i < end; i += 1) peak = Math.max(peak, Math.abs(channel[i]));
    return Math.max(0.03, Math.min(1, peak));
  });
}

function goertzel(samples: Float32Array, sampleRate: number, frequency: number, start: number, length: number) {
  const stride = 8;
  const omega = (2 * Math.PI * frequency * stride) / sampleRate;
  const coeff = 2 * Math.cos(omega);
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  const stop = Math.min(samples.length, start + length);
  for (let index = start; index < stop; index += stride) {
    s0 = samples[index] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

function estimateWindowNotes(samples: Float32Array, sampleRate: number, startSeconds: number, seconds: number) {
  const start = Math.floor(startSeconds * sampleRate);
  const length = Math.min(Math.floor(seconds * sampleRate), Math.floor(sampleRate * 0.7));
  const chroma = new Array<number>(12).fill(0);
  for (let midi = 40; midi <= 83; midi += 1) {
    const frequency = 440 * 2 ** ((midi - 69) / 12);
    chroma[midi % 12] += goertzel(samples, sampleRate, frequency, start, length) / Math.sqrt(frequency);
  }
  return chroma
    .map((power, pitch) => ({ pitch, power }))
    .sort((a, b) => b.power - a.power)
    .slice(0, 4)
    .filter((entry, _, entries) => entry.power > entries[0].power * 0.18)
    .map((entry) => PITCH_NAMES[entry.pitch]);
}

export class BrowserAnalysisEngine implements TranscriptionEngine {
  readonly id = "browser-local";
  readonly name = "Local spectral analyzer";

  async isAvailable() { return typeof AudioContext !== "undefined" || typeof window.webkitAudioContext !== "undefined"; }

  async transcribeAudio(file: File): Promise<TranscriptionResult> {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    const context = new AudioContextClass();
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer());
      assertAudioDuration(buffer.duration);
      const samples = buffer.getChannelData(0);
      const windowSeconds = Math.max(2, Math.min(6, buffer.duration / 28));
      const chords: ChordEvent[] = [];
      const notes: NoteEvent[] = [];

      let windowIndex = 0;
      for (let time = 0; time < buffer.duration; time += windowSeconds) {
        const detectedNotes = estimateWindowNotes(samples, buffer.sampleRate, time, windowSeconds);
        const symbols = Chord.detect(detectedNotes);
        const symbol = symbols[0] ?? detectedNotes[0] ?? "N.C.";
        const chord = Chord.get(symbol);
        const eventNotes = chord.empty ? detectedNotes : chord.notes;
        chords.push({
          startTime: time,
          endTime: Math.min(buffer.duration, time + windowSeconds),
          symbol,
          root: chord.tonic ?? eventNotes[0] ?? "C",
          notes: eventNotes,
          confidence: symbols.length ? 0.62 : 0.35,
        });
        eventNotes.forEach((noteName) => {
          const midi = Note.midi(`${noteName}4`) ?? 60;
          notes.push({ pitch: midi, noteName, startTime: time, endTime: Math.min(buffer.duration, time + windowSeconds), velocity: 80, confidence: 0.55 });
        });
        windowIndex += 1;
        if (windowIndex % 4 === 0) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
      return { duration: buffer.duration, notes, chords, waveform: waveformPeaks(samples) };
    } finally {
      await context.close().catch(() => undefined);
    }
  }
}

declare global {
  interface Window { webkitAudioContext: typeof AudioContext; }
}
