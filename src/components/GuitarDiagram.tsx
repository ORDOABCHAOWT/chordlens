import { memo } from "react";
import type { GuitarVoicing } from "../music/types";

interface GuitarDiagramProps {
  voicing: GuitarVoicing;
  compact?: boolean;
  className?: string;
}

export const GuitarDiagram = memo(function GuitarDiagram({ voicing, compact = false, className = "" }: GuitarDiagramProps) {
  const width = compact ? 78 : 126;
  const height = compact ? 86 : 142;
  const left = compact ? 7 : 13;
  const top = compact ? 18 : 34;
  const gridWidth = compact ? 68 : 104;
  const gridHeight = compact ? 58 : 103;
  const stringGap = gridWidth / 5;
  const fretGap = gridHeight / 4;
  const base = voicing.baseFret;
  const displayFret = (value: number) => base > 1 ? value - base + 1 : value;
  const barre = voicing.barre;

  return (
    <svg className={`guitar-diagram ${className}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Guitar voicing ${voicing.frets.join(" ")}`}>
      {voicing.frets.map((fret, index) => (
        <text key={`marker-${index}`} x={left + index * stringGap} y={compact ? 10 : 16} textAnchor="middle" className="diagram-marker">
          {fret === "x" ? "×" : fret === 0 ? "○" : ""}
        </text>
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <line key={`s-${index}`} x1={left + index * stringGap} y1={top} x2={left + index * stringGap} y2={top + gridHeight} className="diagram-line" />
      ))}
      {Array.from({ length: 5 }, (_, index) => (
        <line key={`f-${index}`} x1={left} y1={top + index * fretGap} x2={left + gridWidth} y2={top + index * fretGap} className={index === 0 && base === 1 ? "diagram-nut" : "diagram-line"} />
      ))}
      {base > 1 && <text x={4} y={top + fretGap * 0.75} className="diagram-fret-label">{base}fr</text>}
      {barre && (() => {
        const fret = displayFret(barre.fret);
        if (fret < 1 || fret > 4) return null;
        const y = top + (fret - 0.5) * fretGap;
        const first = Math.min(barre.fromString, barre.toString) - 1;
        const last = Math.max(barre.fromString, barre.toString) - 1;
        return <line x1={left + first * stringGap} y1={y} x2={left + last * stringGap} y2={y} className="diagram-barre" />;
      })()}
      {voicing.frets.map((fret, index) => {
        if (typeof fret !== "number" || fret <= 0) return null;
        const shown = displayFret(fret);
        if (shown < 1 || shown > 4) return null;
        return <circle key={`dot-${index}`} cx={left + index * stringGap} cy={top + (shown - 0.5) * fretGap} r={compact ? 3.7 : 5.2} className="diagram-dot" />;
      })}
      {base > 1 && <text x={left + gridWidth / 2} y={height - 4} textAnchor="middle" className="diagram-base">{base}fr</text>}
    </svg>
  );
});
