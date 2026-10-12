import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const engine = new Engine();
    engine.open();
    engine.s.nextArrival = 1.5;
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      engine.s,
    );
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="front"]').tap();
    const owner = await page.locator(".stage.front .front-owner").boundingBox();
    const front = await page.locator(".stage.front").boundingBox();
    expect(owner.y + owner.height).toBeLessThan(front.y + front.height * 0.47);
    await page.waitForTimeout(1800);
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await expect(page.locator(".customer.just-arrived")).toHaveCount(1);
    await page.screenshot({ path: `test-results/vd1-guest-${width}.png` });
    await page.locator(".customer").first().tap();
    await expect(page.locator('.sheet[data-panel="order"]')).toBeVisible();
    await expect(page.locator("#panel-toast")).toBeHidden();
    const card = await page.locator('.sheet[data-panel="order"]').boundingBox();
    expect(Math.abs(card.y + card.height / 2 - height / 2)).toBeLessThan(35);
    expect(card.x).toBeGreaterThanOrEqual(10);
    expect(card.x + card.width).toBeLessThanOrEqual(width - 10);
    await expect(page.locator('.sheet [data-act="accept"]')).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `test-results/vd1-order-${width}.png` });
    await page.locator(".close-sheet").tap();
    await expect(page.locator(".customer.just-arrived")).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: half-body owner, one-time guest pop and centered order card at 320/390px.",
  );
} finally {
  await browser.close();
}
