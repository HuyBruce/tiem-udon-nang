import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";

const output = process.env.IOS_SCREENSHOTS || "test-results/ios-fullscreen";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const engine = new Engine();
engine.s.money = 200000;
engine.hire("binh");
engine.hire("yui");
engine.open();
engine.s.nextArrival = 1000;
const reports = [];
try {
  // Insets are injected to verify layout math. This does not emulate iOS chrome.
  for (const [width, height] of [
    [390, 844],
    [430, 932],
    [430, 1000],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (s) =>
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        ),
      engine.s,
    );
    await page.goto("http://localhost:5173/?debug=1");
    await page.addStyleTag({
      content:
        ":root{--safe-top:59px;--safe-bottom:34px}.debug-tools{display:none!important}",
    });
    await expect(
      page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'),
    ).toHaveAttribute("content", "black-translucent");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      "/icon-180.png",
    );
    await page.locator('[data-act="start"]').tap();
    if (await page.locator(".close-sheet").count())
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
      await expect(page.locator("#stage")).toHaveAttribute(
        "data-visible-rooms",
        scene,
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      const bounds = await page.evaluate(() => {
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            bottom: r.bottom,
          };
        };
        return {
          game: rect(document.querySelector(".game")),
          stage: rect(document.querySelector("#stage")),
          safeWorld: rect(document.querySelector(".scene-world")),
          hud: rect(document.querySelector(".hud")),
          heading: rect(document.querySelector(".scene-heading")),
          buttons: [
            ...document.querySelectorAll(
              ".bottom-tools button,.scene-pagination button,.food-trash",
            ),
          ].map(rect),
          labels: [...document.querySelectorAll(".rack-name")].map(rect),
          tray:
            document.querySelector(".wooden-tray") &&
            rect(document.querySelector(".wooden-tray")),
          vessel:
            document.querySelector(".work-vessel-label") &&
            rect(document.querySelector(".work-vessel-label")),
          controls: [
            ...document.querySelectorAll(
              ".work-controls button,.work-controls select",
            ),
          ].map(rect),
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
      expect(bounds.game).toMatchObject({ x: 0, y: 0, width, height });
      expect(bounds.stage.y).toBe(0);
      expect(bounds.stage.bottom).toBe(height);
      expect(bounds.safeWorld.y).toBe(59);
      expect(bounds.safeWorld.bottom).toBe(height - 34);
      expect(bounds.hud.y).toBeGreaterThanOrEqual(59);
      if (scene !== "front")
        expect(bounds.heading.y).toBeGreaterThanOrEqual(59 + 44);
      for (const button of bounds.buttons)
        expect(button.bottom).toBeLessThanOrEqual(height - 34 + 1);
      for (const label of bounds.labels)
        expect(label.y).toBeGreaterThanOrEqual(bounds.heading.bottom);
      if (bounds.tray && bounds.vessel)
        expect(bounds.vessel.bottom).toBeLessThanOrEqual(bounds.tray.y + 1);
      if (bounds.tray)
        for (const control of bounds.controls)
          expect(control.bottom).toBeLessThanOrEqual(bounds.tray.y + 1);
      expect(bounds.scrollHeight).toBeLessThanOrEqual(height);
      reports.push({ width, height, scene, ...bounds });
      await page.screenshot({
        path: `${output}/${width}x${height}-${scene}.png`,
      });
    }
    for (const panel of ["recipes", "manage"]) {
      await page.locator(`.bottom-tools [data-arg="${panel}"]`).tap();
      const sheet = await page.locator(".sheet").boundingBox();
      expect(sheet.y).toBeGreaterThanOrEqual(59);
      await page.screenshot({
        path: `${output}/${width}x${height}-${panel}.png`,
      });
      await page.locator(".close-sheet").tap();
    }
    await page.setViewportSize({ width, height: height - 100 });
    await expect.poll(async () => (await page.locator(".game").boundingBox()).height).toBe(height - 100);
    expect(errors).toEqual([]);
    await page.close();
    console.log(
      `PASS ${width}x${height}: edge-to-edge frame, 59/34px simulated insets, six scenes, panels, dynamic height.`,
    );
  }
  await fs.writeFile(`${output}/bounds.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
