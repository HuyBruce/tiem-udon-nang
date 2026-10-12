import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { brothFormula, recipeBook } from "../src/systems/discovery.js";
import { quotedOrderTotal } from "../src/systems/economy.js";
import { noodleSurcharge } from "../src/systems/handmade.js";
import { DRINKS } from "../src/data.js";
import { addStock } from "../src/systems/inventory.js";

function comboVisit(serial = 12) {
  const state = newState();
  state.day = 6;
  state.serial = serial;
  const engine = new Engine(state);
  engine.open();
  const customer = engine.s.customers[0];
  assert.ok(customer.combo);
  engine.accept(customer.id);
  return { engine, customer };
}

function readyDish(engine, customer, index, wrong = false) {
  const part = customer.combo.parts[index];
  const recipe = recipeBook(engine.s)[part.recipe];
  const dish = {
    id: `dish${index + 1}`,
    orderId: customer.id,
    partIndex: index,
    stage: "ready",
    lifted: true,
    time: 10,
    duration: 9,
    broth: brothFormula(recipe),
    tops: wrong
      ? []
      : [
          ...recipe.tops.filter((top) => top !== part.omit),
          ...(part.extra ? [part.extra] : []),
        ],
    method: recipe.kind || "hot",
    texture: "perfect",
    quality: 1,
    poured: true,
    noodleTier: part.noodleTier,
    drink: part.drink,
    side: part.side,
  };
  engine.s.tray.push(dish);
  return dish;
}

test("combo appears after day six with two individually quoted parts", () => {
  const before = newState();
  before.day = 5;
  before.serial = 12;
  const early = new Engine(before);
  early.open();
  assert.equal(early.s.customers[0].combo, undefined);

  const { engine, customer } = comboVisit();
  assert.equal(customer.combo.parts.length, 2);
  assert.match(customer.order, /tô 1.*tô 2/i);
  assert.ok(customer.maxPatience > 200);
  assert.equal(
    quotedOrderTotal(engine.s, customer),
    customer.combo.parts.reduce(
      (sum, part) =>
        sum +
        engine.s.prices[part.recipe] +
        noodleSurcharge(part) +
        (part.side ? 250 : 0) +
        (part.extra ? 100 : 0) +
        (DRINKS[part.drink]?.price || 0),
      0,
    ),
  );
});

test("partial combo survives reload; one wrong bowl only discounts that bowl and one bill settles once", () => {
  const { engine, customer } = comboVisit();
  const first = readyDish(engine, customer, 0);
  engine.serve(first.id, customer.id);
  assert.equal(customer.status, "waiting");
  assert.equal(customer.combo.delivered.length, 1);
  assert.equal(engine.s.ledger.served, 0);
  assert.equal(engine.s.selectedPart, 1);
  assert.equal(validState(engine.s), true);

  const reloaded = new Engine(structuredClone(engine.s));
  const guest = reloaded.s.customers[0];
  const second = readyDish(reloaded, guest, 1, true);
  reloaded.serve(second.id, guest.id);
  assert.equal(guest.status, "eating");
  assert.equal(guest.combo.delivered.length, 2);
  assert.equal(guest.result.correct, false);
  assert.equal(
    guest.result.payment,
    guest.combo.delivered[0].result.payment +
      guest.combo.delivered[1].result.payment,
  );
  assert.ok(guest.combo.delivered[0].result.payment > 0);
  assert.equal(reloaded.s.ledger.served, 0);
  assert.equal(validState(reloaded.s), true);

  for (let i = 0; i < 8; i++) reloaded.tick(1);
  assert.equal(guest.status, "checkout");
  const before = reloaded.s.money;
  assert.equal(reloaded.checkout(guest.id), true);
  assert.equal(reloaded.checkout(guest.id), false);
  assert.equal(
    reloaded.s.money,
    before + guest.result.payment + guest.result.tip,
  );
  assert.equal(reloaded.s.ledger.served, 1);
  assert.equal(
    Object.values(reloaded.s.ledger.sales).reduce((sum, n) => sum + n, 0),
    2,
  );
  assert.equal(validState(reloaded.s), true);
});

test("kitchen assigns each new pot to the selected combo part and refuses duplicate cooking", () => {
  const { engine, customer } = comboVisit();
  addStock(engine.s, "noodles", 5);
  readyDish(engine, customer, 0);
  assert.equal(engine.selectPart(customer.id, 0), true);
  assert.equal(engine.noodles(0, customer.id, 0), false);
  assert.equal(engine.selectPart(customer.id, 1), true);
  engine.burnerStep(0);
  engine.burnerStep(0);
  for (let i = 0; i < 5; i++) engine.tick(1);
  assert.equal(engine.noodles(0, customer.id, 1), true);
  assert.equal(engine.s.pots[0].partIndex, 1);
  assert.equal(validState(engine.s), true);
});

test("two drinks and tempura can share one combo bill with immediate Mika checkout", () => {
  const { engine, customer } = comboVisit(47);
  assert.equal(customer.combo.parts.filter((part) => part.drink).length, 2);
  assert.equal(customer.combo.parts.filter((part) => part.side).length, 1);
  engine.s.money = 10000;
  engine.hire("mika");
  for (let index = 0; index < 2; index++) {
    const dish = readyDish(engine, customer, index);
    engine.serve(dish.id, customer.id);
  }
  assert.equal(customer.result.correct, true);
  assert.equal(customer.result.payment, quotedOrderTotal(engine.s, customer));
  const before = engine.s.money;
  for (let i = 0; i < 8; i++) engine.tick(1);
  assert.equal(customer.status, "departing");
  assert.equal(
    engine.s.money,
    before + customer.result.payment + customer.result.tip,
  );
  assert.equal(engine.s.ledger.served, 1);
  assert.equal(validState(engine.s), true);
});
