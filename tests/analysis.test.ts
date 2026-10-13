import { describe, expect, it } from "vitest";
import { analyze, detectChords, intervalInfo, keysForChord, keysOverRoot, parseChordSymbol, respell, suggestChords } from "../src/music/analysis";
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

describe("a root the user chooses", () => {
  it("reads the notes on that root when the library has a chord there", () => {
    const keys = [57, 60, 64, 67];
    expect(analyze(keys, null, "auto").chord?.symbol).toBe("Am7");
    expect(analyze(keys, null, "auto", 9).chord?.symbol).toBe("Am7");
    expect(analyze(keys, null, "auto", 0).chord?.symbol).toBe("C6/A");
    expect(analyze([48, 52, 55, 57], null, "auto", 9).chord?.symbol).toBe("Am7/C");
    expect(analyze([52, 55, 60], null, "auto", 0).chord?.symbol).toBe("C/E");
    expect(analyze([52, 55, 60], null, "auto", 4).chord?.symbol).toBe("Em#5");
  });

  it("names by rule what the library cannot name on that root, and keeps the usual names at hand", () => {
    const view = analyze([57, 62, 66], null, "auto", 9);
    expect(view.chord?.symbol).toBe("A6sus4(no5)");
    expect(view.chord?.rare).toBe(true);
    expect(view.tones.map((tone) => `${tone.degree} ${tone.name} ${tone.intervalName}`)).toEqual(["R A 根音", "4 D 纯四度", "6 F# 大六度"]);
    expect(view.tones[0]).toMatchObject({ isRoot: true, isBass: true });
    expect(view.candidates.map((chord) => chord.symbol)).toEqual(["D/A", "F#m#5/A"]);
    expect(analyze([50, 54, 57], null, "auto", 9).chord?.symbol).toBe("A6sus4(no5)/D");
    expect(analyze([57, 62, 66], null, "flat", 9).chord?.notes).toEqual(["A", "D", "Gb"]);
  });

  it.each([
    [[60, 64, 69], "C6(no5)"],
    [[60, 67, 70], "C7(no3)"],
    [[60, 65, 70], "C7sus4(no5)"],
    [[60, 64, 71], "Cmaj7(no5)"],
    [[60, 63, 70], "Cm7(no5)"],
    [[60, 63, 71], "CmMaj7(no5)"],
    [[60, 62, 64], "Cadd9(no5)"],
    [[60, 64, 65, 67], "Cadd4"],
    [[60, 65, 67, 69], "C6sus4"],
    [[60, 62, 67, 69], "C6sus2"],
  ])("builds a rule name for %j", (keys, symbol) => {
    expect(analyze(keys, null, "auto", 0).chord?.symbol).toBe(symbol);
  });

  it("measures intervals from the chosen root when there is no chord to name", () => {
    const pair = analyze([57, 62], null, "auto", 9);
    expect(pair.status).toBe("interval");
    expect(pair.tones.map((tone) => tone.name)).toEqual(["A", "D"]);
    expect(pair.tones[1].intervalName).toBe("纯四度");
    expect(analyze([57, 62], null, "auto").chord?.symbol).toBe("D5/A");

    const cluster = analyze([60, 61, 62], null, "auto", 2);
    expect(cluster.status).toBe("unknown");
    expect(cluster.tones.map((tone) => `${tone.degree} ${tone.name}`)).toEqual(["R D", "♭7 C", "7 Db"]);
    expect(cluster.tones.find((tone) => tone.isBass)?.name).toBe("C");
  });

  it("puts a chosen root at the bottom, voiced the way a typed chord is", () => {
    expect(keysOverRoot([50, 54, 57], 9)).toEqual([57, 62, 66]);
    expect(keysOverRoot([48, 52, 55, 57], 9)).toEqual(keysForChord(parseChordSymbol("Am7")!));
    expect(keysOverRoot([50, 54, 57], 0)).toEqual([50, 54, 57]);
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

describe("voicings follow the bass", () => {
  const shapes = (symbol: string) => {
    const chord = parseChordSymbol(symbol)!;
    return generateVoicings(chord.symbol, chord.notes, 12, { bassPc: chord.bassPc });
  };
  const first = (symbol: string) => shapes(symbol)[0]?.frets.join(" ");

  it("keeps the root on the lowest sounding string when the chord has no slash", () => {
    ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"].forEach((root) => {
      ["", "m", "7", "maj7", "m7", "sus2", "sus4", "6", "dim", "aug", "9", "add9"].forEach((suffix) => {
        const chord = parseChordSymbol(root + suffix)!;
        const voicings = shapes(root + suffix);
        expect(voicings.length).toBeGreaterThan(0);
        voicings.forEach((voicing) => expect(Math.min(...soundingMidis(voicing.frets)) % 12, `${chord.symbol}: ${voicing.frets.join(" ")}`).toBe(chord.rootPc));
      });
    });
  });

  it("starts with the everyday shape", () => {
    expect(first("C")).toBe("x 3 2 0 1 0");
    expect(first("D")).toBe("x x 0 2 3 2");
    expect(first("E7")).toBe("0 2 0 1 0 0");
    expect(first("Am7")).toBe("x 0 2 0 1 0");
    expect(first("Gmaj7")).toBe("3 2 0 0 0 2");
    expect(first("D/A")).toBe("x 0 0 2 3 2");
    expect(first("F/A")).toBe("x 0 3 2 1 1");
  });

  it("leaves open strings out of shapes far up the neck", () => {
    expect(first("Dsus4")).toBe("x x 0 2 3 3");
    expect(first("Eb")).toBe("x 6 8 8 8 6");
    expect(first("C7sus4")).toBe("x 3 3 3 6 3");
  });
});
