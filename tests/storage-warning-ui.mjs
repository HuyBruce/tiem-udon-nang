import { chromium, expect } from "@playwright/test";
import { openPreparation } from "./ui-actions.mjs";
import { newState } from "../src/systems/state.js";
import { forecast } from "../src/systems/weather.js";
import { stockSize, capacity } from "../src/systems/inventory.js";

const browser = await chromium.launch();
try {
  const state = newState();
  state.day = 6;
  state.forecast = forecast(6);
  for (const batches of Object.values(state.inventory))
    for (const batch of batches) batch.expires += 10;
  expect(stockSize(state)).toBe(capacity(state));
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (save) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: save })),
      state,
    );
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await openPreparation(page);
    await expect(page.locator(".sheet")).toContainText("Kho đã đầy 18 loại");
    await expect(page.locator(".sheet")).toContainText("nâng cấp kho");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator('.sheet [data-act="open"]').tap();
    await expect(page.locator(".sheet")).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: full pantry warning is readable and opening remains available at 320 and 390px.",
  );
} finally {
  await browser.close();
}
