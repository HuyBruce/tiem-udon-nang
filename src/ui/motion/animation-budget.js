export const ANIMATION_LIMIT = 40;
export function capAnimations(all = document.getAnimations()) {
  const excess = all.length - ANIMATION_LIMIT;
  if (excess <= 0) return [];
  const decorative = all.filter(
    (a) => a.effect?.getTiming().iterations === Infinity,
  );
  const particles = all.filter((a) =>
    a.effect?.target?.closest?.("[data-effect]"),
  );
  // Decorative loops go first, then particles, then oldest remaining UI feedback.
  const canceled = [...new Set([...decorative, ...particles, ...all])].slice(
    0,
    excess,
  );
  for (const a of canceled) a.cancel();
  return canceled;
}
