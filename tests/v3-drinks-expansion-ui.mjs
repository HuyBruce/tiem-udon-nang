import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";
import { forecast } from "../src/systems/weather.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    const state = newState();
    state.day = 10;
    state.forecast = forecast(10);
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (save) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: save })),
      state,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").tap();
    await page.locator('[data-act="goto"][data-arg="drinks"]').tap();
    await page.locator('[data-act="panel"][data-arg="brew"]').first().tap();
    const cards = page.locator(".sheet .drink-menu button");
    await expect(cards).toHaveCount(10);
    const sources = await cards.locator("img").evaluateAll((images) =>
      images.map((image) => {
        if (!image.complete || image.naturalWidth === 0)
          throw new Error("Drink sprite failed to load");
        return image.currentSrc;
      }),
    );
    expect(new Set(sources).size).toBe(10);
    const expanded = [
      "hojichaLatte",
      "sakuraTea",
      "melonSoda",
      "strawberryMilk",
    ];
    for (const id of expanded) {
      const card = page.locator(
        `.sheet [data-act="drink-start"][data-arg="${id}"]`,
      );
      await expect(card).toBeEnabled();
      await card.locator("img").evaluate((image) => {
        if (!image.complete || image.naturalWidth === 0)
          throw new Error("Drink sprite failed to load");
      });
    }
    await page.screenshot({
      path: `test-results/v3-drinks-expanded-${width}.png`,
    });
    await page
      .locator('[data-act="drink-start"][data-arg="strawberryMilk"]')
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `test-results/v3-drinks-expanded-bottom-${width}.png`,
    });
    await page
      .locator('[data-act="drink-start"][data-arg="strawberryMilk"]')
      .tap();
    await expect(page.locator(".brew-progress h3")).toHaveText("Sữa dâu");
    await expect(page.locator(".brew-progress")).toContainText("Lạnh");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  const large = newState();
  large.day = 10;
  large.forecast = forecast(10);
  large.settings.font = "large";
  const page = await browser.newPage({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await page.addInitScript(
    (save) =>
      localStorage.setItem("udon-nang-v1", JSON.stringify({ state: save })),
    large,
  );
  await page.goto("http://localhost:5173/");
  await page.locator('[data-act="start"]').tap();
  if (await page.locator(".close-sheet").count())
    await page.locator(".close-sheet").tap();
  await page.locator('[data-act="goto"][data-arg="drinks"]').tap();
  await page.locator('[data-act="panel"][data-arg="brew"]').first().tap();
  await page
    .locator('[data-act="drink-start"][data-arg="strawberryMilk"]')
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "test-results/v3-drinks-expanded-large-320.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.close();
  console.log(
    "PASS: ten distinct drink sprites and cold drink flow at 320/390px, including large text.",
  );
} finally {
  await browser.close();
}
