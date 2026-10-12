import { spawnSync } from "node:child_process";
const offline = process.argv.includes("--offline");
const tests = offline
  ? [
      "offline",
      "v3-opening-pets-ui",
      "v3-completion-ui",
      "v3-season-progress-ui",
      "v3-navigation-cooking-ui",
    ]
  : [
      "v3-opening-pets-ui",
      "v3-completion-ui",
      "v3-season-progress-ui",
      "v3-navigation-cooking-ui",
      "audio-ui",
      "v3-catalog-ui",
      "v3-ingredient-ui",
      "v3-customer-journal-ui",
      "v3-sides-ui",
      "v3-combo-ui",
      "v3-drink-temperature-ui",
      "v3-drink-toppings-ui",
      "busy-layout",
    ];
for (const test of tests) {
  console.log(`\n[V3] ${test}${offline ? " (production/offline)" : ""}`);
  const result = spawnSync(process.execPath, [`tests/${test}.mjs`], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...(offline
        ? {
            UDON_TEST_BASE_URL: "http://localhost:4173",
            UDON_TEST_OFFLINE: "1",
          }
        : {}),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
