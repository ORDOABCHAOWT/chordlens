import { expect, test } from "@playwright/test";

function waveFile(durationSeconds = 0.35, frequency = 440) {
  const sampleRate = 8_000;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.sin((2 * Math.PI * frequency * index) / sampleRate) * 0.35;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

test("Chord Lab resolves both directions", async ({ page }) => {
  await page.goto("/?view=chord-lab");
  await expect(page.locator(".result-copy > strong")).toHaveText("F7");
  await expect(page.locator(".selected-note-chip", { hasText: "F" }).first()).toBeVisible();
  await page.getByRole("button", { name: "♯ Sharps" }).click();
  await page.getByRole("button", { name: "Add F♯" }).click();
  await expect(page.getByRole("button", { name: "Remove F♯" })).toHaveCount(2);
  await page.locator(".selected-note-chip", { hasText: "F♯" }).click();
  await expect(page.getByRole("button", { name: "Add F♯" })).toBeVisible();
  await page.getByRole("button", { name: "♭ Flats" }).click();
  await expect(page.getByRole("button", { name: "Add G♭" })).toBeVisible();
  await page.getByRole("button", { name: "Chord → Notes" }).click();
  const input = page.locator(".chord-entry input");
  await input.fill("Dm7");
  await expect(page.locator(".result-copy > strong")).toHaveText("Dm7");
  await expect(page.locator(".result-copy")).toContainText("D · F · A · C");
});

test("timeline selection updates the inspector", async ({ page }) => {
  await page.goto("/?view=transcribe");
  await page.locator(".chord-timeline button").nth(1).click();
  await expect(page.locator(".inspector-chord")).toHaveText("B♭");
  await expect(page.locator(".chord-notes")).toContainText("B♭ · D · F");
});

test("demo timeline seeks and explains why playback needs imported audio", async ({ page }) => {
  await page.goto("/?view=transcribe");
  const waveform = page.getByRole("slider", { name: "Waveform playback position" });
  const box = await waveform.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.2, (box?.y ?? 0) + (box?.height ?? 0) / 2);
  await page.mouse.down();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.8, (box?.y ?? 0) + (box?.height ?? 0) / 2, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByRole("slider", { name: "Playback position", exact: true })).toHaveValue("180");
  await expect(waveform).toHaveAttribute("aria-valuenow", "80");
  await page.getByRole("button", { name: "Play audio" }).click();
  await expect(page.locator(".song-status")).toContainText("no audio attached");
  const headerBox = await page.locator(".song-header").boundingBox();
  const hintBox = await page.locator(".song-status small").boundingBox();
  expect((hintBox?.y ?? 0) + (hintBox?.height ?? 0)).toBeLessThanOrEqual((headerBox?.y ?? 0) + (headerBox?.height ?? 0));
  await expect(page.getByRole("button", { name: "Play audio" })).toBeVisible();
});

test("audio import decodes locally and replaces mock data", async ({ page }) => {
  await page.goto("/?view=transcribe");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: /Import/ }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({ name: "Test Tone.wav", mimeType: "audio/wav", buffer: waveFile(2) });
  await expect(page.locator(".song-header strong")).toHaveText("Test Tone");
  await expect(page.locator(".song-header > span")).toContainText(/Analyzed|0:00 \/ 0:02/, { timeout: 15_000 });
  await expect(page.locator(".chord-timeline button")).toHaveCount(1);
  const position = page.getByRole("slider", { name: "Playback position", exact: true });
  await page.getByRole("button", { name: "Play audio" }).click();
  await expect(page.getByRole("button", { name: "Pause audio" })).toBeVisible();
  await expect.poll(async () => Number(await position.inputValue())).toBeGreaterThan(0.05);
  await page.getByRole("button", { name: "Pause audio" }).click();
  await position.fill("1.4");
  await expect(position).toHaveValue("1.4");
  await page.getByRole("button", { name: "Loop audio" }).click();
  await expect(page.getByRole("button", { name: "Loop audio" })).toHaveAttribute("aria-pressed", "true");
});

test("switching workspaces stops an active microphone stream", async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as Window & { __stoppedMicrophoneTracks?: number };
    state.__stoppedMicrophoneTracks = 0;
    const track = { stop: () => { state.__stoppedMicrophoneTracks = (state.__stoppedMicrophoneTracks ?? 0) + 1; } };
    const stream = { getTracks: () => [track] };
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => stream },
    });
    class FakeMediaRecorder {
      state: RecordingState = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      start() { this.state = "recording"; }
      stop() {
        this.state = "inactive";
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", { configurable: true, value: FakeMediaRecorder });
  });
  await page.goto("/");
  await page.getByRole("button", { name: /^Record$/ }).click();
  await expect(page.getByRole("button", { name: /^Stop$/ })).toBeVisible();
  await page.getByRole("button", { name: /Library/ }).click();
  await expect.poll(() => page.evaluate(() => (window as Window & { __stoppedMicrophoneTracks?: number }).__stoppedMicrophoneTracks ?? 0)).toBe(1);
});

test("production app uses one responsive workspace window", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await expect(page.locator(".unified-app")).toBeVisible();
  await expect(page.locator(".unified-workspace > .window-shell")).toHaveCount(1);
  await expect(page.locator(".window-titlebar:visible")).toHaveCount(0);
  await page.getByRole("button", { name: /Library/ }).click();
  await expect(page.locator(".workspace-library .library-window")).toBeVisible();
  expect(await page.locator(".song-meta strong").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(14);
  expect(await page.locator(".library-sidebar nav button").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(13);
  await page.getByRole("button", { name: /Chord Lab/ }).click();
  await expect(page.locator(".workspace-chord-lab .chord-lab-window")).toBeVisible();
  const inputPanel = await page.locator(".lab-input-panel").boundingBox();
  const previewPanel = await page.locator(".lab-preview-panel").boundingBox();
  const segmented = await page.locator(".lab-segmented").boundingBox();
  const noteKey = await page.locator(".note-palette button").first().boundingBox();
  const noteKeys = await page.locator(".note-palette button").evaluateAll((buttons) => buttons.map((button) => {
    const box = button.getBoundingClientRect();
    return { width: box.width, height: box.height };
  }));
  const bassChip = await page.locator(".selected-note-chip.bass").boundingBox();
  const bassLabel = await page.locator(".selected-note-chip.bass small").boundingBox();
  const guitar = await page.locator(".lab-preview-panel .guitar-diagram").boundingBox();
  expect(previewPanel?.x).toBeGreaterThan((inputPanel?.x ?? 0) + (inputPanel?.width ?? 0));
  expect(Math.abs((inputPanel?.y ?? 0) - (previewPanel?.y ?? 0))).toBeLessThanOrEqual(1);
  expect((segmented?.x ?? 0) - (inputPanel?.x ?? 0)).toBeGreaterThanOrEqual(18);
  expect((inputPanel?.x ?? 0) + (inputPanel?.width ?? 0) - ((segmented?.x ?? 0) + (segmented?.width ?? 0))).toBeGreaterThanOrEqual(18);
  expect(noteKey?.height).toBeGreaterThanOrEqual(52);
  expect(Math.max(...noteKeys.map((button) => button.width)) - Math.min(...noteKeys.map((button) => button.width))).toBeLessThanOrEqual(1);
  expect((bassChip?.y ?? 0) + (bassChip?.height ?? 0) - ((bassLabel?.y ?? 0) + (bassLabel?.height ?? 0))).toBeGreaterThanOrEqual(8);
  expect(await page.locator(".selected-note-chip.bass small").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11);
  expect(await page.locator(".selected-notes-label small").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await page.locator(".matching-list span").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await page.locator(".matching-list button").evaluateAll((buttons) => Math.max(...buttons.map((button) => button.getBoundingClientRect().height)))).toBeLessThanOrEqual(51);
  expect(guitar?.width).toBeGreaterThan(180);
  await page.screenshot({ path: "visual-tests/chord-lab-wide-current.png" });
  await page.getByRole("button", { name: /Transcribe/ }).click();
  await expect(page.locator(".workspace-transcribe .transcribe-window")).toBeVisible();
  await expect(page.locator(".wave-path")).toHaveCount(2);
  await expect(page.locator(".wave-bar")).toHaveCount(0);
  expect(await page.locator(".toolbar-item").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(11);
  expect(await page.locator(".song-header strong").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(18);
  expect(await page.locator(".inspector .eyebrow").first().evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(12);
  await page.screenshot({ path: "visual-tests/unified-current.png" });
  await page.setViewportSize({ width: 900, height: 650 });
  const workspaceBox = await page.locator(".unified-workspace > .window-shell").boundingBox();
  expect(workspaceBox?.width).toBeGreaterThan(850);
  expect(workspaceBox?.height).toBeGreaterThan(560);
  await page.getByRole("button", { name: /Chord Lab/ }).click();
  await expect(page.locator(".lab-content")).toBeVisible();
  expect(await page.locator(".lab-content").evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.locator(".lab-content").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.locator(".matching-list button").first()).toBeVisible();
});
