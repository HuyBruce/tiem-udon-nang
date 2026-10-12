import presentation from "../../data/drink-presentation.json" with { type: "json" };
import { DRINKS, DRINK_TOPPINGS } from "../data.js";
import { sprite } from "./assets.js";
export function drinkFrame(d) {
  if (!d) return { asset: "gdw-ceramic-0", kind: "ceramic", frame: 0 };
  const p = presentation[d.id];
  if (p.bottle) return { asset: p.bottle, kind: "bottle", frame: d.step };
  const cold = d.temperature === "cold",
    frames = cold ? p.frames : p.glassHot || p.hot;
  const frame = frames
    ? frames[Math.min(d.step, frames.length - 1)]
    : d.step
      ? p.cold
      : 0;
  return {
    asset: `gdw-${cold || p.glassHot ? "glass" : "ceramic"}-${frame}`,
    kind: cold || p.glassHot ? "glass" : "ceramic",
    frame,
  };
}
export function workstationDrink(d) {
  const f = drinkFrame(d),
    t = DRINK_TOPPINGS[d?.topping];
  return `<span class="work-drink-visual" data-vessel-kind="${f.kind}" data-vessel-frame="${f.frame}" data-drink-step="${d?.step || 0}">${sprite(f.asset, "", "drink-base")}${t ? sprite(t.asset, "", "work-drink-topping") : ""}</span>`;
}
