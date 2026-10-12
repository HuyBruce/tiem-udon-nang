import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";
import { recipeBook } from "../src/systems/discovery.js";
const browser = await chromium.launch();
try {
  for (const font of ["normal", "large"]) {
    const state = newState();
    state.settings.font = font;
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (s) => localStorage.setItem("udon-nang-v1", JSON.stringify({ state: s })),
      state,
    );
    await page.goto("http://localhost:5173");
    await page.locator("[data-act=start]").click();
    await page.locator('[data-act="toggle-shop"]').click();
    await page.locator("[data-act=panel][data-arg=recipes]").first().click();
    await expect(page.locator(".recipe-slot")).toHaveCount(35);
    await page.locator(".recipe-slot").last().focus();
    await expect(
      page.locator(".recipe-slot").last().locator(".recipe"),
    ).toHaveCount(1);
    await expect(page.locator(".recipe-slot").last()).toBeFocused();
    for (const [id, recipe] of Object.entries(recipeBook(state))) {
      const slot = page.locator(`.recipe-slot[data-recipe-id="${id}"]`);
      await slot.scrollIntoViewIfNeeded();
      await expect(slot.locator(".recipe")).toHaveCount(1);
      const secret = recipe.hidden && !state.unlocked.includes(id);
      await expect(slot.locator("h3")).toHaveText(secret ? "???" : recipe.name);
      await page.waitForTimeout(40);
      expect(await page.locator(".recipe").count()).toBeLessThanOrEqual(8);
      await slot.locator("img").evaluateAll(async (images) => {
        for (const img of images) await img.decode();
      });
    }
    await page.locator("[data-act=recipe-filter][data-arg=learned]").click();
    await expect(page.locator(".recipe-list")).toHaveAttribute(
      "data-count",
      "3",
    );
    await expect(page.locator(".recipe-slot")).toHaveCount(3);
    await page.locator("[data-act=recipe-filter][data-arg=unlearned]").click();
    await expect(page.locator(".recipe-slot")).toHaveCount(32);
    await page.locator("[data-act=recipe-filter][data-arg=all]").click();
    await page
      .locator(".recipe-slot[data-recipe-id=tempura]")
      .scrollIntoViewIfNeeded();
    await page.locator("[data-act=unlock][data-arg=tempura]").click();
    await expect(
      page.locator("[data-act=unlock][data-arg=tempura]"),
    ).toHaveCount(0);
    expect(
      await page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("udon-nang-v1"),
        ).state.unlocked.includes("tempura"),
      ),
    ).toBe(true);
    await expect(page.locator(".recipe-list")).toHaveAttribute(
      "data-count",
      "35",
    );
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: sparse recipe cards, all 35 entries, secrets, every image, filters, large text and real unlock/save.",
  );
} finally {
  await browser.close();
}
