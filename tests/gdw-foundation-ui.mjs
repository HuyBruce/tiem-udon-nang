import fs from "node:fs/promises";
import { webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { tapAction } from "./ui-actions.mjs";

const output = process.env.GDW_OUTPUT || "review/gdw/step1/after";
await fs.mkdir(output, { recursive: true });
const e = new Engine();
e.s.money = 200000;
e.hire("binh");
e.hire("yui");
e.adoptPet("cat");
e.open();
e.s.nextArrival = 10000;
e.spawn();
e.spawn();
e.s.sink = 4;
const browser = await webkit.launch();
const reports = [];
try {
  for (const [width, height] of [
    [375, 667],
    [390, 844],
    [430, 932],
    [440, 956],
    [412, 915],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(
      (s) =>
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        ),
      e.s,
    );
    await p.goto("http://localhost:5173/?debug=1");
    await p.addStyleTag({
      content:
        ":root{--safe-top:47px;--safe-bottom:34px}.debug-tools,.clock-diagnostics{display:none!important}",
    });
    await tapAction(p, "start");
    for (const scene of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await tapAction(p, "goto", scene);
      await p.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      const geometry = await p.evaluate(() => ({
        height: innerHeight,
        game: document.querySelector(".game").getBoundingClientRect().toJSON(),
        hud: document.querySelector(".hud").getBoundingClientRect().toJSON(),
        scroll: document.documentElement.scrollHeight,
      }));
      expect(geometry.game).toMatchObject({ x: 0, y: 0, width, height });
      expect(geometry.hud.y).toBeGreaterThanOrEqual(47);
      expect(geometry.scroll).toBeLessThanOrEqual(height);
      await expect(p.locator('.bottom-tools img.ui-icon')).toHaveCount(2);
      expect(await p.locator('.bottom-tools img.ui-icon').evaluateAll(es => es.every(i => i.complete && i.naturalWidth > 0))).toBe(true);
      if (scene === 'drinks') {
        const overflow = await p.locator('.work-drink-toolbar .work-source').evaluateAll(es => es.some(e => {
          const r=e.getBoundingClientRect();
          return [...e.children].some(c => { const b=c.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1||b.top<r.top-1||b.bottom>r.bottom+1; });
        }));
        expect(overflow).toBe(false);
      }
      if (scene === 'guests0') {
        const overlaps = await p.locator('.counter-pet').evaluate(pet => {
          const a=pet.getBoundingClientRect();return [...document.querySelectorAll('.order-ticket')].some(e=>{
            const b=e.getBoundingClientRect();return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
          });
        });
        expect(overlaps).toBe(false);
      }
      await p.screenshot({ path: `${output}/${width}x${height}-${scene}.png` });
      reports.push({ width, height, scene, geometry });
    }
    expect(errors).toEqual([]);
    await p.close();
  }
} finally {
  await browser.close();
}
await fs.writeFile(`${output}/geometry.json`, JSON.stringify(reports, null, 2));
console.log("GDW WebKit: 30 scene captures, safe area and viewport PASS");
