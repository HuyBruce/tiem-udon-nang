import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
});
page.on("pageerror", (e) => console.error(e));
await page.goto("http://localhost:5173");
await page.screenshot({ path: "test-results/landing.png" });
await page.getByRole("button", { name: "Bắt đầu ngày đầu tiên" }).click();
await page.screenshot({ path: "test-results/morning.png" });
await page.getByRole("button", { name: "Mở cửa đón khách" }).click();
await page.screenshot({ path: "test-results/guests.png" });
console.log(await page.locator("main").innerText());
await page.getByRole("button", { name: "Căn bếp", exact: true }).click();
await page.screenshot({ path: "test-results/kitchen.png" });
await browser.close();
