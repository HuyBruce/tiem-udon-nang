import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "vite";
import { chromium } from "@playwright/test";
import { Engine } from "../src/systems/engine.js";
import { validState } from "../src/systems/validation.js";
import { recipeBook, brothFormula } from "../src/systems/discovery.js";

const output = process.env.GDV_PERF_OUTPUT || "review/gdv/step3/before";
const rates = (process.env.GDV_CPU_RATES || "4,6,20").split(",").map(Number);
const duration = Number(process.env.GDV_SAMPLE_MS || 5000);
const renderer = process.env.GDV_RENDERER || "dom";
const browserChannel = process.env.GDV_BROWSER_CHANNEL;
const leakDuration = Number(process.env.GDV_LEAK_MS || 0);
const captureHeap = process.env.GDV_HEAP_SNAPSHOTS === "1";
const captureCPU = process.env.GDV_CPU_PROFILE === "1";
const travelOnly = process.env.GDV_FOCUS === "travel";
const directory = path.resolve(
  process.env.GDV_BUILD_OUTPUT || "test-results/gdv-benchmark-build",
);
const seed =
  process.env.GDV_FIXTURE_SEED === undefined
    ? null
    : Number(process.env.GDV_FIXTURE_SEED) >>> 0;
const captureTrace = process.env.GDV_TRAVEL_TRACE === "1";
const captureInvalidation = process.env.GDV_INVALIDATION_TRACE === "1";
const sourceRoot = path.resolve(process.env.GDV_SOURCE_ROOT || process.cwd());
const sourceHashes = Object.fromEntries(
  await Promise.all(
    [
      "src/main.js",
      "src/composition.css",
      "src/experience.css",
      "src/ui/camera/world-camera.js",
      "src/ui/experience.js",
      "src/ui/guest-motion.js",
      "src/ui/motion/controller.js",
      "src/ui/motion/effects.js",
      "src/ui/motion/animation-budget.js",
    ].map(async (file) => [
      file,
      crypto
        .createHash("sha256")
        .update(await fs.readFile(path.join(sourceRoot, file)))
        .digest("hex"),
    ]),
  ),
);
const outputExists = await fs.stat(output).then(
  () => true,
  () => false,
);
if (process.env.GDV_EXCLUSIVE_OUTPUT === "1" && outputExists)
  throw new Error("Benchmark output already exists");
if (
  process.env.GDV_EXCLUSIVE_OUTPUT === "1" &&
  (await fs.stat(directory).then(
    () => true,
    () => false,
  ))
)
  throw new Error("Benchmark build output already exists");
await fs.mkdir(output, { recursive: true });
await build({
  root: process.env.GDV_SOURCE_ROOT || process.cwd(),
  logLevel: "error",
  plugins: [
    {
      name: "gdv-benchmark-only",
      transformIndexHtml: {
        order: "pre",
        handler: (html) =>
          html.replace(
            "</head>",
            '<script type="module" src="/tools/gdv-bench-entry.js"></script></head>',
          ),
      },
    },
  ],
  build: {
    outDir: directory,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    sourcemap: process.env.GDV_SOURCE_MAP === "1" ? "hidden" : false,
  },
});
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost"),
      requested = path.resolve(
        directory,
        "." + decodeURIComponent(url.pathname),
      );
    if (
      requested !== directory &&
      !requested.startsWith(directory + path.sep)
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    const file =
      url.pathname === "/" ? path.join(directory, "index.html") : requested;
    res.setHeader(
      "Content-Type",
      mime[path.extname(file)] || "application/octet-stream",
    );
    res.end(await fs.readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((resolve) => server.listen(4317, "127.0.0.1", resolve));
const browser = await chromium.launch(
  browserChannel ? { channel: browserChannel, args: ["--enable-gpu"] } : {},
);
const results = [];
const browserCDP = await browser.newBrowserCDPSession();
const hardwareInfo = await browserCDP
  .send("SystemInfo.getInfo")
  .catch(() => null);
function fixture(withDish = false) {
  const e = new Engine();
  if (seed !== null) e.s.tasteSeed = seed;
  e.s.money = 200000;
  for (let i = 0; i < 3; i++) e.upgrade("seats");
  for (const id of ["thu", "mika", "binh", "yui"]) e.hire(id);
  e.adoptPet("cat");
  e.decorate("flowers");
  e.open();
  for (let i = 1; i < 8; i++) e.spawn();
  e.s.nextArrival = 1000;
  e.tick(2);
  if (withDish) {
    const c = e.s.customers[0],
      r = recipeBook(e.s)[c.recipe];
    e.accept(c.id);
    e.s.tray.push({
      id: "dish901",
      orderId: c.id,
      stage: "ready",
      lifted: true,
      time: 10,
      duration: 9,
      texture: "perfect",
      quality: 1,
      poured: true,
      broth: brothFormula(r),
      tops: [
        ...r.tops.filter((t) => t !== c.omit),
        ...(c.extra ? [c.extra] : []),
      ],
      method: r.kind || "hot",
      temperature: r.kind === "cold" ? "cold" : "hot",
      drink: c.drink,
      drinkTemperature: c.drinkTemperature,
      drinkTopping: c.drinkTopping,
      side: c.side,
      sideKind: c.sideKind,
      noodleTier: c.noodleTier,
    });
  }
  if (!validState(e.s)) throw new Error("Invalid benchmark fixture");
  return e.s;
}
async function ready(p) {
  await p.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) => i.decode().catch(() => {})),
    );
  });
  if (renderer === "canvas" && (await p.locator("#stage").count()))
    await p.waitForFunction(() => {
      const canvas = document.querySelector(".world-canvas"),
        stats = canvas?.udonRendererStats?.();
      return (
        stats?.failed ||
        (stats?.backend === "webgl" && canvas.dataset.rendererReady === "true")
      );
    });
}
async function restart(p) {
  await p.reload();
  await p.locator("[data-act=start]").click();
  if (await p.locator(".close-sheet").count())
    await p.locator(".close-sheet").click();
  await p.addStyleTag({
    content: ".debug-tools,.clock-diagnostics{display:none!important}",
  });
  await ready(p);
}
async function measure(p, mode, ms) {
  return p.evaluate(
    async ({ mode, ms }) => {
      const fx = window.__gdvEffects,
        samples = [],
        longTasks = [];
      if (!fx?.effectStats)
        throw new Error("Benchmark effects entry was not bundled");
      const observer = new PerformanceObserver((list) =>
        longTasks.push(
          ...list
            .getEntries()
            .map((e) => ({ start: e.startTime, duration: e.duration })),
        ),
      );
      observer.observe({ type: "longtask", buffered: false });
      let last = performance.now(),
        start = last,
        maxEffects = 0,
        maxEffectNodes = 0,
        maxAnimations = 0,
        crossings = 0,
        lastRooms = "",
        index = 0;
      const path = [
        "guests0",
        "guests1",
        "guests2",
        "guests3",
        "drinks",
        "kitchen",
        "storage",
        "garden",
        "storage",
        "kitchen",
        "drinks",
        "guests3",
      ];
      const travel =
        mode === "camera"
          ? setInterval(
              () =>
                document
                  .querySelector(
                    `.scene-pagination [data-arg=${path[index++ % path.length]}]`,
                  )
                  ?.click(),
              720,
            )
          : 0;
      let scrollDirection = 1;
      const scrolling =
        mode === "recipe-scroll"
          ? setInterval(() => {
              const el = document.querySelector(".sheet-content");
              if (!el) return;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10)
                scrollDirection = -1;
              if (el.scrollTop <= 0) scrollDirection = 1;
              el.scrollBy(0, scrollDirection * 140);
            }, 120)
          : 0;
      const burst = setInterval(() => {
        const a = document.querySelector(".scene-pagination .active");
        fx.touchFeedback(a);
        fx.moneyFeedback(5, a);
      }, 180);
      // getAnimations() can synchronously flush dirty styles. Polling it after
      // each game RAF became the largest CPU sample in the profiler and changed
      // the workload being measured. Inventory is sampled separately at 250ms;
      // frame timing, effect counts and crossings still cover every frame.
      const animationInventory = setInterval(() => {
        maxAnimations = Math.max(
          maxAnimations,
          document.getAnimations().length,
        );
      }, 250);
      await new Promise((resolve, reject) => {
        const watchdog = setTimeout(
          () => reject(new Error("RAF measurement stalled")),
          ms + 30000,
        );
        function frame() {
          try {
            const now = performance.now();
            samples.push(now - last);
            last = now;
            const rooms = document.querySelector("#stage").dataset.visibleRooms;
            if (rooms !== lastRooms && rooms.includes(",")) crossings++;
            lastRooms = rooms;
            const stats = fx.effectStats();
            maxEffects = Math.max(maxEffects, stats.effects);
            maxEffectNodes = Math.max(maxEffectNodes, stats.nodes);
            if (now - start < ms) requestAnimationFrame(frame);
            else {
              clearTimeout(watchdog);
              resolve();
            }
          } catch (error) {
            clearTimeout(watchdog);
            reject(error);
          }
        }
        requestAnimationFrame(frame);
      });
      clearInterval(travel);
      clearInterval(scrolling);
      clearInterval(burst);
      clearInterval(animationInventory);
      observer.disconnect();
      const sorted = [...samples].sort((a, b) => a - b),
        elapsed = last - start;
      return {
        durationMs: elapsed,
        frames: samples.length,
        fps: (samples.length * 1000) / elapsed,
        meanMs: elapsed / samples.length,
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: Math.max(...samples),
        over33: samples.filter((n) => n > 33.34).length,
        over50: samples.filter((n) => n > 50).length,
        longTasks,
        maxEffects,
        maxEffectNodes,
        maxAnimations,
        animationInventoryIntervalMs: 250,
        crossings,
      };
    },
    { mode, ms },
  );
}
async function snapshot(p, cdp) {
  const metrics = Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [
      m.name,
      m.value,
    ]),
  );
  return {
    ...(await p.evaluate(() => ({
      nodes: document.querySelectorAll("*").length,
      motion: window.__gdvMotionStats?.(),
      renderer: document
        .querySelector(".world-canvas")
        ?.udonRendererStats?.() || { kind: "dom" },
      recipeSlots: document.querySelectorAll(".recipe-slot").length,
      mountedRecipes: document.querySelectorAll(".recipe").length,
      rooms: [...document.querySelectorAll("[data-world-room]")].map((el) => ({
        id: el.dataset.worldRoom,
        nodes: el.querySelectorAll("*").length,
      })),
      customers: [...document.querySelectorAll("[data-guest]")].length,
      visibleImageFailures: [
        ...document.querySelectorAll("[data-world-room] img"),
      ]
        .filter(
          (img) =>
            img.getBoundingClientRect().width > 0 &&
            (!img.complete || !img.naturalWidth),
        )
        .map((img) => img.getAttribute("src")),
      liveCustomers: JSON.parse(localStorage.getItem("debug-udon-nang-v1"))
        .state.customers.length,
      heavy: [
        ...document.querySelectorAll(
          ".game,.sheet,.modal-backdrop,.sprite,.scene-painting",
        ),
      ]
        .map((el) => {
          const s = getComputedStyle(el);
          return {
            class: el.className,
            filter: s.filter,
            backdrop: s.backdropFilter,
            shadow: s.boxShadow,
          };
        })
        .filter(
          (s) =>
            s.filter !== "none" || s.backdrop !== "none" || s.shadow !== "none",
        ),
      images: performance
        .getEntriesByType("resource")
        .filter((r) => /\.(webp|png|svg)(\?|$)/.test(r.name))
        .map((r) => ({
          url: r.name.split("/").pop(),
          compressedBytes: r.encodedBodySize,
          transferBytes: r.transferSize,
          durationMs: r.duration,
        })),
    }))),
    heapUsed: metrics.JSHeapUsedSize,
    heapTotal: metrics.JSHeapTotalSize,
    cdpNodes: metrics.Nodes,
    layoutCount: metrics.LayoutCount,
    recalcStyleCount: metrics.RecalcStyleCount,
  };
}
async function traceStart(cdp, label, rate) {
  const events = [];
  const collect = ({ value }) => events.push(...value);
  if (captureTrace) {
    cdp.on("Tracing.dataCollected", collect);
    await cdp.send("Tracing.start", {
      categories:
        "devtools.timeline,blink.user_timing,v8" +
        (captureInvalidation
          ? ",disabled-by-default-devtools.timeline.invalidationTracking"
          : ""),
      transferMode: "ReportEvents",
    });
  }
  if (captureCPU) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
  }
  return async () => {
    if (captureCPU) {
      const { profile } = await cdp.send("Profiler.stop");
      await fs.writeFile(
        path.join(output, `${label}-${rate}x.cpuprofile`),
        JSON.stringify(profile),
      );
      await cdp.send("Profiler.disable");
    }
    if (captureTrace) {
      const done = new Promise((resolve) =>
        cdp.once("Tracing.tracingComplete", resolve),
      );
      await cdp.send("Tracing.end");
      await done;
      cdp.off("Tracing.dataCollected", collect);
      await fs.writeFile(
        path.join(output, `${label}-${rate}x.trace.json`),
        JSON.stringify({ traceEvents: events }),
      );
    }
  };
}
async function heapSnapshot(cdp, name) {
  const chunks = [];
  const onChunk = ({ chunk }) => chunks.push(chunk);
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  try {
    await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false });
    await fs.writeFile(
      path.join(output, name + ".heapsnapshot"),
      chunks.join(""),
    );
  } finally {
    cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  }
}
try {
  for (const rate of rates) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      serviceWorkers: "block",
    });
    const p = await context.newPage(),
      cdp = await context.newCDPSession(p),
      errors = [];
    p.on("pageerror", (e) => {
      errors.push(e.message);
      console.error("Browser error:", e.message);
    });
    p.setDefaultTimeout(60000);
    await cdp.send("Performance.enable");
    await cdp.send("Network.enable");
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: 200000,
      uploadThroughput: 93750,
      connectionType: "cellular4g",
    });
    let layers = 0,
      maxLayers = 0;
    await cdp.send("LayerTree.enable");
    cdp.on("LayerTree.layerTreeDidChange", (e) => {
      layers = e.layers?.length || 0;
      maxLayers = Math.max(maxLayers, layers);
    });
    const initialFixture = fixture();
    await fs.writeFile(
      path.join(output, `fixture-${rate}x.json`),
      JSON.stringify({ seed, state: initialFixture }, null, 2),
    );
    await p.addInitScript(
      (s) =>
        localStorage.setItem(
          "debug-udon-nang-v1",
          JSON.stringify({ state: s }),
        ),
      initialFixture,
    );
    console.log(`CPU ${rate}x loading isolated production build`);
    const startup = performance.now();
    await p.goto(
      `http://127.0.0.1:4317/?debug=1&renderer=${encodeURIComponent(renderer)}`,
    );
    console.log("Navigation loaded");
    await ready(p);
    console.log("Landing decoded");
    const landingReadyMs = performance.now() - startup;
    await p.locator("[data-act=start]").click();
    if (await p.locator(".close-sheet").count())
      await p.locator(".close-sheet").click();
    await p.addStyleTag({
      content: ".debug-tools,.clock-diagnostics{display:none!important}",
    });
    await ready(p);
    const playReadyMs = performance.now() - startup;
    const run = {
      rate,
      dpr: 3,
      rendererRequested: renderer,
      browserChannel: browserChannel || "headless-shell",
      browserVersion: browser.version(),
      viewport: { width: 390, height: 844 },
      fixtureSeed: seed,
      gpuDevices: hardwareInfo?.gpu?.devices,
      network: {
        latencyMs: 150,
        downloadBytesPerSecond: 200000,
        uploadBytesPerSecond: 93750,
      },
      landingReadyMs,
      playReadyMs,
      scenarios: [],
    };
    for (const room of travelOnly
      ? []
      : ["front", "guests0", "drinks", "kitchen", "storage", "garden"]) {
      console.log(`CPU ${rate}x preparing ${room}`);
      await restart(p); // Same live eight-customer seed for each independent scenario.
      const switchStart = performance.now();
      await p.locator(`.scene-pagination [data-arg=${room}]`).click();
      await p.waitForFunction(
        (room) =>
          document.querySelector("#stage").dataset.visibleRooms === room,
        room,
      );
      await ready(p);
      const switchMs = performance.now() - switchStart;
      maxLayers = layers;
      const events = [];
      cdp.on("Tracing.dataCollected", onTrace);
      function onTrace(e) {
        for (const event of e.value)
          if (
            [
              "Paint",
              "UpdateLayerTree",
              "CompositeLayers",
              "Layerize",
            ].includes(event.name)
          )
            events.push(event);
      }
      await cdp.send("Tracing.start", {
        categories: "devtools.timeline",
        transferMode: "ReportEvents",
      });
      const frames = await measure(p, "steady", duration);
      const complete = new Promise((resolve) =>
        cdp.once("Tracing.tracingComplete", resolve),
      );
      await cdp.send("Tracing.end");
      await complete;
      cdp.off("Tracing.dataCollected", onTrace);
      const paint = {};
      for (const event of events) {
        paint[event.name] ??= { count: 0, durationMs: 0 };
        paint[event.name].count++;
        paint[event.name].durationMs += (event.dur || 0) / 1000;
      }
      run.scenarios.push({
        room,
        switchMs,
        ...frames,
        maxLayers,
        paint,
        snapshot: await snapshot(p, cdp),
      });
      console.log(
        `CPU ${rate}x ${room}: ${frames.fps.toFixed(1)} fps, p95 ${frames.p95Ms.toFixed(1)}ms, >50 ${frames.over50}`,
      );
    }
    for (const panel of travelOnly ? [] : ["recipes", "manage"]) {
      await p
        .locator(`[data-act=panel][data-arg=${panel}]`)
        .filter({ visible: true })
        .first()
        .click();
      await ready(p);
      const frames = await measure(p, "panel", duration);
      run.scenarios.push({
        panel,
        ...frames,
        snapshot: await snapshot(p, cdp),
      });
      console.log(
        `CPU ${rate}x panel ${panel}: ${frames.fps.toFixed(1)} fps; DOM ${run.scenarios.at(-1).snapshot.nodes}`,
      );
      if (panel === "recipes")
        run.recipeScroll = {
          ...(await measure(p, "recipe-scroll", duration)),
          snapshot: await snapshot(p, cdp),
        };
      await p.locator(".close-sheet").click();
    }
    await restart(p);
    await p.locator(".scene-pagination [data-arg=guests3]").click();
    await ready(p);
    const stopCameraTrace = await traceStart(cdp, "camera", rate);
    run.camera = {
      ...(await measure(p, "camera", Math.max(10000, duration))),
      snapshot: await snapshot(p, cdp),
    };
    await stopCameraTrace();
    console.log(
      `CPU ${rate}x camera: ${run.camera.fps.toFixed(1)} fps, p95 ${run.camera.p95Ms.toFixed(1)}ms, >50 ${run.camera.over50}`,
    );
    if (process.env.GDV_EXTRA_SCENARIOS === "1") {
      await restart(p);
      await p.locator(".scene-pagination [data-arg=guests0]").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#stage").dataset.visibleRooms === "guests0",
      );
      await p.locator("[data-act=customer][data-arg=c0]").first().click();
      await ready(p);
      run.order = {
        ...(await measure(p, "panel", duration)),
        snapshot: await snapshot(p, cdp),
      };
      const dragFixture = fixture(true);
      await fs.writeFile(
        path.join(output, `drag-fixture-${rate}x.json`),
        JSON.stringify({ seed, state: dragFixture }, null, 2),
      );
      await p.addInitScript(
        (s) =>
          localStorage.setItem(
            "debug-udon-nang-v1",
            JSON.stringify({ state: s }),
          ),
        dragFixture,
      );
      await restart(p);
      await p.locator(".scene-pagination [data-arg=kitchen]").click();
      await p.waitForFunction(
        () =>
          document.querySelector("#stage").dataset.visibleRooms === "kitchen",
      );
      await ready(p);
      const rect = await p.locator('[data-drag="dish:dish901"]').boundingBox(),
        stage = await p.locator("#stage").boundingBox();
      await p.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
      await p.mouse.down();
      const stopDragTrace = await traceStart(cdp, "drag", rate);
      const measuring = measure(p, "drag", 10000);
      await p.mouse.move(stage.x + 2, rect.y + rect.height / 2, { steps: 8 });
      await p.waitForFunction(
        () =>
          Number(document.querySelector("#stage").dataset.cameraOffset) <= 1.1,
      );
      await p.mouse.move(stage.x + stage.width / 2, rect.y + rect.height / 2);
      const target = await p.locator('[data-drop="customer:c0"]').boundingBox();
      await p.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2,
        { steps: 8 },
      );
      await p.mouse.up();
      run.drag = { ...(await measuring), snapshot: await snapshot(p, cdp) };
      await stopDragTrace();
      run.drag.served = await p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem("debug-udon-nang-v1")).state;
        return (
          !s.tray.length &&
          s.customers.find((c) => c.id === "c0")?.status === "eating"
        );
      });
      if (!run.drag.served)
        throw new Error("Measured real dish drag failed to serve");
      console.log(
        `CPU ${rate}x drag: ${run.drag.fps.toFixed(1)} fps, p95 ${run.drag.p95Ms.toFixed(1)}ms, >50 ${run.drag.over50}`,
      );
    }
    if (rate === 4 && leakDuration) {
      const samples = [];
      for (let elapsed = 0; elapsed < leakDuration; elapsed += 10000) {
        await measure(p, "camera", Math.min(10000, leakDuration - elapsed));
        await cdp.send("HeapProfiler.collectGarbage");
        samples.push({
          elapsedMs: Math.min(elapsed + 10000, leakDuration),
          ...(await snapshot(p, cdp)),
        });
        if (
          captureHeap &&
          (elapsed === 20000 || elapsed + 10000 >= leakDuration)
        ) {
          const at = Math.min(elapsed + 10000, leakDuration);
          await heapSnapshot(cdp, `camera-${rate}x-${at}ms`);
          console.log(`Heap snapshot at ${at}ms`);
        }
      }
      run.leak = { durationMs: leakDuration, samples };
    }
    run.errors = errors;
    results.push(run);
    await fs.writeFile(
      path.join(output, "metrics.json"),
      JSON.stringify(
        {
          method:
            "isolated Vite production build; channel=" +
            (browserChannel || "headless-shell") +
            "; CPU/DPR/network emulation on desktop, not a physical phone; compare only matching channels/GPU",
          fixture:
            "eight real engine customers/four pages/four employees/cat/flowers initially; live game continues during measurement",
          frameSampler:
            "RAF frame timing; animation inventory sampled every 250ms to avoid forced style flush after every game frame",
          travelOnly,
          environment: {
            sourceRoot: process.env.GDV_SOURCE_ROOT || process.cwd(),
            sourceHashes,
            platform: process.platform,
            release: os.release(),
            cpu: os.cpus()[0]?.model,
            logicalCpus: os.cpus().length,
            node: process.version,
            head: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
            captureCPU,
            captureTrace,
            captureInvalidation,
          },
          date: new Date().toISOString(),
          durationMs: duration,
          results,
        },
        null,
        2,
      ),
    );
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
