import fs from "node:fs/promises";
import { webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { tapAction } from "./ui-actions.mjs";
const output = process.env.GDW_WASH_OUTPUT || "review/gdw/step1/d";
await fs.mkdir(output, { recursive: true });
const b = await webkit.launch();
const reports = [];
try {
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [430, 932],
    [440, 956],
    [412, 915],
  ]) {
    const e = new Engine();
    e.open();
    e.close();
    e.s.customers = [];
    e.s.sink = 4;
    const p = await b.newPage({
      viewport: { width, height },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    p.on("pageerror", (x) => errors.push(x.message));
    await p.clock.install();
    await p.addInitScript((s) => {
      if (!localStorage.getItem("debug-udon-nang-v1"))
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        );
    }, e.s);
    await p.goto("http://localhost:5173/?debug=1");
    await p.addStyleTag({
      content:
        ":root{--safe-top:47px;--safe-bottom:34px}.clock-diagnostics,.debug-tools{display:none!important}",
    });
    await tapAction(p, "start");
    await tapAction(p, "goto", "kitchen");
    await p.evaluate(async () =>
      Promise.all([...document.images].map((i) => i.decode().catch(() => {}))),
    );
    const saved = () =>
      p.evaluate(
        () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
      );
    const sink = p.locator(".scene-sprite:has([data-wash])");
    expect(await sink.locator(".sink-dirty").count()).toBe(4);
    const rect = await sink.boundingBox();
    expect(rect.width).toBeGreaterThanOrEqual(width * 0.399);
    await p.screenshot({ path: `${output}/${width}x${height}-dirty.png` });
    await tapAction(p, "work-target", "sink");
    expect((await saved()).sink).toBe(4);
    await expect(sink).toHaveAttribute("data-washing", "true");
    await p.screenshot({ path: `${output}/${width}x${height}-washing.png` });
    await tapAction(p, "panel", "settings");
    await p.clock.runFor(2400);
    expect((await saved()).sink).toBe(4);
    await tapAction(p, "dismiss");
    await p.clock.runFor(2200);
    expect((await saved()).sink).toBe(1);
    expect(await sink.locator(".sink-clean").count()).toBe(3);
    await p.screenshot({ path: `${output}/${width}x${height}-clean.png` });
    await tapAction(p, "work-target", "sink");
    await p.clock.runFor(400);
    await p.reload();
    await tapAction(p, "start");
    await tapAction(p, "goto", "kitchen");
    expect((await saved()).sink).toBe(1);
    await p.clock.runFor(2400);
    expect((await saved()).sink).toBe(1); // reload cancels transient job, never deletes dirty bowls
    await tapAction(p, "work-target", "sink");
    await p.clock.runFor(2200);
    expect((await saved()).sink).toBe(0);
    expect(errors).toEqual([]);
    reports.push({ width, height, rect });
    await p.close();
  }
} finally {
  await b.close();
}
await fs.writeFile(`${output}/geometry.json`, JSON.stringify(reports, null, 2));
console.log(
  "GDW washing: 5 WebKit sizes, 3/batch, pause, reload and actual sink width PASS",
);
