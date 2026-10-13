import { expect, test } from "@playwright/test";

test("high-position shapes keep the fret label clear of the grid", async ({ page }) => {
  await page.setViewportSize({ width: 1180, height: 820 });
  await page.goto("/");
  await page.locator(".app").focus();
  await page.keyboard.press("ArrowRight");
  const diagram = page.getByRole("img", { name: /^吉他指法 x 8 10 8 10 8/ });
  await expect(diagram).toBeVisible();
  const label = diagram.locator(".dg-fn");
  await expect(label).toHaveCount(1);
  await expect(label).toHaveText("8fr");
  const bounds = await label.evaluate((node) => { const box = (node as SVGGraphicsElement).getBBox(); return { x: box.x, width: box.width }; });
  const firstString = Number(await diagram.locator(".dg-str").first().getAttribute("x1"));
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThan(firstString);
  await page.screenshot({ path: "test-results/chordlab-layout.png", fullPage: true });

  await page.emulateMedia({ colorScheme: "dark" });
  await page.screenshot({ path: "test-results/chordlab-dark.png", fullPage: true });
});
