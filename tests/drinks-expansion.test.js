import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { DRINKS } from "../src/data.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { addStock, count } from "../src/systems/inventory.js";
import { validState } from "../src/systems/validation.js";

const expanded = ["hojichaLatte", "sakuraTea", "melonSoda", "strawberryMilk"];

test("drink instructions and stocked ingredients match the ten catalog entries", () => {
  assert.equal(Object.keys(DRINKS).length, 10);
  for (const [id, recipe] of Object.entries(DRINKS)) {
    const steps = DRINK_METHODS[id];
    assert.equal(steps.length, recipe.steps, id);
    assert.deepEqual(
      steps.flatMap((step) => step.items || []).sort(),
      [...recipe.items].sort(),
      id,
    );
    assert.ok(["hot", "cold"].includes(recipe.temperature || "hot"), id);
  }
});

test("new drinks unlock gradually and consume stocked ingredients at their steps", () => {
  for (const id of expanded) {
    const recipe = DRINKS[id];
    const e = new Engine();
    e.s.day = recipe.availableFromDay - 1;
    assert.equal(e.drinkStart(id), false, `${id} unlocked early`);
    e.s.day++;
    e.s.inventory = {};
    for (const ingredient of recipe.items)
      assert.equal(addStock(e.s, ingredient, 2, false, true), true);
    const before = Object.fromEntries(
      recipe.items.map((ingredient) => [ingredient, count(e.s, ingredient)]),
    );
    assert.equal(e.drinkStart(id), true);
    assert.equal(DRINK_METHODS[id].length, recipe.steps);
    for (const step of DRINK_METHODS[id])
      assert.equal(e.drinkStep(step.action), true, `${id}: ${step.action}`);
    assert.equal(e.s.drink.step, recipe.steps);
    assert.equal(e.s.drink.strange, false);
    for (const ingredient of recipe.items)
      assert.equal(count(e.s, ingredient), before[ingredient] - 1);
    assert.equal(validState(e.s), true);
  }
});

test("new drinks never begin a step without the ingredient in storage", () => {
  const e = new Engine();
  e.s.day = DRINKS.sakuraTea.availableFromDay;
  e.s.inventory = {};
  assert.equal(e.drinkStart("sakuraTea"), true);
  assert.equal(e.drinkStep("tea"), false);
  assert.equal(e.s.drink.step, 0);
  assert.equal(e.s.drink.strange, false);
  assert.equal(addStock(e.s, "tea", 1, false, true), true);
  assert.equal(e.drinkStep("tea"), true);
  assert.equal(e.s.drink.step, 1);
});
