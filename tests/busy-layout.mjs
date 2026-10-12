import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const engine = new Engine();
    engine.s.money = 90000;
    for (let i = 0; i < 3; i++) engine.upgrade("stove");
    engine.s.settings.font = "large";
    engine.open();
    engine.spawn();
    engine.s.customers[0].order =
      "Mình vừa đi một vòng qua con hẻm, bụng đói quá. Cho mình một tô Kake udon thật thơm nhé. Kèm trà nóng và đừng thêm hành.";
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      engine.s,
    );
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await page.waitForFunction(() =>
      [...document.querySelectorAll(".stage img")].every(
        (i) => i.complete && i.naturalWidth,
      ),
    );
    const stageBox = await page.locator(".stage").boundingBox();
    for (const bubble of await page.locator(".customer-call").all()) {
      const box = await bubble.boundingBox();
      expect(box.y).toBeGreaterThanOrEqual(stageBox.y);
      expect(box.height).toBeLessThanOrEqual(80);
    }
    await page.screenshot({ path: `test-results/busy-guests-${width}.png` });
    const tutorial = await page.locator(".tutorial").boundingBox();
    const tray = await page.locator(".wooden-tray").boundingBox();
    if (tutorial)
      expect(tutorial.y + tutorial.height).toBeLessThanOrEqual(tray.y);
    await expect(page.locator(".order-ticket")).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await page.locator(".customer").nth(i).tap();
      await expect(page.locator(".sheet")).toBeVisible();
      await page.locator(".close-sheet").tap();
    }
    await page.locator('.scene-pagination [data-arg="kitchen"]').tap();
    const tools = await page
      .locator(".world-room.kitchen .sprite-touch")
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          );
          return {
            label: button.getAttribute("aria-label"),
            accessible: hit === button || button.contains(hit),
          };
        }),
      );
    expect(tools).toHaveLength(4);
    for (const tool of tools)
      expect(tool.accessible, JSON.stringify(tool)).toBe(true);
    for (const panel of ["broth", "fryer", "chop"]) {
      await chooseWorkOption(page, '[data-work-detail]', panel);
      await expect(page.locator(".sheet")).toBeVisible();
      await page.locator(".close-sheet").tap();
    }
    const pots = page.locator(".pot-hit");
    for (let i = 0; i < (await pots.count()); i++) {
      await pots.nth(i).tap();
      await chooseWorkOption(page, '[data-work-detail]', "cook");
      await expect(page.locator(".sheet")).toBeVisible();
      await page.locator(".close-sheet").tap();
    }
    await page.screenshot({ path: `test-results/busy-kitchen-${width}.png` });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  console.log(
    "PASS: two guests, long order, large text and upgraded stove; direct pot, broth, fryer and chopping taps at 320 and 390px.",
  );
} finally {
  await browser.close();
}
