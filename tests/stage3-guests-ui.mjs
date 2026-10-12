import { chromium, expect } from "@playwright/test";
import { chooseWorkOption } from './ui-actions.mjs';
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { recipeBook, brothFormula } from "../src/systems/discovery.js";
import { openPreparation } from "./ui-actions.mjs";

const browser = await chromium.launch();
const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const output = process.env.STAGE3_SCREENSHOTS || "docs/review/stage3";
await fs.mkdir(output, { recursive: true });
const state = (p) =>
  p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
const customer = (id = "c0") => `.customer[data-arg="${id}"]`;
const act = (name, arg) =>
  `[data-act="${name}"]${arg === undefined ? "" : `[data-arg="${arg}"]`}`;
const dragSource = (id) => `[data-drag="${id}"]`;
const target = (id) => `[data-drop="${id}"]`;
function readyDish(s, c, changes = {}) {
  const r = recipeBook(s)[c.recipe];
  return {
    id: "dish901",
    orderId: c.id,
    stage: "ready",
    lifted: true,
    time: 10,
    duration: 9,
    texture: "perfect",
    quality: 1,
    poured: true,
    broth: brothFormula(r),
    tops: [
      ...r.tops.filter((t) => t !== c.omit),
      ...(c.extra ? [c.extra] : []),
    ],
    method: r.kind || "hot",
    temperature: r.kind === "cold" ? "cold" : "hot",
    drink: c.drink,
    drinkTemperature: c.drinkTemperature,
    drinkTopping: c.drinkTopping,
    side: c.side,
    sideKind: c.sideKind,
    noodleTier: c.noodleTier,
    ...changes,
  };
}
async function pageFor(
  s,
  width = 390,
  height = 844,
  reducedMotion = "no-preference",
) {
  expect(validState(s)).toBe(true);
  const p = await browser.newPage({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
    reducedMotion,
  });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const time = new Date("2026-10-06T00:00:00Z");
  await p.clock.install({ time });
  await p.clock.pauseAt(new Date(time.getTime() + 1000));
  await p.addInitScript((s) => {
    if (!localStorage.getItem("debug-udon-nang-v1"))
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s }));
  }, s);
  await p.goto(`${base}/?debug=1`);
  await p.addStyleTag({
    content:
      ".debug-tools{display:none!important}.sheet,.modal-backdrop{animation:none!important}",
  });
  return { p, errors };
}
async function point(p, selector) {
  const el = p.locator(selector).first();
  await el.evaluate((el) =>
    el.scrollIntoView({
      block: el.closest(".stage") ? "nearest" : "center",
      inline: "nearest",
    }),
  );
  const b = await el.boundingBox();
  expect(b).not.toBeNull();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tap(p, selector, advance = 80) {
  const pos = await point(p, selector);
  await p.touchscreen.tap(pos.x, pos.y);
  await p.clock.runFor(advance);
}
async function drag(p, from, to) {
  const a = await point(p, from),
    b = await point(p, to);
  await p.mouse.move(a.x, a.y);
  await p.mouse.down();
  await p.mouse.move(b.x, b.y, { steps: 12 });
  await p.mouse.up();
  await p.clock.runFor(80);
}
async function go(p, scene) {
  await tap(p, `.scene-pagination ${act("goto", scene)}`);
  // Camera shares the RAF clock with guest motion.
  await p.clock.runFor(350);
}
async function photo(p, path) {
  await p.waitForFunction(() =>
    [...document.querySelectorAll(".stage img,.tray-slots img")].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  const style = await p.addStyleTag({ content: "#toast{visibility:hidden}" });
  if (path.endsWith("-payment"))
    await p.locator(".money-feedback").evaluateAll((nodes) =>
      nodes.forEach((n) =>
        n.getAnimations().forEach((a) => {
          a.pause();
          a.currentTime = a.effect.getTiming().duration * 0.2;
        }),
      ),
    );
  await p.screenshot({ path: `${output}/${path}.png` });
  if (path.endsWith("-payment"))
    await p
      .locator(".money-feedback")
      .evaluateAll((nodes) =>
        nodes.forEach((n) => n.getAnimations().forEach((a) => a.play())),
      );
  await style.evaluate((e) => e.remove());
}
async function assertSave(p) {
  const s = await state(p);
  expect(validState(s)).toBe(true);
  const allowed = new Set([...Object.keys(newState()), "dishSerial"]);
  expect(Object.keys(s).filter((k) => !allowed.has(k))).toEqual([]);
  expect(JSON.stringify(s)).not.toMatch(
    /"(?:guestX|guestPose|motionPhase|walkProgress|held|ui)":/,
  );
  expect(
    await p.evaluate(() => localStorage.getItem("udon-nang-v1")),
  ).toBeNull();
}
async function enterX(p) {
  return p
    .locator(customer())
    .evaluate((e) => Number(e.style.getPropertyValue("--guest-x")));
}
try {
  for (const [width, height, mode] of process.env.STAGE3_FIXTURES_ONLY
    ? []
    : [
        [360, 640, "drag"],
        [390, 844, "drag"],
        [430, 932, "drag"],
        [390, 844, "tap"],
      ]) {
    const { p, errors } = await pageFor(newState(), width, height);
    await tap(p, act("start"));
    await expect(p.locator(".sheet")).toHaveCount(0);
    await go(p, "guests0");
    await expect(p.locator(".guest-empty")).toHaveCount(2);
    await expect(p.locator(".scene-pet")).toHaveCount(0);
    if (mode === "drag") await photo(p, `${width}x${height}-guests-empty`);
    await go(p, "front");
    await openPreparation(p);
    await tap(p, act("open"));
    if (!(await state(p)).customers.length) {
      await p.screenshot({ path: "test-results/stage3-open-failure.png" });
      console.log(await p.locator("body").innerText());
    }
    // Spawn is the real open action. The initial body is outside the stage.
    expect((await state(p)).customers).toHaveLength(1);
    const firstX = await enterX(p);
    expect(firstX).toBeLessThan(-0.7);
    const bounds = await p.locator(customer()).boundingBox(),
      stage = await p.locator(".stage").boundingBox();
    expect(bounds.x + bounds.width).toBeLessThan(stage.x);
    await expect(p.locator(`${customer()} .customer-call`)).toBeHidden();
    await p.clock.runFor(400);
    const approaching = await enterX(p);
    expect(approaching).toBeGreaterThan(firstX);
    // The paper can open order while the character is still entering; this renders the DOM again.
    await tap(p, ".order-ticket", 0);
    await expect(p.locator('.sheet[data-panel="order"]')).toHaveCount(1);
    expect(Math.abs((await enterX(p)) - approaching)).toBeLessThan(0.03);
    await tap(p, ".close-sheet", 0);
    expect(Math.abs((await enterX(p)) - approaching)).toBeLessThan(0.03);
    await p.clock.runFor(400);
    expect(await enterX(p)).toBeGreaterThan(approaching);
    await tap(p, ".order-ticket", 0);
    await tap(p, ".close-sheet", 0);
    await p.clock.runFor(1200);
    expect(await enterX(p)).toBe(0);
    await expect(p.locator(`${customer()} .customer-call`)).toBeVisible();
    await p.clock.runFor(24500);
    await expect(p.locator(".customer.waiting")).toHaveCount(2);
    if (mode === "drag") await photo(p, `${width}x${height}-guests-waiting`);
    await tap(p, customer());
    await tap(p, act("accept", "c0"));
    expect((await state(p)).customers.find((c) => c.id === "c0").accepted).toBe(
      true,
    );
    await go(p, "kitchen");
    const transfer = async (from, to) =>
      mode === "drag"
        ? drag(p, dragSource(from), target(to))
        : (await tap(p, dragSource(from)), await tap(p, target(to)));
    await tap(p, target("pot:0"));
    await tap(p, target("pot:0"));
    await p.clock.runFor(5100);
    await transfer("noodles", "pot:0");
    if (!(await state(p)).pots[0]) {
      await p.screenshot({ path: "test-results/stage3-cook-failure.png" });
      console.log(
        "COOK",
        (await state(p)).burners,
        (await state(p)).selectedOrder,
        await p.locator("#toast").innerText(),
        await p
          .locator(".stage")
          .evaluate((el) => el.getBoundingClientRect().toJSON()),
      );
    }
    expect((await state(p)).pots[0]).not.toBeNull();
    await p.clock.runFor(9300);
    await tap(p, target("pot:0"));
    expect((await state(p)).pots[0].lifted).toBe(true);
    for (const id of ["dashi", "dashi", "soy", "mirin"])
      await transfer(`ingredient:${id}`, "broth:regular");
    await tap(p, target("broth:regular"));
    await p.clock.runFor(7200);
    await transfer("broth:regular", "bowl:0");
    await transfer("ingredient:onion", "bowl:0");
    await tap(p, act("work-action", "tray"));
    await go(p, "guests0");
    if (mode === "drag")
      await drag(p, dragSource("dish:dish1"), target("customer:c0"));
    else {
      await tap(p, dragSource("dish:dish1"));
      await tap(p, customer());
    }
    let s = await state(p),
      c = s.customers.find((c) => c.id === "c0");
    expect(c.status).toBe("eating");
    expect(c.result.correct).toBe(true);
    const meal = p.locator('[data-guest="c0"] .food-layers');
    const resting = await meal.boundingBox();
    await p.clock.runFor(600);
    const raised = await meal.boundingBox();
    expect(raised.y).toBeLessThan(resting.y - 20);
    await expect(p.locator('[data-guest="c0"] .guest-meal-steam')).toHaveCount(
      1,
    );
    if (mode === "drag") await photo(p, `${width}x${height}-guests-eating`);
    await p.clock.runFor(1600);
    const lowered = await meal.boundingBox();
    expect(lowered.y).toBeGreaterThan(raised.y + 20);
    await p.clock.runFor(6200);
    await expect(p.locator('.table-bowl[data-arg="c0"]')).toHaveAttribute(
      "aria-label",
      "Thu tiền",
    );
    s = await state(p);
    c = s.customers.find((c) => c.id === "c0");
    const beforeMoney = s.money,
      amount = c.result.payment + c.result.tip;
    const anchor = await p.locator(customer()).boundingBox();
    await tap(p, '.table-bowl[data-arg="c0"]');
    const payment = p.locator('.guest-payment[data-customer="c0"]');
    await expect(payment).toHaveCount(1);
    expect(
      await payment.evaluate((el) =>
        el
          .getAnimations()
          .some(
            (a) =>
              a.playState === "running" && a.effect.getKeyframes().length >= 3,
          ),
      ),
    ).toBe(true);
    await expect(payment).toContainText(amount.toLocaleString("vi-VN"));
    const origin = await payment.evaluate((el) => ({
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
    }));
    expect(Math.abs(origin.x - (anchor.x + anchor.width / 2))).toBeLessThan(2);
    expect(Math.abs(origin.y - (anchor.y + anchor.height * 0.12))).toBeLessThan(
      2,
    );
    expect((await state(p)).money).toBe(beforeMoney + amount);
    expect((await state(p)).ledger.served).toBe(1);
    if (mode === "drag") await photo(p, `${width}x${height}-guests-payment`);
    await p.clock.runFor(200);
    expect(await enterX(p)).toBeLessThan(-0.1);
    expect(
      await p
        .locator(customer())
        .evaluate((e) => Number(e.style.getPropertyValue("--guest-opacity"))),
    ).toBeLessThan(0.9);
    await p.clock.runFor(550);
    await expect(p.locator('.table-bowl[data-arg="c0"]')).toHaveClass(/dirty/);
    await expect(p.locator(customer())).toBeHidden();
    await tap(p, '.table-bowl[data-arg="c0"]');
    expect(
      (await state(p)).customers.find((c) => c.id === "c0"),
    ).toBeUndefined();
    expect((await state(p)).sink).toBe(1);
    await assertSave(p);
    expect(errors).toEqual([]);
    await p.close();
    console.log(
      `PASS: ${width}x${height} ${mode}: real open/entry, repeated renders, order/cook/serve, lift/lower, local payment, 0.7s exit and clear.`,
    );
  }

  // Combo art is based exclusively on actual delivered dishes from the engine.
  const e = new Engine();
  e.s.day = 6;
  e.s.serial = 12;
  e.open();
  e.s.nextArrival = 1000;
  const c = e.s.customers[0];
  expect(c.combo.parts).toHaveLength(2);
  e.accept(c.id);
  for (const [i, part] of c.combo.parts.entries()) {
    part.drink = i ? "yuzuSoda" : "matcha";
    part.drinkTemperature = i ? "cold" : "hot";
    part.side = true;
    part.sideKind = i ? "egg" : "tempura";
    const r = recipeBook(e.s)[part.recipe];
    e.s.tray.push({
      id: `dish${901 + i}`,
      orderId: c.id,
      partIndex: i,
      stage: "ready",
      lifted: true,
      time: 10,
      duration: 9,
      texture: "perfect",
      quality: 1,
      poured: true,
      broth: brothFormula(r),
      tops: r.tops,
      method: r.kind || "hot",
      temperature: r.kind === "cold" ? "cold" : "hot",
      drink: part.drink,
      drinkTemperature: part.drinkTemperature,
      side: true,
      sideKind: part.sideKind,
      noodleTier: part.noodleTier,
    });
  }
  const combo = await pageFor(e.s);
  await tap(combo.p, act("start"));
  await combo.p.clock.runFor(2100);
  await pServe(combo.p, "dish901", c.id);
  await expect(
    combo.p.locator(".combo-served-visual .guest-meal-part"),
  ).toHaveCount(1);
  await expect(
    combo.p.locator(".combo-served-visual [data-side=tempura]"),
  ).toHaveCount(1);
  await expect(
    combo.p.locator(".combo-served-visual .guest-drink-steam"),
  ).toHaveCount(1);
  await pServe(combo.p, "dish902", c.id);
  await expect(combo.p.locator(".table-bowl .guest-meal-part")).toHaveCount(2);
  await expect(combo.p.locator(".table-bowl [data-side=egg]")).toHaveCount(1);
  await expect(combo.p.locator(".table-bowl .guest-drink-steam")).toHaveCount(
    1,
  );
  await expect(combo.p.locator(".table-bowl .drink-art")).toHaveCount(2);
  await combo.p.clock.runFor(800);
  expect(
    (await combo.p.locator(".guest-drink").first().boundingBox()).height,
  ).toBeGreaterThan(20);
  await assertSave(combo.p);
  expect(combo.errors).toEqual([]);
  await combo.p.close();
  console.log(
    "PASS: partial/full combo renders actual bowls, distinct hot/cold drinks and prepared sides.",
  );

  // Max seats and purchased decoration use legitimate engine upgrades/hiring/decor/pet methods.
  const decorated = new Engine();
  decorated.s.money = 200000;
  for (let i = 0; i < 3; i++) expect(decorated.upgrade("seats")).toBe(true);
  for (const id of ["wall", "table", "bowl", "cup", "flowers", "season-spring"])
    expect(decorated.decorate(id)).toBe(true);
  expect(decorated.hire("thu")).toBe(true);
  expect(decorated.hire("mika")).toBe(true);
  expect(decorated.adoptPet("cat")).toBe(true);
  decorated.s.flowerRooms.guests = 3;
  decorated.open();
  for (let i = 1; i < 8; i++) decorated.spawn();
  for (let i = 0; i < 3; i++) decorated.tick(1);
  expect(decorated.s.customers).toHaveLength(8);
  decorated.s.nextArrival = 1000;
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    const { p, errors } = await pageFor(decorated.s, width, height);
    await tap(p, act("start"));
    for (let room = 0; room < 4; room++) {
      await go(p, `guests${room}`);
      const ids = await p
        .locator(".customer")
        .evaluateAll((nodes) => nodes.map((n) => n.dataset.arg));
      expect(ids).toEqual(
        decorated.s.customers
          .filter((c) => Math.floor(c.seat / 2) === room)
          .map((c) => c.id),
      );
      const geometry = await p
        .locator(".customer-place")
        .evaluateAll((nodes) =>
          nodes.map((n) => n.getBoundingClientRect().toJSON()),
        );
      expect(geometry[0].right).toBeLessThan(geometry[1].left);
      await expect(p.locator(".counter-pet")).toHaveCount(1);
      await expect(p.locator(".scene-staff")).toHaveCount(2);
      await expect(p.locator(".seasonal-decoration")).toHaveCount(1);
      await expect(p.locator(".room-bouquet")).toHaveCount(1);
      const small = await p.locator(".stage button").evaluateAll((nodes) =>
        nodes
          .filter(
            (n) =>
              n.getClientRects().length &&
              getComputedStyle(n).visibility !== "hidden",
          )
          .filter((n) => {
            const b = n.getBoundingClientRect();
            return b.width < 43.9 || b.height < 43.9;
          })
          .map((n) => n.className),
      );
      expect(small).toEqual([]);
    }
    await go(p, "guests0");
    await photo(p, `${width}x${height}-guests-pet-decor`);
    await assertSave(p);
    expect(errors).toEqual([]);
    await p.close();
  }
  console.log(
    "PASS: eight real guests/four pages, decor/season/flowers/pet/Thu/Mika, distinct regions and >=44px targets at all three sizes.",
  );

  for (const setting of ["reduce", "performance", "animation"]) {
    const fresh = new Engine();
    fresh.open();
    fresh.s.nextArrival = 1000;
    fresh.s.tray.push(readyDish(fresh.s, fresh.s.customers[0]));
    if (setting === "performance") fresh.s.settings.performance = true;
    if (setting === "animation") fresh.s.settings.animation = false;
    const { p, errors } = await pageFor(
      fresh.s,
      390,
      844,
      setting === "reduce" ? "reduce" : "no-preference",
    );
    await tap(p, act("start"));
    expect(await enterX(p)).toBe(0);
    await expect(p.locator(`${customer()} .customer-call`)).toBeVisible();
    await expect(p.locator(".stage")).toHaveAttribute(
      "data-guest-motion",
      "off",
    );
    expect(
      await p
        .locator(".stage")
        .evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
    ).toBe(0);
    await tap(p, ".order-ticket");
    await tap(p, act("accept", "c0"));
    await pServe(p, "dish901", "c0");
    await expect(p.locator('[data-guest="c0"] .reaction')).toHaveAttribute(
      "data-mood",
      "happy",
    );
    await p.clock.runFor(8100);
    expect(
      await p
        .locator('[data-guest="c0"]')
        .evaluate((el) => el.style.getPropertyValue("--meal-lift")),
    ).toBe("0px");
    await tap(p, '.table-bowl[data-arg="c0"]');
    const cash = p.locator('.guest-payment[data-customer="c0"]');
    await expect(cash).toHaveCount(1);
    expect(await cash.evaluate((el) => el.getAnimations().length)).toBe(0);
    await assertSave(p);
    expect(errors).toEqual([]);
    await p.close();
  }
  for (const [texture, tops, mood] of [
    // Soft noodles can still score >= excellentThreshold (85) with taste bonuses.
    ["hard", null, "neutral"],
    ["perfect", [], "disappointed"],
  ]) {
    const e = new Engine();
    e.open();
    e.accept("c0");
    e.s.nextArrival = 1000;
    const c = e.s.customers[0];
    e.s.tray.push(readyDish(e.s, c, { texture, ...(tops ? { tops } : {}) }));
    expect(e.serve("dish901", "c0")).toBe(true);
    const { p, errors } = await pageFor(e.s);
    await tap(p, act("start"));
    await expect(p.locator('[data-guest="c0"] .reaction')).toHaveAttribute(
      "data-mood",
      mood,
    );
    await p.clock.runFor(8100);
    await tap(p, '.table-bowl[data-arg="c0"]');
    await expect(p.locator(".guest-payment")).toHaveAttribute(
      "data-emotion",
      c.happy ? "happy" : "disappointed",
    );
    await assertSave(p);
    expect(errors).toEqual([]);
    await p.close();
  }
  const impatient = new Engine();
  impatient.open();
  impatient.s.nextArrival = 1000;
  const impatientSeconds = Math.ceil(
    impatient.s.customers[0].maxPatience * 0.8,
  );
  for (let i = 0; i < impatientSeconds; i++) impatient.tick(1);
  const patient = await pageFor(impatient.s);
  await tap(patient.p, act("start"));
  await expect(patient.p.locator(".patience")).toHaveAttribute(
    "data-urgency",
    "low",
  );
  await assertSave(patient.p);
  await patient.p.close();

  const utility = await pageFor(newState(), 360, 640, "reduce");
  await tap(utility.p, act("start"));
  await expect(utility.p.locator(".sheet")).toHaveCount(0);
  for (const scene of ["kitchen", "drinks"]) {
    await go(utility.p, scene);
    const detail = utility.p.locator("[data-work-detail]");
    const b = await detail.boundingBox();
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(360);
    expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.y + b.height).toBeLessThanOrEqual(640);
    expect(
      await detail.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return (
          document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) ===
          el
        );
      }),
    ).toBe(true);
    await chooseWorkOption(utility.p,'data-work-detail','recipes');
    await expect(utility.p.locator(".sheet")).toHaveCount(1);
    await tap(utility.p, ".close-sheet");
  }
  await utility.p.close();
  const cashier = new Engine();
  cashier.s.money = 100000;
  expect(cashier.hire("mika")).toBe(true);
  cashier.open();
  cashier.accept("c0");
  cashier.s.nextArrival = 1000;
  cashier.s.tray.push(readyDish(cashier.s, cashier.s.customers[0]));
  expect(cashier.serve("dish901", "c0")).toBe(true);
  const automatic = await pageFor(cashier.s);
  await tap(automatic.p, act("start"));
  await automatic.p.clock.runFor(8100);
  await expect(
    automatic.p.locator('.guest-payment[data-customer="c0"]'),
  ).toHaveCount(1);
  expect((await state(automatic.p)).ledger.served).toBe(1);
  await tap(automatic.p, '.scene-pagination [data-arg="guests0"]', 0);
  await expect(
    automatic.p.locator('.guest-payment[data-customer="c0"]'),
  ).toHaveCount(1);
  await assertSave(automatic.p);
  expect(automatic.errors).toEqual([]);
  await automatic.p.close();
  console.log(
    "PASS: moods, low patience, visible 360px detail controls and one local payment from Mika.",
  );
  const old = newState();
  old.money = 2345;
  for (const key of [
    "pet",
    "curryBatch",
    "brothSource",
    "progression",
    "sidePrep",
  ])
    delete old[key];
  const restored = await pageFor(old);
  await tap(restored.p, act("start"));
  await openPreparation(restored.p);
  await tap(restored.p, act("open"));
  await restored.p.clock.runFor(2100);
  await tap(restored.p, ".order-ticket");
  await tap(restored.p, act("accept", "c0"));
  await assertSave(restored.p);
  expect((await state(restored.p)).money).toBe(2345);
  await restored.p.reload();
  await tap(restored.p, act("start"));
  expect(await enterX(restored.p)).toBe(0);
  await assertSave(restored.p);
  expect(restored.errors).toEqual([]);
  await restored.p.close();
  console.log(
    "PASS: reduced-motion, low-performance, disabled animation, old-save migration/reload and no UI fields in saves.",
  );
} finally {
  await browser.close();
}
async function pServe(p, dish, id) {
  await tap(p, dragSource(`dish:${dish}`));
  await tap(p, customer(id));
}
