import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { mkdir } from "node:fs/promises";

const fixture = new Engine();
fixture.s.money = 20000;
fixture.open();
const guest = fixture.s.customers[0];
guest.status = "checkout";
guest.accepted = true;
guest.checkoutTime = 8;
guest.result = {
  correct: true,
  score: 90,
  payment: 600,
  tip: 30,
  rep: 1.5,
  review: "Cảm ơn vì bữa ăn!",
};
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
try {
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 320 ? 568 : 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript((state) => localStorage.setItem("udon-nang-v1", JSON.stringify({ state })), fixture.s);
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').click();
    await page.locator('.scene-pagination [data-arg="guests0"]').click();
    const collect = page.locator(`.table-bowl[data-arg="${guest.id}"]`);
    await expect(collect).toHaveAttribute("aria-label", "Thu tiền");
    await expect(collect).toContainText("Thu tiền");
    await page.screenshot({ path: `test-results/v3-checkout-${width}.png` });
    await collect.click();
    await expect.poll(async () => {
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem("udon-nang-v1")).state);
      return state.ledger.served;
    }).toBe(1);
    await page.locator('[data-act="panel"][data-arg="manage"]').click();
    await page.locator('[data-act="panel"][data-arg="employees"]').click();
    const mika = page.locator(".employee").filter({ hasText: "Mika" });
    await expect(mika).toContainText("Thu ngân");
    await expect(mika.locator('img[src*="v3-mika"]')).toHaveCount(1);
    await expect(mika.locator('[data-act="hire"][data-arg="mika"]')).toContainText("¥ 5.500");
    await mika.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/v3-cashier-${width}.png` });
    await mika.locator('[data-act="hire"][data-arg="mika"]').click();
    await expect.poll(async () => {
      const state = await page.evaluate(() => JSON.parse(localStorage.getItem("udon-nang-v1")).state);
      return state.employees.mika?.level;
    }).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log("PASS: mobile checkout and Mika hiring panel at 320 and 390 px.");
} finally {
  await browser.close();
}
