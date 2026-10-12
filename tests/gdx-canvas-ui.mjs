import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { Engine } from "../src/systems/engine.js";
import { tapAction } from "./ui-actions.mjs";

const output = process.env.GDX_CANVAS_OUTPUT || "review/gdx/canvas";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const reports = [];
  for (const renderer of ["dom", "canvas"]) {
    const e = new Engine();
    e.open();
    e.s.nextArrival = 1000;
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    await p.addInitScript(
      (s) =>
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        ),
      e.s,
    );
    await p.goto(`http://localhost:5173/?debug=1&renderer=${renderer}`);
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await tapAction(p, "start");
    await tapAction(p, "goto", "front");
    if (renderer === "canvas")
      await expect(p.locator(".world-canvas")).toHaveAttribute(
        "data-renderer-ready",
        "true",
      );
    const values = [];
    for (const state of ["open", "closed", "reopened"]) {
      if (state !== "open") await p.locator(".door-sign").tap();
      await p.waitForTimeout(1300);
      const lantern = p.locator(".hanging-lantern").first();
      await expect(lantern).toHaveCSS(
        "opacity",
        state === "closed" ? "0.54" : "1",
      );
      const box = await lantern.boundingBox();
      const png = await p.screenshot({
        path: `${output}/${renderer}-${state}.png`,
      });
      const { data } = await sharp(png)
        .extract({
          left: Math.ceil(box.x),
          top: Math.ceil(box.y),
          width: Math.floor(box.width) - 2,
          height: Math.floor(box.height) - 2,
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      values.push(data);
    }
    const difference = (a, b) => {
      let total = 0;
      for (let i = 0; i < a.length; i++) total += Math.abs(a[i] - b[i]);
      return total / a.length;
    };
    const dimmedDelta = difference(values[0], values[1]),
      restoredDelta = difference(values[0], values[2]);
    expect(dimmedDelta).toBeGreaterThan(2);
    expect(restoredDelta).toBeLessThan(2);
    if (renderer === "canvas")
      expect(
        await p.evaluate(
          () =>
            document.querySelector(".world-canvas").udonRendererStats().kind,
        ),
      ).toBe("canvas");
    reports.push({ renderer, dimmedDelta, restoredDelta });
    console.log("PASS actual pixels", renderer, dimmedDelta, restoredDelta);
    await p.close();
  }
  await fs.writeFile(
    `${output}/checks.json`,
    JSON.stringify(reports, null, 2) + "\n",
  );
} finally {
  await browser.close();
}
