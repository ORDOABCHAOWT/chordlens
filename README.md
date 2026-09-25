# ChordLens

ChordLens is a local macOS chord tool with a Chinese interface. One workspace keeps three views of the same chord in sync: the chord name, a two-octave keyboard and standard-tuning guitar shapes. Change any of them and the other two follow.

- **Type a chord** in the toolbar field (or just start typing A–G). Suggestions complete the name, accept slash chords such as `G/B`, and a bare quality such as `m7` applies to the current root. `esc` restores the chord that was showing before.
- **Click keys** to add or remove notes. The lowest key is the bass, so inversions are named as slash chords (E–G–C → C/E, first inversion).
- **Browse guitar shapes** with ← → or the thumbnails; each shows its position, barre and difficulty, and the TAB can be copied. Use the pencil to place a shape on the fretboard and name it.
- Tones are coloured by function (root, third or sus, fifth, sixth/seventh, tension) in the name, on the keys and on the fretboard; roots are also drawn square.
- Space plays the current shape (a local plucked-string synth), keys sound when added, `[` `]` transpose, and ⌘Z / ⇧⌘Z undo and redo. The keyboard icon in the toolbar lists every shortcut.
- Accidentals follow lead-sheet spelling by default and can be forced to sharps or flats. Light and dark follow the system; the 900 × 650 minimum window shows everything without scrolling.

Library, audio import, recording, transcription and the audio database are no longer part of the app. Nothing is recorded, so no microphone or file permission is needed.

## Development

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm exec playwright install chromium
pnpm test:ui
pnpm test:visual
pnpm tauri build --bundles app
```

The generated bundle is `src-tauri/target/release/bundle/macos/ChordLens.app`. It runs independently of the source checkout. CI runs the chord and interface regressions and builds a macOS artifact. Local builds use ad hoc signing.

The window uses the macOS overlay title bar: the toolbar is the drag region (`data-tauri-drag-region="deep"`, allowed by `core:window:allow-start-dragging`), and the traffic lights sit in its reserved left space.

## Guitar diagrams

Strings run from low E at the left to high E at the right. × means muted, ○ means open. Asus2 defaults to the standard `x02200` shape. Generated positions are checked for complete chord-tone coverage and all pressed frets fit within the four displayed spaces; lower positions are preferred, and slash chords keep only shapes whose lowest string plays the requested bass when such shapes exist. Suggested shapes are heuristics, not a guarantee of comfortable fingering for every player.
