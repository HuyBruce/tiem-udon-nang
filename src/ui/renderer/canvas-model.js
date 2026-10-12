// Geometry in CSS pixels; the canvas buffer retains the actual device DPR.
export function fitImage(box, natural, fit = "contain", position = [0.5, 0.5]) {
  if (fit === "fill") return { ...box };
  const scale = (fit === "cover" ? Math.max : Math.min)(
    box.width / natural.width,
    box.height / natural.height,
  );
  const width = natural.width * scale,
    height = natural.height * scale;
  return {
    x: box.x + (box.width - width) * position[0],
    y: box.y + (box.height - height) * position[1],
    width,
    height,
  };
}
export function stackingOrder(a, b) {
  for (let i = 0; i < Math.max(a.stack.length, b.stack.length); i++) {
    const delta = (a.stack[i] || 0) - (b.stack[i] || 0);
    if (delta) return delta;
  }
  return a.order - b.order;
}
export function overlaps(a, b) {
  return (
    a.x + a.width > b.x &&
    a.x < b.x + b.width &&
    a.y + a.height > b.y &&
    a.y < b.y + b.height
  );
}
