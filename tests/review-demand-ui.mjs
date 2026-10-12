import { chromium, expect } from "@playwright/test";
import { openPreparation } from "./ui-actions.mjs";
import { newState } from "../src/systems/state.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const state = newState();
    state.day = 2;
    state.reviews = [
      { name: "Mai", text: "Một bữa rất ngon.", stars: 5, day: 1 },
    ];
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (saved) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: saved })),
      state,
    );
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await openPreparation(page);
    await expect(
      page.locator(".morning-note", { hasText: "Lời khen hôm qua" }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/review-demand-morning-${width}.png`,
    });
    await page.locator('[data-act="open"]').tap();
    await expect(page.locator(".sheet")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: yesterday's review is explained and opening remains usable at 320/390px.",
  );
} finally {
  await browser.close();
}
