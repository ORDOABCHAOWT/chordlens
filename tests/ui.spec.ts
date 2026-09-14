import { expect, test } from "@playwright/test";

test("opens only Chord Lab even with a saved retired workspace or legacy URL", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("chordlens-workspace", "library"));
  for (const url of ["/", "/?view=library", "/?view=transcribe", "/?view=design-preview"]) {
    await page.goto(url);
    await expect(page.getByRole("region", { name: "Chord Lab", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Library|Transcribe|Record|Import/ })).toHaveCount(0);
    await expect(page.locator(".workspace-switcher, .library-window, .transcribe-window")).toHaveCount(0);
  }
  await page.keyboard.press("Meta+1");
  await page.keyboard.press("Meta+2");
  await expect(page.getByRole("button", { name: "Notes → Chord", exact: true })).toBeVisible();
});

test("core chord controls and search remain functional", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".result-copy > strong")).toHaveText("F7");
  await page.getByRole("button", { name: "♯ Sharps" }).click();
  await page.getByRole("button", { name: "Add F♯", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove F♯", exact: true })).toHaveCount(2);
  await page.locator(".selected-note-chip", { hasText: "F♯" }).click();
  await page.getByRole("button", { name: "♭ Flats" }).click();
  await expect(page.getByRole("button", { name: "Add G♭", exact: true })).toBeVisible();
  await page.getByRole("textbox", { name: "Search chord" }).fill("Dm7");
  await expect(page.locator(".result-copy > strong")).toHaveText("Dm7");
  await expect(page.locator(".result-copy")).toContainText("D · F · A · C");
  await page.getByRole("button", { name: "Clear chord search" }).click();
  await expect(page.locator(".empty-result")).toHaveText("Enter a valid chord symbol");
});

test("core panels stay accessible in the minimum native window", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto("/");
  await expect(page.locator(".lab-input-panel")).toBeVisible();
  await expect(page.locator(".lab-preview-panel")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(900);
  await page.locator(".lab-content").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(page.getByRole("textbox", { name: "Search chord" })).toBeVisible();
});
