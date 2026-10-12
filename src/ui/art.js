import { assetUrl, sceneImage, sprite } from "./assets.js";
import { characterAsset } from "./character-expression.js";
import drinks from "../../data/drinks.json" with { type: "json" };
import drinkToppings from "../../data/drink-toppings.json" with { type: "json" };

export { bowl } from "./food-art.js";

export const icon = (name, size = 24) => {
  const url = assetUrl(`ui-${name}`) || assetUrl("ui-leaf");
  return `<span class="ui-icon" style="width:${size}px;height:${size}px;--ui-icon:url('${url}')" aria-hidden="true"></span>`;
};

export const sceneArt = sceneImage;
// Footer icons use image elements so WebKit can decode them before capture.
export const toolIcon = (name) =>
  `<img class="ui-icon" src="${assetUrl(`ui-${name}`)}" alt="" draggable="false" aria-hidden="true">`;
export const person = (c = {}) =>
  sprite(
    characterAsset(c),
    "",
    "character-art",
    `data-motion-key="actor:${c.id || c.personId || "mai"}"${["thu", "mika"].includes(c.id) ? ` data-motion-actor="${c.id}"` : ""}`,
  );
export const portrait = (c) =>
  '<span class="portrait-art">' + person(c) + "</span>";
export const foodIcon = (id) => sprite("ingredient-" + id, "", "food-icon");
export function drinkArt(id, className = "", temperature, topping) {
  const asset =
    (temperature === "cold" && drinks[id]?.coldAsset) ||
    drinks[id]?.asset ||
    "v2-glass";
  const extra = drinkToppings[topping];
  if (!extra) return sprite(asset, "", `drink-art ${className}`);
  return `<span class="sprite drink-art topped-drink ${className}" role="img" aria-label="${drinks[id].name} + ${extra.name}">${sprite(asset, "", "drink-base")}${sprite(extra.asset, "", `drink-topping ${topping}`)}</span>`;
}
