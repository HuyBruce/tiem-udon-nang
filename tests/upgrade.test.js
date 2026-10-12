import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { migrateState } from "../src/systems/migration.js";
import { SaveService, SAVE_KEY } from "../src/systems/save.js";
import {
  count,
  consume,
  addStock,
  stockSize,
} from "../src/systems/inventory.js";
import { brothFormula, tasteDish } from "../src/systems/discovery.js";
import { makeCustomer, hint } from "../src/systems/customers.js";
import { RECIPES, DRINKS } from "../src/data.js";
import { clockText, traffic } from "../src/systems/time.js";
import { judge } from "../src/systems/economy.js";
import { marketOffer } from "../src/systems/market.js";
const advance = (e, n) => {
  for (let i = 0; i < n; i++) e.tick(1);
};
function start() {
  const e = new Engine();
  e.open();
  const c = e.s.customers[0];
  e.accept(c.id);
  e.burnerStep(0);
  e.burnerStep(0);
  advance(e, 5);
  return [e, c];
}
function batch(e, ids = brothFormula(RECIPES.kake)) {
  for (const id of ids) assert.equal(e.brothAdd(id), true);
  assert.equal(e.brothCook(), true);
  advance(e, 7);
}
function dish(e, c, tops = ["onion"]) {
  e.noodles(0, c.id);
  advance(e, 9);
  e.liftNoodles(0);
  e.pour(0);
  for (const id of tops) e.topping(0, id);
  e.tray(0);
  return e.s.tray.at(-1);
}
function finish(e) {
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.phase, "summary");
}
test("suggested 18:00 closing never stops the clock or admission", () => {
  const [e] = start();
  advance(e, 715);
  assert.equal(e.s.closing, false);
  assert.equal(clockText(e.s), "22:00");
  e.s.elapsed = 780;
  assert.ok(traffic(e.s) > 0);
  e.close();
  assert.equal(traffic(e.s), 0);
  assert.equal(e.s.day, 1);
});
test("five bowls share exact batch ingredients, no free refill or duplicate pour", () => {
  const [e, c] = start();
  const initial = count(e.s, "dashi");
  batch(e);
  assert.equal(count(e.s, "dashi"), initial - 2);
  for (let i = 0; i < 5; i++) {
    const d = dish(e, c);
    assert.equal(d.broth.length, 4);
    assert.equal(e.pour(0), false);
  }
  assert.equal(e.s.brothBatch.servings, 0);
  assert.equal(count(e.s, "dashi"), initial - 2);
  assert.equal(e.s.tray.length, 5);
  assert.equal(validState(e.s), true);
});
test("water and heat precede noodles, early and late lifts affect texture", () => {
  const e = new Engine();
  e.open();
  e.accept("c0");
  assert.equal(e.noodles(0), false);
  e.burnerStep(0);
  assert.equal(e.noodles(0), false);
  e.burnerStep(0);
  advance(e, 5);
  e.noodles(0);
  advance(e, 3);
  e.liftNoodles(0);
  assert.equal(e.s.pots[0].texture, "hard");
  e.discard(0);
  e.noodles(0);
  advance(e, e.s.pots[0].duration + 5);
  e.liftNoodles(0);
  assert.equal(e.s.pots[0].texture, "perfect");
  e.discard(0);
  e.noodles(0);
  advance(e, 22);
  assert.equal(e.s.pots[0].lifted, false);
  e.liftNoodles(0);
  assert.equal(e.s.pots[0].texture, "soft");
});
test("asking twice is free of patience cost, third hint costs patience but never money", () => {
  const e = new Engine();
  e.open();
  const c = e.s.customers[0],
    patience = c.patience,
    money = e.s.money;
  e.ask(c.id);
  const firstHint = hint(c, e.s);
  e.ask(c.id);
  const secondHint = hint(c, e.s);
  assert.equal(c.patience, patience);
  assert.equal(c.hints, 2);
  e.ask(c.id);
  const thirdHint = hint(c, e.s);
  assert.equal(c.patience, patience - 4);
  assert.notEqual(firstHint, secondHint);
  assert.notEqual(secondHint, thirdHint);
  assert.equal(e.s.money, money);
  assert.equal(validState(e.s), true);
});
test("a returning guest gets a fresh taste pair and readable clue", () => {
  const s = newState();
  const first = makeCustomer(s, 0);
  s.serial = 6;
  s.visits.mai = 1;
  const returning = makeCustomer(s, 0);
  assert.equal(first.personId, returning.personId);
  assert.notDeepEqual(first.preferences, returning.preferences);
  assert.ok(returning.order.includes("Hôm nay mình thích vị"));
  assert.ok(hint(returning, s).includes("vị"));
});
test("a guest leaves before ordering when their chosen menu dish is far too expensive", () => {
  const e = new Engine();
  e.price("kake", RECIPES.kake.price * 2);
  e.open();
  assert.equal(e.s.customers.length, 0);
  assert.equal(e.s.ledger.lost, 1);
  assert.equal(validState(e.s), true);
});
test("eggs can be prepared only before opening, including authorized staff prep", () => {
  const e = new Engine();
  const before = count(e.s, "egg");
  assert.equal(e.prepareEgg(), true);
  assert.equal(e.s.prepared.egg, 3);
  e.open();
  assert.equal(e.prepareEgg(), false);
  assert.equal(e.s.prepared.egg, 3);
  assert.equal(count(e.s, "egg"), before - 3);
  const staff = new Engine();
  staff.s.money = 100000;
  staff.hire("binh");
  staff.s.staffOptions.prep = true;
  staff.open();
  assert.equal(staff.s.prepared.egg, 3);
  assert.equal(validState(staff.s), true);
});
test("meal checkout happens once and survives reload mid-meal", () => {
  const [e, c] = start();
  batch(e);
  const d = dish(e, c),
    money = e.s.money;
  e.serve(d.id, c.id);
  assert.equal(e.s.money, money);
  assert.equal(e.s.ledger.served, 0);
  assert.equal(validState(e.s), true);
  const restored = new Engine(e.s);
  advance(restored, 17);
  assert.ok(restored.s.money > money);
  assert.equal(restored.s.ledger.served, 1);
  restored.settle(restored.s.customers[0]);
  assert.equal(restored.s.ledger.served, 1);
});
test("closing refuses arrivals and waits for dirty dishes to be washed", () => {
  const [e, c] = start();
  batch(e);
  const d = dish(e, c);
  e.serve(d.id, c.id);
  e.close();
  const n = e.s.customers.length;
  e.spawn();
  assert.equal(e.s.customers.length, n);
  assert.equal(e.s.phase, "open");
  advance(e, 17);
  e.clear(c.id);
  assert.equal(e.s.phase, "open");
  e.wash();
  advance(e, 1);
  assert.equal(e.s.phase, "open");
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.phase, "summary");
  const money = e.s.money;
  advance(e, 20);
  assert.equal(e.s.money, money);
});
test("utilities on seventh completed day and payroll on thirtieth, no real-time accrual", () => {
  const e = new Engine();
  e.s.money = 100000;
  e.hire("thu");
  for (let day = 1; day <= 30; day++) {
    e.open();
    finish(e);
    assert.equal(e.s.lastSummary.wages, day === 30 ? 300 * 30 : 0);
    assert.equal(e.s.lastSummary.other, day % 7 === 0 ? 945 : 0);
    if (day !== 30) e.nextDay();
  }
  assert.equal(e.s.payroll, 0);
});
test("stock uses one slot per type and expired food cannot be consumed", () => {
  const s = newState(),
    slots = stockSize(s);
  assert.equal(addStock(s, "noodles", 100, false, true), true);
  assert.equal(stockSize(s), slots);
  assert.equal(addStock(s, "coffee", 1, false, true), false);
  s.upgrades.storage = 1;
  assert.equal(addStock(s, "coffee", 1, false, true), true);
  s.inventory.beef = [{ qty: 2, expires: s.day, unitCost: 65, premium: false }];
  assert.equal(count(s, "beef"), 0);
  assert.equal(consume(s, ["beef"]), null);
});
test("hidden recipe unlocks after a liked meal and joins menu choices next day", () => {
  const [e, c] = start();
  c.freestyle = true;
  c.preferences = ["light", "vegetable"];
  batch(e, brothFormula(RECIPES.yuzu));
  const d = dish(e, c, ["tofu", "seaweed"]);
  assert.equal(e.s.pendingRecipes.length, 0);
  e.serve(d.id, c.id);
  assert.equal(e.s.pendingRecipes.length, 0);
  advance(e, 9);
  e.checkout(c.id);
  assert.ok(e.s.pendingRecipes.includes("yuzu"));
  assert.ok(!e.s.unlocked.includes("yuzu"));
  finish(e);
  e.nextDay();
  assert.ok(e.s.unlocked.includes("yuzu"));
  assert.ok(!e.s.menu.includes("yuzu"));
  e.menu("yuzu");
  assert.ok(e.s.menu.includes("yuzu"));
});
test("novel tasty dish can be named, persisted and sold the following day", () => {
  const [e, c] = start();
  c.freestyle = true;
  c.preferences = ["light", "vegetable"];
  batch(e);
  const d = dish(e, c, ["tofu", "onion", "seaweed"]);
  e.serve(d.id, c.id);
  advance(e, 9);
  e.checkout(c.id);
  assert.ok(e.s.discoveryDraft);
  e.nameRecipe("Udon vườn nhỏ");
  assert.equal(e.s.customRecipes.custom1.name, "Udon vườn nhỏ");
  assert.equal(validState(e.s), true);
  finish(e);
  e.nextDay();
  e.menu("custom1");
  e.s.menu = ["custom1"];
  e.open();
  assert.equal(e.s.customers[0].recipe, "custom1");
  assert.equal(validState(e.s), true);
});
test("poorly cooked freestyle does not reveal a recipe", () => {
  const [e, c] = start();
  c.freestyle = true;
  batch(e);
  e.noodles(0);
  e.liftNoodles(0);
  e.pour(0);
  e.topping(0, "onion");
  e.tray(0);
  e.serve(e.s.tray[0].id, c.id);
  advance(e, 9);
  e.checkout(c.id);
  assert.equal(e.s.discoveryDraft, null);
  assert.equal(e.s.collection.recipes.length, 0);
});
test("drink ingredients consumed at each step, mistakes have a real cost", () => {
  const e = new Engine(),
    before = count(e.s, "milk");
  e.drinkStart("matcha");
  assert.equal(count(e.s, "matcha"), 4);
  e.drinkStep("matcha");
  assert.equal(count(e.s, "matcha"), 3);
  e.drinkStep("milk");
  assert.equal(e.s.drink.strange, true);
  assert.equal(count(e.s, "milk"), before - 1);
  assert.equal(e.s.drink.step, DRINKS.matcha.steps);
  assert.equal(validState(e.s), true);
});
test("handmade unlock and garden care are calendar based", () => {
  const e = new Engine();
  assert.equal(e.handmadeStep(), false);
  e.s.day = 5;
  for (let i = 0; i < 5; i++) e.handmadeStep();
  assert.equal(e.s.handmade.portions, 5);
  e.plant(0, "onion");
  for (let i = 0; i < 3; i++) {
    e.open();
    finish(e);
    e.nextDay();
  }
  assert.equal(e.s.plots[0], null);
  e.plant(0, "onion");
  e.garden(0);
  e.fertilize(0);
  e.open();
  finish(e);
  e.nextDay();
  assert.equal(e.s.plots[0].growth, 1.5);
});
test("legacy state migration preserves money, inventory and finished meals", () => {
  const s = newState();
  s.version = 1;
  s.money = 8765;
  for (const [id, price] of Object.entries({
    kake: 360,
    beef: 520,
    kitsune: 440,
    tempura: 620,
    miso: 590,
    yuzu: 640,
    cold: 430,
    curry: 650,
    yaki: 610,
    autumn: 580,
  }))
    s.prices[id] = price;
  s.elapsed = 180;
  delete s.burners;
  delete s.brothBatch;
  const m = migrateState(s);
  assert.equal(m.version, 3);
  assert.equal(m.money, Math.round(8765 * 1.67));
  assert.equal(m.elapsed, 210);
  assert.deepEqual(m.inventory, s.inventory);
  assert.equal(validState(m), true);
  const map = new Map([[SAVE_KEY, JSON.stringify({ state: s })]]),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) };
  assert.equal(new SaveService(storage).load().money, Math.round(8765 * 1.67));
});
test("malformed extended saves are rejected and backup is retained", () => {
  const s = newState();
  assert.equal(validState(s), true);
  assert.equal(
    validState({ ...s, brothBatch: { ingredients: ["evil"] } }),
    false,
  );
  assert.equal(
    validState({ ...s, customRecipes: { custom1: { name: "<img>" } } }),
    false,
  );
  assert.equal(
    validState({ ...s, handmade: { portions: Infinity, stage: 0 } }),
    false,
  );
  const map = new Map(),
    storage = { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
    save = new SaveService(storage);
  save.save(s);
  save.save(s);
  map.set(SAVE_KEY, "bad");
  assert.equal(save.load().version, 3);
});
test("cold and stir-fried recipes require their real finishing action", () => {
  const [e, c] = start();
  batch(e);
  c.recipe = "cold";
  e.noodles(0);
  advance(e, 9);
  e.liftNoodles(0);
  e.finishStyle(0, "cold");
  e.pour(0);
  e.topping(0, "seaweed");
  e.topping(0, "onion");
  e.tray(0);
  assert.equal(judge(e.s, c, e.s.tray[0]).correct, true);
  e.clearTray(e.s.tray[0].id);
  c.recipe = "yaki";
  e.noodles(0);
  advance(e, 9);
  e.liftNoodles(0);
  e.pour(0);
  e.topping(0, "beef");
  e.topping(0, "onion");
  const oil = count(e.s, "oil");
  e.finishStyle(0, "stirfry");
  assert.equal(e.tray(0), false);
  advance(e, 6);
  e.tray(0);
  assert.equal(count(e.s, "oil"), oil - 1);
  assert.equal(judge(e.s, c, e.s.tray[0]).correct, true);
  assert.equal(validState(e.s), true);
});
test("fertilizer is charged once, seasonal planting is enforced, bouquets persist", () => {
  const e = new Engine();
  e.plant(0, "onion");
  const before = e.s.money;
  e.fertilize(0);
  e.open();
  finish(e);
  assert.equal(e.s.money, before - 40);
  assert.equal(e.s.lastSummary.other, 40);
  e.nextDay();
  e.s.money = 10000;
  e.upgrade("garden");
  e.upgrade("garden");
  assert.equal(e.plant(1, "yuzu"), false);
  e.plant(1, "flowers");
  e.s.plots[1].growth = 2;
  e.garden(1);
  assert.equal(e.s.bouquets, 1);
  e.arrangeFlowers("front");
  assert.equal(e.s.bouquets, 0);
  assert.equal(e.s.flowerRooms.front, e.s.day + 4);
});
test("staff completes only learned unlocked recipes and does not consume drinks", () => {
  const [e, c] = start();
  e.s.money = 50000;
  e.hire("yui");
  e.hire("yui");
  e.hire("yui");
  const tea = count(e.s, "tea");
  advance(e, 90);
  const d = e.s.tray.find((d) => d.orderId === c.id);
  assert.ok(d);
  assert.equal(judge(e.s, c, d).correct, true);
  assert.equal(count(e.s, "tea"), tea);
});
test("weather and event supply prices are used by actual purchases", () => {
  const e = new Engine();
  e.s.forecast.weather = "rain";
  let before = e.s.money;
  const offer = marketOffer(e.s, "shrimp", false, 5);
  e.buy("shrimp");
  assert.equal(e.s.money, before - offer.price);
  assert.ok(offer.factor > 1);
  e.s.forecast.event = "harvest";
  assert.ok(marketOffer(e.s, "onion").factor < 1);
});
