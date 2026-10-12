import { migrateState } from "./migration.js";
import { recipeBook } from "./discovery.js";
import { validDrinkTopping } from "./drink-toppings.js";
import { validPet } from "./pets.js";
import BROTH_INGREDIENTS from "../../data/broth-ingredients.json" with { type: "json" };
import balance from "../../config/balance.json" with { type: "json" };
import {
  INGREDIENTS,
  RECIPES,
  DRINKS,
  SIDES,
  UPGRADES,
  EMPLOYEES,
  DECOR,
  PLANTS,
  CUSTOMERS,
  EVENTS,
  SEASONS,
} from "../data.js";
const finite = (x, min = 0, max = 1e12) =>
  typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const strings = (x, allowed, max = 30) =>
  Array.isArray(x) &&
  x.length <= max &&
  x.every((id) => typeof id === "string" && allowed.includes(id));
const ingredientIds = Object.keys(INGREDIENTS),
  recipeIds = Object.keys(RECIPES),
  tops = [...ingredientIds, "tempura"];
const validBroth = (parts) =>
  strings(
    parts,
    BROTH_INGREDIENTS,
    BROTH_INGREDIENTS.length * balance.cooking.brothMaxPortionsPerIngredient,
  ) &&
  BROTH_INGREDIENTS.every(
    (id) =>
      parts.filter((part) => part === id).length <=
      balance.cooking.brothMaxPortionsPerIngredient,
  );
function dish(p) {
  return (
    object(p) &&
    validDrinkTopping(p) &&
    typeof p.orderId === "string" &&
    ["boiling", "ready"].includes(p.stage) &&
    finite(p.time) &&
    finite(p.duration, 1, 60) &&
    validBroth(p.broth) &&
    strings(p.tops, tops, 10) &&
    (p.method === undefined || ["hot", "cold", "stirfry"].includes(p.method)) &&
    (p.partIndex === undefined ||
      (Number.isInteger(p.partIndex) &&
        finite(p.partIndex, 0, balance.customers.largeComboParts - 1))) &&
    (p.panTime === undefined || finite(p.panTime)) &&
    (p.sideKind === undefined ||
      p.sideKind === null ||
      Object.hasOwn(SIDES, p.sideKind)) &&
    (p.drinkTemperature === undefined ||
      p.drinkTemperature === null ||
      ["hot", "cold"].includes(p.drinkTemperature)) &&
    finite(p.quality, 0, 10) &&
    typeof p.poured === "boolean"
  );
}
export function validState(input) {
  try {
    return checkState(migrateState(input));
  } catch {
    return false;
  }
}
function checkState(s) {
  const recipes = recipeBook(s || {}),
    recipeIds = Object.keys(recipes);
  if (
    JSON.stringify(s)?.includes("<") ||
    JSON.stringify(s)?.includes("__proto__")
  )
    return false;
  if (
    !object(s) ||
    s.version !== 3 ||
    !Number.isInteger(s.day) ||
    s.day < 1 ||
    !finite(s.money) ||
    !finite(s.reputation, 0, 100) ||
    !validPet(s.pet, s.day) ||
    !object(s.progression) ||
    !Number.isInteger(s.progression.served) ||
    !finite(s.progression.served) ||
    !Number.isInteger(s.progression.excellent) ||
    !finite(s.progression.excellent, 0, s.progression.served) ||
    (s.progression.numberOneDay !== null &&
      (!Number.isInteger(s.progression.numberOneDay) ||
        !finite(s.progression.numberOneDay, 1, s.day))) ||
    !["morning", "open", "summary"].includes(s.phase) ||
    !finite(s.elapsed) ||
    !finite(s.duration, 300, 480)
  )
    return false;
  if (
    !object(s.inventory) ||
    !Object.entries(s.inventory).every(
      ([id, batches]) =>
        ingredientIds.includes(id) &&
        Array.isArray(batches) &&
        batches.length < 1000 &&
        batches.every(
          (b) =>
            object(b) &&
            Number.isInteger(b.qty) &&
            b.qty > 0 &&
            b.qty <= 1000 &&
            finite(b.expires, 1) &&
            finite(b.unitCost) &&
            typeof b.premium === "boolean",
        ),
    )
  )
    return false;
  if (
    !object(s.upgrades) ||
    !Object.entries(UPGRADES).every(
      ([id, u]) =>
        Number.isInteger(s.upgrades[id]) && finite(s.upgrades[id], 0, u.max),
    )
  )
    return false;
  if (
    !strings(s.unlocked, recipeIds, 60) ||
    !strings(s.menu, s.unlocked, 60) ||
    !s.menu.length ||
    !object(s.prices) ||
    !recipeIds.every((id) =>
      finite(s.prices[id], recipes[id].price * 0.6, recipes[id].price * 2),
    )
  )
    return false;
  if (
    !Array.isArray(s.pots) ||
    s.pots.length !== s.upgrades.stove + 1 ||
    !s.pots.every((p) => p === null || dish(p))
  )
    return false;
  if (
    !Array.isArray(s.tray) ||
    s.tray.length > 5 ||
    !s.tray.every(
      (d) =>
        dish(d) &&
        /^dish\d+$/.test(d.id) &&
        (d.drink === null || Object.hasOwn(DRINKS, d.drink)),
    )
  )
    return false;
  if (
    !Array.isArray(s.customers) ||
    s.customers.length > 8 ||
    !s.customers.every(
      (c) =>
        object(c) &&
        /^c\d+$/.test(c.id) &&
        CUSTOMERS.some((p) => p.id === c.personId && p.name === c.name) &&
        /^#[0-9a-f]{6}$/i.test(c.color) &&
        /^#[0-9a-f]{6}$/i.test(c.hair) &&
        typeof c.name === "string" &&
        Object.hasOwn(recipes, c.recipe) &&
        ["waiting", "eating", "checkout", "departing", "dirty"].includes(
          c.status,
        ) &&
        (c.status !== "checkout" || finite(c.checkoutTime, 0, 8)) &&
        finite(c.patience, 0, 1000) &&
        finite(c.maxPatience, 1, 1000) &&
        Number.isInteger(c.seat) &&
        finite(c.seat, 0, 7) &&
        typeof c.order === "string" &&
        validDrinkTopping(c) &&
        (c.sideKind === undefined ||
          c.sideKind === null ||
          Object.hasOwn(SIDES, c.sideKind)) &&
        (c.drinkTemperature === undefined ||
          c.drinkTemperature === null ||
          ["hot", "cold"].includes(c.drinkTemperature)) &&
        typeof c.story === "string",
    )
  )
    return false;
  if (
    !object(s.employees) ||
    !Object.entries(s.employees).every(
      ([id, e]) =>
        Object.hasOwn(EMPLOYEES, id) &&
        object(e) &&
        Number.isInteger(e.level) &&
        finite(e.level, 1, 3) &&
        finite(e.relationship) &&
        strings(e.learned, s.unlocked, 60) &&
        new Set(e.learned).size === e.learned.length &&
        (e.learning === null ||
          (object(e.learning) &&
            s.unlocked.includes(e.learning.recipe) &&
            !e.learned.includes(e.learning.recipe) &&
            finite(e.learning.remaining, 0, balance.staff.learningSeconds))),
    )
  )
    return false;
  if (
    !object(s.decor) ||
    !Object.values(s.decor).every((id) => Object.hasOwn(DECOR, id)) ||
    !strings(s.ownedDecor, Object.keys(DECOR))
  )
    return false;
  if (
    !Array.isArray(s.plots) ||
    s.plots.length !== s.upgrades.garden + 1 ||
    !s.plots.every(
      (p) =>
        p === null ||
        (object(p) &&
          Object.hasOwn(PLANTS, p.id) &&
          finite(p.growth) &&
          typeof p.watered === "boolean"),
    )
  )
    return false;
  if (
    !object(s.ledger) ||
    ![
      "revenue",
      "tips",
      "ingredients",
      "purchases",
      "wages",
      "other",
      "served",
      "lost",
      "satisfaction",
      "startRep",
    ].every((k) => finite(s.ledger[k])) ||
    !object(s.ledger.sales) ||
    !Object.entries(s.ledger.sales).every(
      ([id, n]) => recipeIds.includes(id) && finite(n),
    )
  )
    return false;
  if (
    !object(s.settings) ||
    !["music", "sfx", "haptic", "animation", "performance", "contrast"].every(
      (k) => typeof s.settings[k] === "boolean",
    ) ||
    !["normal", "large"].includes(s.settings.font) ||
    !["normal", "slow"].includes(s.settings.dialogue) ||
    s.settings.language !== "vi"
  )
    return false;
  if (
    !object(s.collection) ||
    !strings(
      s.collection.customers,
      CUSTOMERS.map((c) => c.id),
      150,
    ) ||
    !strings(s.collection.recipes, recipeIds, 60) ||
    !strings(s.collection.ingredients, tops) ||
    !strings(s.collection.plants, Object.keys(PLANTS)) ||
    !object(s.visits) ||
    !Number.isInteger(s.tasteSeed) ||
    !finite(s.tasteSeed, 0, 0xffffffff) ||
    !object(s.lastTastes) ||
    !Object.entries(s.lastTastes).every(
      ([id, tastes]) =>
        CUSTOMERS.some((c) => c.id === id) &&
        strings(
          tastes,
          [
            "light",
            "rich",
            "vegetable",
            "meat",
            "umami",
            "hot",
            "cold",
            "experimental",
          ],
          2,
        ),
    ) ||
    !Array.isArray(s.reviews) ||
    s.reviews.length > 25 ||
    !s.reviews.every(
      (r) =>
        object(r) &&
        typeof r.name === "string" &&
        typeof r.text === "string" &&
        Number.isInteger(r.stars) &&
        finite(r.stars, 1, 5),
    )
  )
    return false;
  if (
    !object(s.prepared) ||
    !finite(s.prepared.egg) ||
    !finite(s.prepared.tempura) ||
    !["karaage", "gyoza", "tamagoyaki"].every(
      (id) => Number.isInteger(s.prepared[id]) && finite(s.prepared[id]),
    ) ||
    !finite(s.sink, 0, 4) ||
    !Array.isArray(s.fryer) ||
    !s.fryer.every(
      (f) =>
        object(f) &&
        ["raw", "battered", "frying"].includes(f.stage) &&
        finite(f.time),
    )
  )
    return false;
  if (
    s.sidePrep !== null &&
    (!object(s.sidePrep) ||
      !SIDES[s.sidePrep.id]?.preparation ||
      !["prep", "cooking"].includes(s.sidePrep.stage) ||
      !Number.isInteger(s.sidePrep.step) ||
      !finite(s.sidePrep.step, 0, 3) ||
      !finite(s.sidePrep.time))
  )
    return false;
  if (
    s.drink !== null &&
    (!object(s.drink) ||
      !Object.hasOwn(DRINKS, s.drink.id) ||
      !validDrinkTopping({
        drink: s.drink.id,
        drinkTemperature: s.drink.temperature,
        drinkTopping: s.drink.topping,
      }) ||
      (s.drink.topping != null &&
        (s.drink.strange || s.drink.step < DRINKS[s.drink.id].steps)) ||
      !finite(s.drink.step, 0, 8) ||
      (s.drink.temperature !== undefined &&
        !["hot", "cold"].includes(s.drink.temperature)) ||
      (s.drink.chilled !== undefined && typeof s.drink.chilled !== "boolean"))
  )
    return false;
  if (
    !object(s.customRecipes) ||
    Object.keys(s.customRecipes).length > 30 ||
    !Object.entries(s.customRecipes).every(
      ([id, r]) =>
        /^custom\d+$/.test(id) &&
        object(r) &&
        typeof r.name === "string" &&
        r.name.length > 0 &&
        r.name.length <= 45 &&
        typeof r.desc === "string" &&
        typeof r.jp === "string" &&
        finite(r.price, 100, 2000) &&
        validBroth(r.broth) &&
        validBroth(r.formula) &&
        strings(r.tops, tops, 4),
    )
  )
    return false;
  if (
    !strings(s.pendingRecipes, recipeIds, 40) ||
    !Array.isArray(s.discoveries) ||
    s.discoveries.length > 100 ||
    !s.discoveries.every(
      (d) =>
        object(d) &&
        recipeIds.includes(d.recipe) &&
        typeof d.customer === "string" &&
        finite(d.day),
    )
  )
    return false;
  if (
    s.discoveryDraft !== null &&
    (!object(s.discoveryDraft) ||
      !validBroth(s.discoveryDraft.broth) ||
      !strings(s.discoveryDraft.tops, tops, 4) ||
      typeof s.discoveryDraft.customer !== "string")
  )
    return false;
  if (
    !Array.isArray(s.burners) ||
    s.burners.length !== s.pots.length ||
    !s.burners.every(
      (b) =>
        object(b) &&
        ["empty", "water", "heating", "boiling"].includes(b.stage) &&
        finite(b.time),
    )
  )
    return false;
  if (!["regular", "curry"].includes(s.brothSource)) return false;
  for (const b of [s.brothBatch, s.curryBatch]) {
    if (
      !object(b) ||
      !validBroth(b.ingredients) ||
      !["empty", "mixing", "cooking", "ready"].includes(b.stage) ||
      !finite(b.time) ||
      !Number.isInteger(b.servings) ||
      !finite(
        b.servings,
        0,
        balance.cooking.brothServings +
          s.upgrades.broth * balance.upgradeEffects.brothServingsPerLevel,
      ) ||
      !finite(b.quality, 0, 1)
    )
      return false;
  }
  if (
    typeof s.closing !== "boolean" ||
    !finite(s.payroll) ||
    !finite(s.debt) ||
    !finite(s.bouquets) ||
    !object(s.handmade) ||
    !finite(s.handmade.portions) ||
    !finite(s.handmade.stage, 0, 4) ||
    !finite(s.handmade.skill, 0, 4) ||
    !Number.isInteger(s.handmade.xp) ||
    !finite(s.handmade.xp) ||
    !["regular", "premium", "handmade"].includes(s.noodleTier) ||
    !Number.isInteger(s.selectedPart) ||
    !finite(s.selectedPart, 0, balance.customers.largeComboParts - 1) ||
    !object(s.flowerRooms) ||
    !Object.entries(s.flowerRooms).every(
      ([room, day]) =>
        ["front", "guests", "drinks"].includes(room) && finite(day),
    ) ||
    !finite(s.settings.musicVolume, 0, 1) ||
    !finite(s.settings.sfxVolume, 0, 1)
  )
    return false;
  if (
    !s.customers.every(
      (c) =>
        (!c.meal || dish(c.meal)) &&
        (!c.combo ||
          (object(c.combo) &&
            Array.isArray(c.combo.parts) &&
            c.combo.parts.length >= 2 &&
            c.combo.parts.length <= balance.customers.largeComboParts &&
            c.combo.parts.every(
              (part) =>
                object(part) &&
                validDrinkTopping(part) &&
                Object.hasOwn(recipes, part.recipe) &&
                (part.drink === null || Object.hasOwn(DRINKS, part.drink)) &&
                typeof part.side === "boolean" &&
                (part.sideKind === undefined ||
                  part.sideKind === null ||
                  Object.hasOwn(SIDES, part.sideKind)) &&
                (part.drinkTemperature === undefined ||
                  part.drinkTemperature === null ||
                  ["hot", "cold"].includes(part.drinkTemperature)) &&
                ["regular", "premium", "handmade"].includes(part.noodleTier) &&
                (part.omit === null || tops.includes(part.omit)) &&
                (part.extra === null || tops.includes(part.extra)),
            ) &&
            Array.isArray(c.combo.delivered) &&
            c.combo.delivered.length <= c.combo.parts.length &&
            new Set(c.combo.delivered.map((item) => item.index)).size ===
              c.combo.delivered.length &&
            c.combo.delivered.every(
              (item) =>
                object(item) &&
                Number.isInteger(item.index) &&
                finite(item.index, 0, c.combo.parts.length - 1) &&
                dish(item.dish) &&
                object(item.result) &&
                typeof item.result.correct === "boolean" &&
                finite(item.result.score, 0, 100) &&
                finite(item.result.payment) &&
                finite(item.result.tip) &&
                finite(item.result.rep, -10, 10) &&
                typeof item.result.review === "string",
            ))) &&
        finite(c.hints, 0, 3) &&
        (c.preferences === undefined ||
          strings(
            c.preferences,
            [
              "light",
              "rich",
              "vegetable",
              "meat",
              "umami",
              "hot",
              "cold",
              "experimental",
            ],
            2,
          )) &&
        typeof c.accepted === "boolean" &&
        ["regular", "premium", "handmade"].includes(c.noodleTier) &&
        (c.drink === null || Object.hasOwn(DRINKS, c.drink)) &&
        (!c.result ||
          (object(c.result) &&
            typeof c.result.correct === "boolean" &&
            finite(c.result.score, 0, 100) &&
            finite(c.result.payment) &&
            finite(c.result.tip) &&
            finite(c.result.rep, -10, 10) &&
            typeof c.result.review === "string")),
    )
  )
    return false;
  if (!Number.isInteger(s.sink)) return false;
  return (
    object(s.forecast) &&
    SEASONS.includes(s.forecast.season) &&
    (s.forecast.event === null || Object.hasOwn(EVENTS, s.forecast.event)) &&
    ["sun", "rain", "snow"].includes(s.forecast.weather) &&
    finite(s.forecast.demand, 0.1, 3) &&
    finite(s.serial) &&
    finite(s.nextArrival)
  );
}
