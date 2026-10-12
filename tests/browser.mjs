import { chromium, expect } from "@playwright/test";
import { chooseWorkOption } from './ui-actions.mjs';
import fs from "node:fs/promises";
import { openPreparation } from "./ui-actions.mjs";
await fs.mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  reducedMotion: "reduce",
});
const page = await context.newPage(),
  errors = [];
if (process.env.DEBUG_TOUCH) page.on("console", (m) => console.log(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const act = (name, arg) =>
  page.locator(
    `[data-act="${name}"]${arg !== undefined ? `[data-arg="${arg}"]` : ""}`,
  );
const tap = async (name, arg) => {
  if (name === "dismiss" && !(await page.locator(".sheet").count())) return;
  const direct = page.locator("[data-work-detail]");
  if (name === "nav" && !(await act(name, arg).first().isVisible())) {
    const scenes = page.locator(".scene-pagination button");
    const active = await scenes.evaluateAll((buttons) =>
      buttons.findIndex((button) => button.classList.contains("active")),
    );
    await scenes.nth(active + Number(arg)).tap();
    return;
  }
  if (
    (await direct.count()) &&
    (name === "pot" ||
      name === "chop-open" ||
      (name === "panel" && !(await act(name, arg).count())))
  ) {
    await chooseWorkOption(page,'data-work-detail',
      name === "pot" ? "cook" : name === "chop-open" ? "chop" : arg,
    );
    return;
  }
  if ((await direct.count()) && name === "dish") {
    await act(name, arg).first().tap();
    await chooseWorkOption(page,'data-work-detail','dish');
    return;
  }
  if (name === "wash" && !(await act(name, arg).count())) {
    await act("work-target", "sink").tap();
    return;
  }
  let locator =
    name === "dismiss" ? page.locator(".close-sheet") : act(name, arg);
  if ((await locator.count()) > 1 && (await page.locator(".sheet").count()))
    locator = page
      .locator(".sheet")
      .locator(
        `[data-act="${name}"]${arg !== undefined ? `[data-arg="${arg}"]` : ""}`,
      );
  await locator.first().tap();
};
const state = () =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state,
  );
const cdp = await context.newCDPSession(page);
async function touchDrag(from, to) {
  const a =
      typeof from === "string" ? await page.locator(from).boundingBox() : from,
    b = typeof to === "string" ? await page.locator(to).boundingBox() : to;
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 },
    end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1 }],
  });
  for (let i = 1; i <= 10; i++)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: start.x + ((end.x - start.x) * i) / 10,
          y: start.y + ((end.y - start.y) * i) / 10,
          id: 1,
        },
      ],
    });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
try {
  await page.clock.install();
  const url = new URL(process.env.TEST_URL || "http://localhost:5173");
  url.searchParams.set("debug", "1");
  await page.goto(url.href);
  await page.addStyleTag({
    content: ".debug-tools { display: none !important; }",
  });
  if (process.env.DEBUG_TOUCH)
    await page.evaluate(() => {
      for (const type of [
        "pointerdown",
        "pointermove",
        "pointerup",
        "click",
        "pointercancel",
      ])
        document.addEventListener(
          type,
          (e) =>
            console.log(
              type,
              e.target.outerHTML.slice(0, 110),
              e.clientX,
              e.clientY,
              document.querySelector("#stage")?.dataset.cameraState,
              document.querySelector("#stage")?.dataset.cameraOffset,
            ),
          true,
        );
    });
  await expect(act("start")).toBeVisible();
  await page.screenshot({ path: "test-results/01-landing.png" });
  await tap("start");
  await expect(page.locator(".sheet")).toHaveCount(0);
  await openPreparation(page);
  await expect(
    page.getByRole("heading", { name: "Chào một ngày mới" }),
  ).toBeVisible();
  await tap("eggs");
  await page.clock.runFor(100);
  expect((await state()).prepared.egg).toBe(3);
  await tap("open");
  await page.clock.runFor(100);
  await expect(act("customer", "c0").first()).toBeVisible();
  await page.screenshot({ path: "test-results/02-guests.png" });
  await tap("customer", "c0");
  await expect(page.locator(".dialogue")).toContainText("udon thanh vị");
  await tap("accept", "c0");
  await page.clock.runFor(100);
  // Genuine touch swipe, not HTML drag/drop.
  const stage = await page.locator(".scene-pagination").boundingBox();
  await touchDrag(
    {
      x: stage.x + stage.width * 0.95,
      y: stage.y + stage.height * 0.22,
      width: 1,
      height: 1,
    },
    {
      x: stage.x + stage.width * 0.05,
      y: stage.y + stage.height * 0.22,
      width: 1,
      height: 1,
    },
  );
  await expect(page.locator("h1")).toHaveText("Quầy nước");
  await page.clock.runFor(500);
  await tap("nav", "1");
  await expect(page.locator("h1")).toHaveText("Căn bếp");
  if (
    !(await state()).burners[0] ||
    (await state()).burners[0].stage !== "boiling"
  ) {
    await tap("pot", "0");
    await tap("burner", "0");
    await page.clock.runFor(100);
    await tap("burner", "0");
    await page.clock.runFor(5500);
    await tap("dismiss");
  }
  if (!(await state()).brothBatch.servings) {
    await tap("panel", "broth");
    for (const id of ["dashi", "dashi", "soy", "mirin"]) {
      await tap("batch-add", id);
      await page.clock.runFor(100);
    }
    await tap("batch-cook");
    await page.clock.runFor(7500);
    await tap("dismiss");
  }
  await touchDrag('[data-drag="noodles"]', '[data-drop="pot:0"]');
  await page.clock.runFor(100);
  expect((await state()).pots[0].stage).toBe("boiling");
  await page.clock.runFor(10000);
  await tap("pot", "0");
  await expect(page.locator('[data-act="lift-noodles"]')).toBeVisible();
  await page.clock.runFor(500);
  await expect(page.locator(".cook-bowl .food-layers img")).toHaveCount(1);
  await expect(page.locator(".cook-status")).toContainText("vớt");
  await tap("lift-noodles", "0");
  await page.clock.runFor(100);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await tap("pour");
  const pourArt = page.locator('.pour-stream img[src*="broth-pour-stream"]');
  await expect(pourArt).toHaveCount(1);
  await expect
    .poll(() => pourArt.evaluate((image) => image.naturalWidth))
    .toBeGreaterThan(0);
  await page.clock.runFor(200);
  await page.screenshot({ path: "test-results/v3-broth-pour-390.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.runFor(50);
  await tap("select-topping", "onion");
  await page.clock.runFor(50);
  await tap("add-topping", "0");
  await page.clock.runFor(100);
  await page.screenshot({ path: "test-results/03-cooking.png" });
  // A completed bowl can be carried by touch from the pot to the persistent tray.
  await tap("dismiss");
  await touchDrag('[data-drag="bowl:0"]', '[data-drop="tray"]');
  await page.clock.runFor(500);
  expect((await state()).tray).toHaveLength(1);
  await tap("goto", "guests0");
  await touchDrag('[data-drag^="dish:"]', '[data-drop="customer:c0"]');
  await page.clock.runFor(500);
  expect((await state()).ledger.served).toBe(0);
  expect(
    (await state()).customers.find((c) => c.id === "c0").result.correct,
  ).toBe(true);
  await page.clock.runFor(9000);
  await expect(page.locator('.table-bowl[data-arg="c0"]')).toHaveAttribute(
    "aria-label",
    "Thu tiền",
  );
  await page.locator('.table-bowl[data-arg="c0"]').tap();
  await page.clock.runFor(1000);
  expect((await state()).ledger.served).toBe(1);
  await page.locator('.table-bowl[data-arg="c0"]').tap();
  await page.clock.runFor(100);
  expect((await state()).sink).toBe(1);
  await tap("goto", "kitchen");
  const sink = await page.locator(".stage [data-wash]").boundingBox();
  await touchDrag(".stage [data-wash]", {
    x: sink.x + sink.width * 0.85,
    y: sink.y + sink.height * 0.2,
    width: 1,
    height: 1,
  });
  await page.clock.runFor(2200);
  expect((await state()).sink).toBe(0);
  await tap("chop-open");
  const board = await page.locator("[data-chop]").boundingBox();
  for (const ratio of [0.25, 0.5, 0.75]) {
    await touchDrag(
      {
        x: board.x + board.width * ratio,
        y: board.y + 35,
        width: 1,
        height: 1,
      },
      {
        x: board.x + board.width * ratio,
        y: board.y + board.height - 30,
        width: 1,
        height: 1,
      },
    );
    await page.clock.runFor(500);
  }
  expect((await state()).cutBonus).toBe(1);
  await tap("dismiss");
  await tap("panel", "fryer");
  await tap("fry-select");
  await page.clock.runFor(100);
  await tap("fry-step", "0:batter");
  await page.clock.runFor(100);
  await tap("fry-step", "0:oil");
  await page.clock.runFor(6500);
  await tap("fry-step", "0:lift");
  await page.clock.runFor(100);
  expect((await state()).prepared.tempura).toBe(1);
  await tap("dismiss");
  // Second customer orders beef and a Ramune; verify drink association and persistence.
  await page.clock.runFor(12000);
  await tap("goto", "guests0");
  let c = (await state()).customers.find((c) => c.status === "waiting");
  await tap("customer", c.id);
  await tap("accept", c.id);
  await tap("goto", "kitchen");
  if (
    !(await state()).burners[0] ||
    (await state()).burners[0].stage !== "boiling"
  ) {
    await tap("pot", "0");
    await tap("burner", "0");
    await page.clock.runFor(100);
    await tap("burner", "0");
    await page.clock.runFor(5500);
    await tap("dismiss");
  }
  if (!(await state()).brothBatch.servings) {
    await tap("panel", "broth");
    for (const id of ["dashi", "dashi", "soy", "mirin"]) {
      await tap("batch-add", id);
      await page.clock.runFor(100);
    }
    await tap("batch-cook");
    await page.clock.runFor(7500);
    await tap("dismiss");
  }
  await touchDrag('[data-drag="noodles"]', '[data-drop="pot:0"]');
  await page.clock.runFor(10000);
  await tap("pot", "0");
  await tap("lift-noodles", "0");
  await page.clock.runFor(100);
  await tap("pour");
  await page.clock.runFor(100);
  for (const id of ["beef", "onion"]) {
    await tap("select-topping", id);
    await tap("add-topping", "0");
    await page.clock.runFor(100);
  }
  await tap("tray", "0");
  await tap("goto", "drinks");
  await tap("panel", "brew");
  await tap("drink-start", "ramune");
  await page.clock.runFor(100);
  await tap("drink-step", "bottle");
  await page.clock.runFor(100);
  await tap("dismiss");
  let dish = (await state()).tray[0];
  await tap("dish", dish.id);
  await tap("attach-drink", dish.id);
  await page.clock.runFor(100);
  expect((await state()).tray[0].drink).toBe("ramune");
  const slotBounds = await page.locator(".tray-slot.filled").boundingBox();
  const drinkBounds = await page
    .locator(".tray-slot.filled .tiny-drink img")
    .boundingBox();
  expect(drinkBounds.y + drinkBounds.height).toBeLessThanOrEqual(
    slotBounds.y + slotBounds.height,
  );
  await page.screenshot({ path: "test-results/04-drinks.png" });
  await tap("goto", "guests0");
  await touchDrag(
    `[data-drag="dish:${dish.id}"]`,
    `[data-drop="customer:${c.id}"]`,
  );
  await page.clock.runFor(500);
  await page.clock.runFor(9000);
  await expect(page.locator(`.table-bowl[data-arg="${c.id}"]`)).toHaveAttribute(
    "aria-label",
    "Thu tiền",
  );
  await page.locator(`.table-bowl[data-arg="${c.id}"]`).tap();
  expect((await state()).ledger.served).toBe(2);
  expect(
    (await state()).customers.find((x) => x.id === c.id).result.correct,
  ).toBe(true);
  // Time is suspended in settings and when returning after reload.
  await tap("panel", "settings");
  const elapsed = (await state()).elapsed;
  await page.clock.runFor(30000);
  expect((await state()).elapsed).toBe(elapsed);
  await page.reload();
  await page.addStyleTag({
    content: ".debug-tools { display: none !important; }",
  });
  await tap("start");
  expect((await state()).ledger.served).toBe(2);
  await page.clock.runFor(370000);
  expect((await state()).closing).toBe(false);
  await tap("panel", "manage");
  await tap("toggle-shop");
  expect((await state()).closing).toBe(true);
  await tap("panel", "manage");
  await tap("panel", "close-day");
  await expect(act("finish-day")).toBeDisabled();
  await tap("dismiss");
  await page.clock.runFor(250000);
  for (const c of (await state()).customers.filter(
    (c) => c.status === "dirty",
  )) {
    await page.locator(`.table-bowl[data-arg="${c.id}"]`).tap();
    await page.clock.runFor(100);
  }
  await tap("goto", "kitchen");
  while ((await state()).sink) {
    await tap("wash");
    await page.clock.runFor(100);
  }
  await page.clock.runFor(1000);
  await tap("panel", "manage");
  await tap("panel", "close-day");
  await tap("finish-day");
  await expect(
    page.getByRole("heading", { name: "Một ngày thật ấm" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/05-summary.png" });
  await tap("next-day");
  await page.clock.runFor(100);
  expect((await state()).day).toBe(2);
  await tap("dismiss");
  for (const id of [
    "front",
    "guests0",
    "drinks",
    "kitchen",
    "storage",
    "garden",
  ]) {
    await tap("goto", id);
    await expect(page.locator("#stage")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await tap("panel", "manage");
  for (const name of [
    "recipes",
    "inventory",
    "upgrades",
    "decor",
    "employees",
    "album",
    "menu",
    "reviews",
  ]) {
    await tap("panel", name);
    await expect(page.locator('.sheet-title[role="heading"]')).toBeVisible();
    await tap("dismiss");
    await tap("panel", "manage");
  }
  await tap("dismiss");
  await tap("goto", "front");
  await page.screenshot({ path: "test-results/06-front.png" });
  expect(errors).toEqual([]);
  console.log(
    "PASS: mobile touch loop, swipe, noodle/bowl/serving drag, chopping, washing, tempura, drink matching, autosave, pause, daily summary, six scenes and panels.",
  );
} catch (error) {
  console.error(error);
  await page.screenshot({ path: "test-results/failure.png" }).catch(() => {});
  console.error(await page.locator("body").innerText());
  throw error;
} finally {
  await browser.close();
}
