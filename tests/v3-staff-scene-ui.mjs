import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";

const fixture = new Engine();
fixture.s.money = 100000;
for (const id of ["thu", "mika", "binh", "yui"])
  if (!fixture.hire(id)) throw new Error(`Could not hire ${id}`);
fixture.open();
fixture.spawn();

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
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      fixture.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await expect(page.locator('.scene-staff[data-staff="thu"]')).toHaveCount(1);
    await expect(page.locator('.scene-staff[data-staff="mika"]')).toHaveCount(
      1,
    );
    await expect(page.locator(".order-ticket")).toHaveCount(2);
    await expect
      .poll(() =>
        page
          .locator(".scene-staff img")
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(
      await page
        .locator(".scene-staff")
        .first()
        .evaluate((element) => getComputedStyle(element).pointerEvents),
    ).toBe("none");
    expect(
      await page
        .locator(".scene-staff img")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await page.screenshot({
      path: `test-results/v3-staff-guests-${width}.png`,
    });
    await page.locator(".customer").first().tap();
    await expect(page.locator(".sheet")).toBeVisible();
    await page.locator(".close-sheet").tap();

    await page.locator('.scene-pagination [data-arg="kitchen"]').tap();
    await expect(page.locator('.scene-staff[data-staff="binh"]')).toHaveCount(
      1,
    );
    await expect(page.locator('.scene-staff[data-staff="yui"]')).toHaveCount(1);
    await expect
      .poll(() =>
        page
          .locator(".scene-staff img")
          .evaluateAll((images) =>
            images.every((image) => image.complete && image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({
      path: `test-results/v3-staff-kitchen-${width}.png`,
    });
    await page.locator('.sprite-touch[data-arg="broth"]').first().tap();
    await expect(page.locator(".sheet")).toBeVisible();
    await page.locator(".close-sheet").tap();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  const unstaffed = new Engine();
  unstaffed.open();
  const emptyPage = await browser.newPage();
  await emptyPage.addInitScript(
    (state) => localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
    unstaffed.s,
  );
  await emptyPage.goto("http://localhost:5173/");
  await emptyPage.locator('[data-act="start"]').click();
  await emptyPage.locator('.scene-pagination [data-arg="guests0"]').click();
  await expect(emptyPage.locator(".scene-staff")).toHaveCount(0);
  await emptyPage.locator('.scene-pagination [data-arg="kitchen"]').click();
  await expect(emptyPage.locator(".scene-staff")).toHaveCount(0);
  await emptyPage.close();
  console.log(
    "PASS: hired staff art, guest order and kitchen controls at 320/390px.",
  );
} finally {
  await browser.close();
}
