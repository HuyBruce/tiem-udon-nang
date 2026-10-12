import { textVi } from "../i18n.js";
import { noodleTexture } from "../systems/cooking.js";
import balance from "../../config/balance.json" with { type: "json" };

// The visible cue uses the same boundary as the meal's actual texture.
export function cookingStatus(p) {
  const state = noodleTexture(p);
  const remaining = Math.ceil(
    (state === "hard"
      ? p.duration
      : p.duration + balance.cooking.liftWindowSeconds) - p.time,
  );
  const label =
    state === "hard"
      ? `${textVi("t_52e280887b3f")} ${remaining} ${textVi("t_1a86b1e7e56f")}`
      : state === "perfect"
        ? `${textVi("t_bdca01629ba0")} ${remaining} ${textVi("t_5d33e179c35e")}`
        : textVi("t_964140ee6683");
  return { state, label };
}
