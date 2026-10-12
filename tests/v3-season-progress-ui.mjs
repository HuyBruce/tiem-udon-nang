import { tapAction } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { addStock } from "../src/systems/inventory.js";
import { INGREDIENTS, RECIPES } from "../src/data.js";
import { forecast } from "../src/systems/weather.js";
import { brothFormula } from "../src/systems/discovery.js";
import { validState } from "../src/systems/validation.js";
const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const e = new Engine();
    const s = e.s;
    s.money = 100000;
    s.day = 12;
    s.forecast = forecast(12);
    s.upgrades.storage = 3;
    e.upgrade("stove");
    s.upgrades.garden = 2;
    s.plots = [
      {
        id: "sakura",
        growth: 3,
        dryDays: 0,
        watered: false,
        fertilized: false,
      },
      {
        id: "sunflower",
        growth: 2,
        dryDays: 0,
        watered: false,
        fertilized: false,
      },
      null,
    ];
    for (const id of Object.keys(INGREDIENTS)) addStock(s, id, 30, false, true);
    addStock(s, "noodles", 10, true, true);
    e.adoptPet("cat");
    e.open();
    s.nextArrival = 1e9;
    s.settings.dialogue = "slow";
    expect(validState(s)).toBe(true);
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.addInitScript((state) => {
      if (!localStorage.getItem("udon-nang-v1"))
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, s);
    await page.goto(base);
    if (process.env.UDON_TEST_OFFLINE === "1") {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.context().setOffline(true);
    }
    const tap = (act, arg) => tapAction(page, act, arg);
    const read = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
      );
    const images = () =>
      page.waitForFunction(() =>
        [...document.querySelectorAll("#app img")].every(
          (i) => i.complete && i.naturalWidth,
        ),
      );
    await tap("start");
    await page.locator(".order-ticket").first().tap();
    await page.waitForTimeout(120);
    const dialogue = page.locator("blockquote.dialogue");
    const full = await dialogue.getAttribute("aria-label");
    expect((await dialogue.textContent()).length).toBeLessThan(full.length);
    await dialogue.tap();
    await expect(dialogue).toHaveText(full);
    await page.locator(".close-sheet").tap();
    await tap("goto", "front");
    await tap("panel", "manage");
    await tap("panel", "decor");
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      const money = (await read()).money;
      await tap("preview-decor", "season-" + season);
      expect((await read()).money).toBe(money);
      await images();
      await expect(
        page.locator('.room-preview img[src*="v3-season-' + season + '"]'),
      ).toHaveCount(1);
      await tap("confirm-decor", "season-" + season);
      expect((await read()).decor.season).toBe("season-" + season);
      expect((await read()).money).toBeLessThan(money);
    }
    await page.locator(".close-sheet").tap();
    for (const scene of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await tap("goto", scene);
      await images();
      await expect(
        page.locator(
          '.stage .seasonal-decoration img[src*="v3-season-winter"]',
        ),
      ).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.waitForTimeout(350);
      await page.screenshot({
        animations: "disabled",
        path: `test-results/completion-scene-${scene}-${width}.png`,
      });
    }
    await expect(page.locator('.garden-crop[src*="sakura-ripe"]')).toHaveCount(
      1,
    );
    await expect(
      page.locator('.garden-crop[src*="sunflower-ripe"]'),
    ).toHaveCount(1);
    await page.locator('.garden-plot [data-act="panel"]').first().tap();
    await tap("garden", "1");
    expect((await read()).bouquets).toBe(1);
    await tap("plant", "1:sunflower");
    expect((await read()).plots[1].id).toBe("sunflower");
    await tap("garden", "1");
    expect((await read()).plots[1].watered).toBe(true);
    await page.locator(".close-sheet").tap();
    await tap("goto", "kitchen");
    await tap("panel", "broth");
    await tap("broth-source", "curry");
    for (const id of brothFormula(RECIPES.curry)) await tap("batch-add", id);
    await tap("batch-cook");
    expect((await read()).curryBatch.stage).toBe("cooking");
    expect((await read()).brothBatch.stage).toBe("empty");
    await page.locator(".sheet-content").evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-curry-${width}.png`,
    });
    await page.locator(".close-sheet").tap();
    await tap("pot", "0");
    await tap("noodle-tier", "premium");
    expect((await read()).noodleTier).toBe("premium");
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-tiers-${width}.png`,
    });
    await page.reload();
    await tap("start");
    expect((await read()).brothSource).toBe("curry");
    expect((await read()).decor.season).toBe("season-winter");
    expect(validState(await read())).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: skippable typewriter, all four paid seasonal previews/six rooms, seasonal harvest/plant/water, separate curry pot, premium tier and reload 320/390.",
  );
} finally {
  await browser.close();
}
