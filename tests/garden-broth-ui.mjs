import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { openPreparation } from "./ui-actions.mjs";
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
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const engine = new Engine();
    engine.s.day = 8;
    engine.s.forecast = forecast(8);
    engine.s.upgrades.garden = 2;
    for (const batches of Object.values(engine.s.inventory))
      for (const batch of batches) batch.expires += 10;
    engine.s.plots = [
      { id: "onion", growth: 0, dryDays: 0, watered: false, fertilized: false },
      {
        id: "flowers",
        growth: 5,
        dryDays: 0,
        watered: false,
        fertilized: false,
      },
      { id: "yuzu", growth: 2, dryDays: 2, watered: false, fertilized: false },
    ];
    await page.addInitScript((state) => {
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, engine.s);
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').click();
    await openPreparation(page);
    await expect(page.locator(".sheet")).toContainText("Có cây đang héo");
    await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="garden"]').click();
    for (const id of [
      "v4-garden-onion-sprout",
      "v4-garden-flowers-ripe",
      "v4-garden-yuzu-wilted",
    ]) {
      const image = page.locator(`.stage img[src*="${id}"]`);
      await expect(image).toHaveCount(1);
      await expect(image).toHaveJSProperty("complete", true);
    }
    await page.screenshot({ path: `test-results/v3-garden-${width}.png` });
    await page.locator(".garden-plot .sprite-touch").first().click();
    await expect(page.locator(".sheet .plant-card-art img")).toHaveCount(3);
    for (const id of [
      "v4-garden-onion-sprout",
      "v4-garden-flowers-ripe",
      "v4-garden-yuzu-wilted",
    ]) {
      const image = page.locator(`.sheet .plant-card-art img[src*="${id}"]`);
      await expect(image).toHaveCount(1);
      await expect
        .poll(() => image.evaluate((img) => img.naturalWidth))
        .toBeGreaterThan(0);
    }
    await page.screenshot({
      path: `test-results/v3-garden-panel-${width}.png`,
    });
    await page.locator(".close-sheet").click();

    await page.locator('.scene-pagination [data-arg="kitchen"]').click();
    await expect(page.locator("#stage")).toHaveAttribute(
      "data-camera-state",
      "idle",
    );
    await chooseWorkOption(page, '[data-work-detail]', "broth");
    await expect(page.locator(".broth-pot-art")).toHaveCount(1);
    await page.evaluate(() => {
      window.brothFlightCount = 0;
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            if (node.classList?.contains("ingredient-flight"))
              window.brothFlightCount++;
      }).observe(document.body, { childList: true });
    });
    await page.locator('[data-act="batch-add"][data-arg="dashi"]').click();
    await expect(page.locator(".broth-illustration strong")).toContainText(
      "1 phần gia vị",
    );
    expect(await page.evaluate(() => window.brothFlightCount)).toBe(1);
    await page.screenshot({ path: `test-results/v3-broth-${width}.png` });
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  console.log(
    "PASS: garden stages and broth ingredient animation at 320 and 390 px; no console errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
