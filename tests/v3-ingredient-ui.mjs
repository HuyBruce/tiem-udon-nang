import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { INGREDIENTS } from "../src/data.js";
import { mkdir } from "node:fs/promises";

const fixture = new Engine();
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      fixture.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    await page.locator('[data-act="panel"][data-arg="manage"]').click();
    await page.locator('[data-act="panel"][data-arg="inventory"]').click();
    const rows = page.locator(".stock-row .ingredient-inspect .food-icon");
    await expect(rows).toHaveCount(Object.keys(INGREDIENTS).length);
    await rows.evaluateAll((images) => {
      if (images.some((image) => !image.complete || image.naturalWidth === 0))
        throw new Error("Ingredient icon failed to load");
    });
    await page.screenshot({
      path: `test-results/v3-ingredient-inventory-${width}.png`,
    });
    await page.locator('[data-act="stock-detail"][data-arg="beef"]').click();
    await expect(page.locator(".stock-detail-art .food-icon")).toHaveCount(1);
    await page.screenshot({
      path: `test-results/v3-ingredient-detail-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    `PASS: ${Object.keys(INGREDIENTS).length} stock icons and detail panel at 320 and 390 px; prepared tempura has its own sprite.`,
  );
} finally {
  await browser.close();
}
