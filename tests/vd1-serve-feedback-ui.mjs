import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

const fixture = new Engine();
fixture.open();
fixture.s.nextArrival = 0;
fixture.tick(0.1);
fixture.s.nextArrival = 999;
fixture.s.tutorial = 5;
const [happyGuest, sadGuest] = fixture.s.customers;
for (const [guest, correct, score] of [
  [happyGuest, true, 95],
  [sadGuest, false, 35],
]) {
  guest.accepted = true;
  guest.status = "eating";
  guest.eatTime = 60;
  guest.happy = correct;
  guest.result = {
    correct,
    score,
    payment: correct ? 600 : 270,
    tip: correct ? 50 : 0,
    rep: correct ? 1.5 : -2,
    review: correct ? "Rất ngon!" : "Chưa đúng món mình gọi.",
  };
  guest.meal = {
    orderId: guest.id,
    stage: "ready",
    time: 9,
    duration: 9,
    broth: [],
    tops: ["onion"],
    quality: 0,
    poured: true,
  };
}

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
      reducedMotion: "no-preference",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      (state) =>
        localStorage.setItem("udon-nang-v1", JSON.stringify({ state })),
      fixture.s,
    );
    await page.goto("http://localhost:5173/");
    await page.locator('[data-act="start"]').tap();
    await page.locator('.scene-pagination [data-arg="guests0"]').tap();
    await expect(page.locator(".customer.eating")).toHaveCount(2);
    await expect(page.locator(".customer .guest-feedback").first()).toHaveText(
      "Ngon quá!",
    );
    await expect(page.locator(".customer .guest-feedback").last()).toHaveText(
      "Ơ, nhầm món!",
    );
    await expect(page.locator(".table-bowl.eating")).toHaveCount(2);
    const characterMotion = await page
      .locator(".customer.eating")
      .first()
      .evaluate((element) => ({
        after: getComputedStyle(element, "::after").content,
        sprite: getComputedStyle(element.querySelector(".sprite"))
          .animationName,
      }));
    expect(characterMotion.after).toBe("none");
    expect(characterMotion.sprite).toBe("eating-body");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page
        .locator(".customer.eating > .sprite")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const heading = await page.locator(".scene-heading").boundingBox();
    const firstFeedback = await page
      .locator(".guest-feedback")
      .first()
      .boundingBox();
    const lastFeedback = await page
      .locator(".guest-feedback")
      .last()
      .boundingBox();
    expect(firstFeedback.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    expect(lastFeedback.y).toBeGreaterThanOrEqual(heading.y + heading.height);
    expect(firstFeedback.x + firstFeedback.width).toBeLessThan(lastFeedback.x);
    expect(
      await page
        .locator(".table-bowl.eating")
        .first()
        .evaluate((element) => getComputedStyle(element).animationName),
    ).toBe("meal-placed");
    await page.waitForTimeout(350);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/vd1-after-serving-${width}.png`,
    });
    await page.close();
  }
  console.log(
    "PASS: two guests show distinct serving reactions and table bowls at 320/390px.",
  );
} finally {
  await browser.close();
}
