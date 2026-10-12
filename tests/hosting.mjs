import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const url = process.env.GAME_URL;
if (!url?.startsWith("https://"))
  throw new Error("Set GAME_URL to the HTTPS deployment URL.");
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  const response = await page.goto(url, { waitUntil: "networkidle" });
  expect(response.status()).toBe(200);
  expect(new URL(page.url()).protocol).toBe("https:");
  await expect(
    page.getByRole("button", { name: "Bắt đầu ngày đầu tiên" }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Bắt đầu ngày đầu tiên" }).tap();
  await page.getByRole("button", { name: "Mở cửa đón khách" }).tap();
  await expect(page.locator("h1")).toHaveText("Khu khách");
  await expect(page.locator(".analog-clock")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("udon-nang-v1")).state.version)).toBe(2);
  await page.getByRole("button", { name: "Nói chuyện với Mai" }).tap();
  await page.getByRole("button", { name: "Mình làm ngay!" }).tap();
  await page.getByRole("button", { name: "Căn bếp", exact: true }).tap();
  await expect(page.locator("h1")).toHaveText("Căn bếp");
  await page.screenshot({ path: "test-results/cloudflare-mobile.png" });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Tiếp tục câu chuyện" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục câu chuyện" }).tap();
  await expect(page.locator("h1")).toHaveText("Khu khách");
  await expect(
    page.getByRole("button", { name: "#1 · Mai Đọc lại lời gọi món" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: " +
      url +
      " — HTTPS 200, mobile start/order/navigation, service worker, offline reload and saved order restored; no page errors.",
  );
} finally {
  await browser.close();
}
