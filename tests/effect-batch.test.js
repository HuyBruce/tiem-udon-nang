import test from "node:test";
import assert from "node:assert/strict";
import {
  withEffectBatch,
  transient,
  clearEffects,
  effectStats,
} from "../src/ui/motion/effects.js";

test("feedback batches retain animation priority and all caps without repeated global enumeration", () => {
  const original = globalThis.document;
  const animations = [];
  let reads = 0;
  const animation = (node, infinite = false) => {
    const a = {
      playState: "running",
      effect: {
        target: node,
        getTiming: () => ({ iterations: infinite ? Infinity : 1 }),
      },
      cancel() {
        this.playState = "idle";
      },
      finished: new Promise(() => {}),
    };
    animations.push(a);
    return a;
  };
  const node = () => ({
    childNodes: [],
    dataset: {},
    isConnected: false,
    closest: () => null,
    animate() {
      return animation(this);
    },
    remove() {
      this.isConnected = false;
    },
  });
  const loops = Array.from({ length: 40 }, () => animation(node(), true));
  globalThis.document = {
    getAnimations() {
      reads++;
      return animations.filter((a) => a.playState !== "idle");
    },
    body: {
      append(n) {
        n.isConnected = true;
      },
    },
  };
  try {
    withEffectBatch(() => {
      for (let i = 0; i < 30; i++) {
        withEffectBatch(() =>
          transient(node(), [{ opacity: 1 }], { duration: 1000 }),
        );
        assert.ok(
          animations.filter((a) => a.playState !== "idle").length <= 40,
        );
        assert.ok(effectStats().effects <= 12);
        assert.ok(effectStats().nodes <= 24);
      }
    });
    assert.equal(reads, 1);
    assert.ok(loops.some((a) => a.playState === "idle"));
    assert.equal(effectStats().effects, 12);
    assert.throws(
      () =>
        withEffectBatch(() => {
          throw Error("interrupted");
        }),
      /interrupted/,
    );
    transient(node(), [{ opacity: 1 }], { duration: 1000 });
    assert.equal(
      reads,
      3,
      "exception releases batch; next producer obtains a fresh native inventory",
    );
  } finally {
    clearEffects();
    globalThis.document = original;
  }
});
