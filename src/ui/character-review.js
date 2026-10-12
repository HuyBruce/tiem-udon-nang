import { sprite } from "./assets.js";
import strings from "../../data/strings.vi.json" with { type: "json" };

export function characterReview(selected = "") {
  const t = strings.charactersV3;
  const id = ["a", "b", "c"].includes(selected) ? selected : "c";
  return `<main class="game character-review">
    <header><span class="eyebrow">${t.badge}</span><h1>${t.title}</h1><p>${t.description}</p></header>
    <nav aria-label="${t.options}">${["a", "b", "c"].map((key) => `<button data-act="inspect-art" data-arg="${key}" aria-pressed="${key === id}">${sprite(`v3-character-${key}`, t.labels[key])}<b>${key.toUpperCase()}</b></button>`).join("")}</nav>
    <figure><div class="character-light">${sprite(`v3-character-${id}`, t.labels[id])}</div><div class="character-dark">${sprite(`v3-character-${id}`, "")}</div><figcaption>${t.labels[id]}</figcaption></figure>
    <p>${t.note}</p><button class="primary wide" data-act="exit-art">${t.back}</button>
  </main>`;
}
