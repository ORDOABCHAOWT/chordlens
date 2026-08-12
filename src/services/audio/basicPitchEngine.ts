import { invoke } from "@tauri-apps/api/core";
import type { TranscriptionResult } from "../../music/types";

export class BasicPitchSidecarEngine {
  readonly id = "basic-pitch-sidecar";
  readonly name = "Spotify Basic Pitch (offline)";

  async isAvailable() {
    if (!("__TAURI_INTERNALS__" in window)) return false;
    return invoke<boolean>("basic_pitch_available").catch(() => false);
  }

  async transcribePath(path: string): Promise<TranscriptionResult> {
    const json = await invoke<string>("run_basic_pitch", { audioPath: path });
    return JSON.parse(json) as TranscriptionResult;
  }
}
