import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { forecast } from "../src/systems/weather.js";

const browser = await chromium.launch();
try {
  for (const [width, height] of [
    [320, 568],
    [390, 844],
  ]) {
    for (const [day, kind, asset] of [
      [1, "petals", "weather-petal"],
      [4, "rain", "weather-rain"],
      [31, "snow", "weather-snow"],
    ]) {
      const engine = new Engine();
      engine.s.day = day;
      engine.s.forecast = forecast(day);
      const page = await browser.newPage({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
      });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      await page.addInitScript(
        (state) =>
          localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
        engine.s,
      );
      await page.goto("http://localhost:5173/");
      await page.locator('[data-act="start"]').tap();
      if (await page.locator(".close-sheet").count())
        await page.locator(".close-sheet").tap();
      const overlaySelector =
        kind === "petals" ? ".petals" : `.weather.${kind}`;
      await expect(page.locator(`.stage.front ${overlaySelector}`)).toHaveCount(
        1,
      );
      await page.locator('.scene-pagination [data-arg="garden"]').tap();
      const overlay = page.locator(`.stage.garden ${overlaySelector}`);
      await expect(overlay).toHaveCount(1);
      const images = overlay.locator(`img[src*="${asset}"]`);
      await expect(images).toHaveCount(kind === "petals" ? 8 : 22);
      await expect
        .poll(() =>
          images.evaluateAll((nodes) =>
            nodes.every((img) => img.complete && img.naturalWidth > 0),
          ),
        )
        .toBe(true);
      expect(
        await overlay.evaluate((node) => getComputedStyle(node).pointerEvents),
      ).toBe("none");
      await page.screenshot({
        path: `test-results/v3-weather-${kind}-${width}.png`,
      });
      await page.locator(".garden-plot .sprite-touch").first().tap();
      await expect(page.locator(".sheet")).toBeVisible();
      expect(errors).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.close();
    }
  }
  const engine = new Engine();
  engine.s.day = 4;
  engine.s.forecast = forecast(4);
  engine.s.settings.performance = true;
  engine.s.settings.animation = false;
  const page = await browser.newPage({ viewport: { width: 320, height: 568 } });
  await page.addInitScript(
    (state) => localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
    engine.s,
  );
  await page.goto("http://localhost:5173/");
  await page.locator('[data-act="start"]').click();
  if (await page.locator(".close-sheet").count())
    await page.locator(".close-sheet").click();
  await page.locator('.scene-pagination [data-arg="garden"]').click();
  await expect(page.locator(".weather.rain img.weather-particle")).toHaveCount(
    8,
  );
  expect(
    await page
      .locator(".weather.rain > span")
      .first()
      .evaluate((node) => getComputedStyle(node).animationName),
  ).toBe("none");
  await page.close();
  console.log(
    "PASS: file-backed rain, snow, and petal effects load and preserve garden taps at 320/390px.",
  );
} finally {
  await browser.close();
}
