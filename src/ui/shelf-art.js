import bounds from "../../data/shelf-art.json" with { type: "json" };
import { foodIcon } from "./art.js";
import { sprite } from "./assets.js";

// Fit the painted object, not the transparent square surrounding it.
// Original bitmap files and their aspect ratios stay unchanged.
export function shelfArt(id) {
  const art = bounds[id];
  if (!art) return `<span class="rack-art">${foodIcon(id)}</span>`;
  const [sw, sh] = art.source,
    [x, y, w, h] = art.bounds;
  const style = `width:${(100 * sw) / w}%;height:${(100 * sh) / h}%;left:${(-100 * x) / w}%;top:${(-100 * y) / h}%`;
  return `<span class="rack-art" style="--shelf-ratio:${w / h}"><span class="rack-cutout">${sprite("ingredient-" + id, "", "food-icon", `style="${style}"`)}</span></span>`;
}
