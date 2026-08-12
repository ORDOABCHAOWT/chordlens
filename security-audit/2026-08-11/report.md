# Security Review: ChordLens

## Scope

Standard static security review of the ChordLens product source across the React/TypeScript renderer, Tauri/Rust backend, SQLite integration, audio import and browser analysis, Python Basic Pitch adapter, capabilities, and packaging configuration.

- Scan mode: repository
- Target kind: directory_snapshot
- Target ID: target_sha256_bf9bcf12becdffcba0407391de7aafaeaee78cd48817972b1a85764c9130eecd
- Snapshot digest: codex-security-snapshot/v1:sha256:c1f8e88d0a66e59b5901218013b92b35b213627c3132b9eaf00bbb550b06626d
- Inventory strategy: directory
- Included paths: .
- Excluded paths: none
- Runtime or test status: Static source validation plus the project's previously completed typecheck, lint, unit, browser, Rust, and native-window verification. No hostile media file was executed during the security scan.
- Artifacts reviewed: src/\*\*/\*.ts, src/\*\*/\*.tsx, src-tauri/src/\*\*/\*.rs, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json, src-tauri/Cargo.toml, engine/basic-pitch/transcribe.py, package.json, vite.config.ts, index.html, tests/\*\*/\*.ts
- Scan context: User requested a post-development Codex Security standard scan focused on Tauri trust boundaries, local files, subprocesses, SQLite, audio parsing, and frontend-to-Rust commands.

Limitations and exclusions:
- Third-party dependency vulnerability databases were not queried because this was an offline source scan.
- Generated schemas, compiled targets, bundled app copies, dependency trees, and binary image assets were excluded from manual source review.
- Excluded node_modules/\*\*: Third-party installed dependency sources were outside the offline product-source audit.
- Excluded src-tauri/target/\*\*: Compiled Rust build outputs were not source review targets.
- Excluded dist/\*\*: Generated frontend bundles were covered through their source files.
- Excluded release/\*\*: Bundled application copies duplicate reviewed source/resources and contain compiled artifacts.
- Excluded src-tauri/gen/\*\*: Tauri-generated schemas were treated as generated build metadata.
- Excluded src-tauri/icons/\*\*: Binary and vector application icon assets contain no executable product logic.
- Excluded visual-tests/\*\*: Generated visual regression images and reports contain no executable product logic.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 3 |
| Severity mix | medium: 1, low: 2 |
| Confidence mix | high: 3 |
| Coverage | complete |
| Validation mode | Independent baseline audit and two focused investigations, followed by parent-led source validation and attack-path calibration. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

ChordLens is a single-user, local-first macOS desktop application. Its principal untrusted input is user-selected or recorded audio. Security-sensitive boundaries are the renderer-to-Tauri IPC bridge, file-dialog-to-decoder flow, Rust-to-Python subprocess boundary, microphone permission lifecycle, and local SQLite persistence. No network service, remote navigation source, tenant boundary, or demonstrated renderer script-injection sink exists in the reviewed snapshot.

### Assets

- Application and desktop-session availability
- User microphone privacy
- User-selected local audio and file metadata
- Transcription and chord-analysis integrity
- Local SQLite library integrity

### Trust Boundaries

- User-supplied audio file into Tauri filesystem and browser media decoders
- React renderer into Tauri custom command handlers
- Rust backend into the Python Basic Pitch process and its native media libraries
- Operating-system microphone permission into the mounted transcription UI lifecycle
- Renderer state and song metadata into SQLite persistence

### Attacker Capabilities

- Supply a crafted, oversized, highly compressed, very long, or malformed local audio file and persuade the user to import it
- Influence audio container bytes, decoded duration, and generated event density
- Cause ordinary workspace navigation while recording is active
- No remote code execution, remote content source, or pre-existing renderer compromise is assumed

### Security Objectives

- Bound memory, CPU, subprocess runtime, output size, and concurrency for untrusted media
- Stop microphone capture whenever recording ends, errors, or the owning view unmounts
- Release renderer audio resources on failure and replacement
- Keep SQL grammar, filesystem scope, and process execution independent of untrusted strings
- Prevent untrusted strings from reaching executable HTML or script contexts

### Assumptions

- The application runs as the current desktop user without elevated privileges
- Audio import is user initiated through the native or browser file picker
- The production window loads bundled local content only
- Optional Basic Pitch and librosa installations are local dependencies outside this source review

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Microphone capture can continue after the recording view closes](#finding-1) | medium | high | inline below |
| [Repeated imports leak Blob URLs and failed AudioContexts](#finding-2) | low | high | inline below |
| [Unbounded audio ingestion and analysis can exhaust CPU and memory](#finding-3) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Microphone capture can continue after the recording view closes

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The source stores only MediaRecorder in a ref, stops tracks solely in onstop, provides no unmount/error cleanup, and conditionally unmounts the transcription view when another workspace is selected. |
| Category | privacy-resource-lifecycle |
| CWE | CWE-404 |
| Affected lines | src/features/transcribe/TranscribeWindow.tsx:122-145, src/app/UnifiedApp.tsx:58-62 |

#### Summary

The microphone MediaStream is stored only in a local closure and stopped only by MediaRecorder.onstop, so switching workspaces or failing after stream acquisition can leave capture active without a visible stop control.

#### Root Cause

Microphone ownership is tied to an event-handler closure rather than the component lifecycle, and cleanup is neither idempotent nor invoked from unmount, recorder error, or post-acquisition setup failure paths.

**Tracks are stopped only after explicit recorder stop** — `src/features/transcribe/TranscribeWindow.tsx:122-145`

The MediaStream has no component-level owner or idempotent cleanup; setup failure after acquisition and view unmount bypass onstop.

```typescript
const handleRecord = async () => {
  if (recording) {
    recorderRef.current?.stop();
    setRecording(false);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const file = new File([blob], `Recording ${new Date().toLocaleTimeString()}.webm`, { type: recorder.mimeType });
      void analyzePicked({ file, path: file.name, url: URL.createObjectURL(file) });
    };
    recorder.start();
    setRecording(true);
  } catch {
    setAnalysisStatus("Microphone access was not granted.");
  }
};
```

**Workspace changes unmount the recording view** — `src/app/UnifiedApp.tsx:58-62`

Selecting another workspace removes TranscribeWindow and its stop button while no cleanup effect stops the captured stream.

```typescript
<main className={`unified-workspace workspace-${workspace}`}>
  {workspace === "library" && <LibraryWindow />}
  {workspace === "transcribe" && <TranscribeWindow />}
  {workspace === "chord-lab" && <ChordLabWindow />}
</main>
```

#### Validation

Validated by tracing getUserMedia to the only track.stop call and confirming UnifiedApp conditionally unmounts TranscribeWindow. Explicit Stop reaches onstop, and OS permission/capture indicators exist, but unmount and setup-error paths do not.

Validation method: Static lifecycle and control-flow validation

#### Dataflow

User grants microphone and starts recording -\> stream exists only in handleRecord closure -\> user selects another workspace or MediaRecorder setup fails -\> recording UI disappears or catch executes -\> no application cleanup stops tracks.

#### Reachability

Reachable through normal Record and workspace-switch controls in the unified production window; no separate renderer compromise is required.

#### Severity

**Medium** — Workspace switching is a normal, high-likelihood action and continued ambient microphone capture is a direct privacy impact, although platform permission and capture indicators reduce stealth.

Severity would be lower if the operating system or WebView guarantees immediate capture termination on component unmount; no such control is present in application source.

#### Remediation

Store the MediaStream in a ref and implement one idempotent cleanup routine that stops every track, clears recorder handlers and timers, and resets refs/state. Invoke it on explicit stop, recorder error, setup failure, and component unmount. Add a maximum recording duration.

Tests:
- Start recording, switch to Library, and assert all microphone tracks have readyState ended.
- Simulate MediaRecorder construction failure after getUserMedia and assert the acquired stream is stopped.
- Trigger recorder error and verify cleanup runs exactly once.
- Verify explicit Stop still creates and analyzes the intended recording.

Preventive controls:
- Component-owned MediaStream ref
- Idempotent lifecycle cleanup
- Recorder error handling
- Maximum recording duration

<a id="finding-2"></a>

### [2] Repeated imports leak Blob URLs and failed AudioContexts

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | All object URL creation and revocation sites were traced: export URLs are revoked, but audio import/recording URLs are overwritten without revocation, and AudioContext.close is outside a finally block. |
| Category | resource-leak |
| CWE | CWE-772 |
| Affected lines | src/app/store.ts:49, src/services/audio/browserAnalysisEngine.ts:55-87, src/services/audio/filePicker.ts:29-35, src/features/transcribe/TranscribeWindow.tsx:71-77 |

#### Summary

Import and recording Blob URLs are never revoked when replaced, while AudioContext.close runs only on successful browser analysis, allowing repeated imports or decode failures to retain renderer memory and audio resources.

#### Root Cause

Renderer audio resources lack explicit ownership rules across replacement, failure, and teardown; cleanup is implemented for temporary export URLs but not imported playback URLs or exceptional AudioContext paths.

**Store replaces audio URL without revoking the previous URL** — `src/app/store.ts:49`

The old Blob URL is discarded from state but remains registered and retains its Blob until explicitly revoked or the page ends.

```typescript
importSong: (song, audioUrl) => set((state) => ({ songs: [song, ...state.songs.filter((item) => item.id !== song.id)], activeSong: song, audioUrl, currentTime: 0, duration: song.duration, isPlaying: false })),
```

**AudioContext closes only on successful completion** — `src/services/audio/browserAnalysisEngine.ts:55-87`

Any decode or analysis exception skips close because no try/finally owns the context.

```typescript
async transcribeAudio(file: File): Promise<TranscriptionResult> {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextClass();
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const samples = buffer.getChannelData(0);
  // analysis omitted
  await context.close();
  return { duration: buffer.duration, notes, chords, waveform: waveformPeaks(samples) };
}
```

#### Validation

Validated by enumerating createObjectURL and revokeObjectURL calls and following AudioContext.close. Only the export URL is revoked; imported and recorded audio URLs are not. The analysis context closes only after all awaited work succeeds.

Validation method: Static resource-lifecycle validation

#### Dataflow

Repeated local imports or recordings -\> new Blob URL per item -\> store replacement drops the old string without revokeObjectURL; decode-failing files -\> new AudioContext -\> exception before close.

#### Reachability

Reachable through repeated use of the production Import or Record controls, especially with large or invalid media.

#### Severity

**Low** — The issue requires repeated local actions or large failing files and primarily degrades the current app process, but the source establishes persistent per-page resource retention.

Raise severity if imports become automatic, attacker-triggerable without user interaction, or the application is expected to run unattended for long periods.

#### Remediation

Revoke the previous owned playback Blob URL when replacing it and revoke the current URL on final application teardown after pausing playback. Wrap every AudioContext in try/finally and close it on success and failure.

Tests:
- Import two files and assert revokeObjectURL is called for the first URL exactly once.
- Make decodeAudioData reject and assert AudioContext.close is still awaited.
- Verify export URL cleanup remains intact and current playback remains usable until replacement.

Preventive controls:
- Explicit Blob URL ownership
- Finally-based AudioContext cleanup
- Lifecycle cleanup tests

<a id="finding-3"></a>

### [3] Unbounded audio ingestion and analysis can exhaust CPU and memory

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Direct source traces show whole-file reads and decoding, duration-dependent analysis, unbounded subprocess runtime/output, and no file-size, duration, event-count, timeout, cancellation, or single-flight control. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | src/services/audio/filePicker.ts:23-31, src/services/audio/browserAnalysisEngine.ts:55-87, src/features/transcribe/TranscribeWindow.tsx:96-120, src-tauri/src/lib.rs:127-139, engine/basic-pitch/transcribe.py:44-82 |

#### Summary

A user-assisted oversized, extremely long, or event-dense audio file is read, decoded, analyzed, and serialized without byte, duration, runtime, output, event-count, or concurrency limits across both browser and Basic Pitch paths.

#### Root Cause

The import boundary treats picker filtering as sufficient and applies no centralized resource policy before complete reads, decoder invocation, duration-proportional analysis, subprocess execution, or IPC JSON parsing.

**Desktop import reads the selected file in full** — `src/services/audio/filePicker.ts:23-31`

The extension filter is a picker hint; no byte-size or media validation occurs before the complete file is materialized in renderer memory.

```typescript
const path = await open({
  multiple: false,
  title: "Import Audio",
  filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac"] }],
});
if (!path) return null;
const bytes = await readFile(path);
const name = path.split(/[\\/]/).pop() ?? "Imported audio";
const file = new File([bytes], name);
```

**Browser analysis decodes and processes the complete duration** — `src/services/audio/browserAnalysisEngine.ts:55-65`

The complete compressed input and decoded buffer are retained, and total work grows with decoded duration.

```typescript
async transcribeAudio(file: File): Promise<TranscriptionResult> {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextClass();
  const buffer = await context.decodeAudioData(await file.arrayBuffer());
  const samples = buffer.getChannelData(0);
  const windowSeconds = Math.max(2, Math.min(6, buffer.duration / 28));
  const chords: ChordEvent[] = [];
  const notes: NoteEvent[] = [];

  let windowIndex = 0;
  for (let time = 0; time < buffer.duration; time += windowSeconds) {
```

**Native sidecar waits and buffers without limits** — `src-tauri/src/lib.rs:127-139`

Command::output has no deadline or cancellation path and buffers the child's full stdout and stderr.

```rust
#[tauri::command]
fn run_basic_pitch(app: AppHandle, audio_path: String) -> Result<String, String> {
    let script = transcription_script(&app).ok_or_else(|| "Basic Pitch adapter was not found".to_string())?;
    let output = Command::new("python3")
        .arg(script)
        .arg(audio_path)
        .output()
        .map_err(|error| format!("Could not launch Basic Pitch: {error}"))?;
    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|error| error.to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
```

#### Validation

Validated by tracing a selected file through pickAudio and analyzePicked into either WebAudio or the Python sidecar. File selection is explicit, shell injection is prevented by separate Command arguments, waveform output is capped, and the UI loop yields periodically; none of those controls bound file bytes, decoded duration, predicted events, child runtime/output, or overlapping imports.

Validation method: Static source trace and countercontrol review

#### Dataflow

Attacker-supplied local media -\> user file selection -\> full renderer read -\> full browser decode and duration-dependent analysis, or unrestricted Python prediction/load -\> unbounded result serialization -\> buffered Rust IPC string -\> JSON parsing and UI state.

#### Reachability

Reachable through the production Import control when the user chooses the supplied file; Basic Pitch is selected when available and browser analysis is the fallback.

#### Severity

**Low** — The path requires a user to select attacker-supplied local media and primarily affects availability of the local app; impact can extend to desktop-session pressure, but exploitation is user assisted and recoverable by terminating the app.

Raise severity if files can be opened automatically, arrive through a remote or shared ingestion channel, or the process runs with elevated privileges or on a shared service.

#### Remediation

Enforce documented compressed-size and decoded-duration limits before reading or spawning analysis; validate the actual media header; allow only one active analysis; add cancellation and an elapsed-time/sample budget; cap note events and IPC JSON size; replace unbounded Command::output with a killable child, wall-clock timeout, and bounded stdout/stderr handling; close AudioContext in a finally block.

Tests:
- Reject a file above the compressed-size limit before readFile or subprocess launch.
- Reject or cancel audio above the decoded-duration or elapsed-time budget.
- Verify a second import cannot begin while analysis is active.
- Verify an overlong Basic Pitch process is killed and oversized stdout is rejected.
- Verify AudioContext closes after both successful and failed decode.

Preventive controls:
- Central audio input policy
- Single-flight analysis state
- Subprocess timeout and bounded output
- Decoder duration/sample budget
- Runtime result-shape and event-count validation

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Tauri IPC commands and SQLite persistence | Native command exposure, SQL injection, path handling, database integrity | No issue found | Queries use static SQL and positional parameters; database location is fixed under app data. Arbitrary renderer-path concerns lacked an independently reachable renderer attacker and raw-file exfiltration. |
| Audio picker, renderer ingestion, and browser decoding | Untrusted media parsing and resource exhaustion | Reported | Whole-file reads, decoding, and duration-dependent analysis lack centralized resource bounds. |
| Rust-to-Python Basic Pitch subprocess | Process execution, media parsing, CPU/memory/output bounds | Reported | Shell injection was rejected because arguments are passed without a shell; runtime and output remain unbounded. |
| Microphone capture and MediaRecorder lifecycle | Microphone privacy and resource lifecycle | Reported | Explicit Stop releases tracks, but unmount and setup failure do not. |
| Blob URL and AudioContext ownership | Renderer memory and audio-resource cleanup | Reported | Import URLs are replaced without revocation and failed analysis bypasses AudioContext.close. |
| React rendering, CSP, and remote-content exposure | XSS and native-capability escalation | No issue found | CSP is disabled as defense-in-depth debt, but no remote content source, navigation route, network client, innerHTML/eval sink, or unsafe React rendering path was found. |
| Dialog and filesystem capability scope | Local file confidentiality | No issue found | The normal flow is user initiated and capability is local-window only. The custom Basic Pitch command accepts a path, but no realistic independent attacker route to renderer execution or raw-file disclosure was established. |
| Export, local state, and song metadata | Path traversal, persistent injection, and sensitive-data exposure | No issue found | React escapes strings, export is browser-managed, SQLite uses parameters, and no secrets or network tokens were present. |
