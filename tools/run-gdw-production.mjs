import fs from "node:fs/promises";
import { spawn } from "node:child_process";
const output = process.env.GDW_PRODUCTION || "test-results/gdw-production";
await fs.mkdir(output, { recursive: true });
const { groups } = JSON.parse(
  await fs.readFile("review/gdx/gates/production.json", "utf8"),
);
groups.push({ name: "audio-offline", args: ["tests/gdw-audio-offline.mjs"] });
const results = [];
for (const group of groups) {
  const env = {
    ...process.env,
    GDW_AUDIO_OFFLINE: `${output}/audio-offline.json`,
    ...(group.name === "canvas-offline" ? { GDV_RENDERER: "canvas" } : {}),
  };
  const child = spawn(process.execPath, group.args, { env });
  let log = "";
  child.stdout.on("data", (d) => (log += d));
  child.stderr.on("data", (d) => (log += d));
  const status = await new Promise((resolve) => child.on("close", resolve));
  await fs.writeFile(`${output}/${group.name}.txt`, log);
  results.push({ ...group, status });
  await fs.writeFile(
    `${output}/results.json`,
    JSON.stringify(results, null, 2) + "\n",
  );
  console.log(group.name, status);
  if (status !== 0) {
    console.log(log.slice(-3000));
    process.exitCode = 1;
    break;
  }
}
