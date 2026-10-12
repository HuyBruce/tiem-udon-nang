import fs from "node:fs/promises";
import { webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { tapAction } from "./ui-actions.mjs";
const output = process.env.GDW_CLOCK_OUTPUT || "review/gdw/step1/b";
await fs.mkdir(output, { recursive: true });
const e = new Engine();
e.open();
e.close();
e.s.customers = [];
const b = await webkit.launch();
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await p.addInitScript(
    (s) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s })),
    e.s,
  );
  await p.goto("http://localhost:5173/?debug=1");
  await p.addStyleTag({ content: ".debug-tools{display:none}" });
  await tapAction(p, "start");
  const angle = () =>
    p.locator(".clock-minute").evaluate((el) => el.style.transform);
  const first = await angle();
  await p.waitForTimeout(70);
  expect(await angle()).not.toBe(first);
  await p.screenshot({ path: `${output}/clock-running.png` });
  await tapAction(p, "panel", "settings");
  await expect(p.locator(".clock-pause")).toBeVisible();
  await expect(p.locator(".panel-clock-pause")).toBeVisible();
  await expect(p.getByRole("dialog")).toHaveAccessibleName(await p.locator("#panel-title").textContent());
  await expect(p.getByRole("dialog")).toHaveAttribute("aria-describedby", "panel-clock-status");
  const paused = await angle();
  await p.waitForTimeout(800);
  expect(await angle()).toBe(paused);
  await p.screenshot({ path: `${output}/clock-paused.png` });
  await tapAction(p, "dismiss");
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(1100);
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await p.waitForTimeout(400);
  expect(await angle()).not.toBe(paused);
  await p.screenshot({ path: `${output}/clock-resumed.png` });
  await p.close();
  const perf = await b.newPage({ viewport: { width: 430, height: 932 } });
  await perf.goto("http://localhost:5173/?debug=perf");
  await perf.locator("[data-act=start]").click();
  await perf.waitForTimeout(1200);
  await expect(perf.locator(".clock-diagnostics")).toContainText("FPS");
  expect(
    await perf.evaluate(() => localStorage.getItem("debug-udon-nang-v1")),
  ).toBe(null);
  await perf.screenshot({ path: `${output}/perf-overlay.png` });
} finally {
  await b.close();
}
console.log(
  "GDW clock WebKit: frame interpolation, explicit pause, visibility resume, perf/player save separation PASS",
);
