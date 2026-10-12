import { tapAction, openPreparation } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { brothFormula } from "../src/systems/discovery.js";
import { RECIPES } from "../src/data.js";
import { validState } from "../src/systems/validation.js";
import balance from "../config/balance.json" with { type: "json" };

const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const offline = process.env.UDON_TEST_OFFLINE === "1";
async function openPage(state, width, height, clock = false) {
  expect(validState(state)).toBe(true);
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  if (clock) {
    await page.clock.install({ time: new Date("2026-10-05T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-05T12:00:01Z"));
  }
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((state) => {
    if (!localStorage.getItem("udon-nang-v1"))
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
  }, state);
  await page.goto(base);
  if (offline) {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.context().setOffline(true);
  }
  const tap = async (act, arg) => {
    await tapAction(page, act, arg);
    if (clock) await page.clock.runFor(100);
  };
  const read = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("udon-nang-v1")).state);
  await tap("start");
  return { page, tap, read, errors };
}
async function checkHeader(page) {
  const heading = await page.locator(".panel-heading h2").first().textContent();
  await expect(page.locator("#panel-title")).toHaveText(heading);
  await expect(page.getByRole("dialog")).toHaveAccessibleName(heading);
  const title = await page.locator("#panel-title").boundingBox();
  for (const selector of [".back-sheet", ".close-sheet"]) {
    if (!(await page.locator(selector).count())) continue;
    const box = await page.locator(selector).boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.y + box.height).toBeLessThanOrEqual(title.y + title.height + 1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const morning = new Engine();
    morning.s.settings.font = "large";
    morning.s.money = 100000;
    const nav = await openPage(morning.s, width, height);
    const { page, tap, read } = nav;
    await openPreparation(page);
    await checkHeader(page);
    await tap("panel", "inventory");
    await checkHeader(page);
    await tap("quality", "premium");
    const inspect = page.locator('.ingredient-inspect[data-arg="strawberry"]');
    await inspect.scrollIntoViewIfNeeded();
    const parentTop = await page
      .locator(".sheet-content")
      .evaluate((node) => node.scrollTop);
    expect(parentTop).toBeGreaterThan(400);
    const money = (await read()).money;
    // Touch actionability can scroll a clipped button further before pointerdown.
    // Verify restoration against the position the player actually left.
    await inspect.evaluate((node) => {
      node.addEventListener("pointerdown", () => {
        window.inventoryDepartureTop = document.querySelector(".sheet-content").scrollTop;
      }, { once: true, capture: true });
    });
    await inspect.tap();
    const departureTop = await page.evaluate(() => window.inventoryDepartureTop);
    expect(Number.isFinite(departureTop)).toBe(true);
    await checkHeader(page);
    await tap("panel-back");
    await expect(page.locator('.sheet[data-panel="inventory"]')).toBeVisible();
    expect(
      await page.locator(".sheet-content").evaluate((node) => node.scrollTop),
    ).toBeCloseTo(departureTop, 0);
    expect((await read()).money).toBe(money);
    const fixedTop = (await page.locator("#panel-title").boundingBox()).y;
    await page.locator(".sheet-content").evaluate((node) => {
      node.scrollTop = 0;
    });
    expect((await page.locator("#panel-title").boundingBox()).y).toBe(fixedTop);
    await expect(
      page.locator('[data-act="quality"][data-arg="premium"]'),
    ).toHaveClass("active");
    await page.screenshot({
      path: `test-results/v3-navigation-inventory-${width}.png`,
    });
    await tap("panel-back");
    await expect(page.locator('.sheet[data-panel="morning"]')).toBeVisible();
    // Optional preparation now has management as its parent.
    await expect(page.locator(".back-sheet")).toHaveCount(1);
    await tap("panel-back");
    await expect(page.locator('.sheet[data-panel="manage"]')).toBeVisible();
    await expect(page.locator(".back-sheet")).toHaveCount(0);
    await page.locator(".close-sheet").tap();
    await tap("panel", "manage");
    await tap("panel", "decor");
    await tap("preview-decor", "bowl");
    await checkHeader(page);
    await tap("confirm-decor", "bowl");
    await tap("panel-back");
    await expect(page.locator('.sheet[data-panel="manage"]')).toBeVisible();
    await page.locator(".close-sheet").tap();
    await tap("panel", "settings");
    await tap("panel", "help");
    await checkHeader(page);
    await tap("panel-back");
    await expect(page.locator('.sheet[data-panel="settings"]')).toBeVisible();
    await page.locator(".close-sheet").tap();
    await tap("panel", "recipes");
    await expect(page.locator(".back-sheet")).toHaveCount(0);
    expect(nav.errors).toEqual([]);
    await page.close();

    const cooking = new Engine();
    cooking.s.settings.font = width === 320 ? "large" : "normal";
    cooking.s.money = 100000;
    cooking.upgrade("stove");
    cooking.open();
    cooking.s.nextArrival = 1e9;
    cooking.accept(cooking.s.customers[0].id);
    cooking.s.burners[0].stage = "boiling";
    cooking.noodles(0);
    const pot = cooking.s.pots[0];
    pot.time = pot.duration + balance.cooking.liftWindowSeconds - 1;
    pot.stage = "ready";
    cooking.s.curryBatch = {
      ingredients: brothFormula(RECIPES.curry),
      stage: "ready",
      time: balance.cooking.brothSeconds,
      servings: 5,
      quality: 1,
    };
    cooking.selectBroth("curry");
    const cook = await openPage(cooking.s, width, height, true);
    await cook.tap("goto", "kitchen");
    await cook.tap("pot", "0");
    expect(
      await cook.page
        .locator(".cook-bowl")
        .evaluate((node) => getComputedStyle(node).webkitTapHighlightColor),
    ).toBe("rgba(0, 0, 0, 0)");
    await expect(cook.page.locator(".cook-status")).toHaveAttribute(
      "data-texture",
      "perfect",
    );
    await cook.page.clock.runFor(1250);
    await expect(cook.page.locator(".cook-status")).toHaveAttribute(
      "data-texture",
      "soft",
    );
    await expect(cook.page.locator(".cook-status")).toContainText("Đã quá giờ");
    await cook.page.screenshot({
      path: `test-results/v3-cooking-late-${width}.png`,
    });
    await cook.tap("lift-noodles", "0");
    expect((await cook.read()).pots[0].texture).toBe("soft");
    await expect(
      cook.page.locator('.sheet [data-act="panel"][data-arg="broth"]'),
    ).toContainText("cà ri");
    await cook.tap("panel", "broth");
    await checkHeader(cook.page);
    await expect(cook.page.locator("#panel-toast.show")).toHaveCount(0);
    await cook.tap("panel", "recipes");
    await cook.tap("panel-back");
    await expect(cook.page.locator('.sheet[data-panel="broth"]')).toBeVisible();
    await cook.tap("panel-back");
    await expect(cook.page.locator('.sheet[data-panel="cook"]')).toBeVisible();
    await cook.tap("pour");
    const saved = await cook.read();
    expect(saved.curryBatch.servings).toBe(4);
    expect(saved.brothBatch.servings).toBe(0);
    expect(saved.pots[0].broth).toEqual(brothFormula(RECIPES.curry));
    expect(
      await cook.page
        .locator('.tops [data-act="select-topping"]')
        .first()
        .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize)),
    ).toBe(width === 320 ? 15 : 12);
    expect(
      await cook.page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(validState(saved)).toBe(true);
    expect(cook.errors).toEqual([]);
    await cook.page.screenshot({
      path: `test-results/v3-cooking-curry-${width}.png`,
    });
    await cook.tap("select-topping", "onion");
    await cook.tap("add-topping", "0");
    await cook.tap("tray", "0");
    const finished = await cook.read();
    expect(finished.pots[0]).toBe(null);
    expect(finished.tray[0].tops).toContain("onion");
    expect(finished.tray[0].broth).toEqual(brothFormula(RECIPES.curry));
    expect(validState(finished)).toBe(true);
    await expect(cook.page.locator(".sheet")).toHaveCount(0);
    await cook.page.close();
  }
  console.log(
    "PASS: contextual fixed headers, 44px Back, nested scroll/quality preservation, preview history, settings return, five-second lift cue/actual texture and curry source at 320/390px.",
  );
} finally {
  await browser.close();
}
