import { textVi } from "./i18n.js";
import { clockText, gameMinutes, isEvening } from "./systems/time.js";
import balance from "../config/balance.json" with { type: "json" };
import { clockFace } from "./ui/clock.js";
import { observeViewport } from "./ui/viewport.js";
import { createClockUI, pauseReason, returnSeconds } from "./ui/game-clock.js";
import { doorSign, forecastChip, shopOverlays } from "./ui/shop-chrome.js";
import { isShopOpen, closingReminderDue } from "./systems/shop-hours.js";
import { migrateState } from "./systems/migration.js";
import { DRINK_METHODS } from "./systems/drinks.js";
import "@fontsource/be-vietnam-pro/latin-400.css";
import "@fontsource/be-vietnam-pro/vietnamese-400.css";
import "@fontsource/be-vietnam-pro/latin-600.css";
import "@fontsource/be-vietnam-pro/vietnamese-600.css";
import "./style.css";
import "./polish.css";
import "./upgrade.css";
import "./layout.css";
import "./scenes.css";
import "./v2.css";
import "./live-v2.css";
import "./character-review.css";
import "./pastel.css";
import "./experience.css";
import "./composition.css";
import { createSceneMotion } from "./ui/motion/controller.js";
import { createWorldCamera } from "./ui/camera/world-camera.js";
import { guestScene } from "./ui/guest-scene.js";
import { renderScene, reconcileNode } from "./ui/motion/scene-dom.js";
import { observeRecipeList } from "./ui/recipe-list.js";
import { createWorldCanvas } from "./ui/renderer/world-canvas.js";
import { createGuestMotion } from "./ui/guest-motion.js";
import { createWorkstations } from "./ui/workstation-controller.js";
import { bindPointerControls } from "./ui/pointer-controls.js";
import { ingredientRack } from "./ui/ingredient-rack.js";
import {
  pourFeedback,
  touchFeedback,
  moneyFeedback,
  ingredientFlight,
  objectFeedback,
  servedFeedback,
} from "./ui/experience.js";
import { noodleSurcharge } from "./systems/handmade.js";
import { petScene } from "./ui/pets.js";
import { dialogueMotion } from "./ui/dialogue.js";
import { characterReview } from "./ui/character-review.js";
import { previewV2 } from "./ui/art-v2.js";
import {
  debugEnabled,
  debugStorage,
  mountDebug,
  debugTick,
} from "./ui/debug.js";
import { Engine } from "./systems/engine.js";
import { recipeBook } from "./systems/discovery.js";
import { SaveService } from "./systems/save.js";
import { validState } from "./systems/validation.js";
import { newState } from "./systems/state.js";
import { AudioSystem } from "./systems/audio.js";
import { mountSoundLab, updateAudioStatus } from "./ui/sound-lab.js";
import audioActions from "../data/audio-actions.json" with { type: "json" };
const soundMode = new URLSearchParams(location.search).get("debug") === "sound";
import { yen, quotedOrderTotal } from "./systems/economy.js";
import { sideId, sideName } from "./systems/sides.js";
import { drinkOrderLabel } from "./systems/drink-temperature.js";
import { count } from "./systems/inventory.js";
import { DRINKS, INGREDIENTS, EVENTS, DECOR, SIDES } from "./data.js";
import labels from "../data/ui-labels.vi.json" with { type: "json" };
import { projectY, playHeight, projectLayer } from "./ui/room-composition.js";
import {
  sceneArt,
  icon,
  toolIcon,
  person,
  portrait,
  bowl,
  foodIcon,
  drinkArt,
} from "./ui/art.js";
import {
  artPreview,
  assetUrl,
  sceneHotspots,
  sprite,
  layoutFor,
  layerStyle,
} from "./ui/assets.js";
import strings from "../data/strings.vi.json" with { type: "json" };
import miniGameArt from "../data/mini-game-art.json" with { type: "json" };
import { panelContent, btn, esc } from "./ui/panels.js";
import { cookingStatus } from "./ui/cooking-status.js";

const app = document.querySelector("#app"),
  save = new SaveService(debugStorage),
  loaded = save.load();
// MediaQueryList.matches stays live when the OS preference changes.
const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const ui = {
  artPreview: new URLSearchParams(location.search).has("art-preview"),
  previewVersion:
    Number(new URLSearchParams(location.search).get("art-preview")) || 1,
  artSelected: "",
  started: false,
  scene: "front",
  panel: null,
  returnPanel: null,
  panelHistory: [],
  premium: false,
  recipeFilter: "all",
  pot: 0,
  selectedTopping: null,
  selectedDish: null,
  noodleSelected: false,
  handmadePreview: false,
  cuts: [],
  notice: "",
  showHint: false,
  customerId: null,
  petAction: "",
  dishId: null,
};
let engine = new Engine(loaded || newState(), onEvent),
  audio = new AudioSystem(engine.s.settings),
  noticeTimer,
  renderQueued = false,
  lastTick = performance.now(),
  renderRevision = 0,
  signature = "",
  lastReminderDay = null,
  openingTimer;
let backgroundAt = null;
const clockUI = createClockUI({
  state: () => engine.s,
  lastTick: () => lastTick,
  pauseReason: () => pauseReason(ui, document.hidden),
});
const workstations = createWorkstations({
  getEngine: () => engine,
  ui,
  render: queueRender,
  refresh: render,
  paused: () => Boolean(pauseReason(ui, document.hidden)),
  notify,
  animate: canAnimate,
  audio,
  showPanel,
});
workstations.bind(app);
const guests = createGuestMotion({
  state: () => engine.s,
  scene: () => ui.scene,
  ui,
  moving: canAnimate,
  blocked: () => Boolean(ui.panel && !isWorkstation(ui.panel)),
  visible: (el) => camera.contains(el),
  renderer: () => worldCanvas,
  dimensions: () => camera.dimensions(),
});
const camera = createWorldCamera({
  scenes: () => scenes(),
  selected: () => ui.scene,
  label: (id) => scenes().find((x) => x.id === id)?.name || id,
  room: renderWorldRoom,
  revision: () => `${renderRevision}:${sceneSignature()}`,
  moving: canAnimate,
  blocked: () => Boolean(ui.panel),
  pointerActive: () => pointer.active(),
  changed(id) {
    const previous = ui.scene;
    ui.scene = id;
    syncCameraChrome(previous);
  },
  visibleChanged(changed) {
    if (changed) motion.reconcile();
  },
  wake: () => motion.update(),
});
const worldCanvas = createWorldCanvas({
  camera,
  blocked: () => Boolean(ui.panel) || document.hidden,
  revision: () => `${renderRevision}:${sceneSignature()}`,
  wake: () => motion.reconcile(),
});
const motion = createSceneMotion({
  clock: () =>
    ui.started && (!pauseReason(ui, document.hidden) || clockUI.perf),
  frame: (now) => {
    clockUI.frame(now);
    workstations.frame(now);
  },
  state: () => engine.s,
  moving: canAnimate,
  guests,
  camera,
  renderer: worldCanvas,
  pending: () => renderQueued && !pointer.active(),
  flush() {
    if (renderQueued && !pointer.active()) renderPreservingScroll();
  },
  blocked: () => ui.artPreview || Boolean(ui.panel && !isWorkstation(ui.panel)),
});
let displayedMoney = engine.s.money;
let petActionTimer;
const scenes = () =>
  layoutFor("world").order.flatMap((id) =>
    id === "guests"
      ? Array.from({ length: engine.s.upgrades.seats + 1 }, (_, i) => ({
          id: "guests" + i,
          name: i ? textVi("t_aff53ebc9e3e") + i : strings.scenes.guests.name,
          sub: strings.scenes.guests.sub,
        }))
      : [{ id, ...strings.scenes[id] }],
  );
function onEvent(e) {
  if (e.type === "tick" || e.type === "change")
    audio?.observeGuests(
      engine.s,
      ui.scene,
      !ui.started || Boolean(pauseReason(ui, document.hidden)),
    );
  if (e.type === "washed") {
    workstations.washed(e.count);
    save.save(engine.s);
  }
  if (e.sound) audio?.play(e.sound);
  if (e.type === "notice" || e.type === "arrival") notify(e.text);
  if (e.type === "change" || e.type === "autosave") {
    guests.observe(engine.s);
    save.save(engine.s);
    if (e.type === "change") queueRender();
  }
  if (engine.s.phase === "summary" && ui.started && ui.panel !== "summary") {
    clearPanelNavigation();
    ui.panel = "summary";
    queueRender();
  }
}
function notify(text) {
  ui.notice = text;
  clearTimeout(noticeTimer);
  for (const el of document.querySelectorAll("#toast,#panel-toast")) {
    el.textContent = text;
    el.classList.add("show");
  }
  noticeTimer = setTimeout(() => {
    ui.notice = "";
    document
      .querySelectorAll("#toast,#panel-toast")
      .forEach((el) => el.classList.remove("show"));
  }, 4400);
}
function queueRender() {
  renderQueued = true;
  motion.update();
}
function tutorial() {
  const s = engine.s;
  if (ui.scene === "garden") return textVi("t_c6df26bfdbc3");
  if (s.tutorial >= 5 || s.phase !== "open") return "";
  if (!s.customers.some((c) => c.accepted)) return textVi("t_06de28cf26fe");
  if (ui.scene.startsWith("guests"))
    return s.tray.length ? textVi("t_ea052a895979") : textVi("t_3dac86c5834c");
  if (ui.scene === "kitchen")
    return s.pots.some((p) => p?.stage === "ready")
      ? textVi("t_15668c4edda9")
      : s.pots.some(Boolean)
        ? textVi("t_11b398c515d8")
        : textVi("t_e3d78399b70d");
  if (ui.scene === "drinks") return textVi("t_e80704bb13ac");
  return textVi("t_c6df26bfdbc3");
}
function syncCameraChrome(previous) {
  const stage = document.querySelector("#stage"),
    game = stage?.closest(".game");
  if (!game) return;
  const list = scenes(),
    idx = list.findIndex((x) => x.id === ui.scene),
    area = list[idx];
  if (!area) return;
  stage.classList.remove(previous);
  stage.classList.add(ui.scene);
  stage.setAttribute("aria-label", area.name);
  game.querySelector(".scene-heading h1").textContent = area.name;
  game.querySelector(".scene-heading .eyebrow").textContent = area.sub;
  function patch(
    selector,
    html,
    parent = game,
    before = game.querySelector(".scene-pagination"),
  ) {
    const old = parent.querySelector(selector),
      template = document.createElement("template");
    template.innerHTML = html;
    const fresh = template.content.firstElementChild;
    if (!fresh) old?.remove();
    else if (old) reconcileNode(old, fresh);
    else parent.insertBefore(fresh, before);
  }
  patch(
    ".front-enter",
    ui.scene === "front"
      ? btn(
          `${labels.chrome.enter} ${icon("arrow", 18)}`,
          "enter-shop",
          "",
          "front-enter primary",
        )
      : "",
    game.querySelector(".scene-heading"),
    null,
  );
  patch(
    ".scene-arrow.left",
    idx > 0
      ? btn(
          icon("arrow", 20) + textVi("t_55fab1f8b8e6"),
          "nav",
          "-1",
          "scene-arrow left",
        )
      : "",
    stage,
    null,
  );
  patch(
    ".scene-arrow.right",
    idx < list.length - 1
      ? btn(
          icon("arrow", 20) + textVi("t_8fe88d5737c3"),
          "nav",
          "1",
          "scene-arrow right",
        )
      : "",
    stage,
    null,
  );
  patch(".direct-workbench", workstations.bench());
  const carrying = (id) =>
    ["kitchen", "drinks"].includes(id) || id.startsWith("guests");
  if (carrying(previous) !== carrying(ui.scene)) {
    patch(".wooden-tray", carrying(ui.scene) ? trayHTML() : "");
    patch(".food-trash", carrying(ui.scene) ? workstations.trash() : "");
  }
  if (!carrying(ui.scene) || carrying(previous) !== carrying(ui.scene)) {
    patch(
      ".scene-caption",
      carrying(ui.scene)
        ? ""
        : `<div class="scene-caption"><span class="caption-line"></span>${{ front: textVi("t_62eb577dd779"), storage: textVi("t_bce55790c947"), garden: textVi("t_60c39df779af") }[ui.scene] || ""}<span class="caption-line"></span></div>`,
    );
  }
  const hint = tutorial();
  patch(
    ".tutorial",
    hint
      ? `<div class="tutorial">${icon("leaf", 17)}<span>${hint}</span></div>`
      : "",
  );
  workstations.update();
}
function render() {
  if (soundMode) return;
  // UI/settings/decor/stock changes can leave the structural scene signature
  // unchanged. Invalidate detached rooms on every explicit state/UI render.
  renderRevision++;
  const previousPanel = document.querySelector(".sheet")?.dataset.panel;
  renderQueued = false;
  signature = sceneSignature();
  const s = engine.s;
  app.style.setProperty(
    "--shop-lantern-fade",
    `${balance.shopFeedback.lanternFadeMilliseconds}ms`,
  );
  app.className = [
    s.settings.animation ? "" : "no-motion",
    s.settings.performance ? "low-performance" : "",
    s.settings.font === "large" ? "large-font" : "",
    s.settings.contrast ? "high-contrast" : "",
  ].join(" ");
  if (ui.artPreview) {
    app.innerHTML =
      ui.previewVersion === 3
        ? characterReview(ui.artSelected)
        : ui.previewVersion === 2
          ? previewV2(ui.artSelected)
          : artPreview(ui.artSelected);
    return;
  }
  if (!ui.started) {
    renderLanding();
    camera.reconcile();
    motion.reconcile();
    return;
  }
  const list = scenes(),
    idx = list.findIndex((x) => x.id === ui.scene),
    area = list[idx] || list[0],
    carry =
      ["kitchen", "drinks"].includes(ui.scene) || ui.scene.startsWith("guests");
  renderScene(
    app,
    `<main class="game live-v2" aria-label="${textVi("t_4dbe9bba5ed6")}" ${ui.panel && !isWorkstation(ui.panel) ? "inert" : ""}><header class="hud"><div class="day-weather">${clockFace(s)}<div><strong>${textVi("t_c4c3ca76027f")} ${s.day}</strong><small id="clock">${gameTime()}</small></div>${forecastChip(s)}</div><div class="wallet"><strong id="money">${yen(s.money)}</strong><small>${icon("star", 12)} <span id="reputation">${s.reputation.toFixed(1)}</span> ${textVi("t_1a77749d36e2")}</small></div>${btn(icon("gear", 23) + textVi("t_37f248959e71"), "panel", "settings", "icon-button", "")}</header><div class="scene-heading"><span class="eyebrow">${area.sub}</span><h1>${area.name}</h1><span class="season-note">${textVi("t_4cdceafea66f")} ${s.forecast.season.toLowerCase()}${s.forecast.event ? ` · ${EVENTS[s.forecast.event].name}` : ""}</span></div><section class="stage world-camera ${ui.scene} ${isEvening(s) ? "evening" : ""} ${s.forecast.event === "power" && s.elapsed >= balance.events.powerStartSeconds && s.elapsed < balance.events.powerEndSeconds ? "power-out" : ""}" id="stage" aria-label="${area.name}"><canvas class="world-canvas" data-world-owned data-motion-key="world-canvas" aria-hidden="true"></canvas><div class="world-strip" data-world-owned data-motion-key="world-strip"></div>${idx > 0 ? btn(icon("arrow", 20) + textVi("t_55fab1f8b8e6"), "nav", "-1", "scene-arrow left") : ""}${idx < list.length - 1 ? btn(icon("arrow", 20) + textVi("t_8fe88d5737c3"), "nav", "1", "scene-arrow right") : ""}</section>${workstations.bench()}${carry ? workstations.trash() : ""}${tutorial() ? `<div class="tutorial">${icon("leaf", 17)}<span>${tutorial()}</span></div>` : ""}${carry ? trayHTML() : `<div class="scene-caption"><span class="caption-line"></span>${{ front: textVi("t_62eb577dd779"), storage: textVi("t_bce55790c947"), garden: textVi("t_60c39df779af") }[ui.scene] || ""}<span class="caption-line"></span></div>`}${shopOverlays(ui)}<nav class="scene-pagination" aria-label="${textVi("t_3a883820165a")}">${list.map((x, i) => btn(`<span></span><span class="sr-only">${x.name}</span>`, "goto", x.id, i === idx ? "active" : "")).join("")}</nav><footer class="bottom-tools">${btn(toolIcon("book") + `<span class="tool-label">${labels.chrome.recipes}</span>`, "panel", "recipes")}${btn(toolIcon("leaf") + `<span class="tool-label">${labels.chrome.manage}</span>`, "panel", "manage")}</footer><div id="toast" class="toast ${ui.notice ? "show" : ""}" role="status" aria-live="polite">${esc(ui.notice)}</div>${save.error ? `<div class="save-warning">${save.error}</div>` : ""}${ui.panel && isWorkstation(ui.panel) ? renderPanel() : ""}</main>${ui.panel && !isWorkstation(ui.panel) ? renderPanel() : ""}<input type="file" id="import-file" accept="application/json" hidden>`,
  );
  camera.reconcile();
  workstations.update();
  observeRecipeList();
  motion.reconcile();
  updateAudioStatus(app, audio);
  if (ui.scene === "front") {
    document
      .querySelector(".scene-heading")
      .insertAdjacentHTML(
        "beforeend",
        btn(
          `${labels.chrome.enter} ${icon("arrow", 18)}`,
          "enter-shop",
          "",
          "front-enter primary",
        ),
      );
  }
  if (s.money !== displayedMoney) {
    const delta = s.money - displayedMoney;
    displayedMoney = s.money;
    if (canAnimate()) moneyFeedback(delta);
  }
  if (ui.panel === "order") {
    const actions = document.querySelector(
      '.sheet[data-panel="order"] .button-pair',
    );
    if (actions) {
      actions.classList.add("order-actions");
      actions.closest(".sheet").append(actions);
    }
  }
  dialogueMotion(
    document.querySelector("blockquote.dialogue"),
    s.settings,
    canAnimate(),
  );
  if (previousPanel === ui.panel) {
    for (const node of document.querySelectorAll(".modal-backdrop,.sheet"))
      node.style.animation = "none";
  }
  if (ui.panel)
    setTimeout(() => {
      const dialog = document.querySelector(".sheet");
      if (dialog && !dialog.contains(document.activeElement))
        dialog.focus({ preventScroll: true });
    }, 0);
}
function renderLanding() {
  const s = engine.s;
  app.innerHTML = `<main class="game landing"><header class="landing-top"><span class="eyebrow">${textVi("t_b244611b4e0c")}</span><h1>${textVi("t_a2bf98f57dd5")} <em>Udon</em></h1><p>${textVi("t_10f773e31d0f")}</p></header><div class="landing-art" role="img" aria-label="${textVi("t_a64fb6d4d61f")}">${sceneArt("front", s)}${weatherOverlay()}<div class="landing-welcome" aria-hidden="true">${icon("leaf", 18)}<span>${textVi("t_c4393930d817")}</span></div></div><div class="landing-bottom"><p>${textVi("t_e1e2147db8d2")}<br>${textVi("t_99cd47c063c0")}</p>${btn(`${loaded ? textVi("t_593c40afa229") : textVi("t_3927f9950547")} ${icon("arrow", 19)}`, "start", "", "primary wide")}<small>${loaded ? `${textVi("t_c4c3ca76027f")} ${s.day} · ${yen(s.money)} · ${textVi("t_1de3cf2903b3")}` : textVi("t_19af9e73e592")}</small></div></main>`;
}
function gameTime() {
  return clockText(engine.s);
}

function setShopOpen(wanted) {
  const s = engine.s;
  const changed = wanted
    ? s.phase === "morning"
      ? engine.open()
      : engine.reopen()
    : engine.close();
  if (!changed) return;
  clearPanelNavigation();
  ui.panel = null;
  ui.lateReminder = false;
  if (!wanted) lastReminderDay = s.day;
  clearTimeout(openingTimer);
  ui.shopAnnouncement = wanted;
  if (wanted)
    openingTimer = setTimeout(() => {
      ui.shopAnnouncement = false;
      app.querySelector(".shop-announcement")?.remove();
    }, balance.shopFeedback.openingMilliseconds);
  render();
}
function staffVisual(scene = ui.scene) {
  const s = engine.s;
  if (!scene.startsWith("guests") && scene !== "kitchen") return "";
  return Object.entries(layoutFor(scene).staff || {})
    .filter(([id]) => s.employees[id])
    .map(
      ([id, placement]) =>
        `<div class="scene-staff" data-staff="${id}" data-motion-key="staff:${id}" style="${layerStyle(placement, scene)}${placement.counterY ? `;clip-path:inset(0 0 ${Math.max(0, ((projectY(scene, placement.y, playHeight()) - projectY(scene, placement.counterY, playHeight())) / projectLayer(scene, placement).height) * 100)}% 0)` : ""}" aria-hidden="true">${person({ id })}</div>`,
    )
    .join("");
}
function flowerVisual(scene = ui.scene) {
  const room = scene.startsWith("guests") ? "guests" : scene;
  return engine.s.flowerRooms[room] > engine.s.day
    ? `<div class="room-bouquet" aria-label="${textVi("t_eb932bb2d303")}">${sprite("flowers")}</div>`
    : "";
}
function weatherOverlay(scene = ui.scene) {
  const s = engine.s;
  if (!["front", "garden"].includes(scene)) return "";
  if (s.forecast.weather === "sun")
    return s.forecast.season === textVi("t_ccceff168e76")
      ? '<div class="petals" aria-hidden="true">' +
          Array.from(
            { length: 8 },
            (_, i) =>
              `<span style="--i:${i};--x:${(i * 5) % 8}">${sprite("ui-weather-petal", "", "weather-particle")}</span>`,
          ).join("") +
          "</div>"
      : "";
  return `<div class="weather ${s.forecast.weather}" aria-hidden="true">${Array.from({ length: s.settings.performance ? 8 : 22 }, (_, i) => `<span style="--i:${i};--x:${(i * 7) % 23}">${sprite(`ui-weather-${s.forecast.weather}`, "", "weather-particle")}</span>`).join("")}</div>`;
}
function sceneControls(scene = ui.scene) {
  const s = engine.s;
  const view = { ...ui, scene };
  if (["front", "garden"].includes(scene))
    return (
      petScene(s, scene, ui.petAction) + (scene === "front" ? doorSign(s) : "")
    );
  if (scene === "storage")
    return btn(
      `${icon("bag", 24)}<span>${labels.stock.supply}</span>`,
      "panel",
      "inventory",
      "pantry-supply",
    );
  if (scene.startsWith("guests")) return guestScene(s, view, canAnimate());
  if (["kitchen", "drinks"].includes(scene)) return workstations.scene(view);
  return "";
}
function renderWorldRoom(scene) {
  const s = engine.s,
    view = { ...ui, scene };
  const content = `${sceneArt(scene, s, !ui.panel)}${ingredientRack(scene, s, view)}${staffVisual(scene)}${sceneHotspots(scene)}${sceneControls(scene)}${flowerVisual(scene)}${weatherOverlay(scene)}`;
  return `<div class="scene-world">${scene === "garden" ? `<div class="garden-content" data-motion-key="garden-content">${content}</div>` : content}</div>`;
}

function trayHTML() {
  const s = engine.s;
  return `<section class="wooden-tray" data-drop="tray" aria-label="${textVi("t_4caef14d2ef8")}"><div class="tray-label"><span>${textVi("t_9dc8c5f59359")}</span><small>${s.tray.length ? (ui.selectedDish ? textVi("t_09aa420bdb19") : textVi("t_defe158c9f27")) : textVi("t_c50dfe737273")}</small><b>${s.tray.length}/5</b></div><div class="tray-slots" style="--tray-art:url('${assetUrl("v3-wooden-tray")}')">${Array.from(
    { length: 5 },
    (_, i) => {
      const d = s.tray[i],
        c = d && s.customers.find((c) => c.id === d.orderId);
      return d
        ? `<button class="tray-slot filled ${ui.selectedDish === d.id ? "selected" : ""} ${s.decor.mat ? "with-mat" : ""}" data-act="dish" data-arg="${d.id}" data-drag="dish:${d.id}" data-drop="dish:${d.id}" aria-label="${textVi("t_b34543c78567")} ${c?.name || textVi("t_2a4a336a7656")}${c?.combo ? `, ${textVi("t_a6519742fd9f")} ${(d.partIndex ?? 0) + 1} trong ${c.combo.parts.length}` : ""}"><span class="dish-name">${c ? `#${c.seat + 1}` : textVi("t_8793b51b1c6c")}${c?.combo ? ` · ${(d.partIndex ?? 0) + 1}/${c.combo.parts.length}` : ""}</span>${s.decor.mat ? sprite("tray-woven-mat", "", "tray-mat") : ""}${bowl(d, s.decor.bowl ? "#739b99" : "#b76f51", true)}${d.temperature !== "cold" ? sprite("kitchen-steam", "", "tray-steam") : ""}${trayAccessories(s, d)}${d.drink ? `<span class="tiny-drink ${s.decor.cup ? "blue-cup" : ""}" title="${drinkOrderLabel(d)}" data-temperature="${d.drinkTemperature || DRINKS[d.drink]?.temperature || "hot"}"><span class="sr-only">${drinkOrderLabel(d)}</span>${drinkArt(d.drink, "", d.drinkTemperature, d.drinkTopping)}${(d.drinkTemperature || DRINKS[d.drink]?.temperature || "hot") !== "cold" ? sprite("kitchen-steam", "", "tray-steam") : ""}</span>` : ""}${d.side ? `<span class="tiny-side" title="${sideName(d)}">${sprite("tray-saucer", "", "side-plate")}${sprite(SIDES[sideId(d)].art, "", "side-food")}</span>` : ""}<small>${d.drink ? (d.strangeDrink ? textVi("t_72efca3314eb") : labels.drinks[d.drink] || DRINKS[d.drink].name) : d.side ? SIDES[sideId(d)].shortName : ""}</small></button>`
        : `<div class="tray-slot empty" aria-label="${textVi("t_3a2b3576be6b")} ${i + 1}"><span>${i + 1}</span></div>`;
    },
  ).join("")}</div></section>`;
}
function trayAccessories(s, d) {
  return `${s.decor.chopsticks ? sprite("tray-chopsticks", "", "accessory chopsticks") : ""}${s.decor.spoon ? sprite("tray-spoon", "", "accessory spoon") : ""}${s.decor.coaster && d.drink ? sprite("tray-coaster", "", "accessory coaster") : ""}${s.decor.saucer || d.side ? sprite("tray-saucer", "", "accessory saucer") : ""}`;
}
function isWorkstation(panel) {
  return ["cook", "broth", "brew", "fryer", "chop", "handmade"].includes(panel);
}
function renderPanel() {
  const panelIcon = ui.panel === "audio-info" ? toolIcon : icon;
  const workstation = isWorkstation(ui.panel);
  const fixed = ["morning", "summary"].includes(ui.panel);
  const content = panelContent(ui.panel, engine.s, ui);
  const template = document.createElement("template");
  template.innerHTML = content;
  const label =
    template.content.querySelector(".panel-heading h2")?.textContent ||
    textVi("t_db95d601eb8b");
  const back = ui.panelHistory.length > 0;
  const backLabel = textVi("t_02c55bbac898");
  const orderCustomer =
    ui.panel === "order"
      ? engine.s.customers.find((customer) => customer.id === ui.customerId)
      : null;
  const title =
    ui.panel === "order"
      ? `${textVi("t_368c66eeb07a")}${orderCustomer ? `<strong class="order-header-price">${yen(orderCustomer.combo ? quotedOrderTotal(engine.s, orderCustomer) : engine.s.prices[orderCustomer.recipe] + noodleSurcharge(orderCustomer))}</strong>` : ""}`
      : esc(label);
  return `<div class="modal-backdrop ${workstation ? "station-backdrop" : ui.panel === "order" ? "order-backdrop" : ""}" ${fixed ? "" : 'data-dismiss-backdrop="true"'}><section class="sheet ${workstation ? "station-panel" : ""} ${ui.panel === "cook" ? "cook-sheet" : ""} ${back ? "has-panel-back" : ""}" data-panel="${ui.panel}" role="dialog" aria-modal="${!workstation}" aria-labelledby="panel-title" tabindex="-1">${orderCustomer ? `<span class="panel-portrait">${portrait(orderCustomer)}</span>` : ""}<div class="sheet-grip"></div><div class="sheet-title" id="panel-title" role="heading" aria-level="2">${title}</div>${back ? btn(panelIcon("arrow", 20) + `<span class="sr-only">${esc(backLabel)}</span>`, "panel-back", "", "back-sheet icon-button") : ""}${btn(panelIcon("close", 21) + textVi("t_170b96b94f4e"), "dismiss", "", "close-sheet icon-button")}<div id="panel-toast" class="panel-notice ${ui.notice ? "show" : ""}" role="status">${esc(ui.notice)}</div><div class="sheet-content" id="sheet-content">${content}</div></section></div>`;
}
function clearPanelNavigation() {
  ui.panelHistory = [];
  ui.returnPanel = null;
}
function clearNotice() {
  clearTimeout(noticeTimer);
  ui.notice = "";
}
function restorePanelScroll(top) {
  const content = document.querySelector(".sheet-content");
  if (content) content.scrollTop = top;
}
function updateReturnPanel() {
  const parent = ui.panelHistory.at(-1)?.name;
  ui.returnPanel =
    ["recipes", "broth"].includes(ui.panel) &&
    ["cook", "broth"].includes(parent)
      ? parent
      : null;
}
function showPanel(name) {
  if (name === ui.panel) return;
  if (name === "handmade") ui.handmadePreview = false;
  clearNotice();
  const previous = ui.panelHistory.findIndex((entry) => entry.name === name);
  let top = 0;
  if (previous >= 0) {
    top = ui.panelHistory[previous].scrollTop;
    ui.panelHistory.splice(previous);
  } else if (ui.panel) {
    ui.panelHistory.push({
      name: ui.panel,
      scrollTop: document.querySelector(".sheet-content")?.scrollTop || 0,
    });
  }
  ui.panel = name;
  updateReturnPanel();
  ui.showHint = false;
  render();
  restorePanelScroll(top);
}
function panelBack() {
  const parent = ui.panelHistory.pop();
  if (!parent) return;
  clearNotice();
  ui.panel = parent.name;
  updateReturnPanel();
  render();
  restorePanelScroll(parent.scrollTop);
}
function dismiss() {
  // Keep the established close-to-pot behavior for the cooking references.
  if (ui.returnPanel) return panelBack();
  clearPanelNavigation();
  ui.panel = null;
  render();
}
function navigate(dir) {
  const list = scenes(),
    i = list.findIndex((x) => x.id === ui.scene);
  go(list[Math.max(0, Math.min(list.length - 1, i + dir))].id);
}
function go(id, instant = false) {
  if (!scenes().some((x) => x.id === id)) return;
  workstations.reset();
  clearPanelNavigation();
  const hadPanel = Boolean(ui.panel);
  ui.panel = null;
  ui.selectedTopping = null;
  if (hadPanel) render();
  else syncCameraChrome(ui.scene);
  camera.go(id, instant);
  save.save(engine.s);
}
function handle(act, arg, el) {
  audio.start();
  if (act !== "wash") audio.play(audioActions[act] || "click");
  if (canAnimate()) touchFeedback(el);
  if (workstations.handle(act, arg, el)) return;
  const s = engine.s;
  switch (act) {
    case "pet-adopt":
      engine.adoptPet(arg);
      break;
    case "pet-care":
      if (engine.petCare(arg)) {
        ui.petAction = arg;
        clearTimeout(petActionTimer);
        petActionTimer = setTimeout(() => {
          ui.petAction = "";
          if (ui.panel === "pets" || ["front", "garden"].includes(ui.scene))
            queueRender();
        }, 1800);
      }
      break;
    case "pet-buy":
      engine.buyPetSnacks();
      break;
    case "pet-rename":
      engine.renamePet(document.querySelector("#pet-name")?.value || "");
      break;
    case "discard-stock":
      engine.discardStock(arg);
      break;
    case "stock-detail":
      ui.stockId = arg;
      showPanel("stock-detail");
      break;
    case "finish-style": {
      const [i, style] = arg.split(":");
      engine.finishStyle(Number(i), style);
      break;
    }
    case "close-day":
      setShopOpen(false);
      break;
    case "finish-day":
      if (!engine.finishClose()) notify(labels.shop.finishHelp);
      break;
    case "reminder-close":
      setShopOpen(false);
      break;
    case "reminder-continue":
      lastReminderDay = s.day;
      ui.lateReminder = false;
      render();
      break;
    case "burner":
      engine.burnerStep(Number(arg));
      break;
    case "drop-noodles":
      engine.noodles(Number(arg));
      break;
    case "lift-noodles":
      engine.liftNoodles(Number(arg));
      break;
    case "batch-add":
      if (engine.brothAdd(arg)) flyBrothIngredient(el);
      break;
    case "rack-broth":
      if (ui.panel !== "broth") showPanel("broth");
      if (engine.brothAdd(arg)) flyBrothIngredient(el);
      break;
    case "rack-flour":
      showPanel("handmade");
      break;
    case "rack-topping":
      if (!s.pots[ui.pot]?.poured) {
        showPanel("cook");
        notify(textVi("t_e2717dd68e87"));
      } else {
        ui.selectedTopping = arg;
        if (ui.panel !== "cook") showPanel("cook");
        queueRender();
      }
      break;
    case "rack-drink": {
      if (!s.drink) {
        showPanel("brew");
        notify(textVi("t_95be55107a14"));
        break;
      }
      const step = DRINK_METHODS[s.drink.id]?.[s.drink.step];
      if (!step) {
        showPanel("brew");
        break;
      }
      if (ui.panel !== "brew") showPanel("brew");
      const action = step.items?.includes(arg)
        ? step.action
        : Object.values(DRINK_METHODS)
            .flat()
            .find((item) => item.items?.includes(arg))?.action;
      if (action) advanceDrink(action, el);
      else notify(textVi("t_ad4409fa779a"));
      break;
    }
    case "batch-cook":
      engine.brothCook();
      break;
    case "batch-reset":
      engine.brothReset();
      break;
    case "handmade":
      advanceHandmade();
      break;
    case "noodle-tier":
      s.noodleTier = arg;
      engine.changed();
      break;
    case "fertilize":
      engine.fertilize(Number(arg));
      break;
    case "arrange-flowers":
      engine.arrangeFlowers(arg);
      break;
    case "name-recipe":
      engine.nameRecipe(document.querySelector("#recipe-name")?.value || "");
      break;
    case "drink-discard":
      s.drink = null;
      engine.changed();
      break;
    case "art-preview":
      ui.previewVersion = Number(arg) || 1;
      ui.artPreview = true;
      render();
      break;
    case "inspect-art":
      ui.artSelected = arg;
      render();
      break;
    case "exit-art":
      ui.artPreview = false;
      ui.panel = null;
      history.replaceState(null, "", location.pathname);
      render();
      break;
    case "enter-shop":
      if (s.phase === "summary") showPanel("summary");
      else go("guests0");
      break;
    case "start":
      clearPanelNavigation();
      ui.started = true;
      ui.panel = s.phase === "summary" ? "summary" : null;
      ui.scene = s.phase === "open" ? "guests0" : "front";
      save.save(s);
      render();
      break;
    case "panel":
      showPanel(arg);
      break;
    case "panel-back":
      panelBack();
      break;
    case "dismiss":
      dismiss();
      break;
    case "nav":
      navigate(Number(arg));
      break;
    case "goto":
      go(arg);
      break;
    case "toggle-shop":
      if (s.phase === "summary") showPanel("summary");
      else setShopOpen(!isShopOpen(s));
      break;
    case "open":
      setShopOpen(true);
      if (isShopOpen(s)) {
        go("guests0", true);
      }
      break;
    case "next-day":
      engine.nextDay();
      clearTimeout(openingTimer);
      ui.shopAnnouncement = false;
      ui.lateReminder = false;
      clearPanelNavigation();
      ui.panel = null;
      ui.scene = "front";
      render();
      break;
    case "eggs":
      engine.prepareEgg();
      break;
    case "quality":
      ui.premium = arg === "premium";
      renderPreservingScroll();
      break;
    case "recipe-filter":
      ui.recipeFilter = ["all", "learned", "unlearned"].includes(arg)
        ? arg
        : "all";
      render();
      document.querySelector(".sheet-content")?.scrollTo(0, 0);
      break;
    case "buy":
      engine.buy(arg, 5, ui.premium);
      break;
    case "customer": {
      const c = s.customers.find((c) => c.id === arg);
      if (!c) break;
      if (c.status === "dirty") {
        const from = el?.getBoundingClientRect();
        if (engine.clear(arg) && canAnimate() && from) {
          const l = layoutFor("kitchen").layers.find((x) => x.id === "sink");
          const width = camera.dimensions().width;
          const target = {
            x:
              (scenes().findIndex((x) => x.id === "kitchen") -
                camera.stats().offset) *
                width +
              (width * l.x) / 100 -
              20,
            y:
              parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue(
                  "--safe-top",
                ),
              ) +
              (projectY("kitchen", l.y, playHeight()) * playHeight()) / 100 -
              20,
            width: 40,
            height: 40,
          };
          ingredientFlight(
            sprite("gdw-dirty-bowl"),
            { getBoundingClientRect: () => from },
            target,
          );
        }
        break;
      }
      if (c.status === "checkout") {
        engine.checkout(arg);
        break;
      }
      if (["eating", "checkout", "departing"].includes(c.status)) break;
      if (ui.selectedDish) {
        if (engine.serve(ui.selectedDish, arg)) {
          ui.selectedDish = null;
          if (canAnimate())
            servedFeedback(c.id, c.result?.correct && c.result.score >= 85);
        }
        render();
        break;
      }
      ui.customerId = arg;
      ui.showHint = false;
      if (!c.accepted) engine.accept(arg);
      showPanel("order");
      break;
    }
    case "order":
      ui.customerId = arg;
      ui.showHint = false;
      if (!s.customers.find((c) => c.id === arg)?.accepted) engine.accept(arg);
      showPanel("order");
      break;
    case "hint":
      engine.ask(arg);
      ui.showHint = true;
      break;
    case "accept":
      if (!s.customers.find((c) => c.id === arg)?.accepted) engine.accept(arg);
      dismiss();
      break;
    case "select-order":
      s.selectedOrder = arg;
      s.selectedPart = 0;
      engine.changed();
      break;
    case "select-part": {
      const [orderId, partIndex] = arg.split(":");
      engine.selectPart(orderId, Number(partIndex));
      break;
    }
    case "noodles":
      ui.noodleSelected = !ui.noodleSelected;
      notify(textVi("t_93553068b09f"));
      render();
      break;
    case "pot": {
      const i = Number(arg);
      if (ui.noodleSelected && !s.pots[i]) {
        engine.noodles(i);
        ui.noodleSelected = false;
      } else {
        ui.pot = i;
        ui.selectedTopping = null;
        showPanel("cook");
      }
      break;
    }
    case "broth":
      engine.broth(ui.pot, arg);
      break;
    case "pour":
      if (engine.pour(ui.pot)) pourEffect();
      break;
    case "select-topping":
      ui.selectedTopping = arg;
      renderPreservingScroll();
      break;
    case "add-topping":
      if (ui.selectedTopping) {
        const topping = ui.selectedTopping;
        if (engine.topping(ui.pot, topping)) {
          flyTopping(topping);
          ui.selectedTopping = null;
        }
      }
      break;
    case "tray":
      if (engine.tray(Number(arg))) dismiss();
      break;
    case "discard":
      engine.discard(Number(arg));
      dismiss();
      break;
    case "fry-select":
      engine.fry("select");
      break;
    case "broth-source":
      engine.selectBroth(arg);
      break;
    case "fry-step": {
      const [i, a] = arg.split(":");
      engine.fry(a, Number(i));
      break;
    }
    case "chop-open":
      ui.cuts = [];
      showPanel("chop");
      break;
    case "wash":
      workstations.wash(el);
      break;
    case "drink-start":
      engine.drinkStart(arg);
      break;
    case "drink-step":
      advanceDrink(arg || undefined, el);
      break;
    case "drink-chill":
      if (engine.drinkChill() && canAnimate())
        objectFeedback(".brew-progress .drink-art.large");
      break;
    case "drink-topping":
      if (engine.drinkTopping(arg) && canAnimate())
        objectFeedback(".brew-progress .drink-art.large");
      break;
    case "dish": {
      ui.dishId = arg;
      if (s.drink) {
        showPanel("dish");
        break;
      }
      if (ui.scene.startsWith("guests")) {
        ui.selectedDish = ui.selectedDish === arg ? null : arg;
        notify(textVi("t_674cd48ec644"));
        render();
      } else showPanel("dish");
      break;
    }
    case "attach-drink":
      if (engine.attachDrink(arg)) dismiss();
      break;
    case "side":
      engine.side(...arg.split(":"));
      break;
    case "side-prep-start":
      engine.prepareSide(arg);
      break;
    case "side-prep-step":
      engine.sidePrepStep();
      break;
    case "remove-drink":
      engine.removeDrink(arg);
      break;
    case "clear-tray":
      engine.clearTray(arg);
      dismiss();
      break;
    case "toggle-menu":
      engine.menu(arg);
      break;
    case "unlock":
      engine.unlock(arg);
      break;
    case "upgrade":
      engine.upgrade(arg);
      break;
    case "preview-decor":
      ui.previewDecor = arg;
      ui.previewScene = ["cup", "coaster"].includes(arg) ? "drinks" : "guests0";
      showPanel("decor-preview");
      break;
    case "confirm-decor":
      if (engine.s.decor[DECOR[arg].slot] !== arg) engine.decorate(arg);
      showPanel("decor");
      break;
    case "hire":
      engine.hire(arg);
      break;
    case "teach-recipe":
      engine.teachRecipe(arg);
      break;
    case "plant": {
      const [i, id] = arg.split(":");
      engine.plant(Number(i), id);
      break;
    }
    case "garden":
      engine.garden(Number(arg));
      break;
    case "export": {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([JSON.stringify({ updatedAt: Date.now(), state: s })], {
          type: "application/json",
        }),
      );
      a.download = `udon-nang-ngay-${s.day}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      break;
    }
    case "import":
      document.querySelector("#import-file").click();
      break;
    case "reset":
      clearTimeout(openingTimer);
      lastReminderDay = null;
      ui.shopAnnouncement = false;
      ui.lateReminder = false;
      clearPanelNavigation();
      save.reset();
      engine = new Engine(newState(), onEvent);
      audio.settings = engine.s.settings;
      ui.started = true;
      ui.panel = null;
      ui.scene = "front";
      save.save(engine.s);
      render();
      break;
  }
}
function renderPreservingScroll() {
  const top = document.querySelector(".sheet-content")?.scrollTop || 0;
  const nameInput =
    document.activeElement?.id === "pet-name" ? document.activeElement : null;
  const draft = nameInput && {
    value: nameInput.value,
    start: nameInput.selectionStart,
    end: nameInput.selectionEnd,
  };
  render();
  const content = document.querySelector(".sheet-content");
  if (content) content.scrollTop = top;
  if (draft) {
    const input = document.querySelector("#pet-name");
    if (input) {
      input.value = draft.value;
      input.focus({ preventScroll: true });
      input.setSelectionRange(draft.start, draft.end);
    }
  }
}
function canAnimate() {
  return (
    engine.s.settings.animation &&
    !engine.s.settings.performance &&
    !reducedMotionQuery.matches
  );
}
function advanceDrink(action, origin, skill = 1) {
  const drink = engine.s.drink;
  const step = drink && DRINK_METHODS[drink.id]?.[drink.step];
  if (!engine.drinkStep(action, skill)) return false;
  if (canAnimate() && !drink.strange && step) {
    for (const [i, ingredient] of (step.items || []).entries()) {
      ingredientFlight(
        foodIcon(ingredient),
        origin || document.querySelector(".drink-gesture"),
        ".brew-progress .drink-art.large",
        i * 75,
      );
    }
    objectFeedback(
      ".brew-progress .drink-art.large",
      step.action === "whisk" ? "whisk" : "pop",
    );
  }
  return true;
}
function advanceHandmade(accuracy = 1) {
  const finishing = engine.s.handmade.stage === 4;
  if (engine.handmadeStep(accuracy)) ui.handmadePreview = finishing;
}
function flyTopping(id) {
  if (canAnimate())
    ingredientFlight(
      foodIcon(id),
      document.querySelector(
        '[data-act="select-topping"][data-arg="' + id + '"]',
      ),
      ".cook-bowl",
    );
}
function flyBrothIngredient(source) {
  if (canAnimate())
    ingredientFlight(sprite("v2-jar"), source, ".broth-pot-art");
}
function pourEffect() {
  if (canAnimate()) pourFeedback(".cook-bowl");
}
app.addEventListener("click", (e) => {
  if (pointer.ignoreClick(e)) return;
  const cut = e.target.closest("[data-cut]");
  if (cut) {
    cutLine(Number(cut.dataset.cut), 1);
    return;
  }
  const target = e.target.closest("[data-act]");
  if (target && !target.disabled) {
    handle(target.dataset.act, target.dataset.arg, target);
    return;
  }
  if (e.target.matches("[data-dismiss-backdrop]")) dismiss();
});
app.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.audioSetting)
    audio.setPreference(
      el.dataset.audioSetting,
      el.type === "checkbox" ? el.checked : Number(el.value),
    );
  if (el.dataset.setting) {
    engine.s.settings[el.dataset.setting] =
      el.type === "checkbox"
        ? el.checked
        : el.type === "range"
          ? Number(el.value)
          : el.value;
    audio.settings = engine.s.settings;
    engine.changed();
  }
  if (el.dataset.staffOption) {
    engine.s.staffOptions[el.dataset.staffOption] = el.checked;
    engine.changed();
  }
  if (el.dataset.price) engine.price(el.dataset.price, Number(el.value));
  if (el.id === "import-file" && el.files[0]) {
    try {
      const raw = JSON.parse(await el.files[0].text()),
        incoming = migrateState(raw.state);
      if (el.files[0].size > 2_000_000 || !validState(incoming)) throw Error();
      save.save(incoming);
      location.reload();
    } catch {
      notify(textVi("t_98fa2f12d477"));
    }
  }
});
function cutLine(i, accuracy) {
  if (ui.cuts.includes(i)) return;
  ui.cuts.push(i);
  engine.chop(accuracy);
  document.querySelector(`[data-cut="${i}"]`)?.classList.add("cut");
}
const pointer = bindPointerControls(app, {
  swipeSound: () => audio.play("swipe"),
  whiskSound: (active) => audio.setWhisking(active),
  getEngine: () => engine,
  work: workstations,
  handle,
  canAnimate,
  cutLine,
  advanceHandmade,
  advanceDrink,
  notify,
  navigate,
  camera,
  render,
  ui,
  servedFeedback,
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && ui.panel) dismiss();
  if (e.target.matches("input,select")) return;
  if (e.key === "ArrowLeft" && !ui.panel) navigate(-1);
  if (e.key === "ArrowRight" && !ui.panel) navigate(1);
  if (e.key === "Tab" && ui.panel && !isWorkstation(ui.panel)) {
    const focusable = [
      ...document.querySelectorAll(
        ".sheet button:not([disabled]),.sheet input,.sheet select",
      ),
    ];
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement.matches(".sheet"))
    ) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});
function sceneSignature() {
  const s = engine.s;
  return JSON.stringify([
    s.phase,
    s.customers.map((c) => [c.id, c.status, c.accepted]),
    s.pots.map((p) => [p?.stage, p?.lifted, p?.finishing]),
    s.burners.map((b) => b.stage),
    s.brothBatch.stage,
    s.curryBatch.stage,
    s.sidePrep?.stage,
    s.sidePrep?.time >= balance.sidePreparation.cookSeconds[s.sidePrep?.id],
    s.closing,
    isEvening(s),
    s.tray.length,
    s.sink,
  ]);
}
function tick() {
  if (soundMode) return;
  const now = performance.now(),
    dt = (now - lastTick) / 1000;
  lastTick = now;
  const paused = Boolean(pauseReason(ui, document.hidden));
  if (!paused) {
    if (debugEnabled) debugTick(engine, dt);
    else engine.tick(dt);
  }
  const s = engine.s;
  if (ui.started && !document.hidden) engine.petTick(dt);
  if (
    !paused &&
    !pointer.active() &&
    !ui.panel &&
    lastReminderDay !== s.day &&
    !ui.lateReminder &&
    closingReminderDue(s)
  ) {
    ui.lateReminder = true;
    queueRender();
  }
  audio.syncAmbient(s, ui.scene, ui.panel, paused);
  updateAudioStatus(app, audio);
  const nextSignature = sceneSignature();
  if (nextSignature !== signature && !pointer.active()) {
    signature = nextSignature;
    if (ui.started) queueRender();
  }
  workstations.update();
  guests.update(s, paused);
  motion.update();
  clockUI.frame(now, false);
  if (ui.panel === "pets" && s.pet) {
    const meter = document.querySelector(".pet-meter.energy meter");
    if (meter) {
      meter.value = s.pet.energy;
      document.querySelector(".pet-meter.energy b").textContent =
        `${Math.round(s.pet.energy)}%`;
    }
  }
  if (ui.panel === "side-prep" && s.sidePrep?.stage === "cooking") {
    const p = s.sidePrep,
      tag = document.querySelector(".side-prep-status");
    if (tag)
      tag.textContent =
        p.time < balance.sidePreparation.cookSeconds[p.id]
          ? `${textVi("t_627cd10c75fe")} ${Math.floor(p.time)} ${textVi("t_1a86b1e7e56f")}`
          : p.time <=
              balance.sidePreparation.cookSeconds[p.id] +
                balance.sidePreparation.burnGraceSeconds
            ? textVi("t_cbe6a7a4f85b")
            : textVi("t_6b422c160099");
  }
  document.querySelectorAll("[data-patience]").forEach((el) => {
    const c = s.customers.find((c) => c.id === el.dataset.patience);
    if (c) el.style.width = (c.patience / c.maxPatience) * 100 + "%";
  });
  document.querySelectorAll("[data-pot]").forEach((el) => {
    const p = s.pots[Number(el.dataset.pot)];
    const tag = el.querySelector(".pot-state");
    if (tag && p)
      tag.textContent =
        p.stage === "boiling"
          ? Math.max(0, Math.ceil(p.duration - p.time)) +
            textVi("t_9f6b3e222636")
          : textVi("t_08e16caba19a");
  });
  if (ui.panel === "fryer" && !pointer.active()) {
    const rows = document.querySelectorAll(".fry-row");
    rows.forEach((row, i) => {
      const p = s.fryer[i];
      if (p?.stage === "frying")
        row.querySelector("span").textContent =
          `${textVi("t_e2b65d820893")} ${i + 1} · ${textVi("t_d90a3a6bf692")} ${Math.floor(p.time)} ${textVi("t_1a86b1e7e56f")}${p.time >= balance.cooking.fryMinSeconds && p.time <= balance.cooking.fryMaxSeconds ? textVi("t_f1a114add764") : p.time > balance.cooking.fryMaxSeconds ? textVi("t_139292340486") : ""}`;
    });
  }
  if (ui.panel === "cook") {
    const p = s.pots[ui.pot],
      tag = document.querySelector(".cook-status");
    if (p && !p.lifted && tag) {
      const status = cookingStatus(p);
      tag.textContent = status.label;
      tag.dataset.texture = status.state;
    }
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.hidden) backgroundAt = Date.now();
  else if (backgroundAt !== null) {
    if (!pauseReason(ui, false))
      engine.tick(returnSeconds(Date.now() - backgroundAt));
    backgroundAt = null;
  }
  lastTick = performance.now();
  if (ui.started) save.save(engine.s);
  void audio.setHidden(document.hidden);
  clockUI.frame(performance.now(), false);
  motion.update();
});
window.addEventListener("pagehide", () => {
  if (ui.started) save.save(engine.s);
});
setInterval(tick, balance.clock.tickMilliseconds);
observeViewport(queueRender);
if (soundMode) mountSoundLab(app, audio);
else {
  render();
  mountDebug(() => engine);
}
if ("serviceWorker" in navigator && import.meta.env.PROD)
  window.addEventListener("load", () =>
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch(() => notify(textVi("t_a60bc3a150a2"))),
  );
