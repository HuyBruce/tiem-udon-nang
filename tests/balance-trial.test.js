import test from "node:test";
import assert from "node:assert/strict";
import { newState } from "../src/systems/state.js";
import { chooseTastes, makeCustomer } from "../src/systems/customers.js";
import { TASTES, brothFormula } from "../src/systems/discovery.js";
import { judge } from "../src/systems/economy.js";
import { RECIPES, DRINKS } from "../src/data.js";
import { migrateState } from "../src/systems/migration.js";
import { validState } from "../src/systems/validation.js";

test("seeded taste trial stays near 70% familiar and avoids repeat or opposite pairs", () => {
  const s = newState();
  s.tasteSeed = 123456789;
  let familiar = 0;
  let previous;
  for (let i = 0; i < 5000; i++) {
    const tastes = chooseTastes(s, "mai");
    if (TASTES.mai.includes(tastes[0])) familiar++;
    assert.notDeepEqual([...tastes].sort(), previous && [...previous].sort());
    assert.ok(!(tastes.includes("hot") && tastes.includes("cold")));
    previous = tastes;
  }
  assert.ok(familiar > 3350 && familiar < 3650, `familiar: ${familiar}`);
  const restored = structuredClone(s);
  assert.deepEqual(chooseTastes(s, "mai"), chooseTastes(restored, "mai"));
});

test("handmade order shows its surcharge and only charges when served correctly", () => {
  const s = newState();
  s.day = 5;
  s.serial = 1;
  const c = makeCustomer(s, 0);
  assert.equal(c.noodleTier, "handmade");
  assert.ok(c.order.includes("+¥80"));
  const recipe = RECIPES[c.recipe];
  const dish = {
    orderId: c.id, broth: brothFormula(recipe), tops: [...recipe.tops],
    method: recipe.kind || "hot", drink: c.drink, side: c.side,
    noodleTier: "handmade", texture: "perfect", quality: 1,
  };
  const paid = judge(s, c, dish);
  assert.equal(paid.correct, true);
  assert.equal(paid.rep, 0.53);
  assert.equal(paid.payment, s.prices[c.recipe] + 80 +
    (c.side ? 250 : 0) + (c.extra ? 100 : 0) + (DRINKS[c.drink]?.price || 0));
  assert.equal(judge(s, c, { ...dish, noodleTier: "regular" }).correct, false);
  const regular = { ...c, noodleTier: "regular" };
  const gift = judge(s, regular, dish);
  assert.equal(gift.payment, paid.payment - 80);
  assert.ok(judge(s, c, { ...dish, texture: "soft" }).rep <= 1.5);
});

test("version 2 saves keep relative menu prices and spending power in v3", () => {
  const old = newState();
  old.version = 2;
  old.money = 2400;
  old.prices.kake = 540;
  old.prices.beef = 520;
  const updated = migrateState(old);
  assert.equal(updated.version, 3);
  assert.equal(updated.money, 4008);
  assert.equal(updated.prices.kake, 900);
  assert.equal(updated.prices.beef, RECIPES.beef.price);
  assert.equal(validState(updated), true);
  assert.equal(migrateState(updated).money, updated.money);
});
