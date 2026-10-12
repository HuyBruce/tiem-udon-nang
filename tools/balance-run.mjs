import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { count } from "../src/systems/inventory.js";
import { brothFormula } from "../src/systems/discovery.js";
import { DRINK_METHODS } from "../src/systems/drinks.js";
import { RECIPES, DRINKS, DRINK_TOPPINGS, SIDES } from "../src/data.js";
import { validState } from "../src/systems/validation.js";
import balance from "../config/balance.json" with { type: "json" };
import { nextPartIndex, partCustomer } from "../src/systems/combo.js";
import { sideId } from "../src/systems/sides.js";
import { requestedDrinkTemperature } from "../src/systems/drink-temperature.js";

// Repeatable bot trial (1–30 days). It performs the same public engine actions as
// the UI, while making perfect timing decisions and restocking when possible.
function run(hireCashier, startingMoney = 9500, totalDays = 7) {
  const state = newState();
  state.tasteSeed = 0x5eed1234;
  state.money = startingMoney;
  let engine = new Engine(state);
  const catalog = process.argv.includes("--catalog");
  const slow = process.argv.includes("--slow");
  if (catalog) {
    engine.s.money = 250000;
    engine.upgrade("stove");
    for (let i = 0; i < 3; i++) engine.upgrade("storage");
    for (const id of Object.keys(RECIPES))
      if (!RECIPES[id].hidden) engine.unlock(id);
  }
  const days = [];
  let failed = 0;
  const failures = [];
  let handmadeOrders = 0;
  let handmadeServed = 0;
  let manualCheckouts = 0;
  let comboPartsServed = 0;
  const sidesServed = {};
  const sidesOrdered = {};
  const sideAttachFailures = {};
  const drinksServed = {};
  const coldDrinksServed = {};
  const drinkToppingsServed = {};
  if (hireCashier) engine.hire("mika");
  const advance = (seconds) => {
    for (let i = 0; i < seconds; i++) engine.tick(1);
  };
  const stock = (id, qty = 1, premium = false) => {
    if (count(engine.s, id, premium ? true : null) >= qty) return true;
    while (count(engine.s, id, premium ? true : null) < qty) {
      if (engine.buy(id, 5, premium)) continue;
      if (!engine.upgrade("storage")) return false;
    }
    return true;
  };
  const cook = (customer) => {
    const s = engine.s;
    const partIndex = customer.combo ? nextPartIndex(customer) : 0;
    if (partIndex < 0) return false;
    const order = partCustomer(customer, partIndex);
    if (order.side)
      sidesOrdered[sideId(order)] = (sidesOrdered[sideId(order)] || 0) + 1;
    const recipe = RECIPES[order.recipe];
    const formula = brothFormula(recipe);
    engine.selectBroth(
      formula.includes("curry") && s.upgrades.stove ? "curry" : "regular",
    );
    const batchKey = s.brothSource === "curry" ? "curryBatch" : "brothBatch";
    const needed = [
      ...(order.noodleTier === "handmade" ? [] : ["noodles"]),
      ...formula,
      ...recipe.tops
        .filter((id) => id !== order.omit)
        .flatMap((id) =>
          id === "tempura"
            ? ["shrimp", "flour", "oil"]
            : id === "egg"
              ? []
              : [id],
        ),
    ];
    if (order.extra) needed.push(order.extra);
    if (recipe.kind === "stirfry") needed.push("oil");
    if (sideId(order) === "tempura") needed.push("shrimp", "flour", "oil");
    else if (sideId(order) && !["egg", "tempura"].includes(sideId(order)))
      needed.push(
        ...(SIDES[sideId(order)].preparation || [SIDES[sideId(order)].stock]),
      );
    if (order.noodleTier === "handmade") needed.push("flour", "flour");
    if (order.drink)
      needed.push(
        ...DRINK_METHODS[order.drink].flatMap((step) => step.items || []),
      );
    if (order.drinkTopping)
      needed.push(DRINK_TOPPINGS[order.drinkTopping].ingredient);
    const required = Object.groupBy(needed, (id) => id);
    if (
      !Object.entries(required).every(([id, items]) =>
        stock(
          id,
          items.length,
          id === "noodles" && order.noodleTier === "premium",
        ),
      )
    )
      return false;
    if (!customer.accepted) engine.accept(customer.id);
    if (
      s[batchKey].stage === "ready" &&
      [...s[batchKey].ingredients].sort().join() !== [...formula].sort().join()
    )
      engine.brothReset();
    if (s[batchKey].stage === "empty") {
      for (const id of formula) engine.brothAdd(id);
      engine.brothCook();
      advance(7);
    }
    if (order.noodleTier === "handmade") {
      handmadeOrders++;
      if (!s.handmade.portions)
        for (let i = 0; i < 5; i++) engine.handmadeStep();
      s.noodleTier = "handmade";
    } else s.noodleTier = order.noodleTier || "regular";
    if (s.burners[0].stage === "empty") {
      engine.burnerStep(0);
      engine.burnerStep(0);
      advance(5);
    }
    if (!engine.noodles(0, customer.id, partIndex)) return false;
    advance(Math.ceil(s.pots[0].duration));
    engine.liftNoodles(0);
    if ((recipe.kind || "hot") === "cold") engine.finishStyle(0, "cold");
    engine.pour(0);
    if (recipe.tops.includes("tempura") && !s.prepared.tempura) {
      engine.fry("select");
      engine.fry("batter");
      engine.fry("oil");
      advance(5);
      engine.fry("lift");
    }
    for (const id of recipe.tops.filter((id) => id !== order.omit))
      engine.topping(0, id);
    if (order.extra) engine.topping(0, order.extra);
    if ((recipe.kind || "hot") === "stirfry") {
      engine.finishStyle(0, "stirfry");
      advance(6);
    }
    if (!engine.tray(0)) return false;
    const dish = s.tray.at(-1);
    if (!dish || dish.orderId !== customer.id || dish.partIndex !== partIndex)
      return false;
    if (order.side) {
      if (sideId(order) === "tempura") {
        engine.fry("select");
        engine.fry("batter");
        engine.fry("oil");
        advance(5);
        engine.fry("lift");
      }
      if (SIDES[sideId(order)].preparation && !s.prepared[sideId(order)]) {
        if (!engine.prepareSide(sideId(order))) return false;
        for (let i = 0; i < 3; i++) engine.sidePrepStep();
        advance(balance.sidePreparation.cookSeconds[sideId(order)]);
        engine.sidePrepStep();
      }
      if (!engine.side(dish.id, sideId(order)))
        sideAttachFailures[sideId(order)] =
          (sideAttachFailures[sideId(order)] || 0) + 1;
    }
    if (order.drink) {
      engine.drinkStart(order.drink);
      for (const step of DRINK_METHODS[order.drink]) {
        engine.drinkStep(step.action);
        if (slow) advance(2);
      }
      if (
        requestedDrinkTemperature(order) === "cold" &&
        DRINKS[order.drink].temperatureOptions
      )
        engine.drinkChill();
      if (order.drinkTopping && !engine.drinkTopping(order.drinkTopping))
        return false;
      engine.attachDrink(dish.id);
    }
    if (slow) advance(12);
    if (!engine.serve(dish.id, customer.id)) return false;
    const partResult =
      customer.combo?.delivered.at(-1)?.result || customer.result;
    if (order.noodleTier === "handmade" && partResult.correct) handmadeServed++;
    if (customer.combo) comboPartsServed++;
    if (partResult.correct && order.side)
      sidesServed[sideId(order)] = (sidesServed[sideId(order)] || 0) + 1;
    if (partResult.correct && order.drink) {
      if (order.drinkTopping)
        drinkToppingsServed[order.drinkTopping] =
          (drinkToppingsServed[order.drinkTopping] || 0) + 1;
      drinksServed[order.drink] = (drinksServed[order.drink] || 0) + 1;
      if (
        requestedDrinkTemperature(order) === "cold" &&
        DRINKS[order.drink].temperatureOptions
      )
        coldDrinksServed[order.drink] =
          (coldDrinksServed[order.drink] || 0) + 1;
    }
    return true;
  };
  for (let day = 1; day <= totalDays; day++) {
    if (day >= 8 || catalog) stock("egg", catalog ? 30 : 12);
    if ((day >= 2 || catalog) && count(engine.s, "egg") >= 3)
      for (let i = 0; i < (catalog ? 10 : day >= 8 ? 4 : 1); i++)
        if (count(engine.s, "egg") >= 3) engine.prepareEgg();
    engine.open();
    let guard = 0;
    while (engine.s.phase === "open" && guard++ < 3000) {
      const s = engine.s;
      if (s.elapsed >= 360 && !s.closing) engine.close();
      for (const customer of [...s.customers]) {
        if (customer.status === "dirty") engine.clear(customer.id);
        if (customer.status === "checkout") {
          if (engine.checkout(customer.id)) manualCheckouts++;
        }
      }
      while (s.sink) engine.wash();
      const waiting = s.customers.find((c) => c.status === "waiting");
      if (waiting && !cook(waiting)) {
        failed++;
        failures.push({
          day,
          recipe: waiting.recipe,
          comboPart: waiting.combo ? nextPartIndex(waiting) + 1 : null,
          drink: waiting.drink,
          side: waiting.side,
          stock: Object.fromEntries(
            Object.entries(engine.s.inventory).map(([id]) => [
              id,
              count(engine.s, id),
            ]),
          ),
          money: engine.s.money,
        });
        // Let the blocked guest leave through the normal patience rule.
        advance(Math.ceil(waiting.patience) + 1);
      } else {
        if (process.argv.includes("--reload")) {
          if (!validState(engine.s))
            throw new Error(`Invalid save at day ${day}`);
          engine = new Engine(JSON.parse(JSON.stringify(engine.s)));
        }
        advance(1);
      }
      if (s.closing && !s.customers.length && !s.sink) engine.finishClose();
    }
    if (engine.s.phase !== "summary")
      throw new Error(`Day ${day} did not close`);
    days.push({
      day,
      ...engine.s.lastSummary,
      cash: Math.round(engine.s.money),
      reputation: Number(engine.s.reputation.toFixed(2)),
    });
    if (day < totalDays) engine.nextDay();
  }
  return {
    hireCashier,
    startingMoney: catalog ? 250000 : startingMoney,
    failed,
    failures,
    handmadeOrders,
    handmadeServed,
    manualCheckouts,
    comboPartsServed,
    sidesServed,
    sidesOrdered,
    sideAttachFailures,
    drinksServed,
    coldDrinksServed,
    drinkToppingsServed,
    unpaidWages: engine.s.payroll,
    storageLevel: engine.s.upgrades.storage,
    catalog,
    slow,
    recipesServed: [...new Set(days.flatMap((d) => Object.keys(d.sales)))],
    progression: engine.s.progression,
    days,
  };
}

const requestedDays = Number(
  process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1],
);
const totalDays =
  Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 30
    ? requestedDays
    : 7;
const results = [
  run(false, 4000, totalDays),
  run(false, 9500, totalDays),
  run(true, 9500, totalDays),
];
if (process.argv.includes("--json"))
  console.log(JSON.stringify(results, null, 2));
else
  for (const result of results) {
    console.log(
      `${result.hireCashier ? "Mika" : "Chủ quán"} (vốn ¥${result.startingMoney}): ${result.days.reduce((n, d) => n + d.served, 0)} khách, ${result.comboPartsServed} phần combo đã giao, ${result.failed} lượt bị chặn, ${result.handmadeServed}/${result.handmadeOrders} tô handmade đúng, ${result.manualCheckouts} lần thu tay, kho cấp ${result.storageLevel}, lương chờ trả ¥${result.unpaidWages}.`,
    );
    console.table(
      result.days.map(
        ({ day, served, lost, revenue, profit, cash, reputation }) => ({
          day,
          served,
          lost,
          revenue,
          profit: Math.round(profit),
          cash,
          reputation,
        }),
      ),
    );
  }
