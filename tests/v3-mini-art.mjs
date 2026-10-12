import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const engine = new Engine();
    engine.s.reputation = 40;
    engine.s.drink = {
      id: "matcha",
      step: 2,
      quality: 0.2,
      temperature: "hot",
      strange: false,
    };
    await page.addInitScript((state) => {
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
    }, engine.s);
    await page.goto("http://localhost:5173");
    const loadedSprite = async (selector) => {
      const image = page.locator(selector);
      await expect(image).toHaveCount(1);
      await expect
        .poll(() => image.evaluate((img) => img.naturalWidth))
        .toBeGreaterThan(0);
    };
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="kitchen"]').click();
    await loadedSprite('.stage .pot-hit img[src*="v3-noodle-pot-empty"]');

    await page.locator('.stage [data-arg="fryer"]').click();
    await loadedSprite('.fryer-art img[src*="v2-fryer"]');
    await page.screenshot({ path: `test-results/v3-fryer-${width}.png` });
    await page.locator(".close-sheet").click();

    await page.locator('.stage [data-act="chop-open"]').click();
    await loadedSprite('.chop-board img[src*="v2-board"]');
    await expect(page.locator(".cut-line")).toHaveCount(3);
    await page.screenshot({ path: `test-results/v3-chop-${width}.png` });
    await page.locator(".close-sheet").click();

    await page.locator('.stage [data-act="pot"]').first().click();
    await loadedSprite('.pot-preview img[src*="v3-noodle-pot-empty"]');
    await page.screenshot({ path: `test-results/v3-pot-${width}.png` });
    await page.locator('.sheet [data-act="burner"]').click();
    await loadedSprite('.pot-preview img[src*="v3-noodle-pot-water"]');
    await page.screenshot({ path: `test-results/v3-pot-water-${width}.png` });
    await page.locator(".close-sheet").click();
    await loadedSprite('.stage .pot-hit img[src*="v3-noodle-pot-water"]');

    await page.locator('.stage [data-arg="handmade"]').click();
    for (const [stage, id] of [
      "v3-handmade-flour",
      "v3-handmade-dry",
      "v3-handmade-wet",
      "v3-handmade-dough",
      "v3-handmade-sheet",
    ].entries()) {
      await loadedSprite(`.handmade-board img[src*="${id}"]`);
      await page.screenshot({
        path: `test-results/v3-handmade-${stage}-${width}.png`,
      });
      await page.locator('.sheet [data-act="handmade"]').click();
    }
    await loadedSprite('.handmade-board img[src*="v3-handmade-cut"]');
    await expect(page.locator(".handmade-board span")).toContainText(
      "Năm vắt mì đã sẵn sàng",
    );
    await page.screenshot({
      path: `test-results/v3-handmade-finished-${width}.png`,
    });
    await page.locator('.sheet [data-act="handmade"]').click();
    await loadedSprite('.handmade-board img[src*="v3-handmade-dry"]');
    await page.locator(".close-sheet").click();

    await page.locator('.scene-pagination [data-arg="drinks"]').click();
    await page.locator('.stage [data-arg="brew"]').first().click();
    await loadedSprite('.drink-gesture img[src*="v3-drink-matcha-latte"]');
    await page.screenshot({ path: `test-results/v3-whisk-${width}.png` });
    expect(errors).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.close();
  }
  const coffeePage = await browser.newPage({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
  });
  const coffeeEngine = new Engine();
  coffeeEngine.s.burners[0] = { stage: "boiling", time: 0 };
  coffeeEngine.s.drink = {
    id: "coffee",
    step: 3,
    quality: 0.3,
    temperature: "hot",
    strange: false,
  };
  await coffeePage.addInitScript((state) => {
    localStorage.setItem("udon-nang-v1", JSON.stringify({ state }));
  }, coffeeEngine.s);
  await coffeePage.goto("http://localhost:5173");
  await coffeePage.locator('[data-act="start"]').click();
  await coffeePage.locator(".close-sheet").click();
  await coffeePage.locator('.scene-pagination [data-arg="kitchen"]').click();
  const boilingSceneImage = coffeePage.locator(
    '.stage .pot-hit img[src*="v3-noodle-pot-boiling"]',
  );
  await expect(boilingSceneImage).toHaveCount(1);
  await expect
    .poll(() => boilingSceneImage.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  const steam = coffeePage.locator('.stage .pot-hit img[src*="kitchen-steam"]');
  await expect(steam).toHaveCount(1);
  await expect
    .poll(() => steam.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(
    await steam.evaluate((img) => getComputedStyle(img).pointerEvents),
  ).toBe("none");
  expect(
    await steam.evaluate((img) => getComputedStyle(img).animationName),
  ).toBe("steam");
  await coffeePage.screenshot({
    path: "test-results/v3-kitchen-pot-boiling-320.png",
  });
  expect(
    await coffeePage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await coffeePage.setViewportSize({ width: 390, height: 844 });
  await coffeePage.screenshot({
    path: "test-results/v3-kitchen-pot-boiling-390.png",
  });
  await coffeePage.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await steam.evaluate((img) => getComputedStyle(img).animationName),
  ).toBe("none");
  await coffeePage.locator('.stage [data-act="pot"]').first().click();
  const boilingImage = coffeePage.locator(
    '.pot-preview img[src*="v3-noodle-pot-boiling"]',
  );
  await expect(boilingImage).toHaveCount(1);
  await expect
    .poll(() => boilingImage.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  await coffeePage.waitForTimeout(300);
  await coffeePage.screenshot({ path: "test-results/v3-pot-boiling-390.png" });
  await coffeePage.locator(".close-sheet").click();
  await coffeePage.locator('.scene-pagination [data-arg="drinks"]').click();
  await coffeePage.locator('.stage [data-arg="brew"]').first().click();
  const coffeeImage = coffeePage.locator(
    '.drink-gesture img[src*="v3-coffee-milk"]',
  );
  await expect(coffeeImage).toHaveCount(1);
  await expect
    .poll(() => coffeeImage.evaluate((img) => img.naturalWidth))
    .toBeGreaterThan(0);
  await coffeePage.waitForTimeout(300);
  await coffeePage.screenshot({ path: "test-results/v3-coffee-art-390.png" });
  await coffeePage.close();
  console.log(
    "PASS: fryer, chop, pot, five handmade stages, finished noodles, matcha and coffee panels use file assets at 320/390 px; no JS errors or horizontal overflow.",
  );
} finally {
  await browser.close();
}
