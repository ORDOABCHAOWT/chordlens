import { invoke } from "@tauri-apps/api/core";
import type { Song } from "../music/types";

export async function saveSong(song: Song) {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("save_song", { song });
}

export async function loadSongs(): Promise<Song[]> {
  if (!("__TAURI_INTERNALS__" in window)) return [];
  return invoke<Song[]>("list_songs");
}
