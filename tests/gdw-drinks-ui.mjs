import fs from "node:fs/promises";
import sharp from "sharp";
import { webkit, expect } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { DRINKS, INGREDIENTS } from "../src/data.js";
import { addStock } from "../src/systems/inventory.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { availableDrinkToppings } from "../src/systems/drink-toppings.js";
import { tapAction, chooseWorkOption } from "./ui-actions.mjs";
const output = process.env.GDW_DRINK_OUTPUT || "review/gdw/step1/c";
await fs.mkdir(output, { recursive: true });
function fixture(id) {
  const e = new Engine();
  e.s.day = 20;
  e.s.money = 200000;
  e.s.upgrades.storage = 3;
  e.s.inventory = {};
  for (const ing of Object.keys(INGREDIENTS))
    expect(addStock(e.s, ing, 40)).toBe(true);
  e.open();
  e.close();
  e.s.customers = [];
  e.drinkStart(id);
  return e;
}
const b = await webkit.launch();
const reports = [];
try {
  const p = await b.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await p.addInitScript(
    (s) =>
      localStorage.setItem("debug-udon-nang-v1", JSON.stringify({ state: s })),
    fixture("tea").s,
  );
  await p.goto("http://localhost:5173/?debug=1");
  await p.addStyleTag({
    content: ".debug-tools,.clock-diagnostics{display:none!important}",
  });
  await tapAction(p, "start");
  await tapAction(p, "goto", "drinks");
  for (const [id, r] of Object.entries(DRINKS)) {
    const e = fixture(id),
      cases = [structuredClone(e.s)];
    for (const step of DRINK_METHODS[id]) {
      expect(e.drinkStep(step.action)).toBe(true);
      cases.push(structuredClone(e.s));
    }
    for (const temperature of r.temperatureOptions || [
      r.temperature || "hot",
    ]) {
      const v = fixture(id);
      for (const step of DRINK_METHODS[id]) v.drinkStep(step.action);
      if (temperature === "cold" && v.s.drink.temperature !== "cold")
        expect(v.drinkChill()).toBe(true);
      cases.push(structuredClone(v.s));
      for (const topping of availableDrinkToppings(id, temperature, v.s.day)) {
        const t = fixture(id);
        for (const step of DRINK_METHODS[id]) t.drinkStep(step.action);
        if (temperature === "cold" && t.s.drink.temperature !== "cold")
          t.drinkChill();
        expect(t.drinkTopping(topping)).toBe(true);
        cases.push(structuredClone(t.s));
      }
    }
    const tiles = [];
    for (const [i, state] of cases.entries()) {
      await p.evaluate(async (s) => {
        const m = await import("/src/ui/workstation-view.js");
        document.querySelector(".direct-workbench").outerHTML =
          m.workstationBench(
            s,
            { scene: "drinks", pot: 0, workPracticed: true },
            null,
          );
      }, state);
      await p.evaluate(async () =>
        Promise.all(
          [...document.images].map((i) => i.decode().catch(() => {})),
        ),
      );
      expect(await p.locator(".drink-workbench select").count()).toBe(0);
      expect(await p.locator(".work-drink-visual > .drink-base").count()).toBe(
        1,
      );
      const rects = await p.evaluate(() => {
        const r = (e) => e.getBoundingClientRect().toJSON();
        return {
          vessel: r(document.querySelector(".work-vessel")),
          label: r(document.querySelector(".work-vessel-label")),
          art: r(document.querySelector(".work-drink-visual")),
          controls: [
            ...document.querySelectorAll(
              ".drink-workbench .work-controls button",
            ),
          ]
            .filter((e) => !e.closest(".work-picker-popup"))
            .map(r),
          appliances: [
            ...document.querySelectorAll(".world-room.drinks .scene-sprite"),
          ].map(r),
        };
      });
      for (const c of rects.controls) {
        expect(c.y).toBeGreaterThanOrEqual(rects.vessel.bottom + 2);
        expect(c.width).toBeGreaterThanOrEqual(44);
        expect(c.height).toBeGreaterThanOrEqual(44);
      }
      for (const a of rects.appliances) {
        const intersects =
          rects.art.x < a.right &&
          rects.art.right > a.x &&
          rects.art.y < a.bottom &&
          rects.art.bottom > a.y;
        expect(intersects, `${id}/${i} appliance overlaps`).toBe(false);
      }
      const file = `${output}/${id}-${i}.png`;
      await p.screenshot({ path: file });
      tiles.push({
        input: await sharp(file).resize(195, 422).png().toBuffer(),
        left: (i % 4) * 195,
        top: Math.floor(i / 4) * 422,
      });
      reports.push({
        id,
        step: state.drink.step,
        temperature: state.drink.temperature,
        topping: state.drink.topping,
        rects,
        file,
      });
    }
    await sharp({
      create: {
        width: 780,
        height: Math.ceil(cases.length / 4) * 422,
        channels: 3,
        background: "#f4e8d1",
      },
    })
      .composite(tiles)
      .png()
      .toFile(`${output}/grid-${id}.png`);
  }
  // Functional picker behavior is also exercised through real engine/UI in GĐ2.
  await p.reload();
  await tapAction(p, "start");
  await tapAction(p, "goto", "drinks");
  await chooseWorkOption(p, "data-work-detail", "brew");
  await expect(p.locator(".sheet")).toHaveCount(1);
} finally {
  await b.close();
}
await fs.writeFile(`${output}/grid.json`, JSON.stringify(reports, null, 2));
console.log(
  `GDW drinks: ${reports.length} real-engine snapshots, WebKit bbox + single vessel + native picker removal PASS`,
);
