import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const output = process.env.GDW_GATES || "test-results/gdw-regression";
await fs.mkdir(output, { recursive: true });
const baseline = JSON.parse(
  await fs.readFile("review/gdx/gates/regression.json", "utf8"),
);
const groups = baseline.groups.filter((g) => g.name !== "unit");
groups.unshift({
  name: "unit",
  args: [
    "--test",
    ...(await fs.readdir("tests"))
      .filter((x) => x.endsWith(".test.js"))
      .map((x) => "tests/" + x),
  ],
});
for (const name of ["clock", "drinks", "washing", "tray", "foundation"])
  groups.push({ name: "gdw-" + name, args: [`tests/gdw-${name}-ui.mjs`] });
groups.push({ name: "ios-fullscreen", args: ["tests/ios-fullscreen-ui.mjs"] });
groups.push({ name: "gdw-audio", args: ["tests/gdw-audio-ui.mjs"] });
groups.push({
  name: "gdw-audio-gestures",
  args: ["tests/gdw-audio-gestures.mjs"],
});
const results = [];
let index = 0;
const env = {
  ...process.env,
  STAGE2_SCREENSHOTS: `${output}/stage2`,
  STAGE3_SCREENSHOTS: `${output}/stage3`,
  STAGE4_SCREENSHOTS: `${output}/motion`,
  STAGE4B_SCREENSHOTS: `${output}/camera`,
  CANVAS_OUTPUT: `${output}/canvas`,
  GDX_OUTPUT: `${output}/shop`,
  USABILITY_OUTPUT: `${output}/usability`,
  IOS_SCREENSHOTS: `${output}/ios`,
  GDW_OUTPUT: `${output}/foundation`,
  GDW_CLOCK_OUTPUT: `${output}/clock`,
  GDW_AUDIO_SHOTS: process.env.GDW_AUDIO_SHOTS || `${output}/audio-ui`,
  GDW_AUDIO_QA: process.env.GDW_AUDIO_QA || `${output}/audio-signals.json`,
  GDW_AUDIO_GESTURES:
    process.env.GDW_AUDIO_GESTURES || `${output}/audio-gestures.json`,
  GDW_DRINK_OUTPUT: `${output}/drinks`,
  GDW_WASH_OUTPUT: `${output}/washing`,
  GDW_TRAY_OUTPUT: `${output}/tray`,
};
async function worker() {
  while (index < groups.length) {
    const g = groups[index++],
      start = Date.now(),
      p = spawn(process.execPath, g.args, { env });
    let log = "";
    p.stdout.on("data", (d) => (log += d));
    p.stderr.on("data", (d) => (log += d));
    const status = await new Promise((r) => p.on("close", r));
    await fs.writeFile(`${output}/${g.name}.txt`, log);
    results.push({
      name: g.name,
      args: g.args,
      status,
      milliseconds: Date.now() - start,
    });
    await fs.writeFile(
      `${output}/results.json`,
      JSON.stringify(results, null, 2) + "\n",
    );
    console.log(g.name, status);
    if (status !== 0) {
      console.log(log.slice(-2000));
      process.exitCode = 1;
    }
  }
}
await Promise.all([worker(), worker()]);
