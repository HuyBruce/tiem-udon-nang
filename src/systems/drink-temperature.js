import { textVi } from "../i18n.js";
import { DRINKS, DRINK_TOPPINGS } from "../data.js";

export function requestedDrinkTemperature(part) {
  if (!part?.drink) return null;
  return part.drinkTemperature || DRINKS[part.drink]?.temperature || "hot";
}

export function drinkOrderLabel(part) {
  if (!part?.drink) return "";
  const recipe = DRINKS[part.drink];
  if (!recipe) return "";
  return (
    recipe.name +
    (recipe.temperatureOptions
      ? requestedDrinkTemperature(part) === "cold"
        ? textVi("t_16b42ad8ff13")
        : textVi("t_2063d534f481")
      : "") +
    (DRINK_TOPPINGS[part.drinkTopping]
      ? " + " + DRINK_TOPPINGS[part.drinkTopping].name
      : "")
  );
}
