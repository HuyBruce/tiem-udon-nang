import { RECIPES, UPGRADES } from "../data.js";
const oldPrices = {
  kake: 360,
  beef: 520,
  kitsune: 440,
  tempura: 620,
  miso: 590,
  yuzu: 640,
  cold: 430,
  curry: 650,
  yaki: 610,
  autumn: 580,
};
const reprice = (value, oldBase, newBase) =>
  Math.round(((value / oldBase) * newBase) / 10) * 10;
// Keep the old storage key so installed phones migrate in place.
export function migrateState(input) {
  if (!input || typeof input !== "object") return input;
  const s = structuredClone(input);
  if (s.version === 1) {
    s.version = 2;
    s.elapsed = (s.elapsed / s.duration) * 420;
    for (const p of [...(s.pots || []), ...(s.tray || [])])
      if (p) {
        p.lifted = p.stage === "ready";
        p.texture = "perfect";
        if (p.broth?.length === 3) p.broth.unshift(p.broth[0]);
      }
    for (const c of s.customers || [])
      if (c.status === "eating") c.settled = true;
  }
  if (s.version === 2) {
    s.version = 3;
    for (const [id, r] of Object.entries(RECIPES)) {
      if (oldPrices[id] == null) {
        if (s.prices) s.prices[id] = r.price;
      } else if (s.prices?.[id] != null) {
        s.prices[id] = reprice(s.prices[id], oldPrices[id], r.price);
      }
    }
    for (const [id, r] of Object.entries(s.customRecipes || {})) {
      const oldBase = r.price;
      r.price = Math.round((oldBase * 1.67) / 10) * 10;
      if (s.prices?.[id] != null)
        s.prices[id] = reprice(s.prices[id], oldBase, r.price);
    }
    for (const key of ["money", "debt", "payroll"])
      if (Number.isFinite(s[key])) s[key] = Math.round(s[key] * 1.67);
    for (const c of s.customers || []) {
      c.noodleTier = "regular";
      if (c.result) {
        c.result.payment = Math.round(c.result.payment * 1.67);
        c.result.tip = Math.round(c.result.tip * 1.67);
      }
    }
    s.tasteSeed =
      (Math.imul(s.serial || 0, 2654435761) ^
        Math.imul(s.day || 1, 2246822519) ^
        (s.money || 0)) >>>
      0;
    s.lastTastes = Object.fromEntries(
      (s.customers || [])
        .filter((c) => c.preferences?.length)
        .map((c) => [c.personId, c.preferences]),
    );
  }
  s.burners ??= (s.pots || []).map((p) => ({
    stage: p ? "boiling" : "empty",
    time: 0,
  }));
  s.brothBatch ??= {
    ingredients: [],
    stage: "empty",
    time: 0,
    servings: 0,
    quality: 0,
  };
  s.closing ??= false;
  s.curryBatch ??= {
    ingredients: [],
    stage: "empty",
    time: 0,
    servings: 0,
    quality: 0,
  };
  s.brothSource ??= "regular";
  s.pendingRecipes ??= [];
  s.customRecipes ??= {};
  s.discoveries ??= [];
  s.discoveryDraft ??= null;
  s.payroll ??= 0;
  s.debt ??= 0;
  s.bouquets ??= 0;
  s.flowerRooms ??= {};
  s.handmade ??= { portions: 0, stage: 0, skill: 0 };
  s.handmade.xp ??= 0;
  s.noodleTier ??= "regular";
  s.selectedPart ??= 0;
  s.pet ??= null;
  s.progression ??= { served: 0, excellent: 0, numberOneDay: null };
  if (s.upgrades) for (const id of Object.keys(UPGRADES)) s.upgrades[id] ??= 0;
  s.sidePrep ??= null;
  if (s.employees)
    for (const e of Object.values(s.employees)) {
      e.learned ??= [];
      e.learning ??= null;
    }
  if (s.prepared)
    for (const id of ["karaage", "gyoza", "tamagoyaki"]) s.prepared[id] ??= 0;
  if (s.settings) {
    s.settings.language ??= "vi";
    s.settings.musicVolume ??= 0.6;
    s.settings.sfxVolume ??= 0.8;
  }
  if (s.prices)
    for (const [id, r] of Object.entries(RECIPES)) s.prices[id] ??= r.price;
  return s;
}
