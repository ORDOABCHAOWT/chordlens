import type { GuitarVoicing } from "./types";

type Fret = number | "x";
type Barre = NonNullable<GuitarVoicing["barre"]>;

/** How a left hand holds a shape: one finger per string (1 index … 4 little finger), null for open and muted strings. */
export interface Fingering {
  fingers: Array<number | null>;
  /** The index finger laid across the lowest fret. */
  barre?: Barre;
  /** A ring or little finger flattened over the last strings of the highest fret. */
  smallBarre?: Barre;
  /** How much the hand has to do; the guitar panel turns it into 容易 / 适中 / 较难. */
  effort: number;
}

/** One finger's job: a single string, or several strings of one fret held flat. Strings count from the low E (0). */
interface Press {
  fret: number;
  low: number;
  high: number;
  barre?: "index" | "small";
}

// What each part of a shape adds to the effort. A finger on one string counts 1.
const FRET_SPAN = 0.8;
const INDEX_BARRE = 0.5;
const INDEX_BARRE_STRING = 0.4;
const RING_BARRE = 2;
const LITTLE_BARRE = 2.7;
const STRETCH = 0.8;
const ALL_FOUR = 0.5;
const INNER_MUTE = 2.5;
const TREBLE_MUTE = 0.3;
const BASS_MUTE = 0.1;

const FINGER_SETS: number[][][] = [
  [[]],
  [[1], [2], [3], [4]],
  [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]],
  [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]],
  [[1, 2, 3, 4]],
];

const isFretted = (fret: Fret | undefined) => typeof fret === "number" && fret > 0;

/**
 * The index finger laid across the lowest fret. It lies from its tip, on the lowest string it holds, down to the
 * high E, so nothing under it can ring open and nothing between the notes it holds can be muted.
 */
function indexBarre(frets: Fret[], fret: number): Press | null {
  const held = frets.flatMap((value, string) => (value === fret ? [string] : []));
  if (held.length < 2) return null;
  const low = held[0];
  const high = held[held.length - 1];
  for (let string = low; string < frets.length; string += 1) {
    const value = frets[string];
    if (value === "x" ? string < high : value < fret) return null;
  }
  return { fret, low, high, barre: "index" };
}

/**
 * A ring or little finger flattened over the last strings of the highest fret, as in C9 (x 3 2 3 3 3). It lies on
 * towards the high E like the index finger, so only muted strings can follow it — or one string under the index
 * barre, the way the high E rings in a B♭ barre chord (x 1 3 3 3 1). Longest first.
 */
function smallBarres(frets: Fret[], fret: number, index: Press | null): Press[] {
  const high = frets.lastIndexOf(fret);
  const after = frets.slice(high + 1);
  const clear = after.every((value) => value === "x") || (index !== null && after.length === 1 && after[0] === index.fret);
  if (!clear) return [];
  const runs: Press[] = [];
  for (let low = high - 1; low >= 0 && high - low <= 3 && frets[low] === fret; low -= 1) runs.unshift({ fret, low, high, barre: "small" });
  return runs;
}

/**
 * Fingers for presses given in hand order (by fret, then from the low E), with what the choice adds to the effort.
 * The hand sits with a finger per fret from the lowest fret up. A finger may fall back towards the index finger;
 * the middle and ring fingers may reach one fret past their own, and no two neighbours part by more than two frets.
 */
function assign(presses: Press[], lowestFret: number): { fingers: number[]; cost: number } | null {
  let best: { fingers: number[]; cost: number; fallback: number } | null = null;
  for (const fingers of FINGER_SETS[presses.length] ?? []) {
    let cost = 0;
    let fallback = 0;
    let possible = true;
    presses.forEach((press, position) => {
      const finger = fingers[position];
      if (press.barre === "index" && finger !== 1) possible = false;
      if (press.barre === "small") {
        if (finger < 3) possible = false;
        cost += finger === 3 ? RING_BARRE : LITTLE_BARRE;
      }
      const own = finger - 1;
      const offset = press.fret - lowestFret;
      if (offset > own + (finger === 2 || finger === 3 ? 1 : 0)) possible = false;
      if (offset > own) cost += STRETCH;
      if (position > 0 && press.fret - presses[position - 1].fret > finger - fingers[position - 1] + 1) possible = false;
      fallback += Math.max(0, own - offset);
    });
    // Between equal choices, the one closest to a finger per fret.
    if (possible && (!best || cost < best.cost || (cost === best.cost && fallback < best.fallback))) best = { fingers, cost, fallback };
  }
  return best;
}

const toBarre = (press: Press): Barre => ({ fret: press.fret, fromString: press.low + 1, toString: press.high + 1 });

/**
 * Works out the easiest fingering, or returns null for a shape a hand cannot hold: more notes than four fingers
 * and their barres can take, a barre over a string that should ring open, a reach beyond the hand's four frets,
 * or a muted string no finger can damp.
 */
export function fingering(frets: Fret[]): Fingering | null {
  const fingers: Array<number | null> = frets.map(() => null);
  const sounding = frets.flatMap((fret, string) => (fret === "x" ? [] : [string]));
  if (!sounding.length) return { fingers, effort: 0 };
  const first = sounding[0];
  const last = sounding[sounding.length - 1];

  // A muted string between sounding ones has to be damped. The finger on the bass note does that for the string
  // next to it, as in G without its third (3 x 0 0 0 3); anywhere else no finger is free to.
  const inner = frets.flatMap((fret, string) => (fret === "x" && string > first && string < last ? [string] : []));
  if (inner.length > 1 || (inner.length === 1 && (inner[0] !== first + 1 || !isFretted(frets[first])))) return null;
  const mutes = INNER_MUTE * inner.length + BASS_MUTE * first + TREBLE_MUTE * (frets.length - 1 - last);

  const pressed = frets.filter((fret): fret is number => isFretted(fret));
  if (!pressed.length) return { fingers, effort: mutes };
  const lowestFret = Math.min(...pressed);
  const highestFret = Math.max(...pressed);
  if (highestFret - lowestFret > 3) return null;

  let best: Fingering | null = null;
  const barre = indexBarre(frets, lowestFret);
  for (const index of barre ? [barre, null] : [null]) {
    const smalls = highestFret > lowestFret && highestFret - lowestFret <= 2 ? smallBarres(frets, highestFret, index) : [];
    for (const small of [null, ...smalls]) {
      const presses: Press[] = [];
      frets.forEach((fret, string) => {
        if (!isFretted(fret)) return;
        const held = [index, small].find((press) => press && press.fret === fret && string >= press.low && string <= press.high);
        if (!held) presses.push({ fret: fret as number, low: string, high: string });
        else if (string === held.low) presses.push(held);
      });
      presses.sort((a, b) => a.fret - b.fret || a.low - b.low);
      const hand = assign(presses, lowestFret);
      if (!hand) continue;
      const effort = presses.length + FRET_SPAN * (highestFret - lowestFret) + hand.cost + mutes
        + (index ? INDEX_BARRE + INDEX_BARRE_STRING * (index.high - index.low) : 0)
        + (presses.length === 4 ? ALL_FOUR : 0);
      if (best && best.effort <= effort) continue;
      const held = [...fingers];
      presses.forEach((press, position) => {
        for (let string = press.low; string <= press.high; string += 1) {
          if (frets[string] === press.fret) held[string] = hand.fingers[position];
        }
      });
      best = { fingers: held, barre: index ? toBarre(index) : undefined, smallBarre: small ? toBarre(small) : undefined, effort };
    }
  }
  return best;
}
