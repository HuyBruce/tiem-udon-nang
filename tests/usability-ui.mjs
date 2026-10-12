import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { brothFormula } from "../src/systems/discovery.js";
import { RECIPES } from "../src/data.js";
import { validState } from "../src/systems/validation.js";

const output =
  process.env.USABILITY_OUTPUT || "review/gdv/usability/interaction";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const advance = (e, n) => {
  for (let i = 0; i < n; i++) e.tick(1);
};
function fixture() {
  const e = new Engine();
  e.open();
  e.s.nextArrival = 1000;
  const c = e.s.customers[0];
  e.accept(c.id);
  e.burnerStep(0);
  e.burnerStep(0);
  advance(e, 5);
  for (const id of brothFormula(RECIPES.kake)) e.brothAdd(id);
  e.brothCook();
  advance(e, 7);
  for (let i = 0; i < 2; i++) {
    e.noodles(0, c.id);
    advance(e, 10);
    e.liftNoodles(0);
    e.pour(0);
    e.tray(0);
  }
  e.noodles(0, c.id);
  e.drinkStart("ramune");
  e.drinkStep("bottle");
  e.fry("select");
  e.fry("batter");
  e.fry("oil");
  expect(validState(e.s)).toBe(true);
  return e.s;
}
const save = (p) =>
  p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
async function tap(p, selector) {
  await p.locator(selector).first().tap();
  await p.clock.runFor(80);
}
async function move(p, id) {
  await tap(p, `.scene-pagination [data-arg="${id}"]`);
  await expect(p.locator("#stage")).toHaveAttribute(
    "data-camera-state",
    "idle",
  );
}
async function drag(p, from, to) {
  const a = await p.locator(from).first().boundingBox();
  const b = await p.locator(to).first().boundingBox();
  await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await p.mouse.down();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
  await p.mouse.up();
  await p.clock.runFor(400);
  await expect(p.locator(".drag-ghost")).toHaveCount(0);
}
const checks = [];
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    const p = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.clock.install();
    await p.addInitScript((state) => {
      if (!localStorage.getItem("debug-udon-nang-v1"))
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state }));
    }, fixture());
    await p.goto(`${base}/?debug=1`);
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await tap(p, '[data-act="start"]');
    await move(p, "kitchen");
    const trash = await p.locator(".food-trash").boundingBox();
    expect(trash.width).toBeGreaterThanOrEqual(44);
    expect(trash.height).toBeGreaterThanOrEqual(44);
    const before = await save(p);
    await drag(p, '[data-drag="ingredient:beef"]', ".food-trash");
    expect((await save(p)).inventory).toEqual(before.inventory);
    expect((await save(p)).pots[0]).not.toBeNull();
    await drag(p, '[data-drag="fryer:0"]', ".food-trash");
    expect((await save(p)).fryer).toEqual([]);
    await drag(p, '[data-drag="pot:0"]', ".food-trash");
    expect((await save(p)).pots[0]).toBeNull();
    await tap(p, '[data-act="work-action"][data-arg="start-noodles"]');
    expect((await save(p)).pots[0]).not.toBeNull();
    await p.clock.runFor(10000);
    await tap(p, '[data-act="work-action"][data-arg="lift"]');
    expect((await save(p)).pots[0].lifted).toBe(true);
    await tap(p, '[data-drag="bowl:0"]');
    await tap(p, ".food-trash");
    expect((await save(p)).pots[0]).toBeNull();
    await tap(p, '[data-drag="ingredient:oil"]');
    await expect(p.locator(".work-held")).toContainText("Dầu");
    await expect(p.locator('[data-drag="ingredient:oil"]')).toHaveAttribute(
      "title",
      /chảo/,
    );
    await tap(p, '[data-act="work-action"][data-arg="cancel"]');
    await move(p, "drinks");
    await p.screenshot({
      path: `${output}/${width}x${height}-ready-drink.png`,
    });
    await drag(p, '[data-drag="drink"]', ".food-trash");
    expect((await save(p)).drink).toBeNull();
    await move(p, "guests0");
    let state = await save(p);
    const first = state.tray[0].id;
    const from = await p.locator(`[data-drag="dish:${first}"]`).boundingBox();
    const bin = await p.locator(".food-trash").boundingBox();
    await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await p.mouse.down();
    await p.mouse.move(bin.x + bin.width / 2, bin.y + bin.height / 2, {
      steps: 8,
    });
    await p
      .locator("#app")
      .evaluate((app) =>
        app.dispatchEvent(
          new PointerEvent("pointercancel", { pointerId: 1, bubbles: true }),
        ),
      );
    await p.mouse.up();
    await p.clock.runFor(400);
    expect((await save(p)).tray).toEqual(state.tray);
    await expect(p.locator(".drag-ghost")).toHaveCount(0);
    await drag(p, `[data-drag="dish:${first}"]`, ".food-trash");
    state = await save(p);
    expect(state.tray).toHaveLength(1);
    expect(state.tray.some((dish) => dish.id === first)).toBe(false);
    expect(state.inventory.noodles).not.toEqual(before.inventory.noodles);
    expect(validState(state)).toBe(true);
    await p.screenshot({
      path: `${output}/${width}x${height}-tray-discard.png`,
    });
    await p.reload();
    await p.clock.runFor(1000);
    expect((await save(p)).tray).toHaveLength(1);
    expect((await save(p)).drink).toBeNull();
    expect((await save(p)).version).toBe(3);
    expect(errors).toEqual([]);
    checks.push({
      width,
      height,
      trash,
      remainingDish: state.tray[0].id,
      passed: true,
    });
    await p.close();
    const fresh = new Engine();
    fresh.open();
    fresh.accept(fresh.s.customers[0].id);
    fresh.s.nextArrival = 1000;
    const flow = await browser.newPage({
      viewport: { width, height },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    });
    await flow.clock.install();
    await flow.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      fresh.s,
    );
    await flow.goto(`${base}/?debug=1`);
    await flow.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await tap(flow, '[data-act="start"]');
    await move(flow, "kitchen");
    const heat = '[data-act="work-action"][data-arg="heat"]';
    await tap(flow, heat);
    expect((await save(flow)).burners[0].stage).toBe("water");
    await tap(flow, heat);
    expect((await save(flow)).burners[0].stage).toBe("heating");
    await flow.clock.runFor(5000);
    await tap(flow, '[data-act="work-action"][data-arg="start-noodles"]');
    await flow.clock.runFor(10000);
    await tap(flow, '[data-act="work-action"][data-arg="lift"]');
    expect((await save(flow)).pots[0].lifted).toBe(true);
    await flow.screenshot({
      path: `${output}/${width}x${height}-lifted-bowl.png`,
    });
    await flow.close();
  }
  await fs.writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(
    "PASS: trash tap/drag for pot, bowl, fryer, cup and tray; rejected ingredients; real cooking button flow; stock/save/ghost checks at three viewports.",
  );
} finally {
  await browser.close();
}
