import { chooseWorkOption } from "./ui-actions.mjs";
import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { newState } from "../src/systems/state.js";
import { migrateState } from "../src/systems/migration.js";

const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const output = process.env.STAGE2_SCREENSHOTS || "docs/review/stage2";
await fs.mkdir(output, { recursive: true });
const saved = (page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
const source = (id) => `[data-drag="${id}"]`;
const drop = (id) => `[data-drop="${id}"]`;

async function fixture(width, height, prepare = () => {}) {
  const e = new Engine();
  e.open();
  e.s.nextArrival = 1000;
  const c = e.s.customers[0];
  c.drink = "matcha";
  c.drinkTemperature = "hot";
  c.side = true;
  c.sideKind = "tempura";
  prepare(e.s, e);
  expect(validState(migrateState(e.s))).toBe(true);
  const page = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    reducedMotion: "reduce",
  });
  await page.clock.install();
  await page.addInitScript((state) => {
    if (!localStorage.getItem("debug-udon-nang-v1"))
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state }));
  }, e.s);
  await page.goto(`${base}/?debug=1`);
  await page.addStyleTag({ content: ".debug-tools{display:none!important}" });
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  return { page, errors };
}
async function point(page, selector) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  const b = await el.boundingBox();
  expect(b).not.toBeNull();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tap(page, selector) {
  const p = await point(page, selector);
  await page.touchscreen.tap(p.x, p.y);
  await page.clock.runFor(80);
}
async function drag(page, from, to, midway) {
  const a = await point(page, from),
    b = await point(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  if (midway) {
    await page.clock.runFor(16);
    await screenshot(page, midway);
  }
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  await page.clock.runFor(80);
}
async function screenshot(page, path) {
  // Hide only transient toasts in the evidence; gameplay/layout remain unchanged.
  const style = await page.addStyleTag({
    content: "#toast{visibility:hidden}",
  });
  await page.screenshot({ path });
  await style.evaluate((el) => el.remove());
}
async function noSheet(page) {
  await expect(page.locator(".sheet")).toHaveCount(0);
}
async function move(page, scene) {
  await tap(page, `.scene-pagination [data-arg="${scene}"]`);
  await noSheet(page);
}
async function images(page) {
  await page.waitForFunction(() =>
    [
      ...document.querySelectorAll(
        ".stage img,.direct-workbench img,.tray-slots img",
      ),
    ].every((i) => i.complete && i.naturalWidth > 0),
  );
}
async function gesture(page, kind) {
  const r = await page.locator(".work-vessel").boundingBox();
  const cx = r.x + r.width / 2,
    cy = r.y + r.height / 2;
  const pts =
    kind === "whisk"
      ? Array.from({ length: 17 }, (_, i) => ({
          x: cx + 25 * Math.cos((i * Math.PI) / 8),
          y: cy + 23 * Math.sin((i * Math.PI) / 8),
        }))
      : [
          { x: cx - 35, y: cy },
          { x: cx + 30, y: cy - 17 },
          { x: cx - 30, y: cy + 15 },
          { x: cx + 35, y: cy },
        ];
  await page.mouse.move(pts[0].x, pts[0].y);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p.x, p.y);
  await page.mouse.up();
  await page.clock.runFor(80);
}
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ])
    for (const mode of ["drag", "tap"]) {
      const { page, errors } = await fixture(width, height);
      await tap(page, '[data-act="start"]');
      await tap(page, '.customer[data-arg="c0"]');
      await tap(page, '[data-act="accept"][data-arg="c0"]');
      await move(page, "kitchen");
      await images(page);
      const transfer = async (from, to, shot) => {
        // A prepared serving may be picked up at the pan or the supplies rail.
        if (from.startsWith("bowl:"))
          await expect(page.locator(source(from))).toHaveCount(1);
        if (mode === "drag") await drag(page, source(from), drop(to), shot);
        else {
          await tap(page, source(from));
          await tap(page, drop(to));
        }
        await noSheet(page);
      };
      if (mode === "drag")
        await screenshot(
          page,
          `${output}/${width}x${height}-kitchen-prepare.png`,
        );
      await tap(page, drop("pot:0"));
      await tap(page, drop("pot:0"));
      await page.clock.runFor(5100);
      await expect(page.locator('[data-work-timer="pot:0"]')).toContainText(
        "Đã sôi",
      );
      await transfer(
        "noodles",
        "pot:0",
        mode === "drag"
          ? `${output}/${width}x${height}-kitchen-drag.png`
          : null,
      );
      await page.clock.runFor(9300);
      await expect(page.locator('[data-work-timer="pot:0"]')).toHaveAttribute(
        "data-texture",
        "perfect",
      );
      if (mode === "drag") await transfer("pot:0", "worktop");
      else await tap(page, drop("pot:0"));
      expect((await saved(page)).pots[0].texture).toBe("perfect");
      for (const id of ["dashi", "dashi", "soy", "mirin"])
        await transfer(`ingredient:${id}`, "broth:regular");
      await tap(page, drop("broth:regular"));
      await page.clock.runFor(7200);
      await expect(page.locator(".broth-label")).toContainText("5 tô");
      await transfer("broth:regular", "bowl:0");
      await transfer("ingredient:onion", "bowl:0");
      await noSheet(page);
      if (mode === "drag") {
        await images(page);
        await screenshot(
          page,
          `${output}/${width}x${height}-kitchen-finished.png`,
        );
        await transfer("bowl:0", "tray");
      } else await tap(page, '[data-act="work-action"][data-arg="tray"]');
      expect((await saved(page)).tray).toHaveLength(1);
      for (const id of ["shrimp", "flour", "oil"])
        await transfer(`ingredient:${id}`, "fryer:0");
      await page.clock.runFor(5400);
      await tap(page, drop("fryer:0"));
      expect((await saved(page)).prepared.tempura).toBe(1);
      await transfer("prepared:tempura", "dish:dish1");
      expect((await saved(page)).tray[0].sideKind).toBe("tempura");
      await noSheet(page);
      await move(page, "drinks");
      await images(page);
      if (mode === "drag")
        await screenshot(
          page,
          `${output}/${width}x${height}-drinks-prepare.png`,
        );
      await chooseWorkOption(page, '[data-work-drink]', "matcha");
      await page.clock.runFor(80);
      await transfer(
        "ingredient:matcha",
        "cup",
        mode === "drag" ? `${output}/${width}x${height}-drinks-drag.png` : null,
      );
      await transfer("tool:water", "cup");
      if (mode === "drag") await gesture(page, "whisk");
      else await tap(page, ".work-vessel");
      expect((await saved(page)).drink.step).toBe(3);
      await transfer("ingredient:milk", "cup");
      if (mode === "drag") await gesture(page, "art");
      else await tap(page, ".work-vessel");
      expect((await saved(page)).drink.step).toBe(5);
      await noSheet(page);
      if (mode === "drag") {
        await images(page);
        await screenshot(
          page,
          `${output}/${width}x${height}-drinks-finished.png`,
        );
        await transfer("drink", "dish:dish1");
      } else await tap(page, '[data-act="work-action"][data-arg="attach"]');
      expect((await saved(page)).tray[0].drink).toBe("matcha");
      await move(page, "guests0");
      if (mode === "drag")
        await drag(page, source("dish:dish1"), drop("customer:c0"));
      else {
        await tap(page, source("dish:dish1"));
        await tap(page, drop("customer:c0"));
      }
      expect((await saved(page)).customers[0].result.correct).toBe(true);
      const s = await saved(page);
      expect(validState(s)).toBe(true);
      const allowed = new Set([...Object.keys(newState()), "dishSerial"]);
      expect(Object.keys(s).filter((key) => !allowed.has(key))).toEqual([]);
      expect(
        await page.evaluate(() => localStorage.getItem("udon-nang-v1")),
      ).toBeNull();
      expect(errors).toEqual([]);
      await page.close();
      console.log(
        `PASS: ${mode} ${width}x${height} order -> noodles -> broth -> topping -> tray -> tempura -> matcha -> serve; no workstation sheet.`,
      );
    }
  // Rejections use physical pointer drops and must not consume any inventory.
  const { page, errors } = await fixture(390, 844);
  await tap(page, '[data-act="start"]');
  await tap(page, '.customer[data-arg="c0"]');
  await tap(page, '[data-act="accept"]');
  await move(page, "kitchen");
  let before = await saved(page);
  await drag(page, source("noodles"), drop("pot:0"));
  await expect(page.locator("#toast")).toContainText(/thêm nước|sôi/);
  expect((await saved(page)).inventory).toEqual(before.inventory);
  await tap(page, drop("pot:0"));
  await tap(page, drop("pot:0"));
  await page.clock.runFor(5100);
  await drag(page, source("noodles"), drop("pot:0"));
  await tap(page, drop("pot:0"));
  before = await saved(page);
  await drag(page, source("broth:regular"), drop("bowl:0"));
  await expect(page.locator("#toast")).toContainText("nước dùng");
  expect((await saved(page)).inventory).toEqual(before.inventory);
  expect((await saved(page)).pots[0].poured).toBe(false);
  await drag(page, source("ingredient:onion"), drop("bowl:0"));
  await expect(page.locator("#toast")).toContainText("nước dùng");
  expect((await saved(page)).inventory).toEqual(before.inventory);
  await drag(page, source("ingredient:oil"), drop("fryer:0"));
  await expect(page.locator("#toast")).toContainText("thứ tự");
  expect((await saved(page)).inventory).toEqual(before.inventory);
  await move(page, "drinks");
  await chooseWorkOption(page, '[data-work-drink]', "matcha");
  await page.clock.runFor(80);
  before = await saved(page);
  await drag(page, source("ingredient:milk"), drop("cup"));
  await expect(page.locator("#toast")).toContainText("Bước hiện tại");
  expect((await saved(page)).inventory).toEqual(before.inventory);
  expect((await saved(page)).drink.step).toBe(0);
  await drag(page, source("ingredient:matcha"), drop("cup"));
  await drag(page, source("tool:water"), drop("cup"));
  await gesture(page, "whisk");
  expect((await saved(page)).drink.step).toBe(3);
  // Cancellation leaves real state unchanged and removes the ghost/capture.
  const a = await point(page, source("ingredient:milk"));
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 20, a.y + 20);
  await page.locator("#app").dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await page.clock.runFor(80);
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  expect((await saved(page)).drink.step).toBe(3);
  expect(validState(await saved(page))).toBe(true);
  expect(errors).toEqual([]);
  await noSheet(page);
  await page.close();
  console.log(
    "PASS: wrong order/unboiled pot/unready broth/dry toppings/fryer order/cancel reject without stock loss; saves valid.",
  );
  const old = await fixture(360, 640, (s) => {
    s.money = 2345;
    s.sink = 2;
    for (const key of [
      "pet",
      "curryBatch",
      "brothSource",
      "progression",
      "sidePrep",
    ])
      delete s[key];
  });
  await tap(old.page, '[data-act="start"]');
  await move(old.page, "kitchen");
  await tap(old.page, '[data-act="work-target"][data-arg="board"]');
  const board = await old.page.locator("[data-direct-chop]").boundingBox();
  await old.page.mouse.move(board.x + board.width / 2, board.y + 5);
  await old.page.mouse.down();
  await old.page.mouse.move(
    board.x + board.width / 2,
    board.y + board.height - 5,
    { steps: 6 },
  );
  await old.page.mouse.up();
  await old.page.clock.runFor(80);
  expect((await saved(old.page)).cutBonus).toBeCloseTo(2 / 3);
  await tap(old.page, '[data-act="work-target"][data-arg="sink"]');
  expect((await saved(old.page)).sink).toBe(2);
  await old.page.clock.runFor(2200);
  expect((await saved(old.page)).sink).toBe(0);
  const sink = await point(
    old.page,
    '[data-act="work-target"][data-arg="sink"]',
  );
  await old.page.mouse.move(sink.x - 18, sink.y);
  await old.page.mouse.down();
  await old.page.mouse.move(sink.x + 18, sink.y, { steps: 6 });
  await old.page.mouse.up();
  await old.page.clock.runFor(80);
  expect((await saved(old.page)).sink).toBe(0);
  await tap(old.page, '[data-arg="more-supplies"]');
  expect(
    await old.page
      .locator(".work-supply-items")
      .evaluate((el) => el.scrollLeft),
  ).toBeGreaterThan(0);
  await move(old.page, "drinks");
  await chooseWorkOption(old.page, '[data-work-drink]', "matcha");
  await old.page.clock.runFor(80);
  await drag(old.page, source("ingredient:matcha"), drop("cup"));
  await drag(old.page, source("tool:water"), drop("cup"));
  await tap(old.page, ".work-vessel");
  const pending = await saved(old.page);
  expect(pending.drink.step).toBe(3);
  expect(pending.money).toBe(2345);
  expect(validState(pending)).toBe(true);
  await tap(old.page, source("ingredient:milk"));
  await old.page.reload();
  await tap(old.page, '[data-act="start"]');
  await move(old.page, "drinks");
  await expect(old.page.locator(".work-selected")).toHaveCount(0);
  await tap(old.page, source("ingredient:milk"));
  await tap(old.page, drop("cup"));
  await tap(old.page, ".work-vessel");
  const restored = await saved(old.page);
  expect(restored.drink.step).toBe(5);
  expect(restored.cutBonus).toBeCloseTo(2 / 3);
  expect(restored.sink).toBe(0);
  expect(restored.money).toBe(2345);
  expect(validState(restored)).toBe(true);
  const allowed = new Set([...Object.keys(newState()), "dishSerial"]);
  expect(Object.keys(restored).filter((key) => !allowed.has(key))).toEqual([]);
  expect(
    await old.page.evaluate(() => localStorage.getItem("udon-nang-v1")),
  ).toBeNull();
  expect(old.errors).toEqual([]);
  await noSheet(old.page);
  await drag(old.page, source("tool:ice"), drop("cup"));
  expect((await saved(old.page)).drink.temperature).toBe("cold");
  await tap(old.page, source("tool:ice"));
  await tap(old.page, drop("cup"));
  await expect(old.page.locator("#toast")).toContainText("lạnh");
  await old.page.close();
  console.log(
    "PASS: older v3 save migration, direct chopping/washing, supplies scroll, mid-drink reload and transient selection isolation.",
  );
  const late = await fixture(390, 844, (s, e) => {
    s.day = 10;
    for (const batches of Object.values(s.inventory))
      for (const batch of batches) batch.expires = 20;
    e.discardStock("beef");
    expect(e.buy("cream", 2)).toBe(true);
  });
  await tap(late.page, '[data-act="start"]');
  await move(late.page, "drinks");
  await chooseWorkOption(late.page, '[data-work-drink]', "matcha");
  await late.page.clock.runFor(80);
  for (const id of ["ingredient:matcha", "tool:water"])
    await drag(late.page, source(id), drop("cup"));
  await tap(late.page, ".work-vessel");
  await drag(late.page, source("tool:milk"), drop("cup"));
  await tap(late.page, ".work-vessel");
  await tap(late.page, '[data-act="work-action"][data-arg="chill"]');
  const cream = (await saved(late.page)).inventory.cream[0].qty;
  await chooseWorkOption(late.page, '[data-work-drink-topping]', "whippedCream");
  await late.page.clock.runFor(80);
  expect((await saved(late.page)).drink.topping).toBe("whippedCream");
  expect((await saved(late.page)).inventory.cream[0].qty).toBe(cream - 1);
  expect(validState(await saved(late.page))).toBe(true);
  expect(late.errors).toEqual([]);
  await noSheet(late.page);
  await late.page.close();
  console.log(
    "PASS: scene-native cold drink (tap and drag ice), milk tool and topping consume real stock once.",
  );
} finally {
  await browser.close();
}
