import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { forecast } from "../src/systems/weather.js";
import { brothFormula } from "../src/systems/discovery.js";
import { RECIPES } from "../src/data.js";
import { mkdir } from "node:fs/promises";

const e = new Engine();
e.s.day = 5;
e.s.serial = 1;
e.s.forecast = forecast(5);
for (const batches of Object.values(e.s.inventory))
  for (const batch of batches) batch.expires += 10;
e.open();
const c = e.s.customers[0];
if (c.noodleTier !== "handmade")
  throw new Error("Trial fixture missing handmade order");
e.accept(c.id);
e.burnerStep(0);
e.burnerStep(0);
for (let i = 0; i < 5; i++) e.tick(1);
for (const id of brothFormula(RECIPES[c.recipe])) e.brothAdd(id);
e.brothCook();
for (let i = 0; i < 7; i++) e.tick(1);
e.noodles(0, c.id);
for (let i = 0; i < 10; i++) e.tick(1);
e.liftNoodles(0);
e.pour(0);
for (const id of RECIPES[c.recipe].tops) e.topping(0, id);
await mkdir("test-results", { recursive: true });
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
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      e.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').click();
    await page.locator(".order-ticket").first().click();
    await expect(page.locator(".sheet blockquote")).toContainText("+¥80");
    await expect(page.locator(".sheet")).toContainText("Giá tô:");
    await page.screenshot({
      path: `test-results/v3-handmade-order-${width}.png`,
    });
    await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="kitchen"]').click();
    await page.locator('.pot-hit[data-pot="0"]').click();
    await expect(
      page.locator('.cook-bowl img[src*="v3-bowl-soup"]'),
    ).toHaveCount(1);
    await expect(
      page.locator('.cook-bowl img[src*="v3-topping-"]'),
    ).toHaveCount(2);
    await expect(
      page.locator('.ingredients.tops img[src*="v3-ingredient-"]'),
    ).toHaveCount(8);
    await page.locator(".cook-bowl img").evaluateAll((images) => {
      if (images.some((image) => !image.complete || image.naturalWidth === 0))
        throw new Error("Food sprite failed to load");
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: `test-results/v3-food-bowl-${width}.png` });
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: handmade price and layered bowl/toppings at 320 and 390 px; no broken images, page overflow or JS errors.",
  );
} finally {
  await browser.close();
}
