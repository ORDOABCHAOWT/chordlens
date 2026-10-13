import { useCallback, useMemo, useReducer, useState } from "react";
import { keyTone, playKeys, pluck, strum } from "../../audio/synth";
import { AUTO_NAMES, PIANO_HIGH, PIANO_LOW, analyze, keysForChord, keysFromPitchClasses, keysOverRoot, parseChordSymbol, spellPitchClass, withBass } from "../../music/analysis";
import type { LensChord, Spelling } from "../../music/analysis";
import type { GuitarVoicing } from "../../music/types";
import { STANDARD_TUNING, generateVoicings, soundingMidis, toVoicing } from "../../music/voicings";

export type Fret = number | "x";
export type LabelMode = "degree" | "note";

/** One undoable state: the keys that sound, the root the user asked for, an optional chosen name, and an optional hand-placed guitar shape. */
export interface ChordDoc {
  notes: number[];
  order: number[];
  override: string | null;
  shape: Fret[] | null;
  /** The first key pressed, or a tone moved to the front; null lets the notes decide. */
  root: number | null;
  symbol: string | null;
}

/** What moving a tone to the front did, for the note shown afterwards. */
export interface RootMove {
  root: string;
  symbol: string;
  /** The reading on this root is a rule name; `common` is what the notes are usually called. */
  rare: boolean;
  common: string;
}

interface History {
  past: ChordDoc[];
  present: ChordDoc;
  future: ChordDoc[];
}

type HistoryAction = { type: "commit"; doc: ChordDoc } | { type: "undo" } | { type: "redo" };

const HISTORY_LIMIT = 120;
const sameDoc = (a: ChordDoc, b: ChordDoc) =>
  [...a.notes].sort().join() === [...b.notes].sort().join() && a.override === b.override && a.root === b.root && String(a.shape) === String(b.shape);

function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === "undo") {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === "redo") {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  if (sameDoc(state.present, action.doc)) return { ...state, present: action.doc };
  return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: action.doc, future: [] };
}

const labelled = (doc: Omit<ChordDoc, "symbol">): ChordDoc => ({ ...doc, symbol: analyze(doc.notes, doc.override, "auto", doc.root).chord?.symbol ?? null });

export function docForChord(chord: LensChord): ChordDoc {
  const notes = keysForChord(chord);
  return { notes, order: notes, override: chord.symbol, shape: null, root: chord.rootPc, symbol: chord.symbol };
}

function docForShape(shape: Fret[]): ChordDoc {
  const midis = soundingMidis(shape).sort((a, b) => a - b);
  const notes = midis.length ? keysFromPitchClasses(midis[0] % 12, [...new Set(midis.map((midi) => midi % 12))]) : [];
  return labelled({ notes, order: notes, override: null, shape, root: null });
}

function docWithRoot(notes: number[], rootPc: number): ChordDoc {
  const keys = keysOverRoot(notes, rootPc);
  return labelled({ notes: keys, order: keys, override: null, shape: null, root: rootPc });
}

const INITIAL = (() => {
  const chord = parseChordSymbol("F7");
  return chord ? docForChord(chord) : { notes: [], order: [], override: null, shape: null, root: null, symbol: null };
})();

const voicingCache = new Map<string, GuitarVoicing[]>();
function voicingsFor(chord: LensChord | null, shape: Fret[] | null): GuitarVoicing[] {
  let list: GuitarVoicing[] = [];
  if (chord) {
    const key = `${chord.pcs.join(",")}|${chord.rootPc}|${chord.bassPc}|${chord.suffix}`;
    const cached = voicingCache.get(key);
    if (cached) list = cached;
    else {
      const notes = chord.pcs.includes(chord.bassPc) ? chord.notes : [...chord.notes, chord.bassName];
      const symbol = AUTO_NAMES[chord.rootPc] + chord.suffix + (chord.slash ? `/${AUTO_NAMES[chord.bassPc]}` : "");
      list = generateVoicings(symbol, notes, 12, { bassPc: chord.bassPc });
      voicingCache.set(key, list);
    }
  }
  if (!shape) return list;
  return [{ ...toVoicing(shape), custom: true }, ...list.filter((voicing) => voicing.frets.join() !== shape.join())];
}

export function useChordLab() {
  const [history, dispatch] = useReducer(historyReducer, { past: [], present: INITIAL, future: [] });
  const [preview, setPreview] = useState<ChordDoc | null>(null);
  const [spelling, setSpelling] = useState<Spelling>("auto");
  const [labels, setLabels] = useState<LabelMode>("degree");
  const [sound, setSound] = useState(true);
  const [editing, setEditing] = useState(false);

  const doc = preview ?? history.present;
  const analysis = useMemo(() => analyze(doc.notes, doc.override, spelling, doc.root), [doc, spelling]);
  const voicings = useMemo(() => voicingsFor(analysis.chord, doc.shape), [analysis.chord, doc.shape]);
  const voicingKey = `${analysis.chord?.symbol ?? ""}|${doc.shape?.join(",") ?? ""}`;
  const [voicingState, setVoicingState] = useState({ key: voicingKey, index: 0 });
  const voicingIndex = voicingState.key === voicingKey ? Math.min(voicingState.index, Math.max(0, voicings.length - 1)) : 0;
  const voicing = voicings[voicingIndex] ?? null;

  const commit = useCallback((next: Omit<ChordDoc, "symbol">) => {
    setPreview(null);
    dispatch({ type: "commit", doc: labelled(next) });
  }, []);
  const present = history.present;

  const recents = useMemo(() => {
    const symbols: string[] = [];
    for (const item of [present, ...[...history.past].reverse()]) {
      if (item.symbol && !symbols.includes(item.symbol)) symbols.push(item.symbol);
      if (symbols.length >= 5) break;
    }
    return symbols.map(parseChordSymbol).filter((chord): chord is LensChord => Boolean(chord));
  }, [present, history.past]);

  const toggleKey = useCallback((midi: number) => {
    setEditing(false);
    const active = present.notes.includes(midi);
    if (!active && sound) keyTone(midi);
    const notes = active ? present.notes.filter((note) => note !== midi) : [...present.notes, midi];
    const order = active ? present.order.filter((note) => note !== midi) : [...present.order, midi];
    // The first key pressed is the root and stays the root while it sounds; after that the earliest key still down takes over.
    const kept = present.root ?? analyze(present.notes, present.override, "auto").chord?.rootPc ?? null;
    const root = kept !== null && notes.some((note) => note % 12 === kept) ? kept : order.length ? order[0] % 12 : null;
    commit({ notes, order, override: null, shape: null, root });
  }, [commit, present, sound]);

  const applyChord = useCallback((chord: LensChord) => {
    setEditing(false);
    commit(docForChord(chord));
  }, [commit]);

  const previewChord = useCallback((chord: LensChord | null) => setPreview(chord ? docForChord(chord) : null), []);
  const commitPreview = useCallback(() => { if (preview) commit(preview); }, [commit, preview]);

  // Choosing a name also chooses its root, so keys added afterwards keep reading the chord that way.
  const chooseName = useCallback((symbol: string) => commit({ ...present, override: symbol, root: parseChordSymbol(symbol)?.rootPc ?? present.root }), [commit, present]);

  /** Shows the notes read on this root, with it lowest, without committing; null puts the real chord back. */
  const previewRoot = useCallback((pc: number | null) => setPreview(pc === null ? null : docWithRoot(present.notes, pc)), [present.notes]);

  const setRoot = useCallback((pc: number): RootMove => {
    setEditing(false);
    const next = docWithRoot(present.notes, pc);
    commit(next);
    if (sound) playKeys(next.notes);
    const view = analyze(next.notes, next.override, spelling, next.root);
    const rare = Boolean(view.chord?.rare);
    return { root: spellPitchClass(pc, spelling), symbol: view.chord?.symbol ?? "", rare, common: rare ? view.candidates[0]?.symbol ?? "" : "" };
  }, [commit, present.notes, sound, spelling]);

  const stepName = useCallback((direction: number) => {
    const { candidates, chord } = analysis;
    if (!chord || candidates.length < 2) return;
    const index = candidates.findIndex((candidate) => candidate.symbol === chord.symbol);
    chooseName(candidates[(index + direction + candidates.length) % candidates.length].symbol);
  }, [analysis, chooseName]);

  const transpose = useCallback((semitones: number) => {
    if (!present.notes.length) return;
    setEditing(false);
    const chord = analysis.chord;
    const moved = chord && withBass(spellPitchClass((chord.rootPc + semitones + 12) % 12, spelling), chord.suffix, (chord.bassPc + semitones + 12) % 12, spelling);
    if (moved) { commit(docForChord(moved)); return; }
    let notes = present.notes.map((note) => note + semitones);
    if (Math.min(...notes) < PIANO_LOW) notes = notes.map((note) => note + 12);
    if (Math.max(...notes) > PIANO_HIGH) notes = notes.map((note) => note - 12);
    commit({ notes, order: notes, override: null, shape: null, root: present.root === null ? null : (present.root + semitones + 12) % 12 });
  }, [analysis.chord, commit, present.notes, present.root, spelling]);

  const clear = useCallback(() => {
    if (!present.notes.length && !present.shape) return;
    setEditing(false);
    commit({ notes: [], order: [], override: null, shape: null, root: null });
  }, [commit, present]);

  const removeLast = useCallback(() => {
    const last = present.order[present.order.length - 1];
    if (last !== undefined) toggleKey(last);
  }, [present.order, toggleKey]);

  const undo = useCallback(() => { setPreview(null); setEditing(false); dispatch({ type: "undo" }); }, []);
  const redo = useCallback(() => { setPreview(null); setEditing(false); dispatch({ type: "redo" }); }, []);

  const startEditing = useCallback(() => {
    const shape = voicing ? [...voicing.frets] : ["x", 3, 2, 0, 1, 0] as Fret[];
    setEditing(true);
    commit(docForShape(shape));
  }, [commit, voicing]);

  const editShape = useCallback((change: (shape: Fret[]) => Fret[], ring?: number) => {
    if (!present.shape) return;
    commit(docForShape(change([...present.shape])));
    if (sound && ring !== undefined) pluck(ring);
  }, [commit, present.shape, sound]);

  const placeFinger = useCallback((string: number, fret: number) => {
    const next = present.shape?.[string] === fret ? 0 : fret;
    editShape((shape) => { shape[string] = next; return shape; }, STANDARD_TUNING[string] + next);
  }, [editShape, present.shape]);

  const toggleOpen = useCallback((string: number) => {
    const next: Fret = present.shape?.[string] === "x" ? 0 : "x";
    editShape((shape) => { shape[string] = next; return shape; }, next === 0 ? STANDARD_TUNING[string] : undefined);
  }, [editShape, present.shape]);

  const shiftShape = useCallback((direction: number) => {
    const pressed = (present.shape ?? []).filter((fret): fret is number => typeof fret === "number" && fret > 0);
    if (!pressed.length || Math.min(...pressed) + direction < 1 || Math.max(...pressed) + direction > 15) return;
    editShape((shape) => shape.map((fret) => typeof fret === "number" && fret > 0 ? fret + direction : fret));
  }, [editShape, present.shape]);

  const play = useCallback(() => {
    if (!sound) return;
    if (voicing) strum(soundingMidis(voicing.frets));
    else playKeys(analysis.notes);
  }, [analysis.notes, sound, voicing]);

  const playPitchClass = useCallback((pc: number) => {
    if (!sound) return;
    keyTone(analysis.notes.find((note) => note % 12 === pc) ?? 60 + pc);
  }, [analysis.notes, sound]);

  return {
    doc, analysis, voicings, voicing, voicingIndex, recents, spelling, labels, sound, editing,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    setVoicingIndex: (index: number) => setVoicingState({ key: voicingKey, index: Math.max(0, Math.min(voicings.length - 1, index)) }),
    setSpelling, setLabels, setSound, setEditing,
    toggleKey, applyChord, previewChord, commitPreview, chooseName, previewRoot, setRoot, stepName, transpose, clear, removeLast, undo, redo,
    startEditing, placeFinger, toggleOpen, shiftShape, play, playPitchClass,
  };
}

export type ChordLab = ReturnType<typeof useChordLab>;
