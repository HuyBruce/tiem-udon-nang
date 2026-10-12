import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import {
  isShopOpen,
  canFinishDay,
  closingReminderDue,
} from "../src/systems/shop-hours.js";
import { clockText, serviceSeconds, traffic } from "../src/systems/time.js";
import { SaveService, SAVE_KEY } from "../src/systems/save.js";
import { validState } from "../src/systems/validation.js";

const advance = (e, seconds) => {
  for (let i = 0; i < seconds; i++) e.tick(1);
};
test("closed admission blocks all arrivals for sixty running seconds, then opens again", () => {
  const e = new Engine();
  assert.equal(isShopOpen(e.s), false);
  assert.equal(e.open(), true);
  const existing = e.s.customers[0];
  e.accept(existing.id);
  existing.patience = existing.maxPatience = 600;
  const serial = e.s.serial;
  const elapsed = e.s.elapsed;
  assert.equal(e.close(), true);
  e.spawn();
  advance(e, 60);
  assert.equal(e.s.serial, serial);
  assert.equal(e.s.elapsed, elapsed + 60);
  assert.equal(e.s.customers[0].accepted, true);
  assert.equal(isShopOpen(e.s), false);
  assert.equal(e.reopen(), true);
  assert.equal(e.s.elapsed, elapsed + 60);
  assert.equal(e.s.customers[0].id, existing.id);
  advance(e, 1);
  assert.ok(e.s.serial > serial);
});
test("an empty closed shop remains closed and can reopen after midnight", () => {
  const e = new Engine();
  e.open();
  e.s.customers = [];
  e.s.elapsed = serviceSeconds() + 720;
  const money = e.s.money;
  e.close();
  advance(e, 60);
  assert.equal(canFinishDay(e.s), true);
  assert.equal(e.s.phase, "open");
  assert.equal(e.s.money, money);
  assert.equal(e.reopen(), true);
  assert.ok(traffic(e.s) > 0);
  e.tick(1);
  assert.ok(e.s.customers.length > 0);
  assert.equal(e.s.day, 1);
  assert.equal(validState(e.s), true);
});
test("18:00 is a reminder and never a clamp or automatic close", () => {
  const e = new Engine();
  e.open();
  e.s.elapsed = serviceSeconds() - 1;
  assert.equal(closingReminderDue(e.s), false);
  e.tick(1);
  assert.equal(closingReminderDue(e.s), true);
  assert.equal(isShopOpen(e.s), true);
  assert.equal(clockText(e.s), "18:00");
  e.tick(1);
  assert.equal(clockText(e.s), "18:01");
  e.close();
  assert.equal(closingReminderDue(e.s), false);
});
test("only an explicit, fully cleaned summary charges wages once", () => {
  const e = new Engine();
  e.open();
  e.close();
  assert.equal(e.finishClose(), false);
  e.s.customers = [];
  e.s.sink = 1;
  assert.equal(e.finishClose(), false);
  e.s.sink = 0;
  assert.equal(e.finishClose(), true);
  const finished = structuredClone(e.s);
  assert.equal(e.reopen(), false);
  assert.equal(e.finishClose(), false);
  assert.deepEqual(e.s, finished);
  assert.equal(e.nextDay(), true);
  assert.equal(e.s.day, 2);
  assert.equal(isShopOpen(e.s), false);
});
test("legacy v2/v3 saves migrate through the existing key and preserve admission", () => {
  for (const version of [2, 3])
    for (const closing of [true, false, undefined]) {
      const e = new Engine();
      e.open();
      e.s.elapsed = 400;
      const source = structuredClone(e.s);
      source.version = version;
      if (closing === undefined) delete source.closing;
      else source.closing = closing;
      const memory = new Map([[SAVE_KEY, JSON.stringify({ state: source })]]);
      const storage = {
        getItem: (k) => memory.get(k) || null,
        setItem: (k, v) => memory.set(k, v),
      };
      const save = new SaveService(storage);
      const loaded = save.load();
      assert.ok(loaded);
      assert.equal(loaded.version, 3);
      assert.equal(loaded.closing, closing ?? false);
      assert.equal(isShopOpen(loaded), !(closing ?? false));
      assert.equal(save.save(loaded), true);
      const restored = new Engine(save.load());
      assert.equal(restored.s.elapsed, 400);
      assert.equal(validState(restored.s), true);
      if (closing) assert.equal(restored.reopen(), true);
    }
});
