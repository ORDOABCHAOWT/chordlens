import { useCallback, useEffect, useRef, useState } from "react";
import { parseChordSymbol, prettyAccidentals } from "../../music/analysis";
import { ChordHero } from "./ChordHero";
import type { ChordSearchHandle } from "./ChordSearch";
import { GuitarPanel } from "./GuitarPanel";
import { PianoKeys } from "./PianoKeys";
import { T } from "./strings";
import { Toolbar } from "./Toolbar";
import { useChordLab } from "./useChordLab";

export function ChordLabWindow() {
  const lab = useChordLab();
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<ChordSearchHandle>(null);
  const [hotPc, setHotPc] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; ms: number } | null>(null);
  const { analysis, voicings, voicingIndex, editing } = lab;

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.ms);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => setToast({ text: `${T.copied}  ${text}`, ms: 1600 }), () => setToast({ text: T.copyFailed, ms: 1600 }));
  }, []);

  // Says what the drop did: a root the notes do not usually have gets a rule name, and the usual one is worth knowing.
  const moveRoot = (pc: number) => {
    const move = lab.setRoot(pc);
    const root = prettyAccidentals(move.root);
    const text = move.rare ? T.rootRare(root, prettyAccidentals(move.common)) : move.symbol ? T.rootMoved(root, prettyAccidentals(move.symbol)) : T.rootOnly(root);
    setToast({ text, ms: 2600 });
  };

  const focusWorkspace = useCallback(() => root.current?.focus({ preventScroll: true }), []);

  // Keyboard-first use. Typing into the search field is left alone; everything else is handled here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const command = event.metaKey || event.ctrlKey;
      const key = event.key;
      if (command && key.toLowerCase() === "k") { event.preventDefault(); search.current?.open(); return; }
      if (inField) return;
      if (command && key.toLowerCase() === "z") { event.preventDefault(); if (event.shiftKey) lab.redo(); else lab.undo(); return; }
      if (command && (key === "Backspace" || key === "Delete")) { event.preventDefault(); lab.clear(); return; }
      if (command || event.altKey) return;
      if (key === "Escape" && editing) { lab.setEditing(false); return; }
      if (key === "/") { event.preventDefault(); search.current?.open(); return; }
      if (/^[a-gA-G]$/.test(key)) { event.preventDefault(); search.current?.open(key.toUpperCase()); return; }
      if (key === " ") {
        if (target?.tagName === "BUTTON" && target !== root.current) return;
        event.preventDefault(); lab.play(); return;
      }
      if (key === "ArrowLeft" || key === "ArrowRight") {
        event.preventDefault();
        const direction = key === "ArrowLeft" ? -1 : 1;
        if (editing) lab.shiftShape(direction); else lab.setVoicingIndex(voicingIndex + direction);
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown") { event.preventDefault(); lab.stepName(key === "ArrowUp" ? -1 : 1); return; }
      if (key === "[" || key === "]") { event.preventDefault(); lab.transpose(key === "[" ? -1 : 1); return; }
      if (key === "Backspace" || key === "Delete") { event.preventDefault(); lab.removeLast(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editing, lab, voicingIndex]);

  const chord = analysis.chord;
  return (
    <div
      ref={root}
      className="app"
      tabIndex={-1}
      onMouseOver={(event) => {
        const element = (event.target as Element).closest("[data-pc]");
        const pc = element ? Number(element.getAttribute("data-pc")) : null;
        setHotPc(pc !== null && analysis.info.has(pc) ? pc : null);
      }}
      onMouseLeave={() => setHotPc(null)}
      onClick={(event) => {
        // Return keyboard focus to the workspace after pointer clicks so Space and the arrows keep working.
        const element = event.target as HTMLElement;
        if (event.detail > 0 && !element.closest("input, .dd")) focusWorkspace();
      }}
    >
      <Toolbar
        searchRef={search}
        currentRoot={chord?.rootName ?? null}
        recents={lab.recents}
        spelling={lab.spelling}
        sound={lab.sound}
        canUndo={lab.canUndo}
        canRedo={lab.canRedo}
        onUndo={lab.undo}
        onRedo={lab.redo}
        onSpelling={lab.setSpelling}
        onSound={lab.setSound}
        onPreview={lab.previewChord}
        onCommit={lab.applyChord}
        onKeepPreview={lab.commitPreview}
        onSearchDone={focusWorkspace}
      />
      <main className="body">
        <ChordHero
          analysis={analysis}
          spelling={lab.spelling}
          hotPc={hotPc}
          onPlay={lab.play}
          onCopy={() => chord && copy(`${prettyAccidentals(chord.symbol)}: ${chord.notes.map(prettyAccidentals).join(" ")}`)}
          onTone={lab.playPitchClass}
          onName={lab.chooseName}
          onPick={(symbol) => { const picked = parseChordSymbol(symbol); if (picked) lab.applyChord(picked); }}
          onReset={lab.clear}
          onRootPreview={lab.previewRoot}
          onRoot={moveRoot}
        />
        <GuitarPanel
          analysis={analysis}
          voicings={voicings}
          index={voicingIndex}
          labels={lab.labels}
          editing={editing}
          hotPc={hotPc}
          onIndex={lab.setVoicingIndex}
          onLabels={lab.setLabels}
          onEdit={lab.startEditing}
          onDone={() => lab.setEditing(false)}
          onCell={lab.placeFinger}
          onTop={lab.toggleOpen}
          onShift={lab.shiftShape}
          onCopyTab={copy}
        />
        <PianoKeys analysis={analysis} spelling={lab.spelling} hotPc={hotPc} onKey={lab.toggleKey} onTranspose={lab.transpose} onClear={lab.clear} />
      </main>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast?.text}</div>
    </div>
  );
}
