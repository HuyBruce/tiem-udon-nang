import { textVi } from "../i18n.js";
import balance from "../../config/balance.json" with { type: "json" };
import { drinkMethods } from "./drinks.js";
import { petMethods, advancePetDay } from "./pets.js";
import { handmadeQuality } from "./handmade.js";
import { sidePreparationMethods } from "./side-preparation.js";
import { recordMeal } from "./progression.js";
import { cookingMethods } from "./cooking.js";
import { migrateState } from "./migration.js";
import { traffic, BILLING } from "./time.js";
import { canFinishDay } from "./shop-hours.js";
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { recipeBook, discover } from "./discovery.js";
import {
  RECIPES,
  TOPPINGS,
  SIDES,
  DRINKS,
  UPGRADES,
  EMPLOYEES,
  DECOR,
  PLANTS,
} from "../data.js";
import { newState, emptyLedger } from "./state.js";
import { count, addStock, consume, expire } from "./inventory.js";
import { forecast } from "./weather.js";
import { makeCustomer, hint } from "./customers.js";
import { judge, clamp, setPrice } from "./economy.js";
import {
  combineResults,
  nextPartIndex,
  orderParts,
  partCustomer,
} from "./combo.js";
import { staffTick, wages, teachRecipe } from "./employees.js";
export class Engine {
  constructor(state = newState(), onEvent = () => {}) {
    this.s = migrateState(state);
    this.event = onEvent;
    this.saveClock = 0;
  }
  say(text, sound = "click") {
    this.event({ type: "notice", text, sound });
    return false;
  }
  changed() {
    this.event({ type: "change" });
    return true;
  }
  open() {
    const s = this.s;
    if (s.phase !== "morning") return false;
    if (!s.menu.length) return this.say(textVi("t_98932ff31593"));
    if (s.employees.binh && s.staffOptions.prep) {
      for (let i = s.prepared.egg; i < 3; i++) {
        if (!consume(s, ["egg"])) break;
        s.prepared.egg++;
      }
    }
    s.phase = "open";
    s.elapsed = 0;
    s.nextArrival = 24;
    this.spawn();
    return this.changed();
  }
  spawn() {
    const s = this.s;
    if (s.closing || s.phase !== "open") return;
    const seat = Array.from(
      {
        length:
          balance.customers.baseSeats +
          s.upgrades.seats * balance.customers.seatsPerLevel,
      },
      (_, i) => i,
    ).find((i) => !s.customers.some((c) => c.seat === i));
    if (seat === undefined) return;
    const c = makeCustomer(s, seat);
    if (c.priceRefusal) {
      s.ledger.lost++;
      this.say(`${c.name} ${textVi("t_7111d9dad07d")}`);
      return;
    }
    s.customers.push(c);
    s.visits[c.personId] = (s.visits[c.personId] || 0) + 1;
    if (!s.collection.customers.includes(c.personId))
      s.collection.customers.push(c.personId);
    this.event({
      type: "arrival",
      text: `${c.name} ${textVi("t_18bc8d831ae7")}`,
      sound: "bell",
    });
  }
  tick(dt) {
    const s = this.s;
    if (s.phase !== "open") return;
    dt = Math.min(dt, 2);
    s.elapsed += dt;
    this.saveClock += dt;
    for (const b of s.burners)
      if (b.stage === "heating") {
        b.time += dt;
        if (b.time >= balance.cooking.waterSeconds) {
          b.stage = "boiling";
          this.say(textVi("t_75c5f889bba6"), "ping");
        }
      }
    for (const batch of [s.brothBatch, s.curryBatch]) {
      if (batch.stage === "cooking") {
        batch.time += dt;
        if (batch.time >= balance.cooking.brothSeconds) {
          batch.stage = "ready";
          batch.servings =
            balance.cooking.brothServings +
            s.upgrades.broth * balance.upgradeEffects.brothServingsPerLevel;
          this.say(
            `${textVi("t_3c7053bd5fc1")} ${batch.servings} ${textVi("t_1ea6eb075a8c")}`,
            "ping",
          );
        }
      }
    }
    for (const p of s.pots)
      if (p && !p.lifted) {
        p.time += dt;
        if (p.time >= p.duration && p.stage === "boiling") {
          p.stage = "ready";
          this.say(
            `${textVi("t_41eb1a94db88")} ${balance.cooking.liftWindowSeconds} ${textVi("t_0ebde8da16c7")}`,
            "ping",
          );
        }
      }
    for (const p of s.pots)
      if (p?.finishing) {
        p.panTime += dt;
        if (p.panTime >= balance.cooking.stirfrySeconds) {
          p.finishing = false;
          p.method = "stirfry";
          p.temperature = "hot";
          this.say(textVi("t_30c2ad1b97c8"), "ping");
        }
      }
    for (const p of s.fryer) if (p.stage === "frying") p.time += dt;
    this.sidePrepTick(dt);
    for (const c of [...s.customers]) {
      if (c.status === "waiting") {
        c.patience = Math.max(0, c.patience - dt);
        if (c.patience === 0) {
          s.customers = s.customers.filter((x) => x.id !== c.id);
          s.reputation = clamp(
            s.reputation - balance.economy.lostGuestReputation,
            0,
            100,
          );
          s.ledger.lost++;
          this.say(`${c.name} ${textVi("t_74da9debcab5")}`);
        }
      } else if (c.status === "eating") {
        c.eatTime -= dt;
        if (c.eatTime <= 0) {
          c.status = "checkout";
          c.checkoutTime = balance.customers.checkoutSeconds;
          if (s.employees.mika) this.checkout(c.id);
          else this.say(`${c.name} ${textVi("t_1241b982dbfb")}`);
        }
      } else if (c.status === "checkout") {
        if (s.employees.mika) this.checkout(c.id);
        else {
          c.checkoutTime -= dt;
          if (c.checkoutTime <= 0) this.checkout(c.id);
        }
      } else if (c.status === "departing") {
        c.leaveTime -= dt;
        if (c.leaveTime <= 0) c.status = "dirty";
      }
    }
    staffTick(this, dt);
    if (!s.closing && traffic(s) > 0 && s.elapsed >= s.nextArrival) {
      const ratio =
        s.menu.reduce(
          (n, id) => n + s.prices[id] / recipeBook(s)[id].price,
          0,
        ) / s.menu.length;
      this.spawn();
      s.nextArrival =
        s.elapsed +
        (Math.max(
          balance.customers.arrivalMinSeconds,
          balance.customers.arrivalBaseSeconds -
            s.day * balance.customers.arrivalDayReduction -
            s.reputation * balance.customers.arrivalReputationReduction,
        ) *
          Math.max(balance.economy.minimumPriceDemandRatio, ratio)) /
          (s.forecast.demand *
            traffic(s) *
            (1 + s.upgrades.sign * balance.upgradeEffects.signDemandPerLevel));
    }
    if (this.saveClock >= 5) {
      this.saveClock = 0;
      this.event({ type: "autosave" });
    }
    this.event({ type: "tick" });
  }
  accept(id) {
    const c = this.s.customers.find((c) => c.id === id);
    if (!c || c.status !== "waiting") return false;
    c.accepted = true;
    this.s.selectedOrder = id;
    this.s.selectedPart = Math.max(0, nextPartIndex(c));
    this.s.tutorial = Math.max(this.s.tutorial, 1);
    return this.changed();
  }
  ask(id) {
    const c = this.s.customers.find((c) => c.id === id);
    if (!c || c.status !== "waiting") return;
    c.hints = Math.min(3, c.hints + 1);
    if (c.hints >= 3)
      c.patience = Math.max(
        0,
        c.patience - balance.customers.askPatienceSecondsAfterSecondHint,
      );
    this.changed();
    return hint(c, this.s);
  }
  selectPart(orderId, partIndex) {
    const c = this.s.customers.find((customer) => customer.id === orderId);
    if (
      !c ||
      !c.accepted ||
      c.status !== "waiting" ||
      !Number.isInteger(partIndex) ||
      partIndex < 0 ||
      partIndex >= orderParts(c).length ||
      c.combo?.delivered.some((part) => part.index === partIndex)
    )
      return false;
    this.s.selectedOrder = orderId;
    this.s.selectedPart = partIndex;
    return this.changed();
  }
  noodles(
    index,
    orderId = this.s.selectedOrder,
    partIndex = this.s.selectedPart || 0,
  ) {
    const s = this.s;
    if (s.phase !== "open") return this.say(textVi("t_979ed4ab7e48"));
    if (s.pots[index]) return this.say(textVi("t_7380c0f93330"));
    const c = s.customers.find(
      (c) => c.id === orderId && c.accepted && c.status === "waiting",
    );
    if (!c) return this.say(textVi("t_a94b47e2db22"));
    if (
      c.combo &&
      (partIndex < 0 ||
        partIndex >= c.combo.parts.length ||
        c.combo.delivered.some((part) => part.index === partIndex) ||
        s.pots.some(
          (pot) => pot?.orderId === c.id && pot.partIndex === partIndex,
        ) ||
        s.tray.some(
          (dish) => dish.orderId === c.id && dish.partIndex === partIndex,
        ))
    )
      return this.say(textVi("t_3eff17329c80"));
    if (s.burners[index]?.stage !== "boiling")
      return this.say(textVi("t_03f08bdc3c0d"));
    const handmade = s.noodleTier === "handmade";
    if (handmade && !s.handmade.portions)
      return this.say(textVi("t_82c6c7528645"));
    const used = handmade
      ? { quality: handmadeQuality(s) }
      : consume(s, ["noodles"], {
          premium: s.noodleTier === "premium" ? true : null,
        });
    if (handmade) s.handmade.portions--;
    if (!used)
      return this.say(
        s.noodleTier === "premium"
          ? textVi("t_950bab6f5512")
          : textVi("t_e965854a1b5d"),
      );
    const power =
      s.forecast.event === "power" &&
      s.elapsed >= balance.events.powerStartSeconds &&
      s.elapsed < balance.events.powerEndSeconds;
    s.pots[index] = {
      orderId,
      partIndex: c.combo ? partIndex : 0,
      stage: "boiling",
      lifted: false,
      noodleTier: handmade ? "handmade" : used?.quality ? "premium" : "regular",
      time: 0,
      duration:
        (power
          ? balance.cooking.powerNoodleSeconds
          : balance.cooking.noodleSeconds) -
        s.upgrades.stove * balance.cooking.stoveReduction,
      broth: [],
      tops: [],
      quality: used.quality,
      poured: false,
      cut: 0,
    };
    s.tutorial = Math.max(s.tutorial, 2);
    return this.changed();
  }
  broth(index, id) {
    return this.brothAdd(id);
  }
  pour(index, source = this.s.brothSource) {
    const p = this.s.pots[index],
      b = source === "curry" ? this.s.curryBatch : this.s.brothBatch;
    if (!p?.lifted || p.poured) return this.say(textVi("t_7af6e53c4660"));
    if (b.stage !== "ready" || !b.servings)
      return this.say(textVi("t_dc03c09d8822"));
    p.broth = [...b.ingredients];
    p.quality = (p.quality + b.quality) / 2;
    p.poured = true;
    b.servings--;
    if (!b.servings)
      this.s[source === "curry" ? "curryBatch" : "brothBatch"] = {
        ingredients: [],
        stage: "empty",
        time: 0,
        servings: 0,
        quality: 0,
      };
    this.say(textVi("t_ffaa26ac9a51"), "pour");
    return this.changed();
  }
  topping(index, id) {
    const s = this.s,
      p = s.pots[index];
    if (!TOPPINGS.includes(id)) return false;
    if (!p?.poured) return this.say(textVi("t_72509029fa82"));
    if (p.tops.includes(id)) return this.say(textVi("t_484e17ccf1bd"));
    if (["egg", "tempura"].includes(id)) {
      if (!s.prepared[id])
        return this.say(
          id === "egg" ? textVi("t_df464302c0ad") : textVi("t_30ac2c223348"),
        );
      s.prepared[id]--;
    } else {
      const used = consume(s, [id]);
      if (!used) return this.say(textVi("t_63ed91c27c7c"));
      p.quality = (p.quality + used.quality) / 2;
    }
    p.tops.push(id);
    p.cut = s.cutBonus;
    s.cutBonus = 0;
    if (!s.collection.ingredients.includes(id))
      s.collection.ingredients.push(id);
    this.say(textVi("t_669b9423d155"), "bowl");
    return this.changed();
  }
  tray(index) {
    const s = this.s,
      p = s.pots[index];
    if (!p || !p.lifted || !p.poured || p.finishing)
      return this.say(textVi("t_9004ae19c965"));
    if (s.tray.length >= 5) return this.say(textVi("t_55078caf9cef"));
    s.dishSerial = (s.dishSerial || 0) + 1;
    s.tray.push({
      ...p,
      id: "dish" + s.dishSerial,
      drink: null,
      side: false,
      sideKind: null,
    });
    s.pots[index] = null;
    s.tutorial = Math.max(s.tutorial, 3);
    return this.changed();
  }
  discard(index) {
    if (!this.s.pots[index]) return false;
    this.s.pots[index] = null;
    this.say(textVi("t_bf547ed71519"));
    return this.changed();
  }
  discardFood(source) {
    if (typeof source !== "string" || source.split(":").length > 2)
      return false;
    const [kind, id] = String(source).split(":");
    if (kind === "dish") {
      if (!this.s.tray.some((dish) => dish.id === id)) return false;
      return this.clearTray(id);
    }
    if (source === "drink") {
      if (!this.s.drink) return false;
      this.s.drink = null;
      return this.changed();
    }
    if (["pot", "bowl", "fryer"].includes(kind) && /^\d+$/.test(id || "")) {
      const index = Number(id);
      if (kind !== "fryer") return this.discard(index);
      if (!this.s.fryer[index]) return false;
      this.s.fryer.splice(index, 1);
      return this.changed();
    }
    return false;
  }
  clearTray(id) {
    this.s.tray = this.s.tray.filter((d) => d.id !== id);
    return this.changed();
  }
  prepareEgg() {
    const s = this.s;
    if (s.phase !== "morning") return this.say(textVi("t_0b5675505120"));
    if (!consume(s, ["egg", "egg", "egg"]))
      return this.say(textVi("t_7c8710cee332"));
    s.prepared.egg += 3;
    this.say(textVi("t_e4d302480d81"), "ping");
    return this.changed();
  }
  fry(action, index = 0) {
    const s = this.s;
    if (action === "select") {
      if (s.fryer.length >= 1 + s.upgrades.fryer)
        return this.say(textVi("t_6772d6adfeae"));
      if (!consume(s, ["shrimp"])) return this.say(textVi("t_279dd18908bc"));
      s.fryer.push({ stage: "raw", time: 0 });
    } else {
      const p = s.fryer[index];
      if (!p) return false;
      if (action === "batter" && p.stage === "raw") {
        if (!consume(s, ["flour"])) return this.say(textVi("t_4b8584206c4b"));
        p.stage = "battered";
      } else if (action === "oil" && p.stage === "battered") {
        if (!consume(s, ["oil"])) return this.say(textVi("t_77ccc9196118"));
        p.stage = "frying";
      } else if (action === "lift" && p.stage === "frying") {
        if (p.time < balance.cooking.fryMinSeconds) {
          this.say(textVi("t_6e74d55f64fa"));
          return false;
        }
        if (p.time <= balance.cooking.fryMaxSeconds) {
          s.prepared.tempura++;
          this.say(textVi("t_ee4dd8ed3ba0"), "ping");
        } else this.say(textVi("t_96de7afc57a2"));
        s.fryer.splice(index, 1);
      } else return false;
    }
    return this.changed();
  }
  chop(accuracy) {
    this.s.cutBonus = Math.min(1, this.s.cutBonus + accuracy / 3);
    this.event({ type: "sound", sound: "chop" });
    return this.changed();
  }
  attachDrink(dishId) {
    const s = this.s,
      d = s.tray.find((d) => d.id === dishId);
    if (!d || !s.drink || s.drink.step < DRINKS[s.drink.id].steps)
      return this.say(textVi("t_b4d437894c1b"));
    if (d.drink) return this.say(textVi("t_e7d1a7382f8c"));
    d.drink = s.drink.id;
    d.strangeDrink = Boolean(s.drink.strange);
    d.drinkTemperature = s.drink.temperature;
    d.drinkTopping = s.drink.topping || null;
    d.quality += s.drink.quality;
    s.drink = null;
    return this.changed();
  }
  removeDrink(id) {
    const d = this.s.tray.find((d) => d.id === id);
    if (!d?.drink) return false;
    this.s.tray = this.s.tray.filter((dish) => dish.id !== id);
    this.say(textVi("t_02d01bf9b94f"));
    return this.changed();
  }
  side(id, kind = "tempura") {
    const d = this.s.tray.find((d) => d.id === id);
    if (!d || d.side || !SIDES[kind]) return false;
    if (SIDES[kind].stock.startsWith("prepared.")) {
      if (!this.s.prepared[kind])
        return this.say(
          kind === "egg"
            ? textVi("t_c683e4b5239d")
            : `${textVi("t_afb059dccb80")} ${SIDES[kind].shortName} ${textVi("t_b1c35347795e")}`,
        );
      this.s.prepared[kind]--;
    } else if (!consume(this.s, [SIDES[kind].stock]))
      return this.say(`${SIDES[kind].shortName} ${textVi("t_cebd4365636c")}`);
    d.side = true;
    d.sideKind = kind;
    return this.changed();
  }
  serve(dishId, customerId) {
    const s = this.s,
      d = s.tray.find((d) => d.id === dishId),
      c = s.customers.find((c) => c.id === customerId);
    if (!d || !c || c.status !== "waiting" || !c.accepted) return false;
    const partIndex = c.combo ? (d.partIndex ?? nextPartIndex(c)) : 0;
    if (
      c.combo &&
      (partIndex < 0 ||
        partIndex >= c.combo.parts.length ||
        c.combo.delivered.some((part) => part.index === partIndex))
    )
      return this.say(textVi("t_e8abdaea5c3b"));
    const r = judge(s, partCustomer(c, partIndex), d);
    s.tray = s.tray.filter((p) => p.id !== dishId);
    if (c.combo) {
      c.combo.delivered.push({
        index: partIndex,
        dish: structuredClone(d),
        result: r,
      });
      c.meal = structuredClone(d);
      const next = nextPartIndex(c);
      if (next >= 0) {
        if (s.selectedOrder === c.id) s.selectedPart = next;
        this.say(
          `${c.name} ${textVi("t_57fe809490f9")} ${c.combo.delivered.length}/${c.combo.parts.length} ${textVi("t_13df5283d348")} ${c.combo.parts.length - c.combo.delivered.length} ${textVi("t_8831a0e15484")}`,
          "bowl",
        );
        return this.changed();
      }
      c.result = combineResults(c.combo.delivered);
    } else {
      c.result = r;
      c.meal = structuredClone(d);
    }
    c.status = "eating";
    c.eatTime = balance.customers.eatSeconds;
    c.happy = c.result.score >= 72;
    s.tutorial = 5;
    this.say(`${c.name} ${textVi("t_764b7346ad4d")}`, "bowl");
    return this.changed();
  }
  settle(c) {
    if (c.settled || !c.result) return;
    const s = this.s,
      r = c.result;
    c.settled = true;
    s.money += r.payment + r.tip;
    s.reputation = clamp(s.reputation + r.rep, 0, 100);
    s.ledger.revenue += r.payment;
    s.ledger.tips += r.tip;
    s.ledger.served++;
    const neighbourhoodMessage = recordMeal(s, r);
    s.ledger.satisfaction += r.score;
    for (const part of orderParts(c))
      s.ledger.sales[part.recipe] = (s.ledger.sales[part.recipe] || 0) + 1;
    s.reviews.unshift({
      name: c.name,
      text: r.review,
      stars: clamp(Math.round(r.score / 20), 1, 5),
      day: s.day,
    });
    s.reviews = s.reviews.slice(0, 25);
    const message =
      (!c.combo && c.meal && r.correct && discover(s, c, c.meal)) ||
      (c.freestyle && !r.correct ? textVi("t_891997964f6d") : null);
    this.say(
      neighbourhoodMessage ||
        message ||
        `${c.name}: “${r.correct ? textVi("t_750d4c62c4a1") : textVi("t_2dedebdab672")}” +¥${r.payment + r.tip}`,
      "coin",
    );
    this.changed();
  }
  checkout(id) {
    const c = this.s.customers.find((customer) => customer.id === id);
    if (!c || c.status !== "checkout" || c.settled || !c.result) return false;
    this.settle(c);
    c.status = "departing";
    c.leaveTime = 0.7;
    return this.changed();
  }
  clear(id) {
    const s = this.s;
    if (s.sink >= balance.customers.sinkCapacity)
      return this.say(textVi("t_df11e5e75cb8"));
    const c = s.customers.find((c) => c.id === id && c.status === "dirty");
    if (!c) return false;
    s.sink++;
    s.customers = s.customers.filter((x) => x.id !== id);
    return this.changed();
  }
  wash(limit) {
    if (this.s.sink) {
      this.s.sink -= Math.min(
        this.s.sink,
        balance.washing.batchSize,
        limit ?? balance.washing.batchSize,
      );
      this.say(textVi("t_eeaa8b0d26da"), "pour");
      return this.changed();
    }
    return this.say(textVi("t_7f81b78fbb89"));
  }
  buy(id, qty = 5, premium = false) {
    if (!addStock(this.s, id, qty, premium))
      return this.say(textVi("t_bb29e4b8d8dc"));
    return this.changed();
  }
  discardStock(id) {
    if (!Object.hasOwn(this.s.inventory, id)) return false;
    this.s.inventory[id] = [];
    this.say(textVi("t_47cd5e05007c"));
    return this.changed();
  }
  upgrade(id) {
    const s = this.s,
      u = UPGRADES[id];
    if (!u || s.upgrades[id] >= u.max) return false;
    const cost = u.base * (s.upgrades[id] + 1);
    if (s.money < cost) return this.say(textVi("t_fa108b3efdef"));
    s.money -= cost;
    s.upgrades[id]++;
    if (id === "stove") {
      s.pots.push(null);
      s.burners.push({ stage: "empty", time: 0 });
    }
    if (id === "garden") s.plots.push(null);
    return this.changed();
  }
  unlock(id) {
    const s = this.s,
      r = recipeBook(s)[id];
    if (!r || r.hidden || s.unlocked.includes(id)) return false;
    if (s.money < r.unlock) return this.say(textVi("t_d40e7b1d24a5"));
    s.money -= r.unlock;
    s.unlocked.push(id);
    s.menu.push(id);
    return this.changed();
  }
  price(id, v) {
    if (setPrice(this.s, id, v)) return this.changed();
    return false;
  }
  menu(id) {
    const s = this.s;
    if (!s.unlocked.includes(id)) return false;
    if (s.menu.includes(id)) {
      if (s.menu.length === 1) return this.say(textVi("t_9a9f9ab56c0f"));
      s.menu = s.menu.filter((x) => x !== id);
    } else s.menu.push(id);
    return this.changed();
  }
  decorate(id) {
    const s = this.s,
      d = DECOR[id];
    if (!d) return false;
    if (!s.ownedDecor.includes(id)) {
      if (s.money < d.cost) return this.say(textVi("t_f85af18c5f2f"));
      s.money -= d.cost;
      s.ownedDecor.push(id);
    }
    if (s.decor[d.slot] === id) delete s.decor[d.slot];
    else s.decor[d.slot] = id;
    return this.changed();
  }
  hire(id) {
    const s = this.s,
      e = EMPLOYEES[id];
    if (!e) return false;
    const existing = s.employees[id];
    if (existing?.level >= 3) return false;
    const cost = existing
      ? e.cost * balance.staff.upgradeCostRatio * existing.level
      : e.cost;
    if (s.money < cost) return this.say(textVi("t_a1adb0d96ec8"));
    s.money -= cost;
    if (existing) existing.level++;
    else
      s.employees[id] = {
        level: 1,
        relationship: 0,
        clock: 0,
        learned: [],
        learning: null,
      };
    return this.changed();
  }
  plant(index, id) {
    const s = this.s,
      p = PLANTS[id];
    if (
      !p ||
      index >= s.plots.length ||
      s.plots[index] ||
      p.level > s.upgrades.garden ||
      (p.seasons && !p.seasons.includes(s.forecast.season)) ||
      s.money < p.cost
    )
      return this.say(textVi("t_d190be2651d7"));
    s.money -= p.cost;
    s.plots[index] = {
      id,
      growth: 0,
      watered: false,
      dryDays: 0,
      fertilized: false,
    };
    if (!s.collection.plants.includes(id)) s.collection.plants.push(id);
    return this.changed();
  }
  garden(index) {
    const s = this.s,
      p = s.plots[index];
    if (!p) return false;
    const def = PLANTS[p.id];
    if (p.growth >= def.days) {
      if (p.id === "flowers" || def.flower) {
        s.bouquets++;
      } else if (!addStock(s, p.id, def.yield, true, true))
        return this.say(textVi("t_e7d0cb93001e"));
      s.plots[index] = null;
      this.say(
        `${textVi("t_34a0e43b60ba")} ${def.name.toLowerCase()}.`,
        "ping",
      );
    } else {
      p.watered = true;
      this.say(textVi("t_45484cdb53f8"), "pour");
    }
    return this.changed();
  }
  close() {
    const s = this.s;
    if (s.phase !== "open" || s.closing) return false;
    s.closing = true;
    this.say(labels.shop.closedNotice);
    return this.changed();
  }
  reopen() {
    const s = this.s;
    if (s.phase !== "open" || !s.closing) return false;
    if (!s.menu.length) return this.say(textVi("t_98932ff31593"));
    s.closing = false;
    this.say(labels.shop.reopened, "bell");
    return this.changed();
  }
  finishClose() {
    const s = this.s;
    if (!canFinishDay(s)) return false;
    s.phase = "summary";
    s.payroll += wages(s);
    s.ledger.wages = s.day % BILLING.wagesEvery === 0 ? s.payroll : 0;
    if (s.ledger.wages) s.payroll = 0;
    const utilities =
      s.day % BILLING.utilitiesEvery === 0
        ? BILLING.utilitiesEvery * BILLING.utilitiesPerDay
        : 0;
    s.ledger.other += utilities;
    const due = s.ledger.wages + utilities + s.debt;
    s.debt = Math.max(0, due - s.money);
    s.money = Math.max(0, s.money - due);
    s.lastSummary = {
      ...s.ledger,
      debt: s.debt,
      profit:
        s.ledger.revenue +
        s.ledger.tips -
        s.ledger.ingredients -
        s.ledger.wages -
        s.ledger.other,
      rep: s.reputation - s.ledger.startRep,
    };
    s.pots = s.pots.map(() => null);
    s.tray = [];
    s.fryer = [];
    s.sidePrep = null;
    s.drink = null;
    return this.changed();
  }
  fertilize(index) {
    const p = this.s.plots[index];
    if (!p || p.fertilized || this.s.money < balance.garden.fertilizerCost)
      return false;
    this.s.money -= balance.garden.fertilizerCost;
    this.s.ledger.other += balance.garden.fertilizerCost;
    p.fertilized = true;
    return this.changed();
  }
  arrangeFlowers(room) {
    if (!["front", "guests", "drinks"].includes(room) || !this.s.bouquets)
      return false;
    this.s.bouquets--;
    this.s.flowerRooms[room] = this.s.day + balance.garden.bouquetDays;
    return this.changed();
  }
  nameRecipe(name) {
    const s = this.s,
      d = s.discoveryDraft;
    name = String(name).trim().replace(/[<>]/g, "").slice(0, 45);
    if (
      !d ||
      !name ||
      Object.keys(s.customRecipes).length >= balance.discovery.maxCustomRecipes
    )
      return false;
    const id = "custom" + (Object.keys(s.customRecipes).length + 1);
    s.customRecipes[id] = {
      name,
      kind: d.method || "hot",
      jp: textVi("t_9197fdae1778"),
      desc: textVi("t_4504474df84c") + d.customer + textVi("t_7079e27938e0"),
      broth: [...d.broth],
      formula: [...d.broth],
      tops: [...d.tops],
      price: balance.discovery.customPrice,
      hidden: true,
      unlock: 0,
    };
    s.prices[id] = balance.discovery.customPrice;
    s.pendingRecipes.push(id);
    s.collection.recipes.push(id);
    s.discoveries.unshift({ day: s.day, customer: d.customer, recipe: id });
    s.discoveryDraft = null;
    this.say(textVi("t_c2ea575d108c"), "ping");
    return this.changed();
  }
  nextDay() {
    const s = this.s;
    if (s.phase !== "summary") return false;
    s.day++;
    advancePetDay(s);
    s.closing = false;
    s.burners = s.pots.map(() => ({ stage: "empty", time: 0 }));
    s.brothBatch = {
      ingredients: [],
      stage: "empty",
      time: 0,
      servings: 0,
      quality: 0,
    };
    for (const id of s.pendingRecipes)
      if (!s.unlocked.includes(id)) s.unlocked.push(id);
    s.pendingRecipes = [];
    s.curryBatch = {
      ingredients: [],
      stage: "empty",
      time: 0,
      servings: 0,
      quality: 0,
    };
    s.brothSource = "regular";
    s.phase = "morning";
    s.elapsed = 0;
    s.forecast = forecast(s.day);
    s.ledger = emptyLedger();
    s.ledger.startRep = s.reputation;
    s.prepared = { egg: 0, tempura: 0, karaage: 0, gyoza: 0, tamagoyaki: 0 };
    s.sink = 0;
    const lost = expire(s);
    s.plots = s.plots.map((p) => {
      if (!p) return null;
      if (p.watered) {
        p.growth +=
          (PLANTS[p.id].seasons &&
          !PLANTS[p.id].seasons.includes(s.forecast.season)
            ? balance.garden.outOfSeasonGrowth
            : 1) * (p.fertilized ? balance.garden.fertilizedGrowth : 1);
        p.dryDays = 0;
      } else p.dryDays = (p.dryDays || 0) + 1;
      if (p.dryDays >= balance.garden.deathDryDays) {
        this.say(textVi("t_bc83c88dd138"));
        return null;
      }
      p.watered = false;
      p.fertilized = false;
      return p;
    });
    for (const e of Object.values(s.employees)) e.relationship++;
    if (s.money < balance.recovery.threshold) {
      s.money += balance.recovery.money;
      for (const id of ["noodles", "dashi", "soy", "mirin", "onion"])
        addStock(s, id, balance.recovery.stock, false, true);
      this.say(textVi("t_439106cd69f3"));
    } else if (lost) this.say(`${lost} ${textVi("t_26929db6b650")}`);
    return this.changed();
  }
}

Object.assign(Engine.prototype, cookingMethods);

Object.assign(Engine.prototype, drinkMethods);
Object.assign(Engine.prototype, petMethods);
Object.assign(Engine.prototype, sidePreparationMethods);
Object.assign(Engine.prototype, { teachRecipe });
