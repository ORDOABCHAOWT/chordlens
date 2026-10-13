# ChordLens

ChordLens is a local macOS chord tool with a Chinese interface. One workspace keeps three views of the same chord in sync: the chord name, a two-octave keyboard and standard-tuning guitar shapes. Change any of them and the other two follow.

- **Type a chord** in the toolbar field (or just start typing A–G). Suggestions complete the name, accept slash chords such as `G/B`, and a bare quality such as `m7` applies to the current root. `esc` restores the chord that was showing before.
- **Click keys** to add or remove notes. The first key you press is the root and the lowest key is the bass: C, then E and G below it, reads C/E (first inversion). Notes that are no chord on that root get a rule name such as A6sus4(no5), with the usual name (D/A) one click away under 更常见.
- **Drag a tone card to the front** to make that note the root. The name, the guitar shapes and the explanation preview the result while the card is held there; `esc` cancels.
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

Strings run from low E at the left to high E at the right. × means muted, ○ means open, and a bar behind the dots is a barre. Every shape contains each chord tone, fits within the four displayed frets and has the chord's bass as its lowest note: the root, or the note after the slash, whenever such shapes exist.

Only shapes a hand can hold are offered. The rules live in `src/music/fingering.ts`:

- Four fingers, one fret each from the lowest fret up. The middle and ring fingers may reach one fret further; the thumb is never used.
- The index finger may lie across the lowest fret, as long as no string under it has to ring open.
- The ring or little finger may flatten over the last strings of the highest fret, as in C9 (`x32333`) or the B♭ barre chord (`x13331`).
- A muted string inside a shape has to sit next to the bass note, whose finger damps it, as in Fmaj7 (`1x221x`).
- Open strings belong to the first three frets; further up the neck only the bass string is left open.

The same rules give the difficulty (容易 / 适中 / 较难). A list starts with the grip most players learn first, open chords and then barre chords, and leaves out a grip that only repeats another with strings left out. The hardest shapes are kept for the standard barre chords. A shape you place yourself is always shown, and marked 手按不到 when no fingering exists for it. The order is a heuristic: how comfortable a shape is still depends on the hand.

## License

MIT, see [LICENSE](LICENSE). The libraries ChordLens is built on are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
