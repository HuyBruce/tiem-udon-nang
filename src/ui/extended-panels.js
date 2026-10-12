import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { recipeList } from "./recipe-list.js";
import { textVi } from "../i18n.js";
import { canFinishDay, isShopOpen } from "../systems/shop-hours.js";
import {
  INGREDIENTS,
  TOPPINGS,
  RECIPES,
  DRINKS,
  DRINK_TOPPINGS,
  SIDES,
  DECOR,
  PLANTS,
} from "../data.js";
import { count } from "../systems/inventory.js";
import {
  recipeBook,
  brothFormula,
  estimatedCost,
} from "../systems/discovery.js";
import { DRINK_METHODS } from "../systems/drinks.js";
import { availableDrinkToppings } from "../systems/drink-toppings.js";
import { yen } from "../systems/economy.js";
import { bowl, sceneArt, foodIcon, drinkArt } from "./art.js";
import { sprite } from "./assets.js";
import { plantAppearance } from "./plant-art.js";
import balance from "../../config/balance.json" with { type: "json" };
import miniGameArt from "../../data/mini-game-art.json" with { type: "json" };
import BROTH_INGREDIENTS from "../../data/broth-ingredients.json" with { type: "json" };
import { brothBatchFor } from "../systems/cooking.js";
import { cookingStatus } from "./cooking-status.js";
import {
  handmadeLevel,
  noodleTierLabel,
  noodleSurcharge,
} from "../systems/handmade.js";
import { learnedRecipes, teachingCost } from "../systems/employees.js";
import { neighbourhoodGoal } from "../systems/progression.js";
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const b = (text, act, arg = "", disabled = false) =>
  `<button data-act="${act}" data-arg="${esc(arg)}" ${disabled ? "disabled" : ""}>${text}</button>`;
const head = (title, desc) =>
  `<div class="panel-heading"><h2>${title}</h2><p>${desc}</p></div>`;
const label = (id) =>
  INGREDIENTS[id]?.name || (id === "tempura" ? textVi("t_5e1d075d76b5") : id);
const formula = (ids) =>
  Object.entries(ids.reduce((o, id) => ((o[id] = (o[id] || 0) + 1), o), {}))
    .map(([id, n]) => `${label(id)} ${textVi("t_8db71ed28b0f")}${n}`)
    .join(" · ");
const tierButtons = (s) =>
  `<div class="segmented noodle-tiers">${["regular", "premium", "handmade"]
    .map((tier) =>
      b(
        `${s.noodleTier === tier ? "✓ " : ""}${noodleTierLabel({ noodleTier: tier })}<small>${tier === "handmade" ? s.handmade.portions : count(s, "noodles", tier === "premium" ? true : null)} ${textVi("t_87a88dd0e56d")}${tier !== "regular" ? " · +¥" + noodleSurcharge({ noodleTier: tier }) : ""}</small>`,
        "noodle-tier",
        tier,
        tier === "handmade"
          ? !s.handmade.portions
          : !count(s, "noodles", tier === "premium" ? true : null),
      ),
    )
    .join("")}</div>`;
export function extendedPanel(name, s, ui) {
  if (name === "neighbourhood")
    return (
      head(
        textVi("t_aafdaa2bcab1"),
        s.progression.numberOneDay
          ? `${textVi("t_ce31003d10d6")} ${s.progression.numberOneDay}. ${textVi("t_6dd4e9bc41ba")}`
          : textVi("t_01f07d7d1d77"),
      ) +
      `<div class="neighbourhood-goal">${neighbourhoodGoal(s)
        .map(
          ([label, value, target]) =>
            `<article><strong>${label}</strong><span>${Math.floor(value)} / ${target}</span><progress value="${Math.min(value, target)}" max="${target}" aria-label="${label}"></progress></article>`,
        )
        .join(
          "",
        )}</div><p class="fine">${textVi("t_60ed52753778")}</p>${b(textVi("t_49944273de09"), "panel", "album")}`
    );
  if (name === "staff-recipes") {
    const e = s.employees.yui;
    if (!e)
      return (
        head(textVi("t_49e498944916"), textVi("t_d6c53ec9de43")) +
        b(textVi("t_9da8d37fa9dc"), "panel", "employees")
      );
    const known = learnedRecipes(s, e);
    return (
      head(textVi("t_49e498944916"), textVi("t_cdff1fd7016c")) +
      (e.learning
        ? `<p class="morning-note">${textVi("t_2f069e68e15b")} ${recipeBook(s)[e.learning.recipe].name} · ${textVi("t_3e6b6b6f077e")} ${Math.ceil(e.learning.remaining)} ${textVi("t_3c8bece4bb91")}</p>`
        : "") +
      `<div class="item-list">${s.unlocked
        .map((id) => {
          const r = recipeBook(s)[id];
          return `<article class="staff-recipe"><h3>${esc(r.name)}</h3><small>${r.kind === "cold" ? textVi("t_b485c1b34611") : r.kind === "stirfry" ? textVi("t_1bf68681ce43") : textVi("t_58eeecf32241")}</small>${b(known.includes(id) ? textVi("t_48de675660f7") : `${textVi("t_62229687df89")} ${yen(teachingCost(s, id))}`, "teach-recipe", id, known.includes(id) || !!e.learning || e.level < 2 || (r.kind === "stirfry" && e.level < 3))}</article>`;
        })
        .join("")}</div>${b(textVi("t_73f0820a5b31"), "panel", "employees")}`
    );
  }
  if (name === "side-prep") {
    const p = s.sidePrep;
    return (
      head(textVi("t_57d351ef41e4"), textVi("t_6064b828593d")) +
      (p
        ? `<section class="side-prep-current ${p.stage}">${sprite(SIDES[p.id].art)}<h3>${SIDES[p.id].shortName}</h3><p class="side-prep-status">${p.stage === "cooking" ? `${textVi("t_627cd10c75fe")} ${Math.floor(p.time)} ${textVi("t_1a86b1e7e56f")}` : SIDES[p.id].steps[p.step]}</p>${b(SIDES[p.id].steps[p.step], "side-prep-step", "", p.stage === "cooking" && p.time < balance.sidePreparation.cookSeconds[p.id])}</section>`
        : "") +
      `<div class="side-prep-recipes">${Object.entries(SIDES)
        .filter(([, r]) => r.preparation)
        .map(
          ([id, r]) =>
            `<article>${sprite(r.art)}<h3>${r.shortName}</h3><p>${r.preparation.map(label).join(" · ")}</p><small>${textVi("t_0f2410f44a1e")} ${s.prepared[id]} ${textVi("t_3ebcd8e8b182")} ${r.availableFromDay}</small>${b(textVi("t_3c2de92b9c65"), "side-prep-start", id, !!p || s.day < r.availableFromDay || s.phase !== "open")}</article>`,
        )
        .join("")}</div>${b(textVi("t_b9202570eef8"), "panel", "inventory")}`
    );
  }
  if (name === "stock-detail") {
    const id = ui.stockId,
      r = INGREDIENTS[id];
    if (!r) return "";
    return (
      head(r.name, textVi("t_2215a6990038")) +
      `<div class="stock-detail-art">${foodIcon(id)}</div><p>${textVi("t_5ce48155a688")} ${count(s, id)} ${textVi("t_87a88dd0e56d")}</p>${(s.inventory[id] || []).map((x) => `<article class="stock-lot"><strong>${x.qty} ${textVi("t_04e1bbf50f77")} ${x.premium ? textVi("t_452f0f80d748") : textVi("t_14c0fd60c40c")}</strong><p>${x.expires <= s.day ? textVi("t_ea068f785db2") : x.expires - s.day <= 1 ? textVi("t_ad8b5898b212") : textVi("t_442daac1deb3")} · ${textVi("t_e3b403363c0e")} ${x.expires}</p></article>`).join("")}${b(textVi("t_04e71ec55984"), "panel", "inventory")}<details><summary>${textVi("t_32429a42d84a")}</summary><p>${textVi("t_4757ecc40ffc")}</p>${b(textVi("t_0602f9bcff38"), "discard-stock", id)}</details>`
    );
  }
  if (name === "close-day")
    return (
      head(labels.shop.hoursTitle, labels.shop.hoursIntro) +
      `<div class="closing-status"><strong>${isShopOpen(s) ? labels.shop.open : labels.shop.closed}</strong><p>${s.customers.filter((c) => c.status === "waiting").length} ${textVi("t_926234292de2")} ${s.customers.filter((c) => c.status === "eating").length} ${textVi("t_74fb04e88c9e")} ${s.customers.filter((c) => c.status === "checkout").length} ${textVi("t_3807d3be20a4")}</p><p>${s.customers.filter((c) => c.status === "dirty").length} ${textVi("t_c90668bb2e04")} ${s.sink}/${textVi("t_30f947d96707")}</p></div>${b(isShopOpen(s) ? labels.shop.tapClose : labels.shop.tapOpen, "toggle-shop")}${b(labels.shop.finishDay, "finish-day", "", !canFinishDay(s))}<p class="shop-finish-help">${canFinishDay(s) ? labels.shop.readyToFinish : labels.shop.finishHelp}</p>${b(textVi("t_89d433396a26"), "goto", "guests0")}${b(textVi("t_5a9bc87c2e4c"), "goto", "kitchen")}`
    );
  if (name === "broth") {
    const x = brothBatchFor(s);
    return (
      head(
        s.brothSource === "curry"
          ? textVi("t_9312244d7a58")
          : textVi("t_fd66aa69e31a"),
        `${textVi("t_f0e2e72e728a")} ${balance.cooking.brothServings + s.upgrades.broth * balance.upgradeEffects.brothServingsPerLevel} ${textVi("t_a6519742fd9f")}`,
      ) +
      `<div class="button-pair">${b(`${textVi("t_d54f6d548eb5")} ${s.brothBatch.servings} ${textVi("t_a6519742fd9f")}`, "broth-source", "regular", s.brothSource === "regular")}${b(`${textVi("t_680b10de925b")} ${s.curryBatch.servings} ${textVi("t_a6519742fd9f")}`, "broth-source", "curry", s.brothSource === "curry" || !s.upgrades.stove)}</div><p class="fine">${s.upgrades.stove ? textVi("t_c7828139e113") : textVi("t_ec8c7e48e300")}</p>` +
      `<div class="broth-illustration ${x.stage}">${sprite("v2-broth-pot", "", "broth-pot-art")}${["cooking", "ready"].includes(x.stage) ? sprite("kitchen-steam", "", "panel-steam") : ""}<strong>${x.stage === "ready" ? `${x.servings} ${textVi("t_7fc773cdee4c")}` : x.stage === "cooking" ? textVi("t_f8f6b537f9c5") : `${x.ingredients.length} ${textVi("t_eec28304fafc")}`}</strong></div><p>${formula(x.ingredients) || textVi("t_3f1a3cf2bbe7")}</p><p class="fine">${textVi("t_2ab12008833d")}</p><div class="ingredients">${BROTH_INGREDIENTS.map((id) => b(`${sprite("ingredient-" + id, "", "broth-ingredient-art")}${label(id)}<small>${textVi("t_f7ede8195362")}${count(s, id)} · ${textVi("t_e26b2fcb0a7e")} ${x.ingredients.filter((v) => v === id).length}</small>`, "batch-add", id, x.stage === "cooking" || x.servings > 0 || x.ingredients.filter((part) => part === id).length >= balance.cooking.brothMaxPortionsPerIngredient)).join("")}</div>${b(textVi("t_94e3bcfa3fd0"), "batch-cook", "", x.stage !== "mixing" || x.ingredients.length < balance.cooking.brothMinPortions)}${b(textVi("t_e5b26d5929b0"), "batch-reset", "", x.stage === "empty")}${b(textVi("t_26c7136cabf8"), "panel", "recipes")}`
    );
  }
  if (name === "cook") {
    const p = s.pots[ui.pot],
      burner = s.burners[ui.pot];
    if (!p)
      return (
        head(textVi("t_1ff4d87d6d53"), textVi("t_f7c63b1c12e3")) +
        `<div class="pot-preview" aria-hidden="true">${sprite(miniGameArt.noodlePot[burner.stage])}</div><p>${{ empty: textVi("t_3f1a3cf2bbe7"), water: textVi("t_5aa5afa72f29"), heating: textVi("t_2499b818126d"), boiling: textVi("t_bb4dde7c05a1") }[burner.stage]}</p>${b(burner.stage === "empty" ? textVi("t_161f1ad61f10") : textVi("t_0bb30cabb591"), "burner", ui.pot, !["empty", "water"].includes(burner.stage))}${tierButtons(s)}${b(textVi("t_35e76d302c42"), "drop-noodles", ui.pot, burner.stage !== "boiling")}${b(textVi("t_28aabe5bc40c"), "panel", "broth")}`
      );
    const c = s.customers.find((c) => c.id === p.orderId);
    const status = cookingStatus(p);
    const sourceLabel =
      s.brothSource === "curry"
        ? textVi("t_9312244d7a58")
        : textVi("t_fd66aa69e31a");
    return (
      head(
        `${textVi("t_ccd200c1529c")} ${esc(c?.name || textVi("t_2a4a336a7656"))}`,
        p.lifted
          ? `${textVi("t_a6e6764d5af8")} ${{ hard: textVi("t_0a9ee81ac911"), perfect: textVi("t_074bd86ebbe5"), soft: textVi("t_873496e8b9a2") }[p.texture] || textVi("t_f33b0834bd45")}. ${textVi("t_2e2f395c5f2b")}`
          : `${textVi("t_488294af4ed2")} ${balance.cooking.liftWindowSeconds} ${textVi("t_c0794b2cd50f")}`,
      ) +
      `<div class="cook-bowl" data-act="add-topping" data-arg="${ui.pot}" data-drop="bowl">${bowl(p, s.decor.bowl ? "#739b99" : "#b76f51")}${p.temperature !== "cold" ? sprite("kitchen-steam", "", "panel-steam") : ""}<span class="cook-status" data-texture="${p.lifted ? p.texture : status.state}">${p.lifted ? (ui.selectedTopping ? `${textVi("t_aa783ccc5adb")} ${label(ui.selectedTopping)}` : p.poured ? textVi("t_9086faec116b") : textVi("t_1dfa6aeee617")) : status.label}</span></div>${!p.lifted ? b(textVi("t_a14b52f58f69"), "lift-noodles", ui.pot) : `<div class="button-pair">${b(`${sourceLabel} · ${brothBatchFor(s).servings}${textVi("t_b7ed1001edee")}`, "panel", "broth")}${b(textVi("t_998e3906e283"), "pour", "", p.poured || !brothBatchFor(s).servings)}</div><div class="ingredients tops">${TOPPINGS.map((id) => b(`${foodIcon(id)}${label(id)}<small>${textVi("t_8db71ed28b0f")}${["egg", "tempura"].includes(id) ? s.prepared[id] : count(s, id)}</small>`, "select-topping", id, !p.poured || p.tops.includes(id))).join("")}</div>${b(textVi("t_dfa9ba24e2e1"), "finish-style", `${ui.pot}:cold`, p.poured || p.method === "cold")}${b(p.finishing ? textVi("t_9862803f69dd") : textVi("t_cda5cfdc7069"), "finish-style", `${ui.pot}:stirfry`, !p.poured || p.finishing || p.method === "stirfry")}${b(textVi("t_3d1d2f077f8f"), "tray", ui.pot, !p.poured || p.finishing)}`}${b(textVi("t_d609f860f508"), "panel", "recipes")}${b(textVi("t_912a86198e52"), "discard", ui.pot)}`
    );
  }
  if (name === "handmade") {
    const h = s.handmade,
      unlocked = s.day >= 5 || s.reputation >= 35;
    return (
      head(textVi("t_9f654287f014"), textVi("t_d667e2fc9ef0")) +
      `<div class="handmade-board" data-craft="handmade">${sprite(ui.handmadePreview ? miniGameArt.handmadeFinished : miniGameArt.handmade[h.stage])}<span>${ui.handmadePreview ? textVi("t_4dca2d14b71d") : [textVi("t_9487e035a6a2"), textVi("t_7959efce5cd3"), textVi("t_8513daf8a40e"), textVi("t_0aab8caffceb"), textVi("t_9efb2ab4dda7")][h.stage]}</span></div><p>${textVi("t_0474cb22535f")} ${h.portions} ${textVi("t_eb467f2599af")} ${handmadeLevel(s)}/3</p><p class="fine">${h.xp} ${textVi("t_b5fe51650a92")}</p>${b([textVi("t_eb48b33d7314"), textVi("t_161f1ad61f10"), textVi("t_49123b57b446"), textVi("t_8dfde8cf95f0"), textVi("t_12c0f1968446")][h.stage], "handmade", "", !unlocked)}<p class="fine">${textVi("t_7accb4caf7dd")}</p>${tierButtons(s)}`
    );
  }
  if (name === "recipes") {
    const book = recipeBook(s);
    const filter = ui.recipeFilter || "all";
    const entries = Object.entries(book);
    const learnedCount = entries.filter(([id]) =>
      s.unlocked.includes(id),
    ).length;
    const filters = `<div class="segmented recipe-filters" role="group" aria-label="${textVi("t_7e4a6d4bebdf")}">${[
      [
        "all",
        `${textVi("t_49c73a3150d7")}<small>${entries.length} ${textVi("t_02a5d863f727")}</small>`,
      ],
      [
        "learned",
        `${textVi("t_df3d4ab10c42")}<small>${learnedCount} ${textVi("t_02a5d863f727")}</small>`,
      ],
      [
        "unlearned",
        `${textVi("t_b303e9916539")}<small>${entries.length - learnedCount} ${textVi("t_02a5d863f727")}</small>`,
      ],
    ]
      .map(
        ([id, title]) =>
          `<button class="${filter === id ? "active" : ""}" data-act="recipe-filter" data-arg="${id}" aria-pressed="${filter === id}">${title}</button>`,
      )
      .join("")}</div>`;
    return (
      head(textVi("t_e78b18efe06e"), labels.panels.recipes) +
      (s.discoveryDraft
        ? `<div class="discovery-card"><h3>${esc(s.discoveryDraft.customer)} ${textVi("t_66e0674c32bb")}</h3>${bowl({ poured: true, tops: s.discoveryDraft.tops })}<label>${textVi("t_94feb40321c3")}<input id="recipe-name" maxlength="45" placeholder="${textVi("t_abba63d74ccf")}"></label>${b(textVi("t_f509e1f7bddd"), "name-recipe")}</div>`
        : "") +
      filters +
      recipeList(
        entries.filter(([id]) =>
          filter === "learned"
            ? s.unlocked.includes(id)
            : filter === "unlearned"
              ? !s.unlocked.includes(id)
              : true,
        ),
        (id, r, i) => {
          const hidden =
              r.hidden &&
              !s.unlocked.includes(id) &&
              !s.pendingRecipes.includes(id),
            pending = s.pendingRecipes.includes(id);
          if (hidden)
            return `<article class="recipe secret-recipe"><div class="silhouette">${bowl({ poured: true, tops: [] })}</div><h3>???</h3><p>${textVi("t_83d73336e217")}</p></article>`;
          return `<article class="recipe ${pending ? "discovery-card" : ""}"><div class="recipe-top">${bowl({ poured: true, broth: brothFormula(r), tops: r.tops }, s.decor.bowl ? "#739b99" : "#b76f51", true)}<div><h3>${esc(r.name)}</h3><small>${esc(r.jp)}</small></div></div><p>${esc(r.desc)}</p>${r.season ? `<p class="fine">${textVi("t_3d11216d0849")} ${r.season}</p>` : ""}<p><strong>${textVi("t_17d4547a64e5")}</strong> ${formula(brothFormula(r))}</p><p><strong>Topping:</strong> ${r.tops.map(label).join(" · ")}</p><small>${textVi("t_52dcaafd4586")} ${yen(estimatedCost(r, s))}/${textVi("t_ab0052e26740")} ${yen(r.price)}</small>${pending ? textVi("t_10d8c3c0b785") : !s.unlocked.includes(id) ? b(textVi("t_1268af3f7994") + yen(r.unlock), "unlock", id) : ""}</article>`;
        },
      )
    );
  }
  if (name === "brew") {
    const d = s.drink,
      step = d && DRINK_METHODS[d.id][d.step];
    const toppingOptions =
      d && !step && !d.strange
        ? availableDrinkToppings(d.id, d.temperature, s.day)
        : [];
    const toppings = toppingOptions.length
      ? `<section class="drink-topping-options" aria-label="${textVi("t_d6dee75066fc")}"><h4>${textVi("t_86775c9f99cf")}</h4><p>${d.topping ? textVi("t_148521347a73") + DRINK_TOPPINGS[d.topping].name + textVi("t_89f9c8daec9b") : textVi("t_31a097a80ca7")}</p><div>${toppingOptions
          .map((id) => {
            const topping = DRINK_TOPPINGS[id],
              qty = count(s, topping.ingredient);
            return b(
              `${sprite(topping.asset, "", "drink-topping-choice")}<span>${topping.name}</span><small>${textVi("t_8db71ed28b0f")}${qty} · +${yen(topping.price)}</small>`,
              "drink-topping",
              id,
              Boolean(d.topping) || qty < 1,
            );
          })
          .join("")}</div></section>`
      : "";
    const chillButton =
      d &&
      !step &&
      !d.strange &&
      d.temperature === "hot" &&
      DRINKS[d.id].temperatureOptions?.includes("cold")
        ? b(textVi("t_8c6213639348"), "drink-chill")
        : "";
    return (
      head(textVi("t_4ffafa262d5f"), textVi("t_040cde1b3b45")) +
      chillButton +
      (!d
        ? `<div class="drink-menu">${Object.entries(DRINKS)
            .map(([id, r]) =>
              b(
                `${drinkArt(id)}<strong>${r.name}</strong><small>${s.day < (r.availableFromDay || 1) ? `${textVi("t_262140156036")} ${r.availableFromDay}` : r.items.map(label).join(" · ")}</small>`,
                "drink-start",
                id,
                s.day < (r.availableFromDay || 1),
              ),
            )
            .join("")}</div>`
        : `<div class="brew-progress">${drinkArt(d.id, "large", d.temperature, d.topping)}${!step && d.temperature !== "cold" ? sprite("kitchen-steam", "", "panel-steam") : ""}<h3>${d.strange ? textVi("t_bf8e83aee415") : DRINKS[d.id].name}</h3><p>${step ? step.label : textVi("t_2951032610fb")}</p><p>${d.temperature === "hot" ? textVi("t_1ae42ec28073") : textVi("t_103b525ad58e")} · ${textVi("t_6acd2db3e8d1")} ${Math.min(d.step + 1, DRINKS[d.id].steps)}/${DRINKS[d.id].steps}</p>${step && ["whisk", "art"].includes(step.action) ? `<div class="drink-gesture" data-craft="${step.action}">${drinkArt(d.id, "", d.temperature)}<small>${step.action === "whisk" ? textVi("t_ff69d59c707e") : textVi("t_2f4544c2355c")}</small></div>` : ""}${step ? b(step.label + (["whisk", "art"].includes(step.action) ? textVi("t_f25d11ff13aa") : ""), "drink-step", step.action) : b(textVi("t_30b6bfab820d"), "dismiss")}${
            step
              ? `<details><summary>${textVi("t_3f880114bfef")}</summary><div class="ingredients">${[
                  "tea",
                  "matcha",
                  "milk",
                  "yuzu",
                  "soda",
                  "sakura",
                  "melon",
                  "strawberry",
                ]
                  .filter((x) => x !== step.action)
                  .map((id) => b(label(id), "drink-step", id))
                  .join("")}</div></details>`
              : ""
          }${toppings}${b(textVi("t_5be57b70ec40"), "drink-discard")}</div>`)
    );
  }
  if (name === "decor-preview") {
    const id = ui.previewDecor,
      d = DECOR[id];
    if (!d) return "";
    const preview = structuredClone(s);
    preview.decor[d.slot] = id;
    return (
      head(
        `${textVi("t_e30fb65647bc")} ${esc(d.name.toLowerCase())}`,
        textVi("t_83860a67fe35"),
      ) +
      `<div class="room-preview">${sceneArt(ui.previewScene || "guests0", preview)}${id === "bowl" ? `<div class="preview-food">${bowl({ poured: true, tops: ["beef", "egg", "onion"] }, "#739b99")}</div>` : ""}${id === "cup" ? drinkArt("matcha", "large blue-cup") : ""}</div>${b(s.ownedDecor.includes(id) ? textVi("t_1e14bc1afc9f") : textVi("t_f0a23c6bb29f") + yen(d.cost), "confirm-decor", id)}${b(textVi("t_2945a5828879"), "panel", "decor")}`
    );
  }
  if (name === "garden")
    return (
      head(textVi("t_c5de8f0def40"), textVi("t_43346f39fea2")) +
      s.plots
        .map(
          (p, i) =>
            `<article class="plant-card"><h3>${textVi("t_20bc9f7bf186")} ${i + 1}</h3>${
              p
                ? `<div class="plant-card-art" aria-hidden="true">${sprite(plantAppearance(p).asset, "")}</div><p>${PLANTS[p.id].name} · ${p.growth}/${PLANTS[p.id].days} ${textVi("t_69159f6f2053")} ${p.dryDays >= 2 ? (p.watered ? textVi("t_4765eb90f60b") : textVi("t_2927dd5473a3")) : p.watered ? textVi("t_decbb42c584f") : textVi("t_a0957fe82f21")}${p.dryDays ? textVi("t_dc056f756735") + p.dryDays + textVi("t_878d8e0adc56") : ""}</p>${b(p.growth >= PLANTS[p.id].days ? textVi("t_cd6d3bfe6226") : textVi("t_0990f67c0f2e"), "garden", i, p.watered && p.growth < PLANTS[p.id].days)}${b(p.fertilized ? textVi("t_44f5d2f3fdd1") : textVi("t_21b04cdef4f4"), "fertilize", i, p.fertilized)}`
                : `<div class="plant-options">${Object.entries(PLANTS)
                    .filter(
                      ([, x]) =>
                        x.level <= s.upgrades.garden &&
                        (!x.seasons || x.seasons.includes(s.forecast.season)),
                    )
                    .map(([id, x]) =>
                      b(`${x.name} · ${yen(x.cost)}`, "plant", `${i}:${id}`),
                    )
                    .join("")}</div>`
            }</article>`,
        )
        .join("") +
      `<h3>${textVi("t_8b01024887b8")} ${s.bouquets} ${textVi("t_068a18ffe839")}</h3><div class="button-pair">${[
        ["front", textVi("t_f0ef5adda083")],
        ["guests", textVi("t_8632b99f1497")],
        ["drinks", textVi("t_df516ed2f207")],
      ]
        .map(([id, n]) =>
          b(textVi("t_8e95f295be41") + n, "arrange-flowers", id, !s.bouquets),
        )
        .join(
          "",
        )}</div><p class="fine">${textVi("t_404eb51ed0be")}</p>${b(textVi("t_92e6a898e321"), "panel", "upgrades")}`
    );
}
