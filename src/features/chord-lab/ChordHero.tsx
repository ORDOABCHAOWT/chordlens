import { useState } from "react";
import { Copy, Play, RotateCcw } from "lucide-react";
import { ChordSymbol } from "../../components/ChordSymbol";
import { COMMON_PICKS, chordNameZh, chordTypeEnglish, prettyAccidentals } from "../../music/analysis";
import type { Analysis, Spelling } from "../../music/analysis";
import { explainChord } from "../../music/explain";
import { T } from "./strings";

interface ChordHeroProps {
  analysis: Analysis;
  spelling: Spelling;
  hotPc: number | null;
  onPlay: () => void;
  onCopy: () => void;
  onTone: (pc: number) => void;
  onName: (symbol: string) => void;
  onPick: (symbol: string) => void;
  onReset: () => void;
}

export function ChordHero({ analysis, spelling, hotPc, onPlay, onCopy, onTone, onName, onPick, onReset }: ChordHeroProps) {
  const { status, chord, tones, candidates } = analysis;
  const [usageOpen, setUsageOpen] = useState(false);
  const playButton = (
    <button type="button" className="btn btn-primary" onClick={onPlay}>
      <Play className="ic" fill="currentColor" aria-hidden="true" /><span>{T.play}</span><kbd>{T.space}</kbd>
    </button>
  );
  const toneCards = (
    <div className="notes">
      <div className="notes-head">
        <span className="notes-label">{T.chordTones}</span>
        <button type="button" className="btn btn-quiet btn-reset" title={T.resetHint} onClick={onReset}>
          <RotateCcw className="ic" aria-hidden="true" /><span>{T.reset}</span>
        </button>
      </div>
      <div className="tones" role="group" aria-label={T.chordTones}>
        {tones.map((tone) => (
          <button
            key={tone.pc}
            type="button"
            className={`tone s-${tone.slot}${tone.isRoot ? " is-root" : ""}${hotPc === tone.pc ? " hot" : ""}`}
            data-pc={tone.pc}
            aria-label={T.playTone(prettyAccidentals(tone.name), tone.intervalName)}
            onClick={() => onTone(tone.pc)}
          >
            <span className="tone-deg">{tone.degree}</span>
            <span className="tone-note">{prettyAccidentals(tone.name)}</span>
            <span className="tone-name">{tone.intervalName}</span>
            {tone.isBass && tones.length > 1 && <span className="tone-tag">{T.bass}</span>}
          </button>
        ))}
      </div>
    </div>
  );

  if (status === "empty") {
    return (
      <section className="hero" aria-label="当前和弦">
        <div className="hero-top">
          <h1 className="sym sym-sm">{T.emptyTitle}</h1>
          <p className="lede">{T.emptyHint}</p>
        </div>
        <div className="alts">
          <span className="alts-label">{T.commonChords}</span>
          {COMMON_PICKS.map((symbol) => (
            <button key={symbol} type="button" className="chip" onClick={() => onPick(symbol)}><ChordSymbol symbol={symbol} /></button>
          ))}
        </div>
      </section>
    );
  }

  if (status === "chord" && chord) {
    const english = chordTypeEnglish(chord);
    const others = candidates.filter((candidate) => candidate.symbol !== chord.symbol).slice(0, 3);
    const explanation = explainChord(chord, tones, spelling);
    const folded = Boolean(explanation.usage || explanation.inversion);
    return (
      <section className="hero" aria-label="当前和弦">
        <div className="hero-top">
          <h1 className={chord.symbol.length > 7 ? "sym sym-long" : "sym"} aria-label={chord.symbol}><ChordSymbol symbol={chord.symbol} /></h1>
          <div className="name">
            <span className="name-main">{chordNameZh(chord)}</span>
            {english && <span className="name-alt">{english}</span>}
            {others.length > 0 && (
              <span className="name-also" role="group" aria-label={T.otherNames}>
                <span>{T.alsoCalled}</span>
                {others.map((candidate) => (
                  <button key={candidate.symbol} type="button" className="chip chip-sm" title={T.switchName(prettyAccidentals(candidate.symbol))} onClick={() => onName(candidate.symbol)}>
                    <ChordSymbol symbol={candidate.symbol} />
                  </button>
                ))}
              </span>
            )}
          </div>
          <div className="actions">
            {playButton}
            <button type="button" className="btn" onClick={onCopy}><Copy className="ic" aria-hidden="true" /><span>{T.copy}</span></button>
          </div>
        </div>
        <div className="hero-bottom">
          {toneCards}
          <dl className={`explain${usageOpen ? " open" : ""}`} aria-label={T.explanation}>
            <div className="ex-row"><dt>{T.explainBuild}</dt><dd>{explanation.build}</dd></div>
            {explanation.sound && <div className="ex-row"><dt>{T.explainSound}</dt><dd>{explanation.sound}</dd></div>}
            {explanation.inversion && <div className="ex-row ex-extra"><dt>{T.explainInversion}</dt><dd>{explanation.inversion}</dd></div>}
            {explanation.usage && <div className="ex-row ex-extra"><dt>{T.explainUsage}</dt><dd>{explanation.usage}</dd></div>}
          </dl>
          {folded && (
            <button type="button" className="ex-toggle" aria-expanded={usageOpen} onClick={() => setUsageOpen((open) => !open)}>
              {usageOpen ? T.hideUsage : T.showUsage}
            </button>
          )}
        </div>
      </section>
    );
  }

  const [first, second] = tones;
  return (
    <section className="hero" aria-label="当前和弦">
      <div className="hero-top">
        {status === "single" && <><h1 className="sym"><ChordSymbol symbol={first.name} /></h1><p className="name"><span className="name-main">{T.singleNote}</span></p><p className="lede">{T.singleHint}</p></>}
        {status === "interval" && (
          <>
            <h1 className="sym"><ChordSymbol symbol={first.name} /><span className="cs"><span className="sep">–</span></span><ChordSymbol symbol={second.name} /></h1>
            <p className="name"><span className="name-main">{second.intervalName}</span><span className="name-alt">{T.interval}</span></p>
          </>
        )}
        {status === "unknown" && <><h1 className="sym sym-sm">{T.unknown}</h1><p className="lede">{T.unknownHint}</p></>}
        <div className="actions">{playButton}</div>
      </div>
      <div className="hero-bottom">{toneCards}</div>
    </section>
  );
}
