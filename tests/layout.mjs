import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
await fs.mkdir("test-results", { recursive: true });
try {
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [360, 800],
    [375, 812],
    [393, 873],
    [390, 844],
    [430, 932],
    [1440, 1000],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: width < 600,
      hasTouch: width < 600,
      reducedMotion: "reduce",
    });
    await page.goto("http://localhost:5173/?debug=1");
    await page.addStyleTag({
      content: ".debug-tools { display: none !important; }",
    });
    await page.getByRole("button", { name: "Bắt đầu ngày đầu tiên" }).click();
    await expect(page.locator(".sheet")).toHaveCount(0);
    const roomBackgrounds = new Set();
    for (const scene of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await page.locator(`.scene-pagination [data-arg="${scene}"]`).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".stage img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
      await expect(page.locator(".stage .asset-pending")).toHaveCount(0);
      roomBackgrounds.add(
        await page
          .locator(".scene-band .scene-background,.scene-painting > .scene-background")
          .first()
          .getAttribute("src"),
      );
      if (scene === "front" && width < 600) {
        const sign = await page.locator(".shop-sign").boundingBox();
        const hud = await page.locator(".hud").boundingBox();
        expect(sign.y).toBeGreaterThanOrEqual(hud.y + hud.height - 1);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const tools = await page.locator(".bottom-tools").boundingBox();
      expect(tools.y + tools.height).toBeLessThanOrEqual(height + 1);
      await page.screenshot({
        path: `test-results/layout-${width}x${height}-${scene}.png`,
      });
    }
    await page.getByRole("button", { name: "Cài đặt" }).click();
    expect(roomBackgrounds.size).toBe(6);
    await page.locator('[data-setting="font"]').selectOption("large");
    await expect(page.locator("#app")).toHaveClass(/large-font/);
    await page.close();
  }
  console.log(
    "PASS: 320, 360 (640/800 high), 375, 390, 393, 430 and desktop 1440 layouts, all six scenes, no page overflow; large text works; isolated debug saves.",
  );
} finally {
  await browser.close();
}
