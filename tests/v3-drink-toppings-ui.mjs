import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { toppingFixture, finishDrink } from "./helpers/drink-toppings.mjs";
import { DRINK_TOPPINGS } from "../src/data.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { validState } from "../src/systems/validation.js";

const cases = [
  ["iceCream", "matcha", "cold"],
  ["whippedCream", "coffee", "hot"],
  ["sakura", "sakuraTea", "hot"],
  ["yuzu", "tea", "cold"],
];
const browser = await chromium.launch();
const baseUrl = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const offline = process.env.UDON_TEST_OFFLINE === "1";
async function open(state, width, large = false) {
  if (large) state.settings.font = "large";
  const page = await browser.newPage({
    viewport: { width, height: width === 320 ? 568 : 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript((state) => {
    if (!localStorage.getItem("udon-nang-v1"))
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
  }, state);
  await page.goto(baseUrl);
  if (offline) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.context().setOffline(true);
  }
  await page.locator('[data-act="start"]').tap();
  if (large) await expect(page.locator(".large-font")).toHaveCount(1);
  return { page, errors };
}
async function saved(page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
  );
}
async function topped(page, selector, asset, toppingClass = ".drink-topping") {
  const img = page.locator(selector + " " + toppingClass);
  await expect(img).toHaveCount(1);
  await expect(img).toHaveAttribute("src", new RegExp(asset));
  await expect.poll(() => img.evaluate((i) => i.naturalWidth)).toBe(512);
}
try {
  for (const width of [320, 390]) {
    for (const [top, id, temp] of cases) {
      const e = toppingFixture(top, id, temp),
        asset = DRINK_TOPPINGS[top].asset;
      const { page, errors } = await open(e.s, width, top === "whippedCream");
      await page.locator('.scene-pagination [data-arg="drinks"]').tap();
      await chooseWorkOption(page, '[data-work-detail]', "brew");
      await expect(page.locator(".drink-topping-options")).toHaveCount(0);
      for (const step of DRINK_METHODS[id])
        await page
          .locator(
            ` .brew-progress [data-act="drink-step"][data-arg="${step.action}"]`,
          )
          .filter({ visible: true })
          .tap();
      if (temp === "cold") {
        if (top === "iceCream")
          await expect(
            page.locator('[data-act="drink-topping"][data-arg="iceCream"]'),
          ).toHaveCount(0);
        await page.locator('[data-act="drink-chill"]').tap();
      }
      const button = page.locator(
        `[data-act="drink-topping"][data-arg="${top}"]`,
      );
      await button.tap();
      await expect(button).toBeDisabled();
      await topped(page, ".brew-progress > .topped-drink", asset);
      await page
        .locator(".brew-progress > .drink-art")
        .scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/v3-drink-topping-${top}-brew-${width}.png`,
      });
      expect((await saved(page)).drink.topping).toBe(top);
      await page.reload();
      await page.locator('[data-act="start"]').tap();
      await page.locator('.scene-pagination [data-arg="drinks"]').tap();
      await topped(
        page,
        ".prepared-drink .work-drink-visual",
        asset,
        ".work-drink-topping",
      );
      await page.locator(".tray-slot.filled").tap();
      await chooseWorkOption(page, '[data-work-detail]', "dish");
      await expect(page.locator('[data-act="attach-drink"]')).toContainText(
        DRINK_TOPPINGS[top].name,
      );
      await page.locator('[data-act="attach-drink"]').tap();
      await topped(page, ".tiny-drink > .topped-drink", asset);
      await page.reload();
      await page.locator('[data-act="start"]').tap();
      await topped(page, ".tiny-drink > .topped-drink", asset);
      await page.locator(".tray-slot.filled").tap();
      await page.locator(".customer").first().tap();
      await topped(page, ".table-bowl .guest-drink > .topped-drink", asset);
      const state = await saved(page);
      expect(state.customers[0].result.correct).toBe(true);
      expect(validState(state)).toBe(true);
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.close();
    }
    const e = toppingFixture("sakura", "tea", "cold"),
      c = e.s.customers[0];
    finishDrink(e);
    e.drinkChill();
    e.drinkTopping("sakura");
    e.attachDrink("dish1");
    const part = {
      recipe: "kake",
      omit: null,
      extra: null,
      drink: "tea",
      drinkTemperature: "cold",
      side: false,
      sideKind: null,
      noodleTier: "regular",
    };
    c.combo = {
      parts: [
        { ...part, drinkTopping: "sakura" },
        { ...part, drinkTopping: "yuzu" },
      ],
      delivered: [],
    };
    e.s.tray[0].partIndex = 0;
    e.s.tray.push({
      ...e.s.tray[0],
      id: "dish2",
      partIndex: 1,
      drinkTopping: "yuzu",
    });
    expect(validState(e.s)).toBe(true);
    const { page, errors } = await open(e.s, width);
    await page.locator(".order-ticket").first().tap();
    await expect(page.locator(".combo-part-list")).toContainText("Hoa sakura");
    await expect(page.locator(".combo-part-list")).toContainText("Lát yuzu");
    await page.screenshot({
      path: `test-results/v3-drink-topping-combo-order-${width}.png`,
    });
    await page.locator(".close-sheet").tap();
    await page.locator(".tray-slot.filled").first().tap();
    await page.locator(".customer").first().tap();
    await topped(page, ".combo-served-visual .topped-drink", "sakura");
    await page.reload();
    await page.locator('[data-act="start"]').tap();
    await topped(page, ".combo-served-visual .topped-drink", "sakura");
    await page.locator(".tray-slot.filled").tap();
    await page.locator(".customer").first().tap();
    const both = page.locator(".combo-table-bowl .drink-topping");
    await expect(both).toHaveCount(2);
    expect(
      (await both.evaluateAll((imgs) => imgs.map((i) => i.src))).filter((s) =>
        s.includes("sakura"),
      ),
    ).toHaveLength(1);
    expect(
      (await both.evaluateAll((imgs) => imgs.map((i) => i.src))).filter((s) =>
        s.includes("yuzu"),
      ),
    ).toHaveLength(1);
    await page.screenshot({
      path: `test-results/v3-drink-topping-combo-served-${width}.png`,
    });
    expect((await saved(page)).customers[0].result.correct).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
    const none = toppingFixture();
    finishDrink(none);
    none.s.inventory.cream = [];
    const empty = await open(none.s, width);
    await empty.page.locator('.scene-pagination [data-arg="drinks"]').tap();
    await chooseWorkOption(empty.page, '[data-work-detail]', "brew");
    await expect(
      empty.page.locator('[data-act="drink-topping"][data-arg="whippedCream"]'),
    ).toBeDisabled();
    expect(empty.errors).toEqual([]);
    await empty.page.close();
  }
  console.log(
    "PASS: four toppings, actual brew/chill/touch, large text, stock gate, tray/reload/table and distinct combo parts at 320/390px.",
  );
} finally {
  await browser.close();
}
