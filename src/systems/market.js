import balance from "../../config/balance.json" with { type: "json" };
import { textVi } from "../i18n.js";
import { INGREDIENTS } from "../data.js";
export function marketOffer(s, id, premium = false, qty = 1) {
  let factor = 1,
    reason = textVi("t_2ee2f5703624");
  if (s.forecast.event === "scarcity" && id === "shrimp") {
    factor = balance.market.scarcityMultiplier;
    reason = textVi("t_cb3d3de89b6e");
  } else if (
    ["rain", "snow"].includes(s.forecast.weather) &&
    ["shrimp", "beef"].includes(id)
  ) {
    factor = balance.market.badWeatherMeatMultiplier;
    reason = textVi("t_ef194bacfad0");
  } else if (s.forecast.event === "harvest" && ["onion", "yuzu"].includes(id)) {
    factor = balance.market.harvestMultiplier;
    reason = textVi("t_065ea3c2bce0");
  } else if (s.day % balance.market.saleEveryDays === 0 && id === "tofu") {
    factor = balance.market.saleMultiplier;
    reason = textVi("t_21343c3e9987");
  }
  return {
    price: Math.ceil(
      (INGREDIENTS[id]?.cost || 0) *
        qty *
        (premium ? balance.market.premiumMultiplier : 1) *
        factor,
    ),
    reason,
    factor,
  };
}
