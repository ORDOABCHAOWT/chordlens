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
  barre?: {
    fret: number;
    fromString: number;
    toString: number;
  };
  baseFret: number;
  notes: string[];
  difficulty: number;
  /** A shape the user placed on the fretboard rather than a generated one. */
  custom?: boolean;
}
