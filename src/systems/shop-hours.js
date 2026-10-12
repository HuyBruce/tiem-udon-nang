import balance from "../../config/balance.json" with { type: "json" };

// Admission and ending the day are separate; both use existing v3 save fields.
export const isShopOpen = (s) => s.phase === "open" && !s.closing;
export const canFinishDay = (s) =>
  s.phase === "open" && s.closing && !s.customers.length && !s.sink;
export const closingReminderDue = (s) =>
  isShopOpen(s) &&
  balance.clock.openingMinute + s.elapsed * balance.clock.minutesPerSecond >=
    balance.traffic.closingHour * 60;
