import balance from "../../../config/balance.json" with { type: "json" };

export const ENTER_SECONDS = 1.8;
export const LEAVE_SECONDS = 0.7;
const clamp = (x) => Math.max(0, Math.min(1, x));
export function phaseFor(id) {
  let hash = [...String(id)].reduce(
    (n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619) >>> 0,
    2166136261,
  );
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507) >>> 0;
  return (hash / 4294967296) * 6;
}
export const guestMood = (c) =>
  c.happy === false
    ? "disappointed"
    : c.result?.score >= balance.quality.excellentThreshold
      ? "happy"
      : "neutral";
export function guestFrame(c, elapsed, moving, offset = 0) {
  const age = Number.isFinite(c.arrivalAt)
    ? Math.max(0, elapsed - c.arrivalAt)
    : ENTER_SECONDS;
  const direction = c.seat % 2 ? 1 : -1;
  const entering = c.status === "waiting" && age < ENTER_SECONDS;
  const p = clamp(age / ENTER_SECONDS);
  const remaining = clamp(
    ((c.leaveTime ?? LEAVE_SECONDS) - offset) / LEAVE_SECONDS,
  );
  const eating = Math.max(
    0,
    balance.customers.eatSeconds - (c.eatTime ?? 0) + offset,
  );
  const lift = (t) => Math.max(0, Math.sin((t * Math.PI * 2) / 2.8)) ** 2;
  const phase = phaseFor(c.id),
    breath = Math.sin(elapsed * 1.6 + phase);
  const restless = c.status === "waiting" && c.patience / c.maxPatience < 0.25;
  const fidget =
    restless && (elapsed + phase) % 4.8 < 0.8
      ? Math.sin((elapsed + phase) * 18)
      : 0;
  const reactionAge = c.status === "eating" ? eating : Infinity;
  const pulse = reactionAge < 0.7 ? Math.sin((reactionAge / 0.7) * Math.PI) : 0;
  const mood = guestMood(c);
  return {
    phase: !moving
      ? "still"
      : entering
        ? "entering"
        : restless
          ? "restless"
          : c.status,
    x: !moving
      ? 0
      : entering
        ? direction * 1.05 * (1 - p) ** 1.2
        : c.status === "departing"
          ? direction * (1 - remaining)
          : 0,
    bob: !moving
      ? 0
      : entering
        ? -4 * Math.sin(age * Math.PI * 6) * Math.sin(p * Math.PI)
        : c.status === "eating"
          ? Math.sin((eating * Math.PI * 2) / 2.8) * 1.1 -
            (mood === "happy" ? pulse * 5 : 0)
          : breath * 0.8,
    lean: !moving
      ? 0
      : c.status === "waiting"
        ? -1.2 + fidget * 1.6
        : c.status === "eating"
          ? mood === "neutral"
            ? pulse * 2.2
            : mood === "disappointed"
              ? pulse * -2
              : 0
          : 0,
    shift: moving ? fidget * 1.1 : 0,
    scaleY: !moving ? 1 : 1 + breath * 0.004 - (c.happy === false ? 0.01 : 0),
    opacity:
      moving && c.status === "departing"
        ? remaining
        : c.status === "dirty"
          ? 0
          : 1,
    turn: moving && c.status === "departing" ? -1 : 1,
    call: !moving || !entering,
    bowlLift: moving && c.status === "eating" ? lift(eating) : 0,
    drinkLift: moving && c.status === "eating" ? lift(eating - 1.4) : 0,
    reaction: reactionAge < 0.7 ? mood : "idle",
  };
}
export function actorFrame(id, time, state, moving) {
  const mode =
    id === "owner"
      ? state.phase === "open"
        ? "working"
        : "idle"
      : id.startsWith("pet-")
        ? state.pet?.sleeping
          ? "sleeping"
          : "idle"
        : "idle";
  const phase = phaseFor(id),
    breath = Math.sin(time * (mode === "sleeping" ? 0.9 : 1.6) + phase);
  return {
    mode,
    transform: moving
      ? `translateY(${breath * 0.9}px) rotate(${Math.sin(time * 0.7 + phase) * 0.35}deg) scaleY(${1 + breath * 0.005})`
      : "none",
  };
}
