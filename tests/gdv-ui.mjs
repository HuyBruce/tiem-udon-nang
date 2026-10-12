import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { chromium, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { recipeBook, brothFormula } from "../src/systems/discovery.js";

const output = process.env.GDV_OUTPUT || "review/gdv/step1/final";
const audit = process.env.GDV_AUDIT !== "0";
const baseline = process.env.GDV_BEFORE || "review/gdv/step1/before";
const scenes = ["front", "guests0", "drinks", "kitchen", "storage", "garden"];
const strings = JSON.parse(await fs.readFile("data/strings.vi.json", "utf8"));
const captions = {
  front: strings.text.t_62eb577dd779,
  storage: strings.text.t_bce55790c947,
  garden: strings.text.t_60c39df779af,
};
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
function seed() {
  const e = new Engine();
  e.s.money = 200000;
  for (let i = 0; i < 3; i++) e.upgrade("seats");
  for (const id of ["thu", "binh", "mika", "yui"]) e.hire(id);
  e.upgrade("garden");
  e.upgrade("garden");
  ["onion", "flowers", "sakura"].forEach((id, i) => e.plant(i, id));
  e.s.plots[1].growth = 1;
  e.s.plots[2].growth = 3;
  e.adoptPet("cat");
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
async function settle(p) {
  await p.clock.runFor(1000);
  await p.evaluate(async () => {
    await document.fonts.ready;
    for (const el of document.querySelectorAll(".sheet,.modal-backdrop"))
      for (const a of el.getAnimations({ subtree: true }))
        if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish();
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
}
async function shot(p, viewport, scene) {
  await settle(p);
  const checks = await p.evaluate(() => {
    const labels = [
      ...document.querySelectorAll(
        ".rack-name,.rack-count,.rack-label,.work-source > span,.work-vessel-label,.pot-label,.work-object-label,.work-tools button,.scene-heading h1",
      ),
    ];
    return labels
      .filter((el) => {
        const r = el.getBoundingClientRect(),
          s = getComputedStyle(el);
        return (
          r.width > 1 &&
          r.height > 1 &&
          s.display !== "none" &&
          s.visibility !== "hidden"
        );
      })
      .map((el) => ({
        text: el.textContent.trim(),
        cls: el.className,
        width: el.clientWidth,
        scroll: el.scrollWidth,
        height: el.clientHeight,
        scrollHeight: el.scrollHeight,
        ellipsis: getComputedStyle(el).textOverflow === "ellipsis",
        font: parseFloat(getComputedStyle(el).fontSize),
      }));
  });
  if (audit)
    for (const check of checks) {
      expect(check.font, JSON.stringify(check)).toBeGreaterThanOrEqual(11);
      expect(check.ellipsis, JSON.stringify(check)).toBe(false);
      expect(check.scroll, JSON.stringify(check)).toBeLessThanOrEqual(
        check.width + 1,
      );
      expect(check.scrollHeight, JSON.stringify(check)).toBeLessThanOrEqual(
        check.height + 1,
      );
    }
  const geometry = await p.evaluate(() => {
    const game = document.querySelector(".game"),
      stage = document.querySelector("#stage");
    const g = game.getBoundingClientRect(),
      hud = game.querySelector(".hud").getBoundingClientRect();
    const footer = game.querySelector(".bottom-tools").getBoundingClientRect(),
      gear = game.querySelector(".hud button").getBoundingClientRect();
    const controls = [
      ...game.querySelectorAll(
        ".pot-hit,.sprite-touch,.noodle-basket,.rack-item,.food-trash,.work-vessel,.work-tools button,.work-controls select,.work-scroll,.bottom-tools button,.hud button",
      ),
    ];
    const hits = game.hasAttribute("inert")
      ? []
      : controls
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width > 0 &&
              r.height > 0 &&
              r.left >= g.left &&
              r.right <= g.right &&
              r.top >= g.top &&
              r.bottom <= g.bottom
            );
          })
          .map((el) => {
            const r = el.getBoundingClientRect(),
              hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              );
            return {
              label:
                el.getAttribute("aria-label") ||
                el.textContent.trim().slice(0, 30),
              accessible: el === hit || el.contains(hit),
              actual: hit?.outerHTML.slice(0, 220),
              rect: r.toJSON(),
            };
          });
    const labels = [
      ...game.querySelectorAll(
        ".rack-name,.rack-count,.work-vessel-label,.dish-name,.tray-label",
      ),
    ].filter((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.width > 1 && r.height > 1 && getComputedStyle(el).display !== "none"
      );
    });
    const overlaps = [];
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i].getBoundingClientRect(),
          b = labels[j].getBoundingClientRect();
        if (
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1
        )
          overlaps.push([
            labels[i].textContent.trim(),
            labels[j].textContent.trim(),
          ]);
      }
    return {
      chromeAreaRatio:
        (hud.width * hud.height +
          footer.width * footer.height +
          gear.width * Math.max(0, gear.height - hud.height)) /
        (g.width * g.height),
      stageHeight: stage.clientHeight,
      hits,
      overlaps,
    };
  });
  if (audit) {
    expect(geometry.chromeAreaRatio).toBeLessThanOrEqual(0.12);
    expect(geometry.overlaps).toEqual([]);
    for (const hit of geometry.hits)
      expect(hit.accessible, JSON.stringify(hit)).toBe(true);
  }
  const staff = await p.evaluate(() =>
    [...document.querySelectorAll(".scene-staff")].map((el) => {
      const r = el.getBoundingClientRect(),
        room = el.closest(".world-room").getBoundingClientRect();
      // Source sprites are square, contain, bottom aligned; heads occupy the upper third.
      const size = Math.min(r.width, r.height),
        x = r.x + r.width / 2,
        y = r.bottom - size * 0.77;
      const covered = [
        ...document.querySelectorAll(
          ".rack-name,.rack-count,.scene-arrow,.work-vessel-label",
        ),
      ]
        .filter((label) => {
          const b = label.getBoundingClientRect();
          return x > b.left && x < b.right && y > b.top && y < b.bottom;
        })
        .map((el) => el.textContent.trim());
      return {
        id: el.dataset.staff,
        left: r.left - room.left,
        right: room.right - r.right,
        size,
        covered,
      };
    }),
  );
  if (audit)
    for (const person of staff) {
      expect(person.left, JSON.stringify(person)).toBeGreaterThanOrEqual(0);
      expect(person.right, JSON.stringify(person)).toBeGreaterThanOrEqual(0);
      expect(person.size, JSON.stringify(person)).toBeGreaterThanOrEqual(
        viewport.width * 0.24,
      );
      expect(person.covered, JSON.stringify(person)).toEqual([]);
    }
  // Measure visible paint rather than just an img box with transparent margins.
  const picturePixels = await p.evaluate(() => {
    const images = [
      ...document.querySelectorAll(
        ".rack-art img,.customer > img,.work-source > img",
      ),
    ];
    return images
      .filter((img) => img.complete && img.naturalWidth)
      .map((img) => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let left = canvas.width,
          right = -1,
          top = canvas.height,
          bottom = -1;
        for (let y = 0; y < canvas.height; y++)
          for (let x = 0; x < canvas.width; x++)
            if (pixels[(y * canvas.width + x) * 4 + 3] > 20) {
              left = Math.min(left, x);
              right = Math.max(right, x);
              top = Math.min(top, y);
              bottom = Math.max(bottom, y);
            }
        const box = img.getBoundingClientRect();
        const scale = Math.min(
          box.width / canvas.width,
          box.height / canvas.height,
        );
        return {
          kind: img.closest(".rack-art")
            ? "shelf"
            : img.closest(".customer")
              ? "guest"
              : "supply",
          id: img.closest("[data-arg]")?.dataset.arg,
          width: (right - left + 1) * scale,
          height: (bottom - top + 1) * scale,
        };
      });
  });
  if (audit)
    for (const picture of picturePixels) {
      if (picture.kind === "guest")
        expect(picture.width, JSON.stringify(picture)).toBeGreaterThan(
          viewport.width * 0.44,
        );
      if (
        viewport.height > 650 &&
        picture.kind === "shelf" &&
        [
          "ingredient:tea",
          "ingredient:dashi",
          "ingredient:miso",
          "ingredient:shrimp",
        ].includes(picture.id)
      )
        expect(picture.width, JSON.stringify(picture)).toBeGreaterThan(
          viewport.width * 0.2,
        );
      if (
        viewport.height <= 650 &&
        picture.kind === "shelf" &&
        ["ingredient:tea", "ingredient:dashi"].includes(picture.id)
      )
        expect(picture.width, JSON.stringify(picture)).toBeGreaterThan(
          viewport.width * 0.18,
        );
      if (picture.kind === "supply" && picture.id === "ingredient:oil")
        expect(picture.height, JSON.stringify(picture)).toBeGreaterThan(
          viewport.height > 650 ? 36 : 26,
        );
    }
  if (audit && scene === "guests0") {
    const headHits = await p.evaluate(() =>
      [...document.querySelectorAll(".customer")].map((customer) => {
        const r = customer.getBoundingClientRect();
        // Square source portrait: 160% of the seat width, bottom aligned.
        const y = r.bottom - r.width * 1.6 * 0.88;
        const hit = document.elementFromPoint(r.x + r.width / 2, y);
        return {
          id: customer.dataset.arg,
          headAccessible: hit?.closest(".customer") === customer,
        };
      }),
    );
    for (const hit of headHits)
      expect(hit.headAccessible, JSON.stringify(hit)).toBe(true);
  }
  const filename = `${viewport.width}x${viewport.height}-${scene}.png`;
  const file = path.join(output, filename);
  await p.screenshot({ path: file });
  results.push({
    viewport,
    scene,
    checks,
    staff,
    geometry,
    picturePixels,
    elements: await p.locator("*").count(),
  });
  if (output !== baseline) {
    const before = await fs.readFile(path.join(baseline, filename));
    const current = await fs.readFile(file);
    const referenceFile = `review/parity/reference-${scene}.png`;
    let reference = null;
    try {
      reference = await sharp(referenceFile)
        .resize(viewport.width, viewport.height, {
          fit: "contain",
          background: "#f5ebdd",
        })
        .png()
        .toBuffer();
    } catch {}
    const count = reference ? 3 : 2,
      width = viewport.width * count + 12 * (count + 1);
    const title = Buffer.from(
      `<svg width="${width}" height="32"><rect width="100%" height="100%" fill="#f5ebdd"/><text x="12" y="22" font-family="Arial" font-size="14">${scene} ${viewport.width}x${viewport.height} | BEFORE / CURRENT${reference ? " / REFERENCE" : ""}</text></svg>`,
    );
    await sharp({
      create: {
        width,
        height: viewport.height + 44,
        channels: 4,
        background: "#f5ebdd",
      },
    })
      .composite([
        { input: title, top: 0, left: 0 },
        { input: before, top: 32, left: 12 },
        { input: current, top: 32, left: viewport.width + 24 },
        ...(reference
          ? [{ input: reference, top: 32, left: viewport.width * 2 + 36 }]
          : []),
      ])
      .png()
      .toFile(path.join(output, "pair-" + filename));
  }
}
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
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    const t = new Date("2026-10-10T00:00:00Z");
    await p.clock.install({ time: t });
    await p.clock.pauseAt(new Date(+t + 1000));
    await p.addInitScript(
      (state) =>
        localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state })),
      seed(),
    );
    await p.goto(
      (process.env.UDON_TEST_BASE_URL || "http://localhost:5173") + "/?debug=1",
    );
    await p.addStyleTag({ content: ".debug-tools{display:none!important}" });
    await p.locator("[data-act=start]").tap();
    if (await p.locator(".close-sheet").count())
      await p.locator(".close-sheet").tap();
    for (const scene of scenes) {
      await p.locator(`.scene-pagination [data-arg="${scene}"]`).tap();
      await settle(p);
      await expect(p.locator("#stage")).toHaveAttribute(
        "data-visible-rooms",
        scene,
      );
      if (captions[scene])
        await expect(p.locator(".scene-caption")).toHaveText(captions[scene]);
      else await expect(p.locator(".scene-caption")).toHaveCount(0);
      await shot(p, { width, height }, scene);
    }
    // Same overlay type, non-adjacent jump must still update its content.
    await p.locator('.scene-pagination [data-arg="front"]').tap();
    await settle(p);
    await expect(p.locator(".scene-caption")).toHaveText(captions.front);
    await p.locator(".scene-pagination [data-arg=guests0]").tap();
    await settle(p);
    await p.locator(".order-ticket").first().tap();
    await shot(p, { width, height }, "order");
    await p.locator(".close-sheet").tap();
    await settle(p);
    await p
      .locator("[data-act=panel][data-arg=recipes]")
      .filter({ visible: true })
      .first()
      .tap();
    await shot(p, { width, height }, "recipes");
    await expect(p.locator(".tray-slot")).toHaveCount(5);
    expect(errors).toEqual([]);
    await p.close();
  }
  await fs.writeFile(
    path.join(output, "checks.json"),
    JSON.stringify(results, null, 2),
  );
  console.log(
    `PASS: 24 screenshots, isolated valid save, labels audited=${audit}, three viewports, no page errors.`,
  );
} finally {
  await browser.close();
}
