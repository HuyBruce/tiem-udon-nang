import { INGREDIENTS } from "../data.js";
import { count } from "../systems/inventory.js";
import { shelfArt } from "./shelf-art.js";
import { layoutFor } from "./assets.js";
import { esc } from "./panels.js";
import { projectY, playHeight } from "./room-composition.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };

// Shelf coordinates are measured from the background plate, not the viewport.
export function ingredientRack(scene, state, ui = {}) {
  const rack = layoutFor(scene)?.rack;
  if (!rack) return "";
  return rack.rows
    .map((row, index) => {
      const height = playHeight();
      const top = projectY(scene, row.y - rack.height, playHeight());
      const bottom = projectY(scene, row.y, playHeight());
      const start =
        index === 0
          ? height <= 650
            ? "72px"
            : `max(${top}%, 72px)`
          : height <= 650
            ? `${projectY(scene, rack.rows[index - 1].y, height)}%`
            : `${top}%`;
      return `<div class="ingredient-rack" style="left:${rack.x}%;top:${start};width:${rack.width}%;height:calc(${bottom}% - ${start});--rack-columns:${row.items.length}">${row.items
        .map((id) => {
          if (id === "noodles")
            return '<span class="rack-noodles-space" aria-hidden="true"></span>';
          const quantity = count(state, id);
          const action = !ui.panel
            ? "work-source"
            : scene === "drinks"
              ? "rack-drink"
              : id === "shrimp"
                ? "panel"
                : id === "flour"
                  ? "rack-flour"
                  : ["onion", "beef", "tofu"].includes(id)
                    ? "rack-topping"
                    : "rack-broth";
          const name = INGREDIENTS[id].name;
          const arg = !ui.panel
            ? `ingredient:${id}`
            : scene === "kitchen" && id === "shrimp"
              ? "fryer"
              : id;
          return `<button class="rack-item" data-act="${action}" data-arg="${arg}" ${!ui.panel ? `data-drag="ingredient:${id}"` : ""} aria-label="${esc(name)} · ${quantity}" title="${esc(name)}"><span class="rack-name">${esc(labels.ingredients[id] || name)}</span>${shelfArt(id)}<b class="rack-count">${quantity}</b></button>`;
        })
        .join("")}</div>`;
    })
    .join("");
}
