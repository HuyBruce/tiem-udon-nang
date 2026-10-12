import test from "node:test";
import assert from "node:assert/strict";
import { RECIPES, INGREDIENTS, TOPPINGS } from "../src/data.js";
import { candidate, brothFormula } from "../src/systems/discovery.js";
import { Engine } from "../src/systems/engine.js";
import { migrateState } from "../src/systems/migration.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { addStock, count } from "../src/systems/inventory.js";

const newRecipes = [
  "tamago",
  "wakame",
  "beefEgg",
  "misoTofu",
  "curryTofu",
  "coldYuzu",
  "shiitake",
  "kinokoMiso",
  "kinokoCurry",
  "kinokoYaki",
  "daikon",
  "oroshiCold",
  "yuzuDaikon",
  "beefDaikon",
  "misoShiitakeEgg",
  "coldShiitake",
  "tempuraDaikon",
  "tofuShiitake",
  "yakiTofuShiitake",
  "misoEgg",
];

test("new catalog dishes have distinct cookable formulas and trial prices", () => {
  assert.equal(Object.keys(RECIPES).length, 35);
  const formulas = new Set();
  for (const [id, recipe] of Object.entries(RECIPES)) {
    const key = [
      recipe.kind || "hot",
      [...brothFormula(recipe)].sort().join("+"),
      [...recipe.tops].sort().join("+"),
    ].join("|");
    assert.ok(!formulas.has(key), `duplicate formula: ${id}`);
    formulas.add(key);
    assert.ok(
      recipe.tops.every((id) => TOPPINGS.includes(id)),
      `missing topping action: ${id}`,
    );
    assert.ok(
      recipe.tops.every((id) => id === "tempura" || INGREDIENTS[id]),
      `missing stock: ${id}`,
    );
    if (!newRecipes.includes(id)) continue;
    assert.ok(recipe.price >= 600 && recipe.price <= 1200);
    assert.ok(recipe.unlock > 0);
    const dish = {
      broth: brothFormula(recipe),
      tops: recipe.tops,
      method: recipe.kind || "hot",
      texture: "perfect",
      quality: 1,
    };
    assert.equal(candidate(newState(), { personId: "mai" }, dish).id, id);
  }
});

test("existing saves gain new prices without unlocking or changing the old menu", () => {
  const oldSave = newState();
  for (const id of newRecipes) delete oldSave.prices[id];
  const migrated = migrateState(oldSave);
  assert.deepEqual(migrated.menu, ["kake", "beef", "kitsune"]);
  for (const id of newRecipes) {
    assert.equal(migrated.prices[id], RECIPES[id].price);
    assert.ok(!migrated.unlocked.includes(id));
  }
  assert.equal(validState(migrated), true);

  const engine = new Engine(migrated);
  const before = engine.s.money;
  assert.equal(engine.unlock("wakame"), true);
  assert.equal(engine.s.money, before - RECIPES.wakame.unlock);
  assert.ok(engine.s.menu.includes("wakame"));
  assert.equal(validState(engine.s), true);
});

test("new toppings travel from stocked ingredient to cooked bowl and survive save validation", () => {
  for (const [recipeId, toppingId] of [
    ["shiitake", "shiitake"],
    ["daikon", "daikon"],
  ]) {
    const state = newState();
    state.menu = [recipeId];
    state.unlocked.push(recipeId);
    state.inventory.ramune = [];
    assert.equal(addStock(state, toppingId, 5, false, true), true);
    const before = count(state, toppingId);
    const engine = new Engine(state);
    engine.open();
    const customer = engine.s.customers[0];
    engine.accept(customer.id);
    engine.burnerStep(0);
    engine.burnerStep(0);
    for (let i = 0; i < 6; i++) engine.tick(1);
    for (const id of brothFormula(RECIPES[recipeId]))
      assert.equal(engine.brothAdd(id), true);
    assert.equal(engine.brothCook(), true);
    for (let i = 0; i < 7; i++) engine.tick(1);
    assert.equal(engine.noodles(0, customer.id), true);
    for (let i = 0; i < 9; i++) engine.tick(1);
    assert.equal(engine.liftNoodles(0), true);
    assert.equal(engine.pour(0), true);
    for (const id of RECIPES[recipeId].tops)
      assert.equal(engine.topping(0, id), true);
    assert.equal(count(engine.s, toppingId), before - 1);
    assert.equal(engine.tray(0), true);
    assert.ok(engine.s.tray[0].tops.includes(toppingId));
    assert.equal(validState(migrateState(engine.s)), true);
  }
});
