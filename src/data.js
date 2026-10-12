// Stable exports retained for save compatibility; content lives in data/*.json.
import INGREDIENTS_DATA from "../data/ingredients.json" with { type: "json" };
import TOPPINGS_DATA from "../data/toppings.json" with { type: "json" };
import SIDES_DATA from "../data/sides.json" with { type: "json" };
import RECIPES_DATA from "../data/recipes.json" with { type: "json" };
import DRINKS_DATA from "../data/drinks.json" with { type: "json" };
import DRINK_TOPPINGS_DATA from "../data/drink-toppings.json" with { type: "json" };
import CUSTOMERS_DATA from "../data/customers.json" with { type: "json" };
import EVENTS_DATA from "../data/events.json" with { type: "json" };
import DECOR_DATA from "../data/decor.json" with { type: "json" };
import EMPLOYEES_DATA from "../data/staff.json" with { type: "json" };
import PLANTS_DATA from "../data/plants.json" with { type: "json" };
import UPGRADES_DATA from "../data/upgrades.json" with { type: "json" };
import RIDDLES_DATA from "../data/riddles.json" with { type: "json" };
import SEASONS_DATA from "../data/seasons.json" with { type: "json" };
import BALANCE from "../config/balance.json" with { type: "json" };
export const INGREDIENTS = Object.fromEntries(
  Object.entries(INGREDIENTS_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.ingredients[id] },
  ]),
);
export const TOPPINGS = TOPPINGS_DATA;
export const SIDES = Object.fromEntries(
  Object.entries(SIDES_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.sides[id] },
  ]),
);
export const RECIPES = Object.fromEntries(
  Object.entries(RECIPES_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.recipes[id] },
  ]),
);
export const DRINKS = Object.fromEntries(
  Object.entries(DRINKS_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.drinks[id] },
  ]),
);
export const DRINK_TOPPINGS = Object.fromEntries(
  Object.entries(DRINK_TOPPINGS_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.drinkToppings[id] },
  ]),
);
export const CUSTOMERS = CUSTOMERS_DATA.map((item) => ({
  ...item,
  ...BALANCE.prices.customers[item.id],
}));
export const EVENTS = EVENTS_DATA;
export const DECOR = Object.fromEntries(
  Object.entries(DECOR_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.decor[id] },
  ]),
);
export const EMPLOYEES = Object.fromEntries(
  Object.entries(EMPLOYEES_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.staff[id] },
  ]),
);
export const PLANTS = Object.fromEntries(
  Object.entries(PLANTS_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.plants[id] },
  ]),
);
export const UPGRADES = Object.fromEntries(
  Object.entries(UPGRADES_DATA).map(([id, item]) => [
    id,
    { ...item, ...BALANCE.prices.upgrades[id] },
  ]),
);
export const RIDDLES = RIDDLES_DATA;
export const SEASONS = SEASONS_DATA;
