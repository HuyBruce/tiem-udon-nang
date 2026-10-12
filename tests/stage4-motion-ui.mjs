import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import sharp from "sharp";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { recipeBook, brothFormula } from "../src/systems/discovery.js";

const base = process.env.UDON_TEST_BASE_URL || "http://localhost:5173";
const output = process.env.STAGE4_SCREENSHOTS || "docs/review/stage4a";
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const metrics = {
  simulation: "Chromium desktop, mobile viewport; not a physical phone",
  animations: {},
};
function dish(s, c, changes = {}) {
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
function fixture(mood = "waiting", decorated = false) {
  const e = new Engine();
  if (decorated) {
    e.s.money = 200000;
    for (let i = 0; i < 3; i++) expect(e.upgrade("seats")).toBe(true);
    for (const id of [
      "wall",
      "table",
      "bowl",
      "cup",
      "flowers",
      "season-spring",
    ])
      expect(e.decorate(id)).toBe(true);
    for (const id of ["thu", "mika"]) expect(e.hire(id)).toBe(true);
    expect(e.adoptPet("cat")).toBe(true);
    e.s.flowerRooms.guests = 3;
  }
  e.open();
  if (decorated) for (let i = 1; i < 8; i++) e.spawn();
  e.s.nextArrival = 1000;
  e.tick(2);
  if (mood !== "waiting") {
    const c = e.s.customers[0];
    e.accept(c.id);
    e.s.tray.push(dish(e.s, c, mood === "sad" ? { tops: [] } : {}));
    expect(e.serve("dish901", c.id)).toBe(true);
    expect(c.happy).toBe(mood !== "sad");
  }
  expect(validState(e.s)).toBe(true);
  return e.s;
}
async function pageFor(s, width = 390, height = 844, clock = true) {
  const p = await browser.newPage({
    viewport: { width, height },
    isMobile: true,
    hasTouch: true,
  });
  p.setDefaultTimeout(12000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (clock) {
    const t = new Date("2026-10-09T00:00:00Z");
    await p.clock.install({ time: t });
    await p.clock.pauseAt(new Date(t.getTime() + 1000));
  }
  await p.addInitScript(
    (s) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s })),
    s,
  );
  await p.goto(base + "/?debug=1");
  await p.addStyleTag({
    content:
      ".debug-tools{display:none!important}.sheet,.modal-backdrop{animation:none!important}",
  });
  await p.locator("[data-act=start]").tap();
  if (await p.locator(".close-sheet").count())
    await p.locator(".close-sheet").tap();
  // New alpha layers decode asynchronously; settle geometry before pose comparisons.
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((img) => img.decode().catch(() => {})),
    );
  });
  if (clock) await p.clock.runFor(20);
  return { p, errors };
}
async function go(p, id) {
  await p.locator(`.scene-pagination [data-act=goto][data-arg="${id}"]`).tap();
  await p.clock.runFor(350);
}
async function photo(p, name) {
  await p.waitForFunction(() =>
    [...document.querySelectorAll(".stage img")].every(
      (i) => i.complete && i.naturalWidth > 0,
    ),
  );
  await p.screenshot({ path: `${output}/${name}.png` });
}
async function saveCheck(p) {
  const s = await p.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
  expect(validState(s)).toBe(true);
  expect(
    Object.keys(s).filter(
      (k) => !Object.keys(newState()).includes(k) && k !== "dishSerial",
    ),
  ).toEqual([]);
  expect(JSON.stringify(s)).not.toMatch(
    /"(?:motionPhase|guestPose|guestX|sheetFrame|ui)":/,
  );
}
try {
  // Actor identity survives full-cover order panel, with presentation paused.
  const identity = await pageFor(fixture());
  const p = identity.p;
  await p.evaluate(
    () => (window.original = document.querySelector(".customer >.sprite")),
  );
  await p.clock.runFor(250);
  // Sample a completed render at the frozen clock's current instant. The last
  // RAF may precede runFor's endpoint by a fraction of a frame; comparing that
  // pose with a synchronous panel render measures normal interpolation drift.
  await p.locator(".hud [data-act=panel][data-arg=settings]").tap();
  await p.locator(".close-sheet").tap();
  const before = await p
    .locator(".customer")
    .evaluate((e) => parseFloat(e.style.getPropertyValue("--guest-bob")));
  for (let i = 0; i < 3; i++) {
    await p.locator(".order-ticket").tap();
    expect(
      await p.evaluate(
        () => document.querySelector(".customer >.sprite") === window.original,
      ),
    ).toBe(true);
    expect(await p.locator(".stage").getAttribute("data-motion-running")).toBe(
      "false",
    );
    await p.locator(".close-sheet").tap();
    expect(
      await p.evaluate(
        () => document.querySelector(".customer >.sprite") === window.original,
      ),
    ).toBe(true);
  }
  expect(
    Math.abs(
      (await p
        .locator(".customer")
        .evaluate((e) => parseFloat(e.style.getPropertyValue("--guest-bob")))) -
        before,
    ),
  ).toBeLessThan(0.01);
  expect(identity.errors).toEqual([]);
  await p.close();
  console.log(
    "PASS: same actor node through repeated renders, no restart, full panel pauses scene.",
  );
  const entering = new Engine();
  entering.open();
  entering.s.nextArrival = 1000;
  const pausedEntry = await pageFor(entering.s);
  await pausedEntry.p.clock.runFor(400);
  const xBefore = await pausedEntry.p
    .locator(".customer")
    .evaluate((e) => Number(e.style.getPropertyValue("--guest-x")));
  expect(xBefore).toBeLessThan(0);
  await pausedEntry.p.locator(".hud [data-act=panel][data-arg=settings]").tap();
  await pausedEntry.p.clock.runFor(1500);
  await pausedEntry.p.locator(".close-sheet").tap();
  const xAfter = await pausedEntry.p
    .locator(".customer")
    .evaluate((e) => Number(e.style.getPropertyValue("--guest-x")));
  expect(Math.abs(xAfter - xBefore)).toBeLessThan(0.03);
  await pausedEntry.p.clock.runFor(400);
  expect(
    await pausedEntry.p
      .locator(".customer")
      .evaluate((e) => Number(e.style.getPropertyValue("--guest-x"))),
  ).toBeGreaterThan(xAfter);
  expect(pausedEntry.errors).toEqual([]);
  await pausedEntry.p.close();
  console.log(
    "PASS: entering guest resumes its interpolated position after a 1.5-second settings pause.",
  );

  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [430, 932],
  ]) {
    for (const mood of ["happy", "sad"]) {
      const { p, errors } = await pageFor(fixture(mood), width, height);
      await p.clock.runFor(300);
      await expect(p.locator(".customer")).toHaveAttribute(
        "data-reaction",
        mood === "sad" ? "disappointed" : "happy",
      );
      await photo(p, `${width}x${height}-${mood}`);
      await p.clock.runFor(400);
      const face = await p.locator(".customer >.sprite").boundingBox();
      const bowl = await p
        .locator(".guest-meal-part .food-layers")
        .boundingBox();
      // Upper 40% of portrait is the head/face; bowl stays below it at peak lift.
      expect(bowl.y).toBeGreaterThan(face.y + face.height * 0.4);
      if (mood === "happy") await photo(p, `${width}x${height}-eating`);
      await saveCheck(p);
      expect(errors).toEqual([]);
      await p.close();
    }
    const { p, errors } = await pageFor(
      fixture("waiting", true),
      width,
      height,
    );
    const stage = await p.locator(".stage").boundingBox();
    for (const b of await p
      .locator(".scene-staff")
      .evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().toJSON()))) {
      expect(b.left).toBeGreaterThanOrEqual(stage.x);
      expect(b.right).toBeLessThanOrEqual(stage.x + stage.width);
    }
    await go(p, "front");
    await p.clock.runFor(300);
    await photo(p, `${width}x${height}-plants-lantern`);
    await expect(p.locator("[data-motion-env=plant]")).not.toHaveCount(0);
    await go(p, "guests0");
    // Generate actual existing empty-tray feedback, then inspect its two-line placement.
    await p.locator("[data-act=dish]").count();
    await p.evaluate(() => {
      const t = document.querySelector("#toast");
      t.textContent =
        "Thông báo thử vị trí mới: chọn món trên khay rồi giao cho khách đang chờ.";
      t.classList.add("show");
    });
    await p.clock.runFor(300);
    const toast = await p.locator("#toast").boundingBox(),
      tray = await p.locator(".wooden-tray").boundingBox();
    expect(toast.y + toast.height).toBeLessThan(tray.y);
    expect(toast.height).toBeLessThanOrEqual(44.1);
    expect(
      await p
        .locator("#toast")
        .evaluate((e) => getComputedStyle(e).pointerEvents),
    ).toBe("none");
    await photo(p, `${width}x${height}-toast`);
    expect(errors).toEqual([]);
    await p.close();
  }
  console.log(
    "PASS: face visible at peak lift, staff in bounds, noren/foliage/lantern and toast screenshots at three sizes.",
  );

  // In-memory synthetic alpha WebP, exercised at the real owner location. Never written to assets.
  const sheet = await sharp({
    create: {
      width: 64,
      height: 32,
      channels: 4,
      background: { r: 220, g: 140, b: 60, alpha: 1 },
    },
  })
    .composite([
      {
        input: Buffer.from(
          '<svg width="32" height="32"><rect width="32" height="32" fill="#729c66"/></svg>',
        ),
        left: 32,
        top: 0,
      },
    ])
    .webp()
    .toBuffer();
  const sheets = await pageFor(newState());
  await go(sheets.p, "front");
  await sheets.p.route("**/test-sheet.webp", (r) =>
    r.fulfill({ contentType: "image/webp", body: sheet }),
  );
  await sheets.p.evaluate(async () => {
    const { createSceneMotion } = await import("/src/ui/motion/controller.js");
    const el = document.querySelector("[data-motion-actor=owner]");
    const a = {
      type: "anim",
      status: "ready",
      file: "animations/test-sheet.webp",
      frames: 2,
      fps: 4,
      loop: true,
      frameWidth: 32,
      frameHeight: 32,
      fallback: "v3-owner",
    };
    window.testMoving = true;
    window.testBlocked = false;
    window.testLoads = 0;
    window.testMotion = createSceneMotion(
      {
        state: () => ({ phase: "prep" }),
        moving: () => window.testMoving,
        blocked: () => window.testBlocked,
        guests: { paint() {} },
      },
      { [el.dataset.animId]: a },
      async () => {
        window.testLoads++;
        return "/test-sheet.webp";
      },
    );
    window.testMotion.reconcile();
  });
  await expect(sheets.p.locator("[data-motion-actor=owner]")).toHaveAttribute(
    "data-sheet-status",
    "ready",
  );
  await sheets.p.clock.runFor(300);
  await expect(sheets.p.locator(".sheet-viewport")).toHaveAttribute(
    "data-frame",
    "1",
  );
  await sheets.p.evaluate(() => window.testMotion.reconcile());
  expect(await sheets.p.evaluate(() => window.testLoads)).toBe(1);
  await expect(sheets.p.locator(".sheet-viewport")).toHaveAttribute(
    "data-frame",
    "1",
  );
  await sheets.p.evaluate(() => {
    window.testMoving = false;
    window.testMotion.update();
  });
  await expect(sheets.p.locator(".sheet-viewport")).toHaveAttribute(
    "data-frame",
    "0",
  );
  await sheets.p.evaluate(() => {
    window.testMotion.dispose();
  });
  // Failed and missing asset retain the same real portrait and no viewport.
  await sheets.p.route("**/broken-sheet.webp", (r) =>
    r.fulfill({ contentType: "image/webp", body: "invalid" }),
  );
  await sheets.p.evaluate(async () => {
    const { createSheetPlayer } =
      await import("/src/ui/motion/sprite-sheet.js");
    const el = document.querySelector("[data-motion-actor=owner]");
    const a = {
      type: "anim",
      status: "ready",
      file: "animations/test-sheet.webp",
      frames: 2,
      fps: 4,
      loop: true,
      frameWidth: 32,
      frameHeight: 32,
      fallback: "v3-owner",
    };
    window.broken = createSheetPlayer(el, a, async () => "/broken-sheet.webp");
  });
  await expect(sheets.p.locator("[data-motion-actor=owner]")).toHaveAttribute(
    "data-sheet-status",
    "error",
  );
  expect(
    await sheets.p
      .locator("[data-motion-actor=owner]")
      .evaluate((e) => getComputedStyle(e).opacity),
  ).toBe("1");
  await sheets.p.evaluate(async () => {
    window.broken.destroy();
    const { createSheetPlayer } =
      await import("/src/ui/motion/sprite-sheet.js");
    window.missing = createSheetPlayer(
      document.querySelector("[data-motion-actor=owner]"),
      { type: "anim", status: "planned" },
      () => {
        throw Error("must not request");
      },
    );
  });
  await expect(sheets.p.locator("[data-motion-actor=owner]")).toHaveAttribute(
    "data-sheet-status",
    "fallback",
  );
  await sheets.p.evaluate(async () => {
    window.missing.destroy();
    const { createSheetPlayer } =
      await import("/src/ui/motion/sprite-sheet.js");
    window.absent = createSheetPlayer(
      document.querySelector("[data-motion-actor=owner]"),
      {
        type: "anim",
        status: "ready",
        file: "animations/absent.webp",
        frames: 2,
        fps: 4,
        loop: true,
        frameWidth: 32,
        frameHeight: 32,
        fallback: "v3-owner",
      },
      async () => undefined,
    );
  });
  await expect(sheets.p.locator("[data-motion-actor=owner]")).toHaveAttribute(
    "data-sheet-status",
    "fallback",
  );
  await expect(sheets.p.locator(".sheet-viewport")).toHaveCount(0);
  expect(sheets.errors).toEqual([]);
  await sheets.p.close();
  console.log(
    "PASS: lazy synthetic sheet on owner, playback/no reload/first-frame mode, load-error and absent asset fallback.",
  );

  for (const setting of ["reduce", "performance", "animation"]) {
    const s = fixture("happy", true);
    if (setting === "performance") s.settings.performance = true;
    if (setting === "animation") s.settings.animation = false;
    const { p, errors } = await pageFor(s);
    if (setting === "reduce") await p.emulateMedia({ reducedMotion: "reduce" });
    await p.clock.runFor(400);
    expect(await p.locator(".stage").getAttribute("data-motion-running")).toBe(
      "false",
    );
    expect(
      await p.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) =>
                a.effect.getTiming().iterations === Infinity &&
                a.playState === "running",
            ).length,
      ),
    ).toBe(0);
    expect(
      await p
        .locator("[data-motion-env=plant]")
        .first()
        .evaluate((e) => e.style.transform),
    ).toBe("none");
    await saveCheck(p);
    expect(errors).toEqual([]);
    await p.close();
  }
  const hidden = await pageFor(fixture("waiting", true));
  await hidden.p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(
    await hidden.p.locator(".stage").getAttribute("data-motion-running"),
  ).toBe("false");
  expect(
    await hidden.p.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect.getTiming().iterations === Infinity &&
              a.playState === "running",
          ).length,
    ),
  ).toBe(0);
  await hidden.p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(
    await hidden.p.locator(".stage").getAttribute("data-motion-running"),
  ).toBe("true");
  await hidden.p.close();
  console.log(
    "PASS: reduced-motion, low performance, animations off, tab visibility pause/resume.",
  );

  const full = fixture("waiting", true);
  full.forecast.weather = "rain";
  const bench = await pageFor(full, 390, 844, false);
  const animationCounts = {};
  for (const id of [
    "front",
    "guests0",
    "guests1",
    "guests2",
    "guests3",
    "drinks",
    "kitchen",
    "storage",
    "garden",
  ]) {
    await go(bench.p, id);
    animationCounts[id] = await bench.p.evaluate(async () => {
      const fx = await import("/src/ui/experience.js");
      const e = fx;
      const anchor =
        document.querySelector(".stage button") ||
        document.querySelector("[data-act=goto]");
      let max = document.getAnimations().length;
      for (let i = 0; i < 30; i++) {
        fx.touchFeedback(anchor);
        fx.moneyFeedback(5, anchor);
        fx.ingredientFlight("<span>•</span>", anchor, ".wooden-tray");
        const s = e.effectStats();
        if (!s.effects)
          throw Error("Effects measurement is disconnected from the producer");
        const roots = [...document.querySelectorAll("[data-effect]")];
        const nodes = (n) =>
          1 + [...n.childNodes].reduce((sum, c) => sum + nodes(c), 0);
        if (
          roots.length > 12 ||
          roots.reduce((sum, n) => sum + nodes(n), 0) > 24
        )
          throw Error("Actual particle DOM exceeds budget");
        if (s.effects > 12 || s.nodes > 24)
          throw Error("particle budget " + JSON.stringify(s));
        max = Math.max(max, document.getAnimations().length);
      }
      await new Promise((r) => requestAnimationFrame(r));
      return Math.max(max, document.getAnimations().length);
    });
    expect(animationCounts[id]).toBeLessThanOrEqual(40);
    await bench.p.evaluate(async () => {
      (await import("/src/ui/experience.js")).clearEffects();
    });
  }
  metrics.animations = animationCounts;
  await go(bench.p, "guests0");
  metrics.frameTiming = await bench.p.evaluate(async () => {
    const fx = await import("/src/ui/experience.js");
    const e = fx;
    const samples = [];
    let previous = performance.now(),
      start = previous,
      maxAnimations = 0,
      maxEffects = 0,
      maxNodes = 0;
    const burst = setInterval(() => {
      fx.touchFeedback(document.querySelector(".customer"));
      fx.moneyFeedback(5, document.querySelector(".customer"));
    }, 180);
    await new Promise((resolve) => {
      function frame(now) {
        samples.push(now - previous);
        previous = now;
        const s = e.effectStats();
        maxAnimations = Math.max(
          maxAnimations,
          document.getAnimations().length,
        );
        maxEffects = Math.max(maxEffects, s.effects);
        maxNodes = Math.max(maxNodes, s.nodes);
        if (now - start < 5000) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    clearInterval(burst);
    e.clearEffects();
    const sorted = [...samples].sort((a, b) => a - b);
    const percentile = (p) => sorted[Math.floor((sorted.length - 1) * p)];
    return {
      durationMs: previous - start,
      frames: samples.length,
      meanMs: samples.reduce((a, b) => a + b, 0) / samples.length,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      maxMs: Math.max(...samples),
      framesOver33ms: samples.filter((t) => t > 33.34).length,
      maxAnimations,
      maxEffects,
      maxNodes,
    };
  });
  expect(metrics.frameTiming.durationMs).toBeGreaterThanOrEqual(5000);
  expect(metrics.frameTiming.maxAnimations).toBeLessThanOrEqual(40);
  expect(metrics.frameTiming.maxEffects).toBeLessThanOrEqual(12);
  expect(metrics.frameTiming.maxEffects).toBeGreaterThan(0);
  expect(metrics.frameTiming.maxNodes).toBeLessThanOrEqual(24);
  await saveCheck(bench.p);
  expect(bench.errors).toEqual([]);
  await bench.p.close();
  await fs.writeFile(
    `${output}/metrics.json`,
    JSON.stringify(metrics, null, 2) + "\n",
  );
  console.log(
    "PASS: scene animation caps, shared money/heart/flight/ripple manager, real five-second RAF measurement.",
  );
  console.log(JSON.stringify(metrics));
} finally {
  await browser.close();
}
