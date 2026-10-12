import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const browser = await chromium.launch();
const base = process.env.GAME_URL || "http://localhost:5173";
await fs.mkdir("docs/review", { recursive: true });
try {
  for (const width of [320, 390, 430]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/?art-preview=2`);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll(".v2-room img")].length === 3 &&
        [...document.querySelectorAll(".v2-room img")].every(
          (i) => i.complete && i.naturalWidth,
        ),
    );
    await expect(page.locator(".asset-pending")).toHaveCount(0);
    expect(
      await page
        .locator(".v2-foreground")
        .evaluate((e) => getComputedStyle(e).pointerEvents),
    ).toBe("none");
    await page.locator(".v2-guest").tap();
    await expect(page.locator(".v2-reaction")).toBeVisible();
    await page.locator(".v2-order").tap();
    await expect(page.locator(".v2-scene-note")).toContainText("Kake");
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    ).toBe(true);
    await page.screenshot({ path: `docs/review/v2-mobile-${width}.png` });
    for (const panel of ["book", "shop", "journal"]) {
      await page.locator(`[data-arg="v2-${panel}"]`).tap();
      await expect(page.locator(".v2-sample-sheet")).toBeVisible();
      expect(
        await page
          .locator(".v2-sample-sheet")
          .evaluate((e) => e.scrollWidth <= e.clientWidth),
      ).toBe(true);
      if (width === 390)
        await page.screenshot({ path: `docs/review/v2-${panel}.png` });
      await page.locator(".v2-close").tap();
    }
    expect(
      await page.evaluate(() => localStorage.getItem("udon-nang-v1")),
    ).toBeNull();
    await page.locator('[data-act="exit-art"]').tap();
    await expect(page.locator('[data-act="start"]')).toBeVisible();
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: v2 samples, mobile sizes 320/390/430, touch through foreground, all three panels, no overflow/errors and no save written.",
  );
} finally {
  await browser.close();
}
