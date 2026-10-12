import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { SaveService, SAVE_KEY } from "../src/systems/save.js";
import { validState } from "../src/systems/validation.js";
import { count } from "../src/systems/inventory.js";
import { INGREDIENTS, RECIPES } from "../src/data.js";
import { estimatedCost, brothFormula } from "../src/systems/discovery.js";
import ingredients from "../data/ingredients.json" with { type: "json" };
import manifest from "../assets/manifest.json" with { type: "json" };
import balance from "../config/balance.json" with { type: "json" };

test("every live layout rack uses a catalog ingredient and a registered image", () => {
  for (const filename of fs.readdirSync(
    new URL("../layouts/", import.meta.url),
  )) {
    if (!filename.endsWith(".json") || filename.includes("backup")) continue;
    const layout = JSON.parse(
      fs.readFileSync(new URL(`../layouts/${filename}`, import.meta.url)),
    );
    for (const row of layout.rack?.rows ?? []) {
      for (const id of row.items) {
        assert.ok(
          Object.hasOwn(ingredients, id),
          `${filename}: unknown ingredient ${id}`,
        );
        const art = manifest.assets[`ingredient-${id}`];
        assert.ok(art, `${filename}: missing manifest ingredient-${id}`);
        assert.ok(
          fs.existsSync(new URL(`../assets/${art.file}`, import.meta.url)),
        );
      }
    }
    if (filename === "front.json") {
      const ids = layout.layers.map((layer) => layer.id);
      assert.equal(
        new Set(ids).size,
        ids.length,
        `${filename}: duplicate layer id`,
      );
      assert.ok(ids.includes("flowers-left") && ids.includes("flowers-right"));
    }
  }
});

test("recipe estimates match current inputs and actual 5/7/9 portion broth yields", () => {
  const e = new Engine();
  e.s.money = 100000;
  for (const portions of [5, 7, 9]) {
    for (const r of Object.values(RECIPES)) {
      const brothCost = brothFormula(r).reduce(
        (sum, id) => sum + INGREDIENTS[id].cost,
        0,
      );
      const toppingCost = r.tops.reduce(
        (sum, id) =>
          sum +
          (id === "tempura"
            ? INGREDIENTS.shrimp.cost +
              INGREDIENTS.flour.cost +
              INGREDIENTS.oil.cost
            : INGREDIENTS[id].cost),
        0,
      );
      assert.equal(
        estimatedCost(r, e.s),
        Math.ceil(
          INGREDIENTS.noodles.cost + brothCost / portions + toppingCost,
        ),
      );
    }
    for (const id of brothFormula(RECIPES.kake))
      assert.equal(e.brothAdd(id), true);
    assert.equal(e.brothCook(), true);
    e.open();
    for (let second = 0; second < balance.cooking.brothSeconds + 1; second++)
      e.tick(1);
    assert.equal(e.s.brothBatch.servings, portions);
    e.brothReset();
    if (portions < 9) assert.equal(e.upgrade("broth"), true);
  }
  assert.equal(
    estimatedCost(RECIPES.tempura),
    estimatedCost(RECIPES.tempura, newState()),
  );
});

test("rejected broth spice explains cooking, ready batch and per-spice capacity without consuming stock", () => {
  const events = [];
  const e = new Engine(undefined, (event) => events.push(event));
  for (let i = 0; i < balance.cooking.brothMaxPortionsPerIngredient; i++)
    e.brothAdd("dashi");
  let before = count(e.s, "dashi");
  assert.equal(e.brothAdd("dashi"), false);
  assert.match(events.at(-1).text, /tối đa/);
  assert.equal(count(e.s, "dashi"), before);
  e.brothAdd("soy");
  e.brothAdd("mirin");
  e.brothCook();
  before = count(e.s, "soy");
  assert.equal(e.brothAdd("soy"), false);
  assert.match(events.at(-1).text, /đang nấu/);
  assert.equal(count(e.s, "soy"), before);
  e.open();
  for (let second = 0; second < balance.cooking.brothSeconds + 1; second++)
    e.tick(1);
  assert.equal(e.brothAdd("soy"), false);
  assert.match(events.at(-1).text, /vẫn còn tô/);
  assert.equal(count(e.s, "soy"), before);
  assert.equal(validState(e.s), true);
});

test("an older v3 save lacking optional fields loads with money, inventory and menu intact", () => {
  const old = newState();
  old.money = 2345;
  const inventory = structuredClone(old.inventory);
  for (const key of [
    "pet",
    "curryBatch",
    "brothSource",
    "progression",
    "sidePrep",
  ])
    delete old[key];
  const map = new Map([[SAVE_KEY, JSON.stringify({ state: old })]]);
  const save = new SaveService({
    getItem: (key) => map.get(key),
    setItem: (key, value) => map.set(key, value),
  });
  const restored = save.load();
  assert.ok(restored);
  assert.equal(restored.version, 3);
  assert.equal(restored.money, old.money);
  assert.deepEqual(restored.inventory, inventory);
  assert.deepEqual(restored.menu, old.menu);
  assert.equal(validState(restored), true);
  assert.equal(save.save(restored), true);
});
