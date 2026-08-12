use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Read,
    path::PathBuf,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

const MAX_AUDIO_BYTES: u64 = 100 * 1024 * 1024;
const MAX_STDOUT_BYTES: usize = 8 * 1024 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;
const BASIC_PITCH_TIMEOUT: Duration = Duration::from_secs(180);
const PYTHON_CHECK_TIMEOUT: Duration = Duration::from_secs(10);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SongRecord {
    id: String,
    title: String,
    artist: Option<String>,
    duration: f64,
    file_path: String,
    created_at: String,
    bpm: Option<u32>,
    key: Option<String>,
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("chordlens.sqlite3"))
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    Connection::open(database_path(app)?).map_err(|error| error.to_string())
}

fn init_database(app: &AppHandle) -> Result<(), String> {
    open_database(app)?.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         CREATE TABLE IF NOT EXISTS songs (
           id TEXT PRIMARY KEY,
           title TEXT NOT NULL,
           artist TEXT,
           duration REAL NOT NULL,
           file_path TEXT NOT NULL,
           created_at TEXT NOT NULL,
           bpm INTEGER,
           musical_key TEXT
         );
         CREATE TABLE IF NOT EXISTS projects (
           id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS collections (
           id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS project_songs (
           project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
           song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
           PRIMARY KEY(project_id, song_id)
         );
         CREATE TABLE IF NOT EXISTS collection_songs (
           collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
           song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
           PRIMARY KEY(collection_id, song_id)
         );
         CREATE TABLE IF NOT EXISTS transcriptions (
           song_id TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,
           payload_json TEXT NOT NULL,
           updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
         );
         CREATE TABLE IF NOT EXISTS settings (
           key TEXT PRIMARY KEY,
           value_json TEXT NOT NULL
         );",
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_song(app: AppHandle, song: SongRecord) -> Result<(), String> {
    open_database(&app)?.execute(
        "INSERT INTO songs (id, title, artist, duration, file_path, created_at, bpm, musical_key)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, artist=excluded.artist, duration=excluded.duration,
           file_path=excluded.file_path, bpm=excluded.bpm, musical_key=excluded.musical_key",
        params![song.id, song.title, song.artist, song.duration, song.file_path, song.created_at, song.bpm, song.key],
    ).map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn list_songs(app: AppHandle) -> Result<Vec<SongRecord>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection.prepare(
        "SELECT id, title, artist, duration, file_path, created_at, bpm, musical_key
         FROM songs ORDER BY created_at DESC"
    ).map_err(|error| error.to_string())?;
    let rows = statement.query_map([], |row| Ok(SongRecord {
        id: row.get(0)?,
        title: row.get(1)?,
        artist: row.get(2)?,
        duration: row.get(3)?,
        file_path: row.get(4)?,
        created_at: row.get(5)?,
        bpm: row.get(6)?,
        key: row.get(7)?,
    })).map_err(|error| error.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())
}

fn wait_for_child(child: &mut std::process::Child, timeout: Duration) -> Result<std::process::ExitStatus, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait().map_err(|error| error.to_string())? {
            Some(status) => return Ok(status),
            None if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("The audio analysis timed out.".to_string());
            }
            None => thread::sleep(Duration::from_millis(50)),
        }
    }
}

fn check_basic_pitch_available() -> bool {
    let Ok(mut child) = Command::new("python3")
        .args(["-c", "import basic_pitch"])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    else {
        return false;
    };
    wait_for_child(&mut child, PYTHON_CHECK_TIMEOUT)
        .map(|status| status.success())
        .unwrap_or(false)
}

#[tauri::command]
async fn basic_pitch_available() -> bool {
    tauri::async_runtime::spawn_blocking(check_basic_pitch_available)
        .await
        .unwrap_or(false)
}

fn transcription_script(app: &AppHandle) -> Option<PathBuf> {
    let resource = app.path().resource_dir().ok()?.join("engine/basic-pitch/transcribe.py");
    if resource.exists() {
        return Some(resource);
    }
    let development = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../engine/basic-pitch/transcribe.py");
    development.exists().then_some(development)
}

fn validate_audio_path(audio_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(audio_path);
    let metadata = fs::metadata(&path).map_err(|_| "The selected audio file is unavailable.".to_string())?;
    if !metadata.is_file() {
        return Err("The selected audio path is not a regular file.".to_string());
    }
    if metadata.len() == 0 || metadata.len() > MAX_AUDIO_BYTES {
        return Err("Audio files must be between 1 byte and 100 MB.".to_string());
    }
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    if !matches!(extension.as_str(), "mp3" | "wav" | "m4a" | "aac" | "flac" | "webm") {
        return Err("The selected file extension is not a supported audio format.".to_string());
    }
    fs::canonicalize(path).map_err(|_| "The selected audio file could not be resolved.".to_string())
}

struct CapturedOutput {
    bytes: Vec<u8>,
    exceeded_limit: bool,
}

fn read_capped<R: Read>(mut reader: R, limit: usize) -> Result<CapturedOutput, String> {
    let mut bytes = Vec::with_capacity(limit.min(64 * 1024));
    let mut exceeded_limit = false;
    let mut buffer = [0_u8; 16 * 1024];
    loop {
        let count = reader.read(&mut buffer).map_err(|error| error.to_string())?;
        if count == 0 {
            break;
        }
        let remaining = limit.saturating_sub(bytes.len());
        let retained = remaining.min(count);
        bytes.extend_from_slice(&buffer[..retained]);
        exceeded_limit |= retained < count;
    }
    Ok(CapturedOutput { bytes, exceeded_limit })
}

fn run_basic_pitch_blocking(app: AppHandle, audio_path: String) -> Result<String, String> {
    let script = transcription_script(&app).ok_or_else(|| "Basic Pitch adapter was not found".to_string())?;
    let audio_path = validate_audio_path(&audio_path)?;
    let mut child = Command::new("python3")
        .arg(script)
        .arg(audio_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Could not launch Basic Pitch: {error}"))?;

    let stdout = child.stdout.take().ok_or_else(|| "Could not capture Basic Pitch output.".to_string())?;
    let stderr = child.stderr.take().ok_or_else(|| "Could not capture Basic Pitch errors.".to_string())?;
    let stdout_reader = thread::spawn(move || read_capped(stdout, MAX_STDOUT_BYTES));
    let stderr_reader = thread::spawn(move || read_capped(stderr, MAX_STDERR_BYTES));
    let status = wait_for_child(&mut child, BASIC_PITCH_TIMEOUT);
    let stdout = stdout_reader.join().map_err(|_| "Basic Pitch output reader failed.".to_string())??;
    let stderr = stderr_reader.join().map_err(|_| "Basic Pitch error reader failed.".to_string())??;
    let status = status?;

    if stdout.exceeded_limit {
        return Err("Basic Pitch returned more analysis data than ChordLens can safely process.".to_string());
    }
    if status.success() {
        String::from_utf8(stdout.bytes).map_err(|error| error.to_string())
    } else {
        let message = String::from_utf8_lossy(&stderr.bytes).trim().to_string();
        if stderr.exceeded_limit || message.is_empty() {
            Err("Basic Pitch failed while analyzing the selected audio.".to_string())
        } else {
            Err(message)
        }
    }
}

#[tauri::command]
async fn run_basic_pitch(app: AppHandle, audio_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_basic_pitch_blocking(app, audio_path))
        .await
        .map_err(|error| format!("Basic Pitch worker failed: {error}"))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            init_database(app.handle()).map_err(std::io::Error::other)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![basic_pitch_available, run_basic_pitch, save_song, list_songs])
        .run(tauri::generate_context!())
        .expect("error while running ChordLens");
}
