import { textVi } from "../i18n.js";
import {
  PET_SPECIES,
  PET_RULES,
  petLevel,
  petMood,
  petPose,
} from "../systems/pets.js";
import { sprite, layoutFor, layerStyle } from "./assets.js";
import { icon } from "./art.js";
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const button = (text, act, arg = "", disabled = false) =>
  `<button data-act="${act}" data-arg="${arg}" ${disabled ? "disabled" : ""}>${text}</button>`;
export function petScene(s, scene, action = "") {
  const counter = scene.startsWith("guests");
  if (
    (!counter && !["front", "garden"].includes(scene)) ||
    (!s.pet && scene !== "garden")
  )
    return "";
  const pet = s.pet,
    species = PET_SPECIES[pet?.species || "cat"];
  const placement = layoutFor(scene).pet;
  const roaming =
    !counter && pet && !pet.sleeping && !action && pet.energy >= 15;
  const pose = roaming ? "walking" : pet ? petPose(pet, action) : "idle";
  return `<button class="scene-pet ${counter ? "counter-pet" : ""} ${pet?.sleeping ? "sleeping" : ""} ${roaming ? "roaming" : ""} ${action || ""}" style="${layerStyle(placement, scene)}" data-act="panel" data-arg="pets" aria-label="${pet ? textVi("t_5b1872f35eaf") + esc(pet.name) : textVi("t_5a509959c6f3")}">${sprite(species.assetPrefix + "-" + pose, "", "pet-body", `data-motion-actor="${species.assetPrefix}" data-motion-key="pet-image" data-anim-id="${species.assetPrefix}-${pose}-anim"`)}<span class="pet-scene-label"><span>${pet ? esc(pet.name) : textVi("t_7e2c6123ee22")}</span>${icon(pet?.sleeping ? "moon" : "heart", 13)}</span>${pet?.sleeping ? '<span class="pet-sleep-note" aria-hidden="true">z z z</span>' : ""}</button>`;
}
function meter(label, value, className) {
  return `<div class="pet-meter ${className}"><span>${label}</span><meter min="0" max="100" value="${value}" aria-label="${label}"></meter><b>${Math.round(value)}%</b></div>`;
}
export function petPanel(s, ui) {
  const pet = s.pet;
  if (!pet)
    return `<div class="panel-heading"><span class="eyebrow">${textVi("t_b467ba00cebd")}</span><h2>${textVi("t_fecb872c7e5c")}</h2><p>${textVi("t_e0c2d6d21f93")} ${PET_RULES.starterSnacks} ${textVi("t_ce7c8f84f925")}</p></div><div class="pet-choices">${Object.entries(
      PET_SPECIES,
    )
      .map(
        ([id, p]) =>
          `<article>${sprite(p.assetPrefix + "-idle", p.name)}<h3>${p.defaultName}</h3><p>${p.name}</p><small>${p.description}</small>${button(textVi("t_18944847ed0e") + p.defaultName + textVi("t_489c02fc24da"), "pet-adopt", id)}</article>`,
      )
      .join("")}</div><p class="fine">${textVi("t_bdcbfeadb814")}</p>`;
  const species = PET_SPECIES[pet.species],
    level = petLevel(pet);
  return `<div class="panel-heading"><span class="eyebrow">${textVi("t_ef9d782d8713")}</span><h2>${esc(pet.name)}</h2><p>${species.name} · ${textVi("t_752b18c11a9d")} ${level} / 5 · ${s.day - pet.adoptedDay + 1} ${textVi("t_f0ea744e3599")}</p></div><div class="pet-portrait ${pet.sleeping ? "sleeping" : ""} ${ui.petAction || ""}">${sprite(species.assetPrefix + "-" + petPose(pet, ui.petAction), "", "pet-body")}${pet.sleeping ? '<span class="pet-sleep-note" aria-hidden="true">z z z</span>' : ""}<span class="pet-mood">${petMood(pet)}</span></div><div class="pet-meters">${meter(textVi("t_02d90e0bcf8e"), pet.hunger, "food")}${meter(textVi("t_c17aa8674cdd"), pet.thirst, "water")}${meter(textVi("t_8d8b5004caa0"), pet.happiness, "happy")}${meter(textVi("t_92e85d5b0437"), pet.energy, "energy")}</div><div class="pet-care-actions">${button(icon("bowl", 20) + textVi("t_709c792a5811"), "pet-care", "feed", pet.sleeping || pet.hunger >= 95 || !pet.snacks)}${button(icon("drop", 20) + textVi("t_ee26cc9ce2da"), "pet-care", "water", pet.sleeping || pet.thirst >= 95)}${button(icon("sun", 20) + textVi("t_813b5f6a9e07"), "pet-care", "play", pet.sleeping || pet.energy < 15)}${button(icon("heart", 20) + textVi("t_c740676da5f3"), "pet-care", "stroke", pet.sleeping)}${button(icon("moon", 20) + (pet.sleeping ? textVi("t_0253445a8dfe") : textVi("t_994bf0a4ba56")), "pet-care", pet.sleeping ? "wake" : "sleep")}</div><div class="pet-pantry"><p>${textVi("t_ecea8f360e36")} <strong>${pet.snacks}</strong> ${textVi("t_c1b6e93ff8be")}</p>${button(`Mua ${PET_RULES.snackBundle} ${textVi("t_af31b4d41b5e")}${PET_RULES.snackPrice}`, "pet-buy", "", s.money < PET_RULES.snackPrice || pet.snacks + PET_RULES.snackBundle > 99)}</div><label class="pet-name-input">${textVi("t_94e075dc36e8")}<input id="pet-name" value="${esc(pet.name)}" maxlength="18" autocomplete="off"></label>${button(textVi("t_0b3ef54a14c0"), "pet-rename")}<p class="fine">${textVi("t_c5b59d9b003a")}</p>`;
}
