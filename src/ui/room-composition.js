import world from "../../layouts/world.json" with { type: "json" };

export function roomBands(scene, height = 844, width = playWidth()) {
  const c = world.composition;
  if (!c.rooms.includes(scene.startsWith("guests") ? "guests" : scene))
    return null;
  const target = [
    ...(height <= c.shortHeight
      ? c.shortTarget
      : c.targetByRoom?.[scene] || c.target),
  ];
  if (height <= c.shortHeight && c.shortWallRooms?.includes(scene))
    target[0] = (c.shortWallInset / height) * 100;
  const core = Math.min(height, width * c.coreAspect);
  const extra = height - core;
  if (extra > 0)
    for (let i = 0; i < target.length; i++)
      target[i] = ((extra + (core * target[i]) / 100) / height) * 100;
  return {
    source: c.sourceByRoom?.[scene] || c.source,
    target,
    extra,
    core,
  };
}
export const playWidth = () =>
  typeof document === "undefined"
    ? 390
    : document.querySelector("#stage")?.clientWidth || window.innerWidth;
export function projectY(scene, y, height = 844) {
  const bands = roomBands(scene, height);
  if (!bands) return y;
  const { source, target } = bands;
  const i = Math.min(
    source.length - 2,
    Math.max(
      0,
      source.findIndex((n, i) => source[i + 1] >= y),
    ),
  );
  return (
    target[i] +
    ((y - source[i]) / (source[i + 1] - source[i])) *
      (target[i + 1] - target[i])
  );
}
export const playHeight = () =>
  typeof document === "undefined"
    ? 844
    : document.querySelector("#stage .scene-world")?.clientHeight ||
      document.querySelector("#stage")?.clientHeight ||
      window.innerHeight;
export function projectBox(scene, b) {
  const h = playHeight(),
    y = projectY(scene, b.y, h);
  return { ...b, y, height: projectY(scene, b.y + b.height, h) - y };
}
export function projectLayer(scene, l) {
  const h = playHeight(),
    a = l.anchor?.[1] || 0;
  return {
    ...l,
    y: projectY(scene, l.y, h),
    height:
      l.id === "owner"
        ? (l.height * (roomBands(scene, h)?.core || h)) / h
        : projectY(scene, l.y + (1 - a) * l.height, h) -
          projectY(scene, l.y - a * l.height, h),
  };
}
