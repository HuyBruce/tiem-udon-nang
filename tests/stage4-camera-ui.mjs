import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { recipeBook, brothFormula } from "../src/systems/discovery.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";

const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const output = process.env.STAGE4B_SCREENSHOTS || "docs/review/stage4b";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch(
  process.env.GDV_BROWSER_CHANNEL
    ? { channel: process.env.GDV_BROWSER_CHANNEL, args: ["--enable-gpu"] }
    : {},
);
const metrics = {
  simulation: "Chromium desktop, mobile viewport; not a physical phone",
  viewports: [],
};
function fixture() {
  const e = new Engine();
  e.s.money = 200000;
  for (let i = 0; i < 3; i++) expect(e.upgrade("seats")).toBe(true);
  for (const id of ["thu", "mika"]) expect(e.hire(id)).toBe(true);
  expect(e.adoptPet("cat")).toBe(true);
  e.open();
  for (let i = 1; i < 8; i++) e.spawn();
  e.s.nextArrival = 1000;
  e.tick(2);
  const c = e.s.customers[0],
    r = recipeBook(e.s)[c.recipe];
  e.accept(c.id);
  e.s.tray.push({
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
  });
  expect(validState(e.s)).toBe(true);
  return e.s;
}
async function pageFor(
  width,
  height,
  reducedMotion = "no-preference",
  clock = true,
  seed = fixture(),
) {
  const p = await browser.newPage({
    viewport: { width, height },
    hasTouch: true,
    isMobile: true,
    reducedMotion,
  });
  const errors = [];
  await p.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    window.reducedMotionQueries = 0;
    window.matchMedia = (query) => {
      if (query === "(prefers-reduced-motion: reduce)")
        window.reducedMotionQueries++;
      return original(query);
    };
  });
  p.on("pageerror", (e) => errors.push(e.message));
  if (clock) {
    const t = new Date("2026-10-10T00:00:00Z");
    await p.clock.install({ time: t });
    await p.clock.pauseAt(new Date(t.getTime() + 1000));
  }
  await p.addInitScript(
    (s) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s })),
    seed,
  );
  await p.goto(
    base +
      "/?debug=1" +
      (process.env.GDV_RENDERER ? "&renderer=" + process.env.GDV_RENDERER : ""),
  );
  await p.addStyleTag({
    content:
      ".debug-tools,.clock-diagnostics{display:none!important}.sheet,.modal-backdrop{animation:none!important}",
  });
  await p.locator("[data-act=start]").tap();
  if (await p.locator(".close-sheet").count())
    await p.locator(".close-sheet").tap();
  if (clock) await p.clock.runFor(30);
  if (process.env.GDV_RENDERER === "canvas") {
    await p.waitForFunction(
      () =>
        document.querySelector(".world-canvas")?.udonRendererStats?.()
          .backend === "webgl",
    );
    if (clock) await p.clock.runFor(30);
    await expect(p.locator(".world-canvas")).toHaveAttribute(
      "data-renderer-ready",
      "true",
    );
  }
  return { p, errors };
}
async function go(p, id, clock = true) {
  await p.locator(`.scene-pagination [data-arg="${id}"]`).tap();
  if (clock) await p.clock.runFor(400);
  else
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-camera-state",
      "idle",
    );
  await expect(p.locator("#stage")).toHaveAttribute("data-visible-rooms", id);
}
async function photo(p, name) {
  await p.waitForFunction(() =>
    [...document.querySelectorAll(".stage img,.tray-slots img")].every(
      (i) => i.complete && i.naturalWidth,
    ),
  );
  await p.screenshot({ path: `${output}/${name}.png` });
}
const offset = (p) =>
  p.locator("#stage").getAttribute("data-camera-offset").then(Number);
async function center(p, selector) {
  const b = await p.locator(selector).first().boundingBox();
  expect(b).not.toBeNull();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
try {
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    const { p, errors } = await pageFor(width, height);
    await go(p, "kitchen");
    await p.evaluate(
      () =>
        (window.originalWorld = {
          game: document.querySelector(".game"),
          stage: document.querySelector("#stage"),
          kitchen: document.querySelector("[data-world-room=kitchen]"),
          pot: document.querySelector('[data-pot="0"]'),
          tray: document.querySelector(".wooden-tray"),
        }),
    );
    const b = await p.locator("#stage").boundingBox(),
      cameraNav = await p.locator(".scene-pagination").boundingBox(),
      y = cameraNav.y + cameraNav.height / 2;
    // A seam at exactly half a viewport must display kitchen + drinks.
    await p.mouse.move(cameraNav.x + 4, y);
    await p.mouse.down();
    await p.mouse.move(cameraNav.x + 4 + b.width * 0.5, y, { steps: 12 });
    await p.clock.runFor(20); // Camera consumes the latest input on its shared RAF.
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-camera-state",
      "dragging",
    );
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-visible-rooms",
      "drinks,kitchen",
    );
    expect(await offset(p)).toBeCloseTo(5.5, 1);
    await photo(p, `${width}x${height}-between`);
    await p.mouse.up();
    await p.clock.runFor(400);
    expect(Number.isInteger(await offset(p))).toBe(true);
    await go(p, "drinks");
    await photo(p, `${width}x${height}-snapped`);
    await go(p, "kitchen");
    expect(
      await p.evaluate(
        () =>
          document.querySelector(".game") === originalWorld.game &&
          document.querySelector("#stage") === originalWorld.stage &&
          document.querySelector("[data-world-room=kitchen]") ===
            originalWorld.kitchen &&
          document.querySelector('[data-pot="0"]') === originalWorld.pot &&
          document.querySelector(".wooden-tray") === originalWorld.tray,
      ),
    ).toBe(true);
    // Carry an actual ready bowl from the tray, pass the drinks room, and serve in guests.
    const a = await center(p, '[data-drag="dish:dish901"]');
    await p.mouse.move(a.x, a.y);
    await p.mouse.down();
    await p.mouse.move(b.x + 2, a.y, { steps: 12 });
    await p.clock.runFor(1300);
    await expect(p.locator(".drag-ghost")).toHaveCount(1);
    await p.mouse.move(b.x + b.width * 0.5, a.y);
    await photo(p, `${width}x${height}-carrying`);
    await p.mouse.move(b.x + 2, a.y);
    await p.clock.runFor(800);
    await p.mouse.move(b.x + b.width * 0.5, a.y);
    const target = p.locator(
      '[data-world-room=guests3] [data-drop^="customer:"]',
    );
    await expect(target.first()).toBeVisible();
    // Return to the order's page while maintaining the same captured bowl.
    await p.mouse.move(b.x + 2, a.y);
    await p.clock.runFor(2800);
    await p.mouse.move(b.x + b.width * 0.5, a.y);
    const c = await center(p, '[data-drop="customer:c0"]');
    await p.mouse.move(c.x, c.y, { steps: 10 });
    await p.mouse.up();
    await p.clock.runFor(400);
    const s = await p.evaluate(
      () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
    );
    expect(s.tray).toHaveLength(0);
    expect(s.customers.find((c) => c.id === "c0").status).toBe("eating");
    await expect(p.locator(".drag-ghost")).toHaveCount(0);
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-camera-state",
      "idle",
    );
    await go(p, "kitchen");
    const before = await offset(p);
    // Sources and a vertical stroke never become camera swipes.
    const ingredient = await center(p, '[data-drag="ingredient:dashi"]');
    await p.mouse.move(ingredient.x, ingredient.y);
    await p.mouse.down();
    await p.mouse.move(ingredient.x + 35, ingredient.y, { steps: 8 });
    await p.clock.runFor(100);
    expect(await offset(p)).toBe(before);
    await p.dispatchEvent("#app", "pointercancel", { pointerId: 1 });
    await p.mouse.up();
    await p.clock.runFor(400);
    await expect(p.locator(".drag-ghost")).toHaveCount(0);
    await p.mouse.move(b.x + b.width * 0.5, y);
    await p.mouse.down();
    await p.mouse.move(b.x + b.width * 0.5, y - 70, { steps: 8 });
    await p.mouse.up();
    await p.clock.runFor(400);
    expect(await offset(p)).toBe(before);
    // A true touch swipe on the navigation bar shares the camera path.
    const nav = await p.locator(".scene-pagination").boundingBox(),
      cdp = await p.context().newCDPSession(p);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: nav.x + 10, y: nav.y + nav.height / 2, id: 1 }],
    });
    for (let i = 1; i <= 10; i++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: nav.x + 10 + ((b.width * 0.6 - 10) * i) / 10,
            y: nav.y + nav.height / 2,
            id: 1,
          },
        ],
      });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await p.clock.runFor(400);
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-visible-rooms",
      "drinks",
    );
    // Full overlays freeze an in-progress snap, then resume its same offset.
    await p.locator(".scene-pagination [data-arg=kitchen]").tap();
    await p.clock.runFor(96);
    await p.locator(".hud [data-arg=settings]").tap();
    const paused = await offset(p);
    await p.clock.runFor(1500);
    expect(await offset(p)).toBe(paused);
    await expect(p.locator(".game")).toHaveAttribute("inert", "");
    await p.locator(".close-sheet").tap();
    await p.clock.runFor(400);
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-visible-rooms",
      "kitchen",
    );
    for (const panel of ["recipes", "manage"]) {
      await p.locator(`.bottom-tools [data-arg=${panel}]`).tap();
      await p.clock.runFor(200);
      await expect(p.locator(".sheet")).toBeVisible();
      await p.locator(".close-sheet").tap();
      await p.clock.runFor(50);
    }
    // UI camera remains transient; the unchanged v3 save is still valid.
    expect(
      validState(
        await p.evaluate(
          () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
        ),
      ),
    ).toBe(true);
    await go(p, "front");
    await p.locator(".scene-arrow.right").tap();
    await p.clock.runFor(400);
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-visible-rooms",
      "guests0",
    );
    await p.locator(".scene-arrow.left").tap();
    await p.clock.runFor(400);
    await expect(p.locator("#stage")).toHaveAttribute(
      "data-visible-rooms",
      "front",
    );
    expect(errors).toEqual([]);
    metrics.viewports.push({
      width,
      height,
      identity: true,
      realDishServed: true,
    });
    await p.close();
    console.log(
      `PASS: ${width}x${height} continuous seam, snap, node identity and tray carry across rooms.`,
    );
  }
  const reduced = await pageFor(390, 844, "reduce");
  await go(reduced.p, "kitchen");
  const b = await reduced.p.locator("#stage").boundingBox(),
    reducedNav = await reduced.p.locator(".scene-pagination").boundingBox(),
    y = reducedNav.y + reducedNav.height / 2;
  await reduced.p.mouse.move(reducedNav.x + 4, y);
  await reduced.p.mouse.down();
  await reduced.p.mouse.move(reducedNav.x + 4 + b.width * 0.65, y, { steps: 12 });
  expect(await offset(reduced.p)).toBe(6);
  await reduced.p.mouse.up();
  await expect(reduced.p.locator("#stage")).toHaveAttribute(
    "data-visible-rooms",
    "drinks",
  );
  await expect(reduced.p.locator("#stage")).toHaveAttribute(
    "data-camera-state",
    "idle",
  );
  expect(reduced.errors).toEqual([]);
  await reduced.p.close();
  const cupEngine = new Engine(fixture());
  cupEngine.s.tray[0].drink = null;
  cupEngine.s.tray[0].drinkTemperature = null;
  cupEngine.s.tray[0].drinkTopping = null;
  expect(cupEngine.drinkStart("tea")).toBe(true);
  for (const step of DRINK_METHODS.tea)
    expect(cupEngine.drinkStep(step.action)).toBe(true);
  const cup = await pageFor(390, 844, "no-preference", true, cupEngine.s);
  await go(cup.p, "drinks");
  const cupStart = await center(cup.p, "[data-drag=drink]"),
    cupFrame = await cup.p.locator("#stage").boundingBox();
  await cup.p.mouse.move(cupStart.x, cupStart.y);
  await cup.p.mouse.down();
  await cup.p.mouse.move(cupFrame.x + 2, cupStart.y, { steps: 12 });
  await cup.p.clock.runFor(850);
  await cup.p.mouse.move(cupFrame.x + cupFrame.width / 2, cupStart.y);
  const cupTarget = await center(cup.p, '[data-drop="dish:dish901"]');
  await cup.p.mouse.move(cupTarget.x, cupTarget.y, { steps: 10 });
  await cup.p.mouse.up();
  await cup.p.clock.runFor(400);
  const cupSave = await cup.p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
  expect(cupSave.tray[0].drink).toBe("tea");
  expect(cupSave.drink).toBeNull();
  expect(validState(cupSave)).toBe(true);
  expect(cup.errors).toEqual([]);
  await cup.p.close();
  console.log(
    "PASS: a real brewed cup crosses drinks -> guests and attaches once to the persistent tray.",
  );
  const bowlEngine = new Engine(fixture());
  bowlEngine.s.tray = [];
  expect(bowlEngine.burnerStep(0)).toBe(true);
  expect(bowlEngine.burnerStep(0)).toBe(true);
  for (let i = 0; i < 6; i++) bowlEngine.tick(1);
  expect(bowlEngine.noodles(0)).toBe(true);
  for (const id of ["dashi", "dashi", "soy", "mirin"])
    expect(bowlEngine.brothAdd(id)).toBe(true);
  expect(bowlEngine.brothCook()).toBe(true);
  for (let i = 0; i < 9; i++) bowlEngine.tick(1);
  expect(bowlEngine.liftNoodles(0)).toBe(true);
  expect(bowlEngine.pour(0)).toBe(true);
  expect(bowlEngine.topping(0, "onion")).toBe(true);
  const bowlPage = await pageFor(390, 844, "no-preference", true, bowlEngine.s);
  await go(bowlPage.p, "kitchen");
  const bowlStart = await center(bowlPage.p, '[data-drag="bowl:0"]'),
    bowlFrame = await bowlPage.p.locator("#stage").boundingBox();
  await bowlPage.p.mouse.move(bowlStart.x, bowlStart.y);
  await bowlPage.p.mouse.down();
  await bowlPage.p.mouse.move(bowlFrame.x + 2, bowlStart.y, { steps: 12 });
  await bowlPage.p.clock.runFor(850);
  await bowlPage.p.mouse.move(bowlFrame.x + bowlFrame.width / 2, bowlStart.y);
  const trayTarget = await center(bowlPage.p, ".wooden-tray");
  await bowlPage.p.mouse.move(trayTarget.x, trayTarget.y, { steps: 10 });
  await bowlPage.p.mouse.up();
  await bowlPage.p.clock.runFor(400);
  const bowlSave = await bowlPage.p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
  expect(bowlSave.tray).toHaveLength(1);
  expect(bowlSave.pots[0]).toBeNull();
  expect(validState(bowlSave)).toBe(true);
  expect(bowlPage.errors).toEqual([]);
  await bowlPage.p.close();
  const expansionEngine = new Engine();
  expansionEngine.s.money = 100000;
  expansionEngine.open();
  expansionEngine.s.nextArrival = 1000;
  const expansion = await pageFor(
    390,
    844,
    "no-preference",
    true,
    expansionEngine.s,
  );
  await go(expansion.p, "kitchen");
  await expansion.p.locator(".scene-pagination [data-arg=drinks]").tap();
  await expansion.p.clock.runFor(96);
  await expansion.p.locator(".bottom-tools [data-arg=manage]").tap();
  await expansion.p.locator(".sheet [data-arg=upgrades]").tap();
  await expansion.p.locator(".sheet [data-act=upgrade][data-arg=seats]").tap();
  await expansion.p.clock.runFor(40);
  await expansion.p.locator(".close-sheet").tap();
  await expansion.p.clock.runFor(400);
  await expect(expansion.p.locator(".scene-pagination button")).toHaveCount(7);
  await expect(expansion.p.locator("#stage")).toHaveAttribute(
    "data-visible-rooms",
    "drinks",
  );
  expect(await offset(expansion.p)).toBe(3);
  expect(expansion.errors).toEqual([]);
  await expansion.p.close();
  console.log(
    "PASS: cooked/lifted/poured bowl crosses kitchen -> drinks into tray; seat expansion preserves a paused snap target.",
  );
  const dropEngine = new Engine(fixture());
  expect(dropEngine.burnerStep(0)).toBe(true);
  expect(dropEngine.burnerStep(0)).toBe(true);
  for (let i = 0; i < 6; i++) dropEngine.tick(1);
  const partial = await pageFor(390, 844, "no-preference", true, dropEngine.s);
  await go(partial.p, "kitchen");
  const noodles = await center(partial.p, "[data-drag=noodles]"),
    partialFrame = await partial.p.locator("#stage").boundingBox();
  await partial.p.mouse.move(noodles.x, noodles.y);
  await partial.p.mouse.down();
  await partial.p.mouse.move(partialFrame.x + 2, noodles.y, { steps: 12 });
  await partial.p.clock.runFor(550);
  await expect(
    partial.p.locator(".scene-pagination [data-arg=drinks]"),
  ).toHaveClass(/active/);
  const pot = await center(
    partial.p,
    '[data-world-room=kitchen] [data-drop="pot:0"]',
  );
  expect(
    await partial.p.evaluate(
      ({ x, y }) =>
        document.elementFromPoint(x, y)?.closest("[data-drop]")?.dataset.drop,
      pot,
    ),
  ).toBe("pot:0");
  await partial.p.mouse.move(pot.x, pot.y, { steps: 10 });
  await partial.p.mouse.up();
  await partial.p.clock.runFor(400);
  const partialSave = await partial.p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
  expect(partialSave.pots[0]).not.toBeNull();
  expect(validState(partialSave)).toBe(true);
  await expect(partial.p.locator("#stage")).toHaveAttribute(
    "data-visible-rooms",
    "kitchen",
  );
  expect(partial.errors).toEqual([]);
  await partial.p.close();
  console.log(
    "PASS: screen hitbox drops real noodles into the partially visible kitchen while drinks is the nearest room.",
  );
  console.log(
    "PASS: actual touch navigation, object/vertical arbitration, cancel, arrow buttons, modal snap pause and reduced-motion instant switch.",
  );
  const sheets = await pageFor(390, 844);
  await go(sheets.p, "front");
  await sheets.p.evaluate(async () => {
    const { createSceneMotion } = await import("/src/ui/motion/controller.js");
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#9c7257";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#92a777";
    ctx.fillRect(64, 0, 64, 64);
    const el = document.querySelector("[data-motion-actor=owner]");
    window.ownerIdentity = el;
    window.sheetLoads = 0;
    const asset = {
      type: "anim",
      status: "ready",
      file: "animations/memory-test.webp",
      frames: 2,
      fps: 4,
      loop: true,
      frameWidth: 64,
      frameHeight: 64,
      fallback: "v3-owner",
    };
    window.sheetMotion = createSceneMotion(
      {
        state: () => ({ phase: "prep" }),
        moving: () => true,
        blocked: () => false,
        guests: { paint() {} },
        camera: {
          step: () => false,
          roots: () => [...document.querySelectorAll("[data-world-room]")],
          active: () => false,
          stats: () => ({
            offset: Number(
              document.querySelector("#stage").dataset.cameraOffset,
            ),
          }),
          contains(el) {
            const a = el.getBoundingClientRect(),
              b = document.querySelector("#stage").getBoundingClientRect();
            return (
              el.isConnected &&
              a.right > b.left &&
              a.left < b.right &&
              a.bottom > b.top &&
              a.top < b.bottom
            );
          },
        },
      },
      { [el.dataset.animId]: asset },
      async () => {
        window.sheetLoads++;
        return canvas.toDataURL();
      },
    );
    window.sheetMotion.reconcile();
  });
  await expect(sheets.p.locator(".sheet-viewport")).toHaveCount(1);
  const nav = await sheets.p.locator(".scene-pagination").boundingBox();
  // Chrome is narrower now; use a world-width drag from the empty stage.
  const stage = await sheets.p.locator("#stage").boundingBox();
  await sheets.p.mouse.move(stage.x + stage.width - 10, stage.y + 80);
  await sheets.p.mouse.down();
  await sheets.p.mouse.move(stage.x + 10, stage.y + 80, { steps: 12 });
  await sheets.p.clock.runFor(40);
  // The front room remains partly visible, but the owner is outside the viewport.
  await expect(sheets.p.locator("[data-world-room=front]")).toHaveCount(1);
  await expect(sheets.p.locator(".sheet-viewport")).toHaveCount(0);
  expect(await sheets.p.evaluate(() => window.ownerIdentity.isConnected)).toBe(
    true,
  );
  const resizedOffset = await offset(sheets.p);
  await sheets.p.setViewportSize({ width: 430, height: 932 });
  expect(await offset(sheets.p)).toBeCloseTo(resizedOffset, 5);
  await sheets.p.mouse.up();
  await sheets.p.clock.runFor(400);
  await go(sheets.p, "front");
  await sheets.p.evaluate(() => window.sheetMotion.reconcile());
  await expect(sheets.p.locator(".sheet-viewport")).toHaveCount(1);
  expect(
    await sheets.p.evaluate(
      () =>
        document.querySelector("[data-motion-actor=owner]") ===
          window.ownerIdentity && window.sheetLoads === 2,
    ),
  ).toBe(true);
  await sheets.p.evaluate(() => window.sheetMotion.dispose());
  expect(sheets.errors).toEqual([]);
  await sheets.p.close();
  console.log(
    "PASS: sheet destroyed outside actual visible region, cached actor preserved on return, fractional offset survives resize.",
  );

  const bench = await pageFor(390, 844, "no-preference", false);
  await go(bench.p, "guests3", false);
  const mediaQueriesBefore = await bench.p.evaluate(
    () => window.reducedMotionQueries,
  );
  metrics.frameTiming = await bench.p.evaluate(async () => {
    const fx = await import("/src/ui/experience.js"),
      samples = [],
      start = performance.now();
    let previous = start,
      maxAnimations = 0,
      maxEffects = 0,
      maxNodes = 0,
      crossings = 0,
      lastRooms = "";
    const path = ["drinks", "kitchen", "drinks", "guests3"];
    let i = 0;
    const travel = setInterval(
      () =>
        document
          .querySelector(
            `.scene-pagination [data-arg=${path[i++ % path.length]}]`,
          )
          .click(),
      720,
    );
    const burst = setInterval(() => {
      const anchor = document.querySelector(".scene-pagination .active");
      fx.touchFeedback(anchor);
      fx.moneyFeedback(5, anchor);
    }, 180);
    await new Promise((resolve) => {
      function frame(now) {
        samples.push(now - previous);
        previous = now;
        const stage = document.querySelector("#stage"),
          rooms = stage.dataset.visibleRooms;
        if (rooms !== lastRooms && rooms.includes(",")) crossings++;
        lastRooms = rooms;
        maxAnimations = Math.max(
          maxAnimations,
          document.getAnimations().length,
        );
        const stats = fx.effectStats();
        maxEffects = Math.max(maxEffects, stats.effects);
        maxNodes = Math.max(maxNodes, stats.nodes);
        if (now - start < 5000) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    clearInterval(travel);
    clearInterval(burst);
    const sorted = [...samples].sort((a, b) => a - b);
    return {
      durationMs: previous - start,
      frames: samples.length,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p50Ms: sorted[Math.floor(sorted.length * 0.5)],
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      maxMs: Math.max(...samples),
      framesOver33ms: samples.filter((n) => n > 33.34).length,
      maxAnimations,
      maxEffects,
      maxNodes,
      crossings,
    };
  });
  expect(metrics.frameTiming.durationMs).toBeGreaterThanOrEqual(5000);
  expect(metrics.frameTiming.crossings).toBeGreaterThan(3);
  expect(metrics.frameTiming.maxAnimations).toBeLessThanOrEqual(40);
  expect(metrics.frameTiming.maxEffects).toBeLessThanOrEqual(12);
  expect(metrics.frameTiming.maxNodes).toBeLessThanOrEqual(24);
  expect(await bench.p.evaluate(() => window.reducedMotionQueries)).toBe(
    mediaQueriesBefore,
  );
  await bench.p.emulateMedia({ reducedMotion: "reduce" });
  await bench.p.locator('.scene-pagination [data-arg="kitchen"]').tap();
  await expect(bench.p.locator("#stage")).toHaveAttribute(
    "data-camera-state",
    "idle",
  );
  await expect(bench.p.locator("#stage")).toHaveAttribute(
    "data-visible-rooms",
    "kitchen",
  );
  await bench.p.emulateMedia({ reducedMotion: "no-preference" });
  const restoredMotion = await bench.p.evaluate(() => {
    // Touch navigation deliberately suppresses follow-up synthetic clicks.
    // Keyboard navigation exercises the restored motion preference directly.
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    return document.querySelector("#stage").dataset.cameraState;
  });
  expect(restoredMotion).toBe("snapping");
  expect(bench.errors).toEqual([]);
  await bench.p.close();
  await fs.writeFile(
    `${output}/metrics.json`,
    JSON.stringify(metrics, null, 2) + "\n",
  );
  console.log(
    "PASS: real five-second RAF with repeated camera travel, eight-guest fixture and effect bursts.",
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser.close();
}
