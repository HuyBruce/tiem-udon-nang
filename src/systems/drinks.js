import { textVi } from "../i18n.js";
import { DRINKS } from "../data.js";
import drinkMethodsData from "../../data/drink-methods.json" with { type: "json" };
import { consume } from "./inventory.js";
import { DRINK_TOPPINGS } from "../data.js";
import { availableDrinkToppings } from "./drink-toppings.js";

export const DRINK_METHODS = drinkMethodsData;

export function drinkStart(id) {
  if (this.s.drink) return this.say(textVi("t_5f4de741338c"));
  if (
    !DRINK_METHODS[id] ||
    !DRINKS[id] ||
    this.s.day < (DRINKS[id].availableFromDay || 1)
  )
    return false;
  this.s.drink = {
    id,
    step: 0,
    quality: 0,
    temperature: DRINKS[id].temperature || "hot",
    strange: false,
    chilled: false,
    topping: null,
  };
  return this.changed();
}

export function drinkChill() {
  const d = this.s.drink;
  if (
    !d ||
    d.strange ||
    !DRINKS[d.id] ||
    d.step < DRINKS[d.id].steps ||
    !DRINKS[d.id].temperatureOptions?.includes("cold") ||
    d.temperature === "cold"
  )
    return false;
  d.temperature = "cold";
  d.chilled = true;
  this.event({ type: "sound", sound: "ice" });
  return this.changed();
}

export function drinkStep(action, skill = 1) {
  const d = this.s.drink;
  if (!d) return false;
  const step = DRINK_METHODS[d.id]?.[d.step];
  if (!step) return false;
  action ??= step.action;
  if (action !== step.action) {
    const wrong = Object.values(DRINK_METHODS)
      .flat()
      .find((x) => x.action === action);
    if (!wrong) return false;
    if (wrong.items && !consume(this.s, wrong.items))
      return this.say(textVi("t_b28354790889"));
    d.strange = true;
    d.step = DRINKS[d.id].steps;
    d.quality = 0;
    this.say(textVi("t_161df798713a"));
  } else {
    if (step.items && !consume(this.s, step.items))
      return this.say(textVi("t_e16a44d0495e"));
    d.step++;
    d.quality = Math.min(
      1,
      d.quality +
        (0.1 + 0.03 * this.s.upgrades.drinks) * Math.max(0, Math.min(1, skill)),
    );
    this.event({
      type: "sound",
      sound:
        step.action === "whisk"
          ? "whisk"
          : step.action === "bottle"
            ? "bottle"
            : step.action === "ice"
              ? "ice"
              : "pour",
    });
  }
  return this.changed();
}

export function drinkTopping(id) {
  const d = this.s.drink;
  if (
    !d ||
    d.strange ||
    d.step < DRINKS[d.id].steps ||
    d.topping ||
    !availableDrinkToppings(d.id, d.temperature, this.s.day).includes(id)
  )
    return false;
  const ingredient = DRINK_TOPPINGS[id].ingredient;
  if (!consume(this.s, [ingredient])) return this.say(textVi("t_0c7832289bd3"));
  d.topping = id;
  this.event({ type: "sound", sound: "pour" });
  return this.changed();
}

export const drinkMethods = { drinkStart, drinkStep, drinkChill, drinkTopping };
