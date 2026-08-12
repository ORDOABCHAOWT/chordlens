import { create } from "zustand";
import { persist } from "zustand/middleware";
import { demoChords, demoSongs, demoWaveform } from "../data/demo";
import type { ChordEvent, Song } from "../music/types";

interface AppState {
  songs: Song[];
  activeSong: Song;
  chords: ChordEvent[];
  selectedChordIndex: number;
  waveform: number[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  volume: number;
  zoom: number;
  audioUrl: string | null;
  analysisStatus: string | null;
  chordLabOpen: boolean;
  setSelectedChord: (index: number) => void;
  setPlayback: (updates: Partial<Pick<AppState, "currentTime" | "duration" | "isPlaying" | "volume">>) => void;
  setZoom: (zoom: number) => void;
  setAnalysisStatus: (status: string | null) => void;
  importSong: (song: Song, audioUrl: string) => void;
  updateActiveSong: (updates: Partial<Song>) => Song;
  hydrateSongs: (songs: Song[]) => void;
  setTranscription: (chords: ChordEvent[], waveform: number[], duration: number) => void;
  setChordLabOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(persist((set) => ({
  songs: demoSongs,
  activeSong: demoSongs[0],
  chords: demoChords,
  selectedChordIndex: 0,
  waveform: demoWaveform,
  currentTime: 24,
  duration: 225,
  isPlaying: false,
  volume: 0.72,
  zoom: 100,
  audioUrl: null,
  analysisStatus: null,
  chordLabOpen: true,
  setSelectedChord: (index) => set((state) => ({ selectedChordIndex: Math.max(0, Math.min(index, state.chords.length - 1)) })),
  setPlayback: (updates) => set(updates),
  setZoom: (zoom) => set({ zoom: Math.max(70, Math.min(160, zoom)) }),
  setAnalysisStatus: (analysisStatus) => set({ analysisStatus }),
  importSong: (song, audioUrl) => set((state) => {
    if (state.audioUrl && state.audioUrl !== audioUrl && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(state.audioUrl);
    }
    return { songs: [song, ...state.songs.filter((item) => item.id !== song.id)], activeSong: song, audioUrl, currentTime: 0, duration: song.duration, isPlaying: false };
  }),
  updateActiveSong: (updates) => {
    let updated = demoSongs[0];
    set((state) => {
      updated = { ...state.activeSong, ...updates };
      return { activeSong: updated, songs: state.songs.map((song) => song.id === updated.id ? updated : song) };
    });
    return updated;
  },
  hydrateSongs: (loadedSongs) => set((state) => {
    if (!loadedSongs.length) return state;
    const merged = [...loadedSongs, ...demoSongs.filter((demo) => !loadedSongs.some((song) => song.id === demo.id))];
    const activeSong = merged.find((song) => song.id === state.activeSong.id) ?? merged[0];
    return { songs: merged, activeSong };
  }),
  setTranscription: (chords, waveform, duration) => set({ chords, waveform, duration, selectedChordIndex: 0 }),
  setChordLabOpen: (chordLabOpen) => set({ chordLabOpen }),
}), {
  name: "chordlens-library-v1",
  partialize: (state) => ({ songs: state.songs, activeSong: state.activeSong, volume: state.volume }),
}));
