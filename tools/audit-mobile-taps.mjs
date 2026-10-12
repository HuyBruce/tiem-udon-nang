import { chromium } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

async function smallButtons(page, selector) {
  return page.locator(selector).evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const style = getComputedStyle(button);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          button.getClientRects().length > 0
        );
      })
      .map((button) => {
        const box = button.getBoundingClientRect();
        return {
          act: button.dataset.act,
          arg: button.dataset.arg,
          label:
            button.getAttribute("aria-label") ||
            button.textContent.trim().slice(0, 30),
          width: Math.round(box.width),
          height: Math.round(box.height),
        };
      })
      .filter((button) => button.width < 44 || button.height < 44),
  );
}

const browser = await chromium.launch();
const issues = [];
try {
  for (const [width, height] of [
    [320, 568],
    [360, 640],
    [360, 800],
    [375, 812],
    [390, 844],
    [393, 873],
    [430, 932],
  ]) {
    const context = {
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
    };
    const page = await browser.newPage(context);
    await page.goto("http://localhost:5173/?debug=1");
    await page.addStyleTag({
      content: ".debug-tools { display: none !important; }",
    });
    await page.locator('[data-act="start"]').tap();
    await page.locator('.bottom-tools [data-arg="manage"]').tap();
    await page.locator('.sheet [data-arg="morning"]').tap();
    const morning = await smallButtons(page, ".sheet button");
    if (morning.length)
      issues.push({ width, scene: "morning panel", small: morning });
    await page.locator(".close-sheet").tap();
    for (const scene of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await page.locator(`.scene-pagination [data-arg="${scene}"]`).tap();
      const small = await smallButtons(page, ".game button,.game select");
      if (small.length) issues.push({ width, scene, small });
    }
    await page.close();

    const fixture = new Engine();
    fixture.open();
    fixture.s.nextArrival = 999;
    const guestPage = await browser.newPage(context);
    await guestPage.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      fixture.s,
    );
    await guestPage.goto("http://localhost:5173/?debug=1");
    await guestPage.addStyleTag({
      content: ".debug-tools { display: none !important; }",
    });
    await guestPage.locator('[data-act="start"]').tap();
    await guestPage.locator('.scene-pagination [data-arg="guests0"]').tap();
    const guest = await smallButtons(guestPage, ".game button");
    if (guest.length)
      issues.push({ width, scene: "occupied guest table", small: guest });
    await guestPage.locator(".customer").first().tap();
    await guestPage.waitForTimeout(300);
    const order = await smallButtons(guestPage, ".sheet button");
    if (order.length)
      issues.push({ width, scene: "order panel", small: order });
    await guestPage.close();
    if ([360, 390, 430].includes(width)) {
      // Check controls that only exist when a bowl/cup is finished or selected.
      const ready = new Engine();
      ready.open();
      ready.s.nextArrival = 999;
      ready.accept(ready.s.customers[0].id);
      ready.burnerStep(0);
      ready.burnerStep(0);
      for (let second = 0; second < 6; second++) ready.tick(1);
      ready.noodles(0);
      for (let second = 0; second < 10; second++) ready.tick(1);
      ready.liftNoodles(0);
      ready.drinkStart("matcha");
      for (let step = 0; step < 5; step++) ready.drinkStep();
      const work = await browser.newPage(context);
      await work.addInitScript(
        (state) =>
          localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
        ready.s,
      );
      await work.goto("http://localhost:5173/?debug=1");
      await work.addStyleTag({
        content: ".debug-tools{display:none!important}",
      });
      await work.locator('[data-act="start"]').tap();
      for (const scene of ["kitchen", "drinks"]) {
        await work.locator(`.scene-pagination [data-arg="${scene}"]`).tap();
        await work.locator('[data-act="work-source"]').first().tap();
        const small = await smallButtons(work, ".game button,.game select");
        if (small.length)
          issues.push({ width, scene: `${scene} ready/held`, small });
      }
      await work.close();
    }
  }
} finally {
  await browser.close();
}
if (issues.length) throw new Error(JSON.stringify(issues));
console.log(
  "PASS: buttons/selects >=44×44px across six rooms, morning/order panels and seven phone viewports, including ready/held workstations at 360/390/430; isolated debug saves.",
);
