import { textVi } from "../i18n.js";
import manifest from "../../assets/manifest.json" with { type: "json" };
import world from "../../layouts/world.json" with { type: "json" };
import strings from "../../data/strings.vi.json" with { type: "json" };
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { brothBatchFor } from "../systems/cooking.js";
import { plantAppearance } from "./plant-art.js";
import { DECOR } from "../data.js";
import { sinkContents } from "./washing.js";
import {
  projectY,
  roomBands,
  playHeight,
  projectBox,
  projectLayer,
} from "./room-composition.js";
const files = import.meta.glob(
  [
    "../../assets/**/*.webp",
    "!../../assets/animations/**/*.webp",
    "!../../assets/style_reference/**/*.webp",
    "!../../assets/incoming/**/*.webp",
    "!../../assets/backgrounds/gdv-*-plate.webp",
    "!../../assets/backgrounds/gdv-garden-a.webp",
    "!../../assets/backgrounds/gdv-garden-b.webp",
    "!../../assets/sprites/v3-ingredient-*.webp",
    "!../../assets/sprites/v3-topping-*.webp",
    "!../../assets/sprites/gdv-fg-*.webp",
  ],
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const uiFiles = import.meta.glob("../../assets/ui/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const spriteFiles = import.meta.glob("../../assets/sprites/*.svg", {
  eager: true,
  query: "?url",
  import: "default",
});
const layouts = import.meta.glob("../../layouts/*.json", {
  eager: true,
  import: "default",
});
export const layoutFor = (id) =>
  layouts[`../../layouts/${id.startsWith("guests") ? "guests" : id}.json`];
export const assetUrl = (id) => {
  const path = "../../assets/" + manifest.assets[id]?.file;
  return files[path] || uiFiles[path] || spriteFiles[path];
};
export function sprite(id, label = "", className = "", attributes = "") {
  const src = assetUrl(id);
  const motion =
    id === "kitchen-steam"
      ? 'data-motion-env="steam" data-anim-id="steam-loop-anim"'
      : "";
  const key = attributes.includes("data-motion-key")
    ? ""
    : `data-motion-key="asset:${id}"`;
  return src
    ? `<img class="sprite ${className}" src="${src}" alt="${label}" draggable="false" ${key} ${motion} ${attributes}>`
    : `<span class="asset-pending">${label || id}</span>`;
}
export function layerStyle(l, scene = "") {
  const p = projectLayer(scene, l);
  return `left:${l.x}%;top:${p.y}%;width:${l.width}%;height:${p.height}%;transform:translate(${-l.anchor[0] * 100}%,${-l.anchor[1] * 100}%);z-index:${l.z || 2}`;
}
function background(l, scene) {
  const bands = roomBands(scene, playHeight());
  if (!bands) return sprite(l.background, "", "scene-background");
  const source =
    manifest.assets[l.background]?.composition === "world-baked"
      ? world.visual.bakedBands
      : bands.source;
  if (source.every((value, i) => value === bands.target[i]))
    return sprite(l.background, "", "scene-background");
  const extension =
    bands.extra > 0
      ? `<div class="scene-wall-extension" data-motion-key="wall-extension" style="height:${bands.extra}px">${sprite("gdw-wall-extension", "", "scene-background")}</div>`
      : "";
  return (
    extension +
    source
      .slice(0, -1)
      .map((start, i) => {
        const span = source[i + 1] - start,
          top = bands.target[i],
          height = bands.target[i + 1] - top;
        return `<div class="scene-band" data-motion-key="band:${i}" style="top:${top}%;height:${height}%"><img class="scene-background" src="${assetUrl(l.background)}" alt="" draggable="false" style="height:${10000 / span}%;top:${(-start / span) * 100}%"></div>`;
      })
      .join("")
  );
}
export function sceneImage(scene, s, direct = false) {
  const l = layoutFor(scene);
  let layers = l.layers || [];
  layers = layers.map((item) =>
    item.touch?.labelKey
      ? {
          ...item,
          touch: {
            ...item.touch,
            label:
              labels.pantry[item.touch.labelKey] ||
              labels.garden?.[item.touch.labelKey],
          },
        }
      : item,
  );
  if (scene === "front")
    layers = layers.map((item) =>
      item.id === "owner"
        ? {
            ...item,
            asset:
              s.phase === "open"
                ? "v3-owner-happy"
                : s.phase === "summary" && s.lastSummary?.profit < 0
                  ? "v3-owner-sad"
                  : "v3-owner",
          }
        : item,
    );
  if (scene === "front" && !s.decor.flowers)
    layers = layers.map((item) =>
      item.asset === "flowers" ? { ...item, asset: "planter" } : item,
    );
  if (scene.startsWith("guests") && s.decor.flowers && l.decoration)
    layers = [...layers, l.decoration];
  if (scene === "garden")
    layers = [
      ...layers,
      ...s.plots.map((p, i) => {
        const appearance = plantAppearance(p);
        const slot = l.plots.slots[s.plots.length - 1][i];
        return {
          id: `garden-plot-${i}`,
          asset: "v4-garden-bed",
          cropAsset: appearance.asset,
          className: `garden-plot plant-${appearance.phase}`,
          ...slot,
          anchor: l.plots.anchor,
          z: l.plots.z,
          touch: {
            action: "panel",
            arg: "garden",
            label: p ? textVi("t_b20ef07f3da7") : textVi("t_022127a8dc95"),
          },
        };
      }),
    ];
  const directControls = (item) => {
    if (!direct) return "";
    if (scene === "kitchen") {
      if (item.id === "broth-pot")
        return `data-drop="broth:${s.brothSource}" data-drag="broth:${s.brothSource}"`;
      if (item.id === "fryer")
        return `data-drop="fryer:0" data-drag="${s.fryer[0] ? "fryer:0" : "prepared:tempura"}"`;
      if (item.id === "board") return "data-chop data-direct-chop";
    }
    if (scene === "drinks")
      return (
        {
          sample_kettle: 'data-drag="tool:water"',
          chasen: 'data-drag="tool:whisk"',
        }[item.id] || ""
      );
    return "";
  };
  if (direct && scene === "kitchen")
    layers = layers.map((item) => ({
      ...item,
      touch: item.touch
        ? {
            ...item.touch,
            action: "work-target",
            arg:
              {
                "broth-pot": `broth:${s.brothSource}`,
                fryer: "fryer:0",
                board: "board",
                sink: "sink",
              }[item.id] || item.touch.arg,
          }
        : item.touch,
    }));
  if (direct && scene === "drinks")
    layers = layers
      .filter((item) => item.id !== "matcha-bowl")
      .map((item) => ({
        ...item,
        touch: item.touch
          ? {
              ...item.touch,
              action: ["sample_kettle", "chasen"].includes(item.id)
                ? "work-source"
                : "work-target",
              arg: {
                fridge: "fridge",
                sample_kettle: "tool:water",
                "matcha-bowl": "cup",
                chasen: "tool:whisk",
              }[item.id],
            }
          : item.touch,
      }));
  const objects = layers
    .map(
      (item) =>
        `<div class="scene-sprite ${item.className || ""}" data-shop-open="${s.phase === "open" && !s.closing}" data-motion-key="object:${item.id || item.asset}:${item.x}" style="${layerStyle(item, scene)}">${sprite(item.asset, "", item.cropAsset !== undefined ? "garden-soil" : "", item.id === "owner" ? `data-motion-actor="owner" data-motion-key="owner-image" data-anim-id="owner-${s.phase === "open" ? "work" : "wave"}-anim"` : /lantern/.test(item.asset) ? 'data-motion-env="lantern"' : /noren/.test(item.asset) ? 'data-motion-env="noren"' : /planter|flowers/.test(item.asset) ? 'data-motion-env="plant"' : "")}${direct && ((item.id === "broth-pot" && ["cooking", "ready"].includes(brothBatchFor(s).stage)) || (item.id === "fryer" && s.fryer[0]?.stage === "frying")) ? sprite("kitchen-steam", "", "direct-steam") : ""}${item.id === "sink" ? sinkContents(s) : ""}${item.cropAsset ? sprite(item.cropAsset, "", "garden-crop", 'data-motion-env="plant"') : ""}${item.cropAsset === null ? textVi("t_6636deaeced2") : ""}${direct && ["broth-pot", "fryer"].includes(item.id) ? `<span class="work-object-label ${item.id === "broth-pot" ? "broth" : "fryer"}-label" data-work-timer="${item.id === "broth-pot" ? "broth" : "fryer"}"></span>` : ""}${item.touch ? `<button class="sprite-touch" data-act="${item.touch.action}" data-arg="${item.touch.arg || ""}" ${directControls(item)} ${item.touch.wash ? 'data-wash="true"' : ""} aria-label="${item.touch.label}" title="${item.touch.label}"><span class="sr-only">${direct && scene === "kitchen" ? labels.workObjects[item.id] || item.touch.label : item.touch.label}</span></button>` : ""}</div>`,
    )
    .join("");
  const seasonal =
    s.decor.season && l.seasonDecor
      ? `<div class="scene-sprite seasonal-decoration" style="${layerStyle(l.seasonDecor, scene)}">${sprite(DECOR[s.decor.season].asset)}</div>`
      : "";
  const sign = l.sign
    ? `<div class="shop-sign" style="left:${l.sign.x}%;top:${projectBox(scene, l.sign).y}%;width:${l.sign.width}%;height:${l.sign.height}%">${textVi("t_29ad843a9aed")}</div><div class="noren-letters ${l.noren.asset ? "animated-noren" : ""}" style="left:${l.noren.x}%;top:${projectBox(scene, l.noren).y}%;width:${l.noren.width}%;height:${l.noren.height}%">${[..."UDON"].map((c, i) => `<span class="noren-panel" style="--panel:${i}">${l.noren.asset ? sprite(l.noren.asset) : ""}<b>${c}</b></span>`).join("")}</div>`
    : "";
  const recolor =
    scene !== "front" && scene !== "garden"
      ? ["wall", "table"]
          .filter((slot) => s.decor[slot])
          .map(
            (slot) =>
              `<div class="scene-decor-${slot}" style="--zone-start:${projectY(scene, l.zones[slot === "wall" ? "wall" : "counter"][0], playHeight())}%;--zone-end:${100 - projectY(scene, l.zones[slot === "wall" ? "wall" : "counter"][1], playHeight())}%">${background(l, scene)}</div>`,
          )
          .join("")
      : "";
  const foreground = l.foreground
    ? `<div class="scene-foreground" data-motion-key="foliage" aria-hidden="true">${sprite(l.foreground, "", "", 'data-motion-env="plant"')}</div>`
    : "";
  const vine =
    ["front", "garden"].includes(scene) && l.motionVine !== false
      ? `<div class="motion-vine" data-motion-key="vine" aria-hidden="true">${sprite("motion-vine", "", "", 'data-motion-env="plant"')}</div>`
      : "";
  return `<div class="scene-painting" aria-hidden="true">${background(l, scene)}${recolor}</div>${objects}${sign}${seasonal}${foreground}${vine}`;
}
export function sceneHotspots(scene) {
  const layout = layoutFor(scene.startsWith("guests") ? "guests" : scene);
  return (layout?.hotspots || [])
    .map(
      (h) =>
        `<button class="object-hotspot" data-act="${h.action}" data-arg="${h.arg || ""}" ${h.wash ? 'data-wash="true"' : ""} aria-label="${h.label}" title="${h.label}" style="left:${h.x}%;top:${h.y}%;width:${h.width}%;height:${h.height}%"><span class="sr-only">${h.label}</span></button>`,
    )
    .join("");
}
export function artPreview(selected = "") {
  const t = strings.preview;
  const layers = layoutFor("art-preview")
    .layers.map((l) => {
      const style = `left:${l.x}%;top:${l.y}%;width:${l.width}%;height:${l.height}%;transform:translate(${-l.anchor[0] * 100}% ,${-l.anchor[1] * 100}%);z-index:${l.z}`;
      const img = `<img src="${assetUrl(l.asset)}" alt="${l.touch ? t[l.touch.labelKey] : ""}" draggable="false">`;
      return l.touch
        ? `<button class="art-layer art-object" style="${style}" data-act="inspect-art" data-arg="${l.asset}" aria-label="${t[l.touch.labelKey]}" aria-pressed="${selected === l.asset}">${img}</button>`
        : `<div class="art-layer" style="${style}">${img}</div>`;
    })
    .join("");
  return `<main class="game art-review"><header class="art-review-heading"><span class="eyebrow">${t.badge}</span><h1>${t.title}</h1><p>${t.description}</p></header><div class="art-preview-scene" aria-label="${textVi("t_a846873d1b1d")}">${layers}</div><div class="art-review-footer"><p role="status">${selected === "sample_kake" ? t.kake : selected === "sample_kettle" ? t.kettle : t.note}</p><button class="primary wide" data-act="exit-art">${t.back}</button></div></main>`;
}
