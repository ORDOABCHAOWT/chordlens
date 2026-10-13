import { useState } from "react";
import { Copy, Play, RotateCcw } from "lucide-react";
import { ChordSymbol } from "../../components/ChordSymbol";
import { COMMON_PICKS, chordNameZh, chordTypeEnglish, prettyAccidentals } from "../../music/analysis";
import type { Analysis, Spelling } from "../../music/analysis";
import { explainChord, inversionName } from "../../music/explain";
import { T } from "./strings";
import { ToneCards } from "./ToneCards";

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
  onRootPreview: (pc: number | null) => void;
  onRoot: (pc: number) => void;
}

export function ChordHero({ analysis, spelling, hotPc, onPlay, onCopy, onTone, onName, onPick, onReset, onRootPreview, onRoot }: ChordHeroProps) {
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
        <span className="notes-lead">
          <span className="notes-label">{T.chordTones}</span>
          {tones.length > 1 && <span className="notes-hint">{T.tonesHint}</span>}
        </span>
        <button type="button" className="btn btn-quiet btn-reset" title={T.resetHint} onClick={onReset}>
          <RotateCcw className="ic" aria-hidden="true" /><span>{T.reset}</span>
        </button>
      </div>
      <ToneCards tones={tones} hotPc={hotPc} onTone={onTone} onRootPreview={onRootPreview} onRoot={onRoot} />
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
    const inversion = inversionName(chord, tones);
    const others = candidates.filter((candidate) => candidate.symbol !== chord.symbol).slice(0, 3);
    const explanation = explainChord(chord, tones, spelling);
    const folded = Boolean(explanation.usage || explanation.inversion);
    return (
      <section className="hero" aria-label="当前和弦">
        <div className="hero-top">
          <h1 className={chord.symbol.length > 7 ? "sym sym-long" : "sym"} aria-label={chord.symbol}><ChordSymbol symbol={chord.symbol} /></h1>
          <div className="name">
            <span className="name-main">{chord.rare ? T.rootedOn(prettyAccidentals(chord.rootName)) : chordNameZh(chord)}</span>
            {chord.rare ? <span className="name-alt">{T.rareName}</span> : english && <span className="name-alt">{english}</span>}
            {chord.slash && (
              <span className="name-bass">
                {inversion}<span className={inversion ? "name-bass-note" : undefined}>{inversion && " · "}{T.bassOf(prettyAccidentals(chord.bassName))}</span>
              </span>
            )}
            {others.length > 0 && (
              <span className="name-also" role="group" aria-label={T.otherNames}>
                <span>{chord.rare ? T.moreCommon : T.alsoCalled}</span>
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
  // The notes may still be a chord on another root: the user's choice of root is what left them unnamed.
  const usual = candidates.slice(0, 3);
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
        {status === "unknown" && (
          <>
            <h1 className="sym sym-sm">{T.unknown}</h1>
            {usual.length > 0 ? (
              <p className="name">
                <span className="name-alt">{T.unknownOnRoot(prettyAccidentals(first.name))}</span>
                <span className="name-also" role="group" aria-label={T.otherNames}>
                  <span>{T.moreCommon}</span>
                  {usual.map((candidate) => (
                    <button key={candidate.symbol} type="button" className="chip chip-sm" title={T.switchName(prettyAccidentals(candidate.symbol))} onClick={() => onName(candidate.symbol)}>
                      <ChordSymbol symbol={candidate.symbol} />
                    </button>
                  ))}
                </span>
              </p>
            ) : <p className="lede">{T.unknownHint}</p>}
          </>
        )}
        <div className="actions">{playButton}</div>
      </div>
      <div className="hero-bottom">{toneCards}</div>
    </section>
  );
}
