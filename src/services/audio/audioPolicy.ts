export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_AUDIO_DURATION_SECONDS = 60 * 60;
export const MAX_RECORDING_SECONDS = 15 * 60;

function printableSize(bytes: number) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function assertAudioByteSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error("The selected audio file is empty.");
  if (bytes > MAX_AUDIO_BYTES) {
    throw new Error(`Audio files must be ${printableSize(MAX_AUDIO_BYTES)} or smaller.`);
  }
}

export function isSupportedAudioHeader(header: Uint8Array) {
  const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  const riffWave = text(0, 4) === "RIFF" && text(8, 12) === "WAVE";
  const flac = text(0, 4) === "fLaC";
  const mp3 = text(0, 3) === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
  const mp4Audio = text(4, 8) === "ftyp";
  const aac = header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
  const webm = header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  return riffWave || flac || mp3 || mp4Audio || aac || webm;
}

export async function assertSupportedAudioFile(file: File) {
  assertAudioByteSize(file.size);
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!isSupportedAudioHeader(header)) {
    throw new Error("The selected file does not contain a supported audio format.");
  }
}

export function assertAudioDuration(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("The audio duration could not be read.");
  if (duration > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error("Audio must be one hour or shorter.");
  }
}

export function probeAudioDuration(url: string, timeoutMs = 10_000): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    let timer = 0;
    let settled = false;
    const cleanup = () => {
      window.clearTimeout(timer);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      finish(() => resolve(duration));
    };
    audio.onerror = () => finish(() => reject(new Error("The selected file could not be read as audio.")));
    timer = window.setTimeout(() => finish(() => reject(new Error("Reading audio metadata timed out."))), timeoutMs);
    audio.src = url;
  });
}
