import { describe, expect, it } from "vitest";
import { analyze, keysForChord, parseChordSymbol } from "../src/music/analysis";
import { explainChord } from "../src/music/explain";

function explain(symbol: string) {
  const chord = parseChordSymbol(symbol)!;
  const view = analyze(keysForChord(chord), chord.symbol, "auto");
  return explainChord(view.chord!, view.tones, "auto");
}

describe("chord explanations", () => {
  it("describes a diminished triad with concrete resolutions", () => {
    const text = explain("F#dim");
    expect(text.build).toContain("两个小三度");
    expect(text.sound).toContain("紧张");
    expect(text.usage).toContain("F → F♯dim → G");
    expect(text.usage).toContain("G 大调的第七级");
    expect(text.inversion).toBeUndefined();
  });

  it("names the real chords of ii–V progressions", () => {
    expect(explain("Dm7").usage).toContain("Dm7 → G7 → Cmaj7");
    expect(explain("F#m7b5").usage).toContain("F♯m7♭5 → B7 → Em");
    expect(explain("F7").usage).toContain("F7 → B♭");
    expect(explain("Am").usage).toContain("C 大调");
  });

  it("explains inversions and foreign bass notes", () => {
    expect(explain("C/E").inversion).toContain("第一转位（低音 E 是三音）");
    expect(explain("C/G").inversion).toContain("C/G → G7 → C");
    expect(explain("C7/Bb").inversion).toContain("第三转位");
    expect(explain("C/D").inversion).toContain("不属于和弦本身");
  });

  it("falls back to a generated description for rarer chord types", () => {
    const text = explain("C7b9b13");
    expect(text.build).toBe("以 C 为根音，叠加大三度、纯五度、小七度、降九音、降十三音。");
    expect(text.sound).toBeUndefined();
  });
});
