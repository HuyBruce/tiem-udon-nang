import { textVi } from "../i18n.js";
import { audioSettingsMarkup, audioCreditsMarkup } from "./sound-lab.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import strings from "../../data/strings.vi.json" with { type: "json" };
import { marketOffer } from "../systems/market.js";
import { extendedPanel } from "./extended-panels.js";
import { recipeBook, estimatedCost } from "../systems/discovery.js";
import {
  INGREDIENTS,
  RECIPES,
  DRINKS,
  SIDES,
  UPGRADES,
  EMPLOYEES,
  DECOR,
  PLANTS,
  CUSTOMERS,
  EVENTS,
} from "../data.js";
import { count, capacity, stockSize } from "../systems/inventory.js";
import { yen, quotedOrderTotal, quotedPartTotal } from "../systems/economy.js";
import { hint } from "../systems/customers.js";
import { reviewDemand } from "../systems/time.js";
import { isShopOpen } from "../systems/shop-hours.js";
import { sideId, sideName } from "../systems/sides.js";
import { drinkOrderLabel } from "../systems/drink-temperature.js";
import { icon, bowl, foodIcon, portrait } from "./art.js";
import { sprite } from "./assets.js";
import { noodleSurcharge, noodleTierLabel } from "../systems/handmade.js";
import { petPanel } from "./pets.js";
import balance from "../../config/balance.json" with { type: "json" };
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const btn = (text, act, arg = "", cls = "", disabled = false) =>
  `<button class="${cls}" data-act="${act}" data-arg="${esc(arg)}" ${disabled ? "disabled" : ""}>${text}</button>`;
const label = (id) =>
  ({ egg: textVi("t_2e224d9117eb"), tempura: textVi("t_5e1d075d76b5") })[id] ||
  INGREDIENTS[id]?.name ||
  id;
const heading = (small, title, desc = "") =>
  `<div class="panel-heading"><span class="eyebrow">${small}</span><h2>${title}</h2>${desc ? `<p>${desc}</p>` : ""}</div>`;
export function panelContent(name, s, ui) {
  if (name === "pets") return petPanel(s, ui);
  const extended = extendedPanel(name, s, ui);
  if (extended !== undefined) return extended;
  const RECIPES = recipeBook(s);
  if (name === "morning") {
    const reviewEffect = reviewDemand(s);
    const sidePrepNote =
      s.day >= 8
        ? `<div class="morning-note" role="status">${textVi("t_361c8f45be0c")} ${s.prepared.egg} ${textVi("t_f430d72a4110")}</div>`
        : "";
    const reviewNote =
      reviewEffect > 1.01
        ? `<div class="morning-note">${textVi("t_6ccbde788dbe")}</div>`
        : reviewEffect < 0.99
          ? `<div class="morning-note">${textVi("t_9441ecade4e1")}</div>`
          : "";
    return (
      heading(
        `${textVi("t_f65e64cc6f48")} ${s.day} · ${textVi("t_5395ed6a8778")} ${s.forecast.season.toUpperCase()}`,
        textVi("t_112b3ad80165"),
        s.day === 1 ? textVi("t_fae9b3de6896") : textVi("t_5977f24c7d90"),
      ) +
      sidePrepNote +
      `<div class="forecast">${icon(s.forecast.weather === "sun" ? "sun" : s.forecast.weather, 38)}<div><strong>${{ sun: textVi("t_e1083dad6244"), rain: textVi("t_54574a5c3c24"), snow: textVi("t_ee747d101eed") }[s.forecast.weather]}</strong><p>${EVENTS[s.forecast.event]?.desc || textVi("t_49ea317df7a2")}</p></div></div><div class="morning-note">${s.day === 1 ? textVi("t_fcf3b59dd88c") : `${textVi("t_121f9c44daf0")} ${count(s, "noodles")} ${textVi("t_c0f289a3446c")} ${s.prepared.egg} ${textVi("t_4ca7455ee8ca")} ${s.reviews[0] ? `${textVi("t_02fa88826a19")} “${esc(s.reviews[0].text)}”` : ""}`}</div>${reviewNote}${s.plots.some((p) => p?.dryDays >= 2 && !p.watered) ? `<div class="morning-note" role="status">${textVi("t_5014ce449410")}</div>` : ""}${s.day >= 6 && stockSize(s) >= capacity(s) ? `<div class="morning-note" role="status">${textVi("t_e09767397d6c")} ${capacity(s)} ${textVi("t_95538a4b9037")}</div>` : ""}<div class="prep-grid">${btn(icon("bag") + textVi("t_633890f0e461"), "panel", "inventory")}${btn(foodIcon("egg") + `<span>${textVi("t_c4d654c97de7")} <small>${textVi("t_e7206cb4222a")} ${s.prepared.egg}</small></span>`, "eggs")}${btn(icon("book") + textVi("t_26a08c206855"), "panel", "menu")}${btn(icon("people") + textVi("t_ff8a673dcb20"), "panel", "manage")}</div>${btn(textVi("t_491387650b11") + icon("arrow", 18), "open", "", "primary wide")}<p class="fine">${labels.shop.dayPace}</p>`
    );
  }
  if (name === "manage")
    return (
      heading(
        textVi("t_91b4086d1314"),
        textVi("t_6c404b06cc0d"),
        textVi("t_63597711234d"),
      ) +
      `<div class="menu-grid">${[
        ["book", textVi("t_e78b18efe06e"), "recipes"],
        ["bag", textVi("t_5db99edc71b4"), "inventory"],
        ["leaf", textVi("t_a2086ab50642"), "upgrades"],
        ["sun", textVi("t_d48231a7b623"), "decor"],
        ["people", textVi("t_25c7cf3aa5c0"), "employees"],
        ["heart", textVi("t_49944273de09"), "album"],
        ["bowl", textVi("t_c7c1cd9561d6"), "menu"],
        ["star", textVi("t_5b4a9cd2d4eb"), "reviews"],
        ["heart", textVi("t_7e2c6123ee22"), "pets"],
        ["bowl", textVi("t_793e6089e0fe"), "side-prep"],
        ["book", textVi("t_49e498944916"), "staff-recipes"],
        ["star", textVi("t_51dba8ce0e84"), "neighbourhood"],
      ]
        .map(([i, t, p]) => btn(icon(i) + `<span>${t}</span>`, "panel", p))
        .join(
          "",
        )}</div>${s.phase !== "summary" ? btn(isShopOpen(s) ? labels.shop.tapClose : labels.shop.tapOpen, "toggle-shop", "", "wide shop-panel-toggle") : ""}${s.phase === "open" ? btn(labels.shop.finishDay, "panel", "close-day", "wide") : ""}${s.phase === "morning" ? btn(textVi("t_7504c0b2e8b9"), "panel", "morning", "wide") : btn(textVi("t_86d5aaae88d5"), "dismiss", "", "wide")}`
    );
  if (name === "inventory")
    return (
      heading(
        textVi("t_a67efe6b37d4"),
        labels.stock.title,
        labels.stock.intro,
      ) +
      `<div class="stock-ledger"><strong>${labels.stock.owned}: ${stockSize(s)} / ${capacity(s)}</strong><b>${yen(s.money)}</b></div><div class="segmented">${btn(textVi("t_14c0fd60c40c"), "quality", "normal", !ui.premium ? "active" : "")}${btn(textVi("t_dc7017a7476c"), "quality", "premium", ui.premium ? "active" : "")}</div><p class="fine">${textVi("t_72022e849f78")}</p><div class="item-list stock-catalog">${Object.entries(
        INGREDIENTS,
      )
        .map(([id, r]) => {
          const offer = marketOffer(s, id, ui.premium, 5);
          const full = !s.inventory[id]?.length && stockSize(s) >= capacity(s);
          const poor = s.money < offer.price;
          const expires =
            s.day +
            r.life +
            (r.kind === "cold"
              ? s.upgrades.fridge * balance.inventory.fridgeExtraDays
              : 0);
          return `<div class="stock-row"><button class="ingredient-inspect" data-act="stock-detail" data-arg="${id}" aria-label="${esc(r.name)}">${foodIcon(id)}</button><div class="stock-description"><strong>${r.name}</strong><span class="stock-count">${labels.stock.owned}: <b>${count(s, id)}</b> · ${r.kind === "cold" ? labels.stock.kindCold : labels.stock.kindDry}</span><small>${labels.stock.expires} ${expires}</small>${offer.reason ? `<small class="market-note">${offer.reason}</small>` : ""}</div>${btn(`<strong>${labels.stock.bundle}</strong><b>${yen(offer.price)}</b><small>${full ? labels.stock.full : poor ? labels.stock.needMoney : "+5"}</small>`, "buy", id, "buy", full || poor)}</div>`;
        })
        .join("")}</div>`
    );
  if (name === "order") {
    const c = s.customers.find((c) => c.id === ui.customerId);
    if (!c) return heading(textVi("t_3732188dbca4"), textVi("t_6a6ca4d5ed05"));
    const comboParts = c.combo
      ? `<div class="combo-part-list" aria-label="${textVi("t_c19cb7180c69")}">${c.combo.parts.map((part, index) => `<div class="combo-part"><strong>${index + 1}/${c.combo.parts.length} · ${recipeBook(s)[part.recipe].name}</strong><small>${part.noodleTier !== "regular" ? noodleTierLabel(part) + " · " : ""}${part.drink ? `${drinkOrderLabel(part)} · ` : ""}${part.side ? `${sideName(part)} · ` : ""}<b class="combo-price">${yen(quotedPartTotal(s, part))}</b></small><span>${c.combo.delivered.some((item) => item.index === index) ? textVi("t_1336ecf78a3e") : textVi("t_f4a310e5e63e")}</span></div>`).join("")}</div>`
      : "";
    return `<div class="dialogue-person">${portrait(c)}<div><span class="eyebrow">${c.job}</span><h2>${c.name}</h2></div></div><p class="story">${c.story}</p><blockquote class="dialogue ${s.settings.dialogue === "slow" ? "slow" : ""}">“${c.order}”</blockquote>${comboParts}<p class="fine">${c.combo ? `${textVi("t_fe3df4930d6b")} ${yen(quotedOrderTotal(s, c))} · ${textVi("t_7463f658fdba")}` : `${textVi("t_8ffeb08de53e")} ${yen(s.prices[c.recipe] + noodleSurcharge(c))}${c.noodleTier !== "regular" ? " · " + noodleTierLabel(c) + " +¥" + noodleSurcharge(c) : ""}`}</p>${ui.showHint ? `<p class="hint-answer">${hint(c, s)}</p>` : ""}<p class="fine">${labels.panels.hint}</p><div class="button-pair">${btn(textVi("t_112cb9321ed8"), "hint", c.id, "secondary")}${btn(c.accepted ? labels.shop.recorded : textVi("t_c235337cb80e"), "accept", c.id, "primary")}</div>`;
  }
  if (name === "fryer")
    return (
      heading(
        textVi("t_4921be3d5d39"),
        textVi("t_72f9230d5ee8"),
        textVi("t_028699e312fd"),
      ) +
      `<div class="fryer-art" aria-hidden="true">${sprite("v2-fryer")}${s.fryer.some((p) => p.stage === "frying") ? sprite("kitchen-steam", "", "panel-steam") : ""}</div>${s.fryer.map((p, i) => `<div class="fry-row"><span>${textVi("t_e2b65d820893")} ${i + 1} · ${{ raw: textVi("t_df60d50c327f"), battered: textVi("t_12ae8855beb6"), frying: `${textVi("t_d90a3a6bf692")} ${Math.floor(p.time)} ${textVi("t_1a86b1e7e56f")}` }[p.stage]}</span>${btn({ raw: textVi("t_5048a37d555d"), battered: textVi("t_93b46d839cb2"), frying: textVi("t_da4dd69dab0d") }[p.stage], "fry-step", `${i}:${{ raw: "batter", battered: "oil", frying: "lift" }[p.stage]}`, "primary")}</div>`).join("")}${btn(textVi("t_e3fe63242e4c"), "fry-select", "", "wide", s.fryer.length >= 1 + s.upgrades.fryer)}<p class="fine">${textVi("t_11c5993e5bc6")} ${s.prepared.tempura} ${textVi("t_2956dc1a3ce3")} ${1 + s.upgrades.fryer} ${textVi("t_113f97975649")}</p>`
    );
  if (name === "chop")
    return (
      heading(
        textVi("t_f45b84ec77f8"),
        textVi("t_380024aad54a"),
        textVi("t_2055107db487"),
      ) +
      `<div class="chop-board" data-chop="true">${sprite("v2-board", "", "chop-art")}${[0, 1, 2].map((i) => `<div class="cut-line ${ui.cuts?.includes(i) ? "cut" : ""}" style="left:${25 + i * 25}%" data-cut="${i}"></div>`).join("")}</div><p class="fine">${ui.cuts?.length || 0}/${textVi("t_535505d991f2")}</p>${btn(textVi("t_b4116cca0310"), "dismiss", "", "primary wide")}`
    );
  if (name === "dish") {
    const d = s.tray.find((x) => x.id === ui.dishId);
    if (!d) return "";
    const c = s.customers.find((x) => x.id === d.orderId);
    const requested = c?.combo?.parts[d.partIndex || 0] || c;
    const sideOptions = Object.entries(SIDES)
      .filter(([, side]) => s.day >= side.availableFromDay)
      .map(([id, side]) => {
        const available = side.stock.startsWith("prepared.")
          ? s.prepared[id]
          : count(s, side.stock);
        return btn(
          `${sprite(side.art, "", "side-option-art")}<span>${side.shortName}<small>${yen(side.price)} · ${textVi("t_dfbe8f87202c")} ${available}</small></span>`,
          "side",
          `${d.id}:${id}`,
          `side-option${sideId(requested) === id ? " requested" : ""}`,
          d.side || !available,
        );
      })
      .join("");
    return (
      heading(
        textVi("t_9dc8c5f59359"),
        `${textVi("t_b34543c78567")} ${c?.name || textVi("t_2a4a336a7656")}`,
      ) +
      `<div class="dish-preview">${bowl(d, s.decor.bowl ? "#739b99" : "#b76f51")}</div><p>${textVi("t_4458baef8aee")} ${d.strangeDrink ? textVi("t_bf8e83aee415") : drinkOrderLabel(d) || textVi("t_bc2b97d69a94")} · ${textVi("t_bf8598062d84")} ${sideName(d)}</p>${s.drink ? btn(textVi("t_0161cca9eeeb") + drinkOrderLabel({ drink: s.drink.id, drinkTemperature: s.drink.temperature, drinkTopping: s.drink.topping }) + textVi("t_d32c3e7d838b"), "attach-drink", d.id, "primary wide") : ""}<p class="fine">${textVi("t_024c92386ff2")} ${sideName(requested)}. ${textVi("t_dc4a997653fb")}</p><div class="side-options">${sideOptions}</div>${btn(textVi("t_69dcfb8ac052"), "panel", "side-prep", "wide")}<p class="fine">${textVi("t_f4ab9f64ea51")}</p>${btn(textVi("t_fc47189b8068"), "clear-tray", d.id, "text-button danger")}`
    );
  }
  if (name === "menu")
    return (
      heading(
        textVi("t_4fe0803d5321"),
        textVi("t_51fa11c38b79"),
        textVi("t_9c6478aa0863"),
      ) +
      Object.entries(RECIPES)
        .filter(([id]) => s.unlocked.includes(id))
        .map(
          ([id, r]) =>
            `<div class="menu-row"><div><h3>${r.name}</h3><small>${textVi("t_11cf83e9a0a0")} ${yen(estimatedCost(r, s))} · ${textVi("t_45fcc3c3ee06")} ${yen(r.price)}</small></div>${btn(s.menu.includes(id) ? textVi("t_5f704f03e8e7") : textVi("t_2738628501c1"), "toggle-menu", id, s.menu.includes(id) ? "chosen" : "")}<label>${textVi("t_358aeaeb72f1")} <input type="number" inputmode="numeric" data-price="${id}" value="${s.prices[id]}" min="${r.price * 0.6}" max="${r.price * 2}" step="10"></label></div>`,
        )
        .join("") +
      `<p class="fine">${textVi("t_4cabe7bfbae5")}</p>` +
      btn(textVi("t_bd127a15c609"), "panel", "recipes", "wide")
    );
  if (name === "upgrades")
    return (
      heading(
        textVi("t_950a57d9e3ab"),
        textVi("t_41ea884177ae"),
        `${textVi("t_612bd90010db")} ${yen(s.money)}`,
      ) +
      Object.entries(UPGRADES)
        .map(
          ([id, u]) =>
            `<article class="shop-card"><span class="shop-icon">${icon({ seats: "people", stove: "bowl", storage: "bag", fridge: "snow", fryer: "sun", drinks: "leaf", garden: "leaf" }[id], 32)}</span><div><h3>${u.name}</h3><p>${u.desc}</p><small>${textVi("t_a095b82ab97c")} ${s.upgrades[id]} / ${u.max}</small></div>${btn(s.upgrades[id] >= u.max ? textVi("t_057ac8745ea5") : yen(u.base * (s.upgrades[id] + 1)), "upgrade", id, "", s.upgrades[id] >= u.max)}</article>`,
        )
        .join("")
    );
  if (name === "decor")
    return (
      heading(
        textVi("t_a0ae02d12f55"),
        textVi("t_8d3d6ee3e781"),
        textVi("t_e697e113f7bf"),
      ) +
      `<div class="decor-grid">${Object.entries(DECOR)
        .map(
          ([id, d]) =>
            `<article class="decor-card"><div class="decor-swatch" style="--color:${d.color}">${icon(id === "bowl" ? "bowl" : id === "flowers" ? "leaf" : "sun", 42)}</div><h3>${d.name}</h3><small>+${d.bonus * 100}% ${textVi("t_8cb31d2c29dd")}</small>${btn(s.decor[d.slot] === id ? textVi("t_69c65450bfc4") : s.ownedDecor.includes(id) ? textVi("t_d48231a7b623") : yen(d.cost), "preview-decor", id, s.decor[d.slot] === id ? "chosen" : "")}</article>`,
        )
        .join("")}</div>`
    );
  if (name === "employees")
    return (
      heading(
        textVi("t_fd0f55d56c2e"),
        textVi("t_25c7cf3aa5c0"),
        textVi("t_dd4dfb70f189"),
      ) +
      Object.entries(EMPLOYEES)
        .map(([id, e]) => {
          const hired = s.employees[id];
          return `<article class="employee"><div class="employee-head">${portrait({ ...e, id, expression: hired?.relationship >= 4 ? "happy" : hired?.task ? "thinking" : "neutral" })}<div><span class="eyebrow">${e.role}</span><h3>${e.name}${hired ? textVi("t_f7c441628dcb") + hired.level : ""}</h3><small>${yen(Math.round(e.wage * (1 + 0.2 * ((hired?.level || 1) - 1))))} / ${textVi("t_0b49865fecb8")}</small></div></div><p>${e.desc}</p><blockquote>“${e.lines[Math.min(2, Math.floor((hired?.relationship || 0) / 4))]}”</blockquote>${btn(hired?.level === 3 ? textVi("t_c7c24400e232") : hired ? textVi("t_c5c87e0f253f") + yen((e.cost / 2) * hired.level) : textVi("t_9ba5e0118a34") + yen(e.cost), "hire", id, "wide", hired?.level === 3)}${id === "binh" && hired ? `<label class="setting">${textVi("t_f83d2c8e7bd3")} ${toggle("restock", s.staffOptions.restock, "staff-option")}</label><label class="setting">${textVi("t_1fad2749fa0a")} ${toggle("prep", s.staffOptions.prep, "staff-option")}</label>` : ""}</article>`;
        })
        .join("")
    );
  if (name === "reviews")
    return (
      heading(
        textVi("t_ba2e6e08cf97"),
        textVi("t_5b4a9cd2d4eb"),
        textVi("t_ef40c99df840"),
      ) +
      (s.reviews.length
        ? s.reviews
            .map(
              (r) =>
                `<article class="review"><span class="stars">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span><blockquote>“${esc(r.text)}”</blockquote><small>${r.name} · ${textVi("t_c4c3ca76027f")} ${r.day}</small></article>`,
            )
            .join("")
        : textVi("t_28ccf2b0c506"))
    );
  if (name === "album") {
    const visited = new Set(s.collection.customers);
    const journal = CUSTOMERS.map((c) => {
      const found = visited.has(c.id);
      const visits = found ? s.visits[c.id] || 0 : 0;
      const pages = Math.min(
        visits ? Math.floor((visits - 1) / 3) + 1 : 0,
        c.story.length,
      );
      const percent = Math.round((pages / c.story.length) * 100);
      return `<article class="journal-card ${found ? "" : "locked"}" aria-label="${found ? esc(c.name) : textVi("t_dacaf84bbc98")}">
        <div class="journal-portrait">${found ? portrait(c) : '<span class="journal-silhouette" aria-hidden="true">?</span>'}</div>
        <strong>${found ? esc(c.name) : textVi("t_b18ffa483381")}</strong>
        <small>${found ? esc(c.job) : textVi("t_df2ddd52e39b")}</small>
        <p>${found ? (pages ? esc(c.story[pages - 1]) : textVi("t_8d3035a57e07")) : textVi("t_840740393c09")}</p>
        <div class="journal-progress" aria-hidden="true"><span style="width:${percent}%"></span></div>
        <small>${percent}% ${textVi("t_57f821a65eb1")}${found ? ` · ${visits} ${textVi("t_e4f069ca65e1")}` : ""}</small>
      </article>`;
    }).join("");
    return (
      heading(
        textVi("t_a1a70951666b"),
        textVi("t_49944273de09"),
        s.progression.numberOneDay
          ? textVi("t_f1c47378cce0")
          : textVi("t_961529709b85"),
      ) +
      `<h3>${textVi("t_127f08de62c2")} ${visited.size}/${CUSTOMERS.length}</h3><div class="album-grid customer-journal">${journal}</div><h3>${textVi("t_44ab7c587459")} ${s.collection.recipes.length}</h3><p>${s.collection.recipes.map((id) => RECIPES[id].name).join(" · ") || textVi("t_f568ea86f9ab")}</p><h3>${textVi("t_1bdf029574ef")}</h3><p>${s.collection.ingredients.map(label).join(" · ") || textVi("t_bc2b97d69a94")}</p><h3>${textVi("t_9487ef3db387")} ${s.ownedDecor.length}</h3><p>${s.ownedDecor.map((id) => DECOR[id].name).join(" · ") || textVi("t_be08d639a3cb")}</p><h3>${textVi("t_9e4c102cc488")} & ${textVi("t_19eee53b6e91")}</h3><p>${[...s.collection.plants.map((id) => PLANTS[id].name), ...Object.keys(s.employees).map((id) => EMPLOYEES[id].name)].join(" · ") || textVi("t_60cece9e57cd")}</p>`
    );
  }
  if (name === "summary") {
    const l = s.lastSummary || s.ledger,
      best = Object.entries(l.sales).sort((a, b) => b[1] - a[1])[0];
    return (
      heading(
        `${textVi("t_900a0c4bcd48")} ${s.day}`,
        textVi("t_90392d0c39e7"),
        l.served ? textVi("t_61f28a730646") : textVi("t_78bb41db5d45"),
      ) +
      `<div class="summary-hero">${icon("sun", 45)}<span>${textVi("t_f659e5db27c0")}</span><strong>${l.served} ${textVi("t_e94cb8827f72")}</strong><small>${l.served ? (l.satisfaction / l.served >= 80 ? textVi("t_801c9234ef87") : l.satisfaction / l.served >= 60 ? textVi("t_1a62fcee44f9") : textVi("t_b81f2aba3e1a")) : textVi("t_ce6a174b97fb")} · ${textVi("t_ede64f794186")} ${l.rep >= 0 ? "+" : ""}${(l.rep || 0).toFixed(1)}</small></div><div class="receipt">${[
        [textVi("t_c14bde40b935"), l.revenue],
        [textVi("t_5c43ac706fcb"), l.tips],
        [textVi("t_c5b96dc4798a"), -l.ingredients],
        ...(l.wages ? [[textVi("t_a7074024d3ed"), -l.wages]] : []),
        ...(l.other ? [[textVi("t_25b67955a663"), -l.other]] : []),
      ]
        .map(
          ([k, v]) => `<div><span>${k}</span><strong>${yen(v)}</strong></div>`,
        )
        .join(
          "",
        )}<div class="total"><span>${textVi("t_217cc8e2899f")}</span><strong>${yen(l.profit || 0)}</strong></div><small>${textVi("t_d4116db41143")} ${yen(l.purchases)}; ${textVi("t_79f179f85343")}</small></div><p class="handwritten">${best ? `${textVi("t_7ee8830000fa")} ${RECIPES[best[0]].name}` : textVi("t_9344f3f5f649")}</p>${s.reviews[0]?.day === s.day ? `<blockquote class="review">“${s.reviews[0].text}”<small>— ${s.reviews[0].name}</small></blockquote>` : ""}${l.debt ? `<p class="fine">${textVi("t_ecea8f360e36")} ${yen(l.debt)} ${textVi("t_bf3a441d3a45")}</p>` : ""}${btn(textVi("t_437dfd7ded83") + icon("arrow", 18), "next-day", "", "primary wide")}`
    );
  }
  if (name === "audio-info") return audioCreditsMarkup();
  if (name === "settings")
    return (
      heading(
        textVi("t_4b0d37481612"),
        textVi("t_202e0e9b0b85"),
        textVi("t_aac6c611c6c7"),
      ) +
      `${audioSettingsMarkup()}${[
        ["music", textVi("t_271fb2929b05")],
        ["sfx", textVi("t_3002bfc749ca")],
        ["haptic", textVi("t_a94302c219fc")],
        ["animation", textVi("t_af121f84e49a")],
        ["performance", textVi("t_6cb9326bcd7d")],
        ["contrast", textVi("t_85d41e6562cf")],
      ]
        .map(
          ([k, t]) =>
            `<label class="setting">${t}${toggle(k, s.settings[k])}</label>`,
        )
        .join(
          "",
        )}<label class="setting volume">${textVi("t_7558907d0fcd")}<input type="range" data-setting="musicVolume" min="0" max="1" step="0.05" value="${s.settings.musicVolume}"></label><label class="setting volume">${textVi("t_e40b9575380c")}<input type="range" data-setting="sfxVolume" min="0" max="1" step="0.05" value="${s.settings.sfxVolume}"></label><label class="setting">${textVi("t_70300289b9cb")}<select data-setting="font"><option value="normal" ${s.settings.font === "normal" ? "selected" : ""}>${textVi("t_8af1c03bb659")}</option><option value="large" ${s.settings.font === "large" ? "selected" : ""}>${textVi("t_6f57d221a0a8")}</option></select></label><label class="setting">${textVi("t_4ed837284858")}<select data-setting="dialogue"><option value="normal" ${s.settings.dialogue === "normal" ? "selected" : ""}>Nhanh</option><option value="slow" ${s.settings.dialogue === "slow" ? "selected" : ""}>${textVi("t_6ddeaddce750")}</option></select></label><label class="setting">${textVi("t_f1231b2c9aa2")}<select data-setting="language"><option value="vi" selected>${textVi("t_690829f87a10")}</option></select></label>${btn(textVi("t_f964c7261d9c"), "panel", "help", "wide")}${btn(textVi("t_c66066140a16"), "export", "", "wide")}${btn(textVi("t_543a85919fb2"), "import", "", "wide")}${btn(textVi("t_60d601ba88b4"), "panel", "reset", "text-button danger")}<p class="fine">${textVi("t_e2afb32c57e2")}<br>${textVi("t_63f56e6ee064")}</p>`
    );
  if (name === "help")
    return (
      heading(textVi("t_238966eb3399"), textVi("t_9d5bccfe8318")) +
      `<ol class="help-steps"><li>${textVi("t_478b5e07287d")}</li><li>${textVi("t_1c072c193bb1")} ← →.</li><li>${textVi("t_b14b5093d043")}</li><li>${textVi("t_f404526b5c8c")}</li><li>${textVi("t_4d1f72710acb")}</li><li>${textVi("t_927acbf5cffc")}</li><li>${textVi("t_eab6d7ec5884")}</li><li>${textVi("t_1b41fbeb6ad6")}</li><li>${textVi("t_425d4e99f618")}</li><li>${textVi("t_ff356a89ebad")}</li></ol>${btn(textVi("t_7b6eca469a86"), "dismiss", "", "primary wide")}`
    );
  if (name === "reset")
    return (
      heading(
        textVi("t_d5129ef9f97e"),
        textVi("t_1f426324d543"),
        textVi("t_3cd8276c6779"),
      ) +
      `<div class="button-pair">${btn(textVi("t_a44a4dff28ea"), "panel", "settings")}${btn(textVi("t_9f816265475e"), "reset", "", "danger")}</div>`
    );
  return "";
}
function toggle(key, value, type = "setting") {
  return `<input type="checkbox" data-${type}="${key}" ${value ? "checked" : ""}><span class="toggle" aria-hidden="true"></span>`;
}
