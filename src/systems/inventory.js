import balance from "../../config/balance.json" with { type: "json" };
import { marketOffer } from "./market.js";
import { INGREDIENTS } from "../data.js";
export const count = (s, id, premium = null) =>
  (s.inventory[id] || []).reduce(
    (a, b) =>
      a +
      (b.expires > s.day && (premium === null || b.premium === premium)
        ? b.qty
        : 0),
    0,
  );
export const stockSize = (s) =>
  Object.keys(s.inventory).filter((id) =>
    s.inventory[id].some((b) => b.qty > 0),
  ).length;
export const capacity = (s) =>
  balance.inventory.slots +
  s.upgrades.storage * balance.inventory.slotsPerLevel;
export function addStock(s, id, qty, premium = false, free = false) {
  const item = INGREDIENTS[id];
  if (
    !item ||
    !Number.isInteger(qty) ||
    qty <= 0 ||
    qty > 1000 ||
    (!s.inventory[id]?.length && stockSize(s) >= capacity(s))
  )
    return false;
  const price = free ? 0 : marketOffer(s, id, premium, qty).price;
  if (s.money < price) return false;
  s.money -= price;
  s.ledger.purchases += price;
  (s.inventory[id] ??= []).push({
    qty,
    expires:
      s.day +
      item.life +
      (item.kind === "cold"
        ? s.upgrades.fridge * balance.inventory.fridgeExtraDays
        : 0),
    premium,
    unitCost: free ? 0 : price / qty,
  });
  s.inventory[id].sort((a, b) => a.expires - b.expires);
  return true;
}
export function consume(s, ids, { premium = null } = {}) {
  const needed = {};
  ids.forEach((id) => (needed[id] = (needed[id] || 0) + 1));
  if (Object.entries(needed).some(([id, n]) => count(s, id, premium) < n))
    return null;
  expire(s);
  let quality = 0,
    cost = 0;
  for (const id of ids) {
    const index = s.inventory[id].findIndex(
      (b) => premium === null || b.premium === premium,
    );
    const b = s.inventory[id][index];
    quality += b.premium ? 1 : 0;
    cost += b.unitCost;
    b.qty--;
    if (!b.qty) s.inventory[id].splice(index, 1);
  }
  s.ledger.ingredients += cost;
  return { quality: ids.length ? quality / ids.length : 0, cost };
}
export function expire(s) {
  let lost = 0;
  for (const id of Object.keys(s.inventory))
    s.inventory[id] = s.inventory[id].filter((b) => {
      if (b.expires <= s.day) {
        lost += b.qty;
        return false;
      }
      return true;
    });
  return lost;
}
