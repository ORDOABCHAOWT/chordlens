import { memo, type CSSProperties } from "react";

const rows = [
  { measure: 2, chords: ["F7", "B♭", "C7", "Dm"], notes: [65, 67, 69, 64, 62, 64, 67, 65, 67, 64, 62, 60], frets: [8, 10, 8, 7, 8, 7, 9, 8, 10, 5, 7, 5] },
  { measure: 5, chords: ["B♭", "F7", "C7", "F7"], notes: [62, 60, 59, 64, 62, 64, 67, 65, 67, 64, 62, 60], frets: [6, 8, 6, 8, 10, 8, 9, 8, 10, 8, 10, 8] },
];

export const ScoreSheet = memo(function ScoreSheet({ zoom = 100 }: { zoom?: number }) {
  return (
    <div className="score-scroll" style={{ "--score-scale": zoom / 100 } as CSSProperties}>
      <svg className="score-sheet" viewBox="0 0 620 370" role="img" aria-label="Standard notation and guitar tablature">
        {rows.map((row, rowIndex) => {
          const y = 38 + rowIndex * 180;
          return (
            <g key={row.measure}>
              <text x="8" y={y - 10} className="measure-number">{row.measure}</text>
              {row.chords.map((chord, index) => <text key={chord + index} x={73 + index * 145} y={y - 11} className="score-chord">{chord}</text>)}
              {Array.from({ length: 5 }, (_, index) => <line key={`staff-${index}`} x1="12" x2="608" y1={y + index * 8} y2={y + index * 8} className="staff-line" />)}
              <text x="15" y={y + 32} className="treble-clef">𝄞</text>
              <text x="43" y={y + 22} className="time-signature">4</text>
              <text x="43" y={y + 38} className="time-signature">4</text>
              {[12, 205, 350, 495, 608].map((x) => <line key={`bar-${x}`} x1={x} x2={x} y1={y} y2={y + 110} className="bar-line" />)}
              {row.notes.map((pitch, index) => {
                const x = 78 + index * 44;
                const noteY = y + 30 - (pitch - 60) * 2.35;
                return (
                  <g key={`note-${index}`}>
                    <ellipse cx={x} cy={noteY} rx="4.8" ry="3.4" transform={`rotate(-15 ${x} ${noteY})`} className="note-head" />
                    <line x1={x + 4} x2={x + 4} y1={noteY} y2={noteY - 25} className="note-stem" />
                  </g>
                );
              })}
              <text x="23" y={y + 75} className="tab-label">T</text>
              <text x="23" y={y + 87} className="tab-label">A</text>
              <text x="23" y={y + 99} className="tab-label">B</text>
              {Array.from({ length: 6 }, (_, index) => <line key={`tab-${index}`} x1="12" x2="608" y1={y + 67 + index * 8.6} y2={y + 67 + index * 8.6} className="tab-line" />)}
              {row.frets.map((fret, index) => <text key={`fret-${index}`} x={78 + index * 44} y={y + 91 + (index % 3 - 1) * 8.6} textAnchor="middle" className="tab-fret">{fret}</text>)}
            </g>
          );
        })}
      </svg>
    </div>
  );
});
