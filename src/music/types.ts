export interface ChordCandidate {
  symbol: string;
  notes: string[];
  score: number;
  reasons: string[];
  type: string;
}

export interface GuitarVoicing {
  frets: Array<number | "x">;
  fingers?: Array<number | null>;
  /** The index finger across several strings; string numbers count from the low E (1). */
  barre?: {
    fret: number;
    fromString: number;
    toString: number;
  };
  /** A ring or little finger flattened over the last strings of the highest fret. */
  smallBarre?: GuitarVoicing["barre"];
  baseFret: number;
  notes: string[];
  difficulty: number;
  /** A shape the user placed on the fretboard rather than a generated one. */
  custom?: boolean;
}
