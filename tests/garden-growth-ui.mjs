import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { forecast } from "../src/systems/weather.js";

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
    const engine = new Engine();
    engine.s.day = 8;
    engine.s.forecast = forecast(8);
    engine.s.upgrades.garden = 2;
    engine.s.plots = [
      { id: "onion", growth: 0, dryDays: 0, watered: false, fertilized: false },
      {
        id: "flowers",
        growth: 1,
        dryDays: 0,
        watered: false,
        fertilized: false,
      },
      { id: "yuzu", growth: 2, dryDays: 0, watered: false, fertilized: false },
    ];
    await page.addInitScript((state) => {
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, engine.s);
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="garden"]').click();
    for (const id of [
      "v4-garden-onion-sprout",
      "v4-garden-flowers-growing",
      "v4-garden-yuzu-growing",
    ]) {
      const image = page.locator(`.stage img[src*="${id}"]`);
      await expect(image).toHaveCount(1);
      await expect
        .poll(() => image.evaluate((img) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
    await page.screenshot({
      path: `test-results/v3-garden-growing-${width}.png`,
    });
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  console.log(
    "PASS: distinct growing flower and yuzu sprites render at 320 and 390 px without JS errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
