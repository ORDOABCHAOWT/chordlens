import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, Download, FileAudio, Gauge, Mic, Music2, Pause, Play, Redo2,
  Repeat2, Rewind, Share2, SkipBack, SkipForward, Star,
  Timer, Upload, Volume2,
} from "lucide-react";
import { GuitarDiagram } from "../../components/GuitarDiagram";
import { ScoreSheet } from "../../components/ScoreSheet";
import { Waveform } from "../../components/Waveform";
import { WindowShell } from "../../components/WindowShell";
import { useAppStore } from "../../app/store";
import { chordTypeLabel, describeChord } from "../../music/chords";
import { generateVoicings } from "../../music/voicings";
import type { PickedAudio } from "../../services/audio/filePicker";
import { pickAudio } from "../../services/audio/filePicker";
import { BrowserAnalysisEngine } from "../../services/audio/browserAnalysisEngine";
import { BasicPitchSidecarEngine } from "../../services/audio/basicPitchEngine";
import {
  assertAudioDuration,
  assertSupportedAudioFile,
  MAX_RECORDING_SECONDS,
  probeAudioDuration,
} from "../../services/audio/audioPolicy";
import { saveSong } from "../../services/database";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  const remainder = Math.floor(Math.max(0, seconds) % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function ToolbarButton({ icon: Icon, label, onClick, active = false, selected = false, disabled = false }: { icon: typeof Upload; label: string; onClick?: () => void; active?: boolean; selected?: boolean; disabled?: boolean }) {
  return <button className={`toolbar-item ${active ? "active" : ""} ${selected ? "selected" : ""}`} onClick={onClick} disabled={disabled} aria-pressed={selected || undefined}><Icon size={16} strokeWidth={1.45} /><span>{label}</span></button>;
}

export function TranscribeWindow() {
  const {
    activeSong, chords, selectedChordIndex, waveform, currentTime, duration, isPlaying, volume,
    zoom, audioUrl, analysisStatus, setSelectedChord, setPlayback, setZoom, importSong,
    setTranscription, setAnalysisStatus, updateActiveSong,
  } = useAppStore();
  const [scoreMode, setScoreMode] = useState<"sheet" | "tab">("sheet");
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingDeadlineRef = useRef<number | null>(null);
  const analysisInFlightRef = useRef(false);
  const chunksRef = useRef<Blob[]>([]);
  const playbackDataRef = useRef({ chords, duration, selectedChordIndex, volume });
  const engine = useMemo(() => new BrowserAnalysisEngine(), []);
  const basicPitch = useMemo(() => new BasicPitchSidecarEngine(), []);
  const progress = duration > 0 ? currentTime / duration : 0;
  const waveformProgress = progress;
  const currentChord = chords[selectedChordIndex] ?? chords[0];
  const chordDescription = currentChord ? describeChord(currentChord.symbol) : null;
  const allVoicings = useMemo(() => currentChord ? generateVoicings(currentChord.symbol, currentChord.notes, 12) : [], [currentChord]);
  const voicings = allVoicings.slice(0, 3);

  const clearRecordingDeadline = useCallback(() => {
    if (recordingDeadlineRef.current !== null) window.clearTimeout(recordingDeadlineRef.current);
    recordingDeadlineRef.current = null;
  }, []);

  const releaseMicrophone = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    clearRecordingDeadline();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    recorderRef.current = null;
    chunksRef.current = [];
    releaseMicrophone();
  }, [clearRecordingDeadline, releaseMicrophone]);

  useEffect(() => () => cancelRecording(), [cancelRecording]);

  useEffect(() => {
    playbackDataRef.current = { chords, duration, selectedChordIndex, volume };
  }, [chords, duration, selectedChordIndex, volume]);

  useEffect(() => {
    if (!audioUrl) return;
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audio.volume = playbackDataRef.current.volume;
    audioRef.current = audio;
    const update = () => {
      const current = playbackDataRef.current;
      setPlayback({ currentTime: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : current.duration });
      const chordIndex = current.chords.findIndex((chord) => audio.currentTime >= chord.startTime && audio.currentTime < chord.endTime);
      if (chordIndex >= 0 && chordIndex !== current.selectedChordIndex) setSelectedChord(chordIndex);
    };
    const play = () => setPlayback({ isPlaying: true });
    const pause = () => setPlayback({ isPlaying: false });
    const error = () => {
      setPlayback({ isPlaying: false });
      setAnalysisStatus("Playback failed. Re-import the audio file and try again.");
    };
    const ended = () => setPlayback({ isPlaying: false, currentTime: 0 });
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", update);
    audio.addEventListener("play", play);
    audio.addEventListener("pause", pause);
    audio.addEventListener("error", error);
    audio.addEventListener("ended", ended);
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", update);
      audio.removeEventListener("play", play);
      audio.removeEventListener("pause", pause);
      audio.removeEventListener("error", error);
      audio.removeEventListener("ended", ended);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [audioUrl, setAnalysisStatus, setPlayback, setSelectedChord]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = loopEnabled;
  }, [audioUrl, loopEnabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) {
      setPlayback({ isPlaying: false });
      setAnalysisStatus("This is a demo timeline with no audio attached. Import or record audio to play it.");
      return;
    }
    if (isPlaying) {
      audio.pause();
      return;
    }
    try {
      setAnalysisStatus(null);
      await audio.play();
    } catch {
      setPlayback({ isPlaying: false });
      setAnalysisStatus("Playback could not start. Re-import the audio file and try again.");
    }
  };

  const seek = (time: number) => {
    const next = Math.max(0, Math.min(duration, time));
    if (audioRef.current) audioRef.current.currentTime = next;
    setPlayback({ currentTime: next });
    const index = chords.findIndex((chord) => next >= chord.startTime && next < chord.endTime);
    if (index >= 0) setSelectedChord(index);
  };

  const seekToAdjacentChord = (direction: -1 | 1) => {
    if (!chords.length) return;
    const currentStart = chords[selectedChordIndex]?.startTime ?? 0;
    const targetIndex = direction < 0 && currentTime > currentStart + 1
      ? selectedChordIndex
      : Math.max(0, Math.min(chords.length - 1, selectedChordIndex + direction));
    seek(chords[targetIndex]?.startTime ?? 0);
  };

  const analyzePicked = async (picked: PickedAudio) => {
    if (analysisInFlightRef.current) {
      URL.revokeObjectURL(picked.url);
      setAnalysisStatus("An audio analysis is already running.");
      return;
    }
    analysisInFlightRef.current = true;
    setAnalyzing(true);
    let transferredToPlayer = false;
    const title = picked.file.name.replace(/\.[^.]+$/, "");
    try {
      await assertSupportedAudioFile(picked.file);
      const metadataDuration = picked.file.type.startsWith("audio/webm") ? 0 : await probeAudioDuration(picked.url);
      if (metadataDuration > 0) assertAudioDuration(metadataDuration);
      const song = { id: `${Date.now()}`, title, artist: "Imported Audio", duration: metadataDuration, filePath: picked.path, createdAt: new Date().toISOString() };
      importSong(song, picked.url);
      transferredToPlayer = true;
      setAnalysisStatus("Analyzing locally…");
      const useBasicPitch = picked.path.startsWith("/") && await basicPitch.isAvailable();
      if (useBasicPitch) setAnalysisStatus("Transcribing with Basic Pitch…");
      const result = useBasicPitch
        ? await basicPitch.transcribePath(picked.path)
        : await engine.transcribeAudio(picked.file);
      setTranscription(result.chords, result.waveform, result.duration);
      const completedSong = updateActiveSong({ duration: result.duration, bpm: result.bpm, key: result.key });
      await saveSong(completedSong);
      setAnalysisStatus(`Analyzed ${result.notes.length} note events`);
      window.setTimeout(() => setAnalysisStatus(null), 2600);
    } catch (error) {
      if (!transferredToPlayer) URL.revokeObjectURL(picked.url);
      setAnalysisStatus(error instanceof Error ? `Audio could not be analyzed: ${error.message}` : "Audio could not be analyzed.");
    } finally {
      analysisInFlightRef.current = false;
      setAnalyzing(false);
    }
  };

  const handleImport = async () => {
    try {
      const picked = await pickAudio();
      if (picked) await analyzePicked(picked);
    } catch (error) {
      setAnalysisStatus(error instanceof Error ? `Audio could not be imported: ${error.message}` : "Audio could not be imported.");
    }
  };

  const handleRecord = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        clearRecordingDeadline();
        releaseMicrophone();
        recorderRef.current = null;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        chunksRef.current = [];
        if (!blob.size) return;
        const file = new File([blob], `Recording ${new Date().toLocaleTimeString()}.webm`, { type: recorder.mimeType });
        void analyzePicked({ file, path: file.name, url: URL.createObjectURL(file) });
      };
      recorder.onerror = () => {
        cancelRecording();
        setRecording(false);
        setAnalysisStatus("Recording stopped because the microphone reported an error.");
      };
      recorder.start();
      recordingDeadlineRef.current = window.setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, MAX_RECORDING_SECONDS * 1000);
      setRecording(true);
    } catch {
      cancelRecording();
      setRecording(false);
      setAnalysisStatus("Microphone access was not granted.");
    }
  };

  const exportAnalysis = () => {
    const blob = new Blob([JSON.stringify({ song: activeSong, chords }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${activeSong.title}-chords.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <WindowShell
      className="transcribe-window"
      actions
      titleContent={<button className="workspace-selector"><FileAudio size={15} /> <span>Transcribe</span><ChevronDown size={13} /></button>}
    >
      <div className="transcribe-toolbar">
        <div className="toolbar-actions">
          <ToolbarButton icon={Upload} label={analyzing ? "Analyzing" : "Import"} disabled={analyzing || recording} onClick={() => void handleImport()} />
          <ToolbarButton icon={Mic} label={recording ? "Stop" : "Record"} active={recording} disabled={analyzing} onClick={() => void handleRecord()} />
        </div>
        <div className="music-settings">
          <button className="bpm-setting"><span><strong>{activeSong.bpm ?? 94}</strong><small>♩</small></span></button>
          <button><strong>4/4</strong></button>
          <button>Capo 0 <ChevronDown size={11} /></button>
        </div>
        <div className="toolbar-actions right-actions">
          <ToolbarButton icon={Gauge} label="Metronome" />
          <ToolbarButton icon={Timer} label="Count In" />
          <ToolbarButton icon={Repeat2} label="Loop" selected={loopEnabled} onClick={() => setLoopEnabled((value) => !value)} />
          <ToolbarButton icon={Share2} label="Export" onClick={exportAnalysis} />
          <button className="share-button">Share</button>
        </div>
      </div>

      <div className="transcribe-body">
        <main className="transcribe-canvas">
          <header className="song-header">
            <div><strong>{activeSong.title}</strong><span>{activeSong.artist ?? "Unknown Artist"}</span></div>
            <span className="song-status">
              <span>{analysisStatus ?? `${formatTime(currentTime)} / ${formatTime(duration)}`}</span>
              {!audioUrl && <small>Demo timeline · import or record audio to listen</small>}
            </span>
          </header>
          <section className="waveform-panel">
            <div className="time-ruler">{["0:00", "0:10", "0:20", "0:30", "0:40", "0:50", "1:00"].map((time) => <span key={time}>{time}</span>)}<button>•••</button></div>
            <Waveform peaks={waveform} progress={waveformProgress} onSeek={(value) => seek(value * duration)} />
          </section>
          <div className="chord-timeline">
            {chords.slice(0, 7).map((chord, index) => (
              <button
                key={`${chord.startTime}-${chord.symbol}`}
                className={index === selectedChordIndex ? "active" : ""}
                onClick={() => { setSelectedChord(index); seek(chord.startTime); }}
              >{chord.symbol.replace(/b/g, "♭")}</button>
            ))}
          </div>
          <div className="overview-panel"><Waveform peaks={waveform} progress={waveformProgress} overview onSeek={(value) => seek(value * duration)} /></div>
          <div className="score-toolbar">
            <div className="score-tabs"><button className={scoreMode === "sheet" ? "active" : ""} onClick={() => setScoreMode("sheet")}>Sheet</button><button className={scoreMode === "tab" ? "active" : ""} onClick={() => setScoreMode("tab")}>Tab</button></div>
            <button className="instrument-selector">Guitar <ChevronDown size={11} /></button>
            <button className="tempo-pill"><Music2 size={12} /> {activeSong.bpm ?? 94}</button>
            <div className="zoom-control"><button onClick={() => setZoom(zoom - 10)}>−</button><span>{zoom}%</span><button onClick={() => setZoom(zoom + 10)}>+</button></div>
          </div>
          <section className={`score-panel ${scoreMode === "tab" ? "tab-focus" : ""}`}><ScoreSheet zoom={zoom} /></section>
        </main>

        <aside className="inspector">
          <div className="inspector-top">
            <span className="eyebrow">Chord</span>
            <strong className="inspector-chord">{currentChord?.symbol.replace(/b/g, "♭") ?? "—"}</strong>
            <span className="chord-type">{chordDescription?.type ?? "No chord"}</span>
            <span className="eyebrow notes-label">Notes</span>
            <strong className="chord-notes">{chordDescription?.notes.join(" · ") ?? "—"}</strong>
            {voicings[0] && <GuitarDiagram voicing={voicings[0]} />}
          </div>
          <div className="alternate-section">
            <div className="inspector-row"><span>Alternate Voicings</span><small>3 of {Math.max(3, allVoicings.length)}</small></div>
            <div className="voicing-carousel"><button className="carousel-arrow">‹</button>{voicings.slice(0, 3).map((voicing, index) => <button key={index}><GuitarDiagram voicing={voicing} compact /></button>)}<button className="carousel-arrow">›</button></div>
          </div>
          <div className="function-section">
            <span className="eyebrow">Function</span>
            <strong>{currentChord?.symbol.includes("7") ? "Dominant (V7)" : chordTypeLabel(chordDescription?.type ?? "Major")}</strong>
            <span className="eyebrow key-label">Key</span>
            <strong>{activeSong.key ?? "B♭ Major"}</strong>
            <button className="favorite-button"><Star size={15} /> Add to Favorites</button>
          </div>
        </aside>
      </div>

      <div className="floating-player">
        <div className="player-buttons">
          <button className={loopEnabled ? "active" : ""} aria-label="Loop audio" aria-pressed={loopEnabled} title="Loop audio" onClick={() => setLoopEnabled((value) => !value)}><Repeat2 size={16} /></button>
          <button aria-label="Previous chord" title="Previous chord" onClick={() => seekToAdjacentChord(-1)}><SkipBack size={16} /></button>
          <button aria-label="Rewind 15 seconds" title="Rewind 15 seconds" onClick={() => seek(currentTime - 15)}><Rewind size={17} /></button>
          <button className="play-button" aria-label={isPlaying ? "Pause audio" : "Play audio"} title={audioUrl ? (isPlaying ? "Pause" : "Play") : "Import or record audio to play"} onClick={() => void togglePlayback()}>{isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button>
          <button aria-label="Next chord" title="Next chord" onClick={() => seekToAdjacentChord(1)}><SkipForward size={17} /></button>
          <button aria-label="Forward 15 seconds" title="Forward 15 seconds" onClick={() => seek(currentTime + 15)}><Redo2 size={16} /></button>
          <button aria-label="Export analysis" title="Export analysis" onClick={exportAnalysis}><Download size={15} /></button>
        </div>
        <div className="player-scrub"><span>{formatTime(currentTime)}</span><input aria-label="Playback position" type="range" min="0" max={duration || 1} step="0.1" value={currentTime} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span><Volume2 size={12} /><input aria-label="Playback volume" className="volume-slider" type="range" min="0" max="1" step="0.01" value={volume} onChange={(event) => setPlayback({ volume: Number(event.target.value) })} /></div>
      </div>
    </WindowShell>
  );
}
