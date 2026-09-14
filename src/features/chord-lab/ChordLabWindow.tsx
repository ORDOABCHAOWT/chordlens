import { useEffect, useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { GuitarDiagram } from "../../components/GuitarDiagram";
import { chordTypeLabel, describeChord, detectAndRankChords, displayNote, normalizeNote } from "../../music/chords";
import { generateVoicings } from "../../music/voicings";

const PITCH_OPTIONS = [
  { sharp: "C", flat: "C" },
  { sharp: "C#", flat: "Db" },
  { sharp: "D", flat: "D" },
  { sharp: "D#", flat: "Eb" },
  { sharp: "E", flat: "E" },
  { sharp: "F", flat: "F" },
  { sharp: "F#", flat: "Gb" },
  { sharp: "G", flat: "G" },
  { sharp: "G#", flat: "Ab" },
  { sharp: "A", flat: "A" },
  { sharp: "A#", flat: "Bb" },
  { sharp: "B", flat: "B" },
] as const;

function pitchIndex(note: string) {
  const normalized = normalizeNote(note);
  return PITCH_OPTIONS.findIndex((option) => option.sharp === normalized || option.flat === normalized);
}

export function ChordLabWindow() {
  const [mode, setMode] = useState<"notes" | "chord">("notes");
  const [notes, setNotes] = useState(["F", "A", "C", "Eb"]);
  const [spelling, setSpelling] = useState<"sharp" | "flat">("flat");
  const [chordInput, setChordInput] = useState("F7");
  const [selected, setSelected] = useState(0);

  const ranked = useMemo(() => detectAndRankChords(notes, notes[0]), [notes]);
  const detected = ranked[selected] ?? ranked[0];
  const result = useMemo(() => mode === "notes" ? (detected ? describeChord(detected.symbol) : null) : describeChord(chordInput), [mode, detected, chordInput]);
  const voicings = useMemo(() => result ? generateVoicings(result.symbol, result.notes, 3) : [], [result]);
  const related = useMemo(() => {
    if (!result) return [];
    const root = normalizeNote(result.root);
    return [result.symbol, `${root}maj7`, `${root}m7`]
      .map((symbol) => describeChord(symbol))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [result]);

  const matches = mode === "notes" ? ranked : related;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (mode !== "notes" || document.activeElement?.tagName === "INPUT") return;
      if (event.key === "ArrowDown") setSelected((value) => Math.min(value + 1, Math.max(0, ranked.length - 1)));
      if (event.key === "ArrowUp") setSelected((value) => Math.max(0, value - 1));
      if (event.key === "Backspace" && mode === "notes" && document.activeElement?.tagName !== "INPUT") setNotes((value) => value.slice(0, -1));
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, ranked.length]);

  const removeNote = (index: number) => {
    setNotes((value) => value.filter((_, itemIndex) => itemIndex !== index));
    setSelected(0);
  };

  const togglePitch = (index: number) => {
    setNotes((value) => {
      const existingIndex = value.findIndex((note) => pitchIndex(note) === index);
      if (existingIndex >= 0) return value.filter((_, itemIndex) => itemIndex !== existingIndex);
      return [...value, PITCH_OPTIONS[index][spelling]];
    });
    setSelected(0);
  };

  const changeSpelling = (next: "sharp" | "flat") => {
    setSpelling(next);
    setNotes((value) => value.map((note) => {
      const option = PITCH_OPTIONS[pitchIndex(note)];
      return option ? option[next] : note;
    }));
  };

  return (
    <section className="window-shell chord-lab-window" aria-label="Chord Lab">
      <div className="lab-content">
        <div className="lab-workspace">
          <section className="lab-input-panel" aria-label="Chord input">
            <div className="lab-segmented">
              <button className={mode === "notes" ? "active" : ""} onClick={() => setMode("notes")}>Notes → Chord</button>
              <button className={mode === "chord" ? "active" : ""} onClick={() => setMode("chord")}>Chord → Notes</button>
            </div>
            {mode === "notes" ? (
              <>
                <div className="lab-label selected-notes-label">
                  <div><span>Selected notes</span><small>Click a note to remove it · first note is the bass</small></div>
                  <button className="clear-notes" disabled={!notes.length} onClick={() => { setNotes([]); setSelected(0); }}>Clear all <X size={11} /></button>
                </div>
                <div className="note-chips">
                  {notes.length ? notes.map((note, index) => (
                    <button className={`selected-note-chip ${index === 0 ? "bass" : ""}`} key={`${note}-${index}`} aria-label={`Remove ${displayNote(note)}`} title={`Remove ${displayNote(note)}`} onClick={() => removeNote(index)}>
                      <span>{displayNote(note)}</span>{index === 0 && <small>Bass</small>}<X size={12} />
                    </button>
                  )) : <span className="no-notes">No notes selected</span>}
                </div>
                <div className="note-picker-heading">
                  <span>Add or remove notes</span>
                  <div className="accidental-toggle" aria-label="Accidental spelling">
                    <button className={spelling === "sharp" ? "active" : ""} aria-pressed={spelling === "sharp"} onClick={() => changeSpelling("sharp")}>♯ Sharps</button>
                    <button className={spelling === "flat" ? "active" : ""} aria-pressed={spelling === "flat"} onClick={() => changeSpelling("flat")}>♭ Flats</button>
                  </div>
                </div>
                <div className="note-palette">
                  {PITCH_OPTIONS.map((option, index) => {
                    const active = notes.some((note) => pitchIndex(note) === index);
                    const note = option[spelling];
                    const label = displayNote(note);
                    return (
                      <button key={index} className={active ? "active" : ""} aria-pressed={active} aria-label={`${active ? "Remove" : "Add"} ${label}`} onClick={() => togglePitch(index)}>
                        <span>{label}</span>{active && <Check size={12} strokeWidth={2.4} />}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="lab-label"><span>Enter Chord</span><button onClick={() => setChordInput("")}>Clear&nbsp; <X size={11} /></button></div>
                <div className="chord-entry"><Search size={14} /><input value={chordInput} onChange={(event) => setChordInput(event.target.value)} placeholder="F7" autoFocus /></div>
              </>
            )}
          </section>

          <aside className="lab-preview-panel" aria-label="Chord and guitar preview">
            {result ? (
              <div className="chord-result-card">
                <span className="preview-eyebrow">Detected chord</span>
                <div className="result-copy">
                  <strong>{result.symbol}</strong>
                  <span>{result.type}</span>
                  <small>{result.notes.map(displayNote).join(" · ")}</small>
                  {mode === "chord" && <small className="formula">Formula&nbsp;&nbsp; {result.intervals.join(" · ")}</small>}
                </div>
                {voicings[0] && <div className="guitar-stage"><GuitarDiagram voicing={voicings[0]} /><small>Standard tuning · suggested voicing</small></div>}
              </div>
            ) : <div className="empty-result">{mode === "notes" ? "Select at least two notes" : "Enter a valid chord symbol"}</div>}
          </aside>

          <section className="lab-matches-panel" aria-label="Matching chords">
            <div className="lab-search-label">Search chord</div>
            <div className="lab-search"><Search size={14} /><input aria-label="Search chord" value={mode === "notes" ? result?.symbol ?? "" : chordInput} onChange={(event) => { setMode("chord"); setChordInput(event.target.value); }} /><button aria-label="Clear chord search" onClick={() => { setMode("chord"); setChordInput(""); }}><X size={13} /></button></div>
            <div className="matching-label">{mode === "notes" ? "Matching chords" : "Related chords"}</div>
            <div className="matching-list">
              {matches.map((item, index) => (
                <button key={item.symbol} className={index === (mode === "notes" ? selected : 0) ? "active" : ""} onClick={() => { if (mode === "notes") setSelected(index); else setChordInput(item.symbol); }}>
                  <strong>{item.symbol}</strong><span>{chordTypeLabel(item.type, item.symbol)}</span><small>{item.notes.join(" · ")}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
