import { textVi } from "../i18n.js";
import balance from "../../config/balance.json" with { type: "json" };
export const handmadeLevel = (s) =>
  balance.handmade.levelThresholds.filter((xp) => s.handmade.xp >= xp).length;
export const handmadeQuality = (s) =>
  Math.min(
    1,
    balance.handmade.baseQuality +
      handmadeLevel(s) * balance.handmade.qualityPerLevel +
      (s.handmade.skill / 4) * balance.handmade.techniqueQuality,
  );
export const noodleSurcharge = (part) =>
  part.noodleTier === "handmade"
    ? balance.handmade.surcharge
    : part.noodleTier === "premium"
      ? balance.handmade.premiumSurcharge
      : 0;
export const noodleTierLabel = (part) =>
  ({
    regular: textVi("t_5e6b0a5ba040"),
    premium: textVi("t_dd1f10facb65"),
    handmade: textVi("t_092ee8590720"),
  })[part.noodleTier || "regular"];
export const noodleGrade = (part) =>
  ({ regular: 1, premium: 2, handmade: 3 })[part.noodleTier || "regular"];
