import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import registry from "../../data/audio-sources.json" with { type: "json" };
const directory = path.resolve("test-results/audio-sources");
await fs.mkdir(directory, { recursive: true });
const household = registry.sources.find((s) => s.id === "household");
for (const [name, file] of Object.entries(household.files)) {
  const dest = path.join(directory, name + ".wav");
  const r = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      household.downloadBase + file,
      "-t",
      "6",
      "-ar",
      "22050",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      dest,
    ],
    { encoding: "utf8" },
  );
  if (r.status !== 0) throw Error(r.stderr || "ffmpeg unavailable");
  console.log("Fetched excerpt", name);
}
const kenney = registry.sources.find((s) => s.id === "kenney");
const response = await fetch(kenney.download);
if (!response.ok) throw Error("Source download HTTP " + response.status);
const archive = path.join(directory, "kenney.zip");
await fs.writeFile(archive, Buffer.from(await response.arrayBuffer()));
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const r = spawnSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(path.join(directory, "kenney"))} -Force`,
  ],
  { encoding: "utf8" },
);
if (r.status !== 0) throw Error(r.stderr);
console.log("Fetched Kenney; license included in source archive.");
