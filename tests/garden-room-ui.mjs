import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const engine = new Engine();
    engine.s.upgrades.garden = 3;
    engine.s.plots = [
      { id: "onion", growth: 1, dryDays: 0, watered: true, fertilized: false },
      {
        id: "flowers",
        growth: 2,
        dryDays: 0,
        watered: true,
        fertilized: false,
      },
      { id: "yuzu", growth: 3, dryDays: 0, watered: true, fertilized: false },
      null,
    ];
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await page.addInitScript((state) => {
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, engine.s);
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="garden"]').click();
    await expect(page.locator(".garden-plot")).toHaveCount(4);
    await expect(page.locator(".stage .asset-pending")).toHaveCount(0);
    for (const plot of await page.locator(".garden-plot .sprite-touch").all()) {
      const accessible = await plot.evaluate((button) => {
        const box = button.getBoundingClientRect();
        const target = document.elementFromPoint(
          box.left + box.width / 2,
          box.top + box.height / 2,
        );
        return (
          box.width >= 44 &&
          box.height >= 44 &&
          (target === button || button.contains(target))
        );
      });
      expect(accessible).toBe(true);
    }
    await page.screenshot({
      path: `test-results/garden-four-plots-${width}.png`,
    });
    await page.close();
  }
  console.log(
    "PASS: four garden plots stay visible and tappable at 320/390px.",
  );
} finally {
  await browser.close();
}
