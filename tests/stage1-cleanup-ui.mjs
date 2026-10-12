import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { newState } from "../src/systems/state.js";
import { RECIPES } from "../src/data.js";
import { estimatedCost } from "../src/systems/discovery.js";
import { yen } from "../src/systems/economy.js";
import { validState } from "../src/systems/validation.js";

const browser = await chromium.launch();
const url = "http://localhost:5173/?debug=1";
const scenes = ["front", "guests0", "drinks", "kitchen", "storage", "garden"];
const output = process.env.STAGE1_SCREENSHOTS || "docs/review/stage1";
await fs.mkdir(output, { recursive: true });
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url);
    await page.addStyleTag({
      content: ".debug-tools { display: none !important; }",
    });
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    for (const scene of scenes) {
      await page.locator(`.scene-pagination [data-arg="${scene}"]`).click();
      await page.waitForFunction(() =>
        [...document.querySelectorAll(".stage img")].every(
          (img) => img.complete && img.naturalWidth,
        ),
      );
      await expect(page.locator(".stage .asset-pending")).toHaveCount(0);
      if (scene === "kitchen" || scene === "drinks") {
        const collisions = await page.evaluate(() => {
          const rect = (element) => element.getBoundingClientRect();
          const overlap = (a, b) =>
            Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 &&
            Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
          const labels = [
            ...document.querySelectorAll(
              ".rack-item > .rack-name, .noodle-basket > .rack-name",
            ),
          ];
          const icons = [
            ...document.querySelectorAll(
              ".rack-art, .noodle-basket > .food-icon",
            ),
          ];
          return labels.flatMap((label) =>
            icons
              .filter((icon) => overlap(rect(label), rect(icon)))
              .map((icon) => ({
                label: label.textContent,
                icon: icon.closest("button").getAttribute("aria-label"),
              })),
          );
        });
        expect(
          collisions,
          `${width}x${height} ${scene}: shelf label/icon collision`,
        ).toEqual([]);
      }
      if (scene !== "front") {
        const heading = await page.locator(".scene-heading").boundingBox();
        const hud = await page.locator(".hud").boundingBox();
        expect(heading.y).toBeGreaterThanOrEqual(hud.y + hud.height);
        // GĐ-V compact heading retains a small gap below the floating HUD.
        expect(heading.height).toBeLessThanOrEqual(30);
        expect(
          heading.y + heading.height,
          `${width}x${height} ${scene}: compact heading band`,
        ).toBeLessThanOrEqual(height * 0.12);
        const collisions = await page.evaluate(() => {
          const h = document
            .querySelector(".scene-heading")
            .getBoundingClientRect();
          return [
            ...document.querySelectorAll(
              ".rack-art, .noodle-basket > .food-icon, .pot-hit, .sprite-touch, .customer",
            ),
          ]
            .filter((el) => {
              const b = el.getBoundingClientRect();
              return (
                Math.min(h.right, b.right) > Math.max(h.left, b.left) + 1 &&
                Math.min(h.bottom, b.bottom) > Math.max(h.top, b.top) + 1
              );
            })
            .map((el) => el.className);
        });
        expect(
          collisions,
          `${width}x${height} ${scene}: heading overlaps work area`,
        ).toEqual([]);
      }
      await page.screenshot({
        path: `${output}/${width}x${height}-${scene}.png`,
      });
    }
    expect(
      await page.evaluate(() => localStorage.getItem("udon-nang-v1")),
    ).toBeNull();
    const saved = await page.evaluate(
      () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
    );
    expect(saved.money).toBe(newState().money);
    expect(saved.upgrades.broth).toBe(0);
    expect(errors).toEqual([]);
    await page.close();
  }

  // Separate UI fixture: verify menu/book estimates and exactly one side-prep link.
  const state = newState();
  state.upgrades.broth = 2;
  state.tray = [
    {
      id: "dish1",
      orderId: "c1",
      drink: null,
      stage: "ready",
      time: 10,
      duration: 10,
      quality: 1,
      poured: true,
      lifted: true,
      texture: "perfect",
      tops: ["onion"],
      broth: ["dashi", "dashi", "soy", "mirin"],
      temperature: "hot",
      method: "hot",
    },
  ];
  expect(validState(state)).toBe(true);
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await page.addInitScript(
    (state) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
    state,
  );
  await page.goto(url);
  await page.addStyleTag({
    content: ".debug-tools { display: none !important; }",
  });
  await page.locator('[data-act="start"]').click();
  await page.locator('.sheet [data-act="panel"][data-arg="menu"]').click();
  await expect(page.locator(".menu-row").first()).toContainText(
    yen(estimatedCost(RECIPES.kake, state)),
  );
  await page.locator(".close-sheet").click();
  await page.locator('[data-act="panel"][data-arg="recipes"]').click();
  await expect(page.locator(".recipe").first()).toContainText(
    yen(estimatedCost(RECIPES.kake, state)),
  );
  await page.locator(".close-sheet").click();
  await page.locator('.scene-pagination [data-arg="kitchen"]').click();
  await chooseWorkOption(page, '[data-work-detail]', "fryer");
  await expect(
    page.locator('.station-panel [data-act="fry-select"]'),
  ).toBeVisible();
  await page.locator(".close-sheet").click();
  // GĐ2 direct tray taps select food; the detail workstation keeps the legacy
  // dish inspector reachable while leaving the tray unobstructed.
  await chooseWorkOption(page, '[data-work-detail]', "cook");
  await page.locator('[data-act="dish"]').click();
  await expect(
    page.locator('.sheet [data-act="panel"][data-arg="side-prep"]'),
  ).toHaveCount(1);
  await page.close();

  for (const [stage, servings, message] of [
    ["cooking", 0, "đang nấu"],
    ["ready", 5, "vẫn còn tô"],
  ]) {
    const state = newState();
    state.brothBatch = {
      ingredients: ["dashi", "dashi", "soy", "mirin"],
      stage,
      servings,
      time: 0,
      quality: 1,
    };
    expect(validState(state)).toBe(true);
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    await page.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      state,
    );
    await page.goto(url);
    await page.addStyleTag({
      content: ".debug-tools { display: none !important; }",
    });
    await page.locator('[data-act="start"]').click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    await page.locator('.scene-pagination [data-arg="kitchen"]').click();
    await chooseWorkOption(page, '[data-work-detail]', "broth");
    await page.locator('.rack-item[data-arg="soy"]').click();
    await expect(page.locator("#toast")).toContainText(message);
    await page.close();
  }
  console.log(
    "PASS: clean debug screenshots for six rooms at 360x640, 390x844, 430x932; rack labels and headings clear work areas; menu/book costs; one side-prep button; fryer detail access; broth refusal toasts.",
  );
} finally {
  await browser.close();
}
