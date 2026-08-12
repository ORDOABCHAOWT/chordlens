export interface NoteEvent {
  pitch: number;
  noteName: string;
  startTime: number;
  endTime: number;
  velocity: number;
  confidence: number;
}

export interface ChordEvent {
  startTime: number;
  endTime: number;
  symbol: string;
  root: string;
  bass?: string;
  notes: string[];
  confidence: number;
}

export interface TranscriptionResult {
  duration: number;
  bpm?: number;
  key?: string;
  notes: NoteEvent[];
  chords: ChordEvent[];
  waveform: number[];
  midiPath?: string;
  musicXmlPath?: string;
}

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
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  duration: number;
  filePath: string;
  artwork?: string;
  createdAt: string;
  bpm?: number;
  key?: string;
}

export interface Project {
  id: string;
  name: string;
  songIds: string[];
}

export interface Collection {
  id: string;
  name: string;
  songIds: string[];
}

export interface TranscriptionEngine {
  readonly id: string;
  readonly name: string;
  isAvailable(): Promise<boolean>;
  transcribeAudio(file: File): Promise<TranscriptionResult>;
}
