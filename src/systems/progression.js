import { textVi } from "../i18n.js";
import balance from "../../config/balance.json" with { type: "json" };
export const neighbourhoodGoal = (s) => [
  [textVi("t_4d27708e2af2"), s.day, balance.progression.minimumDay],
  [textVi("t_22093c504e4b"), s.progression.served, balance.progression.served],
  [
    textVi("t_1d79b8d8240a"),
    s.progression.excellent,
    balance.progression.excellent,
  ],
  [textVi("t_574624ff4e10"), s.unlocked.length, balance.progression.recipes],
  [textVi("t_ede64f794186"), s.reputation, balance.progression.reputation],
];
export function recordMeal(s, result) {
  s.progression.served++;
  if (result.correct && result.score >= balance.quality.excellentThreshold)
    s.progression.excellent++;
  if (
    !s.progression.numberOneDay &&
    neighbourhoodGoal(s).every(([, value, target]) => value >= target)
  ) {
    s.progression.numberOneDay = s.day;
    return textVi("t_6e02b847ce46");
  }
  return null;
}
