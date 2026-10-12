import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { projectY, playHeight } from "./room-composition.js";
import balance from "../../config/balance.json" with { type: "json" };
import strings from "../../data/strings.vi.json" with { type: "json" };
import { textVi } from "../i18n.js";
import { SIDES, DRINKS } from "../data.js";
import { sideId } from "../systems/sides.js";
import { deliveredCount } from "../systems/combo.js";
import { bowl, drinkArt, person } from "./art.js";
import { sprite, layoutFor } from "./assets.js";
import { btn, esc } from "./panels.js";
import { petScene } from "./pets.js";

export {
  ENTER_SECONDS,
  LEAVE_SECONDS,
  guestFrame,
  guestMood,
} from "./motion/model.js";
import { guestFrame, guestMood } from "./motion/model.js";

function feedback(c) {
  if (c.status === "checkout") return textVi("t_1257af06db18");
  if (c.status === "departing")
    return c.happy ? textVi("t_8772062e251d") : textVi("t_2a17d233a1cd");
  if (c.result?.correct === false) return textVi("t_79c840e8ba6e");
  return c.result?.score >= 90
    ? textVi("t_71495911f6d8")
    : textVi("t_c860135b4d9c");
}
export function servedComboArt(dish, bowlColor = "") {
  const hot = dish.temperature !== "cold";
  const hotDrink =
    dish.drink &&
    (dish.drinkTemperature || DRINKS[dish.drink]?.temperature) !== "cold";
  return `<span class="combo-served-part guest-meal-part" data-meal="${esc(dish.id || "meal")}" data-motion-key="meal:${esc(dish.id || "meal")}" data-temperature="${hot ? "hot" : "cold"}">${bowl(dish, bowlColor)}${hot ? sprite("kitchen-steam", "", "guest-meal-steam") : ""}${dish.drink ? `<span class="guest-drink">${drinkArt(dish.drink, "combo-drink", dish.drinkTemperature, dish.drinkTopping)}${hotDrink ? sprite("kitchen-steam", "", "guest-drink-steam") : ""}</span>` : ""}${dish.side ? `<span class="combo-side" data-side="${sideId(dish)}">${sprite("tray-saucer", "", "side-plate")}${sprite(SIDES[sideId(dish)].art, "", "side-food")}</span>` : ""}</span>`;
}
function guestSeat(s, scene, index, i, moving) {
  const seat = index * 2 + i;
  const c = s.customers.find((customer) => customer.seat === seat);
  const b = layoutFor(scene).seats[i];
  const place = `class="customer-place seat-${i}" data-seat="${seat}" ${c ? `data-guest="${c.id}"` : ""} style="left:${b.x}%;top:${projectY(scene, b.y, playHeight())}%;width:${b.width}%;height:${b.height}%;--guest-height:${((projectY(scene, 42, playHeight()) - projectY(scene, b.y, playHeight())) / b.height) * 100}%"`;
  if (!c)
    return `<div ${place}><div class="guest-empty" role="img" aria-label="Chỗ đứng ${seat + 1} đang trống"><span class="guest-empty-shadow"></span><span class="guest-empty-number">${seat + 1}</span></div></div>`;
  const f = guestFrame(c, s.elapsed, moving);
  const mood = guestMood(c);
  const response = ["eating", "checkout", "departing"].includes(c.status);
  const call =
    c.status === "waiting"
      ? `<span class="customer-call" style="visibility:${f.call ? "visible" : "hidden"}"><span class="customer-order-preview">${c.accepted ? "..." : "?"}</span></span>`
      : "";
  const label =
    c.status === "dirty"
      ? textVi("t_6701fc6c76f2")
      : c.status === "checkout"
        ? textVi("t_40bb00b7d0d1")
        : textVi("t_f9b6cc36c620");
  const reaction = response
    ? `<span class="reaction" data-mood="${mood}">${mood === "happy" ? "♡" : mood === "disappointed" ? "…" : "☺"}</span><span class="guest-feedback">${esc(feedback(c))}</span>`
    : "";
  const character = `<button class="customer ${c.status} ${c.happy === false ? "sad" : ""}" data-motion="${f.phase}" data-motion-key="guest:${c.id}" data-act="customer" data-arg="${c.id}" data-drop="customer:${c.id}" aria-label="${label} ${esc(c.name)}" style="--guest-x:${f.x};--guest-bob:${f.bob}px;--guest-opacity:${f.opacity};--guest-turn:${f.turn}">${person(c)}${call}${reaction}</button>`;
  const dishes = c.combo
    ? c.combo.delivered.map(({ dish }) => dish)
    : c.meal
      ? [c.meal]
      : [];
  const art = dishes
    .map((d) => servedComboArt(d, s.decor.bowl ? "#739b99" : ""))
    .join("");
  const detail =
    c.status === "waiting"
      ? `<div class="patience" role="meter" aria-label="${textVi("t_2eb6ef51097a")} ${esc(c.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round((c.patience / c.maxPatience) * 100)}"><i data-patience="${c.id}" style="width:${(c.patience / c.maxPatience) * 100}%"></i></div>${dishes.length ? `<div class="combo-served-visual" style="--parts:${dishes.length}" aria-label="${deliveredCount(c)}/${c.combo.parts.length} phần đã giao">${art}</div>` : ""}${btn(`${sprite("guest-order-paper", "", "guest-paper")}<span>#${seat + 1} · ${esc(c.name)}${c.combo ? ` · ${deliveredCount(c)}/${c.combo.parts.length}` : ""}<small>${c.accepted ? labels.orders.readAgain : labels.orders.listen}</small></span>`, c.accepted ? "order" : "customer", c.id, "order-ticket")}`
      : `<button class="table-bowl ${c.status} ${c.combo ? "combo-table-bowl" : ""} ${c.status === "dirty" ? "dirty-dishes" : ""}" style="--parts:${Math.max(1, dishes.length)}" data-act="customer" data-arg="${c.id}" aria-label="${c.status === "dirty" ? textVi("t_068f238d37f6") : c.status === "checkout" ? textVi("t_0ee5eb6ab1ee") : textVi("t_fbc981f8748c")}">${c.status === "dirty" ? sprite("gdw-dirty-bowl", "", "guest-dirty-bowl") : art}${c.status === "dirty" || c.status === "checkout" ? `<span class="guest-table-label ${c.status === "dirty" ? "sr-only" : ""}">${c.status === "dirty" ? textVi("t_4ba08cf55df2") : textVi("t_44bc912138b3")}</span>` : ""}</button>`;
  return `<div ${place}>${character}${detail}</div>`;
}
export function guestScene(s, ui, moving) {
  const index = Number(ui.scene.replace("guests", ""));
  return (
    [0, 1].map((i) => guestSeat(s, ui.scene, index, i, moving)).join("") +
    petScene(s, ui.scene, ui.petAction) +
    (s.decor.flowers
      ? `<div class="guest-counter-flowers" aria-label="${esc("Hoa trang trí đã mua")}">${sprite("flowers")}</div>`
      : "")
  );
}
