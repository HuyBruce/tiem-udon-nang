import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    (process.env.GAME_URL || "http://localhost:5173") + "/?art-preview=1",
  );
  await expect(page.locator(".art-layer img")).toHaveCount(3);
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".art-layer img")].every(
      (i) => i.complete && i.naturalWidth,
    ),
  );
  await page.getByRole("button", { name: "Tô Kake udon", exact: true }).tap();
  await expect(page.locator('[role="status"]')).toHaveText("Tô Kake udon");
  await page
    .getByRole("button", { name: "Ấm trà gốm xanh", exact: true })
    .tap();
  await expect(page.locator('[role="status"]')).toHaveText("Ấm trà gốm xanh");
  expect(
    await page.evaluate(() => localStorage.getItem("udon-nang-v1")),
  ).toBeNull();
  await fs.mkdir("docs/review", { recursive: true });
  await page.screenshot({
    path: "docs/review/preview-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Về lại tiệm" }).tap();
  await expect(page.locator('[data-act="start"]')).toBeVisible();
  await page.locator('[data-act="start"]').tap();
  if (await page.locator(".close-sheet").count())
    await page.locator(".close-sheet").tap();
  await expect(page.locator(".noren-letters span")).toHaveText([
    "U",
    "D",
    "O",
    "N",
  ]);
  for (const [scene, id, title] of [
    ["drinks", "brew", "Pha một chút mát lành"],
    ["kitchen", "broth", ""],
    ["storage", "inventory", ""],
    ["garden", "garden", ""],
  ]) {
    await page.locator(`.scene-pagination [data-arg="${scene}"]`).tap();
    await page.locator(`.sprite-touch[data-arg="${id}"]`).first().tap();
    await expect(page.locator(".sheet")).toBeVisible();
    await page.locator(".close-sheet").tap();
  }
  expect(errors).toEqual([]);
  console.log(
    "PASS: external sprites load, touch inspection leaves save untouched, UDON has four panels, direct object hotspots work.",
  );
} finally {
  await browser.close();
}
