import { assertAudioByteSize } from "./audioPolicy";

export interface PickedAudio {
  file: File;
  path: string;
  url: string;
}

function audioMimeType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "wav") return "audio/wav";
  if (extension === "m4a" || extension === "aac") return "audio/mp4";
  if (extension === "flac") return "audio/flac";
  return "application/octet-stream";
}

function browserPicker(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,.wav,.m4a,.aac,.flac,audio/*";
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.click();
  });
}

export async function pickAudio(): Promise<PickedAudio | null> {
  if ("__TAURI_INTERNALS__" in window) {
    const [{ open }, { readFile, stat }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await open({
      multiple: false,
      title: "Import Audio",
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "m4a", "aac", "flac"] }],
    });
    if (!path) return null;
    const info = await stat(path);
    if (!info.isFile) throw new Error("The selected item is not a regular file.");
    assertAudioByteSize(info.size);
    const bytes = await readFile(path);
    const name = path.split(/[\\/]/).pop() ?? "Imported audio";
    const file = new File([bytes], name, { type: audioMimeType(name) });
    return { file, path, url: URL.createObjectURL(file) };
  }
  const file = await browserPicker();
  if (file) assertAudioByteSize(file.size);
  return file ? { file, path: file.name, url: URL.createObjectURL(file) } : null;
}
