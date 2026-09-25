import { describe, expect, it } from "vitest";
import { analyze, detectChords, intervalInfo, keysForChord, parseChordSymbol, respell, suggestChords } from "../src/music/analysis";
import { generateVoicings, soundingMidis } from "../src/music/voicings";

describe("chord symbols", () => {
  it("parses slash chords the chord library cannot read on its own", () => {
    const chord = parseChordSymbol("G/B");
    expect(chord?.symbol).toBe("G/B");
    expect(chord?.notes).toEqual(["G", "B", "D"]);
    expect(chord?.bassPc).toBe(11);
    expect(keysForChord(chord!)).toEqual([59, 62, 67]);
  });

  it("keeps a non-chord-tone bass and canonical suffixes", () => {
    expect(parseChordSymbol("Am7/G")?.symbol).toBe("Am7/G");
    expect(parseChordSymbol("cm7")?.symbol).toBe("Cm7");
    expect(parseChordSymbol("CM7")?.symbol).toBe("Cmaj7");
    expect(parseChordSymbol("F♯m7♭5")?.notes).toEqual(["F#", "A", "C", "E"]);
    expect(parseChordSymbol("H7")).toBeNull();
  });
});

describe("naming keys", () => {
  it("treats the lowest key as the bass and prefers the common inversion", () => {
    expect(detectChords([52, 55, 60], "auto").map((chord) => chord.symbol)).toEqual(["C/E", "Em#5"]);
    const view = analyze([52, 55, 60], null, "auto");
    expect(view.chord?.symbol).toBe("C/E");
    expect(view.info.get(4)?.slot).toBe("3");
  });

  it("ranks root-position readings first", () => {
    expect(detectChords([50, 53, 57, 60], "auto")[0]?.symbol).toBe("Dm7");
    expect(detectChords([57, 64, 71], "auto")[0]?.symbol).toBe("Asus2");
  });

  it("keeps a typed name when it describes the same keys", () => {
    const view = analyze([48, 52, 55, 57], "C6", "auto");
    expect(view.chord?.symbol).toBe("C6");
    expect(view.candidates.map((chord) => chord.symbol)).toContain("Am7/C");
  });

  it("reports single notes, intervals and unknown sets", () => {
    expect(analyze([60], null, "auto").status).toBe("single");
    const third = analyze([60, 64], null, "auto");
    expect(third.status).toBe("interval");
    expect(third.tones[1]?.intervalName).toBe("大三度");
    expect(analyze([60, 61, 62], null, "auto").status).toBe("unknown");
  });
});

describe("display", () => {
  it("writes degrees the way musicians read them", () => {
    expect(["1P", "3m", "5d", "7m", "7d", "9A", "11A", "13m"].map((interval) => intervalInfo(interval).degree)).toEqual(["R", "♭3", "♭5", "♭7", "♭♭7", "♯9", "♯11", "♭13"]);
    expect(intervalInfo("2M").slot).toBe("3");
    expect(intervalInfo("9M").slot).toBe("t");
  });

  it("respells without double accidentals", () => {
    const f7 = parseChordSymbol("F7")!;
    expect(respell(f7, "sharp").notes).toEqual(["F", "A", "C", "D#"]);
    expect(respell(parseChordSymbol("A#7")!, "flat").symbol).toBe("Bb7");
  });
});

describe("search suggestions", () => {
  it("completes a root, applies a bare quality to the current root, and understands Chinese names", () => {
    expect(suggestChords("Cm", null)[0]?.symbol).toBe("Cm");
    expect(suggestChords("Cm", null).map((chord) => chord.symbol)).toContain("Cm7");
    expect(suggestChords("m7", "F")[0]?.symbol).toBe("Fm7");
    expect(suggestChords("大七", "C")[0]?.symbol).toBe("Cmaj7");
    expect(suggestChords("G/B", null)[0]?.symbol).toBe("G/B");
    expect(suggestChords("xyz", null)).toEqual([]);
  });
});

describe("slash chord voicings", () => {
  it("only offers shapes with the requested bass on the lowest sounding string", () => {
    const voicings = generateVoicings("G/B", ["G", "B", "D"], 8, { bassPc: 11 });
    expect(voicings.length).toBeGreaterThan(0);
    voicings.forEach((voicing) => expect(Math.min(...soundingMidis(voicing.frets)) % 12).toBe(11));
  });

  it("prefers the open shape for C/E over a high position", () => {
    const [first] = generateVoicings("C/E", ["C", "E", "G"], 4, { bassPc: 4 });
    expect(Math.max(...first.frets.filter((fret): fret is number => typeof fret === "number"))).toBeLessThanOrEqual(5);
  });
});
