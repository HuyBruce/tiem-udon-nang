import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";

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
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator('[data-act="toggle-shop"]').tap();
    await page.locator('[data-act="panel"][data-arg="recipes"]').first().tap();
    await expect(page.locator(".sheet .recipe-list")).toHaveAttribute(
      "data-count",
      "35",
    );
    await page.screenshot({
      path: `test-results/v3-catalog-filter-${width}.png`,
    });
    await page.locator('[data-act="recipe-filter"][data-arg="learned"]').tap();
    await expect(page.locator(".sheet .recipe-list")).toHaveAttribute(
      "data-count",
      "3",
    );
    await page
      .locator('[data-act="recipe-filter"][data-arg="unlearned"]')
      .tap();
    await expect(page.locator(".sheet .recipe-list")).toHaveAttribute(
      "data-count",
      "32",
    );
    await page.locator('[data-act="recipe-filter"][data-arg="all"]').tap();
    await expect(page.locator(".sheet .recipe-list")).toHaveAttribute(
      "data-count",
      "35",
    );
    const reveal = async (id) => {
      const slot = page.locator(`.recipe-slot[data-recipe-id="${id}"]`);
      await slot.scrollIntoViewIfNeeded();
      await expect(slot.locator(".recipe")).toHaveCount(1);
    };
    await reveal("shiitake");
    const mushroom = page
      .locator(".sheet .recipe")
      .filter({ hasText: "Udon nấm shiitake" });
    await expect(
      mushroom.locator('img[src*="v3-topping-shiitake"]'),
    ).toHaveCount(1);
    await reveal("daikon");
    const radish = page
      .locator(".sheet .recipe")
      .filter({ hasText: "Udon củ cải ngâm" });
    await expect(radish.locator('img[src*="v3-topping-daikon"]')).toHaveCount(
      1,
    );
    const curry = page
      .locator(".sheet .recipe")
      .filter({ hasText: "Udon cà ri đậu phụ" });
    const miso = page
      .locator(".sheet .recipe")
      .filter({ hasText: "Udon miso đậu phụ" });
    await reveal("misoTofu");
    await expect(miso.locator('img[src*="v3-bowl-miso"]')).toHaveCount(1);
    await reveal("curryTofu");
    await expect(curry.locator('img[src*="v3-bowl-curry"]')).toHaveCount(1);
    await curry.scrollIntoViewIfNeeded();
    await curry.locator("img").evaluateAll((images) => {
      if (images.some((image) => !image.complete || image.naturalWidth === 0))
        throw new Error("Catalog sprite failed to load");
    });
    await page.screenshot({ path: `test-results/v3-catalog-${width}.png` });
    await page.locator(".recipe-slot").last().scrollIntoViewIfNeeded();
    const lastRecipe = page.locator(".recipe-slot").last().locator(".recipe");
    await lastRecipe.scrollIntoViewIfNeeded();
    await expect(lastRecipe).toContainText("Udon xào bắp nấm");
    await page.screenshot({
      path: `test-results/v3-catalog-bottom-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  const large = newState();
  large.settings.font = "large";
  const page = await browser.newPage({
    viewport: { width: 320, height: 568 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await page.addInitScript(
    (state) => localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
    large,
  );
  await page.goto("http://localhost:5173/");
  await page.locator('[data-act="start"]').tap();
  await page.locator('[data-act="toggle-shop"]').tap();
  await page.locator('[data-act="panel"][data-arg="recipes"]').first().tap();
  await expect(page.locator(".recipe-filters button")).toHaveCount(3);
  await page.screenshot({
    path: "test-results/v3-catalog-filter-large-320.png",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.close();
  console.log(
    "PASS: 35 recipe cards, filters, topping art and scrolling at 320/390px including large text.",
  );
} finally {
  await browser.close();
}
