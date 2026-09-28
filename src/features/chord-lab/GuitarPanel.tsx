import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Copy, Pencil } from "lucide-react";
import { GuitarDiagram } from "../../components/GuitarDiagram";
import type { Analysis } from "../../music/analysis";
import type { GuitarVoicing } from "../../music/types";
import { tabText } from "../../music/voicings";
import type { LabelMode } from "./useChordLab";
import { T } from "./strings";

interface GuitarPanelProps {
  analysis: Analysis;
  voicings: GuitarVoicing[];
  index: number;
  labels: LabelMode;
  editing: boolean;
  hotPc: number | null;
  onIndex: (index: number) => void;
  onLabels: (labels: LabelMode) => void;
  onEdit: () => void;
  onDone: () => void;
  onCell: (string: number, fret: number) => void;
  onTop: (string: number) => void;
  onShift: (direction: number) => void;
  onCopyTab: (tab: string) => void;
}

function position(voicing: GuitarVoicing) {
  if (voicing.custom) return T.customShape;
  const start = voicing.baseFret === 1 ? (voicing.frets.some((fret) => fret === 0) ? T.openPosition : T.fromFret(1)) : T.fromFret(voicing.baseFret);
  return voicing.barre ? `${start} · ${T.barre}` : start;
}

export function GuitarPanel(props: GuitarPanelProps) {
  const { analysis, voicings, index, labels, editing, hotPc } = props;
  const voicing = voicings[index] ?? null;
  const thumbs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = thumbs.current;
    const selected = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (row && selected) row.scrollTo({ top: Math.max(0, selected.offsetTop - row.clientHeight / 2 + selected.clientHeight / 2), behavior: "smooth" });
  }, [index, voicings]);

  const head = (
    <div className="gtr-head">
      <h2 className="panel-title">{T.guitar}</h2>
      <div className="seg seg-sm" role="group" aria-label={T.labelMode}>
        <button type="button" aria-pressed={labels === "degree"} onClick={() => props.onLabels("degree")}>{T.byDegree}</button>
        <button type="button" aria-pressed={labels === "note"} onClick={() => props.onLabels("note")}>{T.byNote}</button>
      </div>
      <button type="button" className="icon-btn" aria-pressed={editing} aria-label={T.editShape} title={T.editShape} onClick={editing ? props.onDone : props.onEdit}>
        <Pencil className="ic" />
      </button>
    </div>
  );

  if (editing) {
    return (
      <section className="gtr single" aria-label={T.guitar}>
        {head}
        <div className="dg-wrap">
          <button type="button" className="nav" aria-label={T.shiftDown} onClick={() => props.onShift(-1)}><ChevronLeft className="ic" /></button>
          <div className="dg-box"><GuitarDiagram voicing={voicing} info={analysis.info} labels={labels} hotPc={hotPc} onCell={props.onCell} onTop={props.onTop} /></div>
          <button type="button" className="nav" aria-label={T.shiftUp} onClick={() => props.onShift(1)}><ChevronRight className="ic" /></button>
        </div>
        <div className="edit-bar"><p>{T.editHint}</p><button type="button" className="btn btn-primary" onClick={props.onDone}>{T.done}</button></div>
      </section>
    );
  }

  if (!voicing) {
    return (
      <section className="gtr single" aria-label={T.guitar}>
        {head}
        <div className="dg-wrap"><span /><div className="dg-box"><GuitarDiagram voicing={null} info={analysis.info} /></div><span /></div>
        <p className="g-empty">{analysis.chord ? T.noVoicing : T.noChordForGuitar}</p>
      </section>
    );
  }

  const level = voicing.difficulty <= 7 ? 0 : voicing.difficulty <= 10 ? 1 : 2;
  return (
    <section className={`gtr${voicings.length > 1 ? "" : " single"}`} aria-label={T.guitar}>
      {head}
      <div className="dg-wrap">
        <button type="button" className="nav" aria-label={T.previousVoicing} disabled={index === 0} onClick={() => props.onIndex(index - 1)}><ChevronLeft className="ic" /></button>
        <div className="dg-box"><GuitarDiagram voicing={voicing} info={analysis.info} labels={labels} hotPc={hotPc} /></div>
        <button type="button" className="nav" aria-label={T.nextVoicing} disabled={index >= voicings.length - 1} onClick={() => props.onIndex(index + 1)}><ChevronRight className="ic" /></button>
      </div>
      <div className="v-meta">
        <span className="v-count">{index + 1} / {voicings.length}</span>
        <span>{position(voicing)}</span>
        <span className="v-diff" title={T.difficulty[level]}>
          {[0, 1, 2].map((step) => <i key={step} className={step <= level ? "on" : ""} />)}
          <span>{T.difficulty[level]}</span>
        </span>
        <button type="button" className="tab" title={T.copy} onClick={() => props.onCopyTab(tabText(voicing, true))}>
          {tabText(voicing)}<Copy className="ic" aria-hidden="true" />
        </button>
      </div>
      {voicings.length > 1 && (
        <div className="thumbs" ref={thumbs}>
          {voicings.map((item, itemIndex) => (
            <button key={item.frets.join(",")} type="button" className="thumb" aria-pressed={itemIndex === index} aria-label={T.voicingLabel(itemIndex + 1, tabText(item))} onClick={() => props.onIndex(itemIndex)}>
              <GuitarDiagram voicing={item} info={analysis.info} size="small" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
