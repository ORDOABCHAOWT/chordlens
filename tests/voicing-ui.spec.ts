import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function expectCanonicalAsus2(page: Page) {
  const diagram = page.getByRole("img", { name: /^吉他指法 x 0 2 2 0 0/ });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator(".dg-mute")).toHaveCount(1);
  await expect(diagram.locator(".dg-open")).toHaveCount(3);
  await expect(diagram.locator(".dg-dot")).toHaveCount(2);

  const [dots, strings, frets] = await Promise.all([
    diagram.locator(".dg-dot").evaluateAll((nodes) => nodes.map((node) => {
      const shape = node.querySelector("circle, rect")!;
      const centre = (axis: "x" | "y", size: "width" | "height") => shape.hasAttribute(`c${axis}`)
        ? Number(shape.getAttribute(`c${axis}`))
        : Number(shape.getAttribute(axis)) + Number(shape.getAttribute(size)) / 2;
      return { cx: centre("x", "width"), cy: centre("y", "height") };
    })),
    diagram.locator(".dg-str").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("x1")))),
    diagram.locator(".dg-fret").evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute("y1")))),
  ]);
  // Second fret of the D and G strings, side by side.
  expect(dots.map((dot) => dot.cx)).toEqual([strings[2], strings[3]]);
  expect(dots[0].cy).toBe(dots[1].cy);
  expect(dots[0].cy).toBeGreaterThan(frets[0]);
  expect(dots[0].cy).toBeLessThan(frets[1]);
}

test("renders canonical Asus2 from the keys and from the search field", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^清空/ }).click();
  for (const name of ["A3", "B3", "E4"]) await page.getByRole("button", { name: new RegExp(`^${name}，`) }).click();
  await expect(page.locator(".sym")).toHaveAttribute("aria-label", "Asus2");
  await expectCanonicalAsus2(page);
  await page.screenshot({ path: "test-results/asus2.png", fullPage: true });

  await page.getByRole("button", { name: /^清空/ }).click();
  await page.getByRole("combobox").fill("Asus2");
  await page.keyboard.press("Enter");
  await expect(page.locator(".sym")).toHaveAttribute("aria-label", "Asus2");
  await expectCanonicalAsus2(page);
});
