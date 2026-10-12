import { chromium, expect } from "@playwright/test";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await expect(page.locator(".sheet")).toHaveCount(0);
    await page.locator('.scene-pagination [data-arg="storage"]').tap();
    const supplies = page.locator(".storage-floor-supplies");
    const image = supplies.locator('img[src*="v3-storage-floor-supplies"]');
    await expect(image).toHaveCount(1);
    await expect
      .poll(() => image.evaluate((node) => node.naturalWidth))
      .toBeGreaterThan(0);
    await expect(supplies.locator(".sprite-touch")).toHaveCount(1);
    await page.screenshot({
      path: `test-results/v3-storage-floor-${width}.png`,
    });
    await supplies.locator(".sprite-touch").tap();
    await expect(page.locator('.sheet[data-panel="inventory"]')).toBeVisible();
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  console.log(
    "PASS: pantry floor art loads and opens inventory by touch at 320/390px without errors or overflow.",
  );
} finally {
  await browser.close();
}
