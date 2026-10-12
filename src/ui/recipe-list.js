// Lightweight slots retain scroll geometry; only nearby cards own DOM/images.
let cards = new Map(),
  observer = null;
const heights = new Map();
export function recipeList(entries, renderCard) {
  cards = new Map(
    entries.map(([id, recipe], index) => [id, renderCard(id, recipe, index)]),
  );
  return `<div class="recipe-list" data-count="${entries.length}">${entries.map(([id], index) => `<div class="recipe-slot" tabindex="0" role="article" aria-label="${cards.get(id).match(/<h3>(.*?)<\/h3>/)?.[1] || ""}" data-recipe-id="${id}" style="min-height:${heights.get(id) || 260}px">${index < 2 ? cards.get(id) : ""}</div>`).join("")}</div>`;
}
export function observeRecipeList() {
  observer?.disconnect();
  observer = null;
  const root = document.querySelector(
    '.sheet[data-panel="recipes"] .sheet-content',
  );
  if (!root) {
    cards.clear();
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      // Read all mounted heights before changing any card contents.
      const measured = entries.map(({ target, isIntersecting }) => ({
        target,
        isIntersecting,
        height: target.firstElementChild
          ? target.getBoundingClientRect().height
          : 0,
      }));
      for (const { target, isIntersecting, height } of measured) {
        if (height) {
          heights.set(target.dataset.recipeId, height);
          target.style.minHeight = `${height}px`;
        }
        if (isIntersecting) {
          if (!target.firstElementChild)
            target.innerHTML = cards.get(target.dataset.recipeId) || "";
          target.style.minHeight = "0";
        } else if (!target.contains(document.activeElement)) {
          target.replaceChildren();
          target.style.minHeight = `${heights.get(target.dataset.recipeId) || 260}px`;
        }
      }
    },
    { root, rootMargin: "300px 0px" },
  );
  for (const slot of root.querySelectorAll(".recipe-slot"))
    observer.observe(slot);
}
