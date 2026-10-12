import { DRINK_TOPPINGS } from "../data.js";
import { requestedDrinkTemperature } from "./drink-temperature.js";

export function toppingFits(id, drink, temperature) {
  const topping = DRINK_TOPPINGS[id];
  return Boolean(
    topping &&
    topping.drinks.includes(drink) &&
    (!topping.temperature || topping.temperature === temperature),
  );
}
export function availableDrinkToppings(drink, temperature, day = Infinity) {
  return Object.keys(DRINK_TOPPINGS).filter(
    (id) =>
      day >= DRINK_TOPPINGS[id].availableFromDay &&
      toppingFits(id, drink, temperature),
  );
}
export const drinkToppingPrice = (part) =>
  part?.drink ? DRINK_TOPPINGS[part.drinkTopping]?.price || 0 : 0;

export function validDrinkTopping(part) {
  const id = part?.drinkTopping;
  return (
    id === undefined ||
    id === null ||
    (typeof id === "string" &&
      toppingFits(id, part.drink, requestedDrinkTemperature(part)))
  );
}
