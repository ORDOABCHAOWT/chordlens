import { memo } from "react";
import { prettyAccidentals } from "../music/analysis";
import type { Tone } from "../music/analysis";
import type { GuitarVoicing } from "../music/types";
import { STANDARD_TUNING } from "../music/voicings";

const STRING_NAMES = ["E", "A", "D", "G", "B", "E"];
const INLAYS = new Set([3, 5, 7, 9, 15]);

interface GuitarDiagramProps {
  voicing: GuitarVoicing | null;
  info: Map<number, Tone>;
  size?: "large" | "small";
  labels?: "degree" | "note";
  hotPc?: number | null;
  /** Editable diagrams report clicks on a fret cell or above the nut. */
  onCell?: (string: number, fret: number) => void;
  onTop?: (string: number) => void;
}

const LARGE = { width: 250, height: 290, left: 40, gap: 34, top: 50, fret: 46, radius: 13, marker: 26 };
const SMALL = { width: 60, height: 70, left: 10, gap: 8, top: 15, fret: 11.5, radius: 3.7, marker: 7 };

export const GuitarDiagram = memo(function GuitarDiagram({ voicing, info, size = "large", labels = "degree", hotPc = null, onCell, onTop }: GuitarDiagramProps) {
  const large = size === "large";
  const g = large ? LARGE : SMALL;
  const base = voicing?.baseFret ?? 1;
  const gridWidth = g.gap * 5;
  const gridHeight = g.fret * 4;
  const x = (string: number) => g.left + string * g.gap;
  const y = (shownFret: number) => g.top + (shownFret - 0.5) * g.fret;
  const widths = large ? [2.1, 1.8, 1.5, 1.2, 1, 0.9] : [1.1, 1, 0.9, 0.8, 0.7, 0.6];
  const barre = voicing?.barre;
  const barreShown = barre ? barre.fret - base + 1 : 0;
  const editable = Boolean(onCell && onTop);
  const label = voicing ? `吉他指法 ${voicing.frets.join(" ")}${base > 1 ? `，第 ${base} 品起` : ""}` : "空白指板";

  return (
    <svg className={`dg ${large ? "dg-lg" : "dg-sm"}`} viewBox={`0 0 ${g.width} ${g.height}`} role={large ? "img" : undefined} aria-label={large ? label : undefined} aria-hidden={large ? undefined : true}>
      {large && [1, 2, 3, 4].map((shown) => {
        const fret = base + shown - 1;
        if (fret === 12) return [-1, 1].map((side) => <circle key={`inlay-${side}`} className="dg-inlay" cx={g.left + gridWidth / 2 + side * g.gap} cy={y(shown)} r={5} />);
        return INLAYS.has(fret) ? <circle key={`inlay-${shown}`} className="dg-inlay" cx={g.left + gridWidth / 2} cy={y(shown)} r={5} /> : null;
      })}
      {[0, 1, 2, 3, 4].map((line) => line === 0 && base === 1
        ? <rect key="nut" className="dg-nut" x={g.left - 1.5} y={g.top - (large ? 5 : 2.4)} width={gridWidth + 3} height={large ? 6 : 3} rx={large ? 2 : 1} />
        : <line key={`fret-${line}`} className="dg-fret" x1={g.left} y1={g.top + line * g.fret} x2={g.left + gridWidth} y2={g.top + line * g.fret} />)}
      {widths.map((width, string) => <line key={`string-${string}`} className="dg-str" x1={x(string)} y1={g.top} x2={x(string)} y2={g.top + gridHeight} strokeWidth={width} />)}
      {base > 1 && (
        <text className="dg-fn" x={g.left - (large ? 13 : 3)} y={g.top + g.fret / 2} textAnchor="end" dominantBaseline="central">
          {base}{large && <tspan>fr</tspan>}
        </text>
      )}
      {barre && barreShown >= 1 && barreShown <= 4 && (() => {
        const pad = g.radius + (large ? 3 : 1.2);
        const from = x(barre.fromString - 1);
        const to = x(barre.toString - 1);
        return <rect className="dg-barre" x={from - pad} y={y(barreShown) - pad} width={to - from + pad * 2} height={pad * 2} rx={pad} />;
      })()}
      {voicing?.frets.map((fret, string) => {
        const cx = x(string);
        if (fret === "x") {
          const r = large ? 5 : 2.2;
          return <path key={`mark-${string}`} className="dg-mute" d={`M${cx - r} ${g.marker - r}L${cx + r} ${g.marker + r}M${cx + r} ${g.marker - r}L${cx - r} ${g.marker + r}`} />;
        }
        const pc = (STANDARD_TUNING[string] + fret) % 12;
        const tone = info.get(pc);
        const slot = tone?.slot ?? "n";
        const hot = hotPc === pc && tone ? " hot" : "";
        if (fret === 0) return <g key={`mark-${string}`} className={`dg-open s-${slot}${hot}`} data-pc={pc}><circle cx={cx} cy={g.marker} r={large ? 8 : 2.6} /></g>;
        const shown = fret - base + 1;
        if (shown < 1 || shown > 4) return null;
        const cy = y(shown);
        const text = large && tone ? (labels === "degree" ? tone.degree : prettyAccidentals(tone.name)) : "";
        return (
          <g key={`dot-${string}`} className={`dg-dot s-${slot}${hot}`} data-pc={pc}>
            {tone?.isRoot
              ? <rect x={cx - g.radius} y={cy - g.radius} width={g.radius * 2} height={g.radius * 2} rx={large ? 5 : 1.4} />
              : <circle cx={cx} cy={cy} r={g.radius} />}
            {text && <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central">{text}</text>}
          </g>
        );
      })}
      {large && STRING_NAMES.map((name, string) => {
        const fret = voicing?.frets[string] ?? "x";
        const pc = fret === "x" ? -1 : (STANDARD_TUNING[string] + fret) % 12;
        const tone = info.get(pc);
        const text = fret === "x" ? "–" : tone ? (labels === "degree" ? prettyAccidentals(tone.name) : tone.degree) : "";
        return (
          <g key={`name-${string}`}>
            <text className="dg-sname" x={x(string)} y={g.top + gridHeight + 22} textAnchor="middle">{name}</text>
            <text className={fret === "x" ? "dg-sname" : `dg-snote s-${tone?.slot ?? "n"}`} x={x(string)} y={g.top + gridHeight + 42} textAnchor="middle">{text}</text>
          </g>
        );
      })}
      {editable && STRING_NAMES.map((_, string) => (
        <g key={`hit-${string}`}>
          <rect className="dg-hit" data-testid={`string-${string + 1}-top`} x={x(string) - g.gap / 2 + 1} y={g.marker - 14} width={g.gap - 2} height={26} rx={8} onClick={() => onTop?.(string)} />
          {[1, 2, 3, 4].map((shown) => (
            <rect key={shown} className="dg-hit" data-testid={`string-${string + 1}-fret-${base + shown - 1}`} x={x(string) - g.gap / 2 + 1} y={g.top + (shown - 1) * g.fret + 1} width={g.gap - 2} height={g.fret - 2} rx={8} onClick={() => onCell?.(string, base + shown - 1)} />
          ))}
        </g>
      ))}
    </svg>
  );
});
