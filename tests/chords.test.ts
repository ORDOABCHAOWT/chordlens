import { describe, expect, it } from "vitest";
import { describeChord, detectAndRankChords } from "../src/music/chords";
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
  it("returns playable F7 positions containing only chord notes", () => {
    const allowed = new Set(["F", "A", "C", "E♭"]);
    const voicings = generateVoicings("F7", [...allowed]);
    expect(voicings.length).toBeGreaterThanOrEqual(3);
    voicings.forEach((voicing) => voicing.notes.forEach((note) => expect(allowed.has(note)).toBe(true)));
  });
});
