import { tapAction } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { forecast } from "../src/systems/weather.js";
import fs from "node:fs/promises";
const browser = await chromium.launch();
await fs.mkdir("test-results", { recursive: true });
try {
  for (const [width, height] of [
    [360, 800],
    [375, 812],
    [390, 844],
    [393, 873],
    [430, 932],
  ]) {
    const context = await browser.newContext({
        viewport: { width, height },
        hasTouch: true,
        isMobile: true,
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const e = new Engine();
    e.s.day = 8;
    e.s.forecast = forecast(8);
    e.s.money = 90000;
    e.s.reputation = 40;
    for (const batches of Object.values(e.s.inventory))
      for (const b of batches) b.expires += 10;
    for (let i = 0; i < 3; i++) e.upgrade("seats");
    e.upgrade("storage");
    e.hire("thu");
    e.hire("binh");
    e.hire("yui");
    await page.addInitScript((s) => {
      if (!localStorage.getItem("extended-seed")) {
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: s }));
        localStorage.setItem("extended-seed", "1");
      }
    }, e.s);
    const tap = (act, arg) => tapAction(page, act, arg);
    const close = async () => {
      if (await page.locator(".close-sheet").count())
        await page.locator(".close-sheet").tap();
    };
    const state = () =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("udon-nang-v1")).state,
      );
    const panel = async (id) => {
      await tap("panel", "manage");
      await tap("panel", id);
    };
    await page.goto("http://localhost:5173");
    await tap("start");
    await close();
    for (const id of [
      "inventory",
      "recipes",
      "menu",
      "upgrades",
      "decor",
      "employees",
    ]) {
      await panel(id);
      if (id === "employees") {
        const portraits = await page
          .locator(".employee .portrait-art img")
          .evaluateAll((images) =>
            images.map((image) => image.getAttribute("src")),
          );
        expect(portraits.length).toBe(4);
        for (const staff of ["thu", "binh", "mika", "yui"])
          expect(portraits.some((src) => src.includes(`v3-${staff}`))).toBe(
            true,
          );
      }
      const closeBox = await page.locator(".close-sheet").boundingBox();
      expect(closeBox.width).toBeGreaterThanOrEqual(44);
      expect(closeBox.height).toBeGreaterThanOrEqual(44);
      await page
        .locator(".sheet-content")
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
      const box = await page.locator(".close-sheet").boundingBox();
      expect(box.y).toBe(closeBox.y);
      expect(
        await page
          .locator(".sheet-content")
          .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      ).toBe(true);
      await close();
    }
    await tap("goto", "guests3");
    expect(await page.locator("h1").innerText()).toBe("Góc cửa sổ 3");
    await tap("goto", "kitchen");
    await tap("panel", "handmade");
    for (let i = 0; i < 5; i++) await tap("handmade");
    await expect.poll(async () => (await state()).handmade.portions).toBe(5);
    await tap("noodle-tier", "handmade");
    await close();
    await tap("goto", "drinks");
    await tap("panel", "brew");
    await tap("drink-start", "matcha");
    await tap("drink-step", "matcha");
    await tap("drink-step", "water");
    await page.locator('[data-craft="whisk"]').scrollIntoViewIfNeeded();
    const rect = await page.locator('[data-craft="whisk"]').boundingBox(),
      cdp = await context.newCDPSession(page);
    const cx = rect.x + rect.width / 2,
      cy = rect.y + rect.height / 2,
      r = 52;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: cx + r, y: cy, id: 1 }],
    });
    for (let i = 1; i <= 24; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: cx + Math.cos((i * Math.PI) / 12) * r,
            y: cy + Math.sin((i * Math.PI) / 12) * r,
            id: 1,
          },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect.poll(async () => (await state()).drink.step).toBe(3);
    await tap("drink-step", "milk");
    await tap("drink-step", "art");
    await expect.poll(async () => (await state()).drink.step).toBe(5);
    await page.screenshot({ path: `test-results/extended-${width}-drink.png` });
    await close();
    await panel("decor");
    const money = (await state()).money;
    await tap("preview-decor", "bowl");
    expect((await state()).money).toBe(money);
    await page.screenshot({
      path: `test-results/extended-${width}-preview.png`,
    });
    await tap("confirm-decor", "bowl");
    expect((await state()).money).toBeLessThan(money);
    await close();
    await tap("panel", "settings");
    await page.locator('[data-setting="musicVolume"]').fill("0.25");
    await page.locator('[data-setting="sfxVolume"]').fill("0.4");
    await page.locator('[data-setting="font"]').selectOption("large");
    await expect
      .poll(async () => (await state()).settings.musicVolume)
      .toBe(0.25);
    await close();
    await page.reload();
    await tap("start");
    expect((await state()).settings.sfxVolume).toBe(0.4);
    expect((await state()).handmade.portions).toBe(5);
    expect(errors).toEqual([]);
    await context.close();
  }
  console.log(
    "PASS: five required phone sizes; scrolling panels with fixed close, nine scenes, handmade, genuine circular whisk gesture, latte art fallback, preview before payment, volume persistence.",
  );
} finally {
  await browser.close();
}
