#!/usr/bin/env python3
"""Offline Spotify Basic Pitch adapter for ChordLens.

Install with: python3 -m pip install basic-pitch librosa
The script prints one self-contained TranscriptionResult JSON object to stdout.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path


PITCH_NAMES = ("C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B")
MAX_DURATION_SECONDS = 60 * 60
MAX_NOTE_EVENTS = 100_000


def chord_name(pitches: set[int]) -> tuple[str, str, list[str]]:
    templates = (
        ("", (0, 4, 7)), ("m", (0, 3, 7)), ("7", (0, 4, 7, 10)),
        ("maj7", (0, 4, 7, 11)), ("m7", (0, 3, 7, 10)), ("dim", (0, 3, 6)),
    )
    best: tuple[float, int, str, tuple[int, ...]] | None = None
    for root in range(12):
        for suffix, intervals in templates:
            expected = {(root + interval) % 12 for interval in intervals}
            overlap = len(pitches & expected)
            missing = len(expected - pitches)
            extra = len(pitches - expected)
            score = overlap * 3 - missing * 2 - extra
            if best is None or score > best[0]:
                best = (score, root, suffix, intervals)
    assert best is not None
    _, root, suffix, intervals = best
    notes = [PITCH_NAMES[(root + interval) % 12] for interval in intervals]
    return f"{PITCH_NAMES[root]}{suffix}", PITCH_NAMES[root], notes


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: transcribe.py AUDIO_FILE", file=sys.stderr)
        return 2
    audio_path = Path(sys.argv[1]).expanduser().resolve()
    if not audio_path.is_file():
        print(f"Audio file does not exist: {audio_path}", file=sys.stderr)
        return 2

    import librosa
    from basic_pitch.inference import predict

    probed_duration = float(librosa.get_duration(path=str(audio_path)))
    if not math.isfinite(probed_duration) or probed_duration <= 0 or probed_duration > MAX_DURATION_SECONDS:
        print("Audio must have a valid duration of one hour or less.", file=sys.stderr)
        return 2

    _, _, raw_events = predict(str(audio_path))
    if len(raw_events) > MAX_NOTE_EVENTS:
        print("The transcription contains too many note events.", file=sys.stderr)
        return 2
    samples, sample_rate = librosa.load(str(audio_path), sr=22050, mono=True)
    duration = float(len(samples) / sample_rate)
    note_events = []
    for event in raw_events:
        start, end, pitch, amplitude = event[:4]
        midi_pitch = int(round(pitch))
        note_events.append({
            "pitch": midi_pitch,
            "noteName": PITCH_NAMES[midi_pitch % 12],
            "startTime": float(start),
            "endTime": float(end),
            "velocity": max(1, min(127, int(float(amplitude) * 127))),
            "confidence": float(amplitude),
        })

    window_seconds = max(2.0, min(6.0, duration / 28.0))
    chords = []
    cursor = 0.0
    while cursor < duration:
        end = min(duration, cursor + window_seconds)
        active = [event for event in note_events if event["startTime"] < end and event["endTime"] > cursor]
        weighted = sorted(active, key=lambda event: event["confidence"] * (min(end, event["endTime"]) - max(cursor, event["startTime"])), reverse=True)
        pitch_classes = {event["pitch"] % 12 for event in weighted[:8]}
        symbol, root, chord_notes = chord_name(pitch_classes or {0, 4, 7})
        chords.append({"startTime": cursor, "endTime": end, "symbol": symbol, "root": root, "notes": chord_notes, "confidence": 0.82})
        cursor = end

    block = max(1, math.floor(len(samples) / 520))
    waveform = [max(0.03, min(1.0, float(max(abs(value) for value in samples[index:index + block], default=0.0)))) for index in range(0, len(samples), block)][:520]
    print(json.dumps({"duration": duration, "notes": note_events, "chords": chords, "waveform": waveform}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
