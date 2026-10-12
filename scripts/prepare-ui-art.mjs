import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Source geometry for small UI assets. Runtime loads the generated files.
const paths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
  gear: '<path d="m9 3 1-2h4l1 2 3 2 2 1 2 4-2 2v3l-1 2-3 3-3-1-3 1-3-2-2-3 1-3-1-3 2-3Z"/><circle cx="12" cy="11" r="3"/>',
  book: '<path d="M3 4q5-2 9 1 4-3 9-1v16q-5-2-9 1-4-3-9-1ZM12 5v16M6 8h3m6 0h3M6 12h3m6 0h3"/>',
  leaf: '<path d="M19 3Q2 1 4 15q3 9 11 3 5-5 4-15ZM5 19 16 7M10 13h5M11 12V7"/>',
  bowl: '<path d="M3 11h18q-1 9-9 9t-9-9ZM8 23h8M8 7q-3-2 0-5m5 5q-3-2 0-5m5 5q-3-2 0-5"/>',
  star: '<path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1Z"/>',
  bag: '<path d="M4 7h16l1 15H3ZM8 8V5a4 4 0 0 1 8 0v3"/>',
  heart: '<path d="M12 21S1 14 2 7s8-6 10-1c2-5 10-6 10 1s-10 14-10 14Z"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  rain: '<path d="M5 14a4 4 0 0 1 0-8 6 6 0 0 1 11-2 5 5 0 1 1 2 10ZM6 18l-1 3m7-3-1 3m7-3-1 3"/>',
  snow: '<path d="M12 1v22M2 6l20 12M2 18 22 6M8 3l4 3 4-3M8 21l4-3 4 3"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  music:
    '<path d="M9 18V5l11-3v14M9 8l11-3"/><ellipse cx="6" cy="19" rx="3" ry="2"/><ellipse cx="17" cy="17" rx="3" ry="2"/>',
  people:
    '<circle cx="9" cy="7" r="4"/><path d="M1 22v-4q0-6 8-6t8 6v4m0-19q7-1 6 5-1 3-4 3m1 3q4 1 4 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l4 3"/>',
};

const output = join(process.cwd(), "assets", "ui");
await mkdir(output, { recursive: true });
await Promise.all(
  Object.entries(paths).map(([name, path]) =>
    writeFile(
      join(output, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>\n`,
    ),
  ),
);
const ticks = Array.from(
  { length: 12 },
  (_, i) =>
    `<path d="M24 5v3" transform="rotate(${i * 30} 24 24)" stroke="#916e53"/>`,
).join("");
await writeFile(
  join(output, "clock-face.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#fff7df" stroke="#916e53" stroke-width="2"/>${ticks}</svg>\n`,
);
console.log(`Prepared ${Object.keys(paths).length + 1} UI vector assets.`);
