import { Chord, ChordType, Interval, Note } from "@tonaljs/tonal";

export type Spelling = "auto" | "sharp" | "flat";
/** Harmonic role used for colour: root, third (or its sus replacement), fifth, sixth/seventh, tension, unknown. */
export type Slot = "r" | "3" | "5" | "7" | "t" | "n";

export interface LensChord {
  symbol: string;
  rootName: string;
  rootPc: number;
  suffix: string;
  type: string;
  aliases: string[];
  notes: string[];
  intervals: string[];
  pcs: number[];
  bassName: string;
  bassPc: number;
  slash: boolean;
  score?: number;
  /** Named by rule on a root the user chose, because the chord library has no chord there for these notes. */
  rare?: boolean;
}

export interface Tone {
  pc: number;
  name: string;
  ivl: string;
  slot: Slot;
  degree: string;
  formula: string;
  intervalName: string;
  isBass: boolean;
  isRoot: boolean;
}

export type AnalysisStatus = "empty" | "single" | "interval" | "chord" | "unknown";

export interface Analysis {
  notes: number[];
  status: AnalysisStatus;
  chord: LensChord | null;
  candidates: LensChord[];
  tones: Tone[];
  info: Map<number, Tone>;
  bassPc: number | null;
}

export const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
/** Lead-sheet spellings for roots on black keys. */
export const AUTO_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
export const PIANO_LOW = 48; // C3
export const PIANO_HIGH = 71; // B4
export const COMMON_PICKS = ["C", "G", "Am", "F", "Dm7", "G7", "Cmaj7", "E7"];

const PREFERRED_SUFFIXES = ["", "m", "7", "maj7", "m7", "m7b5", "dim", "dim7", "aug", "sus4", "sus2", "7sus4", "6", "m6", "69", "m69", "9", "maj9", "m9", "add9", "madd9", "11", "m11", "13", "maj13", "m13", "7b9", "7#9", "7#11", "maj7#11", "7b5", "7#5", "mMaj7", "maj7#5", "9sus4", "5", "alt7", "7b13", "m7#5", "7no5"];
const COMMON_SUFFIXES = ["", "m", "7", "maj7", "m7", "sus4", "sus2", "add9", "6", "m6", "9", "maj9", "m9", "dim", "dim7", "m7b5", "aug", "7sus4", "11", "m11", "13", "7b9", "7#9", "maj7#11", "mMaj7", "5"];

export const CHORD_NAMES_ZH: Record<string, string> = {
  "": "大三和弦", m: "小三和弦", "7": "属七和弦", maj7: "大七和弦", m7: "小七和弦", m7b5: "半减七和弦",
  dim: "减三和弦", dim7: "减七和弦", aug: "增三和弦", "m#5": "小三升五和弦", sus4: "挂四和弦", sus2: "挂二和弦", "7sus4": "属七挂四和弦",
  "6": "大六和弦", m6: "小六和弦", "69": "六九和弦", m69: "小六九和弦", "9": "属九和弦", maj9: "大九和弦", m9: "小九和弦",
  add9: "加九和弦", madd9: "小加九和弦", "11": "属十一和弦", m11: "小十一和弦", "13": "属十三和弦", maj13: "大十三和弦",
  m13: "小十三和弦", "7b9": "属七降九和弦", "7#9": "属七升九和弦", "7#11": "属七升十一和弦", "maj7#11": "大七升十一和弦",
  "7b5": "属七降五和弦", "7#5": "增属七和弦", mMaj7: "小大七和弦", "maj7#5": "增大七和弦", "9sus4": "属九挂四和弦",
  "5": "强力和弦", alt7: "变化属和弦", "7b13": "属七降十三和弦", "m7#5": "小七升五和弦", "7no5": "属七和弦（省五音）",
};
const ENGLISH_FALLBACK: Record<string, string> = {
  add9: "added ninth", madd9: "minor added ninth", m69: "minor six-nine", "7b5": "dominant flat five", "7#5": "augmented dominant",
  mMaj7: "minor-major seventh", "7no5": "dominant seventh, no 5th", "9sus4": "ninth suspended fourth", "7b13": "dominant flat thirteenth", "m7#5": "minor seventh sharp five",
};
const INTERVAL_NAMES_ZH: Record<string, string> = {
  P1: "根音", m2: "小二度", M2: "大二度", m3: "小三度", M3: "大三度", P4: "纯四度", A4: "增四度", d5: "减五度", P5: "纯五度",
  A5: "增五度", m6: "小六度", M6: "大六度", d7: "减七度", m7: "小七度", M7: "大七度", m9: "降九音", M9: "九音", A9: "升九音",
  P11: "十一音", A11: "升十一音", m13: "降十三音", M13: "十三音",
};
const COMMON_TYPE_BONUS: Record<string, number> = {
  major: 18, minor: 18, "dominant seventh": 17, "major seventh": 15, "minor seventh": 15, "half-diminished": 12, diminished: 10,
  "diminished seventh": 10, augmented: 8, "suspended fourth": 10, "suspended second": 8, sixth: 8, "minor sixth": 8, fifth: 12,
  "dominant ninth": 8, "major ninth": 8, "minor ninth": 8,
};

/** The plain reading of each distance in semitones, for notes that are not being read as a chord. */
const SIMPLE_INTERVALS = ["1P", "2m", "2M", "3m", "3M", "4P", "5d", "5P", "6m", "6M", "7m", "7M"];

const unique = <T,>(values: T[]) => [...new Set(values)];

export function pitchClass(name: string): number {
  const chroma = Note.get(name).chroma;
  return typeof chroma === "number" && !Number.isNaN(chroma) ? chroma : -1;
}

/** "Eb" → "E♭"; also used for chord suffixes, whose only lowercase b is a flat. */
export function prettyAccidentals(text: string): string {
  return text.replace(/#/g, "♯").replace(/b/g, "♭");
}

export function spellPitchClass(pc: number, spelling: Spelling): string {
  return (spelling === "sharp" ? SHARP_NAMES : spelling === "flat" ? FLAT_NAMES : AUTO_NAMES)[pc];
}

export function chordNameZh(chord: LensChord): string {
  return `${prettyAccidentals(chord.rootName)} ${CHORD_NAMES_ZH[chord.suffix] ?? "和弦"}`;
}

export function chordTypeEnglish(chord: LensChord): string {
  const name = (chord.type || ENGLISH_FALLBACK[chord.suffix] || "").replace(/\s*\(.*\)$/, "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "";
}

function preferredSuffix(aliases: string[], type: string): string {
  if (type === "major") return "";
  for (const suffix of PREFERRED_SUFFIXES) if (suffix && aliases.includes(suffix)) return suffix;
  return aliases.find((alias) => /^[A-Za-z0-9#]+$/.test(alias)) ?? aliases[0] ?? "";
}

/** A chord from root + suffix, with an optional bass that differs from the root (a slash chord). */
export function buildChord(rootName: string, suffix: string, bassName?: string | null): LensChord | null {
  const rootPc = pitchClass(rootName);
  if (rootPc < 0) return null;
  const chord = Chord.get(rootName + suffix);
  if (chord.empty || !chord.notes.length) return null;
  let bassPc = rootPc;
  let slashBass: string | null = null;
  if (bassName) {
    const pc = pitchClass(bassName);
    if (pc < 0) return null;
    if (pc !== rootPc) {
      bassPc = pc;
      slashBass = bassName;
    }
  }
  const canonical = preferredSuffix(chord.aliases, chord.type);
  return {
    symbol: rootName + canonical + (slashBass ? `/${slashBass}` : ""),
    rootName,
    rootPc,
    suffix: canonical,
    type: chord.type,
    aliases: chord.aliases,
    notes: [...chord.notes],
    intervals: [...chord.intervals],
    pcs: chord.notes.map(pitchClass),
    bassName: slashBass ?? rootName,
    bassPc,
    slash: Boolean(slashBass),
  };
}

/** The same chord over a given bass; a bass that is a chord tone keeps the chord's own spelling. */
export function withBass(rootName: string, suffix: string, bassPc: number | null, spelling: Spelling): LensChord | null {
  const base = buildChord(rootName, suffix);
  if (!base || bassPc === null || bassPc === base.rootPc) return base;
  const index = base.pcs.indexOf(bassPc);
  return buildChord(rootName, suffix, index >= 0 ? base.notes[index] : spellPitchClass(bassPc, spelling));
}

export function parseChordSymbol(raw: string): LensChord | null {
  let text = raw.trim().replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
  if (!text) return null;
  if (/^[a-g]/.test(text)) text = text[0].toUpperCase() + text.slice(1);
  const match = text.match(/^([A-G](?:#{1,2}|b{1,2})?)([^/]*)(?:\/([A-Ga-g](?:#{1,2}|b{1,2})?))?$/);
  if (!match) return null;
  const bass = match[3] ? match[3][0].toUpperCase() + match[3].slice(1) : null;
  return buildChord(match[1], match[2] === "M" ? "" : match[2], bass);
}

export function matchesNotes(chord: LensChord, midis: number[]): boolean {
  if (!midis.length) return false;
  const present = new Set(midis.map((midi) => midi % 12));
  const expected = new Set([...chord.pcs, chord.bassPc]);
  return present.size === expected.size && [...present].every((pc) => expected.has(pc)) && Math.min(...midis) % 12 === chord.bassPc;
}

function scoreChord(chord: LensChord, pcs: number[], bassPc: number): number {
  const expected = new Set([...chord.pcs, chord.bassPc]);
  let score = 50;
  if (expected.size === pcs.length && pcs.every((pc) => expected.has(pc))) score += 35;
  if (pcs.includes(chord.rootPc)) score += 12;
  if (bassPc === chord.rootPc) score += 12;
  if (chord.intervals.some((interval) => Interval.get(interval).num === 3)) score += 5;
  if (chord.intervals.some((interval) => Interval.get(interval).num === 7)) score += 4;
  score += COMMON_TYPE_BONUS[chord.type] ?? (chord.suffix === "add9" ? 10 : 0);
  score -= Math.max(0, chord.notes.length - 4) * 3;
  return score;
}

/** Ranked names for a set of keys; the lowest key is the bass, so inversions come back as slash chords. */
export function detectChords(midis: number[], spelling: Spelling): LensChord[] {
  const sorted = unique(midis).sort((a, b) => a - b);
  const pcs = unique(sorted.map((midi) => midi % 12));
  if (pcs.length < 2) return [];
  const bassPc = pcs[0];
  const found = new Map<string, LensChord>();
  const add = (chord: LensChord | null) => {
    if (!chord || found.has(chord.symbol)) return;
    found.set(chord.symbol, { ...chord, score: scoreChord(chord, pcs, bassPc) });
  };
  for (const symbol of Chord.detect(pcs.map((pc) => SHARP_NAMES[pc]))) {
    const match = symbol.match(/^([A-G][#b]*)([^/]*)/);
    if (match) add(withBass(spellPitchClass(pitchClass(match[1]), spelling), match[2] === "M" ? "" : match[2], bassPc, spelling));
  }
  if (!found.size) {
    for (const pc of pcs) {
      for (const suffix of ["", "m", "7", "maj7", "m7", "dim", "sus4", "sus2", "5"]) {
        const chord = withBass(spellPitchClass(pc, spelling), suffix, bassPc, spelling);
        if (chord && matchesNotes(chord, sorted)) add(chord);
      }
    }
  }
  return [...found.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.symbol.length - b.symbol.length);
}

/** Forced sharp or flat display, without double accidentals (as the previous app did). */
export function respell(chord: LensChord, spelling: Spelling): LensChord {
  if (spelling === "auto" || chord.rare) return chord;
  const names = spelling === "sharp" ? SHARP_NAMES : FLAT_NAMES;
  const next = buildChord(names[chord.rootPc], chord.suffix, chord.slash ? names[chord.bassPc] : null);
  if (!next) return chord;
  return { ...next, notes: next.pcs.map((pc) => names[pc]), bassName: names[next.bassPc], score: chord.score };
}

export function intervalInfo(interval: string): Pick<Tone, "slot" | "degree" | "formula" | "intervalName"> {
  const parsed = Interval.get(interval);
  const num = parsed.num || 1;
  const quality = parsed.q || "P";
  const simple = ((num - 1) % 7) + 1;
  const perfect = simple === 1 || simple === 4 || simple === 5;
  let slot: Slot = "t";
  if (num === 1 || num === 8) slot = "r";
  else if (num >= 2 && num <= 4) slot = "3";
  else if (num === 5) slot = "5";
  else if (num === 6 || num === 7) slot = "7";
  const accidental = quality === "m" ? "♭"
    : quality === "d" ? (perfect ? "♭" : "♭♭")
      : quality === "A" ? "♯"
        : quality === "dd" ? (perfect ? "♭♭" : "♭♭♭")
          : quality === "AA" ? "♯♯" : "";
  return {
    slot,
    degree: num === 1 ? "R" : accidental + num,
    formula: num === 1 ? "1" : accidental + num,
    intervalName: INTERVAL_NAMES_ZH[quality + num] ?? accidental + num,
  };
}

/** Close position on the two-octave keyboard with the bass in the lower octave. */
export function keysFromPitchClasses(bassPc: number, pcs: number[]): number[] {
  const bass = PIANO_LOW + bassPc;
  const keys = [bass];
  let previous = bass;
  for (const pc of pcs) {
    if (pc === bassPc) continue;
    let midi = previous + ((((pc - previous) % 12) + 12) % 12 || 12);
    if (midi > PIANO_HIGH) midi = bass + ((((pc - bass) % 12) + 12) % 12 || 12);
    else previous = midi;
    if (!keys.includes(midi)) keys.push(midi);
  }
  return keys.sort((a, b) => a - b);
}

export const keysForChord = (chord: LensChord) => keysFromPitchClasses(chord.bassPc, chord.pcs);

/**
 * Names for what is left when the user insists on a root the library has no chord on: a triad or a
 * sixth/seventh chord with its third suspended or a tone left out. Returns null for anything further out.
 */
function rareShape(semitones: Set<number>): { suffix: string; intervals: Array<[number, string]> } | null {
  const has = (value: number) => semitones.has(value);
  if (has(1) || (has(3) && has(4)) || (has(10) && has(11)) || (has(6) && has(8))) return null;
  const intervals: Array<[number, string]> = [];
  let quality = "";
  let sus = "";
  let top = "";
  let fifth = "";
  let add = "";
  let omit = "";
  let spareSecond = has(2);
  let spareFourth = has(5);
  if (has(4)) intervals.push([4, "3M"]);
  else if (has(3)) { quality = "m"; intervals.push([3, "3m"]); }
  else if (has(5)) { sus = "sus4"; spareFourth = false; intervals.push([5, "4P"]); }
  else if (has(2)) { sus = "sus2"; spareSecond = false; intervals.push([2, "2M"]); }
  else omit += "(no3)";
  if (has(7)) {
    if (has(6) || has(8)) return null;
    intervals.push([7, "5P"]);
  } else if (has(6)) { fifth = "b5"; intervals.push([6, "5d"]); }
  else if (has(8)) { fifth = "#5"; intervals.push([8, "5A"]); }
  else omit += "(no5)";
  if (has(9)) {
    if (has(10) || has(11)) return null;
    top = "6";
    intervals.push([9, "6M"]);
  } else if (has(10)) { top = "7"; intervals.push([10, "7m"]); }
  else if (has(11)) { top = "maj7"; intervals.push([11, "7M"]); }
  if (spareSecond) {
    if (sus) return null;
    intervals.push([2, "9M"]);
    if (top === "7") top = "9"; else if (top === "maj7") top = "maj9"; else if (top === "6") top = "69"; else add = "add9";
  }
  if (spareFourth) {
    if (top || add) return null;
    add = "add4";
    intervals.push([5, "4P"]);
  }
  if (sus && fifth) return null;
  // Without a third or a suspension only a fifth with a sixth or seventh on top still reads as a chord.
  if (omit.includes("no3") && !(has(7) && top)) return null;
  const head = quality && top.startsWith("maj") ? `mMaj${top.slice(3)}` : quality + top;
  return { suffix: head + sus + fifth + add + omit, intervals };
}

/** The reading on a chosen root for notes the chord library cannot name there, e.g. A D F# on A: A6sus4(no5). */
function rootedChord(pcs: number[], rootPc: number, bassPc: number, spelling: Spelling): LensChord | null {
  if (pcs.length < 3) return null;
  const shape = rareShape(new Set(pcs.filter((pc) => pc !== rootPc).map((pc) => (pc - rootPc + 12) % 12)));
  if (!shape) return null;
  const rootName = spellPitchClass(rootPc, spelling);
  const tones = shape.intervals.map(([semitones, interval]) => {
    const pc = (rootPc + semitones) % 12;
    const spelled = spelling === "auto" ? Note.transpose(rootName, interval) : "";
    return { pc, interval, name: spelled && !/##|bb/.test(spelled) ? spelled : spellPitchClass(pc, spelling) };
  });
  const bass = bassPc === rootPc ? null : tones.find((tone) => tone.pc === bassPc)?.name ?? null;
  return {
    symbol: rootName + shape.suffix + (bass ? `/${bass}` : ""),
    rootName,
    rootPc,
    suffix: shape.suffix,
    type: "",
    aliases: [],
    notes: [rootName, ...tones.map((tone) => tone.name)],
    intervals: ["1P", ...tones.map((tone) => tone.interval)],
    pcs: [rootPc, ...tones.map((tone) => tone.pc)],
    bassName: bass ?? rootName,
    bassPc,
    slash: Boolean(bass),
    rare: true,
  };
}

/**
 * `rootPc` is the root the user asked for (the first key pressed, or a tone moved to the front). The notes are
 * then read on that root, by rule if the library has no chord there; without it the best-scoring name wins.
 */
export function analyze(midis: number[], override: string | null, spelling: Spelling, rootPc: number | null = null): Analysis {
  const notes = unique(midis).sort((a, b) => a - b);
  const pcs = unique(notes.map((midi) => midi % 12));
  const result: Analysis = { notes, status: "empty", chord: null, candidates: [], tones: [], info: new Map(), bassPc: notes.length ? notes[0] % 12 : null };
  if (!notes.length) return result;

  const candidates = detectChords(notes, spelling === "auto" ? "auto" : spelling);
  let chosen: LensChord | null = null;
  if (override) {
    const typed = parseChordSymbol(override);
    if (typed && matchesNotes(typed, notes)) {
      chosen = typed;
      if (!candidates.some((candidate) => candidate.symbol === typed.symbol)) candidates.unshift(typed);
    }
  }
  if (!chosen && pcs.length > 1) {
    chosen = rootPc !== null && pcs.includes(rootPc)
      ? candidates.find((candidate) => candidate.rootPc === rootPc) ?? rootedChord(pcs, rootPc, pcs[0], spelling)
      : candidates[0] ?? null;
  }
  result.candidates = candidates.map((candidate) => respell(candidate, spelling));

  if (chosen) {
    const chord = respell(chosen, spelling);
    const tones = chord.notes.map((name, index) => ({ pc: pitchClass(name), name, ivl: chord.intervals[index] }));
    if (chord.slash && !tones.some((tone) => tone.pc === chord.bassPc)) {
      tones.unshift({ pc: chord.bassPc, name: chord.bassName, ivl: Interval.distance(chord.rootName, chord.bassName) || "1P" });
    }
    result.status = "chord";
    result.chord = chord;
    result.tones = tones.map((tone) => ({ ...tone, ...intervalInfo(tone.ivl), isBass: tone.pc === chord.bassPc, isRoot: tone.pc === chord.rootPc }));
  } else {
    result.status = pcs.length === 1 ? "single" : pcs.length === 2 ? "interval" : "unknown";
    // Measured from the root the user chose, or from the lowest note when they chose none.
    const base = rootPc !== null && pcs.includes(rootPc) ? rootPc : pcs[0];
    const above = (pc: number) => (pc - base + 12) % 12;
    result.tones = [...pcs].sort((a, b) => above(a) - above(b)).map((pc) => {
      const name = spellPitchClass(pc, spelling);
      const ivl = SIMPLE_INTERVALS[above(pc)];
      const info = intervalInfo(ivl);
      return { pc, name, ivl, ...info, slot: result.status === "unknown" ? "n" : info.slot, isBass: pc === pcs[0], isRoot: pc === base };
    });
  }
  result.tones.forEach((tone) => result.info.set(tone.pc, tone));
  return result;
}

/** The same pitch classes with one of them as root and lowest note, voiced the way a typed chord is. */
export function keysOverRoot(midis: number[], rootPc: number): number[] {
  const pcs = unique(midis.map((midi) => midi % 12));
  if (!pcs.includes(rootPc)) return midis;
  const above = pcs.filter((pc) => pc !== rootPc).sort((a, b) => ((a - rootPc + 12) % 12) - ((b - rootPc + 12) % 12));
  const close = keysFromPitchClasses(rootPc, above);
  const chord = analyze(close, null, "auto", rootPc).chord;
  return chord && !chord.rare ? keysForChord(chord) : close;
}

/** Autocomplete for the search field. Text without a root applies the quality to `currentRoot`. */
export function suggestChords(query: string, currentRoot: string | null): LensChord[] {
  const text = query.trim().replace(/♭/g, "b").replace(/♯/g, "#").replace(/\s+/g, "");
  if (!text) return [];
  const match = text.match(/^([A-Ga-g](?:#{1,2}|b{1,2})?)(.*)$/);
  let root: string;
  let rest: string;
  if (match) {
    root = match[1][0].toUpperCase() + match[1].slice(1);
    rest = match[2];
  } else if (currentRoot) {
    root = currentRoot;
    rest = text;
  } else return [];
  const [suffixQuery, bassQuery] = rest.split("/");
  let bass: string | null = null;
  if (bassQuery) {
    bass = bassQuery[0].toUpperCase() + bassQuery.slice(1);
    if (pitchClass(bass) < 0) return [];
  }
  const results: LensChord[] = [];
  const seen = new Set<string>();
  const push = (suffix: string) => {
    if (results.length >= 8) return;
    const chord = buildChord(root, suffix === "M" ? "" : suffix, bass);
    if (chord && !seen.has(chord.symbol)) {
      seen.add(chord.symbol);
      results.push(chord);
    }
  };
  push(suffixQuery);
  COMMON_SUFFIXES.filter((suffix) => suffix.startsWith(suffixQuery)).forEach(push);
  COMMON_SUFFIXES.filter((suffix) => suffix.toLowerCase().startsWith(suffixQuery.toLowerCase())).forEach(push);
  if (/[一-鿿]/.test(suffixQuery)) Object.keys(CHORD_NAMES_ZH).filter((suffix) => CHORD_NAMES_ZH[suffix].includes(suffixQuery)).forEach(push);
  if (suffixQuery) ChordType.all().forEach((type) => type.aliases.forEach((alias) => { if (alias.startsWith(suffixQuery)) push(alias); }));
  return results;
}
