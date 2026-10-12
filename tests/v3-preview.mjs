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
    await page.goto(`${base}/?art-preview=3`);
    await expect(page.locator('[data-arg="c"]')).toHaveAttribute("aria-pressed", "true");
    const before = await page.evaluate(() =>
      localStorage.getItem("udon-nang-v1"),
    );
    for (const id of ["a", "b", "c"]) {
      await page.locator(`[data-arg="${id}"]`).tap();
      await expect(page.locator(`[data-arg="${id}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".character-review img")].every(
          (i) => i.complete && i.naturalWidth,
        ),
      );
      await expect(page.locator(".asset-pending")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.locator('[data-arg="b"]').tap();
    await page.screenshot({
      path: `docs/review/v3-character-review-${width}.png`,
    });
    await page.reload();
    expect(
      await page.evaluate(() => localStorage.getItem("udon-nang-v1")),
    ).toBe(before);
    await page.locator('[data-act="exit-art"]').tap();
    await expect(page.locator('[data-act="start"]')).toBeVisible();
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: v3 character candidates on mobile 320/390/430; selection, images, no overflow/errors or save writes.",
  );
} finally {
  await browser.close();
}
