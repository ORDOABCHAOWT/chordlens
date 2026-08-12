import { Note } from "@tonaljs/tonal";
import { displayNote, normalizeNote } from "./chords";
import type { GuitarVoicing } from "./types";

const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

const KNOWN_VOICINGS: Record<string, Array<Array<number | "x">>> = {
  F7: [[1, 3, 1, 2, 1, 1], ["x", 8, 7, 8, 6, 8], ["x", "x", 3, 5, 4, 5]],
  F: [[1, 3, 3, 2, 1, 1], ["x", 8, 10, 10, 10, 8], ["x", "x", 3, 5, 6, 5]],
  Bb: [["x", 1, 3, 3, 3, 1], [6, 8, 8, 7, 6, 6], ["x", "x", 8, 10, 11, 10]],
  C7: [["x", 3, 2, 3, 1, 0], [8, 10, 8, 9, 8, 8], ["x", "x", 10, 9, 11, 8]],
  Dm: [["x", "x", 0, 2, 3, 1], ["x", 5, 7, 7, 6, 5], [10, 12, 12, 10, 10, 10]],
  Fmaj7: [["x", "x", 3, 2, 1, 0], [1, 3, 2, 2, 1, 0], ["x", 8, 10, 9, 10, 8]],
  Fm7: [[1, 3, 1, 1, 1, 1], ["x", 8, 10, 8, 9, 8], ["x", "x", 3, 5, 4, 4]],
  G7: [[3, 2, 0, 0, 0, 1], [3, 5, 3, 4, 3, 3], ["x", 10, 12, 10, 12, 10]],
  Cmaj7: [["x", 3, 2, 0, 0, 0], [8, 10, 9, 9, 8, 8], ["x", "x", 10, 9, 8, 7]],
  Dm7: [["x", "x", 0, 2, 1, 1], ["x", 5, 7, 5, 6, 5], [10, 12, 10, 10, 10, 10]],
};

function pitchClass(note: string): number {
  return Note.get(normalizeNote(note)).chroma ?? -1;
}

function voicingNotes(frets: Array<number | "x">) {
  return frets.flatMap((fret, index) => fret === "x" ? [] : [displayNote(Note.fromMidi(STANDARD_TUNING[index] + fret))]);
}

function difficulty(frets: Array<number | "x">) {
  const pressed = frets.filter((value): value is number => typeof value === "number" && value > 0);
  const min = pressed.length ? Math.min(...pressed) : 0;
  const max = pressed.length ? Math.max(...pressed) : 0;
  const span = max - min;
  const muted = frets.filter((value) => value === "x").length;
  const barreBonus = new Set(pressed).size < pressed.length ? -0.5 : 0;
  return Math.round((pressed.length + span * 1.7 + muted * 0.35 + barreBonus) * 10) / 10;
}

function toVoicing(frets: Array<number | "x">): GuitarVoicing {
  const positive = frets.filter((value): value is number => typeof value === "number" && value > 0);
  const baseFret = positive.length && Math.min(...positive) >= 4 ? Math.min(...positive) : 1;
  const counts = new Map<number, number>();
  positive.forEach((fret) => counts.set(fret, (counts.get(fret) ?? 0) + 1));
  const barreFret = [...counts.entries()].find(([fret, count]) => count >= 3 && fret === Math.min(...positive));
  return {
    frets,
    baseFret,
    notes: voicingNotes(frets),
    difficulty: difficulty(frets),
    barre: barreFret ? { fret: barreFret[0], fromString: 1, toString: 6 } : undefined,
  };
}

export function generateVoicings(symbol: string, chordNotes: string[], limit = 12): GuitarVoicing[] {
  const target = new Set(chordNotes.map(pitchClass));
  const root = pitchClass(chordNotes[0] ?? symbol);
  const preferredShapes = KNOWN_VOICINGS[normalizeNote(symbol)] ?? [];
  const preferredOrder = new Map(preferredShapes.map((frets, index) => [frets.join(","), index]));
  const results: GuitarVoicing[] = preferredShapes.map(toVoicing);
  const seen = new Set(results.map((voicing) => voicing.frets.join(",")));
  const options = STANDARD_TUNING.map((openMidi) => {
    const matches: Array<number | "x"> = ["x"];
    for (let fret = 0; fret <= 12; fret += 1) if (target.has((openMidi + fret) % 12)) matches.push(fret);
    return matches;
  });

  const visit = (stringIndex: number, current: Array<number | "x">) => {
    if (results.length > 350) return;
    if (stringIndex === 6) {
      const sounding = current.filter((value): value is number => typeof value === "number");
      if (sounding.length < 4) return;
      const present = new Set(current.flatMap((fret, index) => fret === "x" ? [] : [(STANDARD_TUNING[index] + fret) % 12]));
      if ([...target].some((note) => !present.has(note))) return;
      const fretted = sounding.filter((fret) => fret > 0);
      if (fretted.length) {
        const min = Math.min(...fretted);
        const max = Math.max(...fretted);
        if (max - min > 4) return;
      }
      const key = current.join(",");
      if (!seen.has(key)) { seen.add(key); results.push(toVoicing([...current])); }
      return;
    }
    for (const fret of options[stringIndex]) {
      current.push(fret);
      visit(stringIndex + 1, current);
      current.pop();
    }
  };
  visit(0, []);

  return results
    .filter((voicing) => voicing.notes.every((note) => target.has(pitchClass(note))))
    .sort((a, b) => {
      const aPreferred = preferredOrder.get(a.frets.join(","));
      const bPreferred = preferredOrder.get(b.frets.join(","));
      if (aPreferred !== undefined || bPreferred !== undefined) {
        if (aPreferred === undefined) return 1;
        if (bPreferred === undefined) return -1;
        return aPreferred - bPreferred;
      }
      const aRootBass = pitchClass(a.notes[0] ?? "") === root ? -2 : 0;
      const bRootBass = pitchClass(b.notes[0] ?? "") === root ? -2 : 0;
      return a.difficulty + aRootBass - (b.difficulty + bRootBass);
    })
    .slice(0, limit);
}
