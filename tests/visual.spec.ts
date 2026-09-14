import { expect, test } from "@playwright/test";

test("chord-only layout keeps diagram and labels separate", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.getByRole("button", { name: "Chord → Notes" }).click();
  await page.locator(".chord-entry input").fill("F7b6");
  const diagram = page.locator(".guitar-diagram");
  await expect(diagram).toBeVisible();
  const label = diagram.locator(".diagram-fret-label");
  await expect(label).toHaveCount(1);
  const bounds = await label.evaluate((node) => (() => { const box = (node as SVGGraphicsElement).getBBox(); return { x: box.x, width: box.width }; })());
  const firstString = Number(await diagram.locator("line").first().getAttribute("x1"));
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThan(firstString);
  await expect(diagram.locator(".diagram-base")).toHaveCount(0);
  await page.screenshot({ path: "test-results/chordlab-layout.png", fullPage: true });
});
