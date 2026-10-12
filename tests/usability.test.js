import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { CUSTOMERS, RECIPES } from "../src/data.js";
import { brothFormula } from "../src/systems/discovery.js";
import { validState } from "../src/systems/validation.js";
import { migrateState } from "../src/systems/migration.js";
import balance from "../config/balance.json" with { type: "json" };

const advance = (e, seconds) => {
  for (let i = 0; i < seconds; i++) e.tick(1);
};

function cooking() {
  const e = new Engine();
  e.open();
  e.s.nextArrival = 1000;
  e.accept(e.s.customers[0].id);
  e.burnerStep(0);
  e.burnerStep(0);
  advance(e, 5);
  e.noodles(0, e.s.customers[0].id);
  assert.ok(e.s.pots[0]);
  return e;
}

test("trash discards the selected cooking pot without refunding stock or changing its burner", () => {
  const e = cooking();
  const inventory = structuredClone(e.s.inventory);
  const burner = structuredClone(e.s.burners[0]);
  const money = e.s.money;
  assert.equal(e.discardFood("pot:0"), true);
  assert.equal(e.s.pots[0], null);
  assert.deepEqual(e.s.burners[0], burner);
  assert.deepEqual(e.s.inventory, inventory);
  assert.equal(e.s.money, money);
  assert.equal(e.discardFood("pot:0"), false);
  assert.equal(validState(e.s), true);
});

test("trash accepts a lifted bowl and a real tray meal; invalid sources cannot delete other food", () => {
  const e = cooking();
  advance(e, 10);
  e.liftNoodles(0);
  assert.equal(e.s.pots[0].lifted, true);
  assert.equal(e.discardFood("bowl:0"), true);
  e.noodles(0, e.s.customers[0].id);
  for (const id of brothFormula(RECIPES.kake)) e.brothAdd(id);
  e.brothCook();
  advance(e, 10);
  e.liftNoodles(0);
  e.pour(0);
  e.tray(0);
  const id = e.s.tray[0].id;
  const before = JSON.stringify(e.s);
  for (const source of [
    "ingredient:noodles",
    "prepared:tempura",
    "dish:missing",
    "pot:-1",
    "pot:no",
    "fryer:99",
    "drink",
    "pot:0:extra",
  ]) {
    assert.equal(e.discardFood(source), false, source);
    assert.equal(JSON.stringify(e.s), before, source);
  }
  const inventory = structuredClone(e.s.inventory);
  assert.equal(e.discardFood(`dish:${id}`), true);
  assert.equal(e.s.tray.length, 0);
  assert.deepEqual(e.s.inventory, inventory);
  assert.equal(validState(migrateState(JSON.parse(JSON.stringify(e.s)))), true);
});

test("trash accepts a partially mixed drink and frying batch without creating cooked portions or refunds", () => {
  const e = new Engine();
  e.drinkStart("ramune");
  e.fry("select");
  e.fry("batter");
  e.fry("oil");
  const inventory = structuredClone(e.s.inventory);
  const prepared = structuredClone(e.s.prepared);
  assert.equal(e.discardFood("drink"), true);
  assert.equal(e.discardFood("fryer:0"), true);
  assert.equal(e.s.drink, null);
  assert.equal(e.s.fryer.length, 0);
  assert.deepEqual(e.s.inventory, inventory);
  assert.deepEqual(e.s.prepared, prepared);
  assert.equal(validState(e.s), true);
});

test("new guests receive the configured patience bonus; reload preserves an existing countdown and save version", () => {
  const e = new Engine();
  e.open();
  const c = e.s.customers[0];
  const person = CUSTOMERS.find((person) => person.id === c.personId);
  assert.ok(person);
  assert.equal(
    c.maxPatience,
    person.patience + balance.customers.extraPatienceSeconds,
  );
  assert.equal(c.patience, c.maxPatience);
  c.patience = 31;
  c.maxPatience = person.patience;
  const reloaded = new Engine(migrateState(JSON.parse(JSON.stringify(e.s))));
  assert.equal(reloaded.s.customers[0].patience, 31);
  assert.equal(reloaded.s.customers[0].maxPatience, person.patience);
  assert.equal(reloaded.s.version, 3);
  assert.equal(validState(reloaded.s), true);
});
