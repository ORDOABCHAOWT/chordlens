import { memo, useMemo } from "react";

interface WaveformProps {
  peaks: number[];
  progress: number;
  overview?: boolean;
  onSeek?: (progress: number) => void;
}

export const Waveform = memo(function Waveform({ peaks, progress, overview = false, onSeek }: WaveformProps) {
  const count = overview ? 330 : 300;
  const sampled = useMemo(() => Array.from({ length: count }, (_, index) => peaks[Math.floor((index / count) * peaks.length)] ?? 0.1), [peaks, count]);
  const width = 600;
  const height = overview ? 42 : 103;
  const middle = height / 2;
  const waveformPath = useMemo(() => sampled.map((peak, index) => {
    const x = (index / (count - 1)) * width;
    const amplitude = Math.max(1.5, peak * (overview ? 15 : 50));
    return `M${x.toFixed(2)} ${(middle - amplitude).toFixed(2)}V${(middle + amplitude).toFixed(2)}`;
  }).join(""), [count, middle, overview, sampled]);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const seekFromPointer = (clientX: number, target: SVGSVGElement) => {
    if (!onSeek) return;
    const rect = target.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };
  return (
    <svg
      className={`waveform ${overview ? "waveform-overview" : "waveform-main"}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role={onSeek ? "slider" : undefined}
      aria-label={onSeek ? (overview ? "Overview playback position" : "Waveform playback position") : undefined}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(clampedProgress * 100) : undefined}
      tabIndex={onSeek ? 0 : undefined}
      onPointerDown={(event) => {
        if (!onSeek) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        seekFromPointer(event.clientX, event.currentTarget);
      }}
      onPointerMove={(event) => {
        if (!onSeek || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
        seekFromPointer(event.clientX, event.currentTarget);
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onKeyDown={(event) => {
        if (!onSeek || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        if (event.key === "Home") onSeek(0);
        else if (event.key === "End") onSeek(1);
        else onSeek(Math.max(0, Math.min(1, clampedProgress + (event.key === "ArrowRight" ? 0.01 : -0.01))));
      }}
    >
      <path d={waveformPath} className="wave-path" />
      {overview && <rect className="overview-selection" x={4} y={3} width={212} height={height - 6} rx={8} />}
      <line className="playhead" x1={clampedProgress * width} x2={clampedProgress * width} y1={0} y2={overview ? height : 207} />
      {!overview && <circle className="playhead-handle" cx={clampedProgress * width} cy={0} r={4.7} />}
    </svg>
  );
});
