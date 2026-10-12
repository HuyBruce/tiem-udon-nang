import { textVi } from "../i18n.js";
import { recipeBook, brothFormula, tasteDish, candidate } from "./discovery.js";
import { DRINKS, DECOR } from "../data.js";
import { orderParts } from "./combo.js";
import { sideId, sidePrice } from "./sides.js";
import { requestedDrinkTemperature } from "./drink-temperature.js";
import { drinkToppingPrice } from "./drink-toppings.js";
import balance from "../../config/balance.json" with { type: "json" };
import { noodleSurcharge, noodleGrade } from "./handmade.js";
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const yen = (n) => "¥ " + Math.round(n).toLocaleString("vi-VN");
export const quotedPartTotal = (s, part) =>
  s.prices[part.recipe] +
  (DRINKS[part.drink]?.price || 0) +
  drinkToppingPrice(part) +
  (part.extra ? balance.economy.extraEggPrice : 0) +
  sidePrice(part) +
  noodleSurcharge(part);
export const quotedOrderTotal = (s, c) =>
  orderParts(c).reduce((sum, part) => sum + quotedPartTotal(s, part), 0);
export function setPrice(s, id, value) {
  if (!recipeBook(s)[id] || !Number.isFinite(value)) return false;
  s.prices[id] = clamp(
    Math.round(value / 10) * 10,
    recipeBook(s)[id].price * balance.economy.priceMinRatio,
    recipeBook(s)[id].price * balance.economy.priceMaxRatio,
  );
  return true;
}
export function judge(s, c, dish) {
  const recipe = recipeBook(s)[c.recipe],
    tops = [
      ...recipe.tops.filter((t) => t !== c.omit),
      ...(c.extra ? [c.extra] : []),
    ];
  const same = (a, b) => [...a].sort().join("|") === [...b].sort().join("|");
  const correct =
    (c.freestyle
      ? candidate(s, c, dish).good
      : same(dish.broth, brothFormula(recipe)) &&
        same(dish.tops, tops) &&
        (recipe.kind || "hot") === (dish.method || "hot")) &&
    dish.drink === c.drink &&
    (c.drinkTemperature === undefined ||
      requestedDrinkTemperature(dish) === requestedDrinkTemperature(c)) &&
    !dish.strangeDrink &&
    (dish.drinkTopping || null) === (c.drinkTopping || null) &&
    sideId(dish) === sideId(c) &&
    dish.orderId === c.id &&
    noodleGrade(dish) >= noodleGrade(c);
  const wait = clamp(c.patience / c.maxPatience, 0, 1),
    surcharge = noodleSurcharge(c),
    priceRatio = (s.prices[c.recipe] + surcharge) / (recipe.price + surcharge);
  const score = clamp(
    (correct ? balance.quality.correctBase : balance.quality.wrongBase) +
      wait * balance.quality.wait +
      (dish.quality || 0) * balance.quality.ingredients +
      (dish.cut || 0) * balance.quality.chop +
      tasteDish(c, dish) * balance.quality.taste +
      (dish.noodleTier === "handmade" ? balance.quality.handmade : 0) -
      (dish.texture === "hard"
        ? balance.quality.hardPenalty
        : dish.texture === "soft"
          ? balance.quality.softPenalty
          : 0) -
      Math.max(0, priceRatio - 1) * balance.quality.pricePenalty -
      c.hints * balance.quality.hintPenalty,
    balance.quality.minimum,
    100,
  );
  const bonus = Math.min(
    balance.economy.decorMaxBonus,
    Object.keys(s.decor).reduce(
      (n, k) => n + (DECOR[s.decor[k]]?.bonus || 0),
      0,
    ) +
      Object.values(s.flowerRooms || {}).filter((day) => day > s.day).length *
        balance.economy.flowerBonus +
      s.upgrades.music * balance.upgradeEffects.musicTipPerLevel,
  );
  const total =
    s.prices[c.recipe] +
    (DRINKS[c.drink]?.price || 0) +
    drinkToppingPrice(c) +
    (c.extra ? balance.economy.extraEggPrice : 0) +
    sidePrice(c) +
    (correct && noodleGrade(dish) >= noodleGrade(c) ? surcharge : 0);
  return {
    correct,
    score,
    payment: Math.round(
      total * (correct ? 1 : balance.economy.wrongPaymentRatio),
    ),
    tip: Math.round(
      total *
        balance.economy.baseTipRatio *
        (score / 100) *
        c.tip *
        (c.tricky ? balance.economy.trickyTipMultiplier : 1) *
        (1 + bonus) *
        (correct ? 1 : balance.economy.wrongTipMultiplier),
    ),
    rep: correct
      ? (score >= balance.quality.goodThreshold
          ? balance.economy.goodMealReputation
          : balance.economy.ordinaryMealReputation) +
        (dish.noodleTier === "handmade" &&
        dish.texture === "perfect" &&
        score >= balance.quality.excellentThreshold
          ? balance.economy.handmadeReputationBonus
          : 0)
      : balance.economy.wrongMealReputation,
    review: !correct
      ? c.freestyle
        ? textVi("t_145e4eb0c2d0")
        : textVi("t_88644508ead6")
      : dish.texture === "hard"
        ? textVi("t_3bd5fd2e9e97")
        : dish.texture === "soft"
          ? textVi("t_951e87463b27")
          : priceRatio > balance.economy.priceReviewRatio
            ? textVi("t_8061b25d117c")
            : wait < balance.economy.slowReviewWaitRatio
              ? textVi("t_cabd7d2a833a")
              : c.freestyle && tasteDish(c, dish) >= 1
                ? textVi("t_19881cce69ce")
                : score > 92
                  ? textVi("t_74471ba03392")
                  : textVi("t_dd3a97ee5ac9"),
  };
}
