import balance from "../../config/balance.json" with { type: "json" };
import { migrateState } from "./migration.js";
import { RECIPES } from "../data.js";
import { addStock } from "./inventory.js";
import { forecast } from "./weather.js";
export const emptyLedger = () => ({
  revenue: 0,
  tips: 0,
  ingredients: 0,
  purchases: 0,
  wages: 0,
  other: 0,
  served: 0,
  lost: 0,
  satisfaction: 0,
  sales: {},
  startRep: balance.initial.reputation,
});
export function newState() {
  const s = {
    version: 3,
    day: 1,
    phase: "morning",
    elapsed: 0,
    duration: balance.initial.daySeconds,
    money: balance.initial.money,
    reputation: balance.initial.reputation,
    inventory: {},
    upgrades: {
      seats: 0,
      stove: 0,
      storage: 0,
      fridge: 0,
      fryer: 0,
      drinks: 0,
      garden: 0,
    },
    unlocked: ["kake", "beef", "kitsune"],
    menu: ["kake", "beef", "kitsune"],
    prices: Object.fromEntries(
      Object.entries(RECIPES).map(([id, r]) => [id, r.price]),
    ),
    employees: {},
    ownedDecor: [],
    decor: {},
    plots: [null],
    collection: { customers: [], recipes: [], ingredients: [], plants: [] },
    visits: {},
    tasteSeed: Math.floor(Math.random() * 0x100000000) >>> 0,
    lastTastes: {},
    reviews: [],
    ledger: emptyLedger(),
    forecast: forecast(1),
    customers: [],
    pots: [null],
    tray: [],
    drink: null,
    prepared: { egg: 0, tempura: 0 },
    fryer: [],
    cutBonus: 0,
    sink: 0,
    nextArrival: 0,
    serial: 0,
    selectedOrder: null,
    selectedPart: 0,
    tutorial: 0,
    settings: {
      music: true,
      sfx: true,
      haptic: true,
      animation: true,
      performance: false,
      font: "normal",
      dialogue: "normal",
      contrast: false,
    },
    staffOptions: { restock: false, prep: false },
    lastSummary: null,
  };
  for (const [id, n] of Object.entries(balance.initial.stock))
    addStock(s, id, n, false, true);
  return migrateState(s);
}
