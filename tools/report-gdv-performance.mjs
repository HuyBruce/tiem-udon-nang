import fs from "node:fs/promises";
const output = process.env.GDV_REPORT_OUTPUT || "review/gdv/step3";
await fs.mkdir(output, { recursive: true });
const before = JSON.parse(
  await fs.readFile(
    process.env.GDV_METRICS_BEFORE || "review/gdv/step3/before/metrics.json",
    "utf8",
  ),
);
const after = JSON.parse(
  await fs.readFile(
    process.env.GDV_METRICS_AFTER || "review/gdv/step3/after/metrics.json",
    "utf8",
  ),
);
const rows = [];
for (const run of after.results) {
  const old = before.results.find((r) => r.rate === run.rate);
  for (const sample of [
    ...run.scenarios,
    { name: "camera", ...run.camera },
    ...(run.drag ? [{ name: "drag", ...run.drag }] : []),
    ...(run.recipeScroll
      ? [{ name: "recipe-scroll", ...run.recipeScroll }]
      : []),
    ...(run.order ? [{ name: "order", ...run.order }] : []),
  ]) {
    const name = sample.name || sample.room || sample.panel;
    const prior =
      name === "camera"
        ? old?.camera
        : name === "drag"
          ? old?.drag
          : name === "recipe-scroll"
            ? old?.recipeScroll
            : name === "order"
              ? old?.order
              : old?.scenarios.find((s) => (s.room || s.panel) === name);
    rows.push({
      rate: run.rate,
      name,
      beforeFps: prior?.fps,
      beforeP95: prior?.p95Ms,
      fps: sample.fps,
      p95Ms: sample.p95Ms,
      over33: sample.over33,
      over50: sample.over50,
      longTasks: sample.longTasks.length,
      dom: sample.snapshot?.nodes,
      roomNodes: sample.snapshot?.rooms,
      heapMiB: sample.snapshot?.heapUsed / 1048576,
      maxLayers: sample.maxLayers,
      paint: sample.paint,
      imagesBytes: sample.snapshot?.images.reduce(
        (n, i) => n + i.compressedBytes,
        0,
      ),
    });
  }
}
const failures = rows.filter(
  (r) =>
    r.rate === 4 &&
    (r.fps < 55 ||
      r.p95Ms > 20 ||
      (["camera", "drag"].includes(r.name) && r.over50 > 0)),
);
const leak = after.results.find((r) => r.rate === 4)?.leak;
const warmedHeap = leak?.samples.find((s) => s.elapsedMs >= 30000)?.heapUsed;
const heapStable = Boolean(
  warmedHeap && leak.samples.at(-1).heapUsed <= warmedHeap * 1.02,
);
const report = {
  method: after.method,
  target: "4x: FPS>=55, p95<=20ms; camera/drag zero frames>50ms",
  passed: failures.length === 0 && heapStable,
  frameTargetPassed: failures.length === 0,
  heapObservedStable: heapStable,
  failures,
  rows,
  leak: leak
    ? {
        durationMs: leak.durationMs,
        samples: leak.samples.map((s) => ({
          elapsedMs: s.elapsedMs,
          heapMiB: s.heapUsed / 1048576,
          nodes: s.nodes,
          cdpNodes: s.cdpNodes,
          customers: s.liveCustomers,
          resourceEntries: s.images.length,
        })),
        heapGrowthBytes:
          leak.samples.at(-1).heapUsed - leak.samples[0].heapUsed,
        heapAfterWarmupGrowthFraction:
          leak.samples.at(-1).heapUsed / warmedHeap - 1,
        heapGateMethod:
          "30s warmup; final post-GC heap <= warmup heap +2% measurement allowance; not a proof of zero leaks",
        continuouslyGrowing: leak.samples.every(
          (s, i) => !i || s.heapUsed > leak.samples[i - 1].heapUsed,
        ),
        conclusion:
          "Read the raw trend together with DOM and resource timing buffers. No general zero-leak claim from this two-minute run.",
      }
    : null,
};
await fs.writeFile(
  `${output}/performance-summary.json`,
  JSON.stringify(report, null, 2),
);
const table = [
  "| CPU | State | FPS before → after | p95 before → after (ms) | >33 / >50 | Long tasks | DOM | Heap MiB |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...rows.map(
    (r) =>
      `| ${r.rate}x | ${r.name} | ${r.beforeFps?.toFixed(1) || "—"} → ${r.fps.toFixed(1)} | ${r.beforeP95?.toFixed(1) || "—"} → ${r.p95Ms.toFixed(1)} | ${r.over33} / ${r.over50} | ${r.longTasks} | ${r.dom} | ${r.heapMiB.toFixed(2)} |`,
  ),
];
const arrow = (prior, current, format = (n) => n.toFixed(1)) =>
  `${prior === undefined ? "—" : format(prior)} → ${current === undefined ? "—" : format(current)}`;
const rooms = after.results.flatMap((run) =>
  run.scenarios
    .filter((s) => s.room)
    .map((sample) => ({
      rate: run.rate,
      sample,
      prior: before.results
        .find((r) => r.rate === run.rate)
        ?.scenarios.find((s) => s.room === sample.room),
    })),
);
const imageBytes = (s) =>
  s?.snapshot?.images.reduce((n, i) => n + i.compressedBytes, 0);
const trace = (s, name) =>
  s?.paint?.[name]
    ? `${s.paint[name].count} / ${s.paint[name].durationMs.toFixed(1)}`
    : "—";
table.push(
  "",
  "## Loading, image bytes and room DOM (before → after)",
  "",
  "Image bytes are cumulative resource entries since reload, including cached/repeated loads. Switch includes camera snap and ready/decode waits.",
  "",
  "| CPU | Room | Visible room nodes | Image MiB | Switch ms |",
  "| --- | --- | --- | ---: | ---: |",
  ...rooms.map(
    ({ rate, sample, prior }) =>
      `| ${rate}x | ${sample.room} | ${prior?.snapshot.rooms.map((r) => `${r.id}:${r.nodes}`).join(", ") || "—"} → ${sample.snapshot.rooms.map((r) => `${r.id}:${r.nodes}`).join(", ")} | ${arrow(imageBytes(prior), imageBytes(sample), (n) => (n / 1048576).toFixed(2))} | ${arrow(prior?.switchMs, sample.switchMs)} |`,
  ),
  "",
  "## Trace during each independent room burst (5s)",
  "",
  "Counts and CPU event durations (ms) from DevTools tracing; not GPU time. Camera/drag/panel trace was not collected separately; their frame/DOM/heap data appears above.",
  "Layer count 0 means no nonempty LayerTree snapshot observed by this harness, not zero browser/GPU layers.",
  "",
  "| CPU | Room | Maximum layers before → after | Paint count / ms before → after | Layerize count / ms before → after |",
  "| --- | --- | ---: | --- | --- |",
  ...rooms.map(
    ({ rate, sample, prior }) =>
      `| ${rate}x | ${sample.room} | ${arrow(prior?.maxLayers, sample.maxLayers, String)} | ${trace(prior, "Paint")} → ${trace(sample, "Paint")} | ${trace(prior, "Layerize")} → ${trace(sample, "Layerize")} |`,
  ),
  "",
  "## Startup on slow 4G (before → after)",
  "",
  "| CPU | Landing ready ms | Play ready ms (from initial navigation) |",
  "| --- | ---: | ---: |",
  ...after.results.map((run) => {
    const prior = before.results.find((r) => r.rate === run.rate);
    return `| ${run.rate}x | ${arrow(prior?.landingReadyMs, run.landingReadyMs)} | ${arrow(prior?.playReadyMs, run.playReadyMs)} |`;
  }),
);
await fs.writeFile(`${output}/PERFORMANCE_TABLE.md`, table.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      passed: report.passed,
      failures: failures.map((r) => r.name),
      leak: report.leak,
    },
    null,
    2,
  ),
);
if (process.argv.includes("--assert-target") && !report.passed)
  process.exitCode = 1;
