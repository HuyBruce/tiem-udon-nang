import { textVi } from "../i18n.js";
import balance from "../../config/balance.json" with { type: "json" };
import { consume } from "./inventory.js";
import BROTH_INGREDIENTS from "../../data/broth-ingredients.json" with { type: "json" };
export function burnerStep(index) {
  const b = this.s.burners[index];
  if (!b || this.s.pots[index]) return false;
  if (b.stage === "empty") b.stage = "water";
  else if (b.stage === "water") {
    b.stage = "heating";
    b.time = 0;
  } else
    return this.say(
      b.stage === "boiling"
        ? textVi("t_30b1aa2e69a7")
        : textVi("t_014badd57f31"),
    );
  return this.changed();
}
export const noodleTexture = (p) =>
  p.time < p.duration
    ? "hard"
    : p.time > p.duration + balance.cooking.liftWindowSeconds
      ? "soft"
      : "perfect";
export function liftNoodles(index) {
  const p = this.s.pots[index];
  if (!p || p.lifted) return false;
  p.texture = noodleTexture(p);
  p.lifted = true;
  p.stage = "ready";
  this.say(
    {
      hard: textVi("t_1185c2c7f4eb"),
      perfect: textVi("t_c94acb679bc9"),
      soft: textVi("t_ff9a0b5b82f3"),
    }[p.texture],
    "bowl",
  );
  return this.changed();
}
export const emptyBroth = () => ({
  ingredients: [],
  stage: "empty",
  time: 0,
  servings: 0,
  quality: 0,
});
export const brothBatchFor = (s, source = s.brothSource) =>
  source === "curry" ? s.curryBatch : s.brothBatch;
export function selectBroth(source) {
  if (!["regular", "curry"].includes(source)) return false;
  if (source === "curry" && !this.s.upgrades.stove)
    return this.say(textVi("t_0d2d58452bb9"));
  this.s.brothSource = source;
  return this.changed();
}
export function brothAdd(id, source = this.s.brothSource) {
  const b = brothBatchFor(this.s, source);
  if (!BROTH_INGREDIENTS.includes(id)) return false;
  if (b.stage === "cooking") return this.say(textVi("broth_add_cooking"));
  if (b.servings > 0) return this.say(textVi("broth_add_ready"));
  if (
    b.ingredients.filter((part) => part === id).length >=
    balance.cooking.brothMaxPortionsPerIngredient
  )
    return this.say(textVi("broth_add_limit"));
  const used = consume(this.s, [id]);
  if (!used) return this.say(textVi("t_3d39bc635465"));
  b.quality =
    (b.quality * b.ingredients.length + used.quality) /
    (b.ingredients.length + 1);
  b.ingredients.push(id);
  b.stage = "mixing";
  return this.changed();
}
export function brothCook(source = this.s.brothSource) {
  const b = brothBatchFor(this.s, source);
  if (
    b.stage !== "mixing" ||
    b.ingredients.length < balance.cooking.brothMinPortions ||
    (source === "curry" && !b.ingredients.includes("curry"))
  )
    return this.say(textVi("t_0ef532dee0cf"));
  b.stage = "cooking";
  b.time = 0;
  return this.changed();
}
export function brothReset(source = this.s.brothSource) {
  this.s[source === "curry" ? "curryBatch" : "brothBatch"] = emptyBroth();
  this.say(textVi("t_f0f4b0c4f3f3"));
  return this.changed();
}
export function handmadeStep(accuracy = 1) {
  const s = this.s,
    h = s.handmade;
  if (
    s.day < balance.customers.handmadeOrderDay &&
    s.reputation < balance.customers.handmadeOrderReputation
  )
    return this.say(textVi("t_36874c3f11d0"));
  if (!h.stage) {
    if (!consume(s, ["flour", "flour"]))
      return this.say(textVi("t_31a6fd791cda"));
    h.stage = 1;
    h.skill = 0;
  } else {
    h.skill += Math.max(0, Math.min(1, accuracy));
    h.stage++;
    if (h.stage === 5) {
      h.portions += balance.handmade.batchPortions;
      h.xp += Math.max(1, Math.round(h.skill * balance.handmade.xpPerAccuracy));
      h.stage = 0;
      this.say(textVi("t_522725e8c1d7"), "ping");
    }
  }
  return this.changed();
}
export function finishStyle(index, style) {
  const p = this.s.pots[index];
  if (!p?.lifted || !["cold", "stirfry"].includes(style) || p.finishing)
    return false;
  if (style === "cold") {
    if (p.poured || p.method === "stirfry")
      return this.say(textVi("t_00b81f3ff9ba"));
    p.temperature = "cold";
    p.method = "cold";
    this.say(textVi("t_6fa831605219"), "pour");
  } else {
    if (!p.poured || p.method === "stirfry") return false;
    if (!consume(this.s, ["oil"])) return this.say(textVi("t_c886501e0690"));
    p.finishing = true;
    p.panTime = 0;
    this.say(textVi("t_591d3b2e1346"), "fry");
  }
  return this.changed();
}
export const cookingMethods = {
  selectBroth,
  burnerStep,
  liftNoodles,
  brothAdd,
  brothCook,
  brothReset,
  handmadeStep,
  finishStyle,
};
