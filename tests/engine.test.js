import { brothFormula } from "../src/systems/discovery.js";
import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import {
  addStock,
  consume,
  count,
  expire,
  capacity,
  stockSize,
} from "../src/systems/inventory.js";
import { SaveService, SAVE_KEY } from "../src/systems/save.js";
import { RECIPES, INGREDIENTS, UPGRADES, EMPLOYEES } from "../src/data.js";
import { forecast } from "../src/systems/weather.js";
import { reviewDemand } from "../src/systems/time.js";
import { validState } from "../src/systems/validation.js";
test("save validation rejects partial, malformed and markup-bearing imports", () => {
  const s = newState();
  assert.equal(validState(s), true);
  assert.equal(
    validState({ version: 1, day: 1, inventory: {}, customers: [] }),
    false,
  );
  assert.equal(validState({ ...s, money: -10 }), false);
  assert.equal(validState({ ...s, pots: null }), false);
  assert.equal(
    validState({ ...s, reviews: [{ text: "<img src=x onerror=alert(1)>" }] }),
    false,
  );
});
test("yesterday's reviews modestly change tomorrow's arrivals, while today's reviews wait", () => {
  const visit = (stars, reviewDay = 1) => {
    const state = newState();
    state.day = 2;
    state.reviews = [
      { name: "Mai", text: "Một bữa đáng nhớ.", stars, day: reviewDay },
    ];
    const engine = new Engine(state);
    engine.open();
    for (let i = 0; i < 25; i++) engine.tick(1);
    return engine.s;
  };
  const happy = visit(5);
  const unhappy = visit(1);
  const today = visit(5, 2);
  assert.equal(reviewDemand(happy), 1.12);
  assert.equal(reviewDemand(unhappy), 0.88);
  assert.equal(reviewDemand(today), 1);
  assert.ok(happy.nextArrival < unhappy.nextArrival);
});
test("storage failure is recoverable and does not crash play", () => {
  const storage = {
    getItem() {
      throw new Error("denied");
    },
    setItem() {
      throw new Error("quota");
    },
    removeItem() {
      throw new Error("denied");
    },
  };
  const save = new SaveService(storage);
  assert.equal(save.load(), null);
  assert.equal(save.save(newState()), false);
  assert.ok(save.error);
  assert.doesNotThrow(() => save.reset());
});
test("serving the correct dish to the wrong guest counts as a service mistake", () => {
  const [e, c] = start();
  e.spawn();
  const other = e.s.customers[1];
  e.accept(other.id);
  const d = cook(e, c);
  e.serve(d.id, other.id);
  assert.equal(other.result.correct, false);
  assert.equal(c.status, "waiting");
});
test("tray rejects a sixth dish without deleting food from its pot", () => {
  const [e, c] = start();
  for (let i = 0; i < 5; i++) cook(e, c);
  assert.equal(e.s.tray.length, 5);
  e.noodles(0, c.id);
  advance(e, 10);
  for (const id of RECIPES.kake.broth) e.broth(0, id);
  e.pour(0);
  e.topping(0, "onion");
  assert.equal(e.tray(0), false);
  assert.ok(e.s.pots[0]);
  assert.equal(e.s.tray.length, 5);
});
test("staff restocking requires explicit configuration", () => {
  const [e] = start();
  e.s.money = 10000;
  e.hire("binh");
  e.s.inventory.noodles = [];
  advance(e, 12);
  assert.equal(count(e.s, "noodles"), 0);
  e.s.staffOptions.restock = true;
  advance(e, 12);
  assert.equal(count(e.s, "noodles"), 5);
});
test("cloud adapter receives the account and complete save envelope", async () => {
  let received;
  const save = new SaveService(
    {},
    {
      save: async (account, envelope) => {
        received = { account, envelope };
        return true;
      },
    },
  );
  await save.sync("account-test", newState());
  assert.equal(received.account, "account-test");
  assert.equal(received.envelope.state.day, 1);
  assert.ok(received.envelope.updatedAt);
});
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
function cook(e, c, wrong = false) {
  if (!e.s.brothBatch.servings) {
    for (const id of brothFormula(RECIPES[c.recipe])) e.brothAdd(id);
    e.brothCook();
    advance(e, 7);
  }
  e.noodles(0, c.id);
  advance(e, 10);
  e.liftNoodles(0);
  e.pour(0);
  for (const id of RECIPES[c.recipe].tops.filter((t) => t !== c.omit))
    if (!wrong) e.topping(0, id);
  if (c.extra) e.topping(0, c.extra);
  e.tray(0);
  const d = e.s.tray.at(-1);
  if (c.drink) {
    e.drinkStart(c.drink);
    for (let i = 0; i < 6; i++) e.drinkStep();
    e.attachDrink(d.id);
  }
  return d;
}
test("complete order earns money, produces review, clears table and washes dishes", () => {
  const [e, c] = start(),
    money = e.s.money,
    d = cook(e, c);
  assert.equal(count(e.s, "noodles"), 13);
  assert.equal(e.serve(d.id, c.id), true);
  advance(e, 9);
  assert.equal(c.status, "checkout");
  assert.equal(e.s.ledger.served, 0);
  assert.equal(e.checkout(c.id), true);
  assert.ok(e.s.money > money);
  assert.equal(c.result.correct, true);
  assert.equal(e.s.ledger.served, 1);
  assert.ok(e.s.reviews[0].stars >= 4);
  advance(e, 9);
  assert.equal(c.status, "dirty");
  e.clear(c.id);
  assert.equal(e.s.sink, 1);
  e.wash();
  assert.equal(e.s.sink, 0);
});
test("wrong toppings and wrong recipient reduce reputation and tip", () => {
  const [e, c] = start(),
    d = cook(e, c, true),
    before = e.s.reputation;
  e.serve(d.id, c.id);
  assert.equal(c.result.correct, false);
  advance(e, 9);
  e.checkout(c.id);
  assert.ok(e.s.reputation < before);
  assert.ok(e.s.reviews[0].stars <= 2);
});
test("checkout auto collects after eight seconds without a cashier", () => {
  const [e, c] = start();
  e.serve(cook(e, c).id, c.id);
  const before = e.s.money;
  advance(e, 8);
  assert.equal(c.status, "checkout");
  assert.equal(e.s.money, before);
  assert.equal(e.s.ledger.served, 0);
  assert.equal(validState(e.s), true);
  const restored = new Engine(e.s);
  advance(restored, 8);
  assert.equal(restored.s.ledger.served, 1);
  assert.ok(restored.s.money > before);
  assert.equal(restored.checkout(c.id), false);
  assert.equal(restored.s.ledger.served, 1);
});
test("hired cashier collects as soon as a guest finishes eating", () => {
  const [e, c] = start();
  e.s.money = 100000;
  assert.equal(e.hire("mika"), true);
  e.serve(cook(e, c).id, c.id);
  const before = e.s.money;
  advance(e, 8);
  assert.equal(c.status, "departing");
  assert.equal(e.s.ledger.served, 1);
  assert.ok(e.s.money > before);
  assert.equal(e.checkout(c.id), false);
  assert.equal(e.s.ledger.served, 1);
});
test("inventory consumption is atomic, finite, first-expiring-first-out and capacity limited", () => {
  const s = newState();
  s.inventory = {};
  addStock(s, "beef", 2, false, true);
  s.day++;
  addStock(s, "beef", 1, true, true);
  assert.equal(consume(s, ["beef", "noodles"]), null);
  assert.equal(count(s, "beef"), 3);
  assert.equal(consume(s, ["beef"]).quality, 0);
  assert.equal(count(s, "beef"), 2);
  s.day = 4;
  assert.equal(expire(s), 1);
  assert.equal(count(s, "beef"), 1);
  assert.equal(consume(s, ["beef"]).quality, 1);
  assert.equal(addStock(s, "noodles", capacity(s) + 1, false, true), true);
  assert.equal(stockSize(s), 1);
});
test("fridge extends shelf life and premium ingredients cost more", () => {
  const s = newState();
  s.inventory = {};
  s.upgrades.fridge = 2;
  addStock(s, "beef", 1, true);
  assert.equal(s.inventory.beef[0].expires, 8);
  assert.equal(s.money, 4000 - Math.ceil(INGREDIENTS.beef.cost * 1.7));
});
test("bound prices, last menu item and no-game-over recovery", () => {
  const e = new Engine();
  e.price("beef", 999999);
  assert.equal(e.s.prices.beef, RECIPES.beef.price * 2);
  e.s.menu = ["kake"];
  assert.equal(e.menu("kake"), false);
  e.open();
  e.s.money = 0;
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.money, 0);
  e.nextDay();
  assert.equal(e.s.phase, "morning");
  assert.ok(e.s.money > 0);
  assert.equal(e.s.day, 2);
});
test("sink capacity blocks clearing but never deletes dirty customer", () => {
  const [e, c] = start();
  c.status = "dirty";
  e.s.sink = 4;
  assert.equal(e.clear(c.id), false);
  assert.ok(e.s.customers.includes(c));
  e.wash();
  e.clear(c.id);
  assert.equal(e.s.sink, 2);
  assert.ok(!e.s.customers.includes(c));
});
test("upgrades add persistent scene capacity, pots, plots and charge money", () => {
  const e = new Engine();
  e.s.money = 20000;
  e.upgrade("seats");
  e.upgrade("stove");
  e.upgrade("garden");
  assert.equal(e.s.upgrades.seats, 1);
  assert.equal(e.s.pots.length, 2);
  assert.equal(e.s.plots.length, 2);
  assert.equal(
    e.s.money,
    20000 - UPGRADES.seats.base - UPGRADES.stove.base - UPGRADES.garden.base,
  );
});
test("parallel pots stay independent and survive a save roundtrip", () => {
  const [e, c] = start();
  e.s.money = 10000;
  e.upgrade("stove");
  e.spawn();
  const c2 = e.s.customers[1];
  e.accept(c2.id);
  e.noodles(0, c.id);
  e.burnerStep(1);
  e.burnerStep(1);
  advance(e, 5);
  e.noodles(1, c2.id);
  advance(e, 3);
  const data = new Map(),
    storage = {
      getItem: (k) => data.get(k),
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    save = new SaveService(storage);
  save.save(e.s);
  const loaded = save.load();
  assert.equal(loaded.pots[0].orderId, c.id);
  assert.equal(loaded.pots[1].orderId, c2.id);
  assert.equal(loaded.pots[0].time, 8);
  data.set(SAVE_KEY, "broken");
  save.save(loaded);
  save.save(loaded);
  data.set(SAVE_KEY, "broken");
  assert.ok(save.load());
});
test("tempura requires batter and oil, timed lift; burnt portions cannot be served", () => {
  const [e] = start();
  e.fry("select");
  e.fry("oil");
  assert.equal(e.s.fryer[0].stage, "raw");
  e.fry("batter");
  e.fry("oil");
  advance(e, 6);
  e.fry("lift");
  assert.equal(e.s.prepared.tempura, 1);
  e.fry("select");
  e.fry("batter");
  e.fry("oil");
  advance(e, 15);
  e.fry("lift");
  assert.equal(e.s.prepared.tempura, 1);
});
test("wrong attached drink requires discarding the whole meal without refunds", () => {
  const [e, c] = start(),
    d = cook(e, c),
    before = count(e.s, "ramune");
  e.drinkStart("ramune");
  e.drinkStep("bottle");
  e.attachDrink(d.id);
  assert.equal(count(e.s, "ramune"), before - 1);
  e.removeDrink(d.id);
  assert.equal(count(e.s, "ramune"), before - 1);
  assert.equal(
    e.s.tray.some((dish) => dish.id === d.id),
    false,
  );
});
test("gardening requires watering and calendar growth", () => {
  const e = new Engine();
  e.plant(0, "onion");
  e.open();
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  assert.equal(e.finishClose(), true);
  e.nextDay();
  assert.equal(e.s.plots[0].growth, 0);
  e.garden(0);
  e.open();
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  assert.equal(e.finishClose(), true);
  e.nextDay();
  assert.equal(e.s.plots[0].growth, 1);
  const before = count(e.s, "onion");
  e.garden(0);
  assert.equal(count(e.s, "onion"), before + 5);
  assert.equal(e.s.plots[0], null);
});
test("employees assist with real tasks and recurring wages", () => {
  const [e] = start();
  e.s.money = 20000;
  e.hire("thu");
  e.hire("binh");
  e.s.sink = 3;
  advance(e, 12);
  assert.ok(e.s.sink < 3);
  assert.ok(e.s.customers.every((c) => c.accepted));
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.lastSummary.wages, 0);
  assert.equal(e.s.payroll, EMPLOYEES.thu.wage + EMPLOYEES.binh.wage);
});
test("manual closing produces summary once before scheduled close, seasons repeat endlessly", () => {
  const [e] = start();
  advance(e, 60);
  assert.equal(e.s.phase, "open");
  e.s.customers = [];
  e.close();
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.phase, "summary");
  const balance = e.s.money;
  advance(e, 30);
  assert.equal(e.s.money, balance);
  assert.equal(forecast(31).season, "Đông");
  assert.equal(forecast(41).season, "Xuân");
  assert.equal(forecast(4).event, "blossom");
});
