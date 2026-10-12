import balance from "../../config/balance.json" with { type: "json" };
import { textVi } from "../i18n.js";
import { RECIPES, INGREDIENTS } from "../data.js";
export const recipeBook = (s) => ({ ...RECIPES, ...s.customRecipes });
export const brothFormula = (r) => r.formula || [r.broth[0], ...r.broth];
export const sameParts = (a, b) =>
  [...a].sort().join("|") === [...b].sort().join("|");
import customerTastes from "../../data/customer-tastes.json" with { type: "json" };
export const TASTES = customerTastes;
export function tasteDish(c, d) {
  const tags = new Set(
    d.broth.includes("miso") || d.broth.includes("curry")
      ? ["rich", "umami"]
      : ["light", "umami"],
  );
  tags.add(d.temperature === "cold" ? "cold" : "hot");
  if (d.tops.includes("beef") || d.tops.includes("tempura")) tags.add("meat");
  if (
    d.tops.some((id) => ["tofu", "seaweed", "shiitake", "daikon"].includes(id))
  )
    tags.add("vegetable");
  if (d.broth.includes("yuzu")) tags.add("experimental");
  const preferences = c.preferences?.length
    ? c.preferences
    : TASTES[c.personId] || ["hot"];
  return preferences.filter((x) => tags.has(x)).length / preferences.length;
}
export function candidate(s, c, d) {
  const match = Object.entries(recipeBook(s)).find(
    ([, r]) =>
      sameParts(brothFormula(r), d.broth) &&
      sameParts(r.tops, d.tops) &&
      (r.kind || "hot") === (d.method || "hot"),
  );
  const validBase =
    d.broth.filter((x) => x === "dashi").length >=
      balance.discovery.minimumDashi &&
    d.broth.length >= balance.discovery.minParts &&
    d.broth.length <= balance.discovery.maxParts &&
    d.broth.some((x) => ["soy", "miso"].includes(x));
  const technique =
    d.texture === "soft"
      ? balance.discovery.softTechnique
      : d.texture === "hard"
        ? balance.discovery.hardTechnique
        : balance.discovery.perfectTechnique;
  const score =
    (validBase ? balance.discovery.goodBase : balance.discovery.badBase) +
    Math.min(
      balance.discovery.toppingMaxBonus,
      d.tops.length * balance.discovery.toppingBonus,
    ) +
    tasteDish(c, d) * balance.discovery.tasteBonus +
    technique +
    Math.min(1, d.quality) * balance.discovery.qualityBonus;
  return {
    id: match?.[0],
    recipe: match?.[1],
    score,
    good:
      score >= balance.discovery.threshold &&
      d.tops.length > 0 &&
      d.tops.length <= balance.discovery.maxToppings,
  };
}
export function discover(s, c, d) {
  const result = candidate(s, c, d);
  if (!result.good) return c.freestyle ? textVi("t_1ca7e1b3a70d") : null;
  if (result.id) {
    if (!s.collection.recipes.includes(result.id))
      s.collection.recipes.push(result.id);
    if (
      !s.unlocked.includes(result.id) &&
      !s.pendingRecipes.includes(result.id)
    ) {
      s.pendingRecipes.push(result.id);
      s.discoveries.unshift({
        day: s.day,
        customer: c.name,
        recipe: result.id,
      });
      return `${textVi("t_ee8893ffad2f")} ${result.recipe.name}! ${textVi("t_f1ea337e5128")}`;
    }
  } else if (c.freestyle && !s.discoveryDraft) {
    s.discoveryDraft = {
      broth: [...d.broth],
      tops: [...d.tops],
      method: d.method || "hot",
      customer: c.name,
      day: s.day,
    };
    return `${c.name} ${textVi("t_713a14fd86b4")}`;
  }
  return null;
}
export function estimatedCost(r, s) {
  const servings =
    balance.cooking.brothServings +
    (s?.upgrades.broth ?? 0) * balance.upgradeEffects.brothServingsPerLevel;
  const ingredientCost = (id) => INGREDIENTS[id]?.cost ?? 0;
  // One prepared tempura uses exactly the stock consumed by fryerStep().
  const tempuraCost = ["shrimp", "flour", "oil"].reduce(
    (sum, id) => sum + ingredientCost(id),
    0,
  );
  return Math.ceil(
    ingredientCost("noodles") +
      brothFormula(r).reduce((n, id) => n + ingredientCost(id), 0) / servings +
      r.tops.reduce(
        (n, id) => n + (id === "tempura" ? tempuraCost : ingredientCost(id)),
        0,
      ),
  );
}
