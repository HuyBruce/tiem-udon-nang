import { chromium, expect } from "@playwright/test";
import { newState } from "../src/systems/state.js";

const state = newState();
state.collection.customers = ["mai", "ha"];
state.visits = { mai: 2, ha: 1 };
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
      (save) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state: save })),
      state,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").tap();
    await page.locator('[data-act="panel"][data-arg="manage"]').tap();
    await page.locator('[data-act="panel"][data-arg="album"]').tap();
    await expect(page.locator(".journal-card")).toHaveCount(7);
    await expect(page.locator(".journal-card.locked")).toHaveCount(5);
    await expect(page.locator(".journal-card").first()).toContainText(
      "17% câu chuyện",
    );
    await expect(page.locator(".journal-card").nth(2)).toContainText(
      "17% câu chuyện",
    );
    await page.locator(".journal-card").nth(2).scrollIntoViewIfNeeded();
    await page.locator(".journal-card img").evaluateAll((images) => {
      if (images.some((image) => !image.complete || !image.naturalWidth))
        throw new Error("Customer portrait failed to load");
    });
    await page.screenshot({
      path: `test-results/v3-customer-journal-${width}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.close();
  }
  console.log(
    "PASS: seven customer journal pages, hidden guests and visit progress at 320/390px.",
  );
} finally {
  await browser.close();
}
