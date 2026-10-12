import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";

const output =
  process.env.PERF_GEOMETRY_OUTPUT || "test-results/perf-camera-geometry";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  await page.goto(
    (process.env.UDON_TEST_BASE_URL || "http://localhost:5173") + "/?debug=1",
  );
  const result = await page.evaluate(async () => {
    const { createWorldCamera } =
      await import("/src/ui/camera/world-camera.js");
    // Isolated DOM fixture: no renderer or game clock changes in production.
    const original = document.querySelector("#stage");
    if (original) original.id = "original-stage";
    const fixture = document.createElement("div");
    fixture.innerHTML =
      '<div id="stage" class="world-camera" style="position:relative;width:390px;height:600px;overflow:clip"><div class="world-strip" data-world-owned style="position:absolute;width:100%;height:100%"></div></div><div class="direct-workbench" style="position:absolute;width:100px"><div data-overlay-probe style="width:50%;height:20px"></div></div>';
    document.body.append(fixture);
    let selected = "room0",
      revision = 0;
    const camera = createWorldCamera({
      scenes: () => Array.from({ length: 4 }, (_, i) => ({ id: "room" + i })),
      selected: () => selected,
      label: (id) => id,
      room: () =>
        '<div data-probe style="position:absolute;left:20px;top:50px;width:80px;height:100px"></div>',
      revision: () => revision,
      moving: () => true,
      blocked: () => false,
      pointerActive: () => false,
      changed: (id) => {
        selected = id;
        fixture.querySelector(".direct-workbench").style.width =
          id === "room2" ? "240px" : "100px";
      },
      wake() {},
      visibleChanged() {},
    });
    const sheet = document.createElement("style");
    sheet.textContent =
      "#stage .world-room{position:absolute;top:0;width:100%;height:100%}";
    document.head.append(sheet);
    camera.reconcile();
    // Allow the initial ResizeObserver invalidation to finish before measuring.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    camera.go("room1", true);
    const node = fixture.querySelector(
      '[data-world-room="room1"] [data-probe]',
    );
    const native = node.getBoundingClientRect.bind(node);
    let reads = 0;
    node.getBoundingClientRect = () => {
      reads++;
      return native();
    };
    camera.prepareVisibility([node]);
    const first = reads;
    const overlay = fixture.querySelector("[data-overlay-probe]");
    const overlayNative = overlay.getBoundingClientRect.bind(overlay);
    let overlayReads = 0;
    overlay.getBoundingClientRect = () => {
      overlayReads++;
      return overlayNative();
    };
    camera.prepareVisibility([node, overlay]);
    camera.go("room2");
    camera.step(0.08, true); // Room 2 is newly mounted; room 1 remains visible.
    const visible = camera.stats().visible;
    camera.prepareVisibility([node, overlay]);
    const neighborRefreshReads = reads - first;
    const overlayInvalidated = overlayReads === 2;
    const fresh = fixture.querySelector(
      '[data-world-room="room2"] [data-probe]',
    );
    camera.prepareVisibility([node, fresh]);
    const freshVisible = camera.contains(fresh);
    const r = fresh.getBoundingClientRect(),
      frame = fixture.querySelector("#stage").getBoundingClientRect();
    const nativeFreshVisible =
      r.right > frame.left &&
      r.left < frame.right &&
      r.bottom > frame.top &&
      r.top < frame.bottom;
    revision++;
    camera.reconcile(); // Real state/render changes must invalidate retained geometry.
    camera.prepareVisibility([node]);
    const renderInvalidated = reads > first + neighborRefreshReads;
    const beforeResize = reads;
    fixture.querySelector("#stage").style.width = "330px";
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    camera.prepareVisibility([node]);
    const resizeInvalidated = reads > beforeResize;
    camera.dispose();
    fixture.remove();
    sheet.remove();
    if (original) original.id = "stage";
    return {
      first,
      neighborRefreshReads,
      visible,
      freshVisible,
      nativeFreshVisible,
      renderInvalidated,
      overlayInvalidated,
      resizeInvalidated,
    };
  });
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(output + "/metrics.json", JSON.stringify(result, null, 2));
  expect(result.first).toBe(1);
  expect(result.visible).toEqual(["room1", "room2"]);
  expect(result.neighborRefreshReads).toBe(0);
  expect(result.freshVisible).toBe(result.nativeFreshVisible);
  expect(result.renderInvalidated).toBe(true);
  expect(result.overlayInvalidated).toBe(true);
  expect(result.resizeInvalidated).toBe(true);
  console.log(
    "Camera geometry cache survives unrelated room mounting and invalidates on render PASS",
    result,
  );
} finally {
  await browser.close();
}
