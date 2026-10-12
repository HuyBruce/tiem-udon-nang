import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { makeCustomer } from "../src/systems/customers.js";
import { addStock } from "../src/systems/inventory.js";
import { DRINKS, RECIPES } from "../src/data.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { brothFormula } from "../src/systems/discovery.js";
import { drinkOrderLabel } from "../src/systems/drink-temperature.js";
import { judge } from "../src/systems/economy.js";
import { validState } from "../src/systems/validation.js";

function coldCustomer() {
  for (let serial = 0; serial < 80; serial++) {
    const state = newState();
    state.day = 6;
    state.serial = serial;
    const customer = makeCustomer(state, 0);
    if (
      customer.drinkTemperature === "cold" &&
      DRINKS[customer.drink]?.temperatureOptions &&
      !customer.combo &&
      !customer.freestyle &&
      !customer.side &&
      !customer.extra
    ) {
      return { state, customer };
    }
  }
  throw new Error("No cold drink order in day 6 sample");
}

function dishFor(state, customer) {
  const recipe = RECIPES[customer.recipe];
  return {
    id: "dish1",
    orderId: customer.id,
    stage: "ready",
    lifted: true,
    time: 10,
    duration: 9,
    broth: brothFormula(recipe),
    tops: recipe.tops.filter((id) => id !== customer.omit),
    method: recipe.kind || "hot",
    texture: "perfect",
    quality: 1,
    poured: true,
    noodleTier: customer.noodleTier,
    drink: null,
    drinkTemperature: null,
    side: false,
    sideKind: null,
  };
}

test("a cold order is explicit and a hot glass cannot satisfy it", () => {
  const { state, customer } = coldCustomer();
  const dish = dishFor(state, customer);
  dish.drink = customer.drink;
  dish.drinkTemperature = "hot";
  assert.match(customer.order, /lạnh/i);
  assert.match(drinkOrderLabel(customer), /lạnh$/);
  assert.equal(judge(state, customer, dish).correct, false);
  dish.drinkTemperature = "cold";
  assert.equal(judge(state, customer, dish).correct, true);
});

test("brew, chill, attach, reload and remove the glass preserve temperature", () => {
  const { state, customer } = coldCustomer();
  for (const step of DRINK_METHODS[customer.drink])
    for (const ingredient of step.items || [])
      addStock(state, ingredient, 4, false, true);
  assert.equal(validState(state), true);
  let engine = new Engine(state);
  const dish = dishFor(engine.s, customer);
  engine.s.tray.push(dish);
  assert.equal(validState(engine.s), true);
  assert.equal(engine.drinkStart(customer.drink), true);
  assert.equal(engine.drinkChill(), false);
  for (const step of DRINK_METHODS[customer.drink])
    assert.equal(engine.drinkStep(step.action), true);
  assert.equal(engine.drinkChill(), true);
  assert.equal(engine.drinkChill(), false);
  assert.equal(engine.attachDrink(dish.id), true);
  assert.equal(dish.drinkTemperature, "cold");
  assert.equal(judge(engine.s, customer, dish).correct, true);
  assert.equal(validState(engine.s), true);
  engine = new Engine(structuredClone(engine.s));
  assert.equal(engine.s.tray[0].drinkTemperature, "cold");
  assert.equal(engine.removeDrink(dish.id), true);
  assert.equal(engine.s.tray.length, 0);
  assert.equal(validState(engine.s), true);
});

test("fixed cold drinks and legacy orders keep their original behavior", () => {
  const state = newState();
  const engine = new Engine(state);
  assert.equal(engine.drinkStart("ramune"), true);
  assert.equal(engine.drinkStep(DRINK_METHODS.ramune[0].action), true);
  assert.equal(engine.drinkChill(), false);
  assert.equal(engine.s.drink.temperature, "cold");
  const { state: oldState, customer } = coldCustomer();
  const dish = dishFor(oldState, customer);
  dish.drink = customer.drink;
  dish.drinkTemperature = "hot";
  delete customer.drinkTemperature;
  delete dish.drinkTemperature;
  assert.equal(judge(oldState, customer, dish).correct, true);
});
