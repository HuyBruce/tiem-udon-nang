import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { makeCustomer } from "../src/systems/customers.js";
import { addStock } from "../src/systems/inventory.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { DRINKS, RECIPES } from "../src/data.js";
import { brothFormula } from "../src/systems/discovery.js";
import { validState } from "../src/systems/validation.js";

let state;
let customer;
for (let serial = 0; serial < 80; serial++) {
  const candidate = newState();
  candidate.day = 6;
  candidate.serial = serial;
  const c = makeCustomer(candidate, 0);
  if (
    c.drinkTemperature === "cold" &&
    DRINKS[c.drink]?.temperatureOptions &&
    !c.combo &&
    !c.side &&
    !c.freestyle &&
    !c.extra
  ) {
    state = candidate;
    customer = c;
    break;
  }
}
if (!state) throw new Error("No cold order found");
state.phase = "open";
state.customers.push(customer);
for (const step of DRINK_METHODS[customer.drink])
  for (const ingredient of step.items || [])
    addStock(state, ingredient, 4, false, true);
const engine = new Engine(state);
const recipe = RECIPES[customer.recipe];
engine.s.tray.push({
  id: "dish1",
  orderId: customer.id,
  stage: "ready",
  lifted: true,
  time: 10,
  duration: 9,
  broth: brothFormula(recipe),
  tops: recipe.tops.filter((id) => id !== customer.omit),
  method: recipe.kind || "hot",
  texture: "perfect",
  quality: 1,
  poured: true,
  noodleTier: customer.noodleTier,
  drink: null,
  drinkTemperature: null,
  side: false,
  sideKind: null,
});
engine.drinkStart(customer.drink);
for (const step of DRINK_METHODS[customer.drink]) engine.drinkStep(step.action);
if (!validState(engine.s)) throw new Error("Invalid cold-order fixture");

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
    await expect(page.locator(".sheet")).toContainText("lạnh");
    await page.screenshot({
      path: `test-results/v3-drink-cold-order-${width}.png`,
    });
    await page.locator(".close-sheet").tap();
    await page.locator('.scene-pagination [data-arg="drinks"]').tap();
    await chooseWorkOption(page, '[data-work-detail]', "brew");
    await expect(page.locator('[data-act="drink-chill"]')).toBeVisible();
    await page.screenshot({
      path: `test-results/v3-drink-chill-before-${width}.png`,
    });
    await page.locator('[data-act="drink-chill"]').tap();
    await expect(page.locator(".brew-progress")).toContainText("Lạnh");
    await expect(page.locator('[data-act="drink-chill"]')).toHaveCount(0);
    await page.locator(".close-sheet").tap();
    await page.locator(".tray-slot.filled").tap();
    await chooseWorkOption(page, '[data-work-detail]', "dish");
    await expect(page.locator('[data-act="attach-drink"]')).toContainText(
      "lạnh",
    );
    await page.locator('[data-act="attach-drink"]').tap();
    await expect(page.locator(".tray-slot.filled")).toContainText("lạnh");
    await page.screenshot({
      path: `test-results/v3-drink-cold-tray-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: cold order, chilling action, attachment and tray at 320/390px.",
  );
} finally {
  await browser.close();
}
