import { Note } from "@tonaljs/tonal";
import { displayNote, normalizeNote } from "./chords";
import type { GuitarVoicing } from "./types";

const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

const KNOWN_VOICINGS: Record<string, Array<Array<number | "x">>> = {
  Asus2: [["x", 0, 2, 2, 0, 0]],
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

function hasExactTargetCoverage(frets: Array<number | "x">, target: Set<number>) {
  const present = new Set(frets.flatMap((fret, index) => fret === "x" ? [] : [(STANDARD_TUNING[index] + fret) % 12]));
  return present.size === target.size && [...target].every((note) => present.has(note));
}

function fitsDiagram(frets: Array<number | "x">) {
  const pressed = frets.filter((value): value is number => typeof value === "number" && value > 0);
  return pressed.length === 0 || Math.max(...pressed) - Math.min(...pressed) <= 3;
}

function internalMutes(frets: Array<number | "x">) {
  return frets.reduce<number>((count, fret, index) => {
    if (fret !== "x") return count;
    return count + (frets.slice(0, index).some((value) => value !== "x") && frets.slice(index + 1).some((value) => value !== "x") ? 1 : 0);
  }, 0);
}

function difficulty(frets: Array<number | "x">) {
  const pressed = frets.filter((value): value is number => typeof value === "number" && value > 0);
  const min = pressed.length ? Math.min(...pressed) : 0;
  const max = pressed.length ? Math.max(...pressed) : 0;
  const span = max - min;
  const muted = frets.filter((value) => value === "x").length;
  // A mute between two sounding groups is awkward to execute and makes a
  // voicing much less useful than the same number of edge mutes.
  const mutedInsideShape = internalMutes(frets);
  const barreBonus = new Set(pressed).size < pressed.length ? -0.5 : 0;
  return Math.round((pressed.length + span * 1.7 + muted * 0.35 + mutedInsideShape * 1.4 + barreBonus) * 10) / 10;
}

function inferBarre(frets: Array<number | "x">): GuitarVoicing["barre"] {
  const lowestPressed = Math.min(...frets.filter((value): value is number => typeof value === "number" && value > 0));
  if (!Number.isFinite(lowestPressed)) return undefined;
  const stringsAtFret = frets
    .map((fret, index) => fret === lowestPressed ? index + 1 : 0)
    .filter((string): string is number => string > 0);
  if (stringsAtFret.length < 2) return undefined;

  const fromString = Math.min(...stringsAtFret);
  const toString = Math.max(...stringsAtFret);
  const hasBarreEvidence = stringsAtFret.length >= 3
    || (toString - fromString >= 2 && frets.slice(fromString, toString - 1).some((fret) => typeof fret === "number" && fret > lowestPressed));
  if (!hasBarreEvidence) return undefined;
  // A barre can span strings with higher fingers on top of it, but open,
  // muted, and lower-fretted strings break the physical line. A pair of equal
  // notes is enough for a partial barre (for example B♭ x13331, strings 2–6).
  for (let string = fromString; string <= toString; string += 1) {
    const fret = frets[string - 1];
    if (typeof fret !== "number" || fret < lowestPressed) return undefined;
  }
  return { fret: lowestPressed, fromString, toString };
}

function toVoicing(frets: Array<number | "x">): GuitarVoicing {
  const positive = frets.filter((value): value is number => typeof value === "number" && value > 0);
  // Leave familiar open-position shapes at the nut. Higher shapes start at
  // their lowest pressed fret so all dots fit in the four displayed spaces.
  const baseFret = positive.length && Math.max(...positive) > 4 ? Math.min(...positive) : 1;
  return {
    frets,
    baseFret,
    notes: voicingNotes(frets),
    difficulty: difficulty(frets),
    barre: inferBarre(frets),
  };
}

export function generateVoicings(symbol: string, chordNotes: string[], limit = 12): GuitarVoicing[] {
  const target = new Set(chordNotes.map(pitchClass).filter((note) => note >= 0));
  // A six-string voicing cannot cover more than six distinct pitch classes.
  // Returning early also keeps malformed, near-chromatic input bounded.
  if (target.size === 0 || target.size > 6 || limit <= 0) return [];
  const root = pitchClass(chordNotes[0] ?? symbol);
  const preferredShapes = KNOWN_VOICINGS[normalizeNote(symbol)] ?? [];
  const preferredOrder = new Map(preferredShapes.map((frets, index) => [frets.join(","), index]));
  const results: GuitarVoicing[] = preferredShapes
    .filter((frets) => hasExactTargetCoverage(frets, target) && fitsDiagram(frets))
    .map(toVoicing);
  const seen = new Set(results.map((voicing) => voicing.frets.join(",")));
  const options = STANDARD_TUNING.map((openMidi) => {
    const matches: Array<number | "x"> = ["x"];
    for (let fret = 0; fret <= 12; fret += 1) if (target.has((openMidi + fret) % 12)) matches.push(fret);
    return matches;
  });

  const generated: Array<{ frets: Array<number | "x">; score: number }> = [];
  const maxGenerated = 800;
  let worstGeneratedIndex = 0;
  const generatedScore = (frets: Array<number | "x">) => {
    const bassIndex = frets.findIndex((fret) => fret !== "x");
    const rootBass = bassIndex >= 0 && typeof frets[bassIndex] === "number" && (STANDARD_TUNING[bassIndex] + frets[bassIndex]) % 12 === root ? -2 : 0;
    return difficulty(frets) + rootBass;
  };
  const findWorstGenerated = () => {
    worstGeneratedIndex = generated.reduce((worst, candidate, index) => candidate.score > generated[worst].score ? index : worst, 0);
  };
  const retainGenerated = (frets: Array<number | "x">) => {
    const candidate = { frets, score: generatedScore(frets) };
    if (generated.length < maxGenerated) {
      generated.push(candidate);
      if (candidate.score > generated[worstGeneratedIndex].score) worstGeneratedIndex = generated.length - 1;
      return;
    }
    if (candidate.score < generated[worstGeneratedIndex].score) {
      generated[worstGeneratedIndex] = candidate;
      findWorstGenerated();
    }
  };
  const canStillCover = (stringIndex: number, current: Array<number | "x">) => {
    const present = new Set(current.flatMap((fret, index) => fret === "x" ? [] : [(STANDARD_TUNING[index] + fret) % 12]));
    return [...target].every((note) => present.has(note) || options.slice(stringIndex).some((stringOptions, offset) =>
      stringOptions.some((fret) => fret !== "x" && (STANDARD_TUNING[stringIndex + offset] + fret) % 12 === note),
    ));
  };

  const visit = (stringIndex: number, current: Array<number | "x">) => {
    if (!canStillCover(stringIndex, current)) return;
    if (stringIndex === 6) {
      const sounding = current.filter((value): value is number => typeof value === "number");
      if (sounding.length < 4) return;
      if (!hasExactTargetCoverage(current, target) || !fitsDiagram(current)) return;
      const key = current.join(",");
      if (!seen.has(key)) { seen.add(key); retainGenerated([...current]); }
      return;
    }
    for (const fret of options[stringIndex]) {
      current.push(fret);
      if (fitsDiagram(current)) visit(stringIndex + 1, current);
      current.pop();
    }
  };
  visit(0, []);
  results.push(...generated.map((candidate) => toVoicing(candidate.frets)));

  return results
    .filter((voicing) => hasExactTargetCoverage(voicing.frets, target) && fitsDiagram(voicing.frets))
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
