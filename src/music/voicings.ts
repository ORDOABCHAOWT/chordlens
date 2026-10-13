import { Note } from "@tonaljs/tonal";
import { displayNote, normalizeNote } from "./chords";
import { fingering } from "./fingering";
import type { Fingering } from "./fingering";
import type { GuitarVoicing } from "./types";

export const STANDARD_TUNING = [40, 45, 50, 55, 59, 64];

const KNOWN_VOICINGS: Record<string, Array<Array<number | "x">>> = {
  Asus2: [["x", 0, 2, 2, 0, 0]],
  F7: [[1, 3, 1, 2, 1, 1], ["x", 8, 10, 8, 10, 8], ["x", "x", 3, 5, 4, 5]],
  F: [[1, 3, 3, 2, 1, 1], ["x", 8, 10, 10, 10, 8], ["x", "x", 3, 5, 6, 5]],
  Bb: [["x", 1, 3, 3, 3, 1], [6, 8, 8, 7, 6, 6], ["x", "x", 8, 10, 11, 10]],
  C7: [["x", 3, 5, 3, 5, 3], [8, 10, 8, 9, 8, 8]],
  B7: [["x", 2, 1, 2, 0, 2], ["x", 2, 4, 2, 4, 2], [7, 9, 7, 8, 7, 7]],
  Dm: [["x", "x", 0, 2, 3, 1], ["x", 5, 7, 7, 6, 5], [10, 12, 12, 10, 10, 10]],
  Fmaj7: [["x", "x", 3, 2, 1, 0], [1, "x", 2, 2, 1, "x"], ["x", 8, 10, 9, 10, 8]],
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

/** Open strings belong to the first three frets; further up the neck only the bass string is left open. */
function opensFitPosition(frets: Array<number | "x">) {
  const pressed = frets.filter((value): value is number => typeof value === "number" && value > 0);
  if (!pressed.length || Math.min(...pressed) <= 3) return true;
  const bassString = frets.findIndex((fret) => fret !== "x");
  return frets.every((fret, string) => fret !== 0 || string === bassString);
}

function internalMutes(frets: Array<number | "x">) {
  return frets.reduce<number>((count, fret, index) => {
    if (fret !== "x") return count;
    return count + (frets.slice(0, index).some((value) => value !== "x") && frets.slice(index + 1).some((value) => value !== "x") ? 1 : 0);
  }, 0);
}

/** Difficulty of a shape no hand can hold, which only one the user placed can be. */
const OUT_OF_REACH = 12;
/** Above this difficulty only the standard shapes are offered. */
const TOO_HARD = 9;
/** From this difficulty up, a grip is hard enough for an easier cut of it to be worth offering as well. */
const NOT_EASY = 6.5;

/** `hand` is the fingering when it is already known. */
export function toVoicing(frets: Array<number | "x">, hand: Fingering | null = fingering(frets)): GuitarVoicing {
  const positive = frets.filter((value): value is number => typeof value === "number" && value > 0);
  // Leave familiar open-position shapes at the nut. Higher shapes start at
  // their lowest pressed fret so all dots fit in the four displayed spaces.
  const baseFret = positive.length && Math.max(...positive) > 4 ? Math.min(...positive) : 1;
  return {
    frets,
    baseFret,
    notes: voicingNotes(frets),
    difficulty: hand ? Math.round(hand.effort * 10) / 10 : OUT_OF_REACH,
    fingers: hand?.fingers,
    barre: hand?.barre,
    smallBarre: hand?.smallBarre,
  };
}

export interface VoicingOptions {
  /** Pitch class that should sound lowest; defaults to the root. Only shapes with this bass are kept when any exist. */
  bassPc?: number;
}

/** Fret numbers low E to high E; compact form ("x02200") only when every fret is a single digit. */
export function tabText(voicing: GuitarVoicing, compact = false): string {
  return voicing.frets.join(compact && !voicing.frets.some((fret) => typeof fret === "number" && fret > 9) ? "" : " ");
}

export function soundingMidis(frets: Array<number | "x">): number[] {
  return frets.flatMap((fret, index) => fret === "x" ? [] : [STANDARD_TUNING[index] + fret]);
}

/** The bass is the lowest pitch, which an open string can take from a lower string fretted far up the neck. */
function bassPitchClass(frets: Array<number | "x">): number {
  const midis = soundingMidis(frets);
  return midis.length ? Math.min(...midis) % 12 : -1;
}

/** The same grip strummed over fewer strings: every string `partial` sounds matches `full`, which sounds more. */
function leavesStringsOut(partial: GuitarVoicing, full: GuitarVoicing) {
  return partial.frets.every((fret, string) => fret === "x" || fret === full.frets[string])
    && partial.frets.some((fret, string) => fret === "x" && full.frets[string] !== "x");
}

export function generateVoicings(symbol: string, chordNotes: string[], limit = 12, settings: VoicingOptions = {}): GuitarVoicing[] {
  const target = new Set(chordNotes.map(pitchClass).filter((note) => note >= 0));
  // A six-string voicing cannot cover more than six distinct pitch classes.
  // Returning early also keeps malformed, near-chromatic input bounded.
  if (target.size === 0 || target.size > 6 || limit <= 0) return [];
  const root = pitchClass(chordNotes[0] ?? symbol);
  const bass = settings.bassPc ?? root;
  const slash = bass !== root;
  // A power chord is complete on three strings; a fuller chord needs four to sound like one.
  const fewestStrings = target.size > 2 ? 4 : 3;
  const preferredShapes = slash ? [] : KNOWN_VOICINGS[normalizeNote(symbol)] ?? [];
  const preferredOrder = new Map(preferredShapes.map((frets, index) => [frets.join(","), index]));
  const results: GuitarVoicing[] = preferredShapes
    .filter((frets) => hasExactTargetCoverage(frets, target) && fitsDiagram(frets))
    .map((frets) => toVoicing(frets));
  const seen = new Set(results.map((voicing) => voicing.frets.join(",")));
  // Lower positions read and play more easily, a shape that sounds more strings is the fuller chord, open strings
  // belong to the first three frets and sit oddly under a hand further up, and the wanted bass has to be lowest.
  const preference = (frets: Array<number | "x">) => {
    const pressed = frets.filter((value): value is number => typeof value === "number" && value > 0);
    const lowestPressed = pressed.length ? Math.min(...pressed) : 0;
    const highestPressed = pressed.length ? Math.max(...pressed) : 0;
    const position = Math.max(0, lowestPressed - 1) * 0.4;
    const strayOpen = frets.filter((fret) => fret === 0).length * (Math.max(0, lowestPressed - 3) + Math.max(0, highestPressed - 3) * 0.5);
    const strings = frets.filter((fret) => fret !== "x").length;
    return position + strayOpen - strings * 0.5 + (bassPitchClass(frets) === bass ? -4 : 0);
  };
  // The shapes every player learns first: a barre chord, with the index finger under every string from a bass
  // note on the sixth or fifth string to the high E, and a power chord of root, fifth and octave on three
  // neighbouring strings, the nearer the low E the better.
  const isStandard = (voicing: GuitarVoicing) => {
    const first = voicing.frets.findIndex((fret) => fret !== "x");
    if (target.size === 2) return voicing.frets[first + 2] !== 0 && voicing.frets.every((fret, string) => (fret !== "x") === (string >= first && string < first + 3));
    return first < 2 && voicing.barre?.fromString === first + 1 && voicing.frets.every((fret, string) => string < first || fret !== "x");
  };
  const rank = (voicing: GuitarVoicing) => voicing.difficulty + preference(voicing.frets) - (isStandard(voicing) ? 3 : 0)
    + (target.size === 2 ? voicing.frets.findIndex((fret) => fret !== "x") * 1.2 : 0);
  const options = STANDARD_TUNING.map((openMidi) => {
    const matches: Array<number | "x"> = ["x"];
    for (let fret = 0; fret <= 12; fret += 1) if (target.has((openMidi + fret) % 12)) matches.push(fret);
    return matches;
  });

  const generated: Array<{ frets: Array<number | "x">; score: number; hand: Fingering }> = [];
  const maxGenerated = 800;
  let worstGeneratedIndex = 0;
  const findWorstGenerated = () => {
    worstGeneratedIndex = generated.reduce((worst, candidate, index) => candidate.score > generated[worst].score ? index : worst, 0);
  };
  const retainGenerated = (frets: Array<number | "x">, hand: Fingering) => {
    const candidate = { frets, score: hand.effort + preference(frets), hand };
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
      if (sounding.length < fewestStrings) return;
      if (!hasExactTargetCoverage(current, target) || !fitsDiagram(current) || !opensFitPosition(current)) return;
      const key = current.join(",");
      if (seen.has(key)) return;
      seen.add(key);
      // Only shapes a hand can actually hold are worth showing.
      const hand = fingering(current);
      if (hand) retainGenerated([...current], hand);
      return;
    }
    for (const fret of options[stringIndex]) {
      current.push(fret);
      if (fitsDiagram(current)) visit(stringIndex + 1, current);
      current.pop();
    }
  };
  visit(0, []);
  results.push(...generated.map((candidate) => toVoicing(candidate.frets, candidate.hand)));

  let playable = results.filter((voicing) => voicing.fingers && hasExactTargetCoverage(voicing.frets, target) && fitsDiagram(voicing.frets));
  // The lowest note is the bass, so a shape with another note there plays a different (slash) chord.
  const withBass = playable.filter((voicing) => bassPitchClass(voicing.frets) === bass);
  if (withBass.length) playable = withBass;
  const isPreferred = (voicing: GuitarVoicing) => preferredOrder.has(voicing.frets.join(","));
  const inOrder = (a: GuitarVoicing, b: GuitarVoicing) => {
    const aPreferred = preferredOrder.get(a.frets.join(","));
    const bPreferred = preferredOrder.get(b.frets.join(","));
    if (aPreferred !== undefined || bPreferred !== undefined) {
      if (aPreferred === undefined) return 1;
      if (bPreferred === undefined) return -1;
      return aPreferred - bPreferred;
    }
    return rank(a) - rank(b);
  };
  playable.sort(inOrder);

  // Past this effort only the standard shapes are worth the trouble, unless a chord would be left with next to nothing.
  const worthIt = (voicing: GuitarVoicing) => voicing.difficulty <= TOO_HARD || isStandard(voicing) || isPreferred(voicing);
  const offered = playable.filter(worthIt);
  if (offered.length < 3) offered.push(...playable.filter((voicing) => !worthIt(voicing)).slice(0, 3 - offered.length));
  offered.sort(inOrder);

  const shown: GuitarVoicing[] = [];
  for (const voicing of offered) {
    if (shown.length === limit) break;
    // A grip with strings left out repeats the fuller one. It earns its own place when the fuller one is hard and
    // it is clearly easier, or when the fuller one is well down the list.
    const kept = isPreferred(voicing) || (target.size === 2 && isStandard(voicing));
    const repeats = !kept && offered.some((full) => leavesStringsOut(voicing, full) && (internalMutes(voicing.frets) > internalMutes(full.frets)
      || (!(full.difficulty > NOT_EASY && voicing.difficulty <= full.difficulty - 1.5) && rank(full) < rank(voicing) + 1)));
    if (!repeats) shown.push(voicing);
  }
  return shown;
}
