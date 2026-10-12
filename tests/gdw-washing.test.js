import test from "node:test";
import assert from "node:assert/strict";
import { Engine } from "../src/systems/engine.js";
import { washCount, washSeconds } from "../src/systems/washing.js";
import { staffTick } from "../src/systems/employees.js";
import balance from "../config/balance.json" with { type: "json" };
test("washing batches consume at most three and retain capacity four", () => {
  for (const count of [0, 1, 2, 3, 4]) {
    const e = new Engine();
    e.s.sink = count;
    const n = washCount(count);
    e.wash();
    assert.equal(e.s.sink, count - n);
  }
  const e = new Engine();
  e.open();
  const c = e.s.customers[0];
  c.status = "dirty";
  e.s.sink = 4;
  assert.equal(e.clear(c.id), false);
  assert.equal(e.s.sink, 4);
  assert.ok(e.s.customers.includes(c));
});
test("Binh washes three bowls at the speed of each level", () => {
  for (const level of [1, 2, 3]) {
    const e = new Engine();
    e.s.money = 200000;
    e.hire("binh");
    e.s.employees.binh.level = level;
    e.s.sink = 4;
    staffTick(e, washSeconds(level) - 0.01);
    assert.equal(e.s.sink, 4);
    staffTick(e, 0.02);
    assert.equal(e.s.sink, 1);
    staffTick(e, washSeconds(level));
    assert.equal(e.s.sink, 0);
  }
  assert.ok(balance.washing.manualSeconds > 0);
  assert.ok(washSeconds(3) < washSeconds(1));
});
