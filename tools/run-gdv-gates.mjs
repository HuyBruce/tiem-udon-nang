import fs from "node:fs";
import { spawnSync } from "node:child_process";
const output = process.env.GDV_GATE_OUTPUT || "review/gdv/step3/gates";
fs.mkdirSync(output, { recursive: true });
const env = {
  ...process.env,
  STAGE1_SCREENSHOTS: "test-results/gdv-stage1",
  STAGE2_SCREENSHOTS: "test-results/gdv-stage2",
  STAGE3_SCREENSHOTS: "test-results/gdv-stage3",
  STAGE4_SCREENSHOTS: "test-results/gdv-stage4a",
  STAGE4B_SCREENSHOTS: "test-results/gdv-stage4b",
  GDV_OUTPUT: process.env.GDV_OUTPUT || "review/gdv/step3/final",
  GDV_BEFORE: process.env.GDV_BEFORE || "review/gdv/step2/final",
};
const gates = [
  ["unit", ["--test", "tests/*.test.js"]],
  ...[
    "stage1-cleanup-ui",
    "gdv-recipes-ui",
    "usability-ui",
    "stage2-direct-ui",
    "stage3-guests-ui",
    "stage4-motion-ui",
    "stage4-camera-ui",
    "browser",
    "layout",
    "extended-ui",
    "management",
  ].map((n) => [n, [`tests/${n}.mjs`]]),
  ["taps", ["tools/audit-mobile-taps.mjs"]],
  ["v3", ["tools/run-v3-checks.mjs"]],
  ["build", ["node_modules/vite/bin/vite.js", "build"]],
  ["pwa", ["scripts/build-sw.mjs"]],
  ["offline", ["tests/offline.mjs"]],
  ["canvas-offline", ["tests/offline.mjs"], { GDV_RENDERER: "canvas" }],
  ["v3-offline", ["tools/run-v3-checks.mjs", "--offline"]],
  ["screenshots", ["tests/gdv-ui.mjs"]],
  ["canvas-ui", ["tests/gdv-canvas-ui.mjs"]],
  [
    "canvas-camera",
    ["tests/stage4-camera-ui.mjs"],
    {
      GDV_RENDERER: "canvas",
      GDV_BROWSER_CHANNEL: "chromium",
      STAGE4B_SCREENSHOTS: "test-results/gdv-canvas-camera",
    },
  ],
];
const selected = process.env.GDV_GATES?.split(",");
let results = [];
try {
  results = JSON.parse(fs.readFileSync(`${output}/results.json`, "utf8"));
} catch {}
for (const [name, args, overrides] of gates) {
  if (selected && !selected.includes(name)) continue;
  console.log(`GATE ${name} running`);
  const log = `${output}/${name}.log`,
    fd = fs.openSync(log, "w");
  const run = spawnSync(process.execPath, args, {
    env: { ...env, ...overrides },
    stdio: ["ignore", fd, fd],
    timeout: 600000,
  });
  fs.closeSync(fd);
  const result = {
    name,
    args,
    status: run.status,
    error: run.error?.message,
    date: new Date().toISOString(),
    log,
  };
  results = results.filter((r) => r.name !== name);
  results.push(result);
  fs.writeFileSync(`${output}/results.json`, JSON.stringify(results, null, 2));
  console.log(`GATE ${name}: ${run.status === 0 ? "PASS" : "FAIL"}`);
  if (run.status !== 0) {
    console.log(fs.readFileSync(log, "utf8").split("\n").slice(-55).join("\n"));
    process.exitCode = 1;
  }
}
