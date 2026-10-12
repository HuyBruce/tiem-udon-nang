import { textVi } from "../i18n.js";
import { recipeBook, brothFormula, TASTES } from "./discovery.js";
import balance from "../../config/balance.json" with { type: "json" };
import {
  CUSTOMERS,
  RECIPES,
  DRINKS,
  RIDDLES,
  INGREDIENTS,
  SIDES,
} from "../data.js";
import { availableSides, sideName } from "./sides.js";
import { drinkOrderLabel } from "./drink-temperature.js";
import { availableDrinkToppings } from "./drink-toppings.js";
import { noodleSurcharge, noodleTierLabel } from "./handmade.js";
const ALL_TASTES = [
  "light",
  "rich",
  "vegetable",
  "meat",
  "umami",
  "hot",
  "cold",
  "experimental",
];
const tasteClues = {
  light: textVi("t_3fdc754bb33f"),
  rich: textVi("t_96e53d2b4dc3"),
  vegetable: textVi("t_c6c5adcb4775"),
  meat: textVi("t_d110fc9fb8f3"),
  umami: textVi("t_f8d518016376"),
  hot: textVi("t_3ce1159d8315"),
  cold: textVi("t_1bbb58489916"),
  experimental: textVi("t_4e08ee515207"),
};
const opposite = (a, b) =>
  (a === "hot" && b === "cold") || (a === "cold" && b === "hot");
function roll(s) {
  s.tasteSeed = (Math.imul(s.tasteSeed, 1664525) + 1013904223) >>> 0;
  return s.tasteSeed / 0x100000000;
}
export function chooseTastes(s, personId) {
  const signature = TASTES[personId] || ["hot"];
  const previous = s.lastTastes[personId];
  const familiar = roll(s) < balance.customers.familiarTasteChance;
  const primaryPool = familiar
    ? signature
    : ALL_TASTES.filter((t) => !signature.includes(t));
  const primary = primaryPool[Math.floor(roll(s) * primaryPool.length)];
  const secondaryPool = ALL_TASTES.filter(
    (t) => t !== primary && !opposite(t, primary),
  );
  const fresh = secondaryPool.filter(
    (t) => !previous || ![primary, t].every((x) => previous.includes(x)),
  );
  const pool = fresh.length ? fresh : secondaryPool;
  const secondary = pool[Math.floor(roll(s) * pool.length)];
  const preferences = [primary, secondary];
  s.lastTastes[personId] = preferences;
  return preferences;
}
export function makeCustomer(s, seat) {
  const n = s.serial++,
    vip =
      s.day >= balance.customers.vipDay &&
      s.reputation >= balance.customers.vipReputation &&
      n % balance.customers.vipEvery === 0;
  const person = vip ? CUSTOMERS.at(-1) : CUSTOMERS[(n + s.day - 1) % 6];
  const recipeStride = s.menu.length % 7 === 0 ? 1 : 7;
  const recipe = s.menu[(n * recipeStride) % s.menu.length] || "kake",
    r = recipeBook(s)[recipe];
  const tricky =
      s.day >= 2 &&
      n > 0 &&
      (s.day >= balance.customers.advancedOrderDay
        ? n % balance.customers.advancedTrickyEvery <
          balance.customers.advancedTrickyCount
        : n % balance.customers.initialTrickyEvery === 0),
    omit = tricky && recipe === "beef" ? "onion" : null;
  const extra = s.day > 1 && n % 5 === 2 && s.prepared.egg > 0 ? "egg" : null;
  let drink =
    s.day === 1 && n === 0
      ? null
      : n % 3 === 1
        ? "ramune"
        : s.day >= 2 && n % 3 === 2
          ? "tea"
          : s.day >= 4
            ? "matcha"
            : null;
  if (s.day >= 6 && n % 3 !== 0) {
    const availableDrinks = Object.keys(DRINKS).filter(
      (id) => s.day >= (DRINKS[id].availableFromDay || 1),
    );
    drink = availableDrinks[n % availableDrinks.length];
  }
  const drinkTemperature = drink
    ? DRINKS[drink].temperatureOptions
      ? s.day >= 6 && (n + s.day) % 4 === 0
        ? "cold"
        : "hot"
      : DRINKS[drink].temperature || "hot"
    : null;
  const chooseTopping = (id, temperature, serial) => {
    const options = availableDrinkToppings(id, temperature, s.day);
    return options.length &&
      serial % balance.drinkToppings.orderEveryGuests ===
        balance.drinkToppings.orderOffset
      ? options[
          (Math.floor(serial / Object.keys(DRINKS).length) + s.day) %
            options.length
        ]
      : null;
  };
  const drinkTopping = chooseTopping(drink, drinkTemperature, n);
  const side = s.day >= 4 && n % 5 === 0;
  const sideKind = side
    ? availableSides(s.day)[
        (Math.floor(n / 5) + s.day) % availableSides(s.day).length
      ]
    : null;
  let order = tricky
    ? RIDDLES[recipe] ||
      `${textVi("t_292e2d8cb42e")} ${r.name.toLowerCase()}, ${textVi("t_42ea28b6074c")}`
    : `Cho ${person.id === "ha" ? textVi("t_dd623ecab790") : textVi("t_7b9d6132d968")} ${textVi("t_6676921d64cc")} ${r.name.toLowerCase()} ${textVi("t_a0f7e8be43d4")}`;
  if (tricky && n % 8 === 4)
    order = textVi("t_416e36071599") + order + textVi("t_7ddc824eaad1");
  if (extra) order += textVi("t_f3c16fa373cf");
  if (drink)
    order += ` ${textVi("t_a926b632c247")} ${drinkOrderLabel({ drink, drinkTemperature, drinkTopping }).toLowerCase()}.`;
  if (side)
    order += ` ${textVi("t_9a69a6c5a059")} ${SIDES[sideKind].name.toLowerCase()}.`;
  const freestyle =
    s.day >= balance.customers.freestyleDay &&
    n % balance.customers.freestyleEvery === balance.customers.freestyleOffset;
  if (freestyle)
    order =
      textVi("t_3c0f6117a40e") +
      (drink
        ? ` ${textVi("t_a926b632c247")} ${drinkOrderLabel({ drink, drinkTemperature, drinkTopping })}.`
        : "");
  if (omit) order += textVi("t_e6e08b062a03");
  const visit = s.visits[person.id] || 0;
  const preferences = chooseTastes(s, person.id);
  const noodleTier =
    (s.day >= balance.customers.handmadeOrderDay ||
      s.reputation >= balance.customers.handmadeOrderReputation) &&
    n % balance.customers.handmadeOrderEvery ===
      balance.customers.handmadeOrderOffset
      ? "handmade"
      : s.day >= balance.handmade.premiumOrderDay &&
          n % balance.customers.premiumOrderEvery ===
            balance.customers.premiumOrderOffset
        ? "premium"
        : "regular";
  const combo =
    s.day >= balance.customers.comboUnlockDay &&
    n % balance.customers.comboEveryGuests ===
      balance.customers.comboFirstGuestOffset &&
    !freestyle;
  const secondRecipe = combo
    ? s.menu[(n * recipeStride + 1) % s.menu.length] || recipe
    : null;
  const secondDrink = combo ? (n % 2 ? "tea" : null) : null;
  const secondDrinkTemperature = secondDrink
    ? (n + s.day + 1) % 4 === 0
      ? "cold"
      : "hot"
    : null;
  const secondSide = combo && !side && n % 3 === 2;
  const secondDrinkTopping = chooseTopping(
    secondDrink,
    secondDrinkTemperature,
    n + 1,
  );
  const secondSideKind = secondSide
    ? availableSides(s.day)[
        (Math.floor(n / 3) + s.day) % availableSides(s.day).length
      ]
    : null;
  const parts = combo
    ? [
        {
          recipe,
          omit: freestyle ? null : omit,
          extra: freestyle ? null : extra,
          drink,
          drinkTemperature,
          drinkTopping,
          side: freestyle ? false : side,
          sideKind: freestyle ? null : sideKind,
          noodleTier,
        },
        {
          recipe: secondRecipe,
          omit: null,
          extra: null,
          drink: secondDrink,
          drinkTemperature: secondDrinkTemperature,
          drinkTopping: secondDrinkTopping,
          side: secondSide,
          sideKind: secondSideKind,
          noodleTier: "regular",
        },
      ]
    : null;
  if (combo) {
    if (
      s.day >= balance.customers.largeComboUnlockDay &&
      n % balance.customers.largeComboEvery === 0
    ) {
      const thirdRecipe =
        s.menu[(n * recipeStride + 2) % s.menu.length] || recipe;
      parts.push({
        recipe: thirdRecipe,
        omit: null,
        extra: null,
        drink: "ramune",
        drinkTemperature: "cold",
        drinkTopping: null,
        side: false,
        sideKind: null,
        noodleTier: "regular",
      });
    }
    order =
      `${textVi("t_e5763cc5aaed")} ${parts.length} ${textVi("t_44e956137424")} ` +
      parts
        .map(
          (part, i) =>
            `${textVi("t_8e265778c195")} ${i + 1}: ${recipeBook(s)[part.recipe].name}${part.noodleTier !== "regular" ? ` · ${noodleTierLabel(part)} (+¥${noodleSurcharge(part)})` : ""}${part.omit ? textVi("t_45e8edb4b0af") + INGREDIENTS[part.omit].name.toLowerCase() : ""}${part.extra ? textVi("t_3d94b7eb2642") : ""}${part.drink ? textVi("t_f27ae99201e8") + drinkOrderLabel(part) : ""}${part.side ? textVi("t_0af9121a5b2b") + sideName(part) : ""}.`,
        )
        .join(" ");
  }
  order += ` ${textVi("t_befa48d87cb8")} ${tasteClues[preferences[0]]}.`;
  if (noodleTier !== "regular" && !combo)
    order += ` ${textVi("t_927902811721")} ${noodleTierLabel({ noodleTier }).toLowerCase()} (+¥${noodleSurcharge({ noodleTier })}) ${textVi("t_a0f7e8be43d4")}`;
  const priceRatio = Math.max(
    ...(parts || [{ recipe, noodleTier }]).map((part) => {
      const base = recipeBook(s)[part.recipe].price;
      const extra = noodleSurcharge(part);
      return ((s.prices[part.recipe] || base) + extra) / (base + extra);
    }),
  );
  return {
    ...person,
    id: "c" + n,
    personId: person.id,
    seat,
    recipe,
    omit: freestyle ? null : omit,
    extra: freestyle ? null : extra,
    drink,
    drinkTemperature,
    drinkTopping,
    side: freestyle ? false : side,
    sideKind: freestyle ? null : sideKind,
    order,
    preferences,
    noodleTier,
    ...(combo ? { combo: { parts, delivered: [] } } : {}),
    priceRefusal: priceRatio > balance.customers.leaveAbovePriceRatio,
    tricky,
    freestyle,
    arrivalAt: s.elapsed,
    event: s.forecast.event,
    difficulty: freestyle
      ? "creative"
      : tricky
        ? n % 8 === 4
          ? "long"
          : "riddle"
        : extra || omit
          ? "custom"
          : "direct",
    story:
      person.story[Math.min(person.story.length - 1, Math.floor(visit / 3))],
    status: "waiting",
    patience:
      person.patience +
      balance.customers.extraPatienceSeconds +
      s.upgrades.furniture * balance.upgradeEffects.furniturePatiencePerLevel +
      (combo ? balance.customers.comboPatienceBonus * (parts.length - 1) : 0),
    maxPatience:
      person.patience +
      balance.customers.extraPatienceSeconds +
      s.upgrades.furniture * balance.upgradeEffects.furniturePatiencePerLevel +
      (combo ? balance.customers.comboPatienceBonus * (parts.length - 1) : 0),
    hints: 0,
    accepted: false,
  };
}
export function hint(c, s = {}) {
  const level = Math.max(1, c.hints || 1);
  if (c.combo) {
    if (level === 1)
      return `${c.combo.parts.length} ${textVi("t_7727c186cfed")} ${c.combo.parts.map((part) => recipeBook(s)[part.recipe].name).join(" · ")}.`;
    const detail = (part, index) => {
      const r = recipeBook(s)[part.recipe];
      const toppings = r.tops
        .filter((top) => top !== part.omit)
        .map(
          (top) =>
            INGREDIENTS[top]?.name ||
            (top === "tempura" ? textVi("t_92f428e09bcf") : top),
        );
      if (part.extra) toppings.push(textVi("t_6a6238541c97"));
      return `${textVi("t_8e265778c195")} ${index + 1} ${r.name}: ${toppings.join(", ") || textVi("t_8599dbe2c449")}${part.drink ? `; ${textVi("t_a2a970e1200e")} ${drinkOrderLabel(part)}` : ""}${part.side ? `; ${sideName(part)}` : ""}${part.noodleTier && part.noodleTier !== "regular" ? `; ${noodleTierLabel(part)}` : ""}`;
    };
    const details = c.combo.parts.map(detail).join(". ") + ".";
    if (level === 2) return details;
    const broth = (part) =>
      brothFormula(recipeBook(s)[part.recipe])
        .map((id) => INGREDIENTS[id]?.name || id)
        .join(" + ");
    return `${details} ${textVi("t_4f7e4d50efbd")} ${c.combo.parts.map((part, i) => `${textVi("t_a6519742fd9f")} ${i + 1} ${broth(part)}`).join("; ")}.`;
  }
  if (c.freestyle) {
    if (level === 1)
      return `${textVi("t_befa48d87cb8")} ${tasteClues[c.preferences?.[0]] || textVi("t_ee9067f85839")}.`;
    if (level === 2)
      return `${textVi("t_ae6f058a2eaf")} ${tasteClues[c.preferences?.[0]] || textVi("t_ee9067f85839")}, ${textVi("t_d2e690494f98")} ${tasteClues[c.preferences?.[1]] || textVi("t_3dd837436d32")}.`;
    return `${textVi("t_ae6f058a2eaf")} ${tasteClues[c.preferences?.[0]] || textVi("t_ee9067f85839")} ${textVi("t_befa210d37d1")} ${tasteClues[c.preferences?.[1]] || textVi("t_3dd837436d32")}. ${textVi("t_dcc3a08ba2f5")}${c.drink ? textVi("t_95979b614f1b") + drinkOrderLabel(c) + "." : ""}`;
  }
  const r = recipeBook(s)[c.recipe];
  if (level === 1)
    return `${textVi("t_ceadd959a21e")} ${r.name}; ${textVi("t_4986e84ba4fa")} ${tasteClues[c.preferences?.[0]] || textVi("t_ee9067f85839")}.`;
  const toppings =
    r.tops
      .filter((t) => t !== c.omit)
      .map(
        (t) =>
          ({
            beef: textVi("t_0d0127bd7481"),
            tofu: textVi("t_e55196a0d5da"),
            onion: textVi("t_0e9f8c0d14b4"),
            seaweed: textVi("t_399e46b20e74"),
            tempura: textVi("t_92f428e09bcf"),
          })[t] ||
          INGREDIENTS[t]?.name ||
          t,
      )
      .join(", ") + (c.extra ? textVi("t_c31f400fe23e") : "");
  if (level === 2)
    return `${r.name}: ${toppings || textVi("t_9dcb87cc0cc3")}${c.omit ? textVi("t_d19e08c5979f") : ""}. ${textVi("t_61fabc5d284a")} ${tasteClues[c.preferences?.[1]] || textVi("t_ee9067f85839")}.`;
  return `${r.name}: ${toppings}. ${textVi("t_4f7e4d50efbd")} ${brothFormula(r)
    .map((t) => INGREDIENTS[t]?.name || t)
    .join(
      " + ",
    )}.${c.drink ? textVi("t_95979b614f1b") + drinkOrderLabel(c) + "." : ""}${c.side ? ` ${textVi("t_dd92626f242b")} ${sideName(c).toLowerCase()}.` : ""}`;
}
