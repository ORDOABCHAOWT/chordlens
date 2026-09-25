import { useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { Search } from "lucide-react";
import { ChordSymbol } from "../../components/ChordSymbol";
import { COMMON_PICKS, chordNameZh, parseChordSymbol, prettyAccidentals, respell, suggestChords } from "../../music/analysis";
import type { LensChord, Spelling } from "../../music/analysis";
import { T } from "./strings";

export interface ChordSearchHandle {
  open: (prefill?: string) => void;
}

interface ChordSearchProps {
  handleRef: Ref<ChordSearchHandle>;
  currentRoot: string | null;
  recents: LensChord[];
  spelling: Spelling;
  onPreview: (chord: LensChord | null) => void;
  onCommit: (chord: LensChord) => void;
  onKeepPreview: () => void;
  onDone: () => void;
}

const COMMON = COMMON_PICKS.map(parseChordSymbol).filter((chord): chord is LensChord => Boolean(chord));

export function ChordSearch({ handleRef, currentRoot, recents, spelling, onPreview, onCommit, onKeepPreview, onDone }: ChordSearchProps) {
  const input = useRef<HTMLInputElement>(null);
  const previewing = useRef(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const sections = useMemo(() => {
    if (query.trim()) {
      const found = suggestChords(query, currentRoot);
      return found.length ? [{ title: T.suggestions, items: found }] : [];
    }
    const recent = recents.slice(0, 5);
    const common = COMMON.filter((chord) => !recent.some((item) => item.symbol === chord.symbol));
    return [...(recent.length ? [{ title: T.recent, items: recent }] : []), { title: T.common, items: common }];
  }, [query, currentRoot, recents]);
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);

  const preview = (chord: LensChord | null) => {
    previewing.current = Boolean(chord);
    onPreview(chord);
  };
  const reset = () => {
    setQuery("");
    setHighlight(0);
    setOpen(false);
  };
  const finish = () => {
    reset();
    input.current?.blur();
    onDone();
  };
  const commit = (chord: LensChord | undefined) => {
    previewing.current = false;
    if (chord) onCommit(chord);
    finish();
  };

  useImperativeHandle(handleRef, () => ({
    open: (prefill?: string) => {
      setOpen(true);
      input.current?.focus();
      if (prefill !== undefined) {
        setQuery(prefill);
        setHighlight(0);
        preview(suggestChords(prefill, currentRoot)[0] ?? null);
      }
    },
  }));

  const onChange = (value: string) => {
    setQuery(value);
    setHighlight(0);
    setOpen(true);
    if (!value.trim()) { if (previewing.current) preview(null); return; }
    preview(suggestChords(value, currentRoot)[0] ?? null);
  };

  const move = (direction: number) => {
    if (!items.length) return;
    const next = (highlight + direction + items.length) % items.length;
    setHighlight(next);
    preview(items[next]);
  };

  return (
    <div className="search-wrap">
      <label className="search">
        <Search className="ic" aria-hidden="true" />
        <input
          ref={input}
          id="chord-search"
          type="text"
          role="combobox"
          aria-label={T.searchPlaceholder}
          aria-expanded={open}
          aria-controls="chord-suggestions"
          aria-activedescendant={open && items[highlight] ? `suggestion-${highlight}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={T.searchPlaceholder}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => {
            if (previewing.current) { previewing.current = false; onKeepPreview(); }
            reset();
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
            else if (event.key === "Enter") { event.preventDefault(); commit(items[highlight]); }
            else if (event.key === "Escape") {
              event.preventDefault();
              if (query) { setQuery(""); setHighlight(0); preview(null); }
              else { preview(null); finish(); }
            }
          }}
        />
        <kbd>⌘K</kbd>
      </label>
      {open && (
        <div className="dd" id="chord-suggestions" role="listbox" aria-label={T.suggestions} onMouseDown={(event) => event.preventDefault()}>
          {sections.length === 0 && (
            <div className="dd-empty"><b>{T.noMatch(query.trim())}</b><span>{T.tryHint}</span></div>
          )}
          {sections.map((section) => (
            <div key={section.title} role="group" aria-label={section.title}>
              <div className="dd-sec">{section.title}</div>
              {section.items.map((chord) => {
                const index = items.indexOf(chord);
                const shown = respell(chord, spelling);
                return (
                  <div
                    key={chord.symbol}
                    id={`suggestion-${index}`}
                    role="option"
                    aria-selected={index === highlight}
                    className={`dd-row${index === highlight ? " hl" : ""}`}
                    onMouseMove={() => { if (index !== highlight) setHighlight(index); }}
                    onClick={() => commit(chord)}
                  >
                    <span className="dd-sym"><ChordSymbol symbol={shown.symbol} /></span>
                    <span className="dd-name">{chordNameZh(shown)}{shown.slash ? ` / ${prettyAccidentals(shown.bassName)}` : ""}</span>
                    <span className="dd-notes">{shown.notes.map(prettyAccidentals).join(" ")}</span>
                  </div>
                );
              })}
            </div>
          ))}
          <div className="dd-foot">{T.dropdownFooter.map((hint) => <span key={hint}>{hint}</span>)}</div>
        </div>
      )}
    </div>
  );
}
