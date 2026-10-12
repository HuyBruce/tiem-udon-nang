import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { openPreparation } from "./ui-actions.mjs";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { addStock } from "../src/systems/inventory.js";
import { brothFormula } from "../src/systems/discovery.js";
import { RECIPES } from "../src/data.js";

const state = newState();
state.day = 9;
state.serial = 10;
for (const batches of Object.values(state.inventory))
  for (const batch of batches) batch.expires += 10;
state.inventory.ramune = [];
addStock(state, "daikon", 5, false, true);
const engine = new Engine(state);
engine.prepareEgg();
engine.open();
const customer = engine.s.customers[0];
engine.accept(customer.id);
const recipe = RECIPES[customer.recipe];
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
  drink: null,
  side: false,
  sideKind: null,
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
    await page.addInitScript(
      (saved) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: saved })),
      engine.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator(".order-ticket").first().tap();
    await expect(page.locator(".sheet")).toContainText("củ cải ngâm riêng");
    await page.screenshot({ path: `test-results/v3-sides-order-${width}.png` });
    await page.locator(".close-sheet").tap();
    await page.locator('.scene-pagination [data-arg="drinks"]').tap();
    await page.locator(".tray-slot.filled").tap();
    await chooseWorkOption(page, '[data-work-detail]', "dish");
    await expect(page.locator(".side-option")).toHaveCount(4);
    await expect(page.locator(".side-option.requested")).toContainText(
      "Củ cải ngâm",
    );
    await page.locator(".side-option img").evaluateAll((images) => {
      if (images.some((image) => !image.complete || image.naturalWidth === 0))
        throw new Error("Side dish art failed to load");
    });
    await page.screenshot({ path: `test-results/v3-sides-panel-${width}.png` });
    await page.locator('[data-act="side"][data-arg="dish1:daikon"]').tap();
    await expect(page.locator(".sheet")).toContainText(
      "Món kèm: Củ cải ngâm riêng",
    );
    await page.locator(".close-sheet").tap();
    await expect(
      page.locator('.tiny-side img[src*="v3-topping-daikon"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.tiny-side .side-plate[src*="tray-saucer"]'),
    ).toHaveCount(1);
    await page.screenshot({ path: `test-results/v3-sides-tray-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  const morning = newState();
  morning.day = 8;
  const page = await browser.newPage({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  await page.addInitScript(
    (saved) =>
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state: saved })),
    morning,
  );
  await page.goto("http://localhost:5173/");
  await page.locator('[data-act="start"]').tap();
  await openPreparation(page);
  await expect(page.locator(".sheet")).toContainText(
    "Chỉ luộc được trước giờ mở cửa",
  );
  await page.screenshot({ path: "test-results/v3-sides-morning-320.png" });
  await page.close();
  console.log(
    "PASS: four side options, daikon order/stock/tray art and morning egg reminder at 320/390px.",
  );
} finally {
  await browser.close();
}
