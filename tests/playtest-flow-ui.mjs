import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { count } from "../src/systems/inventory.js";
import { validState } from "../src/systems/validation.js";

const output = process.env.PLAYTEST_OUTPUT || "test-results/playtest-flow";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const reports = [];
const state = (p) =>
  p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
async function tap(p, selector) {
  await p.locator(selector).first().tap();
  await p.clock.runFor(420);
}
async function go(p, room) {
  await tap(p, `.scene-pagination [data-arg="${room}"]`);
  await expect(p.locator("#stage")).toHaveAttribute("data-visible-rooms", room);
}
async function photo(p, name) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
  await p.screenshot({ path: `${output}/${name}.png` });
}
try {
  for (const [width, height, insets] of [
    [360, 640, false],
    [390, 844, false],
    [430, 932, true],
  ]) {
    const e = new Engine();
    e.s.money = 25000;
    const p = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    p.setDefaultTimeout(8000);
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
    await p.addStyleTag({
      content: `.debug-tools{display:none!important}${insets ? ":root{--safe-top:59px;--safe-bottom:34px}" : ""}`,
    });
    await tap(p, '[data-act="start"]');
    await expect(p.locator(".sheet")).toHaveCount(0);
    await expect(p.locator(".door-sign")).toHaveAttribute("data-open", "false");
    await expect(p.locator(".hud-forecast")).toContainText("Nắng");
    await photo(p, `${width}x${height}-closed`);
    await go(p, "storage");
    await tap(p, ".pantry-supply");
    const before = await state(p);
    await tap(p, '[data-act="buy"][data-arg="dashi"]');
    const bought = await state(p);
    expect(count(bought, "dashi")).toBe(count(before, "dashi") + 5);
    expect(bought.money).toBeLessThan(before.money);
    expect(bought.phase).toBe("morning");
    await photo(p, `${width}x${height}-supplies`);
    await tap(p, ".close-sheet");
    await go(p, "front");
    await tap(p, ".door-sign");
    await expect(p.locator(".door-sign")).toHaveAttribute("data-open", "true");
    expect((await state(p)).phase).toBe("open");
    await photo(p, `${width}x${height}-open`);
    await p.locator('[data-debug="customer"]').dispatchEvent("click");
    await p.clock.runFor(80);
    await go(p, "guests0");
    const ids = (await state(p)).customers.map((c) => c.id);
    expect(ids).toHaveLength(2);
    for (const id of ids) {
      await tap(p, `.order-ticket[data-arg="${id}"]`);
      expect((await state(p)).customers.find((c) => c.id === id).accepted).toBe(
        true,
      );
      await expect(p.locator('[data-act="accept"]')).toContainText(
        "Đã ghi đơn",
      );
      await tap(p, ".close-sheet");
    }
    const accepted = await state(p);
    expect(accepted.customers.every((c) => c.accepted)).toBe(true);
    await photo(p, `${width}x${height}-guests`);
    await go(p, "kitchen");
    await expect(p.locator("[data-work-order] option")).toHaveCount(2);
    expect(
      await p
        .locator(".work-vessel > .bowl-art")
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("1");
    await photo(p, `${width}x${height}-kitchen`);
    for (const id of ["soy", "mirin", "onion"]) {
      const source = p.locator(`[data-drag="ingredient:${id}"]`);
      const a = await source.boundingBox();
      const original = await source.locator(".rack-cutout").boundingBox();
      await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
      await p.mouse.down();
      await p.mouse.move(width / 2, height * 0.57, { steps: 8 });
      await p.clock.runFor(32);
      const ghost = await p.locator(".drag-ghost").boundingBox();
      expect(Math.abs(ghost.width - original.width)).toBeLessThan(1);
      expect(Math.abs(ghost.height - original.height)).toBeLessThan(1);
      expect(await p.locator(".drag-ghost [data-drag]").count()).toBe(0);
      if (id === "mirin") await photo(p, `${width}x${height}-drag`);
      // Cancel, rather than applying ingredients to an unrelated target.
      await p.locator("#app").dispatchEvent("pointercancel", { pointerId: 1 });
      await p.mouse.up();
      await p.clock.runFor(100);
      await expect(p.locator(".drag-ghost")).toHaveCount(0);
      reports.push({ width, height, insets, id, original, ghost });
    }
    // Uniform arrows across all rooms, all touch targets at least 48x48.
    const arrows = [];
    for (const room of [
      "front",
      "guests0",
      "drinks",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await go(p, room);
      const rect = await p.locator(".scene-arrow").first().boundingBox();
      expect(rect.width).toBe(48);
      expect(rect.height).toBe(48);
      arrows.push(rect.y);
      await photo(p, `${width}x${height}-${room}`);
    }
    expect(Math.max(...arrows) - Math.min(...arrows)).toBeLessThan(1);
    await go(p, "front");
    await tap(p, ".door-sign");
    await expect(p.locator(".door-sign")).toHaveAttribute("data-open", "false");
    const closed = await state(p);
    expect(closed.customers.map((c) => c.id)).toEqual(ids);
    await tap(p, ".door-sign");
    expect((await state(p)).closing).toBe(false);
    await p.reload();
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await tap(p, '[data-act="start"]');
    expect((await state(p)).customers.every((c) => c.accepted)).toBe(true);
    expect(validState(await state(p))).toBe(true);
    // Cook both queued orders through the workbench, without reopening order UI.
    await go(p, "kitchen");
    const transfer = async (from, to) => {
      await tap(p, `[data-drag="${from}"]`);
      await tap(p, `[data-drop="${to}"]`);
    };
    await tap(p, '[data-drop="pot:0"]');
    await tap(p, '[data-drop="pot:0"]');
    await p.clock.runFor(5100);
    const cookingIds = [];
    for (let i = 0; i < 2; i++) {
      const selected = (await state(p)).selectedOrder;
      cookingIds.push(selected);
      await transfer("noodles", "pot:0");
      expect((await state(p)).pots[0].orderId).toBe(selected);
      await p.clock.runFor(9300);
      await tap(p, '[data-drop="pot:0"]');
      if (!i) {
        for (const id of ["dashi", "dashi", "soy", "mirin"])
          await transfer(`ingredient:${id}`, "broth:regular");
        await tap(p, '[data-drop="broth:regular"]');
        await p.clock.runFor(7200);
      }
      await transfer("broth:regular", "bowl:0");
      await tap(p, '[data-act="work-action"][data-arg="tray"]');
      expect((await state(p)).tray).toHaveLength(i + 1);
      await expect(p.locator(".sheet")).toHaveCount(0);
    }
    expect(new Set(cookingIds)).toEqual(new Set(ids));
    expect((await state(p)).tray.map((d) => d.orderId)).toEqual(cookingIds);
    expect(validState(await state(p))).toBe(true);
    expect(errors).toEqual([]);
    expect(
      await p.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(height);
    await p.close();
    console.log(
      `PASS ${width}x${height}: sign/start, warehouse, 2 auto-accepted orders/reload, ghost sizing, bowl opacity, uniform arrows.`,
    );
  }
  await fs.writeFile(`${output}/bounds.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
