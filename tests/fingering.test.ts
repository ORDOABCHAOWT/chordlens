import { describe, expect, it } from "vitest";
import { fingering } from "../src/music/fingering";

const hand = (tab: string) => fingering(tab.split(" ").map((value) => (value === "x" ? "x" : Number(value))));
/** Fingers from the low E to the high E, "-" for a string no finger is on. */
const fingers = (tab: string) => hand(tab)?.fingers.map((finger) => finger ?? "-").join("") ?? null;

describe("fingering a shape", () => {
  it("fingers open chords the way they are taught", () => {
    const taught: Array<[string, string]> = [
      ["x 3 2 0 1 0", "-32-1-"], // C
      ["x x 0 2 3 2", "---132"], // D
      ["0 2 2 1 0 0", "-231--"], // E
      ["3 2 0 0 0 3", "21---3"], // G
      ["x 0 2 2 2 0", "--123-"], // A
      ["x 0 2 2 1 0", "--231-"], // Am
      ["x x 0 2 3 1", "---231"], // Dm
      ["0 2 2 0 0 0", "-12---"], // Em
      ["x 2 1 2 0 2", "-213-4"], // B7
      ["x 3 2 3 1 0", "-3241-"], // C7
      ["3 2 0 0 0 1", "32---1"], // G7
      ["x x 0 2 1 2", "---213"], // D7
      ["x x 3 2 1 0", "--321-"], // Fmaj7
      ["3 3 2 0 1 0", "342-1-"], // C/G
      ["2 0 0 2 3 2", "1--243"], // D/F♯
      ["x 3 1 0 1 3", "-31-24"], // Cm, the hand split over two frets
    ];
    taught.forEach(([tab, expected]) => expect(fingers(tab), tab).toBe(expected));
  });

  it("lays the index finger across a barre chord", () => {
    expect(hand("1 3 3 2 1 1")).toMatchObject({ fingers: [1, 3, 4, 2, 1, 1], barre: { fret: 1, fromString: 1, toString: 6 } });
    expect(hand("x 2 4 4 3 2")).toMatchObject({ fingers: [null, 1, 3, 4, 2, 1], barre: { fret: 2, fromString: 2, toString: 6 } });
    expect(hand("x x 3 2 1 1")).toMatchObject({ fingers: [null, null, 3, 2, 1, 1], barre: { fret: 1, fromString: 5, toString: 6 } });
    expect(hand("x x 0 2 2 2")).toMatchObject({ fingers: [null, null, null, 1, 1, 1], barre: { fret: 2, fromString: 4, toString: 6 } });
  });

  it("uses fingertips where a barre would not help or would stop an open string", () => {
    expect(hand("x x 0 2 3 2")?.barre).toBeUndefined();
    expect(hand("x 0 2 2 2 0")?.barre).toBeUndefined();
    expect(hand("0 2 2 0 0 0")?.barre).toBeUndefined();
    expect(hand("3 2 0 0 3 3")).toMatchObject({ fingers: [2, 1, null, null, 3, 4], smallBarre: undefined });
  });

  it("flattens the ring finger over the last strings of the top fret", () => {
    expect(hand("x 3 2 3 3 3")).toMatchObject({ fingers: [null, 2, 1, 3, 3, 3], smallBarre: { fret: 3, fromString: 4, toString: 6 } });
    expect(hand("x 3 5 5 5 5")).toMatchObject({ fingers: [null, 1, 3, 3, 3, 3], smallBarre: { fret: 5, fromString: 3, toString: 6 } });
    // The B♭ barre chord: the high E rings under the index finger, past the ring finger.
    expect(hand("x 1 3 3 3 1")).toMatchObject({
      fingers: [null, 1, 3, 3, 3, 1],
      barre: { fret: 1, fromString: 2, toString: 6 },
      smallBarre: { fret: 3, fromString: 3, toString: 5 },
    });
  });

  it("refuses shapes no hand can hold", () => {
    const impossible = [
      "x 8 7 8 6 8", // five fingertips
      "2 1 2 1 2 0", // five fingertips, and the open string rules out a barre
      "8 7 7 7 8 6", // the three notes in a row are not on the top fret, so no finger can flatten over them
      "x 4 3 5 4 4", // likewise
      "x 4 3 3 2 4", // likewise
      "1 3 2 2 1 0", // a barre would stop the open first string
      "11 8 8 11 11 9", // three fingers left for four notes
      "x 2 0 x 0 2", // a muted string between two open ones
      "x 3 2 0 x 0", // a muted string away from the bass finger
      "0 2 2 x 0 2", // likewise
      "3 x x 0 0 3", // two muted strings inside the shape
      "1 x 3 3 1 1", // a muted string under what would be the barre
      "1 x x x x 5", // wider than four frets
    ];
    impossible.forEach((tab) => expect(hand(tab), tab).toBeNull());
  });

  it("keeps the mute a bass finger makes on the next string", () => {
    expect(fingers("3 x 0 0 0 3")).toBe("1----2");
    expect(fingers("1 x 2 2 1 x")).toBe("1-342-");
  });

  it("rates open chords easy, barre chords harder and double barres hardest", () => {
    const effort = (tab: string) => hand(tab)!.effort;
    expect(effort("0 2 2 0 0 0")).toBeLessThan(effort("x 3 2 0 1 0"));
    expect(effort("x 3 2 0 1 0")).toBeLessThan(effort("x x 3 2 1 1"));
    expect(effort("x x 3 2 1 1")).toBeLessThan(effort("1 3 3 2 1 1"));
    expect(effort("1 3 3 2 1 1")).toBeLessThan(effort("8 10 8 9 10 10"));
  });

  it("needs no hand for open and silent strings", () => {
    expect(hand("0 0 0 0 0 0")).toMatchObject({ fingers: [null, null, null, null, null, null], effort: 0 });
    expect(hand("x x x x x x")).toMatchObject({ effort: 0 });
  });
});
