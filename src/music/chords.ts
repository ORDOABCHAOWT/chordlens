import { Chord, Note } from "@tonaljs/tonal";
import type { ChordCandidate } from "./types";

const COMMON_TYPES = new Map<string, number>([
  ["major", 18], ["minor", 18], ["dominant seventh", 17], ["major seventh", 15],
  ["minor seventh", 15], ["diminished", 10], ["augmented", 8], ["suspended fourth", 10],
]);

const TYPE_LABELS: Array<[RegExp, string]> = [
  [/major seventh/i, "Major Seventh"],
  [/minor seventh/i, "Minor Seventh"],
  [/dominant seventh|dominant/i, "Dominant Seventh"],
  [/diminished/i, "Diminished"],
  [/augmented/i, "Augmented"],
  [/suspended fourth/i, "Suspended Fourth"],
  [/suspended second/i, "Suspended Second"],
  [/minor/i, "Minor"],
  [/major/i, "Major"],
];

export function normalizeNote(note: string): string {
  return note.trim().replace(/♭/g, "b").replace(/♯/g, "#");
}

export function displayNote(note: string): string {
  return note.replace(/b/g, "♭").replace(/#/g, "♯").replace(/\d+/g, "");
}

function chroma(note: string): number {
  return Note.get(normalizeNote(note)).chroma ?? -1;
}

function chromaSet(notes: string[]): Set<number> {
  return new Set(notes.map(chroma).filter((value) => value >= 0));
}

function samePitchClasses(a: string[], b: string[]) {
  const left = chromaSet(a);
  const right = chromaSet(b);
  return left.size === right.size && [...left].every((value) => right.has(value));
}

export function chordTypeLabel(type: string, symbol = ""): string {
  if (/maj7|M7/.test(symbol)) return "Major Seventh";
  if (/m7/.test(symbol)) return "Minor Seventh";
  if (/7/.test(symbol) && !/maj|m7|dim/.test(symbol)) return "Dominant Seventh";
  return TYPE_LABELS.find(([pattern]) => pattern.test(type))?.[1] ?? (type.replace(/\b\w/g, (char) => char.toUpperCase()) || "Chord");
}

export function describeChord(symbol: string) {
  const normalized = normalizeNote(symbol);
  const chord = Chord.get(normalized);
  if (chord.empty) return null;
  return {
    symbol: chord.symbol || normalized,
    root: chord.tonic ?? normalized.match(/^[A-G][#b]?/)?.[0] ?? "C",
    notes: chord.notes.map(displayNote),
    intervals: chord.intervals,
    type: chordTypeLabel(chord.type, chord.symbol),
  };
}

export function detectAndRankChords(inputNotes: string[], bass?: string): ChordCandidate[] {
  const cleaned = [...new Set(inputNotes.map(normalizeNote).filter((note) => chroma(note) >= 0))];
  if (cleaned.length < 2) return [];
  const detected = Chord.detect(cleaned);
  const candidates = new Map<string, ChordCandidate>();

  for (const symbol of detected) {
    const chord = Chord.get(symbol);
    if (chord.empty) continue;
    const candidateSymbol = /^[A-G][#b]?M$/.test(symbol) ? symbol.slice(0, -1) : symbol;
    const reasons: string[] = [];
    let score = 50;
    if (samePitchClasses(cleaned, chord.notes)) { score += 35; reasons.push("Exact pitch-class match"); }
    if (chord.tonic && cleaned.some((note) => chroma(note) === chroma(chord.tonic!))) { score += 12; reasons.push("Root is present"); }
    const bassNote = bass ?? cleaned[0];
    if (chord.tonic && chroma(bassNote) === chroma(chord.tonic)) { score += 12; reasons.push("Root is the bass note"); }
    if (chord.intervals.some((interval) => /3/.test(interval))) { score += 5; reasons.push("Contains a defining third"); }
    if (chord.intervals.some((interval) => /7/.test(interval))) { score += 4; reasons.push("Contains a defining seventh"); }
    score += COMMON_TYPES.get(chord.type.toLowerCase()) ?? 0;
    score -= Math.max(0, chord.notes.length - 4) * 3;
    candidates.set(candidateSymbol, {
      symbol: candidateSymbol,
      notes: chord.notes.map(displayNote),
      score,
      reasons,
      type: chordTypeLabel(chord.type, candidateSymbol),
    });
  }

  if (candidates.size === 0 && cleaned.length >= 2) {
    for (const tonic of cleaned) {
      for (const suffix of ["", "m", "7", "maj7", "m7", "dim", "sus4"]) {
        const symbol = `${tonic}${suffix}`;
        const chord = Chord.get(symbol);
        if (!chord.empty && samePitchClasses(cleaned, chord.notes)) {
          candidates.set(symbol, {
            symbol,
            notes: chord.notes.map(displayNote),
            score: 70 + (tonic === cleaned[0] ? 15 : 0),
            reasons: ["Exact pitch-class match", ...(tonic === cleaned[0] ? ["Root is the bass note"] : [])],
            type: chordTypeLabel(chord.type, symbol),
          });
        }
      }
    }
  }

  return [...candidates.values()].sort((a, b) => b.score - a.score || a.symbol.length - b.symbol.length);
}
