import type { ChordEvent, Song } from "../music/types";

export const demoSongs: Song[] = [
  { id: "midnight-drive", title: "Midnight Drive", artist: "Jade Hollow", duration: 225, filePath: "", createdAt: "2026-08-11T00:00:00Z", bpm: 94, key: "B♭ Major" },
  { id: "mountain-air", title: "Mountain Air", artist: "The Wild North", duration: 252, filePath: "", createdAt: "2026-08-10T00:00:00Z", bpm: 88, key: "G Major" },
  { id: "steady-glow", title: "Steady Glow", artist: "Paper Lanterns", duration: 208, filePath: "", createdAt: "2026-08-09T00:00:00Z", bpm: 102, key: "C Major" },
  { id: "falling-slowly", title: "Falling Slowly", artist: "Newton Street", duration: 241, filePath: "", createdAt: "2026-08-08T00:00:00Z", bpm: 76, key: "E♭ Major" },
];

export const demoChords: ChordEvent[] = [
  { startTime: 0, endTime: 28, symbol: "F7", root: "F", notes: ["F", "A", "C", "Eb"], confidence: 0.96 },
  { startTime: 28, endTime: 55, symbol: "Bb", root: "Bb", notes: ["Bb", "D", "F"], confidence: 0.91 },
  { startTime: 55, endTime: 82, symbol: "C7", root: "C", notes: ["C", "E", "G", "Bb"], confidence: 0.94 },
  { startTime: 82, endTime: 110, symbol: "Dm", root: "D", notes: ["D", "F", "A"], confidence: 0.89 },
  { startTime: 110, endTime: 137, symbol: "Bb", root: "Bb", notes: ["Bb", "D", "F"], confidence: 0.92 },
  { startTime: 137, endTime: 181, symbol: "F7", root: "F", notes: ["F", "A", "C", "Eb"], confidence: 0.95 },
  { startTime: 181, endTime: 225, symbol: "C7", root: "C", notes: ["C", "E", "G", "Bb"], confidence: 0.93 },
];

function seededNoise(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export const demoWaveform = Array.from({ length: 520 }, (_, index) => {
  const phrase = 0.68 + Math.sin(index * 0.115) * 0.16 + Math.sin(index * 0.037) * 0.12;
  return Math.max(0.09, Math.min(1, (0.18 + seededNoise(index) * 0.82) * phrase));
});
