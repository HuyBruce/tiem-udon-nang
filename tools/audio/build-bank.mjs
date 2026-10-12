import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import words from "../../data/audio-strings.vi.json" with { type: "json" };
const rate = 22050,
  out = "assets/audio/generated",
  raw = "test-results/audio-raw";
await fs.mkdir(out, { recursive: true });
await fs.mkdir(raw, { recursive: true });
await fs.mkdir("review/gdw/step2/spectra", { recursive: true });
const rows = [
  ["ingredient", "tap"],
  ["ingredientDrop", "water", "kitchensink"],
  ["water", "water", "kitchensink"],
  ["boil", "water", "boil", true],
  ["bubble", "water", "boil"],
  ["noodles", "water", "kitchensink"],
  ["ping", "chime"],
  ["lift", "water", "kitchensink"],
  ["chop", "wood", "chopping"],
  ["batter", "water", "kitchensink"],
  ["fry", "noise", "fryingpan", true],
  ["crisp", "wood", "chopping"],
  ["broth", "water", "kitchensink"],
  ["topping", "ceramic", "glass"],
  ["wood", "wood", "chopping"],
  ["bowl", "ceramic", "glass"],
  ["tray", "paper", "paper"],
  ["wash", "water", "kitchensink", true],
  ["rack", "ceramic", "glass"],
  ["pour", "water", "kitchensink"],
  ["whisk", "paper", "paper", true],
  ["ice", "ceramic", "glass"],
  ["soda", "noise"],
  ["bottle", "ceramic", "glass"],
  ["milk", "water", "kitchensink"],
  ["cup", "ceramic", "glass"],
  ["fridge", "wood", "chopping"],
  ["bell", "chime"],
  ["guestEnter", "paper", "paper"],
  ["order", "paper", "paper"],
  ["serve", "ceramic", "glass"],
  ["slurp", "water"],
  ["chew", "wood"],
  ["ahh", "breath"],
  ["chopsticks", "wood", "chopping"],
  ["coin", "chime"],
  ["tip", "chime"],
  ["happy", "chime"],
  ["sad", "chime"],
  ["angry", "wood"],
  ["pet", "voice"],
  ["click", "tap", "kenney"],
  ["panelOpen", "paper", "paper"],
  ["panelClose", "paper", "paper"],
  ["swipe", "breath"],
  ["buy", "chime"],
  ["upgrade", "chime"],
  ["unlock", "chime"],
  ["error", "wood"],
  ["review", "chime"],
  ["reply", "paper", "paper"],
  ["discover", "chime"],
  ["nextDay", "chime"],
  ["room", "noise", null, true, "ambient"],
  ["birds", "bird", null, true, "ambient"],
  ["rainLight", "noise", null, true, "ambient"],
  ["rain", "noise", null, true, "ambient"],
  ["rainHeavy", "noise", null, true, "ambient"],
  ["snow", "breath", null, true, "ambient"],
  ["night", "bird", null, true, "ambient"],
  ["festival", "chime", null, true, "ambient"],
  ["morning", "music", null, true, "music"],
  ["noon", "music", null, true, "music"],
  ["evening", "music", null, true, "music"],
];
function cmd(args) {
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "info", ...args],
    { encoding: "utf8", maxBuffer: 4e6 },
  );
  if (r.status !== 0) throw Error(r.stderr);
  return r.stderr;
}
function wav(data) {
  const b = Buffer.alloc(44 + data.length * 2);
  b.write("RIFF");
  b.writeUInt32LE(b.length - 8, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(data.length * 2, 40);
  data.forEach((v, i) =>
    b.writeInt16LE(
      Math.round(Math.max(-0.98, Math.min(0.98, v)) * 32767),
      44 + i * 2,
    ),
  );
  return b;
}
const sources = {};
cmd([
  "-y",
  "-i",
  "test-results/audio-sources/kenney/Audio/click_001.ogg",
  "-ar",
  String(rate),
  "-ac",
  "1",
  "test-results/audio-sources/kenney.wav",
]);
for (const k of [
  "kitchensink",
  "boil",
  "fryingpan",
  "chopping",
  "glass",
  "paper",
  "kenney",
]) {
  const file = "test-results/audio-sources/" + k + ".wav";
  const b = await fs.readFile(file);
  const dataOffset = b.indexOf(Buffer.from("data"));
  const len = b.readUInt32LE(dataOffset + 4);
  sources[k] = Array.from(
    { length: len / 2 },
    (_, i) => b.readInt16LE(dataOffset + 8 + i * 2) / 32768,
  );
}
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
const events = only
  ? JSON.parse(await fs.readFile("data/audio-events.json", "utf8")).events
  : {};
const reports = only
  ? JSON.parse(
      await fs.readFile("review/gdw/step2/audio-metrics.json", "utf8"),
    ).filter((r) => r.id !== only)
  : [];
for (const [id, family, source, loop = false, bus = "sfx"] of rows) {
  if (only && id !== only) continue;
  const count = bus === "music" ? 1 : 3;
  events[id] = {
    label: words.events[id],
    group:
      bus === "music"
        ? words.groups.music
        : bus === "ambient"
          ? words.groups.ambient
          : rows.indexOf(rows.find((r) => r[0] === id)) < 19
            ? words.groups.kitchen
            : rows.indexOf(rows.find((r) => r[0] === id)) < 27
              ? words.groups.drinks
              : rows.indexOf(rows.find((r) => r[0] === id)) < 41
                ? words.groups.guests
                : words.groups.ui,
    bus,
    loop,
    variants: [],
    source:
      source === "kenney"
        ? "Kenney CC0"
        : source
          ? "bretbernhoft CC0"
          : words.originalSource,
    family,
  };
  for (let variant = 0; variant < count; variant++) {
    const duration =
      bus === "music"
        ? 16
        : loop
          ? 2
          : family === "chime"
            ? 0.65
            : family === "water"
              ? 0.5
              : family === "voice"
                ? 0.55
                : family === "tap"
                  ? 0.09
                  : 0.22;
    let seed = 12345 + rows.findIndex((r) => r[0] === id) * 41 + variant * 821;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return (seed / 4294967296) * 2 - 1;
    };
    let smooth = 0;
    const data = Array.from({ length: Math.round(rate * duration) }, (_, i) => {
      const t = i / rate,
        env = loop ? 1 : Math.sin(Math.PI * Math.min(1, t / duration)) ** 0.6;
      smooth = smooth * 0.78 + rand() * 0.22;
      let v = smooth * 0.18;
      if (source && sources[source]) {
        const src = sources[source];
        v =
          src[
            (Math.floor(i * (1 + variant * 0.017)) +
              Math.floor((variant + 0.3) * rate)) %
              src.length
          ];
      }
      if (family === "chime" || family === "ceramic")
        v +=
          Math.sin(
            2 *
              Math.PI *
              (440 + variant * 30) *
              (family === "ceramic" ? 2.1 : 1) *
              t,
          ) *
            Math.exp(-t * 6) *
            0.14 +
          Math.sin(2 * Math.PI * 1321 * t) * Math.exp(-t * 12) * 0.035;
      if (family === "wood" || family === "tap")
        v +=
          Math.sin(2 * Math.PI * (160 + variant * 10) * t) *
          Math.exp(-t * 40) *
          0.25;
      if (family === "voice")
        v =
          Math.sin(
            2 * Math.PI * (430 + variant * 17 + 100 * Math.sin(t * 7)) * t,
          ) *
          (0.5 + 0.5 * Math.sin(t * 23)) *
          0.15;
      if (family === "bird")
        v =
          Math.sin(2 * Math.PI * (1500 + 400 * Math.sin(t * 16)) * t) *
            Math.max(0, Math.sin(t * 7)) ** 12 *
            0.08 +
          smooth * 0.01;
      if (family === "music") {
        const chords = [
            [130.81, 164.81, 196],
            [110, 130.81, 164.81],
            [87.31, 110, 130.81],
            [98, 123.47, 146.83],
          ],
          c = chords[Math.floor(t / 4) % 4],
          phase = t % 1,
          shift = id === "morning" ? 2 : id === "noon" ? 1.5 : 1;
        v =
          c.reduce((a, f) => a + Math.sin(2 * Math.PI * f * t) * 0.013, 0) +
          Math.sin(2 * Math.PI * c[Math.floor(t) % 3] * shift * 2 * phase) *
            Math.exp(-phase * 5) *
            0.04 +
          smooth * 0.003;
      }
      // Loop edges meet at zero with a short gentle envelope, no leading dead air.
      const edge = Math.min(1, t / 0.008, (duration - t) / 0.012);
      return v * env * Math.max(0, edge);
    });
    if (duration < 0.4) {
      const rms = Math.sqrt(data.reduce((a, v) => a + v * v, 0) / data.length),
        gain = 10 ** (-16 / 20) / Math.max(rms, 1e-6);
      for (let i = 0; i < data.length; i++) data[i] *= gain;
    }
    const rawFile = `${raw}/${id}-${variant}.wav`;
    await fs.writeFile(rawFile, wav(data));
    const file = `${id}-${variant}.${bus === "music" ? "m4a" : "wav"}`,
      dest = `${out}/${file}`;
    const target = bus === "music" ? -20 : -16;
    const codec =
      bus === "music" ? ["-c:a", "aac", "-b:a", "64k"] : ["-c:a", "pcm_s16le"];
    cmd([
      "-y",
      "-i",
      rawFile,
      "-af",
      duration < 0.4
        ? "alimiter=limit=0.7:level=false"
        : `loudnorm=I=${target}:TP=-2:LRA=7`,
      "-ar",
      String(rate),
      "-ac",
      "1",
      ...codec,
      dest,
    ]);
    const meter = () =>
      JSON.parse(
        cmd([
          "-i",
          dest,
          "-af",
          `loudnorm=I=${target}:TP=-1:LRA=7:print_format=json`,
          "-f",
          "null",
          "-",
        ]).match(/\{\s*"input_i"[\s\S]*?\}/)[0],
      );
    let loudness = meter();
    // AAC can overshoot after decoding; check the encoded output, not the input.
    for (let pass = 0; Number(loudness.input_tp) > -1 && pass < 3; pass++) {
      const temporary =
        dest + ".limiting-pass." + (bus === "music" ? "m4a" : "wav");
      cmd([
        "-y",
        "-i",
        dest,
        "-af",
        `volume=${-2.5 - Number(loudness.input_tp)}dB`,
        ...codec,
        temporary,
      ]);
      await fs.rename(temporary, dest);
      loudness = meter();
    }
    if (Number(loudness.input_tp) > -1)
      throw Error("Decoded true peak exceeds limit " + file);
    if (bus !== "music")
      await fs.unlink(`${out}/${id}-${variant}.m4a`).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    cmd([
      "-y",
      "-i",
      dest,
      "-lavfi",
      "showspectrumpic=s=320x120:legend=disabled",
      "-frames:v",
      "1",
      `review/gdw/step2/spectra/${id}-${variant}.png`,
    ]);
    const bytes = await fs.readFile(dest);
    events[id].variants.push({
      file,
      duration,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    reports.push({ id, variant, file, targetLUFS: target, ...loudness });
  }
  console.log(id, events[id].variants.length);
}
await fs.writeFile(`${out}/unlock.wav`, wav(Array(rate / 10).fill(0)));
await fs.writeFile(
  "data/audio-events.json",
  JSON.stringify({ version: 1, events }, null, 2) + "\n",
);
await fs.writeFile(
  "review/gdw/step2/audio-metrics.json",
  JSON.stringify(reports, null, 2) + "\n",
);
console.log("Done", Object.keys(events).length, reports.length);
