import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { addStock, count } from "../src/systems/inventory.js";
import { RECIPES, SIDES } from "../src/data.js";
import { brothFormula } from "../src/systems/discovery.js";
import { quotedOrderTotal, judge } from "../src/systems/economy.js";
import { validState } from "../src/systems/validation.js";

function sideOrder(serial) {
  const state = newState();
  state.day = 9;
  state.serial = serial;
  for (const batches of Object.values(state.inventory))
    for (const batch of batches) batch.expires += 10;
  state.inventory.ramune = [];
  assert.equal(addStock(state, "daikon", 5, false, true), true);
  const engine = new Engine(state);
  assert.equal(engine.prepareEgg(), true);
  assert.equal(engine.open(), true);
  const customer = engine.s.customers[0];
  assert.equal(customer.side, true);
  const recipe = RECIPES[customer.recipe];
  const dish = {
    id: "dish1",
    orderId: customer.id,
    stage: "ready",
    lifted: true,
    time: 10,
    duration: 9,
    broth: brothFormula(recipe),
    tops: [...recipe.tops],
    method: recipe.kind || "hot",
    texture: "perfect",
    quality: 1,
    poured: true,
    noodleTier: customer.noodleTier,
    drink: customer.drink,
    side: false,
    sideKind: null,
  };
  engine.s.tray.push(dish);
  engine.accept(customer.id);
  return { engine, customer, dish };
}

test("egg, seaweed and daikon sides use their own stock, price and exact order match", () => {
  for (const [serial, kind] of [
    [20, "egg"],
    [25, "seaweed"],
    [10, "daikon"],
  ]) {
    const { engine, customer, dish } = sideOrder(serial);
    assert.equal(customer.sideKind, kind);
    assert.ok(customer.order.includes(SIDES[kind].name.toLowerCase()));
    const before =
      kind === "egg" ? engine.s.prepared.egg : count(engine.s, kind);
    assert.equal(engine.side(dish.id, kind), true);
    assert.equal(
      kind === "egg" ? engine.s.prepared.egg : count(engine.s, kind),
      before - 1,
    );
    assert.equal(engine.side(dish.id, kind), false);
    assert.equal(engine.serve(dish.id, customer.id), true);
    assert.equal(customer.result.correct, true);
    assert.equal(customer.result.payment, quotedOrderTotal(engine.s, customer));
    assert.equal(validState(engine.s), true);
  }
});

test("wrong side loses correct-order credit; old boolean tempura remains readable", () => {
  const { engine, customer, dish } = sideOrder(25);
  engine.s.prepared.tempura = 1;
  assert.equal(engine.side(dish.id), true);
  assert.equal(engine.serve(dish.id, customer.id), true);
  assert.equal(customer.result.correct, false);

  const legacy = sideOrder(10);
  legacy.customer.sideKind = undefined;
  legacy.dish.side = true;
  legacy.dish.sideKind = undefined;
  assert.equal(
    judge(legacy.engine.s, legacy.customer, legacy.dish).correct,
    true,
  );
  assert.equal(
    quotedOrderTotal(legacy.engine.s, legacy.customer) -
      legacy.engine.s.prices[legacy.customer.recipe] >=
      250,
    true,
  );
  assert.equal(validState(legacy.engine.s), true);
});

test("a new side stays on its combo part after reload and is paid once", () => {
  const state = newState();
  state.day = 9;
  state.serial = 68;
  for (const batches of Object.values(state.inventory))
    for (const batch of batches) batch.expires += 10;
  state.inventory.ramune = [];
  assert.equal(addStock(state, "daikon", 5, false, true), true);
  let engine = new Engine(state);
  engine.open();
  let customer = engine.s.customers[0];
  assert.equal(customer.combo.parts[1].sideKind, "daikon");
  engine.accept(customer.id);
  for (let index = 0; index < 2; index++) {
    if (index) {
      engine = new Engine(structuredClone(engine.s));
      customer = engine.s.customers[0];
    }
    const part = customer.combo.parts[index];
    const recipe = RECIPES[part.recipe];
    const dish = {
      id: `dish${index + 1}`,
      orderId: customer.id,
      partIndex: index,
      stage: "ready",
      lifted: true,
      time: 10,
      duration: 9,
      broth: brothFormula(recipe),
      tops: [...recipe.tops, ...(part.extra ? [part.extra] : [])],
      method: recipe.kind || "hot",
      texture: "perfect",
      quality: 1,
      poured: true,
      noodleTier: part.noodleTier,
      drink: part.drink,
      side: false,
      sideKind: null,
    };
    engine.s.tray.push(dish);
    if (part.side) assert.equal(engine.side(dish.id, part.sideKind), true);
    assert.equal(engine.serve(dish.id, customer.id), true);
    assert.equal(validState(engine.s), true);
    if (!index) assert.equal(customer.status, "waiting");
  }
  assert.equal(customer.status, "eating");
  assert.equal(customer.result.correct, true);
  assert.equal(customer.result.payment, quotedOrderTotal(engine.s, customer));
  assert.equal(engine.s.ledger.served, 0);
  for (let i = 0; i < 8; i++) engine.tick(1);
  assert.equal(engine.checkout(customer.id), true);
  assert.equal(engine.checkout(customer.id), false);
  assert.equal(engine.s.ledger.served, 1);
});
