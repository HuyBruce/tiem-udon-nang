// Coordinates are in viewport widths, independent of phone size and saves.
export const clampOffset = (x, count) => Math.max(0, Math.min(count - 1, x));
export const nearestRoom = (x, count) => Math.round(clampOffset(x, count));
export function visibleRooms(x, count) {
  x = clampOffset(x, count);
  const first = Math.floor(x + 1e-7),
    last = Math.min(count - 1, Math.ceil(x + 1 - 1e-7) - 1);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}
export const snapEase = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
export function swipeTarget(start, delta, velocity, count) {
  // A short, deliberate flick can advance one room; a slow drag snaps nearest.
  const momentum =
    Math.abs(delta) >= 0.08 && Math.abs(velocity) >= 0.45
      ? Math.max(-0.35, Math.min(0.35, velocity * 0.14))
      : 0;
  return nearestRoom(start + delta + momentum, count);
}
export function edgeSpeed(x, rect, margin = 38) {
  if (x < rect.left + margin)
    return -Math.max(
      0.25,
      Math.min(1.1, ((rect.left + margin - x) / margin) * 1.1),
    );
  if (x > rect.right - margin)
    return Math.max(
      0.25,
      Math.min(1.1, ((x - rect.right + margin) / margin) * 1.1),
    );
  return 0;
}
export function worldCoordinates(index, width) {
  return { x: index * width, width };
}
