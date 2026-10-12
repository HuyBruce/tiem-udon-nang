import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";

const output = process.env.PERF_FEEDBACK_OUTPUT || "test-results/perf-feedback";
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [360, 390, 430]) {
    const context = await browser.newContext({
      viewport: {
        width,
        height: width === 360 ? 640 : width === 390 ? 844 : 932,
      },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    const engine = new Engine();
    engine.s.money = 200000;
    engine.open();
    await page.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      engine.s,
    );
    await page.goto(
      (process.env.UDON_TEST_BASE_URL || "http://localhost:5173") + "/?debug=1",
    );
    await page.locator("[data-act=start]").click();
    if (await page.locator(".close-sheet").count())
      await page.locator(".close-sheet").click();
    const measured = await page.evaluate(async () => {
      const fx = await import("/src/ui/experience.js");
      const original = document.getAnimations;
      let calls = 0;
      document.getAnimations = function (...args) {
        calls++;
        return original.apply(this, args);
      };
      try {
        fx.clearEffects();
        fx.touchFeedback(document.querySelector(".scene-pagination .active"));
        const single = {
          enumerations: calls,
          effects: fx.effectStats(),
          ripples: document.querySelectorAll(".touch-ripple").length,
          sparks: document.querySelectorAll(".touch-spark").length,
        };
        fx.clearEffects();
        const external = [];
        for (let i = 0; i < 40; i++) {
          const node = document.createElement("div");
          document.body.append(node);
          external.push({
            node,
            animation: node.animate([{ opacity: 0.5 }, { opacity: 1 }], {
              duration: 1000,
              iterations: Infinity,
            }),
          });
        }
        let maxAnimations = 0,
          maxNodes = 0,
          maxEffects = 0;
        for (let i = 0; i < 30; i++) {
          fx.touchFeedback(document.querySelector(".scene-pagination .active"));
          maxAnimations = Math.max(
            maxAnimations,
            original.call(document).length,
          );
          const stats = fx.effectStats();
          maxNodes = Math.max(maxNodes, stats.nodes);
          maxEffects = Math.max(maxEffects, stats.effects);
        }
        fx.clearEffects();
        external.forEach(({ node, animation }) => {
          animation.cancel();
          node.remove();
        });
        return {
          single,
          maxAnimations,
          maxNodes,
          maxEffects,
          leftoverEffects: document.querySelectorAll("[data-effect]").length,
        };
      } finally {
        document.getAnimations = original;
      }
    });
    expect(measured.single.enumerations).toBe(1);
    expect(measured.single.ripples).toBe(1);
    expect(measured.single.sparks).toBe(3);
    expect(measured.maxAnimations).toBeLessThanOrEqual(40);
    expect(measured.maxEffects).toBeLessThanOrEqual(12);
    expect(measured.maxNodes).toBeLessThanOrEqual(24);
    expect(measured.leftoverEffects).toBe(0);
    results.push({ width, ...measured });
    await context.close();
  }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(
    output + "/metrics.json",
    JSON.stringify(results, null, 2),
  );
  console.log(
    "Feedback native inventory, visual components, burst caps and cleanup PASS",
    results,
  );
} finally {
  await browser.close();
}
