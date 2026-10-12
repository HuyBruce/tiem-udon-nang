import { tapAction } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const offline = process.env.UDON_TEST_OFFLINE === "1";
await fs.mkdir("test-results", { recursive: true });
try {
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
    page.on("pageerror", (e) => errors.push(e.message));
    const tap = (act, arg) => tapAction(page, act, arg);
    const state = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
      );
    const images = () =>
      page.waitForFunction(() =>
        [...document.querySelectorAll("#app img")].every(
          (i) => i.complete && i.naturalWidth > 0,
        ),
      );
    await page.goto(base);
    if (offline) {
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();
      await page.context().setOffline(true);
    }
    await images();
    await page.waitForTimeout(650);
    const hero = await page.locator(".landing-art").boundingBox();
    expect(hero.height).toBeGreaterThan(height * 0.3);
    expect(
      await page
        .locator(".landing-art .scene-painting")
        .evaluate((i) => i.getBoundingClientRect().height),
    ).toBeGreaterThan(height * 0.3);
    const start = await page.locator('[data-act="start"]').boundingBox();
    expect(start.y + start.height).toBeLessThan(height);
    await expect(page.locator(".animated-noren .noren-panel")).toHaveCount(4);
    const lantern = page
      .locator('.hanging-lantern [data-motion-env="lantern"]')
      .first();
    const firstPose = await lantern.evaluate((i) => i.style.transform);
    await page.waitForTimeout(180);
    expect(await lantern.evaluate((i) => i.style.transform)).not.toBe(
      firstPose,
    );
    await page.screenshot({ path: `test-results/opening-v3-${width}.png` });
    await tap("start");
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").tap();
    expect(
      await page
        .locator(".hud small")
        .first()
        .evaluate((i) => parseFloat(getComputedStyle(i).fontSize)),
    ).toBeGreaterThanOrEqual(height < 650 ? 10 : 12);
    await tap("goto", "garden");
    await images();
    await page.locator(".scene-pet").tap();
    await expect(page.locator(".pet-choices article")).toHaveCount(2);
    const species = width === 320 ? "cat" : "shiba";
    await tap("pet-adopt", species);
    await images();
    expect((await state()).pet.species).toBe(species);
    await tap("pet-care", "feed");
    await expect(page.locator(".pet-portrait .sprite")).toHaveAttribute(
      "src",
      /eating/,
    );
    expect((await state()).pet.snacks).toBe(4);
    await tap("pet-care", "water");
    await tap("pet-care", "play");
    await tap("pet-care", "stroke");
    const money = (await state()).money;
    await tap("pet-buy");
    expect((await state()).money).toBe(money - 100);
    await page.locator("#pet-name").fill("Bạn Nhỏ");
    await page.waitForTimeout(2000);
    await expect(page.locator("#pet-name")).toHaveValue("Bạn Nhỏ");
    await tap("pet-rename");
    expect((await state()).pet.name).toBe("Bạn Nhỏ");
    await tap("pet-care", "sleep");
    await expect(
      page.locator('.pet-care-actions [data-arg="play"]'),
    ).toBeDisabled();
    await expect(page.locator(".pet-portrait .sprite")).toHaveAttribute(
      "src",
      /sleeping/,
    );
    await page.reload();
    await images();
    await tap("start");
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").tap();
    await tap("goto", "garden");
    await page.locator(".scene-pet").tap();
    expect((await state()).pet.sleeping).toBe(true);
    await tap("pet-care", "wake");
    await page.locator(".close-sheet").tap();
    await tap("panel", "settings");
    await page.locator('[data-setting="font"]').selectOption("large");
    await page.locator('[data-setting="animation"]').uncheck();
    await page.locator(".close-sheet").tap();
    await expect(page.locator("#app")).toHaveClass(/no-motion/);
    await expect(page.locator("#app")).toHaveClass(/large-font/);
    await page.locator(".scene-pet").tap();
    await images();
    expect(
      await page
        .locator(".pet-body")
        .first()
        .evaluate((i) => getComputedStyle(i).animationName),
    ).toBe("none");
    await page.screenshot({ path: `test-results/pets-v3-large-${width}.png` });
    await page.locator(".close-sheet").tap();
    await page.waitForTimeout(4600);
    for (const scene of ["garden", "front"]) {
      await tap("goto", scene);
      await images();
      const petBox = await page.locator(".scene-pet").boundingBox();
      const tools = await page.locator(".scene-pagination").boundingBox();
      expect(petBox.y + petBox.height).toBeLessThanOrEqual(tools.y + 1);
      await page.screenshot({
        path: `test-results/pets-v3-${scene}-${width}.png`,
      });
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: illustrated opening, live props, both pets, actual touch care/pantry/name/reload, 320/390 large text and reduced motion.",
  );
} finally {
  await browser.close();
}
