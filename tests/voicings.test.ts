import { describe, expect, it } from "vitest";
import { AUTO_NAMES, parseChordSymbol } from "../src/music/analysis";
import { generateVoicings, toVoicing } from "../src/music/voicings";

const shapes = (symbol: string) => {
  const chord = parseChordSymbol(symbol)!;
  const notes = chord.pcs.includes(chord.bassPc) ? chord.notes : [...chord.notes, chord.bassName];
  return generateVoicings(chord.symbol, notes, 12, { bassPc: chord.bassPc });
};
const tabs = (symbol: string) => shapes(symbol).map((voicing) => voicing.frets.join(" "));
const SUFFIXES = ["", "m", "7", "maj7", "m7", "sus2", "sus4", "6", "m6", "dim", "dim7", "aug", "m7b5", "9", "maj9", "m9", "add9", "7sus4", "5"];
const everyChord = (check: (symbol: string) => void) => AUTO_NAMES.forEach((root) => SUFFIXES.forEach((suffix) => check(root + suffix)));

describe("shapes a hand can hold", () => {
  it("offers only shapes with a fingering, in every key", () => {
    everyChord((symbol) => {
      const list = shapes(symbol);
      expect(list.length, symbol).toBeGreaterThan(0);
      list.forEach((voicing) => {
        const label = `${symbol}: ${voicing.frets.join(" ")}`;
        const fingers = voicing.fingers ?? [];
        // A finger on every fretted string and on no other, four fingers at most.
        voicing.frets.forEach((fret, string) => expect(fingers[string] != null, label).toBe(typeof fret === "number" && fret > 0));
        expect(Math.max(0, ...fingers.map((finger) => finger ?? 0)), label).toBeLessThanOrEqual(4);
        // Each finger keeps to one fret, and no finger sits behind a lower-numbered one.
        const fretOf = new Map<number, number>();
        voicing.frets.forEach((fret, string) => {
          const finger = fingers[string];
          if (finger == null) return;
          expect(fretOf.get(finger) ?? fret, label).toBe(fret);
          fretOf.set(finger, fret as number);
        });
        const inFingerOrder = [...fretOf].sort((a, b) => a[0] - b[0]).map(([, fret]) => fret);
        expect(inFingerOrder, label).toEqual([...inFingerOrder].sort((a, b) => a - b));
        // Nothing has to ring open under the index finger.
        if (voicing.barre) voicing.frets.slice(voicing.barre.fromString - 1).forEach((fret) => expect(fret, label).not.toBe(0));
      });
    });
  });

  it("starts with the grip a player learns first", () => {
    const first: Record<string, string> = {
      C: "x 3 2 0 1 0", D: "x x 0 2 3 2", E: "0 2 2 1 0 0", G: "3 2 0 0 0 3", A: "x 0 2 2 2 0",
      Am: "x 0 2 2 1 0", Dm: "x x 0 2 3 1", Em: "0 2 2 0 0 0",
      F: "1 3 3 2 1 1", B: "x 2 4 4 4 2", Bb: "x 1 3 3 3 1", Eb: "x 6 8 8 8 6", Ab: "4 6 6 5 4 4",
      Bm: "x 2 4 4 3 2", "F#m": "2 4 4 2 2 2", Gm: "3 5 5 3 3 3", Cm: "x 3 5 5 4 3",
      G7: "3 2 0 0 0 1", B7: "x 2 1 2 0 2", C7: "x 3 5 3 5 3", E7: "0 2 0 1 0 0",
      Cmaj7: "x 3 2 0 0 0", Fmaj7: "x x 3 2 1 0", Gmaj7: "3 2 0 0 0 2", Dm7: "x x 0 2 1 1", Am7: "x 0 2 0 1 0",
      C9: "x 3 2 3 3 3", Dsus4: "x x 0 2 3 3", Asus2: "x 0 2 2 0 0",
      E5: "0 2 2 x x x", A5: "x 0 2 2 x x", G5: "3 5 5 x x x", C5: "x 3 5 5 x x",
      "D/F#": "2 0 0 2 3 2", "G/B": "x 2 0 0 0 3", "C/E": "0 3 2 0 1 0",
    };
    Object.entries(first).forEach(([symbol, tab]) => expect(tabs(symbol)[0], symbol).toBe(tab));
  });

  it("does not repeat a grip with strings left out, unless that makes it clearly easier", () => {
    expect(tabs("C")).not.toContain("x 3 2 0 1 x");
    expect(tabs("E")).not.toContain("x x 2 1 0 0");
    expect(tabs("G")).not.toContain("3 x 0 0 0 3");
    // The small F spares the full barre, and B♭ without its top string spares the index barre.
    expect(tabs("F")).toContain("x x 3 2 1 1");
    expect(tabs("Bb")).toContain("x 1 3 3 3 x");
  });

  it("keeps open strings to the first position, apart from an open bass", () => {
    everyChord((symbol) => shapes(symbol).forEach((voicing) => {
      const pressed = voicing.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
      if (!pressed.length || Math.min(...pressed) <= 3) return;
      const bassString = voicing.frets.findIndex((fret) => fret !== "x");
      voicing.frets.forEach((fret, string) => expect(fret === 0 && string !== bassString, `${symbol}: ${voicing.frets.join(" ")}`).toBe(false));
    }));
  });

  it("leaves the hardest shapes to the barre chords, unless a chord has almost nothing else", () => {
    everyChord((symbol) => {
      const list = shapes(symbol);
      const hard = list.filter((voicing) => voicing.difficulty > 9 && voicing.barre?.fromString !== voicing.frets.findIndex((fret) => fret !== "x") + 1);
      expect(hard.length === 0 || list.length <= 3, `${symbol}: ${hard.map((voicing) => voicing.frets.join(" ")).join(", ")}`).toBe(true);
    });
  });

  it("gives a power chord on three strings", () => {
    expect(tabs("F5").slice(0, 2)).toEqual(["1 3 3 x x x", "x x 3 5 6 x"]);
    expect(tabs("D5")[0]).toBe("x x 0 2 3 x");
  });

  it("marks a shape the user placed as out of reach when no hand can hold it", () => {
    expect(toVoicing(["x", 8, 7, 8, 6, 8])).toMatchObject({ fingers: undefined, barre: undefined, difficulty: 12 });
    expect(toVoicing(["x", 3, 2, 0, 1, 0]).fingers).toEqual([null, 3, 2, null, 1, null]);
  });
});
