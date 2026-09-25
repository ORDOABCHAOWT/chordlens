import { memo } from "react";
import { PIANO_HIGH, PIANO_LOW, prettyAccidentals, spellPitchClass } from "../../music/analysis";
import type { Analysis, Spelling } from "../../music/analysis";
import { T } from "./strings";

const BLACK = new Set([1, 3, 6, 8, 10]);
// Black keys sit slightly off-centre between their white neighbours, as on a real keyboard.
const NUDGE: Record<number, number> = { 1: -0.12, 3: 0.12, 6: -0.15, 8: 0, 10: 0.15 };
const WHITE_WIDTH = 100 / 14;

const KEYS = (() => {
  const keys: Array<{ midi: number; pc: number; black: boolean; left: number }> = [];
  let whites = 0;
  for (let midi = PIANO_LOW; midi <= PIANO_HIGH; midi += 1) {
    const pc = midi % 12;
    const black = BLACK.has(pc);
    const blackWidth = WHITE_WIDTH * 0.6;
    keys.push({ midi, pc, black, left: black ? whites * WHITE_WIDTH - blackWidth / 2 + NUDGE[pc] * blackWidth : whites * WHITE_WIDTH });
    if (!black) whites += 1;
  }
  return keys;
})();

interface PianoKeysProps {
  analysis: Analysis;
  spelling: Spelling;
  hotPc: number | null;
  onKey: (midi: number) => void;
  onTranspose: (semitones: number) => void;
  onClear: () => void;
}

export const PianoKeys = memo(function PianoKeys({ analysis, spelling, hotPc, onKey, onTranspose, onClear }: PianoKeysProps) {
  const lowest = analysis.notes[0];
  return (
    <section className="dock" aria-label={T.keys}>
      <div className="dock-head">
        <h2 className="panel-title">{T.keys}</h2>
        <p className="dock-hint">{T.keysHint}</p>
        <div className="stepper" role="group" aria-label={T.transpose}>
          <button type="button" aria-label={T.transposeDown} title={`${T.transposeDown}  [`} onClick={() => onTranspose(-1)}>−</button>
          <span>{T.transpose}</span>
          <button type="button" aria-label={T.transposeUp} title={`${T.transposeUp}  ]`} onClick={() => onTranspose(1)}>+</button>
        </div>
        <button type="button" className="btn btn-quiet" onClick={onClear}><span>{T.clear}</span><kbd>⌘⌫</kbd></button>
      </div>
      <div className="piano">
        {KEYS.map((key) => {
          const active = analysis.notes.includes(key.midi);
          const tone = active ? analysis.info.get(key.pc) : undefined;
          const name = prettyAccidentals(tone?.name ?? spellPitchClass(key.pc, spelling));
          const octave = Math.floor(key.midi / 12) - 1;
          const classes = ["k", key.black ? "k-b" : "k-w", `s-${tone?.slot ?? "n"}`, active ? "on" : "", tone?.isRoot ? "root" : "", active && hotPc === key.pc ? "hot" : ""].filter(Boolean).join(" ");
          return (
            <button
              key={key.midi}
              type="button"
              className={classes}
              style={{ left: `${key.left.toFixed(3)}%` }}
              data-pc={key.pc}
              aria-pressed={active}
              aria-label={T.keyLabel(`${name}${octave}`, active, tone?.intervalName ?? "")}
              onClick={() => onKey(key.midi)}
            >
              <span className="k-lab">
                {active ? (
                  <>
                    {key.midi === lowest && analysis.notes.length > 1 && <span className="k-bass">{T.bass}</span>}
                    <span className="k-note">{name}</span>
                    <span className="k-deg">{tone?.degree}</span>
                  </>
                ) : <span className="k-ghost">{name}</span>}
              </span>
              {key.pc === 0 && <span className="k-oct">C{octave}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
});
