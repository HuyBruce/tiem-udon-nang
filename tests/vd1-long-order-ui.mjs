import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { yen } from "../src/systems/economy.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const engine = new Engine();
    engine.s.settings.font = "large";
    engine.open();
    const guest = engine.s.customers[0];
    guest.story =
      "Mình vừa tan ca sau một ngày dài, ghé tiệm vì nhớ mùi nước dùng và muốn ngồi lại một lát cho ấm người.";
    guest.order =
      "Cho mình một tô mì thủ công với nước dùng thật thơm, thêm phần topping hợp vị và một ly nước nhé. Hôm nay mình muốn ăn chậm, vị dịu và đừng quá cay.";
    guest.noodleTier = "handmade";
    engine.s.prices[guest.recipe] = 1200;

    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      engine.s,
    );
    await page.goto("http://localhost:5173");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await page.locator(".customer").first().tap();
    await expect(page.locator('.sheet[data-panel="order"]')).toBeVisible();
    await expect(page.locator(".order-header-price")).toHaveText(
      yen(engine.s.prices[guest.recipe] + 80),
    );
    await expect(page.locator(".order-header-price")).toBeInViewport();
    await expect(page.locator('.sheet [data-act="accept"]')).toBeInViewport();
    await page.screenshot({
      path: `test-results/vd1-long-order-initial-${width}.png`,
    });

    for (let i = 0; i < 3; i++) {
      await page.locator('.sheet [data-act="hint"]').tap();
      await expect(page.locator(".hint-answer")).toBeVisible();
    }

    const box = await page.evaluate(() => {
      const card = document.querySelector('.sheet[data-panel="order"]');
      if (!card) return null;
      const { x, y, width, height } = card.getBoundingClientRect();
      return { x, y, width, height };
    });
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await expect(page.locator('.sheet [data-act="accept"]')).toBeInViewport();
    await expect(page.locator('.sheet [data-act="hint"]')).toBeInViewport();
    await expect(page.locator(".close-sheet")).toBeInViewport();
    expect(
      await page.locator(".sheet-content").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
        return Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) <= 2;
      }),
    ).toBe(true);
    await page.screenshot({ path: `test-results/vd1-long-order-${width}.png` });
    await page.locator('.sheet [data-act="accept"]').tap();
    await expect(page.locator('.sheet[data-panel="order"]')).toHaveCount(0);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: long handmade order, large text and third hint stay usable on 320/390px phones.",
  );
} finally {
  await browser.close();
}
