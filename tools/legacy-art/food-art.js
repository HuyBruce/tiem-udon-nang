let serial = 0;
const ink = "#72543b";
export function ingredientArt(id, x = 0, y = 0) {
  const start = `<g transform="translate(${x} ${y})" stroke="${ink}" stroke-width="1.2" stroke-linejoin="round">`;
  const shapes = {
    egg: '<ellipse cy="3" rx="17" ry="12" fill="#a77944" opacity=".25" stroke="none"/><ellipse rx="17" ry="12" fill="#fff5d9"/><ellipse cy="-1" rx="9" ry="8" fill="#e9ad34" stroke="#c38c32"/><path d="M-6-5q6-4 11 0" stroke="#ffda68" stroke-width="3" fill="none"/><ellipse cx="-4" cy="-5" rx="2" ry="1" fill="#fff0a9" stroke="none"/>',
    beef: '<path d="M-20 5q4-18 19-13 10-7 20 7l-6 14q-13-7-29 2Z" fill="#a46a4e"/><path d="M-17 1q8-9 19-2t12 2M-15 7q8-7 17-2t11 3" stroke="#d99e78" fill="none" stroke-width="3"/><path d="M-10-4q7 1 11 7m2-7 6 7" stroke="#f1caa0" fill="none" stroke-width="1.3"/>',
    tofu: '<path d="m-17-9 28-6 8 22-32 8Z" fill="#b17a36"/><path d="m-17-9 27-6 6 18-29 8Z" fill="#e2b467"/><path d="m-12-6 20-5M-9-1l18-5" stroke="#f7d48c" fill="none" stroke-width="2"/><g fill="#b98644" stroke="none"><circle cx="-8" cy="2" r="1.2"/><circle cx="4" cy="-5" r="1"/><circle cx="9" cy="2" r="1.4"/><circle cx="-5" cy="-7" r="1"/></g>',
    seaweed:
      '<path d="m-13 12 3-32 25 3-2 32Z" fill="#394f3c"/><path d="m-7 8 2-23m6 26 2-27m6 26 2-23" stroke="#6b7a4d" opacity=".7"/><path d="m-11-9 24 4m-25 6 23 4" stroke="#819161" opacity=".4"/>',
    onion:
      '<g fill="#c3d191" stroke="#66814a" stroke-width="2"><ellipse cx="-8" cy="-3" rx="5" ry="3" transform="rotate(-25)"/><ellipse cx="7" cy="0" rx="5" ry="3"/><ellipse cx="-2" cy="6" rx="5" ry="3"/><ellipse cx="13" cy="7" rx="4" ry="3"/></g><path d="M-12 7-5 3M3-7l10-2" stroke="#94b265" stroke-width="3"/>',
    tempura:
      '<path d="m-21 11q4-20 31-21l7 7q-12 4-22 21Z" fill="#d79b36"/><path d="m-18 8q5-15 28-16l3 4q-13 4-22 17Z" fill="#f1c66c"/><path d="m11-10 13-12-1 14 7 3-16 4" fill="#cf7950"/><g fill="#ffde8c" stroke="#c89742" stroke-width=".5"><circle cx="-13" cy="6" r="3"/><circle cx="-7" cy="-1" r="3"/><circle cx="1" cy="-4" r="3"/><circle cx="5" cy="1" r="3"/><circle cx="-6" cy="7" r="3"/></g>',
  };
  return (
    start + (shapes[id] || '<ellipse rx="15" ry="10" fill="#d5bd85"/>') + "</g>"
  );
}
export function bowl(dish = {}, color = "#b76f51", small = false) {
  const key = "food" + serial++,
    soup = dish.broth?.includes("curry")
      ? "#b58234"
      : dish.broth?.includes("miso")
        ? "#a77c43"
        : "#c79950";
  const empty = dish.empty,
    noodles = !empty;
  return `<svg viewBox="0 0 160 110" class="bowl-art" aria-hidden="true"><defs><linearGradient id="${key}ceramic" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="${color}"/><stop offset=".4" stop-color="${color}"/><stop offset="1" stop-color="#76503b"/></linearGradient><radialGradient id="${key}soup" cx=".35" cy=".25" r=".85"><stop stop-color="#eac881"/><stop offset=".6" stop-color="${soup}"/><stop offset="1" stop-color="#8a6234"/></radialGradient></defs><ellipse cx="80" cy="99" rx="56" ry="7" fill="#60462d" opacity=".15"/><g stroke="${ink}" stroke-width="1.7" stroke-linejoin="round"><path d="M58 86v12q22 9 44 0V86" fill="${color}"/><path d="M16 44q5 48 64 50 58-2 64-50Z" fill="url(#${key}ceramic)"/><path d="M27 60q51 28 106 1m-101 6q46 27 96 0" fill="none" stroke="#e6c59a" stroke-width="1.5"/><path d="M35 76q7 4 13 5m12 4 11 2m13 0 13-2m10-4 13-5" stroke="#f8e0b5" opacity=".65"/><ellipse cx="80" cy="44" rx="64" ry="27" fill="#f1e2c0"/><ellipse cx="80" cy="44" rx="56" ry="21" fill="${dish.poured && !empty ? `url(#${key}soup)` : "#e2cca1"}" stroke="#b49360" stroke-width="1.1"/>${noodles ? `<g fill="none" stroke-linecap="round"><path d="M34 44q8-22 17-3t17 0 17 0 17 0 17 0M39 52q9-20 17-3t17 0 17 0 17 0M48 58q7-16 15-3t16 0 16 0" stroke="#ae884d" stroke-width="7" opacity=".6"/><path d="M34 42q8-22 17-3t17 0 17 0 17 0M39 50q9-20 17-3t17 0 17 0 17 0M48 56q7-16 15-3t16 0 16 0" stroke="#ffe9b4" stroke-width="${dish.noodleTier === "handmade" ? 6.5 : 5.5}"/><path d="M35 40q7-13 12-4m17 3q6-13 11-5m20 5q6-12 10-5M48 49q5-8 9-2m23 2 6-6" stroke="#fff7d8" stroke-width="1.3"/></g>` : '<path d="M40 50q27 18 60 3" stroke="#b18b53" opacity=".5" fill="none"/>'}${dish.poured && !empty ? `<g fill="#fce3a0" opacity=".75" stroke="none">${[0, 1, 2, 3, 4, 5].map((_, i) => `<ellipse cx="${31 + i * 18}" cy="${40 + (i % 3) * 8}" rx="2.2" ry=".8"/>`).join("")}</g>` : ""}${(dish.tops || []).map((t, i) => ingredientArt(t, [49, 100, 73, 43, 117, 80][i % 6], [34, 40, 51, 54, 53, 29][i % 6])).join("")}<path d="M24 38q8-13 27-15" fill="none" stroke="#fff7df" stroke-width="2.5" stroke-linecap="round"/></g>${small || empty || dish.temperature === "cold" ? "" : `<g class="steam" fill="none" stroke="#fff7e3" stroke-width="2.6" stroke-linecap="round" opacity=".8"><path d="M58 16q-7-7 0-14m22 14q-7-7 0-14m22 14q-7-7 0-14"/></g>`}</svg>`;
}
