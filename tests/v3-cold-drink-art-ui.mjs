import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { addStock } from "../src/systems/inventory.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { brothFormula } from "../src/systems/discovery.js";
import { validState } from "../src/systems/validation.js";
import { DRINKS, RECIPES } from "../src/data.js";

function fixture(id) {
  const state = newState();
  state.day = 10;
  state.upgrades.storage = 2;
  for (const batches of Object.values(state.inventory))
    for (const batch of batches) batch.expires += 10;
  const engine = new Engine(state);
  engine.open();
  const customer = engine.s.customers[0];
  Object.assign(customer, {
    recipe: "kake",
    combo: null,
    omit: null,
    extra: null,
    freestyle: false,
    side: false,
    sideKind: null,
    noodleTier: "regular",
    drink: id,
    drinkTemperature: "cold",
    patience: 600,
    maxPatience: 600,
    order: `Cho mình Kake Udon và ${DRINKS[id].name} lạnh nhé.`,
  });
  engine.accept(customer.id);
  engine.s.tray.push(dish(customer, id));
  for (const step of DRINK_METHODS[id])
    for (const ingredient of step.items || [])
      expect(addStock(engine.s, ingredient, 6, false, true)).toBe(true);
  expect(engine.drinkStart(id)).toBe(true);
  for (const step of DRINK_METHODS[id])
    expect(engine.drinkStep(step.action)).toBe(true);
  if (!validState(engine.s)) throw new Error(`Invalid fixture: ${id}`);
  return engine;
}
function dish(customer, id, index) {
  return {
    id: `dish${index ?? 0}`,
    orderId: customer.id,
    partIndex: index,
    stage: "ready",
    lifted: true,
    time: 10,
    duration: 9,
    broth: brothFormula(RECIPES.kake),
    tops: RECIPES.kake.tops,
    method: "hot",
    texture: "perfect",
    quality: 1,
    poured: true,
    noodleTier: "regular",
    drink: index === undefined ? null : id,
    drinkTemperature: index === 0 ? "cold" : index === 1 ? "hot" : null,
    side: false,
    sideKind: null,
  };
}
async function loaded(locator) {
  await expect(locator).toHaveCount(1);
  await expect
    .poll(() => locator.evaluate((img) => img.naturalWidth))
    .toBe(512);
}
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    for (const [id, drink] of Object.entries(DRINKS).filter(
      ([, d]) => d.coldAsset,
    )) {
      const engine = fixture(id);
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
      await page.addInitScript((state) => {
        if (!localStorage.getItem("udon-nang-v1"))
          localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
      }, engine.s);
      await page.goto("http://localhost:5173/");
      await page.locator('[data-act="start"]').tap();
      await page.locator('.scene-pagination [data-arg="drinks"]').tap();
      await page.locator(".prepared-drink").tap();
      const hotSrc = await page
        .locator(".brew-progress > .drink-art")
        .getAttribute("src");
      expect(hotSrc).not.toContain("-cold");
      await page.locator('[data-act="drink-chill"]').tap();
      await loaded(
        page.locator(`.brew-progress > img[src*="${drink.coldAsset}"]`),
      );
      await page.screenshot({
        path: `test-results/v3-cold-${id}-brew-${width}.png`,
      });
      await page.locator(".close-sheet").tap();
      await loaded(
        page.locator(`.prepared-drink > img[src*="${drink.coldAsset}"]`),
      );
      await page.locator(".tray-slot.filled").tap();
      await page.locator('[data-act="attach-drink"]').tap();
      await loaded(page.locator(`.tiny-drink img[src*="${drink.coldAsset}"]`));
      await page.reload();
      await page.locator('[data-act="start"]').tap();
      await loaded(page.locator(`.tiny-drink img[src*="${drink.coldAsset}"]`));
      await page.screenshot({
        path: `test-results/v3-cold-${id}-tray-${width}.png`,
      });
      await page.locator(".tray-slot.filled").tap();
      await page.locator(".customer").first().tap();
      await loaded(
        page.locator(
          `.table-bowl > img.table-drink[src*="${drink.coldAsset}"]`,
        ),
      );
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.close();
    }
    const engine = fixture("tea"),
      customer = engine.s.customers[0];
    engine.s.drink = null;
    const part = {
      recipe: "kake",
      drink: "tea",
      side: false,
      sideKind: null,
      omit: null,
      extra: null,
      noodleTier: "regular",
    };
    customer.combo = {
      parts: [
        { ...part, drinkTemperature: "cold" },
        { ...part, drinkTemperature: "hot" },
      ],
      delivered: [],
    };
    engine.s.tray = [dish(customer, "tea", 0), dish(customer, "tea", 1)];
    if (!validState(engine.s))
      throw new Error("Invalid mixed-temperature combo");
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await page.addInitScript((state) => {
      if (!localStorage.getItem("udon-nang-v1"))
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, engine.s);
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator(".tray-slot.filled").first().tap();
    await page.locator(".customer").first().tap();
    await loaded(
      page.locator('.combo-served-visual img.combo-drink[src*="sencha-cold"]'),
    );
    await page.reload();
    await page.locator('[data-act="start"]').tap();
    await loaded(
      page.locator('.combo-served-visual img.combo-drink[src*="sencha-cold"]'),
    );
    await page.locator(".tray-slot.filled").tap();
    await page.locator(".customer").first().tap();
    const pair = page.locator(".combo-table-bowl img.combo-drink");
    await expect(pair).toHaveCount(2);
    const sources = await pair.evaluateAll((images) =>
      images.map((img) => img.src),
    );
    expect(sources.filter((src) => src.includes("-cold"))).toHaveLength(1);
    expect(new Set(sources).size).toBe(2);
    await page.screenshot({
      path: `test-results/v3-cold-mixed-combo-${width}.png`,
    });
    await page.close();
  }
  console.log(
    "PASS: six hot-to-cold sprites, scene/tray/reload/serving and mixed hot/cold combo at 320/390px.",
  );
} finally {
  await browser.close();
}
