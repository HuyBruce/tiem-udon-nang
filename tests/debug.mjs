import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const actual = newState();
  actual.money = 93001;
  const original = JSON.stringify({ state: actual });
  await page.addInitScript((raw) => {
    if (!localStorage.getItem("udon-nang-v1"))
      localStorage.setItem("udon-nang-v1", raw);
  }, original);
  await page.goto("http://localhost:5173/?debug=1");
  await page.locator('[data-act="start"]').tap();
  await page
    .getByRole("button", { name: "Mở cửa đón khách", exact: true })
    .tap();
  await page.locator(".debug-tools summary").tap();
  await page.locator('[data-debug="money"]').tap();
  await page.locator('[data-debug="customer"]').tap();
  await expect(page.locator(".debug-tools output")).toHaveText("Khách đã vào.");
  await page.locator('[data-debug="event"]').selectOption({ index: 1 });
  await page.locator('[data-debug="hits"]').check();
  await expect(page.locator("html")).toHaveClass(/debug-hit-areas/);
  await page.locator('[data-debug="speed"]').selectOption("10");
  await page.waitForTimeout(700);
  await page.locator('[data-debug="money"]').tap();
  const debug = await page.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
  expect(debug.money).toBe(22400);
  expect(debug.customers.length).toBe(2);
  expect(debug.forecast.event).toBeTruthy();
  expect(debug.elapsed).toBeGreaterThan(4);
  expect(await page.evaluate(() => localStorage.getItem("udon-nang-v1"))).toBe(
    original,
  );
  await page.goto("http://localhost:5173/");
  await expect(page.locator(".debug-tools")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("udon-nang-v1")).state.money,
    ),
  ).toBe(93001);
  console.log(
    "PASS: debug speed, money, guest, event, hit areas; production save untouched and debug controls absent without query.",
  );
} finally {
  await browser.close();
}
