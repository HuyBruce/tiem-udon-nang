import { orderParts } from "../systems/combo.js";

export function cookableOrders(s) {
  return s.customers
    .filter((c) => c.accepted && c.status === "waiting")
    .flatMap((c) => orderParts(c).map((part, index) => ({ c, part, index })))
    .filter(
      ({ c, index }) =>
        !c.combo?.delivered.some((p) => p.index === index) &&
        ![...s.pots, ...s.tray].some(
          (dish) => dish?.orderId === c.id && (dish.partIndex || 0) === index,
        ),
    );
}
export function selectNextCookable(engine) {
  const s = engine.s,
    pending = cookableOrders(s);
  if (
    pending.some(
      ({ c, index }) => c.id === s.selectedOrder && index === s.selectedPart,
    )
  )
    return;
  const next = pending[0];
  if (next) engine.selectPart(next.c.id, next.index);
}
