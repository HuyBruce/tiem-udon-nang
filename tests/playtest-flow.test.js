import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { clockText, serviceSeconds } from "../src/systems/time.js";
import { validState } from "../src/systems/validation.js";
import { cookableOrders, selectNextCookable } from "../src/ui/order-queue.js";
import { swipeTarget } from "../src/ui/camera/model.js";

test("suggested closing hour keeps admission open; only explicit summary bills once", () => {
  const e = new Engine();
  e.open();
  e.s.nextArrival = 9999;
  e.s.elapsed = serviceSeconds() - 1;
  const id = e.s.customers[0].id;
  e.tick(1);
  assert.equal(serviceSeconds(), 480);
  assert.equal(e.s.closing, false);
  assert.equal(e.s.phase, "open");
  assert.equal(e.s.customers[0].id, id);
  assert.equal(clockText(e.s), "18:00");
  e.s.elapsed = 4000;
  assert.notEqual(clockText(e.s), "18:00");
  e.close();
  assert.equal(e.reopen(), true);
  e.s.customers = [];
  e.s.sink = 0;
  e.close();
  e.tick(1);
  assert.equal(e.s.phase, "open");
  assert.equal(e.finishClose(), true);
  assert.equal(e.s.phase, "summary");
  const money = e.s.money;
  e.close();
  e.tick(2);
  assert.equal(e.s.money, money);
  assert.equal(validState(e.s), true);
});
test("reopening during cleanup preserves the same day, accepted guests and stock", () => {
  const e = new Engine();
  e.open();
  e.accept(e.s.customers[0].id);
  e.tick(12 / 6);
  const before = structuredClone(e.s);
  assert.equal(e.close(), true);
  assert.equal(e.reopen(), true);
  assert.equal(e.s.closing, false);
  assert.equal(e.s.elapsed, before.elapsed);
  assert.deepEqual(e.s.customers, before.customers);
  assert.deepEqual(e.s.inventory, before.inventory);
  assert.equal(e.s.money, before.money);
  assert.equal(e.s.day, before.day);
});
test("several accepted orders survive reload; queue skips prepared/served combo parts", () => {
  const e = new Engine();
  e.open();
  e.spawn();
  const [a, b] = e.s.customers;
  e.accept(a.id);
  e.accept(b.id);
  const reload = new Engine(structuredClone(e.s));
  assert.ok(reload.s.customers.every((c) => c.accepted));
  assert.equal(validState(reload.s), true);
  assert.equal(reload.s.version, 3);
  assert.equal(cookableOrders(reload.s).length, 2);
  // UI state selects the next accepted ticket without re-reading any customer.
  reload.s.tray.push({ orderId: b.id, partIndex: 0 });
  selectNextCookable(reload);
  assert.equal(reload.s.selectedOrder, a.id);
  a.combo = { parts: [{ ...a }, { ...a }], delivered: [{ index: 0 }] };
  e.s.pots[0] = { orderId: a.id, partIndex: 1 };
  assert.deepEqual(
    cookableOrders(e.s).map(({ c }) => c.id),
    [b.id],
  );
});
test("camera flick advances gently, slow/vertical-small movement snaps nearest", () => {
  assert.equal(swipeTarget(2, 0.3, 3, 6), 3);
  assert.equal(swipeTarget(2, 0.3, 0.1, 6), 2);
  assert.equal(swipeTarget(2, 0.03, 5, 6), 2);
  assert.equal(swipeTarget(0, -0.6, -5, 6), 0);
  assert.equal(swipeTarget(5, 0.6, 5, 6), 5);
});
