# Security Review: ChordLens

## Scope

Standard offline source audit of the current ChordLens repository, covering application TypeScript/React, Tauri Rust code and capabilities, the Python Basic Pitch adapter, tests, manifests, and lockfiles.

- Scan mode: repository
- Target kind: directory_snapshot
- Target ID: target_sha256_bf9bcf12becdffcba0407391de7aafaeaee78cd48817972b1a85764c9130eecd
- Snapshot digest: codex-security-snapshot/v1:sha256:87ccb564a45df115853e9f565aff918d2d2a6d4d77595be1d99d1fe24d44fb1a
- Inventory strategy: directory
- Included paths: .
- Excluded paths: none
- Runtime or test status: Static source review; no network access or external dependency advisory lookup.
- Artifacts reviewed: src/, src-tauri/src/, src-tauri/tauri.conf.json, src-tauri/capabilities/default.json, engine/basic-pitch/transcribe.py, package.json, pnpm-lock.yaml, src-tauri/Cargo.toml, src-tauri/Cargo.lock, tests/
- Scan context: 在项目开发完成后，对 ChordLens 整个代码仓库进行一轮标准代码安全性审查。

Limitations and exclusions:
- Generated build artifacts and installed dependency bodies were excluded in favor of authoritative source, manifests, and lockfiles.
- No online vulnerability-database query was performed.
- Excluded node_modules/\*\*: Third-party installed dependency bodies; manifests and lockfiles were reviewed, but online advisory lookup was not part of this offline source scan.
- Excluded dist/\*\*, src-tauri/target/\*\*, release/\*\*: Generated build artifacts and packaged copies; authoritative source and packaging configuration were reviewed.
- Excluded src-tauri/gen/\*\*: Generated Tauri schemas; capability configuration was reviewed instead.
- Excluded visual-tests/\*.png, src-tauri/icons/\*\*: Binary visual-regression and icon assets contain no executable application logic.
- Excluded security-audit/\*\*: Prior generated security reports are outputs, not current product source.

### Scan Summary

| Field | Value |
| --- | --- |
| Reportable findings | 6 |
| Severity mix | medium: 2, low: 4 |
| Confidence mix | high: 6 |
| Coverage | complete |
| Validation mode | Independent baseline plus two focused investigations, followed by parent source validation. |

Canonical artifacts: `scan-manifest.json`, `findings.json`, and `coverage.json`. This report is a deterministic projection of those files.

## Threat Model

ChordLens is a local-first, single-user macOS Tauri application. Its principal risks arise when user-selected audio and microphone data cross into renderer media APIs or an optional Python analyzer, when renderer code invokes native commands, and when internal local metadata is persisted or exported.

### Assets

- User-selected local audio files and their filesystem paths
- Microphone audio and capture lifecycle
- Local song library, transcription state, and SQLite database
- Renderer, Python analyzer, and desktop availability
- Privacy of exported metadata

### Trust Boundaries

- Browser or native file picker into the renderer
- Renderer JavaScript across Tauri IPC into Rust commands
- Rust process supervisor into Python, Basic Pitch, librosa, and media decoders
- OS microphone permission into MediaRecorder and application-owned streams
- Internal Song persistence model into portable JSON exports

### Attacker Capabilities

- Supply crafted, compressed, long, high-channel-count, or note-dense audio and persuade the local user to import it
- Trigger rapid or overlapping local UI actions
- Execute JavaScript in the main renderer only after a separate renderer compromise
- Receive an analysis JSON that the user explicitly exports and shares

### Security Objectives

- Bound memory, CPU, process count, decoded work, and output for untrusted media
- Stop every microphone track on stop, error, timeout, ownership loss, and unmount
- Bind native file analysis to explicit user authorization and least privilege
- Prevent stale analysis jobs from corrupting newer song state
- Exclude internal filesystem metadata from ordinary portable exports

### Assumptions

- The application has one local main window, no network service, no remote capability origin, and no multi-user or tenant boundary
- The current React source exposes no HTML/code execution sink and production CSP restricts scripts to self
- Users intentionally choose files and approve microphone access, but selected media and exported-recipient context are untrusted

## Findings

| Finding | Severity | Confidence | Detailed write-up |
| --- | --- | --- | --- |
| [Workspace remount permits overlapping analysis and stale-result corruption](#finding-1) | medium | high | inline below |
| [Concurrent microphone-start requests can orphan a live capture stream](#finding-2) | medium | high | inline below |
| [Native analysis commands lack a global subprocess concurrency limit](#finding-3) | low | high | inline below |
| [Basic Pitch IPC accepts arbitrary renderer-supplied local paths](#finding-4) | low | high | inline below |
| [Accepted audio can exhaust memory and CPU before effective decoded-resource limits apply](#finding-5) | low | high | inline below |
| [Analysis export includes the user's absolute local audio path](#finding-6) | low | high | inline below |

### Confidence Scale

| Label | Meaning |
| --- | --- |
| high | Direct evidence supports the finding with no material unresolved blocker. |
| medium | Evidence supports a plausible issue, but material runtime or reachability proof remains. |
| low | Evidence is incomplete and the item is retained only for explicit follow-up. |

<a id="finding-1"></a>

### [1] Workspace remount permits overlapping analysis and stale-result corruption

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | Component unmount, instance-local refs, uncancelled awaits, unconditional shared-state commits, and update-by-current-active-song are all directly established. |
| Category | concurrency-race |
| CWE | CWE-362 |
| Affected lines | src/features/transcribe/TranscribeWindow.tsx:179-213, src/app/UnifiedApp.tsx:58-61, src/app/store.ts:55-61, src-tauri/src/lib.rs:205-220 |

#### Summary

The analysis single-flight flag belongs to a TranscribeWindow instance; switching workspaces discards it without cancelling the job, allowing a new job whose results can be overwritten by the older completion.

#### Root Cause

Analysis ownership, cancellation, and result identity are scoped to a transient React component instead of an application-level job tied to an immutable song ID.

**Instance-local analysis guard and unconditional commit** — `src/features/transcribe/TranscribeWindow.tsx:179-204`

Unmount discards the guard, while the old async continuation still commits into shared state.

```TypeScript
if (analysisInFlightRef.current) {
  URL.revokeObjectURL(picked.url);
  setAnalysisStatus("An audio analysis is already running.");
  return;
}
analysisInFlightRef.current = true;
...
const result = useBasicPitch
  ? await basicPitch.transcribePath(picked.path)
  : await engine.transcribeAudio(picked.file);
setTranscription(result.chords, result.waveform, result.duration);
const completedSong = updateActiveSong({ duration: result.duration, bpm: result.bpm, key: result.key });
```

**Completion updates whichever song is active** — `src/app/store.ts:55-61`

No originating song ID or job generation is checked before persistence.

```TypeScript
updateActiveSong: (updates) => {
  let updated = demoSongs[0];
  set((state) => {
    updated = { ...state.activeSong, ...updates };
    return { activeSong: updated, songs: state.songs.map((song) => song.id === updated.id ? updated : song) };
  });
  return updated;
},
```

#### Validation

Validated by tracing Import A through an unmount/remount and Import B. The new component starts unlocked; A and B can both finish and mutate the same global state. Existing button disabling only protects a single mounted instance.

#### Dataflow

Slow Import A -\> switch workspace (unmount) -\> return and Import B -\> A finishes later -\> unconditional setTranscription/updateActiveSong modifies B and persists it.

#### Reachability

Reachable with normal workspace buttons and file imports; a deliberately slow input makes ordering reliable.

#### Severity

**Medium** — The race requires user navigation and a second import, but slow analysis makes it practical; it can corrupt the active song's transcription and persisted metadata while multiplying CPU and memory use.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Move analysis ownership to a service/store that survives navigation. Give jobs immutable IDs and originating song IDs, add cancellation and stale-result checks, update songs by explicit ID, and enforce native process-wide concurrency.

Tests:
- Import A, navigate away and back, import B, complete A last, and verify A cannot update B.
- Verify only one browser/native analyzer remains active across workspace remounts.

Preventive controls:
- Per-mounted-window in-flight guard
- Disabled Import and Record controls during the mounted job
- Per-process timeout and output caps

<a id="finding-2"></a>

### [2] Concurrent microphone-start requests can orphan a live capture stream

| Field | Value |
| --- | --- |
| Severity | medium |
| Confidence | high |
| Confidence rationale | The asynchronous gap, delayed recording-state update, singular shared refs, and ref-based cleanup are directly visible in the current source. |
| Category | concurrency-race |
| CWE | CWE-362 |
| Affected lines | src/features/transcribe/TranscribeWindow.tsx:225-258, src/features/transcribe/TranscribeWindow.tsx:68-85 |

#### Summary

Record remains startable while getUserMedia is pending, so overlapping acquisitions overwrite shared refs and can leave an earlier microphone stream recording beyond Stop, timeout, or workspace cleanup.

#### Root Cause

A pending microphone acquisition has no synchronous ownership guard, and resource handlers use shared mutable refs rather than invocation-owned stream and recorder objects.

**Recording state changes only after permission resolves** — `src/features/transcribe/TranscribeWindow.tsx:225-235`

Two activations can both pass the recording check while getUserMedia is pending, then overwrite the same refs.

```TypeScript
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
```

**Cleanup reaches only the last stored stream** — `src/features/transcribe/TranscribeWindow.tsx:68-70`

An earlier acquired stream becomes unreachable after a later request replaces streamRef.

```TypeScript
streamRef.current?.getTracks().forEach((track) => track.stop());
streamRef.current = null;
```

#### Validation

Validated by tracing two calls that enter before setRecording(true); both acquire streams, but only the latest remains reachable through streamRef/recorderRef. Ordinary single-acquisition stop, error, timeout, and unmount cleanup are effective countercontrols.

#### Dataflow

Rapid Record activation -\> two pending getUserMedia calls -\> both resolve -\> later call overwrites refs -\> Stop/unmount stops only latest stream.

#### Reachability

Reachable through the visible Record button before permission resolution; no external compromise is required.

#### Severity

**Medium** — The path requires local interaction and microphone permission, but a rapid double activation is easy and the resulting privacy impact can persist ambient capture despite an apparent stop.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Set a synchronous acquisition-pending guard before awaiting getUserMedia and disable Record while pending. Give each invocation local ownership; stop all tracks immediately if it loses ownership or unmounts, and make callbacks close their captured stream and recorder.

Tests:
- Resolve two deferred getUserMedia promises in both orders and assert every acquired track is stopped.
- Unmount while permission is pending and assert a later-resolving stream is immediately stopped.

Preventive controls:
- OS microphone permission and indicator
- Fifteen-minute timer for the normal single-recorder flow

<a id="finding-3"></a>

### [3] Native analysis commands lack a global subprocess concurrency limit

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Both registered commands independently spawn python3 and no shared state, semaphore, queue, deduplication, or cancellation registry exists. |
| Category | resource-exhaustion |
| CWE | CWE-770 |
| Affected lines | src-tauri/src/lib.rs:137-155, src-tauri/src/lib.rs:205-220, src-tauri/src/lib.rs:240-256 |

#### Summary

basic_pitch_available and run_basic_pitch can each spawn a Python process per IPC call; UI-only serialization does not protect the native trust boundary.

#### Root Cause

Expensive process creation is guarded only by renderer component state and not by native process-wide admission control.

**Every analysis request starts a child** — `src-tauri/src/lib.rs:205-214`

No native shared concurrency gate precedes process creation.

```Rust
fn run_basic_pitch_blocking(app: AppHandle, audio_path: String) -> Result<String, String> {
    let script = transcription_script(&app).ok_or_else(|| "Basic Pitch adapter was not found".to_string())?;
    let audio_path = validate_audio_path(&audio_path)?;
    let mut child = Command::new("python3")
        .arg(script)
        .arg(audio_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
```

**Both process-spawning commands are registered** — `src-tauri/src/lib.rs:247-256`

Renderer code can call native commands directly without passing through the React in-flight guard.

```Rust
tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    ...
    .invoke_handler(tauri::generate_handler![basic_pitch_available, run_basic_pitch, save_song, list_songs])
```

#### Validation

Validated for compromised renderer code, which can directly invoke both commands repeatedly. Per-child timeouts and output caps bound individual processes but not aggregate concurrency.

#### Dataflow

Compromised renderer loops IPC calls -\> each native handler dispatches blocking work -\> each call spawns python3 -\> aggregate processes consume system resources.

#### Reachability

Registered local-window commands are directly callable by renderer JavaScript; no source-backed renderer compromise was found.

#### Severity

**Low** — Many concurrent calls can exhaust CPU, memory, and process resources, but direct abuse requires renderer code execution and every child has a deadline.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Add native shared state with a semaphore or single-job queue for availability and analysis, coalesce availability probes, reject duplicate per-window jobs, and support cancellation.

Tests:
- Fire concurrent IPC requests and assert the configured process cap is never exceeded.
- Verify repeated availability probes are coalesced or cached.

Preventive controls:
- Per-child timeout
- Capped stdout/stderr
- Normal UI single-flight guard

<a id="finding-4"></a>

### [4] Basic Pitch IPC accepts arbitrary renderer-supplied local paths

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The normal picker flow and independent path-taking IPC command are directly connected; no picker token, native allowlist, or authorized-directory check exists. |
| Category | path-authorization |
| CWE | CWE-73 |
| Affected lines | src/services/audio/basicPitchEngine.ts:13-15, src-tauri/src/lib.rs:167-180, src-tauri/src/lib.rs:205-210 |

#### Summary

The native run_basic_pitch command validates path shape, size, extension, and canonicalization but does not prove the path was authorized through the file picker.

#### Root Cause

The custom IPC treats an attacker-controlled path string as sufficient authority, bypassing the dialog-scoped capability model.

**Renderer forwards an unrestricted string** — `src/services/audio/basicPitchEngine.ts:13-15`

The path itself acts as both locator and authorization.

```TypeScript
async transcribePath(path: string): Promise<TranscriptionResult> {
  const json = await invoke<string>("run_basic_pitch", { audioPath: path });
  return JSON.parse(json) as TranscriptionResult;
}
```

**Native validation has no picker authorization** — `src-tauri/src/lib.rs:167-180`

Safety checks do not establish that the user selected this canonical path.

```Rust
fn validate_audio_path(audio_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(audio_path);
    let metadata = fs::metadata(&path).map_err(|_| "The selected audio file is unavailable.".to_string())?;
    ...
    fs::canonicalize(path).map_err(|_| "The selected audio file could not be resolved.".to_string())
}
```

#### Validation

Validated for JavaScript already executing in the local main renderer. It can invoke the command with any user-readable allowed-extension file; the native side does not maintain selection provenance.

#### Dataflow

Compromised main renderer -\> invoke run_basic_pitch with chosen path -\> native metadata/extension checks -\> Python opens canonical path -\> derived analysis returns to renderer.

#### Reachability

The command is registered for the local main window; no independent repository-backed path to renderer code execution was found.

#### Severity

**Low** — A compromised renderer can bypass the picker boundary and analyze user-readable files, but no renderer injection path was found and the command returns derived analysis rather than raw bytes.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Move selection into the native command or issue a short-lived, window-bound opaque token for a canonical path selected by the dialog. Require that token for analysis instead of accepting arbitrary paths.

Tests:
- Invoke run_basic_pitch with a non-authorized supported path and require rejection.
- Verify a picker-issued token is single-window, short-lived, and bound to the canonical file.

Preventive controls:
- Restrictive CSP and no remote capability origins
- Regular-file, byte-size, extension, and canonicalization checks
- Shell-free process arguments

<a id="finding-5"></a>

### [5] Accepted audio can exhaust memory and CPU before effective decoded-resource limits apply

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | Whole-file renderer reads, decodeAudioData before the authoritative duration assertion, full-file Basic Pitch prediction/librosa load, and the absence of decoded-byte or child-memory limits are explicit. |
| Category | resource-exhaustion |
| CWE | CWE-400 |
| Affected lines | src/services/audio/audioPolicy.ts:1-3, src/services/audio/filePicker.ts:40-46, src/services/audio/browserAnalysisEngine.ts:56-68, engine/basic-pitch/transcribe.py:54-64, src-tauri/src/lib.rs:205-223 |

#### Summary

The 100 MB and one-hour policy bounds compressed input and nominal duration but not decoded samples, channels, peak memory, or model work; browser and Python paths fully materialize accepted media.

#### Root Cause

Policy limits compressed bytes and duration but lacks pre-decode decoded-memory/work budgets, chunking, cancellation, and an OS-enforced child memory ceiling.

**Full browser decode precedes decoded-duration enforcement** — `src/services/audio/browserAnalysisEngine.ts:56-62`

Peak decoded allocation has already occurred when duration is checked, and there is no channel/sample/decoded-byte budget.

```TypeScript
async transcribeAudio(file: File): Promise<TranscriptionResult> {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const buffer = await context.decodeAudioData(await file.arrayBuffer());
    assertAudioDuration(buffer.duration);
    const samples = buffer.getChannelData(0);
```

**Basic Pitch and librosa materialize full results** — `engine/basic-pitch/transcribe.py:54-64`

The event cap applies after predict returns its complete collection, and the entire audio is decoded again.

```Python
probed_duration = float(librosa.get_duration(path=str(audio_path)))
...
_, _, raw_events = predict(str(audio_path))
if len(raw_events) > MAX_NOTE_EVENTS:
    ...
samples, sample_rate = librosa.load(str(audio_path), sr=22050, mono=True)
```

#### Validation

Validated for accepted files: one hour of multichannel 48 kHz float PCM can exceed a gigabyte before decoder overhead, and the Python path materializes model results plus a full mono decode. Existing limits reduce but do not eliminate the peak.

#### Dataflow

User selects permitted compressed media -\> renderer copies file -\> browser fully decodes or Python predicts and decodes -\> large memory/CPU is consumed before post-allocation controls can reject.

#### Reachability

Requires explicit local import of crafted or resource-intensive media; no network ingestion exists.

#### Severity

**Low** — A selected file can produce gigabyte-scale decoded allocations and sustained work, but the attack is user-assisted, local, time-bounded on the sidecar path, and affects availability rather than confidentiality or code execution.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Use conservative pre-decode limits on duration, channels, sample rate, estimated PCM bytes, and browser-analysis work. Prefer chunked/worker analysis, apply the metadata check to WebM, support cancellation, and run Basic Pitch with enforceable memory and cumulative event/sample budgets.

Tests:
- Reject metadata whose estimated decoded PCM exceeds the configured budget before decode.
- Verify WebM receives the same pre-decode duration check.
- Exercise a dense synthetic file and confirm child memory/work limits stop it.

Preventive controls:
- 100 MB compressed-byte cap
- One-hour nominal-duration cap
- Header signature validation
- Single mounted-window UI guard
- Python timeout and bounded stdout/stderr

<a id="finding-6"></a>

### [6] Analysis export includes the user's absolute local audio path

| Field | Value |
| --- | --- |
| Severity | low |
| Confidence | high |
| Confidence rationale | The picker returns an absolute native path, importSong stores it as filePath, and exportAnalysis serializes activeSong without projection. |
| Category | information-disclosure |
| CWE | CWE-200 |
| Affected lines | src/services/audio/filePicker.ts:34-46, src/features/transcribe/TranscribeWindow.tsx:193-194, src/features/transcribe/TranscribeWindow.tsx:266-272 |

#### Summary

Export serializes the complete Song object, including the native picker path, so a shared analysis JSON can reveal the account name and directory layout.

#### Root Cause

The export boundary reuses an internal persistence model instead of a dedicated public data-transfer shape.

**Portable export serializes internal Song fields** — `src/features/transcribe/TranscribeWindow.tsx:266-272`

activeSong includes filePath, and no public export projection removes it.

```TypeScript
const exportAnalysis = () => {
  const blob = new Blob([JSON.stringify({ song: activeSong, chords }, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${activeSong.title}-chords.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};
```

**Imported absolute path enters Song** — `src/features/transcribe/TranscribeWindow.tsx:193-194`

In Tauri, picked.path is the absolute path returned by the native dialog.

```TypeScript
const song = { id: `${Date.now()}`, title, artist: "Imported Audio", duration: metadataDuration, filePath: picked.path, createdAt: new Date().toISOString() };
importSong(song, picked.url);
```

#### Validation

Validated for native imports: the absolute dialog path is stored and included verbatim in exported JSON. Browser imports store only the filename, and there is no automatic upload.

#### Dataflow

Native picker absolute path -\> Song.filePath -\> activeSong -\> JSON.stringify export -\> user shares JSON -\> recipient reads local path.

#### Reachability

Reachable through the visible Export controls after a native import and an ordinary file-sharing action.

#### Severity

**Low** — Disclosure requires an explicit user export and subsequent sharing, but absolute paths can contain usernames and sensitive project/client names that recipients do not need.

Additional runtime or deployment evidence could raise or lower this severity.

#### Remediation

Export a dedicated public Song shape that omits filePath and internal-only fields. If path inclusion is needed, make it explicit opt-in with a clear privacy warning.

Tests:
- Export a native-imported song and assert the JSON contains no filePath or absolute local path.
- Verify any path-including export requires explicit confirmation.

Preventive controls:
- User-initiated export only
- No automatic upload or network client

## Reviewed Surfaces

| Surface | Risk Area | Outcome | Notes |
| --- | --- | --- | --- |
| Audio import, header checks, WebAudio decoding, and browser transcription | Untrusted media parsing and resource use | Reported | Validated bounded compressed input but insufficient decoded-memory/work budgeting. |
| Tauri IPC and optional Basic Pitch Python analysis | Native path authorization, process concurrency, and analyzer resource limits | Reported | Shell injection and unbounded pipe capture were rejected; remaining low-risk boundary issues are reported. |
| Microphone permission, MediaRecorder lifecycle, timeout, and teardown | Microphone privacy and resource ownership | Reported | Single-recorder cleanup is effective; concurrent pending acquisitions are not. |
| Cross-workspace analysis ownership and result commits | Concurrency and local data integrity | Reported | Component remount resets the in-flight guard and permits stale commits. |
| Zustand persistence, SQLite commands, and analysis export | Injection, data integrity, and privacy | Reported | SQL injection and prototype pollution were rejected; exported absolute paths remain a privacy issue. |
| React rendering, CSP, remote origins, and script sinks | Renderer compromise and XSS | No issue found | No HTML/code-evaluation sink or remote application origin was found; production CSP restricts scripts to self. |
| Dialog and filesystem plugin capabilities | Least privilege | No issue found | Normal file reads follow dialog selection and the capability is limited to the local main window; custom IPC authorization is covered separately. |
