import { textVi } from "../i18n.js";
import config from "../../data/pets.json" with { type: "json" };
import balance from "../../config/balance.json" with { type: "json" };
export const PET_SPECIES = config.species;
export const PET_RULES = balance.pets;
const clamp = (n) => Math.max(0, Math.min(100, n));
const careActions = ["feed", "water", "play", "stroke", "sleep"];
export const petLevel = (pet) =>
  PET_RULES.bondThresholds.filter((n) => pet.bond >= n).length;
export function petMood(pet) {
  if (pet.sleeping) return textVi("t_ab2ead2507f2");
  if (pet.thirst < 30) return textVi("t_94de1313ad5b");
  if (pet.hunger < 30) return textVi("t_3c5fa2eb4f24");
  if (pet.energy < 25) return textVi("t_34f447ef7562");
  if (pet.happiness < 40) return textVi("t_cfde85815132");
  return textVi("t_1b9004d98763");
}
export function petPose(pet, action = "") {
  if (pet.sleeping) return "sleeping";
  return (
    {
      feed: "eating",
      play: "playing",
      stroke: "happy",
      water: "happy",
      wake: "happy",
    }[action] || "idle"
  );
}
export function validPet(pet, day) {
  if (pet === null) return true;
  if (!pet || typeof pet !== "object" || Array.isArray(pet)) return false;
  const bounded = (value, max) =>
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= max;
  return (
    Object.hasOwn(PET_SPECIES, pet.species) &&
    typeof pet.name === "string" &&
    pet.name.trim() === pet.name &&
    [...pet.name].length > 0 &&
    [...pet.name].length <= 18 &&
    !/[<>\u0000-\u001f]/.test(pet.name) &&
    ["hunger", "thirst", "happiness", "energy"].every((key) =>
      bounded(pet[key], 100),
    ) &&
    bounded(pet.bond, 100000) &&
    Number.isInteger(pet.snacks) &&
    bounded(pet.snacks, 99) &&
    typeof pet.sleeping === "boolean" &&
    Number.isInteger(pet.adoptedDay) &&
    pet.adoptedDay >= 1 &&
    pet.adoptedDay <= day &&
    Number.isInteger(pet.careDay) &&
    pet.careDay >= pet.adoptedDay &&
    pet.careDay <= day &&
    Array.isArray(pet.rewarded) &&
    pet.rewarded.length <= 5 &&
    new Set(pet.rewarded).size === pet.rewarded.length &&
    pet.rewarded.every((a) => careActions.includes(a))
  );
}
export function advancePetDay(s) {
  const p = s.pet;
  if (!p) return;
  p.hunger = clamp(p.hunger - PET_RULES.hungerPerDay);
  p.thirst = clamp(p.thirst - PET_RULES.thirstPerDay);
  p.happiness = clamp(p.happiness - PET_RULES.happinessPerDay);
  p.energy = clamp(
    p.energy +
      (p.sleeping
        ? PET_RULES.overnightSleepEnergy
        : PET_RULES.overnightAwakeEnergy),
  );
  p.careDay = s.day;
  p.rewarded = [];
}
function reward(p, action, amount, day) {
  if (p.careDay !== day) {
    p.careDay = day;
    p.rewarded = [];
  }
  if (!p.rewarded.includes(action)) {
    p.bond = Math.min(100000, p.bond + amount);
    p.rewarded.push(action);
  }
}
export const petMethods = {
  petTick(dt) {
    const p = this.s.pet;
    if (!p?.sleeping || p.energy >= 100 || !Number.isFinite(dt) || dt <= 0)
      return false;
    p.energy = clamp(
      p.energy + Math.min(2, dt) * PET_RULES.sleepEnergyPerSecond,
    );
    this.petSaveClock = (this.petSaveClock || 0) + Math.min(2, dt);
    if (this.petSaveClock >= 5) {
      this.petSaveClock = 0;
      this.event({ type: "autosave" });
    }
    if (p.energy === 100) this.changed();
    return true;
  },
  adoptPet(species) {
    if (this.s.pet || !Object.hasOwn(PET_SPECIES, species)) return false;
    this.s.pet = {
      species,
      name: PET_SPECIES[species].defaultName,
      ...PET_RULES.initial,
      bond: 0,
      snacks: PET_RULES.starterSnacks,
      sleeping: false,
      adoptedDay: this.s.day,
      careDay: this.s.day,
      rewarded: [],
    };
    this.say(`${this.s.pet.name} ${textVi("t_ba2b07afd5e5")}`, "pet");
    return this.changed();
  },
  renamePet(value) {
    if (!this.s.pet || typeof value !== "string") return false;
    const name = value.trim().normalize("NFC");
    if (
      !name ||
      [...name].length > 18 ||
      /[<>\u0000-\u001f]/.test(name) ||
      name.includes("__proto__")
    )
      return this.say(textVi("t_1102cbd2d56f"));
    this.s.pet.name = name;
    return this.changed();
  },
  buyPetSnacks() {
    const p = this.s.pet;
    if (!p || p.snacks + PET_RULES.snackBundle > 99) return false;
    if (this.s.money < PET_RULES.snackPrice)
      return this.say(textVi("t_56ff8785e655"));
    this.s.money -= PET_RULES.snackPrice;
    this.s.ledger.other += PET_RULES.snackPrice;
    p.snacks += PET_RULES.snackBundle;
    this.say(textVi("t_b5fad94125ba"), "bottle");
    return this.changed();
  },
  petCare(action) {
    const p = this.s.pet;
    if (!p) return false;
    if (action === "wake") {
      if (!p.sleeping) return false;
      p.sleeping = false;
      this.say(`${p.name} ${textVi("t_59666596d6e6")}`, "pet");
      return this.changed();
    }
    if (!careActions.includes(action)) return false;
    if (p.sleeping) return this.say(`${p.name} ${textVi("t_bc12944bdad5")}`);
    switch (action) {
      case "feed":
        if (p.hunger >= 95)
          return this.say(`${p.name} ${textVi("t_14336556b95c")}`);
        if (!p.snacks) return this.say(textVi("t_9c755ae49e1e"));
        p.snacks--;
        p.hunger = clamp(p.hunger + PET_RULES.care.feed.hunger);
        p.happiness = clamp(p.happiness + PET_RULES.care.feed.happiness);
        reward(p, action, PET_RULES.care.feed.bond, this.s.day);
        break;
      case "water":
        if (p.thirst >= 95)
          return this.say(`${p.name} ${textVi("t_fd4879d718c5")}`);
        p.thirst = clamp(p.thirst + PET_RULES.care.water.thirst);
        reward(p, action, PET_RULES.care.water.bond, this.s.day);
        break;
      case "play":
        if (p.energy < PET_RULES.care.play.energy)
          return this.say(`${p.name} ${textVi("t_6f0ae31c57f3")}`);
        p.energy -= PET_RULES.care.play.energy;
        p.happiness = clamp(p.happiness + PET_RULES.care.play.happiness);
        reward(p, action, PET_RULES.care.play.bond, this.s.day);
        break;
      case "stroke":
        p.happiness = clamp(p.happiness + PET_RULES.care.stroke.happiness);
        reward(p, action, PET_RULES.care.stroke.bond, this.s.day);
        break;
      case "sleep":
        p.sleeping = true;
        reward(p, action, PET_RULES.care.sleep.bond, this.s.day);
        break;
    }
    this.say(
      {
        feed: `${p.name} ${textVi("t_14c78ed7ff3a")}`,
        water: `${p.name} ${textVi("t_9f25f7427386")}`,
        play: `${p.name} ${textVi("t_2de32cc07b10")}`,
        stroke: `${p.name} ${textVi("t_b4963440bc58")}`,
        sleep: `${p.name} ${textVi("t_d99a38551700")}`,
      }[action],
      action === "water" ? "pour" : "pet",
    );
    return this.changed();
  },
};
