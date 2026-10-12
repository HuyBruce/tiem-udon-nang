import { createWebGLWorld } from "./webgl-world.js";
import { fitImage, stackingOrder, overlaps } from "./canvas-model.js";

const dynamic =
  "[data-motion-actor],[data-motion-env],.customer,.customer > .sprite,.noren-panel,.guest-meal-part > .food-layers,.guest-drink";
const artwork =
  ".scene-painting img,.scene-sprite img,.scene-foreground img,.scene-staff img,.customer > img,.pet-body,.table-bowl img,.combo-served-visual img,.pots img,.noodle-basket img,.room-bouquet img,.guest-counter-flowers img,.noren-panel > img";
let current = null;
export const rendererStats = () => current?.stats() || { kind: "dom" };
const fraction = (value, fallback = 0.5) =>
  value?.endsWith("%") ? parseFloat(value) / 100 : fallback;
const box = (rect, room) => ({
  x: rect.left - room.left,
  y: rect.top - room.top,
  width: rect.width,
  height: rect.height,
});

// HTML owns interactions/text. Only existing art is drawn here; no game state,
// save data, additional RAF, duplicate image request, or synthetic character art.
export function createWorldCanvas(host) {
  const requested =
    new URLSearchParams(location.search).get("renderer") || "dom";
  const models = new Map(),
    groups = new Map(),
    pending = new WeakMap();
  let stage = null,
    canvas = null,
    backend = null,
    initializing = false,
    width = 0,
    height = 0,
    dpr = 1,
    serial = 0;
  let failed = false,
    paints = 0;
  const active = () => requested === "canvas" && !failed && Boolean(backend);
  function restore(model) {
    backend?.release(model);
    for (const item of model.items)
      item.el.removeAttribute("data-canvas-image");
  }
  function clear() {
    for (const model of models.values()) restore(model);
    models.clear();
    groups.clear();
    backend?.prune();
  }
  function invalidate(room) {
    const model = models.get(room);
    if (model) {
      restore(model);
      for (const el of model.groups.keys()) groups.delete(el);
      models.delete(room);
    }
  }
  function fallback() {
    failed = true;
    clear();
    backend?.dispose();
    backend = null;
    if (canvas) canvas.dataset.rendererReady = "false";
    if (stage) stage.dataset.renderer = "dom";
  }
  function setup(next) {
    if (requested !== "canvas" || !next?.classList.contains("world-camera"))
      return false;
    if (failed) {
      next.dataset.renderer = "dom";
      return false;
    }
    if (stage !== next) {
      clear();
      backend?.dispose();
      backend = null;
      stage = next;
      canvas = stage.querySelector(".world-canvas");
      canvas.udonRendererStats = () => api.stats();
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        fallback();
      });
    }
    const w = stage.clientWidth,
      h = stage.clientHeight,
      ratio = window.devicePixelRatio || 1;
    if (!backend) {
      if (!initializing) {
        initializing = true;
        const target = canvas;
        createWebGLWorld(target, w, h, ratio)
          .then((created) => {
            if (canvas !== target || failed) {
              created.dispose();
              return;
            }
            backend = created;
            width = w;
            height = h;
            dpr = ratio;
            host.wake();
          })
          .catch(fallback)
          .finally(() => {
            initializing = false;
          });
      }
      return false;
    }
    if (w !== width || h !== height || ratio !== dpr) {
      clear();
      width = w;
      height = h;
      dpr = ratio;
      backend.resize(w, h, ratio);
    }
    stage.dataset.renderer = "canvas";
    return true;
  }
  function capture(room) {
    const elements = [...room.querySelectorAll(artwork)];
    for (const el of elements) el.removeAttribute("data-canvas-image");
    room.dataset.rendererMeasuring = "true";
    const roomRect = room.getBoundingClientRect(),
      cached = new Map(),
      modelGroups = new Map();
    const style = (el) => {
      if (!cached.has(el)) cached.set(el, getComputedStyle(el));
      return cached.get(el);
    };
    const rect = (el) => box(el.getBoundingClientRect(), roomRect);
    const group = (el) => {
      if (!modelGroups.has(el)) {
        const r = rect(el),
          origin = style(el).transformOrigin.split(" ");
        const g = {
          el,
          box: r,
          pivot: [r.x + parseFloat(origin[0]), r.y + parseFloat(origin[1])],
          matrix: new DOMMatrix(),
          opacity: 1,
        };
        modelGroups.set(el, g);
        groups.set(el, g);
      }
      return modelGroups.get(el);
    };
    const items = [];
    for (const [order, el] of elements.entries()) {
      if (!el.complete || !el.naturalWidth) {
        if (pending.get(el) !== el.src) {
          pending.set(el, el.src);
          el.addEventListener(
            "load",
            () => {
              invalidate(room);
              host.wake();
            },
            { once: true },
          );
        }
        continue;
      }
      // Real ready sprite sheets keep their native player/fallback pair.
      if (el.dataset.sheetStatus === "ready" || el.closest(".sheet-viewport"))
        continue;
      const chain = [];
      for (let p = el; p && p !== room; p = p.parentElement) chain.unshift(p);
      const s = style(el),
        clips = [],
        motion = [],
        stack = [];
      let opacity = 1,
        hidden = false;
      const filters = [];
      for (const p of chain) {
        const st = style(p);
        if (st.filter !== "none") filters.push(st.filter);
        if (st.visibility === "hidden" || st.display === "none") hidden = true;
        if (p.matches(dynamic)) {
          const g = group(p);
          g.parent = motion.at(-1);
          motion.push(g);
        }
        // Guest opacity comes from the engine frame, not a sampled entry pose.
        if (!p.matches(".customer,[data-motion-env]"))
          opacity *= Number(st.opacity);
        if (st.zIndex !== "auto") stack.push(Number(st.zIndex));
        if (p !== el && (st.overflow === "hidden" || st.overflow === "clip"))
          clips.push(rect(p));
        const inset = st.clipPath.match(/^inset\(([^)]+)\)/);
        if (inset) {
          const r = rect(p),
            v = inset[1].split(" ");
          const values = [
            v[0],
            v[1] || v[0],
            v[2] || v[0],
            v[3] || v[1] || v[0],
          ].map((n, i) =>
            n.endsWith("%")
              ? (parseFloat(n) / 100) * (i % 2 ? r.width : r.height)
              : parseFloat(n),
          );
          clips.push({
            x: r.x + values[3],
            y: r.y + values[0],
            width: r.width - values[1] - values[3],
            height: r.height - values[0] - values[2],
          });
        }
      }
      // Color transforms can be baked once into the existing image. Shadows
      // extending beyond the source bounds remain native HTML effects.
      if (hidden || filters.some((f) => f.includes("drop-shadow"))) continue;
      const r = rect(el),
        pos = s.objectPosition.split(" ");
      items.push({
        el,
        image: el,
        rect: fitImage(
          r,
          { width: el.naturalWidth, height: el.naturalHeight },
          s.objectFit,
          [fraction(pos[0]), fraction(pos[1])],
        ),
        clips,
        motion,
        stack,
        order,
        opacity,
        filter: filters.reverse().join(" ") || "none",
      });
    }
    const places = [...room.querySelectorAll("[data-guest]")].map((el) => [
      el,
      rect(el),
    ]);
    for (const [el, r] of places)
      modelGroups.set(el, {
        el,
        box: r,
        matrix: new DOMMatrix(),
        opacity: 1,
        pivot: [r.x, r.y],
      });
    delete room.dataset.rendererMeasuring;
    const model = {
      room,
      items: items.sort(stackingOrder),
      groups: modelGroups,
      places,
      revision: host.revision(),
      stamp: ++serial,
    };
    models.set(room, model);

    return model;
  }
  function reconcile() {
    const next = document.querySelector("#stage");
    if (!next && stage) {
      clear();
      backend?.dispose();
      backend = null;
      canvas = null;
      stage = null;
    }
    if (!setup(next)) return;
    for (const room of host.camera.roots() || []) {
      let model = models.get(room);
      if (!model || model.revision !== host.revision()) {
        if (model) {
          restore(model);
          for (const el of model.groups.keys()) groups.delete(el);
        }
        capture(room);
      } else {
        model.stamp = ++serial;
      }
    }
    // At most three room models, including visible rooms and cached neighbors.
    while (models.size > 3) {
      const [room, model] =
        [...models]
          .filter(([r]) => !r.isConnected)
          .sort((a, b) => a[1].stamp - b[1].stamp)[0] || [...models][0];
      restore(model);
      for (const el of model.groups.keys()) groups.delete(el);
      models.delete(room);
    }
  }
  function transform(el, value, origin, opacity = 1) {
    const g = groups.get(el);
    if (!g) return;
    if (origin) {
      const [x, y] = origin.split(" ");
      g.pivot = [
        g.box.x + fraction(x) * g.box.width,
        g.box.y + fraction(y) * g.box.height,
      ];
    }
    try {
      if (g.value !== value) {
        g.matrix = value === "none" ? new DOMMatrix() : new DOMMatrix(value);
        g.value = value;
      }
    } catch {
      return;
    }
    g.opacity = opacity;
  }
  function guest(place, f, h, roomWidth) {
    if (!active()) return;
    const body = place.querySelector(".customer"),
      image = body?.querySelector(":scope > .sprite");
    transform(body, `translateX(${f.x * roomWidth}px)`, null, f.opacity);
    transform(
      image,
      `translate(${f.shift}px,${f.bob}px) rotate(${f.lean}deg) scale(${f.turn},${f.scaleY})`,
      "50% 85%",
    );
    for (const layer of place.querySelectorAll(
      ".guest-meal-part > .food-layers",
    ))
      transform(
        layer,
        `translateY(${-f.bowlLift * h * 0.38}px) rotate(${f.bowlLift * -7}deg)`,
      );
    for (const drink of place.querySelectorAll(".guest-drink"))
      transform(drink, `translateY(${-f.drinkLift * h * 0.36}px)`);
  }
  function contains(el) {
    if (!active()) return undefined;
    const model = models.get(el.closest?.("[data-world-room]"));
    const g = groups.get(el) || model?.groups.get(el);
    const r = g?.box;
    if (!model || !r) return undefined;
    const x =
      (Number(model.room.dataset.worldX) - host.camera.stats().offset) * width;
    const corners = [
      [r.x, r.y],
      [r.x + r.width, r.y],
      [r.x, r.y + r.height],
      [r.x + r.width, r.y + r.height],
    ].map(([px, py]) => {
      for (let group = g; group; group = group.parent) {
        const [ox, oy] = group.pivot;
        const m = group.matrix;
        const nx = m.a * (px - ox) + m.c * (py - oy) + m.e + ox;
        py = m.b * (px - ox) + m.d * (py - oy) + m.f + oy;
        px = nx;
      }
      return [px + x, py];
    });
    const left = Math.min(...corners.map((p) => p[0]));
    const top = Math.min(...corners.map((p) => p[1]));
    const viewLeft = Math.max(0, x);
    return overlaps(
      {
        x: left,
        y: top,
        width: Math.max(...corners.map((p) => p[0])) - left,
        height: Math.max(...corners.map((p) => p[1])) - top,
      },
      {
        x: viewLeft,
        y: 0,
        width: Math.min(width, x + width) - viewLeft,
        height,
      },
    );
  }
  function paint() {
    if (!active()) return;
    try {
      backend.paint(
        models,
        host.camera.roots() || [],
        host.camera.stats().offset,
      );
      for (const room of host.camera.roots() || [])
        for (const item of models.get(room)?.items || [])
          if (
            item.el.dataset.sheetStatus !== "ready" &&
            item.el.dataset.canvasImage !== "true"
          )
            item.el.dataset.canvasImage = "true";
      if (canvas.dataset.rendererReady !== "true")
        canvas.dataset.rendererReady = "true";
      paints++;
    } catch (error) {
      console.error("World renderer fallback", error);
      fallback();
    }
  }
  const api = {
    reconcile,
    paint,
    transform,
    guest,
    contains,
    active,
    dispose() {
      clear();
      backend?.dispose();
      backend = null;
      stage = null;
    },
    stats: () => ({
      kind: active() ? "canvas" : "dom",
      requested,
      width,
      height,
      dpr,
      buffer: canvas ? [canvas.width, canvas.height] : null,
      rooms: models.size,
      images: [...models.values()].reduce((n, m) => n + m.items.length, 0),
      paints,
      failed,
      ...backend?.stats(),
    }),
  };
  current = api;
  return api;
}
