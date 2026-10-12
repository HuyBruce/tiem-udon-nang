import fs from "node:fs/promises";
import sharp from "sharp";
import bank from "../../data/audio-events.json" with { type: "json" };
const directory = "review/gdw/step2/spectra";
const entries = Object.entries(bank.events).flatMap(([id, e]) =>
  e.variants.map((v, i) => ({
    id,
    index: i,
    file: `${id}-${i}.png`,
    label: `${id} / ${i} (${v.file})`,
  })),
);
const sheets = [];
for (let start = 0; start < entries.length; start += 12) {
  const items = entries.slice(start, start + 12);
  const layers = [];
  for (let i = 0; i < items.length; i++) {
    const left = (i % 3) * 320,
      top = Math.floor(i / 3) * 146;
    const svg = Buffer.from(
      `<svg width="320" height="26"><rect width="320" height="26" fill="#fff"/><text x="5" y="18" font-family="sans-serif" font-size="13">${items[i].label}</text></svg>`,
    );
    layers.push(
      { input: svg, left, top },
      {
        input: await fs.readFile(`${directory}/${items[i].file}`),
        left,
        top: top + 26,
      },
    );
  }
  const name = `atlas-${String(sheets.length + 1).padStart(2, "0")}.png`;
  await sharp({
    create: { width: 960, height: 584, channels: 3, background: "#eeeeee" },
  })
    .composite(layers)
    .png()
    .toFile(`${directory}/${name}`);
  sheets.push({ file: name, entries: items });
}
await fs.writeFile(
  `${directory}/atlas-index.json`,
  JSON.stringify(sheets, null, 2) + "\n",
);
console.log(
  "Review atlas:",
  sheets.length,
  "sheets;",
  entries.length,
  "spectra.",
);
