import assert from "node:assert/strict";
import { Engine } from "../../src/systems/engine.js";
import { newState } from "../../src/systems/state.js";
import { addStock } from "../../src/systems/inventory.js";
import { DRINK_METHODS } from "../../src/systems/drinks.js";
import { DRINK_TOPPINGS, RECIPES } from "../../src/data.js";
import { drinkOrderLabel } from "../../src/systems/drink-temperature.js";
import { brothFormula } from "../../src/systems/discovery.js";
import { validState } from "../../src/systems/validation.js";

export function toppingFixture(
  topping = "whippedCream",
  drink = "matcha",
  temperature = "hot",
) {
  const state = newState();
  state.day = 10;
  state.upgrades.storage = 2;
  for (const batches of Object.values(state.inventory))
    for (const batch of batches) batch.expires += 10;
  const e = new Engine(state);
  e.open();
  const c = e.s.customers[0];
  Object.assign(c, {
    recipe: "kake",
    combo: null,
    freestyle: false,
    omit: null,
    extra: null,
    side: false,
    sideKind: null,
    noodleTier: "regular",
    drink,
    drinkTemperature: temperature,
    drinkTopping: topping,
    patience: 600,
    maxPatience: 600,
    hints: 0,
    order: `Cho mình Kake Udon kèm ${drinkOrderLabel({ drink, drinkTemperature: temperature, drinkTopping: topping })} nhé.`,
  });
  e.accept(c.id);
  e.s.tray.push({
    id: "dish1",
    orderId: c.id,
    stage: "ready",
    lifted: true,
    time: 9,
    duration: 9,
    broth: brothFormula(RECIPES.kake),
    tops: [...RECIPES.kake.tops],
    method: "hot",
    texture: "perfect",
    quality: 1,
    poured: true,
    noodleTier: "regular",
    drink: null,
    side: false,
    sideKind: null,
  });
  for (const step of DRINK_METHODS[drink])
    for (const ingredient of step.items || [])
      assert.equal(addStock(e.s, ingredient, 6, false, true), true);
  if (topping)
    assert.equal(
      addStock(e.s, DRINK_TOPPINGS[topping].ingredient, 6, false, true),
      true,
    );
  assert.equal(e.drinkStart(drink), true);
  assert.equal(validState(e.s), true);
  return e;
}
export function finishDrink(e) {
  for (const step of DRINK_METHODS[e.s.drink.id])
    assert.equal(e.drinkStep(step.action), true);
}
