import { projectBox, projectY, playHeight } from "./room-composition.js";
import { shelfArt } from "./shelf-art.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import balance from "../../config/balance.json" with { type: "json" };
import { DRINKS, INGREDIENTS, TOPPINGS } from "../data.js";
import { DRINK_METHODS } from "../systems/drinks.js";
import { brothBatchFor } from "../systems/cooking.js";
import { recipeBook } from "../systems/discovery.js";
import { orderParts } from "../systems/combo.js";
import { count } from "../systems/inventory.js";
import { cookingStatus } from "./cooking-status.js";
import { layoutFor, sprite } from "./assets.js";
import { bowl, drinkArt, foodIcon, icon } from "./art.js";
import { btn, esc } from "./panels.js";
import miniGameArt from "../../data/mini-game-art.json" with { type: "json" };
import { workstationDrink } from "./drink-presentation.js";
import { workPicker } from "./work-picker.js";
import { availableDrinkToppings } from "../systems/drink-toppings.js";
import { DRINK_TOPPINGS } from "../data.js";

function directDrinkBench(s, ui, held) {
  const d = s.drink,
    step = d && DRINK_METHODS[d.id]?.[d.step],
    ready = d && d.step >= DRINKS[d.id].steps;
  const title = d
    ? labels.drinks[d.id] || DRINKS[d.id].name
    : labels.work.drinkChoice;
  const drinkChoice = workPicker(
    "drink",
    title,
    Object.entries(DRINKS)
      .filter(([, r]) => s.day >= (r.availableFromDay || 1))
      .map(([id, r]) => ({
        id,
        label: labels.drinks[id] || r.name,
        art: drinkArt(id),
        selected: d?.id === id,
        disabled: !!d && d.id !== id,
      })),
    ui,
  );
  const detail = workPicker(
    "detail",
    labels.work.detail,
    Object.entries(labels.work.details).map(([id, label]) => ({ id, label })),
    ui,
    true,
  );
  const toppings = ready
    ? workPicker(
        "drink-topping",
        labels.work.toppingChoice,
        availableDrinkToppings(d.id, d.temperature, s.day).map((id) => ({
          id,
          label: DRINK_TOPPINGS[id].name,
          art: sprite(DRINK_TOPPINGS[id].asset),
          disabled: !!d.topping,
        })),
        ui,
      )
    : "";
  const craft =
    step && ["whisk", "art", "stir"].includes(step.action)
      ? ` data-craft="${step.action}" data-direct-craft`
      : "";
  const label = ready
    ? `${title} · ${d.temperature === "cold" ? labels.work.cold : labels.work.hot}`
    : step
      ? labels.stepNames[step.action] || step.label
      : labels.work.chooseDrink;
  const action = ready
    ? btn(labels.short["Ghép vào mâm"], "work-action", "attach")
    : btn(
        step && !step.items
          ? labels.stepNames[step.action] || step.label
          : labels.work.nextIngredientShort,
        "work-action",
        "drink-step",
      );
  return `<section class="direct-workbench drink-workbench ${ready ? "is-ready" : ""}" style="--cup-ground:${(projectY("drinks", 46, playHeight()) * playHeight()) / 100}px" aria-label="${labels.work.drinkBench}"><button class="work-vessel prepared-drink" data-act="work-target" data-arg="cup" data-drop="cup" ${ready ? 'data-drag="drink"' : ""}${craft} aria-label="${esc(label)}">${workstationDrink(d)}${ready && d.temperature !== "cold" ? steam() : ""}<span class="work-vessel-label">${esc(label)}</span></button><div class="work-controls"><div class="work-drink-toolbar">${drinkChoice}${source("tool:ice", labels.work.ice, sprite("ui-snow"))}${!ready ? source("tool:milk", labels.work.milk, foodIcon("milk")) + source("tool:garnish", labels.work.garnish, sprite("ui-leaf")) : ""}</div><div class="work-tools">${action}${ready && DRINKS[d.id].temperatureOptions?.includes("cold") && d.temperature !== "cold" ? btn(labels.work.addIce, "work-action", "chill") : ""}${toppings}${detail}${held ? btn(labels.work.cancel, "work-action", "cancel", "work-cancel") : ""}</div></div><span class="work-held" role="status">${held ? `${labels.work.holding} ${esc(held.label)}` : labels.hints.source}</span></section>`;
}

const box = (b) =>
  `left:${b.x}%;top:${b.y}%;width:${b.width}%;height:${b.height}%`;
const steam = () => sprite("kitchen-steam", "", "direct-steam");
const source = (id, label, art, quantity) =>
  `<button class="work-source" data-act="work-source" data-arg="${id}" data-drag="${id}" aria-label="${esc(label)}" title="${esc(id === "ingredient:oil" ? labels.work.oilHint : id === "prepared:tempura" ? labels.work.tempuraHint : label)}"><span>${esc(labels.work[id.split(":")[1]] || labels.ingredients[id.split(":")[1]] || label)}</span>${art}${quantity === undefined ? "" : `<b>${quantity}</b>`}</button>`;

export const workstationTrash = () =>
  `<button class="food-trash" data-act="work-trash" data-drop="trash" aria-label="${labels.work.trash}" title="${labels.work.trashHint}">${icon("trash", 26)}</button>`;

export function kitchenControls(s, ui) {
  const l = layoutFor("kitchen");
  const pots = s.pots
    .map(
      (p, i) =>
        `<button class="pot-hit ${p?.stage === "ready" ? "ready" : ""} ${p?.lifted ? "lifted" : ""}" data-pot="${i}" data-drop="pot:${i}" data-act="${ui.panel ? "pot" : "work-target"}" data-arg="${ui.panel ? i : `pot:${i}`}" ${!p?.lifted ? `data-drag="pot:${i}"` : ui.panel ? `data-drag="bowl:${i}"` : ""} aria-label="Nồi mì ${i + 1}"><span class="pot-label">${p?.lifted ? "Tô ở bàn thao tác" : p ? labels.work.boilingNoodles : { empty: "Thêm nước", water: "Bật lửa", heating: "Đang đun", boiling: "Thả mì" }[s.burners[i].stage]}</span>${sprite(p && !p.lifted ? "v2-noodle-pot" : miniGameArt.noodlePot[s.burners[i].stage], "", "pot-sprite")}${s.burners[i].stage === "boiling" || s.burners[i].stage === "heating" ? steam() : ""}<span class="work-timer" data-work-timer="pot:${i}"></span></button>`,
    )
    .join("");
  return `<button class="noodle-basket ${ui.noodleSelected ? "selected" : ""}" style="${box(projectBox("kitchen", l.noodles))}" data-drag="noodles" data-act="${ui.panel ? "noodles" : "work-source"}" data-arg="noodles" aria-label="Mì trong giỏ">${shelfArt("noodles")}<span class="rack-name">${INGREDIENTS.noodles.name}</span><b class="rack-count">${count(s, "noodles")}</b></button><div class="pots ${s.upgrades.stove ? "multiple" : ""}" style="${box(projectBox("kitchen", s.upgrades.stove ? l.multiplePots : l.pots))}">${pots}</div>`;
}

export function drinkControls(s, ui) {
  if (ui.panel)
    return s.drink
      ? `<button class="prepared-drink" data-act="panel" data-arg="brew">${drinkArt(s.drink.id, "", s.drink.temperature, s.drink.topping)}<span>Pha nước · chi tiết</span></button>`
      : "";
  return "";
}

function orderPicker(s) {
  const options = s.customers
    .filter((c) => c.accepted && c.status === "waiting")
    .flatMap((c) =>
      (c.combo ? orderParts(c) : [c]).map((part, i) => ({ c, part, i })),
    );
  return options.length
    ? `<select data-work-order aria-label="${labels.work.order}">${options.map(({ c, part, i }) => `<option value="${c.id}:${i}" ${c.id === s.selectedOrder && i === s.selectedPart ? "selected" : ""} ${c.combo?.delivered.some((p) => p.index === i) ? "disabled" : ""}>#${c.seat + 1} ${esc(c.name)}${c.combo ? ` · ${i + 1}/${c.combo.parts.length}` : ""}</option>`).join("")} </select>`
    : "";
}

function supplies(s) {
  const extraTops = TOPPINGS.filter(
    (id) => !["onion", "beef", "tofu", "tempura", "egg"].includes(id),
  );
  return `<div class="work-supplies"><div class="work-supply-items">${source("ingredient:oil", "Dầu chiên", foodIcon("oil"), count(s, "oil"))}${source("prepared:tempura", "Tempura chín", foodIcon("tempura"), s.prepared.tempura)}${source("prepared:egg", "Trứng chín", foodIcon("egg"), s.prepared.egg)}${s.phase === "morning" ? btn("Chuẩn bị trứng", "work-action", "eggs") : ""}${extraTops.map((id) => source(`ingredient:${id}`, INGREDIENTS[id].name, foodIcon(id), count(s, id))).join("")}</div>${btn('<span aria-hidden="true">›</span><span class="sr-only">Nguyên liệu tiếp theo</span>', "work-action", "more-supplies", "work-scroll")}</div>`;
}
export function workstationBench(s, ui, held) {
  if (ui.panel || !["kitchen", "drinks"].includes(ui.scene)) return "";
  if (ui.scene === "drinks") return directDrinkBench(s, ui, held);
  const p = s.pots[ui.pot],
    lifted = p?.lifted,
    burner = s.burners[ui.pot]?.stage;
  const mainLabel = lifted
    ? labels.work.tray
    : p
      ? labels.work.lift
      : burner === "boiling"
        ? labels.work.noodles
        : burner === "water"
          ? labels.work.fire
          : burner === "heating"
            ? labels.work.waitWater
            : labels.work.water;
  const mainAction = lifted
    ? "tray"
    : p
      ? "lift"
      : burner === "boiling"
        ? "start-noodles"
        : "heat";
  const target = lifted ? `bowl:${ui.pot}` : "worktop";
  const vessel = bowl(
    lifted ? p : { empty: true },
    s.decor.bowl ? "#739b99" : "",
  );
  const label = lifted
    ? p.poured
      ? labels.short["Thêm topping → lên mâm"]
      : labels.short["Mì đã vớt → chan nước dùng"]
    : p
      ? labels.work.cookingPotHint
      : labels.work[`${burner || "empty"}PotHint`];
  const details = [
    "cook",
    "broth",
    "brew",
    "fryer",
    "chop",
    "handmade",
    "recipes",
    "dish",
  ];
  return `<section class="direct-workbench kitchen-workbench" aria-label="Bàn thao tác"><button class="work-vessel work-bowl" data-act="work-target" data-arg="${target}" data-drop="${target}" ${lifted ? `data-drag="bowl:${ui.pot}"` : ""} aria-label="${esc(label)}">${vessel}${lifted && p.temperature !== "cold" ? steam() : ""}<span class="work-vessel-label">${esc(label)}</span></button><div class="work-controls">${supplies(s)}<div class="work-tools">${btn(mainLabel, "work-action", mainAction)}<select data-work-finish aria-label="Thao tác thêm"><option value="">${labels.work.finish}</option><option value="cold">Làm mì lạnh</option><option value="stirfry">Xào mì</option>${s.upgrades.stove ? '<option value="regular">Chọn nồi thường</option><option value="curry">Chọn nồi cà ri</option>' : ""}<option value="reset">Bỏ mẻ nước dùng</option><option value="discard">Bỏ tô đang làm</option></select><select data-work-detail aria-label="Xem bảng chi tiết"><option value="">${labels.work.detail}</option>${details.map((id) => `<option value="${id}">${labels.work.details[id]}</option>`).join("")}</select>${orderPicker(s)}</div>${!ui.workPracticed || held?.id === "ingredient:oil" || held?.id === "prepared:tempura" ? `<span class="work-hint">${held?.id === "ingredient:oil" ? labels.work.oilHint : held?.id === "prepared:tempura" ? labels.work.tempuraHint : labels.hints.source}</span>` : ""}</div><span class="work-held" role="status">${held ? `Đang chọn: ${esc(held.label)}` : "Chạm nguồn rồi chạm đích · hoặc kéo thả"}</span>${held ? btn("Bỏ chọn", "work-action", "cancel", "work-cancel") : ""}</section>`;
}

export function updateWorkstationTimers(s) {
  document.querySelectorAll("[data-work-timer]").forEach((el) => {
    const key = el.dataset.workTimer;
    let text = "",
      state = "hard",
      progress = 0;
    if (key.startsWith("pot:")) {
      const i = Number(key.split(":")[1]),
        p = s.pots[i],
        b = s.burners[i];
      if (p && !p.lifted) {
        const status = cookingStatus(p);
        state = status.state;
        text =
          state === "hard"
            ? `${Math.max(0, Math.ceil(p.duration - p.time))}s`
            : state === "perfect"
              ? `Vớt · ${Math.max(0, Math.ceil(p.duration + balance.cooking.liftWindowSeconds - p.time))}s`
              : "Mì mềm";
        progress = Math.min(1, p.time / p.duration);
      } else if (!p && b.stage === "heating") {
        text = `${Math.max(0, Math.ceil(balance.cooking.waterSeconds - b.time))}s`;
        progress = b.time / balance.cooking.waterSeconds;
      } else if (!p && b.stage === "boiling") {
        text = "Đã sôi";
        state = "perfect";
        progress = 1;
      }
    } else if (key === "broth") {
      const b = brothBatchFor(s);
      text = `${s.brothSource === "curry" ? "Cà ri" : "Nước dùng"}: ${b.stage === "cooking" ? `${Math.max(0, Math.ceil(balance.cooking.brothSeconds - b.time))}s` : b.stage === "ready" ? `${b.servings} tô` : `${b.ingredients.length} phần`}`;
    } else if (key === "fryer") {
      const f = s.fryer[0];
      text = !f
        ? `Tempura ${s.prepared.tempura}`
        : f.stage === "raw"
          ? "Tôm → bột"
          : f.stage === "battered"
            ? "Bột → dầu"
            : `${Math.floor(f.time)}s · ${f.time < balance.cooking.fryMinSeconds ? "chưa chín" : f.time <= balance.cooking.fryMaxSeconds ? "nhấc ngay" : "đã cháy"}`;
      state =
        f?.time >= balance.cooking.fryMinSeconds &&
        f.time <= balance.cooking.fryMaxSeconds
          ? "perfect"
          : "hard";
    }
    if (
      key === "broth" &&
      brothBatchFor(s).stage === "empty" &&
      !brothBatchFor(s).ingredients.length
    )
      text = "";
    if (key === "fryer" && !s.fryer[0] && !s.prepared.tempura) text = "";
    el.textContent = text;
    el.dataset.texture = state;
    el.style.setProperty("--cook-progress", progress);
    el.hidden = !text;
  });
}
