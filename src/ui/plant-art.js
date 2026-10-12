import { PLANTS } from "../data.js";
import plantArt from "../../data/plant-art.json" with { type: "json" };

export function plantAppearance(plant) {
  if (!plant) return { asset: null, phase: "empty" };
  const art = plantArt[plant.id];
  const days = PLANTS[plant.id]?.days;
  if (!art || !days) return { asset: null, phase: "growing" };
  if (plant.dryDays >= 2) return { asset: art.wilted, phase: "wilted" };
  if (plant.growth >= days) return { asset: art.ripe, phase: "ripe" };
  if (plant.growth >= days / 2) return { asset: art.growing, phase: "growing" };
  return { asset: art.sprout, phase: "sprout" };
}
