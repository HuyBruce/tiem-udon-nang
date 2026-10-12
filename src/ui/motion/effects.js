import { capAnimations } from "./animation-budget.js";
export const EFFECT_LIMIT = 12,
  EFFECT_NODE_LIMIT = 24;
const live = [];
let serial = 0,
  hidden = false;
let batch = null;
// Only synchronous, manager-owned feedback is grouped. Other animation producers
// still use the complete native inventory; no polling interval or cap is relaxed.
export function withEffectBatch(run) {
  if (batch) return run();
  batch = document.getAnimations();
  try {
    return run();
  } finally {
    batch = null;
  }
}
function forgetAnimation(animation) {
  const index = batch?.indexOf(animation) ?? -1;
  if (index >= 0) batch.splice(index, 1);
}
const count = (node) =>
  1 + [...node.childNodes].reduce((n, c) => n + count(c), 0);
function remove(entry) {
  const i = live.indexOf(entry);
  if (i < 0) return;
  live.splice(i, 1);
  clearTimeout(entry.timer);
  entry.animations.forEach((a) => {
    a.cancel();
    forgetAnimation(a);
  });
  entry.roots.forEach((n) => n.remove());
}
export function effectStats() {
  for (const e of [...live])
    if (e.roots.every((n) => !n.isConnected)) remove(e);
  return { effects: live.length, nodes: live.reduce((n, e) => n + e.cost, 0) };
}
export function transient(
  node,
  frames,
  options = { duration: 600 },
  type = "particle",
) {
  const cost = count(node);
  if (cost > EFFECT_NODE_LIMIT) return null;
  while (
    live.length >= EFFECT_LIMIT ||
    effectStats().nodes + cost > EFFECT_NODE_LIMIT
  )
    remove(live[0]);
  const entry = { roots: [node], cost, animations: [], timer: 0 };
  live.push(entry);
  node.dataset.effect = type;
  node.dataset.effectId = String(++serial);
  document.body.append(node);
  if (frames) {
    const a = node.animate(frames, options);
    entry.animations.push(a);
    if (batch) batch.push(a);
    for (const canceled of capAnimations(batch || document.getAnimations()))
      forgetAnimation(canceled);
    if (hidden) a.pause();
    a.finished.catch(() => {}).finally(() => remove(entry));
  }
  // Also bounds lifetime if the tab freezes animation clocks or the player cancels it.
  entry.timer = setTimeout(
    () => remove(entry),
    (options.duration || 1800) + (options.delay || 0) + 200,
  );
  return node;
}
export function pauseEffects(value) {
  if (hidden === value) return;
  hidden = value;
  for (const e of live)
    for (const a of e.animations) value ? a.pause() : a.play();
}
export function clearEffects() {
  for (const e of [...live]) remove(e);
}
