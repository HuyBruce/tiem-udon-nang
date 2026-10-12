import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";
import { chooseWorkOption, tapAction } from "./ui-actions.mjs";

// Exercise real pointer routing, not a second AudioSystem made by the test.
const browser = await chromium.launch();
const output =
  process.env.GDW_AUDIO_GESTURES || "test-results/gdw-audio-gestures.json";
try {
  const e = new Engine();
  e.open();
  e.s.nextArrival = 1000;
  e.s.customers[0].drink = "matcha";
  e.s.customers[0].drinkTemperature = "hot";
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 3,
    hasTouch: true,
    isMobile: true,
  });
  await page.addInitScript((state) => {
    localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state }));
  }, e.s);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:5173/?debug=1");
  await page.addStyleTag({ content: ".debug-tools{display:none!important}" });
  await page.evaluate(async () => {
    const { AudioSystem } = await import("/src/systems/audio.js");
    const original = AudioSystem.prototype.play;
    window.audioGestureHistory = [];
    AudioSystem.prototype.play = function (id, options) {
      window.audioGestureInstance = this;
      window.audioGestureHistory.push(id);
      return original.call(this, id, options);
    };
  });
  await tapAction(page, "start");
  await tapAction(page, "customer", "c0");
  await tapAction(page, "dismiss");
  await tapAction(page, "goto", "drinks");
  await chooseWorkOption(page, "data-work-drink", "matcha");
  for (const id of ["ingredient:matcha", "tool:water"]) {
    await page.locator(`[data-drag="${id}"]`).tap();
    await page.locator('.work-vessel[data-drop="cup"]').tap();
  }
  await page.evaluate(async () => {
    const a = window.audioGestureInstance;
    await a.start();
    await Promise.all([0, 1, 2].map((i) => a.load("whisk", i)));
  });
  await expect(page.locator(".work-vessel")).toHaveAttribute(
    "data-craft",
    "whisk",
  );
  const box = await page.locator(".work-vessel").boundingBox();
  const cx = box.x + box.width / 2,
    cy = box.y + box.height / 2;
  await page.mouse.move(cx + 25, cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(
      cx + 25 * Math.cos((i * Math.PI) / 8),
      cy + 23 * Math.sin((i * Math.PI) / 8),
    );
  await page.waitForFunction(
    () => window.audioGestureInstance.loops.get("whisk")?.src,
  );
  const during = await page.evaluate(() => window.audioGestureInstance.stats());
  expect(during.loops).toContain("whisk");
  for (let i = 9; i <= 16; i++)
    await page.mouse.move(
      cx + 25 * Math.cos((i * Math.PI) / 8),
      cy + 23 * Math.sin((i * Math.PI) / 8),
    );
  await page.mouse.up();
  expect(
    await page.evaluate(() => window.audioGestureInstance.loops.has("whisk")),
  ).toBe(false);
  const nav = await page.locator(".scene-pagination").boundingBox();
  const before = await page.evaluate(
    () => window.audioGestureHistory.filter((id) => id === "swipe").length,
  );
  await page.mouse.move(nav.x + nav.width * 0.65, nav.y + nav.height / 2);
  await page.mouse.down();
  await page.mouse.move(nav.x + nav.width * 0.3, nav.y + nav.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.locator("#stage")).toHaveAttribute(
    "data-camera-state",
    "idle",
  );
  const after = await page.evaluate(
    () => window.audioGestureHistory.filter((id) => id === "swipe").length,
  );
  expect(after - before).toBe(1);
  expect(errors).toEqual([]);
  await fs.mkdir(output.substring(0, output.lastIndexOf("/")), {
    recursive: true,
  });
  await fs.writeFile(
    output,
    JSON.stringify({ during, swipeCues: after - before, errors }, null, 2) +
      "\n",
  );
  console.log(
    "PASS: real matcha pointer keeps one whisk loop while moving, stops on release; one cue per camera swipe.",
  );
} finally {
  await browser.close();
}
