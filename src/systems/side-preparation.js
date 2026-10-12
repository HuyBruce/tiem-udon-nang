import { textVi } from "../i18n.js";
import { SIDES } from "../data.js";
import { consume } from "./inventory.js";
import balance from "../../config/balance.json" with { type: "json" };
export function prepareSide(id) {
  const s = this.s,
    recipe = SIDES[id];
  if (
    !recipe?.preparation ||
    s.sidePrep ||
    s.day < recipe.availableFromDay ||
    s.phase !== "open"
  )
    return this.say(textVi("t_6dd8b9ab4e8f"));
  if (!consume(s, recipe.preparation))
    return this.say(textVi("t_3658bce3de9a"));
  s.sidePrep = { id, step: 0, time: 0, stage: "prep" };
  return this.changed();
}
export function sidePrepStep() {
  const s = this.s,
    p = s.sidePrep;
  if (!p) return false;
  if (p.stage === "cooking") {
    const duration = balance.sidePreparation.cookSeconds[p.id];
    if (p.time < duration) return this.say(textVi("t_79e27fc9af4b"));
    if (p.time > duration + balance.sidePreparation.burnGraceSeconds)
      this.say(textVi("t_42bdbb6e7cb5"));
    else {
      s.prepared[p.id] += balance.sidePreparation.portions;
      this.say(
        `${textVi("t_28b585308322")} ${balance.sidePreparation.portions} ${textVi("t_87a88dd0e56d")} ${SIDES[p.id].shortName}.`,
        "ping",
      );
    }
    s.sidePrep = null;
  } else {
    p.step++;
    this.event({ type: "sound", sound: p.step === 3 ? "fry" : "chop" });
    if (p.step === 3) {
      p.stage = "cooking";
      p.time = 0;
    }
  }
  return this.changed();
}
export function sidePrepTick(dt) {
  const p = this.s.sidePrep;
  if (!p || p.stage !== "cooking") return;
  const duration = balance.sidePreparation.cookSeconds[p.id],
    before = p.time;
  p.time += dt;
  if (before < duration && p.time >= duration)
    this.say(textVi("t_f1219043bcd1"), "ping");
}
export const sidePreparationMethods = {
  prepareSide,
  sidePrepStep,
  sidePrepTick,
};
