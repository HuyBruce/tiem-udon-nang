import fs from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import sharp from "sharp";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";

const output = process.env.CANVAS_OUTPUT || "review/gdv/canvas/prototype";
await fs.mkdir(output, { recursive: true });
const e = new Engine();
e.s.money = 200000;
for (let i = 0; i < 3; i++) e.upgrade("seats");
for (const id of ["thu", "mika", "binh", "yui"]) e.hire(id);
e.adoptPet("cat");
e.open();
for (let i = 1; i < 8; i++) e.spawn();
e.tick(2);
e.s.nextArrival = 1000;
expect(validState(e.s)).toBe(true);
const browser = await chromium.launch({
  channel: "chromium",
  args: ["--enable-gpu"],
});
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
      deviceScaleFactor: 3,
    });
    const errors = [];
    p.on("pageerror", (error) => errors.push(error.message));
    await p.clock.install({ time: new Date("2026-10-10T00:00:00Z") });
    await p.clock.pauseAt(new Date("2026-10-10T00:00:01Z"));
    await p.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      e.s,
    );
    await p.goto(
      `${process.env.BASE_URL || "http://localhost:5173"}/?debug=1&renderer=canvas`,
    );
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    if (width === 430)
      await p.addStyleTag({
        content: ":root{--safe-top:59px;--safe-bottom:34px}",
      });
    await p.locator('[data-act="start"]').tap();
    if (await p.locator(".close-sheet").count())
      await p.locator(".close-sheet").tap();
    for (const scene of [
      "guests0",
      "drinks",
      "front",
      "kitchen",
      "storage",
      "garden",
    ]) {
      await p.locator(`.scene-pagination [data-arg="${scene}"]`).tap();
      await p.clock.runFor(1000);
      await p.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        );
      });
      await p.waitForFunction(
        () =>
          document.querySelector(".world-canvas")?.udonRendererStats?.()
            .backend === "webgl",
      );
      await p.clock.runFor(50);
      await expect(p.locator("#stage")).toHaveAttribute(
        "data-visible-rooms",
        scene,
      );
      await expect(p.locator(".world-canvas")).toHaveAttribute(
        "data-renderer-ready",
        "true",
      );
      await expect(p.locator(".world-strip > .world-room")).toHaveCount(1);
      const pixels = await sharp(await p.locator(".world-canvas").screenshot())
        .raw()
        .toBuffer({ resolveWithObject: true });
      const at =
        (Math.floor(pixels.info.height / 2) * pixels.info.width +
          Math.floor(pixels.info.width / 2)) *
        pixels.info.channels;
      expect(
        pixels.data[at] + pixels.data[at + 1] + pixels.data[at + 2],
      ).toBeGreaterThan(150);
      const stats = await p.evaluate(() =>
        document.querySelector(".world-canvas").udonRendererStats(),
      );
      expect(stats.kind).toBe("canvas");
      expect(stats.tickerStarted).toBe(false);
      expect(stats.systemTickerListeners).toBe(0);
      expect(stats.sharedTickerListeners).toBe(0);
      expect(stats.buffer).toEqual([stats.width * 3, stats.height * 3]);
      expect(stats.rooms).toBeLessThanOrEqual(3);
      expect(stats.images).toBeGreaterThan(0);
      await p.screenshot({ path: `${output}/${width}x${height}-${scene}.png` });
      const nativeStyle = await p.addStyleTag({
        content:
          '.world-canvas{display:none!important}.game.live-v2 #stage.world-camera .world-room img[data-canvas-image="true"]{opacity:1!important}',
      });
      const native = await p.screenshot();
      await fs.writeFile(
        `${output}/native-${width}x${height}-${scene}.png`,
        native,
      );
      await nativeStyle.evaluate((el) => el.remove());
      const canvasShot = await fs.readFile(
        `${output}/${width}x${height}-${scene}.png`,
      );
      const a = await sharp(native).removeAlpha().raw().toBuffer();
      const b = await sharp(canvasShot).removeAlpha().raw().toBuffer();
      const meanDifference =
        a.reduce((n, value, i) => n + Math.abs(value - b[i]), 0) / a.length;
      expect(
        meanDifference,
        `${width}x${height} ${scene}: DOM/canvas image mismatch`,
      ).toBeLessThan(5);
      await sharp({
        create: {
          width: width * 2 + 12,
          height,
          channels: 3,
          background: "#f5ebdd",
        },
      })
        .composite([
          {
            input: await sharp(native).resize(width, height).png().toBuffer(),
            left: 0,
            top: 0,
          },
          {
            input: await sharp(canvasShot)
              .resize(width, height)
              .png()
              .toBuffer(),
            left: width + 12,
            top: 0,
          },
        ])
        .png()
        .toFile(`${output}/pair-${width}x${height}-${scene}.png`);
      checks.push({ width, height, scene, meanDifference, ...stats });
    }
    // Rendering pauses under the same settings overlay; HTML hitboxes and
    // cached objects keep their identity through resize and context loss.
    if (width === 390) {
      await p.locator('.scene-pagination [data-arg="front"]').tap();
      await p.clock.runFor(1000);
      await p.evaluate(() => {
        window.__canvasOwner = document.querySelector(
          '[data-motion-actor="owner"]',
        );
      });
      await p.locator('.hud [data-arg="settings"]').tap();
      const before = await p.evaluate(
        () =>
          document.querySelector(".world-canvas").udonRendererStats().paints,
      );
      await p.clock.runFor(1500);
      expect(
        await p.evaluate(
          () =>
            document.querySelector(".world-canvas").udonRendererStats().paints,
        ),
      ).toBe(before);
      await p.locator(".close-sheet").tap();
      await p.clock.runFor(100);
      expect(
        await p.evaluate(
          () =>
            window.__canvasOwner ===
            document.querySelector('[data-motion-actor="owner"]'),
        ),
      ).toBe(true);
      await p.setViewportSize({ width: 430, height: 932 });
      await p.clock.runFor(200);
      const resized = await p.evaluate(() =>
        document.querySelector(".world-canvas").udonRendererStats(),
      );
      expect(resized.buffer).toEqual([resized.width * 3, resized.height * 3]);
      await p.evaluate(() => {
        const gl = document.querySelector(".world-canvas").getContext("webgl2");
        window.__lostContext = gl.getExtension("WEBGL_lose_context");
        window.__lostContext.loseContext();
      });
      await p.waitForFunction(
        () =>
          document.querySelector(".world-canvas").udonRendererStats().failed,
      );
      await expect(p.locator("#stage")).toHaveAttribute("data-renderer", "dom");
      expect(await p.locator("[data-canvas-image]").count()).toBe(0);
      await p.evaluate(() => window.__lostContext.restoreContext());
      await p.clock.runFor(500);
      await p.locator('.scene-pagination [data-arg="drinks"]').tap();
      await p.clock.runFor(1000);
      await expect(p.locator("#stage")).toHaveAttribute(
        "data-visible-rooms",
        "drinks",
      );
      expect(
        await p.evaluate(
          () =>
            document.querySelector(".world-canvas").udonRendererStats().kind,
        ),
      ).toBe("dom");
    }
    expect(errors).toEqual([]);
    await p.close();
  }
  const unsupported = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  await unsupported.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type.startsWith("webgl") || type === "experimental-webgl"
        ? null
        : getContext.call(this, type, ...args);
    };
  });
  await unsupported.goto(
    `${process.env.BASE_URL || "http://localhost:5173"}/?debug=1&renderer=canvas`,
  );
  await unsupported.locator('[data-act="start"]').tap();
  if (await unsupported.locator(".close-sheet").count())
    await unsupported.locator(".close-sheet").tap();
  await unsupported.waitForFunction(
    () => document.querySelector(".world-canvas")?.udonRendererStats?.().failed,
  );
  await expect(unsupported.locator("#stage")).toHaveAttribute(
    "data-renderer",
    "dom",
  );
  expect(await unsupported.locator("[data-canvas-image]").count()).toBe(0);
  await unsupported.close();
  const decorated = new Engine(structuredClone(e.s));
  expect(decorated.decorate("wall")).toBe(true);
  expect(decorated.decorate("table")).toBe(true);
  const decorPage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    deviceScaleFactor: 3,
  });
  await decorPage.clock.install();
  await decorPage.clock.pauseAt(new Date(Date.now() + 1000));
  await decorPage.addInitScript(
    (state) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
    decorated.s,
  );
  await decorPage.goto(
    `${process.env.BASE_URL || "http://localhost:5173"}/?debug=1&renderer=canvas`,
  );
  await decorPage.locator('[data-act="start"]').tap();
  if (await decorPage.locator(".close-sheet").count())
    await decorPage.locator(".close-sheet").tap();
  await decorPage.locator('.scene-pagination [data-arg="guests0"]').tap();
  await decorPage.clock.runFor(1000);
  await decorPage.waitForFunction(
    () =>
      document.querySelector(".world-canvas")?.udonRendererStats?.().backend ===
      "webgl",
  );
  await decorPage.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
  await decorPage.clock.runFor(100);
  for (const slot of ["wall", "table"]) {
    const bands = decorPage.locator(`.scene-decor-${slot} img`);
    await expect(bands).toHaveCount(5); // Four room bands + the tall-screen wall.
    for (const band of await bands.all())
      await expect(band).toHaveAttribute("data-canvas-image", "true");
  }
  const coloredCanvas = await decorPage.screenshot({
    path: `${output}/390x844-decor.png`,
  });
  await decorPage.addStyleTag({
    content:
      '.world-canvas{display:none!important}.game.live-v2 #stage.world-camera .world-room img[data-canvas-image="true"]{opacity:1!important}',
  });
  const coloredDOM = await decorPage.screenshot();
  const ca = await sharp(coloredCanvas).removeAlpha().raw().toBuffer();
  const cb = await sharp(coloredDOM).removeAlpha().raw().toBuffer();
  const decorDifference =
    ca.reduce((n, v, i) => n + Math.abs(v - cb[i]), 0) / ca.length;
  expect(
    decorDifference,
    "colored wall/counter must preserve native clipping and actor order",
  ).toBeLessThan(5);
  checks.push({ scene: "decor", meanDifference: decorDifference });
  await decorPage.close();
  await fs.writeFile(`${output}/checks.json`, JSON.stringify(checks, null, 2));
  console.log(
    "PASS: canvas paints six scenes, keyed cache bounded, three viewports, no page errors.",
  );
} finally {
  await browser.close();
}
