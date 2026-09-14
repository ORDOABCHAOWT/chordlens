# ChordLens

ChordLens is a local macOS chord tool. It opens directly into Chord Lab, with note-to-chord identification, chord-to-note decomposition, accidental spelling, and standard-tuning guitar diagrams. Library, audio import, recording, transcription, and the audio database are no longer part of the app.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm test:ui
pnpm test:visual
pnpm tauri build --bundles app
```

The generated bundle is `src-tauri/target/release/bundle/macos/ChordLens.app`. It runs independently of the source checkout. CI runs the chord and interface regressions and builds a macOS artifact. Local builds use ad hoc signing; no microphone or file-reading permission is required.

## Guitar diagrams

Strings run from low E at the left to high E at the right. × means muted, ○ means open. Asus2 defaults to the standard `x02200` shape. Generated positions are checked for complete chord-tone coverage and all pressed frets fit within the four displayed spaces. Suggested shapes are heuristics, not a guarantee of comfortable fingering for every player.
