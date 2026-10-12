import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { addStock, count } from "../src/systems/inventory.js";
import { DRINK_TOPPINGS } from "../src/data.js";
import { makeCustomer, hint } from "../src/systems/customers.js";
import {
  availableDrinkToppings,
  toppingFits,
} from "../src/systems/drink-toppings.js";
import {
  judge,
  quotedPartTotal,
  quotedOrderTotal,
} from "../src/systems/economy.js";
import { validState } from "../src/systems/validation.js";

import { toppingFixture, finishDrink } from "./helpers/drink-toppings.mjs";

test("four toppings consume stock once after brewing, enforce temperature and survive attachment/removal", () => {
  for (const [top, id, temp] of [
    ["iceCream", "matcha", "cold"],
    ["whippedCream", "coffee", "hot"],
    ["sakura", "sakuraTea", "hot"],
    ["yuzu", "tea", "cold"],
  ]) {
    let e = toppingFixture(top, id, temp);
    const ingredient = DRINK_TOPPINGS[top].ingredient;
    const before = count(e.s, ingredient);
    assert.equal(e.drinkTopping(top), false);
    assert.equal(count(e.s, ingredient), before);
    finishDrink(e);
    if (top === "iceCream") assert.equal(e.drinkTopping(top), false);
    if (temp === "cold") assert.equal(e.drinkChill(), true);
    const readyStock = count(e.s, ingredient);
    assert.equal(e.drinkTopping(top), true);
    assert.equal(count(e.s, ingredient), readyStock - 1);
    assert.equal(e.drinkTopping(top), false);
    assert.equal(count(e.s, ingredient), readyStock - 1);
    assert.equal(validState(e.s), true);
    e = new Engine(structuredClone(e.s));
    assert.equal(e.s.drink.topping, top);
    assert.equal(e.attachDrink("dish1"), true);
    assert.equal(e.s.tray[0].drinkTopping, top);
    assert.equal(validState(e.s), true);
    e = new Engine(structuredClone(e.s));
    assert.equal(e.removeDrink("dish1"), true);
    assert.equal(e.s.tray.length, 0);
    assert.equal(count(e.s, ingredient), readyStock - 1);
  }
});

test("empty or expired topping stock, strange drinks and incompatible toppings leave the glass unchanged", () => {
  const e = toppingFixture();
  finishDrink(e);
  e.s.inventory.cream = [
    { qty: 5, expires: e.s.day, premium: false, unitCost: 30 },
  ];
  const before = structuredClone(e.s.drink);
  e.drinkTopping("whippedCream");
  assert.deepEqual(e.s.drink, before);
  assert.equal(e.drinkTopping("sakura"), false);
  addStock(e.s, "cream", 2, false, true);
  e.s.drink.strange = true;
  assert.equal(e.drinkTopping("whippedCream"), false);
  assert.equal(count(e.s, "cream"), 2);
  assert.deepEqual(availableDrinkToppings("matcha", "cold", 9), []);
  assert.deepEqual(availableDrinkToppings("ramune", "cold", 30), []);
});

test("missing/wrong topping is judged wrong; quoted surcharge settles once with the meal", () => {
  let e = toppingFixture();
  finishDrink(e);
  const c = e.s.customers[0],
    d = e.s.tray[0];
  e.attachDrink(d.id);
  assert.equal(judge(e.s, c, d).correct, false);
  d.drinkTopping = "iceCream";
  assert.equal(judge(e.s, c, d).correct, false);
  d.drinkTopping = "whippedCream";
  assert.equal(judge(e.s, c, d).correct, true);
  const plain = { ...c, drinkTopping: null };
  assert.equal(quotedPartTotal(e.s, c) - quotedPartTotal(e.s, plain), 60);
  assert.equal(judge(e.s, c, d).payment, quotedPartTotal(e.s, c));
  e.serve(d.id, c.id);
  assert.equal(c.meal.drinkTopping, "whippedCream");
  assert.equal(validState(e.s), true);
  e = new Engine(structuredClone(e.s));
  const saved = e.s.customers[0];
  saved.status = "checkout";
  saved.checkoutTime = 0;
  const revenue = e.s.ledger.revenue;
  assert.equal(e.checkout(saved.id), true);
  assert.equal(e.s.ledger.revenue - revenue, quotedPartTotal(e.s, saved));
  const paid = e.s.money;
  e.checkout(saved.id);
  assert.equal(e.s.money, paid);
});

test("generated orders introduce only compatible toppings from day ten, including distinct combo parts", () => {
  const seen = new Set();
  let toppedCombo = 0;
  for (const day of [1, 9, 10, 14]) {
    const s = newState();
    s.day = day;
    for (let n = 0; n < 160; n++) {
      const c = makeCustomer(s, 0);
      for (const p of c.combo?.parts || [c]) {
        if (p.drinkTopping) {
          assert.ok(day >= 10);
          assert.ok(toppingFits(p.drinkTopping, p.drink, p.drinkTemperature));
          seen.add(p.drinkTopping);
          if (c.combo) toppedCombo++;
          else {
            assert.ok(
              c.order.includes(
                DRINK_TOPPINGS[p.drinkTopping].name.toLowerCase(),
              ) || c.order.includes(DRINK_TOPPINGS[p.drinkTopping].name),
            );
            c.hints = 3;
            assert.ok(hint(c, s).includes(DRINK_TOPPINGS[p.drinkTopping].name));
          }
        }
      }
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(DRINK_TOPPINGS).sort());
  assert.ok(toppedCombo > 0);
});

test("legacy plain drinks remain valid; invalid toppings are rejected at every saved location", () => {
  const partial = toppingFixture();
  partial.s.drink.topping = "whippedCream";
  assert.equal(validState(partial.s), false);
  finishDrink(partial);
  assert.equal(validState(partial.s), true);
  partial.s.drink.strange = true;
  assert.equal(validState(partial.s), false);
  const e = toppingFixture(null);
  finishDrink(e);
  e.attachDrink("dish1");
  delete e.s.tray[0].drinkTopping;
  delete e.s.customers[0].drinkTopping;
  assert.equal(validState(e.s), true);
  assert.equal(judge(e.s, e.s.customers[0], e.s.tray[0]).correct, true);
  const original = structuredClone(e.s);
  const invalid = ["bogus", 1, {}, "iceCream"];
  for (const value of invalid) {
    const s = structuredClone(original);
    s.tray[0].drinkTopping = value;
    assert.equal(validState(s), false);
    const c = structuredClone(original);
    c.customers[0].drinkTopping = value;
    assert.equal(validState(c), false);
    const b = toppingFixture();
    finishDrink(b);
    b.s.drink.topping = value;
    assert.equal(validState(b.s), false);
  }
});

test("combo preserves topping per part through reload and quotes one combined bill", () => {
  let e = toppingFixture();
  const c = e.s.customers[0];
  const base = {
    recipe: "kake",
    omit: null,
    extra: null,
    drink: "matcha",
    drinkTemperature: "hot",
    side: false,
    sideKind: null,
    noodleTier: "regular",
  };
  c.combo = {
    parts: [
      { ...base, drinkTopping: "whippedCream" },
      { ...base, drinkTopping: null },
    ],
    delivered: [],
  };
  finishDrink(e);
  e.drinkTopping("whippedCream");
  e.attachDrink("dish1");
  e.s.tray[0].partIndex = 0;
  e.serve("dish1", c.id);
  assert.equal(c.status, "waiting");
  assert.equal(validState(e.s), true);
  e = new Engine(structuredClone(e.s));
  const saved = e.s.customers[0];
  assert.equal(saved.combo.delivered[0].dish.drinkTopping, "whippedCream");
  const second = {
    ...saved.combo.delivered[0].dish,
    id: "dish2",
    partIndex: 1,
    drinkTopping: null,
  };
  e.s.tray.push(second);
  e.serve(second.id, saved.id);
  assert.equal(saved.status, "eating");
  assert.equal(saved.result.payment, quotedOrderTotal(e.s, saved));
  assert.equal(validState(e.s), true);
  const bad = structuredClone(e.s);
  bad.customers[0].combo.delivered[0].dish.drinkTopping = "bad";
  assert.equal(validState(bad), false);
  const badPart = structuredClone(e.s);
  badPart.customers[0].combo.parts[1].drinkTopping = "bad";
  assert.equal(validState(badPart), false);
  const badMeal = structuredClone(e.s);
  badMeal.customers[0].meal.drinkTopping = "bad";
  assert.equal(validState(badMeal), false);
});
