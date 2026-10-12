import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { brothFormula, recipeBook } from "../src/systems/discovery.js";
import { yen, quotedOrderTotal } from "../src/systems/economy.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const state = newState();
    state.day = 6;
    state.serial = width === 320 ? 47 : 12;
    const engine = new Engine(state);
    engine.open();
    const customer = engine.s.customers[0];
    engine.accept(customer.id);
    customer.combo.parts.forEach((part, index) => {
      const recipe = recipeBook(engine.s)[part.recipe];
      engine.s.tray.push({
        id: `dish${index + 1}`,
        orderId: customer.id,
        partIndex: index,
        stage: "ready",
        lifted: true,
        time: 10,
        duration: 9,
        broth: brothFormula(recipe),
        tops: [...recipe.tops, ...(part.extra ? [part.extra] : [])],
        method: recipe.kind || "hot",
        texture: "perfect",
        quality: 1,
        poured: true,
        noodleTier: part.noodleTier,
        drink: part.drink,
        side: part.side,
      });
    });
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
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await page.locator(".order-ticket").tap();
    await expect(page.locator(".combo-part")).toHaveCount(2);
    await expect(page.locator(".order-header-price")).toHaveText(
      yen(quotedOrderTotal(engine.s, customer)),
    );
    await expect(page.locator(".order-header-price")).toBeInViewport();
    // Larger readable text may require scrolling. Verify every part can be
    // reached above the persistent actions instead of requiring tiny text.
    await page.locator(".combo-part").last().scrollIntoViewIfNeeded();
    const orderGeometry = await page.evaluate(() => ({
      lastPartBottom: document
        .querySelector(".combo-part:last-child")
        .getBoundingClientRect().bottom,
      actionsTop: document
        .querySelector('.sheet[data-panel="order"] .button-pair')
        .getBoundingClientRect().top,
      prices: [...document.querySelectorAll(".combo-price")].map((price) => ({
        width: price.getBoundingClientRect().width,
        text: price.textContent,
      })),
    }));
    expect(orderGeometry.lastPartBottom).toBeLessThanOrEqual(
      orderGeometry.actionsTop,
    );
    expect(orderGeometry.prices).toHaveLength(2);
    await page.screenshot({ path: `test-results/v3-combo-order-${width}.png` });
    for (let i = 0; i < 3; i++) {
      await page.locator('.sheet [data-act="hint"]').tap();
      await expect(page.locator(".hint-answer")).toBeVisible();
    }
    await expect(page.locator('.sheet [data-act="accept"]')).toBeInViewport();
    await page.locator(".close-sheet").tap();
    await page.locator('.scene-pagination [data-arg="kitchen"]').tap();
    await expect(page.locator("[data-work-order] option")).toHaveCount(2);
    const secondPart = await page
      .locator("[data-work-order] option")
      .nth(1)
      .getAttribute("value");
    await page.locator("[data-work-order]").selectOption(secondPart);
    await expect(page.locator("[data-work-order]")).toHaveValue(secondPart);
    expect(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("udon-nang-v1")).state.selectedPart,
      ),
    ).toBe(1);
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();

    await page.locator(".tray-slot.filled").first().tap();
    await page.locator(".customer").first().tap();
    await expect(page.locator(".order-ticket")).toContainText("1/2");
    await expect(page.locator(".combo-served-visual .bowl-art")).toHaveCount(1);
    await page.screenshot({
      path: `test-results/v3-combo-partial-${width}.png`,
    });
    await page.locator(".order-ticket").tap();
    await expect(page.locator(".combo-part").first()).toContainText("Đã giao");
    await page.locator(".close-sheet").tap();

    await page.locator(".tray-slot.filled").first().tap();
    await page.locator(".customer").first().tap();
    await expect(
      page.locator(".table-bowl.combo-table-bowl .bowl-art"),
    ).toHaveCount(2);
    await expect(page.locator(".combo-table-bowl .combo-drink")).toHaveCount(
      customer.combo.parts.filter((part) => part.drink).length,
    );
    await expect(page.locator(".combo-table-bowl .combo-side")).toHaveCount(
      customer.combo.parts.filter((part) => part.side).length,
    );
    await expect(
      page.locator(
        '.combo-table-bowl .combo-side .side-plate[src*="tray-saucer"]',
      ),
    ).toHaveCount(customer.combo.parts.filter((part) => part.side).length);
    await expect(page.locator(".order-ticket")).toHaveCount(0);
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".customer .sprite")].every(
        (image) => image.complete && image.naturalWidth,
      ),
    );
    await page.screenshot({
      path: `test-results/v3-combo-complete-${width}.png`,
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
    "PASS: combo order, two kitchen parts, incremental delivery and two bowls at 320/390px.",
  );
} finally {
  await browser.close();
}
