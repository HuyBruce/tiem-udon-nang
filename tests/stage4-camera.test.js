import test from "node:test";
import assert from "node:assert/strict";
import {
  clampOffset,
  nearestRoom,
  visibleRooms,
  snapEase,
  edgeSpeed,
  worldCoordinates,
} from "../src/ui/camera/model.js";

test("camera: world intersection includes both rooms only while crossing their seam", () => {
  assert.deepEqual(visibleRooms(0, 6), [0]);
  assert.deepEqual(visibleRooms(2.01, 6), [2, 3]);
  assert.deepEqual(visibleRooms(2.99, 6), [2, 3]);
  assert.deepEqual(visibleRooms(3, 6), [3]);
  assert.deepEqual(visibleRooms(99, 6), [5]);
  assert.deepEqual(visibleRooms(-1, 6), [0]);
  assert.deepEqual(worldCoordinates(3, 360), { x: 1080, width: 360 });
});
test("camera: nearest snap, clamped boundaries and gentle edge carrying", () => {
  assert.equal(nearestRoom(2.49, 9), 2);
  assert.equal(nearestRoom(2.5, 9), 3);
  assert.equal(clampOffset(20, 9), 8);
  assert.equal(snapEase(0), 0);
  assert.equal(snapEase(1), 1);
  assert.ok(snapEase(0.75) - snapEase(0.5) < snapEase(0.5) - snapEase(0.25));
  const rect = { left: 15, right: 375 };
  assert.equal(edgeSpeed(195, rect), 0);
  assert.ok(edgeSpeed(20, rect) < 0);
  assert.ok(edgeSpeed(370, rect) > 0);
  assert.equal(edgeSpeed(600, rect), 1.1);
});
