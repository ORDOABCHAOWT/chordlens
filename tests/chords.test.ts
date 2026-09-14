import { describe, expect, it } from "vitest";
import { Note } from "@tonaljs/tonal";
import { describeChord, detectAndRankChords, normalizeNote } from "../src/music/chords";
import { generateVoicings } from "../src/music/voicings";

describe("notes to chord", () => {
  const cases: Array<[string[], string]> = [
    [["F", "A", "C"], "F"],
    [["F", "A", "C", "Eb"], "F7"],
    [["C", "E", "G", "B"], "Cmaj7"],
    [["D", "F", "A"], "Dm"],
    [["G", "B", "D", "F"], "G7"],
  ];
  it.each(cases)("detects %s as %s", (notes, expected) => {
    expect(detectAndRankChords(notes)[0]?.symbol).toBe(expected);
  });
});

describe("chord to notes", () => {
  it("decomposes common chords", () => {
    expect(describeChord("F7")?.notes).toEqual(["F", "A", "C", "E♭"]);
    expect(describeChord("Cmaj7")?.notes).toEqual(["C", "E", "G", "B"]);
    expect(describeChord("Dm7")?.notes).toEqual(["D", "F", "A", "C"]);
  });
});

describe("guitar voicings", () => {
  const tuning = [40, 45, 50, 55, 59, 64];
  const pitchClasses = (notes: string[]) => new Set(notes.map((note) => Note.get(normalizeNote(note)).chroma));
  const frettedPitchClasses = (frets: Array<number | "x">) => new Set(frets.flatMap((fret, string) => fret === "x" ? [] : [(tuning[string] + fret) % 12]));

  const expectExactCoverage = (chordNotes: string[], symbol: string) => {
    const expected = pitchClasses(chordNotes);
    const voicings = generateVoicings(symbol, chordNotes, 24);
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => {
      expect(frettedPitchClasses(voicing.frets)).toEqual(expected);
      expect(pitchClasses(voicing.notes)).toEqual(expected);
      const fretted = voicing.frets.filter((fret): fret is number => typeof fret === "number" && fret > 0);
      fretted.forEach((fret) => expect(voicing.baseFret > 1 ? fret - voicing.baseFret + 1 : fret).toBeGreaterThanOrEqual(1));
      fretted.forEach((fret) => expect(voicing.baseFret > 1 ? fret - voicing.baseFret + 1 : fret).toBeLessThanOrEqual(4));
      if (voicing.barre) {
        expect(voicing.frets[voicing.barre.fromString - 1]).toBe(voicing.barre.fret);
        expect(voicing.frets[voicing.barre.toString - 1]).toBe(voicing.barre.fret);
        expect(voicing.frets.slice(voicing.barre.fromString - 1, voicing.barre.toString).every((fret) => typeof fret === "number" && fret >= voicing.barre!.fret)).toBe(true);
      }
    });
  };

  it("returns playable F7 positions containing only chord notes", () => {
    const allowed = new Set(["F", "A", "C", "E♭"]);
    const voicings = generateVoicings("F7", [...allowed]);
    expect(voicings.length).toBeGreaterThanOrEqual(3);
    voicings.forEach((voicing) => voicing.notes.forEach((note) => expect(allowed.has(note)).toBe(true)));
  });

  it("recognizes A–E–B as Asus2 and prefers the canonical open voicing", () => {
    expect(detectAndRankChords(["A", "E", "B"])[0]?.symbol).toBe("Asus2");
    const voicings = generateVoicings("Asus2", ["A", "B", "E"]);
    expect(voicings[0]?.frets).toEqual(["x", 0, 2, 2, 0, 0]);
    expect(voicings[0]?.baseFret).toBe(1);
    expect(voicings[0]?.barre).toBeUndefined();
  });

  it("covers exactly every requested pitch class and keeps all dots in the four-fret diagram", () => {
    ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].forEach((root) => {
      ["", "m", "sus2", "7", "maj7", "m7"].forEach((suffix) => {
        const chord = describeChord(`${root}${suffix}`);
        expect(chord).not.toBeNull();
        expectExactCoverage(chord!.notes, chord!.symbol);
      });
    });
  });

  it("infers only physically continuous barres with their real endpoints", () => {
    const bb = generateVoicings("Bb", ["B♭", "D", "F"])[0];
    expect(bb?.frets).toEqual(["x", 1, 3, 3, 3, 1]);
    expect(bb?.barre).toEqual({ fret: 1, fromString: 2, toString: 6 });

    const asus2 = generateVoicings("Asus2", ["A", "B", "E"])[0];
    expect(asus2?.barre).toBeUndefined();
  });
});
