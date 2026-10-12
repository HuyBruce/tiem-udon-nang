import { textVi } from "../i18n.js";
import { EMPLOYEES } from "../data.js";
import { count, addStock, consume } from "./inventory.js";
import { recipeBook, brothFormula, sameParts } from "./discovery.js";
import { orderParts, partCustomer } from "./combo.js";
import balance from "../../config/balance.json" with { type: "json" };
import { washCount, washSeconds } from "./washing.js";
export const learnedRecipes = (s, e) =>
  [
    ...new Set([
      "kake",
      ...(e.level >= 2 ? ["beef", "kitsune"] : []),
      ...(e.level >= 3 ? ["miso"] : []),
      ...(e.learned || []),
    ]),
  ].filter((id) => s.unlocked.includes(id));
export const teachingCost = (s, id) =>
  Math.max(
    balance.staff.minimumLearningFee,
    Math.round(
      (recipeBook(s)[id]?.unlock || balance.staff.defaultRecipeValue) *
        balance.staff.recipeFeeRatio,
    ),
  );
export function teachRecipe(id) {
  const s = this.s,
    e = s.employees.yui,
    recipe = recipeBook(s)[id];
  if (
    !e ||
    e.level < 2 ||
    !recipe ||
    !s.unlocked.includes(id) ||
    e.learning ||
    learnedRecipes(s, e).includes(id) ||
    (recipe.kind === "stirfry" && e.level < 3)
  )
    return false;
  const cost = teachingCost(s, id);
  if (s.money < cost) return this.say(textVi("t_21d9d9f79fca"));
  s.money -= cost;
  s.ledger.other += cost;
  e.learning = { recipe: id, remaining: balance.staff.learningSeconds };
  this.say(textVi("t_16120edcfbac"));
  return this.changed();
}
function availablePart(s, customer, learned) {
  return orderParts(customer).findIndex(
    (part, index) =>
      learned.includes(part.recipe) &&
      !customer.combo?.delivered.some((item) => item.index === index) &&
      !s.pots.some(
        (pot) => pot?.orderId === customer.id && (pot.partIndex || 0) === index,
      ) &&
      !s.tray.some(
        (dish) =>
          dish.orderId === customer.id && (dish.partIndex || 0) === index,
      ),
  );
}
export function staffTick(engine, dt) {
  const s = engine.s;
  for (const [id, e] of Object.entries(s.employees)) {
    if (id === "yui" && e.learning) {
      e.learning.remaining = Math.max(0, e.learning.remaining - dt);
      if (e.learning.remaining === 0) {
        const recipe = e.learning.recipe;
        e.learned.push(recipe);
        e.learning = null;
        engine.say(
          `${textVi("t_5ff6514ff3df")} ${recipeBook(s)[recipe].name}!`,
          "ping",
        );
        engine.changed();
      }
    }
    if (id === "yui")
      s.pots.forEach((p, index) => {
        const c = p && s.customers.find((c) => c.id === p.orderId);
        const expected = c && partCustomer(c, p.partIndex || 0);
        if (
          p &&
          expected &&
          !c.freestyle &&
          s.unlocked.includes(expected.recipe) &&
          learnedRecipes(s, e).includes(expected.recipe) &&
          !p.lifted &&
          p.time >= p.duration
        )
          engine.liftNoodles(index);
      });
    e.clock = (e.clock || 0) + dt;
    if (
      e.clock <
      (id === "binh" && s.sink
        ? washSeconds(e.level)
        : balance.staff.actionSeconds[e.level - 1]) *
        (1 - s.upgrades.service * balance.upgradeEffects.serviceSpeedPerLevel)
    )
      continue;
    e.clock = 0;
    if (id === "thu") {
      e.task = s.customers.some((c) => c.status === "dirty")
        ? textVi("t_7d5592771973")
        : textVi("t_13e6a57c9165");
      const c = s.customers.find((c) => !c.accepted && c.status === "waiting");
      if (c) engine.accept(c.id);
      const d = s.customers.find((c) => c.status === "dirty");
      if (d && s.sink < 4) engine.clear(d.id);
    }
    if (id === "mika") e.task = textVi("t_efce4f63e52e");
    if (id === "binh") {
      e.task = s.sink ? textVi("t_85c33412927c") : textVi("t_36eeb117d443");
      if (s.sink) {
        const cleaned = washCount(s.sink);
        s.sink -= cleaned;
        engine.event({ type: "washed", count: cleaned, sound: "wash" });
      }
      if (s.staffOptions.restock && count(s, "noodles") < 4)
        addStock(s, "noodles", balance.staff.restockBundle);
    }
    if (id === "yui") {
      const learned = learnedRecipes(s, e);
      const pending = s.customers
        .map((c) => ({ c, partIndex: availablePart(s, c, learned) }))
        .find(
          ({ c, partIndex }) =>
            c.accepted &&
            c.status === "waiting" &&
            partIndex >= 0 &&
            !c.freestyle,
        );
      const i = s.pots.findIndex((p) => !p);
      e.task = textVi("t_7c04f2654d76");
      if (pending && i >= 0) {
        if (s.burners[i].stage === "boiling") {
          const previousTier = s.noodleTier;
          s.noodleTier = partCustomer(pending.c, pending.partIndex).noodleTier;
          engine.noodles(i, pending.c.id, pending.partIndex);
          s.noodleTier = previousTier;
        } else engine.burnerStep(i);
      }
      s.pots.forEach((p, index) => {
        const customer = p && s.customers.find((c) => c.id === p.orderId);
        const expected = customer && partCustomer(customer, p.partIndex || 0);
        if (!p || !expected || !learned.includes(expected.recipe)) return;
        if (!p.lifted && p.time >= p.duration) engine.liftNoodles(index);
        const recipe = recipeBook(s)[expected.recipe],
          formula = brothFormula(recipe),
          source =
            formula.includes("curry") && s.upgrades.stove ? "curry" : "regular",
          batch = source === "curry" ? s.curryBatch : s.brothBatch;
        if (e.level >= 2 && !p.poured) {
          if (p.lifted && recipe.kind === "cold" && p.method !== "cold")
            engine.finishStyle(index, "cold");
          if (
            batch.servings &&
            sameParts(batch.ingredients, formula) &&
            p.lifted
          )
            engine.pour(index, source);
          else if (batch.stage === "empty" || batch.stage === "mixing") {
            const remaining = [...formula];
            let compatible = true;
            for (const id of batch.ingredients) {
              const found = remaining.indexOf(id);
              if (found < 0) {
                compatible = false;
                break;
              }
              remaining.splice(found, 1);
            }
            if (compatible) {
              if (remaining.length && count(s, remaining[0]))
                engine.brothAdd(remaining[0], source);
              if (sameParts(batch.ingredients, formula))
                engine.brothCook(source);
            }
          }
        }
        if (e.level >= 3 && p.poured) {
          const tops = [
            ...recipe.tops.filter((t) => t !== expected.omit),
            ...(expected.extra ? [expected.extra] : []),
          ];
          const next = tops.find((id) => !p.tops.includes(id));
          if (
            next &&
            (["egg", "tempura"].includes(next)
              ? s.prepared[next]
              : count(s, next))
          )
            engine.topping(index, next);
          if (tops.every((id) => p.tops.includes(id))) {
            if (recipe.kind === "stirfry" && p.method !== "stirfry") {
              if (!p.finishing) engine.finishStyle(index, "stirfry");
            } else if (!p.finishing && s.tray.length < 5) engine.tray(index);
          }
        }
      });
    }
  }
}
export const wages = (s) =>
  Object.entries(s.employees).reduce(
    (sum, [id, e]) =>
      sum +
      Math.round(
        EMPLOYEES[id].wage * (1 + balance.staff.wagePerLevel * (e.level - 1)),
      ),
    0,
  );
