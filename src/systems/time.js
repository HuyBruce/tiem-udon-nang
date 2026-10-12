import balance from "../../config/balance.json" with { type: "json" };
export const BILLING = balance.billing;
// The suggested closing hour is a reminder, never a clock/admission cutoff.
export const gameMinutes = (s) =>
  s.phase === "morning"
    ? balance.clock.morningMinute
    : balance.clock.openingMinute + s.elapsed * balance.clock.minutesPerSecond;
export const serviceSeconds = () =>
  (balance.traffic.closingHour * 60 - balance.clock.openingMinute) /
  balance.clock.minutesPerSecond;
export function clockText(s) {
  return minutesText(gameMinutes(s));
}
export function minutesText(minutes) {
  const m = Math.floor(minutes);
  return `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function traffic(s) {
  if (s.phase !== "open" || s.closing) return 0;
  const h = (gameMinutes(s) / 60) % 24;
  const base =
    balance.traffic.bands.find((band) => h >= band.hour)?.demand ??
    balance.traffic.morningDemand;
  return base * reviewDemand(s);
}
export function reviewDemand(s) {
  const previous = (s.reviews || []).filter(
    (review) => review.day === s.day - 1,
  );
  if (!previous.length) return 1;
  const average =
    previous.reduce((sum, review) => sum + review.stars, 0) / previous.length;
  return 1 + (average - 3) * balance.customers.reviewDemandPerStar;
}
export const isEvening = (s) => gameMinutes(s) >= balance.clock.eveningMinute;
