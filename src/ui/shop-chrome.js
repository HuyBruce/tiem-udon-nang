import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { EVENTS } from "../data.js";
import { icon } from "./art.js";
import { esc } from "./panels.js";
import { layoutFor } from "./assets.js";
import { projectBox } from "./room-composition.js";
import { isShopOpen } from "../systems/shop-hours.js";

export function forecastChip(s) {
  const label = labels.weather[s.forecast.weather];
  const detail = EVENTS[s.forecast.event]?.desc || labels.weather.calm;
  return `<span class="hud-forecast" role="img" aria-label="${esc(label + ". " + detail)}" title="${esc(detail)}">${icon(s.forecast.weather, 17)}<span>${label}</span></span>`;
}
export function doorSign(s) {
  const open = isShopOpen(s);
  const l = projectBox("front", layoutFor("front").doorSign);
  const help =
    s.phase === "morning"
      ? labels.shop.tapOpen
      : s.phase === "summary"
        ? labels.shop.summary
        : open
          ? labels.shop.tapClose
          : labels.shop.tapReopen;
  return `<button class="door-sign ${open ? "is-open" : "is-closed"}" data-act="${s.phase === "summary" ? "panel" : "toggle-shop"}" ${s.phase === "summary" ? 'data-arg="summary"' : `aria-pressed="${open}"`} data-open="${open}" aria-label="${esc(help)}" title="${esc(help)}" style="left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%"><span class="door-sign-faces" aria-hidden="true"><span class="door-sign-face door-sign-front">${labels.shop.open}</span><span class="door-sign-face door-sign-back">${labels.shop.closed}</span></span><small>${help}</small></button>`;
}

export function shopOverlays(ui) {
  return `${ui.shopAnnouncement ? `<div class="shop-announcement" role="status" data-motion-key="shop-announcement"><strong>${labels.shop.openingNotice}</strong><small>${labels.shop.openingWelcome}</small></div>` : ""}${ui.lateReminder ? `<aside class="shop-hours-reminder" aria-label="${labels.shop.hoursTitle}"><strong>${labels.shop.lateReminder}</strong><div><button data-act="reminder-close">${labels.shop.tapClose}</button><button data-act="reminder-continue">${labels.shop.continue}</button></div></aside>` : ""}`;
}
