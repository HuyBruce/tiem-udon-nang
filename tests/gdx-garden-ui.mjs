import fs from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { PLANTS } from "../src/data.js";
import { tapAction } from "./ui-actions.mjs";

const output = process.env.GDX_GARDEN_OUTPUT || "review/gdx";
await fs.mkdir(output, { recursive: true });
const reports = [];
const e = new Engine();
e.s.money = 200000;
e.upgrade("garden");
e.upgrade("garden");
for (const [i, id] of ["onion", "flowers", "sakura"].entries()) {
  expect(e.plant(i, id)).toBe(true);
}
e.s.plots[1].growth = 1;
e.s.plots[2].growth = PLANTS.sakura.days;
e.adoptPet("cat");
e.open();
e.s.nextArrival = 1000;
expect(validState(e.s)).toBe(true);
for (const [name, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await type.launch();
  try {
    for (const [width, height, inset = 0] of [
      [360, 640],
      [390, 844],
      [430, 932],
      [430, 932, 59],
    ]) {
      const p = await browser.newPage({
        viewport: { width, height },
        isMobile: true,
        hasTouch: true,
        reducedMotion: inset ? "reduce" : "no-preference",
      });
      p.setDefaultTimeout(8000);
      const errors = [];
      p.on("pageerror", (err) => errors.push(err.message));
      await p.addInitScript((state) => {
        if (!localStorage.getItem("debug-udon-nang-v1"))
          localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state }));
      }, e.s);
      await p.goto("http://localhost:5173/?debug=1");
      await p.addStyleTag({
        content: `.debug-tools{display:none!important}:root{--safe-top:${inset}px;--safe-bottom:${inset ? 34 : 0}px}`,
      });
      await tapAction(p, "start");
      await tapAction(p, "goto", "garden");
      const room = p.locator('[data-world-room="garden"]');
      const background = room.locator(".scene-background");
      await expect(background).toHaveAttribute("src", /gdx-garden-approved/);
      await expect(
        room.locator('.sprite[src*="gdx-garden-basin"]'),
      ).toHaveCount(1);
      await expect(
        room.locator(".scene-foreground,.motion-vine,.asset-pending"),
      ).toHaveCount(0);
      await expect(room.locator(".garden-plot")).toHaveCount(3);
      await expect(room.locator('.sprite[src*="onion-sprout"]')).toHaveCount(1);
      await expect(room.locator('.sprite[src*="flowers-growing"]')).toHaveCount(
        1,
      );
      await expect(room.locator('.sprite[src*="sakura-ripe"]')).toHaveCount(1);
      await expect(p.locator(".scene-caption")).toBeVisible();
      await expect(p.locator(".tutorial")).toHaveText(/Vuốt trái hoặc phải/);
      // The reused afternoon-light pseudo-element now fills the footer;
      // it must remain opaque instead of pulsing over a second stone path.
      expect(await room.evaluate((el) => {
        const style = getComputedStyle(el, "::after");
        return { animation: style.animationName, opacity: style.opacity };
      })).toEqual({ animation: "none", opacity: "1" });
      await p.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      await p.waitForTimeout(800);
      const geometry = await p.evaluate(() => {
        const room = document.querySelector('[data-world-room="garden"]'),
          r = room.getBoundingClientRect();
        const box = (el) => {
          const b = el.getBoundingClientRect();
          return { x: b.x, y: b.y, width: b.width, height: b.height };
        };
        return {
          room: box(room),
          plots: [...room.querySelectorAll(".garden-plot")].map((el) => ({
            key: el.dataset.motionKey,
            ...box(el),
          })),
          pet: box(room.querySelector(".scene-pet")),
          can: box(
            room.querySelector('[data-motion-key^="object:watering-can"]'),
          ),
          hint: box(document.querySelector(".tutorial")),
          caption: box(document.querySelector(".scene-caption")),
        };
      });
      expect(new Set(geometry.plots.map((p) => p.key)).size).toBe(3);
      const intersects = (a, b) =>
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y;
      expect(intersects(geometry.hint, geometry.pet)).toBe(false);
      expect(intersects(geometry.caption, geometry.can)).toBe(false);
      expect(intersects(geometry.caption, geometry.pet)).toBe(false);
      for (const el of await room.locator(".garden-plot .sprite-touch").all()) {
        expect(
          await el.evaluate((el) => {
            const b = el.getBoundingClientRect();
            return (
              b.width >= 44 &&
              b.height >= 44 &&
              el.contains(
                document.elementFromPoint(
                  b.x + b.width / 2,
                  b.y + b.height / 2,
                ),
              )
            );
          }),
        ).toBe(true);
      }
      const path = `${output}/garden-${name}-${width}x${height}${inset ? "-safe" : ""}.png`;
      await p.screenshot({ path });
      if (name === "chromium" && width === 390)
        await fs.copyFile(path, `${output}/garden-390x844.png`);
      const bgHandle = await background.elementHandle();
      const plotHandle = await room
        .locator(".garden-plot")
        .first()
        .elementHandle();
      // Touch navigation and a swipe from the actual empty soil, then return.
      const from = { x: width * 0.18, y: height * 0.36 },
        to = { x: width * 0.92, y: height * 0.36 };
      if (name === "chromium") {
        const cdp = await p.context().newCDPSession(p);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [from],
        });
        for (let i = 1; i <= 8; i++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: from.x + ((to.x - from.x) * i) / 8, y: from.y }],
          });
          await p.waitForTimeout(35);
        }
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else {
        await p.mouse.move(from.x, from.y);
        await p.mouse.down();
        await p.mouse.move(to.x, to.y, { steps: 8 });
        await p.mouse.up();
      }
      await expect(
        p.locator('.scene-pagination [data-arg="storage"]'),
      ).toHaveAttribute("aria-current", "page");
      await expect(p.locator("#stage")).toHaveAttribute(
        "data-camera-state",
        "idle",
      );
      await tapAction(p, "goto", "garden");
      expect(
        await bgHandle.evaluate(
          (el) =>
            el ===
            document.querySelector(
              '[data-world-room="garden"] .scene-background',
            ),
        ),
      ).toBe(true);
      expect(
        await plotHandle.evaluate(
          (el) =>
            el ===
            document.querySelector('[data-world-room="garden"] .garden-plot'),
        ),
      ).toBe(true);
      // Touch the real garden object, water and harvest using the real handlers.
      await room.locator(".garden-plot .sprite-touch").first().tap();
      await p.locator('.sheet [data-act="garden"][data-arg="0"]').tap();
      await expect(
        p.locator('.sheet [data-act="garden"][data-arg="0"]'),
      ).toBeDisabled();
      const bouquets = await p.evaluate(
        () =>
          JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state.bouquets,
      );
      await p.locator('.sheet [data-act="garden"][data-arg="2"]').tap();
      await expect(
        p.locator('.sheet [data-act="plant"][data-arg="2:sakura"]'),
      ).toBeVisible();
      await p.locator('.sheet [data-act="plant"][data-arg="2:sakura"]').tap();
      await p.waitForTimeout(5500);
      const state = await p.evaluate(
        () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
      );
      expect(state.bouquets).toBe(bouquets + 1);
      expect(state.plots[0].watered).toBe(true);
      expect(state.plots[2].growth).toBe(0);
      expect(validState(state)).toBe(true);
      await tapAction(p, "dismiss");
      await expect(room.locator('.sprite[src*="sakura-sprout"]')).toHaveCount(
        1,
      );
      await p.reload();
      await tapAction(p, "start");
      await tapAction(p, "goto", "garden");
      await expect(
        p.locator('[data-world-room="garden"] .sprite[src*="sakura-sprout"]'),
      ).toHaveCount(1);
      expect(errors).toEqual([]);
      reports.push({
        browser: name,
        safeInsets: [inset, inset ? 34 : 0],
        width,
        height,
        geometry,
        plantWaterHarvestReload: true,
        stableNodes: true,
        errors,
      });
      console.log(
        `PASS ${name} ${width}x${height} inset${inset}: approved garden, geometry, real care, reload, node cache`,
      );
      await p.close();
    }
  } finally {
    await browser.close();
  }
}
await fs.writeFile(
  `${output}/garden-checks.json`,
  JSON.stringify({ physicalPhone: false, reports }, null, 2) + "\n",
);
