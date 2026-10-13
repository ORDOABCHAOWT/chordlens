import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const key = (page: Page, name: string) => page.getByRole("button", { name: new RegExp(`^${name}，`) });
const symbol = (page: Page) => page.locator(".sym");

async function showChord(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("combobox").fill(name);
  await page.keyboard.press("Enter");
  await expect(symbol(page)).toHaveAttribute("aria-label", name);
}

/** Presses on one tone card and carries it over another; `release: false` leaves it held there. */
async function dragTone(page: Page, from: number, to: number, release = true) {
  const cards = page.locator(".tone");
  // A card may still be gliding home from the previous drag.
  await expect(async () => {
    const before = await cards.nth(from).boundingBox();
    await page.waitForTimeout(80);
    expect(await cards.nth(from).boundingBox()).toEqual(before);
  }).toPass();
  const start = (await cards.nth(from).boundingBox())!;
  const end = (await cards.nth(to).boundingBox())!;
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 });
  if (release) await page.mouse.up();
}

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

test("the first key pressed is the root, the lowest key is the bass, and history can be undone", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^清空/ }).click();
  await expect(symbol(page)).toHaveText("从这里开始");
  for (const name of ["C4", "E3", "G3"]) await key(page, name).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C/E");
  await expect(page.locator(".explain")).toContainText("第一转位（低音 E 是三音）");
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.locator(".name-main")).toHaveText("大三度");
  await page.getByRole("button", { name: "重做" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C/E");
  await page.getByRole("button", { name: "升半音" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "Db/F");

  // The same three keys starting from E are read on E; the usual name stays one click away.
  await page.getByRole("button", { name: /^清空/ }).click();
  for (const name of ["E3", "G3", "C4"]) await key(page, name).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "Em#5");
  await page.getByRole("group", { name: "其他叫法" }).getByRole("button").first().click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "C/E");
});

test("notes with no chord on the first key get a rule name and offer the usual one", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^清空/ }).click();
  await key(page, "A3").click();
  await expect(page.locator(".name-main")).toHaveText("单音");
  await key(page, "D4").click();
  await expect(symbol(page)).toHaveText("A–D");
  await expect(page.locator(".name-main")).toHaveText("纯四度");
  await key(page, "F♯4").click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "A6sus4(no5)");
  await expect(page.locator(".name-main")).toHaveText("以 A 为根音");
  await expect(page.locator(".tone-note")).toHaveText(["A", "D", "F♯"]);
  await expect(page.locator(".tone-deg")).toHaveText(["R", "4", "6"]);
  await expect(page.locator(".explain")).toContainText("以 A 为根音，叠加纯四度、大六度。");
  await expect(page.getByRole("img", { name: /^吉他指法 x 0 0 2 3 2/ })).toBeVisible();
  const usual = page.getByRole("group", { name: "其他叫法" });
  await expect(usual).toContainText("更常见");
  await usual.getByRole("button").first().click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "D/A");
  await expect(page.locator(".tone-note")).toHaveText(["D", "F♯", "A"]);
  await expect(page.locator(".name-bass")).toHaveText("第二转位 · 低音 A");

  // Four notes that are a chord both ways follow the first key.
  for (const [first, name] of [["C4", "C6"], ["A4", "Am7/C"]]) {
    await page.getByRole("button", { name: /^清空/ }).click();
    await key(page, first).click();
    for (const other of ["C4", "E4", "G4", "A4"]) if (other !== first) await key(page, other).click();
    await expect(symbol(page)).toHaveAttribute("aria-label", name);
  }
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

test("dragging a tone card to the front makes that note the root", async ({ page }) => {
  await showChord(page, "C6");
  await expect(page.locator(".tone-note")).toHaveText(["C", "E", "G", "A"]);

  // Held over the first place, the whole window previews the result; Escape puts everything back.
  await dragTone(page, 3, 0, false);
  await expect(symbol(page)).toHaveAttribute("aria-label", "Am7");
  await expect(page.getByRole("img", { name: /^吉他指法 x 0 2 0 1 0/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(symbol(page)).toHaveAttribute("aria-label", "C6");
  await expect(page.locator(".tone-note")).toHaveText(["C", "E", "G", "A"]);
  await page.mouse.up();

  await dragTone(page, 3, 0);
  await expect(symbol(page)).toHaveAttribute("aria-label", "Am7");
  await expect(page.locator(".tone-note")).toHaveText(["A", "C", "E", "G"]);
  await expect(page.locator(".tone").first()).toHaveClass(/is-root/);
  await expect(page.locator(".toast")).toHaveText("根音换成了 A：Am7");
  await expect(page.locator(".explain")).toContainText("Am7 → D7 → Gmaj7");
  await expect(key(page, "A3")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".tone.dragging, .tone-slot.is-source")).toHaveCount(0);

  // Taking the root card away from the front hands the root to the next one.
  await dragTone(page, 0, 3);
  await expect(symbol(page)).toHaveAttribute("aria-label", "C6");
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "Am7");
});

test("a root the notes do not usually have is named by rule, with the usual name beside it", async ({ page }) => {
  await showChord(page, "D");
  await expect(page.getByRole("img", { name: /^吉他指法 x x 0 2 3 2/ })).toBeVisible();
  await dragTone(page, 2, 0);
  await expect(symbol(page)).toHaveAttribute("aria-label", "A6sus4(no5)");
  await expect(page.locator(".tone-note")).toHaveText(["A", "D", "F♯"]);
  await expect(page.locator(".tone-deg")).toHaveText(["R", "4", "6"]);
  await expect(page.locator(".tone").first().locator(".tone-tag")).toHaveText("低音");
  await expect(page.locator(".name-main")).toHaveText("以 A 为根音");
  await expect(page.locator(".toast")).toHaveText("以 A 为根音的叫法很少见，更常见的是 D/A");
  await expect(page.getByRole("img", { name: /^吉他指法 x 0 0 2 3 2/ })).toBeVisible();
  await expect(key(page, "A3")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "D");
});

test("a drag that changes nothing leaves the chord alone, and a click still only plays the note", async ({ page }) => {
  await showChord(page, "G7");
  await dragTone(page, 1, 3);
  await expect(symbol(page)).toHaveAttribute("aria-label", "G7");
  await expect(page.locator(".tone-note")).toHaveText(["G", "B", "D", "F"]);
  await page.locator(".tone").nth(2).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "G7");
  // Neither added a step to the history: one undo goes straight back to the opening chord.
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(symbol(page)).toHaveAttribute("aria-label", "F7");
});

test("inversions and rule names still fit the minimum native window without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 650 });
  for (const name of ["D/A", "F7/Eb", "Am7/G"]) {
    await showChord(page, name);
    await expect(page.locator(".name-bass")).toBeVisible();
    const [width, height, heroFits] = await page.evaluate(() => {
      const hero = document.querySelector(".hero")!;
      return [document.documentElement.scrollWidth, document.documentElement.scrollHeight, hero.scrollHeight <= hero.clientHeight + 1];
    });
    expect(width).toBeLessThanOrEqual(900);
    expect(height).toBeLessThanOrEqual(650);
    expect(heroFits, name).toBe(true);
  }
  await showChord(page, "D");
  await dragTone(page, 2, 0);
  await expect(symbol(page)).toHaveAttribute("aria-label", "A6sus4(no5)");
  expect(await page.evaluate(() => { const hero = document.querySelector(".hero")!; return hero.scrollHeight <= hero.clientHeight + 1; })).toBe(true);
});
