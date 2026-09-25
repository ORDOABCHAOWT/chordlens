import { useEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { ChevronLeft, ChevronRight, Keyboard, Volume2, VolumeX } from "lucide-react";
import type { LensChord, Spelling } from "../../music/analysis";
import { ChordSearch } from "./ChordSearch";
import type { ChordSearchHandle } from "./ChordSearch";
import { T } from "./strings";

interface ToolbarProps {
  searchRef: Ref<ChordSearchHandle>;
  currentRoot: string | null;
  recents: LensChord[];
  spelling: Spelling;
  sound: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSpelling: (spelling: Spelling) => void;
  onSound: (sound: boolean) => void;
  onPreview: (chord: LensChord | null) => void;
  onCommit: (chord: LensChord) => void;
  onKeepPreview: () => void;
  onSearchDone: () => void;
}

const SPELLINGS: Array<[Spelling, string, string]> = [["auto", T.auto, T.auto], ["sharp", "♯", T.sharps], ["flat", "♭", T.flats]];

export function Toolbar(props: ToolbarProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const help = useRef<HTMLDivElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!helpOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!help.current?.contains(target) && !helpButton.current?.contains(target)) setHelpOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setHelpOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [helpOpen]);

  return (
    <header className="tb" data-tauri-drag-region="deep">
      <div className="tb-left">
        <div className="lights-space" aria-hidden="true" />
        <div className="tbg">
          <button type="button" className="tbb" aria-label={T.back} title={`${T.back}  ⌘Z`} disabled={!props.canUndo} onClick={props.onUndo}><ChevronLeft className="ic" /></button>
          <button type="button" className="tbb" aria-label={T.forward} title={`${T.forward}  ⇧⌘Z`} disabled={!props.canRedo} onClick={props.onRedo}><ChevronRight className="ic" /></button>
        </div>
      </div>
      <ChordSearch
        handleRef={props.searchRef}
        currentRoot={props.currentRoot}
        recents={props.recents}
        spelling={props.spelling}
        onPreview={props.onPreview}
        onCommit={props.onCommit}
        onKeepPreview={props.onKeepPreview}
        onDone={props.onSearchDone}
      />
      <div className="tb-right">
        <div className="seg seg-spell" role="group" aria-label={T.spelling}>
          {SPELLINGS.map(([value, text, label]) => (
            <button key={value} type="button" aria-label={label} aria-pressed={props.spelling === value} onClick={() => props.onSpelling(value)}>{text}</button>
          ))}
        </div>
        <button type="button" className="tbb solo" aria-pressed={props.sound} aria-label={props.sound ? T.soundOn : T.soundOff} title={props.sound ? T.soundOn : T.soundOff} onClick={() => props.onSound(!props.sound)}>
          {props.sound ? <Volume2 className="ic" /> : <VolumeX className="ic" />}
        </button>
        <button ref={helpButton} type="button" className="tbb solo" aria-label={T.shortcuts} title={T.shortcuts} aria-expanded={helpOpen} onClick={() => setHelpOpen((open) => !open)}>
          <Keyboard className="ic" />
        </button>
      </div>
      {helpOpen && (
        <div ref={help} className="pop" role="dialog" aria-label={T.shortcuts}>
          <h3>{T.shortcuts}</h3>
          <dl>
            {T.shortcutList.map(([keys, action]) => (
              <div key={keys} className="pop-row"><dt>{keys}</dt><dd>{action}</dd></div>
            ))}
          </dl>
        </div>
      )}
    </header>
  );
}
