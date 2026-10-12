import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { newState } from "../src/systems/state.js";
import { validState } from "../src/systems/validation.js";
import { migrateState } from "../src/systems/migration.js";
import { PET_RULES, petLevel } from "../src/systems/pets.js";
import { SaveService, SAVE_KEY } from "../src/systems/save.js";
import manifest from "../assets/manifest.json" with { type: "json" };
import sharp from "sharp";

test("old saves gain an empty pet slot; adopting either species is free and permanent", () => {
  const old = newState();
  delete old.pet;
  assert.equal(migrateState(old).pet, null);
  assert.equal(validState(old), true);
  for (const species of ["cat", "shiba"]) {
    const e = new Engine(old),
      money = e.s.money;
    assert.equal(e.adoptPet("unknown"), false);
    assert.equal(e.adoptPet(species), true);
    assert.equal(e.s.money, money);
    assert.equal(e.s.pet.snacks, PET_RULES.starterSnacks);
    assert.equal(e.adoptPet(species === "cat" ? "shiba" : "cat"), false);
    assert.equal(validState(e.s), true);
  }
});
test("care consumes actual snacks, saturates needs and cannot farm daily friendship", () => {
  const e = new Engine();
  e.adoptPet("cat");
  const p = e.s.pet;
  assert.equal(e.petCare("feed"), true);
  assert.equal(p.snacks, 4);
  assert.equal(p.hunger, 95);
  assert.equal(e.petCare("feed"), false);
  assert.equal(p.snacks, 4);
  assert.equal(e.petCare("water"), true);
  assert.equal(p.thirst, 100);
  const before = p.bond;
  for (let i = 0; i < 20; i++) e.petCare("stroke");
  assert.equal(p.bond, before + 3);
  assert.equal(p.happiness, 100);
  p.snacks = 0;
  p.hunger = 20;
  assert.equal(e.petCare("feed"), false);
  assert.equal(p.hunger, 20);
  assert.equal(e.petCare("unknown"), false);
  assert.equal(validState(e.s), true);
});
test("play costs energy, sleep blocks care, visible-time rest clamps time jumps and autosaves", () => {
  const events = [],
    e = new Engine(newState(), (event) => events.push(event));
  e.adoptPet("shiba");
  const p = e.s.pet;
  assert.equal(e.petCare("play"), true);
  assert.equal(p.energy, 65);
  p.energy = 10;
  assert.equal(e.petCare("play"), false);
  assert.equal(e.petCare("sleep"), true);
  assert.equal(e.petCare("feed"), false);
  assert.equal(e.petTick(1000), true);
  assert.equal(p.energy, 18);
  assert.equal(e.petTick(-1), false);
  assert.equal(e.petTick(NaN), false);
  for (let i = 0; i < 12; i++) e.petTick(2);
  assert.equal(p.energy, 100);
  assert.ok(events.some((event) => event.type === "autosave"));
  assert.equal(e.petCare("wake"), true);
  assert.equal(p.sleeping, false);
  assert.equal(e.petTick(1), false);
  assert.equal(validState(e.s), true);
});
test("new game day reduces pet needs once and renews friendship rewards without offline punishment", () => {
  const e = new Engine();
  e.adoptPet("cat");
  e.petCare("stroke");
  const bond = e.s.pet.bond,
    hunger = e.s.pet.hunger;
  e.s.phase = "summary";
  assert.equal(e.nextDay(), true);
  assert.equal(e.s.pet.hunger, hunger - PET_RULES.hungerPerDay);
  assert.deepEqual(e.s.pet.rewarded, []);
  e.petCare("stroke");
  assert.equal(e.s.pet.bond, bond + 3);
  const restored = new Engine(structuredClone(e.s));
  assert.deepEqual(restored.s.pet, e.s.pet);
  restored.s.pet.bond = 120;
  assert.equal(petLevel(restored.s.pet), 5);
});
test("pet pantry charges once in daily expenses; insufficient funds and capacity refuse purchase", () => {
  const e = new Engine();
  e.adoptPet("cat");
  const money = e.s.money;
  assert.equal(e.buyPetSnacks(), true);
  assert.equal(e.s.pet.snacks, 10);
  assert.equal(e.s.money, money - PET_RULES.snackPrice);
  assert.equal(e.s.ledger.other, PET_RULES.snackPrice);
  e.s.money = 0;
  assert.equal(e.buyPetSnacks(), false);
  e.s.money = 500;
  e.s.pet.snacks = 99;
  assert.equal(e.buyPetSnacks(), false);
  assert.equal(e.s.money, 500);
});
test("pet survives normal save/load, rejects corrupt data and safely renames Unicode", () => {
  const memory = new Map(),
    storage = {
      getItem: (key) => memory.get(key),
      setItem: (key, value) => memory.set(key, value),
    };
  const e = new Engine();
  e.adoptPet("shiba");
  e.petCare("sleep");
  assert.equal(e.renamePet("  Đậu Nhỏ  "), true);
  assert.equal(e.renamePet("<script>"), false);
  assert.equal(e.renamePet("__proto__"), false);
  assert.equal(e.renamePet("x".repeat(19)), false);
  const save = new SaveService(storage);
  assert.equal(save.save(e.s), true);
  assert.deepEqual(save.load().pet, e.s.pet);
  assert.ok(memory.has(SAVE_KEY));
  for (const [key, value] of [
    ["species", "dragon"],
    ["energy", Infinity],
    ["snacks", -1],
    ["sleeping", "yes"],
    ["adoptedDay", 99],
    ["rewarded", ["feed", "feed"]],
  ]) {
    const bad = structuredClone(e.s);
    bad.pet[key] = value;
    assert.equal(validState(bad), false, key);
  }
});
test("all twelve pet poses and two animated props have real transparent alpha", async () => {
  for (const id of [
    ...["cat", "shiba"].flatMap((s) =>
      ["idle", "happy", "eating", "sleeping", "playing", "walking"].map(
        (pose) => `pet-${s}-${pose}`,
      ),
    ),
    "front-noren",
    "front-lantern",
  ]) {
    const asset = manifest.assets[id];
    assert.ok(asset, id);
    const meta = await sharp("assets/" + asset.file).metadata();
    assert.ok(meta.hasAlpha, id);
    const { data, info } = await sharp("assets/" + asset.file)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    let empty = 0,
      filled = 0;
    for (let i = info.channels - 1; i < data.length; i += info.channels) {
      if (data[i] < 5) empty++;
      if (data[i] > 240) filled++;
    }
    assert.ok(
      empty > info.width * info.height * (id.startsWith("pet-") ? 0.12 : 0.01),
      `${id}: transparent space`,
    );
    assert.ok(filled > info.width * info.height * 0.12, `${id}: solid subject`);
  }
});
