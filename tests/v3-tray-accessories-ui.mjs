import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { brothFormula } from "../src/systems/discovery.js";
import { RECIPES } from "../src/data.js";

const state = newState();
state.day = 9;
for (const batches of Object.values(state.inventory))
  for (const batch of batches) batch.expires += 10;
const engine = new Engine(state);
engine.open();
const customer = engine.s.customers[0];
engine.accept(customer.id);
const recipe = RECIPES[customer.recipe];
engine.s.decor = Object.fromEntries(
  ["chopsticks", "spoon", "coaster", "saucer", "mat"].map((id) => [id, id]),
);
engine.s.ownedDecor = Object.keys(engine.s.decor);
engine.s.tray.push({
  id: "dish1",
  orderId: customer.id,
  stage: "ready",
  lifted: true,
  time: 10,
  duration: 9,
  broth: brothFormula(recipe),
  tops: recipe.tops,
  method: recipe.kind || "hot",
  texture: "perfect",
  quality: 1,
  poured: true,
  noodleTier: customer.noodleTier,
  drink: "ramune",
  side: true,
  sideKind: "tempura",
});

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
    await page.addInitScript(
      (saved) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: saved })),
      engine.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="drinks"]').tap();
    const trayArt = await page
      .locator(".tray-slots")
      .evaluate(async (slots) => {
        const url = getComputedStyle(slots).backgroundImage.match(
          /url\(["']?([^"')]+)["']?\)/,
        )?.[1];
        if (!url) return null;
        const image = new Image();
        image.src = url;
        await image.decode();
        return [image.naturalWidth, image.naturalHeight];
      });
    expect(trayArt).toEqual([1200, 240]);
    await expect(page.locator(".tray-slot")).toHaveCount(5);
    const slot = page.locator(".tray-slot.filled");
    await expect(slot).toHaveCount(1);
    const mat = slot.locator('img.tray-mat[src*="tray-woven-mat"]');
    await expect(mat).toHaveCount(1);
    await expect
      .poll(() => mat.evaluate((node) => node.naturalWidth))
      .toBeGreaterThan(0);
    await expect(
      slot.locator('.tiny-side .side-plate[src*="tray-saucer"]'),
    ).toHaveCount(1);
    for (const id of ["chopsticks", "spoon", "coaster", "saucer"]) {
      const image = slot.locator(`img.accessory.${id}[src*="tray-${id}"]`);
      await expect(image).toHaveCount(1);
      await expect
        .poll(() => image.evaluate((node) => node.naturalWidth))
        .toBeGreaterThan(0);
      const bounds = await image.boundingBox();
      expect(bounds.width).toBeLessThan(45);
      expect(bounds.height).toBeLessThan(35);
    }
    expect(
      await slot
        .locator("img.accessory")
        .evaluateAll((images) =>
          images.every(
            (image) => getComputedStyle(image).pointerEvents === "none",
          ),
        ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/v3-tray-accessories-${width}.png`,
    });
    await slot.tap();
    await expect(page.locator(".sheet")).toBeVisible();
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  console.log(
    "PASS: file-backed five-slot tray and accessories load without blocking the dish at 320/390px.",
  );
} finally {
  await browser.close();
}
