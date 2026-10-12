import { textVi } from "../i18n.js";
import { sprite, layoutFor, layerStyle } from "./assets.js";
import text from "../../data/strings.vi.json" with { type: "json" };

export function previewV2(selected = "") {
  const t = text.previewV2;
  const layout = layoutFor("art-preview-v2");
  const layers = layout.layers
    .map((l) => {
      const art = sprite(l.asset, l.id === "guest" ? "Anh An" : "");
      return l.touch
        ? `<button class="v2-${l.id}" style="${layerStyle(l)}" data-act="${l.touch.action}" data-arg="${l.touch.arg}" aria-label="${textVi("t_b207c116f0c9")}">${art}${selected === l.touch.arg ? '<span class="v2-reaction">?</span>' : ""}</button>`
        : `<div class="v2-${l.id}" style="${layerStyle(l)}" aria-hidden="true">${art}</div>`;
    })
    .join("");
  const panel = ["v2-book", "v2-shop", "v2-journal"].includes(selected);
  return `<main class="game v2-review">
    <div class="v2-room">${layers}
      <header class="v2-hud"><span><b>${textVi("t_2cbd29333cdb")}</b><small>${textVi("t_1d3335ccd339")}</small></span><span><b>¥ 2.400</b><small>${textVi("t_03dc7ee35a07")}</small></span><button data-act="exit-art" aria-label="${textVi("t_25782bc6384c")}">${textVi("t_8db71ed28b0f")}</button></header>
      <div class="v2-room-title"><span>${t.badge}</span><h1>${t.title}</h1></div>
      <button class="v2-order" style="${layerStyle(layout.order)}" data-act="inspect-art" data-arg="v2-order">${textVi("t_1e544c2cd71f")}<small>${textVi("t_8af4cea5fd7d")}</small></button>
      <div class="v2-tray" style="${layerStyle(layout.tray)}" aria-label="${textVi("t_8235a49a39ab")}">${Array.from({ length: 5 }, (_, i) => `<span>${i + 1}</span>`).join("")}</div>
      <div class="v2-scene-note" style="${layerStyle(layout.note)}" role="status">${selected === "v2-order" ? t.order : selected === "v2-an" ? t.guest : t.hint}</div>
    </div>
    <footer class="v2-footer"><button data-act="inspect-art" data-arg="v2-book">${textVi("t_e78b18efe06e")}</button><button data-act="inspect-art" data-arg="v2-shop">${textVi("t_268a8440c1fe")}</button><button data-act="inspect-art" data-arg="v2-journal">${textVi("t_bf67e341ddef")}</button></footer>
    ${panel ? previewPanel(selected) : ""}
  </main>`;
}

function previewPanel(selected) {
  const title =
    selected === "v2-book"
      ? textVi("t_e78b18efe06e")
      : selected === "v2-shop"
        ? textVi("t_3d8d12e3db7f")
        : textVi("t_bf67e341ddef");
  const content =
    selected === "v2-journal"
      ? `<article class="v2-journal-entry">${sprite("v2-an", "Anh An")}<div><h3>Anh An</h3><p>${textVi("t_0b8de87b1329")}</p><progress value="1" max="6" aria-label="${textVi("t_d72f1221d098")}"></progress><small>${textVi("t_13b6367f962c")}</small></div></article>`
      : selected === "v2-book"
        ? textVi("t_7ca3c4646797")
        : textVi("t_7df6a2c81019");
  return `<section class="v2-sample-sheet" aria-label="${title}"><button class="v2-close" data-act="inspect-art" data-arg="" aria-label="${textVi("t_8675c58727f8")}">${textVi("t_8db71ed28b0f")}</button>${selected === "v2-shop" ? '<div class="v2-awning"></div>' : ""}<h2>${title}</h2>${content}</section>`;
}
