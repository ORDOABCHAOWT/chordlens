import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const key = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}，`) });
const symbol = (page: Page) => page.locator(".sym");

test("opens the chord workspace even with a saved retired workspace or legacy URL", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("chordlens-workspace", "library"));
  for (const url of ["/", "/?view=library", "/?view=transcribe", "/?view=design-preview"]) {
    await page.goto(url);
    await expect(page.getByRole("region", { name: "当前和弦" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Library|Transcribe|Record|Import/ })).toHaveCount(0);
    await expect(page.locator(".workspace-switcher, .library-window, .transcribe-window")).toHaveCount(0);
  }
  await page.keyboard.press("Meta+1");
  await expect(symbol(page)).toHaveAttribute("aria-label", "F7");
});

test("typing a chord name drives the keys, the tones and the guitar", async ({ page }) => {
  await page.goto("/");
  await page.locator(".app").focus();
  await page.keyboard.press("d");
  await page.keyboard.type("m7");
  await page.keyboard.press("Enter");
  await expect(symbol(page)).toHaveAttribute("aria-label", "Dm7");
  await expect(page.locator(".tone-note")).toHaveText(["D", "F", "A", "C"]);
  await expect(page.getByRole("button", { name: /，点击移除$/ })).toHaveCount(4);
  await expect(page.getByRole("img", { name: /^吉他指法 x x 0 2 1 1/ })).toBeVisible();
});

test("escape restores the chord that was showing before typing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox").click();
  await page.keyboard.type("Cmaj7");
  await expect(symbol(page)).toHaveAttribute("aria-label", "Cmaj7");
  await page.keyboard.press("Escape");
  await expect(symbol(page)).toHaveAttribute("aria-label", "F7");
});

test("keys name the chord, the lowest key is the bass, and history can be undone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^清空/ }).click();
  await expect(symbol(page)).toHaveText("从这里开始");
  for (const name of ["E3", "G3", "C4"]) await key(page, name).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C/E");
  await expect(page.locator(".explain")).toContainText("第一转位（低音 E 是三音）");
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.locator(".name-main")).toHaveText("小三度");
  await page.getByRole("button", { name: "重做" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C/E");
  await page.getByRole("button", { name: "升半音" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "Db/F");
});

test("accidental spelling can be forced to sharps or flats", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "升号" }).click();
  await expect(page.locator(".tone-note")).toHaveText(["F", "A", "C", "D♯"]);
  await page.getByRole("button", { name: "降号" }).click();
  await expect(page.locator(".tone-note")).toHaveText(["F", "A", "C", "E♭"]);
});

test("placing a shape on the fretboard names the chord", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "摆指型" }).click();
  // F7 barre 1 3 1 2 1 1 → C major x 3 2 0 1 0
  await page.getByTestId("string-1-top").click();
  await page.getByTestId("string-3-fret-2").click();
  await page.getByTestId("string-4-top").click();
  await page.getByTestId("string-4-top").click();
  await page.getByTestId("string-6-top").click();
  await page.getByTestId("string-6-top").click();
  await expect(page.getByRole("img", { name: /^吉他指法 x 3 2 0 1 0/ })).toBeVisible();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C");
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.locator(".v-meta")).toContainText("自定义指型");
});

test("everything fits the minimum native window without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 650 });
  await page.goto("/");
  for (const region of [".hero", ".gtr", ".dock"]) await expect(page.locator(region)).toBeVisible();
  const [width, height] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
  expect(width).toBeLessThanOrEqual(900);
  expect(height).toBeLessThanOrEqual(650);
  const [diagram, meta] = await Promise.all([page.locator(".dg-lg").boundingBox(), page.locator(".v-meta").boundingBox()]);
  expect(diagram!.y + diagram!.height).toBeLessThanOrEqual(meta!.y + 1);
});

test("the reset button above the notes clears every note for a fresh combination", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /，点击移除$/ })).toHaveCount(4);
  await page.getByRole("button", { name: "重置" }).click();
  await expect(symbol(page)).toHaveText("从这里开始");
  await expect(page.getByRole("button", { name: /，点击移除$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重置" })).toHaveCount(0);
  for (const name of ["D3", "F3", "A3"]) await key(page, name).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "Dm");
  await page.getByRole("button", { name: "撤销" }).click();
  await page.getByRole("button", { name: "撤销" }).click();
  await page.getByRole("button", { name: "撤销" }).click();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "F7");
});

test("the chord explanation covers construction, sound and usage, and folds usage in the minimum window", async ({ page }) => {
  await page.goto("/");
  const explain = page.locator(".explain");
  await expect(explain).toContainText("大三和弦上再加一个小七度");
  await expect(explain).toContainText("张力");
  await expect(explain).toContainText("F7 → B♭");
  await page.setViewportSize({ width: 900, height: 650 });
  await expect(page.getByText("F7 → B♭", { exact: false })).toBeHidden();
  await page.getByRole("button", { name: "展开用法" }).click();
  await expect(page.getByText("F7 → B♭", { exact: false })).toBeVisible();
});
