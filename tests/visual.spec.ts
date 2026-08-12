import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

test("1448x1086 design preview tracks the supplied reference", async ({ page }) => {
  await page.goto("/?view=design-preview");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: "visual-tests/current.png" });

  const referencePath = path.resolve("visual-tests/reference.png");
  const currentPath = path.resolve("visual-tests/current.png");
  if (process.env.UPDATE_REFERENCE === "1") fs.copyFileSync(currentPath, referencePath);
  const reference = PNG.sync.read(fs.readFileSync(referencePath));
  const current = PNG.sync.read(fs.readFileSync(currentPath));
  expect(current.width).toBe(reference.width);
  expect(current.height).toBe(reference.height);
  const diff = new PNG({ width: reference.width, height: reference.height });
  const differing = pixelmatch(reference.data, current.data, diff.data, reference.width, reference.height, { threshold: 0.18, includeAA: false });
  fs.writeFileSync("visual-tests/diff.png", PNG.sync.write(diff));
  const ratio = differing / (reference.width * reference.height);
  fs.writeFileSync("visual-tests/report.json", JSON.stringify({ differingPixels: differing, totalPixels: reference.width * reference.height, differencePercent: Number((ratio * 100).toFixed(3)) }, null, 2));
  expect(ratio).toBeLessThan(0.28);
});
