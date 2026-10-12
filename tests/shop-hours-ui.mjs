import fs from "node:fs/promises";
import { chromium, webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { serviceSeconds } from "../src/systems/time.js";

const output = process.env.GDX_OUTPUT || "review/gdx/a";
await fs.mkdir(output, { recursive: true });
const reports = [];
const saved = (p) =>
  p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
async function tap(p, selector) {
  await p.locator(selector).first().tap();
  await p.clock.runFor(500);
}
async function front(p) {
  await tap(p, '.scene-pagination [data-arg="front"]');
  await expect(p.locator("#stage")).toHaveAttribute(
    "data-camera-state",
    "idle",
  );
}
async function capture(p, file) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
  if (await p.locator(".sheet").count())
    await expect(p.locator(".sheet")).toHaveCSS("opacity", "1");
  await p.screenshot({ path: `${output}/${file}.png` });
}
for (const [name, type] of [
  ["chromium", chromium],
  ["webkit", webkit],
]) {
  const browser = await type.launch();
  try {
    const sizes = [
      [375, 667, 20],
      [390, 844, 59],
      [430, 932, 59],
      [440, 956, 59],
      [412, 915, 0],
    ];
    for (let start = 0; start < sizes.length; start += 2) {
      await Promise.all(
        sizes.slice(start, start + 2).map(async ([width, height, inset]) => {
          const e = new Engine();
          e.open();
          e.s.customers[0].patience = e.s.customers[0].maxPatience = 600;
          const p = await browser.newPage({
            viewport: { width, height },
            isMobile: true,
            hasTouch: true,
          });
          p.setDefaultTimeout(8000);
          const errors = [];
          p.on("pageerror", (e) => errors.push(e.message));
          await p.clock.install();
          await p.addInitScript((state) => {
            if (!localStorage.getItem("debug-udon-nang-v1"))
              localStorage.setItem(
                "debug-udon-nang-v1",
                JSON.stringify({ state }),
              );
          }, e.s);
          await p.goto("http://localhost:5173/?debug=1");
          const style = `.debug-tools{display:none!important}:root{--safe-top:${inset}px;--safe-bottom:${inset === 59 ? 34 : 0}px}`;
          await p.addStyleTag({ content: style });
          await tap(p, '[data-act="start"]');
          await front(p);
          const prefix = `${name}-${width}x${height}`;
          await expect(p.locator(".door-sign")).toHaveAttribute(
            "data-open",
            "true",
          );
          await expect(p.locator(".door-sign small")).toHaveText("Đóng cửa");
          await expect(p.locator(".door-sign-front")).toHaveCSS(
            "visibility",
            "visible",
          );
          await expect(p.locator(".door-sign-back")).toHaveCSS(
            "visibility",
            "hidden",
          );
          await capture(p, `${prefix}-open`);
          const before = await saved(p);
          // Actual touch on a painted face; also check that the real hitbox owns it.
          const hits = await p.locator(".door-sign").evaluate((el) => {
            const r = el.getBoundingClientRect();
            return [0.2, 0.5, 0.8].map(
              (x) =>
                document
                  .elementFromPoint(r.x + r.width * x, r.y + 22)
                  ?.closest("[data-act]")?.dataset.act,
            );
          });
          expect(hits).toEqual(["toggle-shop", "toggle-shop", "toggle-shop"]);
          await tap(p, ".door-sign");
          await expect(p.locator(".door-sign")).toHaveAttribute(
            "data-open",
            "false",
          );
          await expect(p.locator(".door-sign small")).toHaveText("Mở cửa");
          await expect(p.locator(".door-sign-back")).toHaveText("ĐÃ ĐÓNG");
          await expect(p.locator(".door-sign-front")).toHaveCSS(
            "visibility",
            "hidden",
          );
          await expect(p.locator(".door-sign-back")).toHaveCSS(
            "visibility",
            "visible",
          );
          await p.clock.runFor(1000);
          await capture(p, `${prefix}-closed`);
          // The snapshot comes from the five-second autosave, so let the last
          // write cover at least sixty full seconds after the closing action.
          await p.clock.runFor(65000);
          const closed = await saved(p);
          expect(closed.closing).toBe(true);
          expect(closed.phase).toBe("open");
          expect(closed.serial).toBe(before.serial);
          expect(closed.elapsed).toBeGreaterThanOrEqual(before.elapsed + 60);
          expect(closed.customers[0].accepted).toBe(
            before.customers[0].accepted,
          );
          expect(closed.customers[0].patience).toBeLessThan(
            before.customers[0].patience,
          );
          expect(
            await p
              .locator(".hanging-lantern")
              .first()
              .evaluate((el) => Number(getComputedStyle(el).opacity)),
          ).toBeCloseTo(0.54, 2);
          await p.reload();
          await p.addStyleTag({ content: style });
          await tap(p, '[data-act="start"]');
          await front(p);
          expect((await saved(p)).closing).toBe(true);
          await tap(p, ".door-sign");
          await expect(p.locator(".door-sign")).toHaveAttribute(
            "data-open",
            "true",
          );
          await expect(p.locator(".door-sign-front")).toHaveCSS(
            "visibility",
            "visible",
          );
          await expect(p.locator(".door-sign-back")).toHaveCSS(
            "visibility",
            "hidden",
          );
          await expect(p.locator(".shop-announcement")).toContainText("Mở cửa");
          await p.clock.runFor(500);
          await expect(p.locator(".shop-announcement")).toHaveCount(1);
          await capture(p, `${prefix}-reopened`);
          await tap(p, '.bottom-tools [data-arg="recipes"]');
          const recipePanel = await p.locator(".recipe-list").elementHandle();
          await p.clock.runFor(1100);
          await expect(p.locator(".shop-announcement")).toHaveCount(0);
          expect(await recipePanel.evaluate((el) => el.isConnected)).toBe(true);
          await tap(p, '.sheet [data-act="dismiss"]');
          await p.clock.runFor(60000);
          expect((await saved(p)).serial).toBeGreaterThan(closed.serial);
          const node = await p
            .locator('.front-owner [data-motion-actor="owner"]')
            .elementHandle();
          await tap(p, '.bottom-tools [data-arg="manage"]');
          await expect(p.locator(".shop-panel-toggle")).toHaveText("Đóng cửa");
          await tap(p, ".shop-panel-toggle");
          await expect(p.locator(".door-sign")).toHaveAttribute(
            "data-open",
            "false",
          );
          await tap(p, '.bottom-tools [data-arg="manage"]');
          await expect(p.locator(".shop-panel-toggle")).toHaveText("Mở cửa");
          await tap(p, ".shop-panel-toggle");
          expect(await node.evaluate((el) => el.isConnected)).toBe(true);
          const last = await saved(p);
          expect(validState(last)).toBe(true);
          await p.reload();
          await p.addStyleTag({ content: style });
          await tap(p, '[data-act="start"]');
          expect((await saved(p)).closing).toBe(false);
          expect(errors).toEqual([]);
          expect(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          reports.push({
            browser: name,
            width,
            height,
            touch: true,
            sixtySecondsNoArrival: true,
            reloadBothStates: true,
            nodeRetained: true,
            announcementKeepsRecipePanel: true,
            errors,
          });
          console.log(
            `PASS ${prefix}: real touch, sixty-second closed period, reopening, both reloads, manager, lanterns and two-second welcome.`,
          );
          await p.close();
        }),
      );
    }
    const e = new Engine();
    e.open();
    e.s.customers = [];
    e.s.elapsed = serviceSeconds();
    e.s.nextArrival = 9999;
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.clock.install();
    await p.addInitScript((s) => {
      if (!localStorage.getItem("debug-udon-nang-v1"))
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        );
    }, e.s);
    await p.goto("http://localhost:5173/?debug=1");
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await tap(p, '[data-act="start"]');
    await expect(p.locator(".shop-hours-reminder")).toContainText(
      "Đã khuya rồi",
    );
    expect((await saved(p)).closing).toBe(false);
    await capture(p, `${name}-390x844-reminder`);
    await tap(p, '[data-act="reminder-continue"]');
    await p.clock.runFor(60000);
    await expect(p.locator(".shop-hours-reminder")).toHaveCount(0);
    expect((await saved(p)).closing).toBe(false);
    expect(await p.locator("#clock").textContent()).not.toBe("18:00");
    await front(p);
    await tap(p, ".door-sign");
    await p.clock.runFor(60000);
    expect((await saved(p)).phase).toBe("open");
    await tap(p, ".door-sign");
    expect((await saved(p)).closing).toBe(false);
    await tap(p, ".door-sign");
    await tap(p, '.bottom-tools [data-arg="manage"]');
    await tap(p, '.sheet [data-arg="close-day"]');
    await expect(p.locator('[data-act="finish-day"]')).toBeEnabled();
    await capture(p, `${name}-390x844-ready-summary`);
    await tap(p, '[data-act="finish-day"]');
    const summary = await saved(p);
    expect(summary.phase).toBe("summary");
    await tap(p, '[data-act="next-day"]');
    const next = await saved(p);
    expect(next.day).toBe(summary.day + 1);
    expect(next.phase).toBe("morning");
    expect(errors).toEqual([]);
    reports.push({
      browser: name,
      reminder: true,
      lateReopen: true,
      emptyClosedPersists: true,
      explicitSummary: true,
    });
    console.log(
      `PASS ${name}: late reminder/continue, empty closed shop, late reopening and explicit summary/next day.`,
    );
    await p.close();
  } finally {
    await browser.close();
  }
}
await fs.writeFile(
  `${output}/checks.json`,
  JSON.stringify(
    { date: "2026-10-11", physicalPhone: false, screenshotsDpr: 1, reports },
    null,
    2,
  ),
);
