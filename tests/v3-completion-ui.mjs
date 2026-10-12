import { tapAction } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { addStock } from "../src/systems/inventory.js";
import { INGREDIENTS } from "../src/data.js";
import { brothFormula, recipeBook } from "../src/systems/discovery.js";
import { validState } from "../src/systems/validation.js";
const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const offline = process.env.UDON_TEST_OFFLINE === "1";
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const engine = new Engine();
    const s = engine.s;
    s.day = 20;
    s.money = 100000;
    s.serial = 12;
    s.upgrades.storage = 3;
    s.settings.font = "large";
    for (const id of Object.keys(INGREDIENTS)) addStock(s, id, 30, false, true);
    engine.unlock("cold");
    engine.hire("yui");
    engine.hire("yui");
    engine.hire("yui");
    engine.open();
    const c = s.customers[0];
    engine.accept(c.id);
    s.nextArrival = 1e9;
    expect(c.combo.parts.length).toBe(3);
    for (const [i, part] of c.combo.parts.entries()) {
      const r = recipeBook(s)[part.recipe];
      s.tray.push({
        id: "dish" + i,
        orderId: c.id,
        partIndex: i,
        stage: "ready",
        lifted: true,
        time: 9,
        duration: 9,
        broth: brothFormula(r),
        tops: r.tops.filter((t) => t !== part.omit),
        method: r.kind || "hot",
        texture: "perfect",
        quality: 1,
        poured: true,
        noodleTier: part.noodleTier,
        drink: part.drink,
        drinkTemperature: part.drinkTemperature,
        drinkTopping: part.drinkTopping,
        side: part.side,
        sideKind: part.sideKind,
      });
    }
    expect(validState(s)).toBe(true);
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((state) => {
      if (!localStorage.getItem("udon-nang-v1"))
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, s);
    const read = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
      );
    const tap = (act, arg) => tapAction(page, act, arg);
    const images = () =>
      page.waitForFunction(() =>
        [...document.querySelectorAll("#app img")].every(
          (i) => i.complete && i.naturalWidth,
        ),
      );
    await page.goto(base);
    if (offline) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.context().setOffline(true);
    }
    await tap("start");
    await tap("panel", "manage");
    await tap("panel", "side-prep");
    await images();
    await expect(page.locator(".side-prep-recipes article")).toHaveCount(3);
    await tap("side-prep-start", "karaage");
    for (let i = 0; i < 3; i++) await tap("side-prep-step");
    await expect(page.locator('[data-act="side-prep-step"]')).toBeDisabled();
    await page.waitForTimeout(2100);
    await page.reload();
    await tap("start");
    await tap("panel", "manage");
    await tap("panel", "side-prep");
    expect((await read()).sidePrep.id).toBe("karaage");
    await expect(page.locator('[data-act="side-prep-step"]')).toBeEnabled({
      timeout: 12000,
    });
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-side-${width}.png`,
    });
    await tap("side-prep-step");
    expect((await read()).prepared.karaage).toBe(3);
    await page.locator(".close-sheet").tap();
    await tap("panel", "manage");
    await tap("panel", "staff-recipes");
    const money = (await read()).money;
    await tap("teach-recipe", "cold");
    expect((await read()).employees.yui.learning.recipe).toBe("cold");
    expect((await read()).money).toBeLessThan(money);
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-yui-${width}.png`,
    });
    await page.locator(".close-sheet").tap();
    await tap("goto", "kitchen");
    await tap("panel", "broth");
    for (let i = 0; i < 3; i++) await tap("batch-add", "dashi");
    await expect(
      page.locator('[data-act="batch-add"][data-arg="dashi"]'),
    ).toBeDisabled();
    await tap("batch-add", "soy");
    await tap("batch-add", "mirin");
    expect((await read()).brothBatch.ingredients.length).toBe(5);
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-broth-${width}.png`,
    });
    await tap("batch-cook");
    await page.locator(".close-sheet").tap();
    await tap("goto", "guests0");
    await page.locator(".order-ticket").first().tap();
    await expect(page.locator(".combo-part")).toHaveCount(3);
    await page.locator(".combo-part").last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-combo-${width}.png`,
    });
    await page.locator(".close-sheet").tap();
    await tap("dish", "dish0");
    await tap("customer", c.id);
    expect((await read()).customers[0].combo.delivered.length).toBe(1);
    await page.reload();
    await tap("start");
    await tap("goto", "guests0");
    for (const id of ["dish1", "dish2"]) {
      await tap("dish", id);
      await tap("customer", c.id);
    }
    expect((await read()).customers[0].status).toBe("eating");
    await page.waitForTimeout(8500);
    await tap("customer", c.id);
    expect((await read()).ledger.served).toBe(1);
    await tap("panel", "manage");
    await tap("panel", "neighbourhood");
    await expect(page.locator(".neighbourhood-goal progress")).toHaveCount(5);
    await images();
    await page.waitForTimeout(350);
    await page.screenshot({
      animations: "disabled",
      path: `test-results/completion-goal-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(validState(await read())).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: real side preparation/reload, paid Yui learning, five-part broth, three-bowl combo/reload/one bill, progression, large text 320/390.",
  );
} finally {
  await browser.close();
}
