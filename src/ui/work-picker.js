import { btn, esc } from "./panels.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
export function workPicker(kind, title, options, ui, small = false) {
  const open = ui.workPicker === kind;
  return `<div class="work-picker"><button class="work-picker-toggle" data-act="work-picker" data-arg="${kind}" data-work-${kind} aria-expanded="${open}" aria-haspopup="listbox">${small ? "?" : esc(title)}${small ? `<span class="sr-only">${esc(title)}</span>` : ""}</button>${open ? `<section class="work-picker-popup" aria-label="${esc(title)}"><header><strong>${esc(title)}</strong>${btn(labels.work.closePicker, "work-picker", kind, "work-picker-close")}</header><div role="listbox">${options.map(({ id, label, art = "", selected = false, disabled = false }) => `<button data-act="work-choice" data-arg="${kind}:${id}" data-work-option="${kind}:${id}" role="option" aria-selected="${selected}" ${disabled ? "disabled" : ""}>${art}<span>${esc(label)}</span></button>`).join("")}</div></section>` : ""}</div>`;
}
