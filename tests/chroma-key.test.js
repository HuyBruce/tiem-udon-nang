import test from "node:test";
import assert from "node:assert/strict";
import { chromaKey } from "../tools/remove_bg.mjs";

test("chroma key removes connected green screen while preserving skin, sage and enclosed green details", () => {
  const width = 7,
    height = 7;
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set([0, 255, 0, 255], i * 4);
  for (let y = 1; y < 6; y++)
    for (let x = 1; x < 6; x++)
      data.set([245, 235, 221, 255], (y * width + x) * 4);
  data.set([124, 154, 91, 255], (3 * width + 2) * 4);
  data.set([0, 255, 0, 255], (3 * width + 3) * 4);
  const out = chromaKey(data, width, height);
  assert.deepEqual([...out.subarray(0, 4)], [0, 0, 0, 0]);
  for (const [x, y] of [
    [1, 1],
    [2, 3],
    [3, 3],
  ]) {
    const p = (y * width + x) * 4;
    assert.deepEqual(out.subarray(p, p + 4), data.subarray(p, p + 4));
  }
  assert.equal(data[3], 255, "source is not modified");
});

test("mixed edge gets real partial alpha and reduced green spill", () => {
  const out = chromaKey(Buffer.from([80, 200, 60, 255]), 1, 1);
  assert.ok(out[3] > 0 && out[3] < 255);
  assert.ok(out[1] <= Math.max(out[0], out[2]) + 25);
});
