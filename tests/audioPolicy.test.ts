import { describe, expect, it } from "vitest";
import {
  assertAudioByteSize,
  assertAudioDuration,
  isSupportedAudioHeader,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_SECONDS,
} from "../src/services/audio/audioPolicy";

function bytes(...values: Array<number | string>) {
  const flattened = values.flatMap((value) => typeof value === "string" ? [...value].map((character) => character.charCodeAt(0)) : [value]);
  return new Uint8Array(flattened);
}

describe("audio import policy", () => {
  it("recognizes supported container signatures", () => {
    expect(isSupportedAudioHeader(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBe(true);
    expect(isSupportedAudioHeader(bytes("fLaC"))).toBe(true);
    expect(isSupportedAudioHeader(bytes("ID3"))).toBe(true);
    expect(isSupportedAudioHeader(bytes(0, 0, 0, 0, "ftyp"))).toBe(true);
    expect(isSupportedAudioHeader(bytes(0x1a, 0x45, 0xdf, 0xa3))).toBe(true);
    expect(isSupportedAudioHeader(bytes("not audio"))).toBe(false);
  });

  it("rejects empty and oversized inputs", () => {
    expect(() => assertAudioByteSize(0)).toThrow(/empty/i);
    expect(() => assertAudioByteSize(MAX_AUDIO_BYTES + 1)).toThrow(/100 MB/i);
    expect(() => assertAudioByteSize(MAX_AUDIO_BYTES)).not.toThrow();
  });

  it("rejects invalid and excessive decoded durations", () => {
    expect(() => assertAudioDuration(Number.NaN)).toThrow(/duration/i);
    expect(() => assertAudioDuration(MAX_AUDIO_DURATION_SECONDS + 1)).toThrow(/one hour/i);
    expect(() => assertAudioDuration(MAX_AUDIO_DURATION_SECONDS)).not.toThrow();
  });
});
