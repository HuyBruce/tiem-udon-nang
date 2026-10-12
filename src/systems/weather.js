import { SEASONS, EVENTS } from "../data.js";
import balance from "../../config/balance.json" with { type: "json" };
export function forecast(day) {
  const season =
      Math.floor((day - 1) / balance.events.seasonDays) % SEASONS.length,
    local = ((day - 1) % balance.events.cycleDays) + 1;
  const event =
    balance.events.calendar[local] ||
    (day % balance.events.scarcityEvery === 0
      ? "scarcity"
      : day % balance.events.powerEvery === 0
        ? "power"
        : day % balance.events.quietEvery === 0
          ? "quiet"
          : null);
  const weather =
    season === 3 && day % balance.events.snowSkipEveryDays !== 0
      ? "snow"
      : day % balance.events.rainEveryDays === 0
        ? "rain"
        : "sun";
  return {
    season: SEASONS[season],
    weather,
    event,
    demand:
      (weather === "sun" ? 1 : balance.events.badWeatherDemand) *
      (EVENTS[event]?.demand ?? 1),
  };
}
