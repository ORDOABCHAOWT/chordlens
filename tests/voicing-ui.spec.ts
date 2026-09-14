import { expect, test } from "@playwright/test";

async function expectCanonicalAsus2(page: import("@playwright/test").Page) {
  const diagram = page.getByRole("img", { name: "Guitar voicing x 0 2 2 0 0" });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator(".diagram-marker")).toHaveText(["×", "○", "", "", "○", "○"]);
  await expect(diagram.locator("circle")).toHaveCount(2);

  const [dots, strings] = await Promise.all([
    diagram.locator("circle").evaluateAll((nodes) => nodes.map((node) => ({ cx: node.getAttribute("cx"), cy: node.getAttribute("cy") }))),
    diagram.locator("line").evaluateAll((nodes) => nodes.slice(0, 6).map((node) => node.getAttribute("x1"))),
  ]);
  expect(dots.map((dot) => dot.cx)).toEqual([strings[2], strings[3]]);
  expect(dots[0]?.cy).toBe(dots[1]?.cy);
  const fretLines = await diagram.locator("line").evaluateAll((nodes) => nodes.slice(6).map((node) => Number(node.getAttribute("y1"))));
  expect(Number(dots[0]?.cy)).toBeGreaterThan(fretLines[1]);
  expect(Number(dots[0]?.cy)).toBeLessThan(fretLines[2]);
}

test("Chord Lab renders canonical Asus2 from notes and chord input", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Clear all/ }).click();
  await page.getByRole("button", { name: "Add A", exact: true }).click();
  await page.getByRole("button", { name: "Add E", exact: true }).click();
  await page.getByRole("button", { name: "Add B", exact: true }).click();
  await expect(page.locator(".result-copy > strong")).toHaveText("Asus2");
  await expectCanonicalAsus2(page);

  await page.screenshot({ path: "test-results/asus2.png", fullPage: true });

  await page.getByRole("button", { name: "Chord → Notes" }).click();
  await page.locator(".chord-entry input").fill("Asus2");
  await expect(page.locator(".result-copy > strong")).toHaveText("Asus2");
  await expectCanonicalAsus2(page);
});
