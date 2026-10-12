// Freeze the rendered artwork at pickup size. Shelf images have cropped alpha
// bounds and container sizing; copying their HTML outside the shelf loses both.
export function createDragGhost(source) {
  const art =
    source.querySelector(
      ".rack-cutout,.bowl-art,.work-drink-visual,.work-cup-layers,.drink-art,.pot-sprite,.food-icon,.sprite",
    ) ||
    source.closest(".scene-sprite")?.querySelector(":scope > .sprite") ||
    source;
  const rect = art.getBoundingClientRect();
  const clone = art.cloneNode(true);
  const originals = [art, ...art.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  for (let i = 0; i < originals.length; i++) {
    const style = getComputedStyle(originals[i]);
    for (const property of style)
      copies[i].style.setProperty(property, style.getPropertyValue(property));
    for (const attribute of [...copies[i].attributes])
      if (attribute.name.startsWith("data-") || attribute.name === "id")
        copies[i].removeAttribute(attribute.name);
    copies[i].style.animation = "none";
    copies[i].style.transition = "none";
    copies[i].style.pointerEvents = "none";
    // Optional canvas mode hides the DOM source; the carried copy stays visible.
    copies[i].style.opacity = "1";
  }
  Object.assign(clone.style, {
    position: "absolute",
    inset: "auto",
    left: "0px",
    top: "0px",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    transform: "none",
    translate: "none",
    rotate: "none",
    scale: "none",
  });
  const ghost = document.createElement("div");
  ghost.className = "drag-ghost";
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.append(clone);
  document.body.append(ghost);
  return { ghost, rect };
}
