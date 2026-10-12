import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { addStock, count } from "../src/systems/inventory.js";
import { handmadeLevel, handmadeQuality } from "../src/systems/handmade.js";
import { learnedRecipes, staffTick } from "../src/systems/employees.js";
import { SIDES, RECIPES, INGREDIENTS } from "../src/data.js";
import { sameParts, brothFormula } from "../src/systems/discovery.js";
import balance from "../config/balance.json" with { type: "json" };
import { judge, quotedPartTotal } from "../src/systems/economy.js";
import { recordMeal } from "../src/systems/progression.js";
import { makeCustomer } from "../src/systems/customers.js";
function fixture() {
  const e = new Engine();
  e.s.day = 14;
  e.s.money = 100000;
  e.s.upgrades.storage = 3;
  for (const id of Object.keys(INGREDIENTS)) addStock(e.s, id, 80, false, true);
  return e;
}
test("dedicated curry pot preserves both simultaneous batches and selected source through reload", () => {
  const e = fixture();
  assert.equal(e.selectBroth("curry"), false);
  e.upgrade("stove");
  for (const id of brothFormula(RECIPES.kake)) e.brothAdd(id);
  e.brothCook();
  assert.equal(e.selectBroth("curry"), true);
  for (const id of brothFormula(RECIPES.curry)) e.brothAdd(id);
  e.brothCook();
  e.open();
  for (let i = 0; i < 7; i++) e.tick(1);
  assert.equal(e.s.brothBatch.servings, 5);
  assert.equal(e.s.curryBatch.servings, 5);
  const restored = new Engine(JSON.parse(JSON.stringify(e.s)));
  assert.equal(restored.s.brothSource, "curry");
  restored.s.pots[0] = { lifted: true, poured: false, quality: 0 };
  assert.equal(restored.pour(0), true);
  assert.deepEqual(restored.s.pots[0].broth, brothFormula(RECIPES.curry));
  assert.equal(restored.s.curryBatch.servings, 4);
  assert.equal(restored.s.brothBatch.servings, 5);
  restored.s.pots[0] = null;
  assert.equal(validState(restored.s), true);
});
test("broth quantity limit is per ingredient and variable formulas survive custom discovery/save", () => {
  const e = fixture(),
    before = count(e.s, "dashi");
  for (let i = 0; i < 3; i++) assert.equal(e.brothAdd("dashi"), true);
  assert.equal(e.brothAdd("dashi"), false);
  assert.equal(e.brothCook(), false);
  e.brothAdd("soy");
  e.brothAdd("mirin");
  assert.equal(e.brothCook(), true);
  assert.equal(e.brothAdd("soy"), false);
  assert.equal(count(e.s, "dashi"), before - 3);
  assert.equal(validState(e.s), true);
  e.s.discoveryDraft = {
    broth: [...e.s.brothBatch.ingredients],
    tops: ["onion"],
    method: "hot",
    customer: "Mai",
    day: e.s.day,
  };
  assert.equal(e.nameRecipe("Nắng trong tô"), true);
  assert.equal(validState(e.s), true);
  const restored = new Engine(e.s);
  assert.equal(restored.s.customRecipes.custom1.formula.length, 5);
  restored.s.brothBatch.ingredients.push("dashi");
  assert.equal(validState(restored.s), false);
});
test("craft experience persists independently of the next batch and increases actual noodle quality", () => {
  const e = fixture(),
    quality = handmadeQuality(e.s);
  for (let batch = 0; batch < 8; batch++)
    for (let i = 0; i < 5; i++) e.handmadeStep(1);
  assert.equal(handmadeLevel(e.s), 3);
  assert.equal(e.s.handmade.portions, 40);
  assert.ok(handmadeQuality(e.s) > quality);
  const xp = e.s.handmade.xp;
  e.handmadeStep();
  assert.equal(e.s.handmade.xp, xp);
  assert.equal(e.s.handmade.skill, 0);
  const restored = new Engine(e.s);
  assert.equal(handmadeLevel(restored.s), 3);
  assert.equal(validState(restored.s), true);
});
test("all additional cooked sides consume a complete batch, resume mid-cook, gate raw food, and burn", () => {
  for (const id of ["karaage", "gyoza", "tamagoyaki"]) {
    let e = fixture();
    e.open();
    e.s.customers = [];
    e.s.nextArrival = 1e9;
    const before = count(e.s, SIDES[id].preparation[0]);
    assert.equal(e.prepareSide(id), true);
    assert.equal(e.prepareSide(id), false);
    assert.equal(count(e.s, SIDES[id].preparation[0]), before - 1);
    for (let step = 0; step < 3; step++) e.sidePrepStep();
    assert.equal(e.sidePrepStep(), false);
    assert.equal(e.s.prepared[id], 0);
    e.tick(2);
    assert.equal(validState(e.s), true);
    e = new Engine(e.s);
    for (let i = 2; i < balance.sidePreparation.cookSeconds[id]; i++) e.tick(1);
    assert.equal(e.sidePrepStep(), true);
    assert.equal(e.s.prepared[id], 3);
    e.prepareSide(id);
    for (let step = 0; step < 3; step++) e.sidePrepStep();
    for (let i = 0; i < 25; i++) e.tick(1);
    e.sidePrepStep();
    assert.equal(e.s.prepared[id], 3);
    e.s.tray.push({ id: "side-dish" });
    assert.equal(e.side("side-dish", id), true);
    assert.equal(e.s.prepared[id], 2);
    assert.equal(e.s.tray[0].sideKind, id);
  }
});
test("kimchi serves from real inventory and missing cooked sides never consume stock", () => {
  const e = fixture();
  e.s.tray.push({ id: "side-dish" });
  assert.equal(e.side("side-dish", "karaage"), false);
  const before = count(e.s, "kimchi");
  assert.equal(e.side("side-dish", "kimchi"), true);
  assert.equal(count(e.s, "kimchi"), before - 1);
  assert.equal(e.side("side-dish", "kimchi"), false);
  assert.equal(Object.keys(SIDES).length, 8);
});
test("Yui learns only unlocked recipes, charges once and retains partial learning across reload", () => {
  let e = fixture();
  e.hire("yui");
  assert.equal(e.teachRecipe("cold"), false);
  e.hire("yui");
  assert.equal(e.teachRecipe("cold"), false);
  e.unlock("cold");
  const before = e.s.money;
  assert.equal(e.teachRecipe("cold"), true);
  const paid = e.s.money;
  assert.ok(paid < before);
  assert.equal(e.teachRecipe("cold"), false);
  assert.equal(e.s.money, paid);
  staffTick(e, 10);
  assert.equal(validState(e.s), true);
  e = new Engine(e.s);
  staffTick(e, 35);
  assert.ok(learnedRecipes(e.s, e.s.employees.yui).includes("cold"));
  assert.equal(e.s.employees.yui.learning, null);
  assert.equal(validState(e.s), true);
});
test("level three trained Yui finishes cold and stirfry bowls, leaves drinks and serving for the owner", () => {
  for (const id of ["cold", "yaki"]) {
    const e = fixture();
    e.unlock(id);
    e.s.menu = [id];
    e.hire("yui");
    e.hire("yui");
    e.hire("yui");
    e.teachRecipe(id);
    staffTick(e, 45);
    e.open();
    e.s.nextArrival = 1e9;
    const c = e.s.customers[0];
    c.accepted = true;
    c.noodleTier = "regular";
    c.freestyle = false;
    for (let i = 0; i < 150 && !e.s.tray.length; i++) e.tick(1);
    assert.equal(e.s.tray.length, 1, id);
    const dish = e.s.tray[0];
    assert.equal(dish.method, RECIPES[id].kind);
    assert.ok(sameParts(dish.broth, brothFormula(RECIPES[id])));
    assert.equal(dish.drink, null);
    assert.equal(c.status, "waiting");
    assert.equal(validState(e.s), true);
  }
});
test("premium noodles consume only premium lots and their quoted surcharge requires the correct tier", () => {
  const e = fixture();
  e.open();
  const c = e.s.customers[0];
  e.accept(c.id);
  c.noodleTier = "premium";
  c.side = false;
  c.drink = null;
  c.drinkTemperature = null;
  c.extra = null;
  e.s.burners[0].stage = "boiling";
  e.s.noodleTier = "premium";
  const ordinary = count(e.s, "noodles", false);
  assert.equal(e.noodles(0), false);
  assert.equal(count(e.s, "noodles", false), ordinary);
  addStock(e.s, "noodles", 5, true, true);
  assert.equal(e.noodles(0), true);
  assert.equal(e.s.pots[0].noodleTier, "premium");
  assert.equal(count(e.s, "noodles", true), 4);
  assert.equal(count(e.s, "noodles", false), ordinary);
  const r = RECIPES[c.recipe],
    dish = {
      ...e.s.pots[0],
      broth: brothFormula(r),
      tops: r.tops,
      method: "hot",
      texture: "perfect",
      drink: null,
      poured: true,
    };
  assert.equal(judge(e.s, c, dish).correct, true);
  assert.equal(judge(e.s, c, dish).payment, quotedPartTotal(e.s, c));
  assert.equal(
    judge(e.s, c, { ...dish, noodleTier: "regular" }).correct,
    false,
  );
  assert.equal(validState(e.s), true);
});
test("neighbourhood goal unlocks once, persists, and leaves later days playable", () => {
  const e = fixture();
  e.s.day = 40;
  e.s.reputation = 90;
  e.s.unlocked = Object.keys(RECIPES).slice(0, 12);
  e.s.progression = { served: 179, excellent: 119, numberOneDay: null };
  assert.ok(recordMeal(e.s, { correct: true, score: 95 }));
  assert.equal(recordMeal(e.s, { correct: true, score: 95 }), null);
  const restored = new Engine(e.s);
  assert.equal(restored.s.progression.numberOneDay, 40);
  restored.s.phase = "summary";
  assert.equal(restored.nextDay(), true);
  assert.equal(restored.open(), true);
  assert.equal(restored.s.day, 41);
  assert.equal(validState(restored.s), true);
});
test("larger broth pot increases real portions and every catalog recipe appears in a full menu", () => {
  const e = fixture();
  e.upgrade("broth");
  e.upgrade("broth");
  for (const id of ["dashi", "dashi", "soy", "mirin"]) e.brothAdd(id);
  e.brothCook();
  e.open();
  for (let i = 0; i < 7; i++) e.tick(1);
  assert.equal(e.s.brothBatch.servings, 9);
  assert.equal(validState(e.s), true);
  e.s.unlocked = Object.keys(RECIPES);
  e.s.menu = Object.keys(RECIPES);
  e.s.day = 40;
  e.s.serial = 0;
  const seen = new Set();
  for (let i = 0; i < e.s.menu.length; i++)
    seen.add(makeCustomer(e.s, 0).recipe);
  assert.deepEqual([...seen].sort(), [...e.s.menu].sort());
});
test("seasonal blossoms grow by actual days, give bouquets and reject the wrong planting season", () => {
  const e = fixture();
  e.s.day = 1;
  e.s.upgrades.garden = 2;
  e.s.plots = [null, null, null];
  e.s.forecast.season = "Xuân";
  assert.equal(e.plant(0, "sunflower"), false);
  assert.equal(e.plant(0, "sakura"), true);
  for (let i = 0; i < 3; i++) {
    e.garden(0);
    e.s.phase = "summary";
    e.nextDay();
  }
  assert.equal(e.s.plots[0].growth, 3);
  assert.equal(e.garden(0), true);
  assert.equal(e.s.bouquets, 1);
  assert.equal(validState(e.s), true);
});
