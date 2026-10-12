import manifest from "../../../assets/manifest.json" with { type: "json" };
import { actorFrame, phaseFor } from "./model.js";
import { createSheetPlayer, validAnimationAsset } from "./sprite-sheet.js";
import { pauseEffects } from "./effects.js";
import { capAnimations } from "./animation-budget.js";
export { ANIMATION_LIMIT } from "./animation-budget.js";
let liveMotion = null;
export const motionStats = () => liveMotion?.stats() || {};
const sheets = import.meta.glob("../../../assets/animations/*.webp", {
  query: "?url",
  import: "default",
});
export function createSceneMotion(
  host,
  registry = manifest.assets,
  loadSheet = (file) => sheets["../../../assets/" + file]?.(),
) {
  let raf = 0,
    last = performance.now(),
    time = 0,
    root = null,
    actors = [],
    environment = [],
    sheetTargets = [],
    viewStamp = "",
    players = new Map(),
    running = false;
  const suspended = new Set();
  const visible = () => !document.hidden && !host.blocked();
  const inView = (el) =>
    host.renderer?.contains(el) ??
    (!host.camera?.roots()?.length ||
      !el.closest("[data-world-room]") ||
      host.camera.contains(el));
  function reconcilePlayers() {
    for (const [el, player] of players)
      if (
        !el.isConnected ||
        !inView(el) ||
        player.id !== el.dataset.animId ||
        (!root?.contains(el) &&
          !el.closest(".direct-workbench,.wooden-tray,.sheet"))
      ) {
        player.destroy();
        players.delete(el);
      }
    for (const el of sheetTargets)
      if (
        visible() &&
        inView(el) &&
        !players.has(el) &&
        validAnimationAsset(registry[el.dataset.animId]) &&
        registry[el.dataset.animId].status === "ready"
      )
        players.set(
          el,
          Object.assign(
            createSheetPlayer(
              el,
              registry[el.dataset.animId],
              loadSheet,
              () => time,
            ),
            { id: el.dataset.animId },
          ),
        );
    viewStamp = host.camera?.stats().offset;
  }
  function readVisibility() {
    host.camera?.prepareVisibility?.([
      ...actors,
      ...environment,
      ...sheetTargets,
      ...(root?.querySelectorAll("[data-guest]") || []),
    ]);
  }
  function reconcile(paintNow = true) {
    root =
      document.querySelector(".stage") ||
      document.querySelector(".landing-art");
    for (const el of root?.querySelectorAll(".noren-panel") || [])
      el.dataset.motionEnv = "noren";
    for (const el of root?.querySelectorAll(
      ".guest-counter-flowers >.sprite,.room-bouquet >.sprite,.seasonal-decoration >.sprite",
    ) || [])
      el.dataset.motionEnv = "plant";
    actors = [...(root?.querySelectorAll("[data-motion-actor]") || [])];
    environment = [
      ...(root?.querySelectorAll("[data-motion-env]") || []),
      ...document.querySelectorAll(
        ".direct-workbench [data-motion-env],.wooden-tray [data-motion-env],.sheet [data-motion-env]",
      ),
    ];
    sheetTargets = [
      ...(root?.querySelectorAll("[data-anim-id]") || []),
      ...environment.filter((e) => e.dataset.animId),
    ];
    host.renderer?.reconcile();
    readVisibility();
    reconcilePlayers();
    sync();
    if (paintNow) paint(true);
  }
  function sync() {
    const sceneEnabled =
      (visible() && (host.moving() || host.camera?.active())) ||
      (!document.hidden && host.pending?.());
    const enabled = sceneEnabled || (!document.hidden && host.clock?.());
    const paused = String(!visible()),
      sceneRunning = String(sceneEnabled);
    if (document.documentElement.dataset.motionPaused !== paused)
      document.documentElement.dataset.motionPaused = paused;
    if (root && root.dataset.motionRunning !== sceneRunning)
      root.dataset.motionRunning = sceneRunning;
    pauseEffects(document.hidden);
    for (const a of suspended)
      if (a.playState === "idle" || !a.effect?.target?.isConnected)
        suspended.delete(a);
    const animations = document.getAnimations();
    for (const a of animations) {
      if (a.effect?.getTiming().iterations !== Infinity) continue;
      const outside =
        a.effect?.target?.closest?.("[data-world-room]") &&
        !inView(a.effect.target);
      if (
        (!sceneEnabled || !host.moving() || outside) &&
        a.playState === "running"
      ) {
        a.pause();
        suspended.add(a);
      } else if (
        sceneEnabled &&
        host.moving() &&
        !outside &&
        (suspended.has(a) ||
          (typeof CSSAnimation !== "undefined" &&
            a instanceof CSSAnimation &&
            a.playState === "paused"))
      ) {
        a.play();
        suspended.delete(a);
      }
    }
    for (const a of suspended) if (a.playState === "idle") suspended.delete(a);
    capAnimations(animations);
    if (!enabled && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    running = enabled;
    if (enabled && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  }
  function paint(visibilityPrepared = false) {
    if (!root || !visible()) return;
    if (!visibilityPrepared) readVisibility();
    const moving = host.moving(),
      s = host.state();
    if (viewStamp !== host.camera?.stats().offset) reconcilePlayers();
    host.guests.paint();
    for (const el of actors) {
      const visible = String(inView(el));
      if (el.dataset.motionVisible !== visible)
        el.dataset.motionVisible = visible;
      if (el.dataset.motionVisible === "false") continue;
      const f = actorFrame(el.dataset.motionActor, time, s, moving);
      if (el.dataset.motionState !== f.mode) el.dataset.motionState = f.mode;
      el.style.transform = f.transform;
      host.renderer?.transform(el, f.transform);
    }
    for (const [i, el] of environment.entries()) {
      if (!inView(el)) continue;
      const kind = el.dataset.motionEnv,
        phase = phaseFor(el.dataset.motionKey || `${kind}:${i}`);
      el.style.transformOrigin =
        kind === "lantern" || kind === "noren" ? "50% 4%" : "50% 95%";
      if (kind === "steam") {
        const p = ((time + phase) % 2.8) / 2.8;
        const y = el.classList.contains("guest-meal-steam")
          ? `calc(var(--meal-lift, 0px) - ${p * 5}px)`
          : `${-p * 5}px`;
        el.style.transform = moving
          ? `translateY(${y}) scale(${0.94 + p * 0.08})`
          : el.classList.contains("guest-meal-steam")
            ? "translateY(var(--meal-lift, 0px))"
            : "none";
        el.style.opacity = moving
          ? String(0.25 + Math.sin(p * Math.PI) * 0.35)
          : ".5";
        host.renderer?.transform(
          el,
          el.style.transform
            .replace(
              /calc\(var\(--meal-lift, 0px\) - ([\d.]+)px\)/,
              (_, n) =>
                `${parseFloat(el.closest("[data-guest]")?.style.getPropertyValue("--meal-lift") || 0) - Number(n)}px`,
            )
            .replace(
              "var(--meal-lift, 0px)",
              el
                .closest("[data-guest]")
                ?.style.getPropertyValue("--meal-lift") || "0px",
            ),
          el.style.transformOrigin,
          Number(el.style.opacity),
        );
      } else {
        const period = 3 + phase / 2,
          angle =
            Math.sin(((time + phase) * Math.PI * 2) / period) *
            (kind === "lantern" ? 1.2 : kind === "noren" ? 0.8 : 1);
        el.style.transform = moving ? `rotate(${angle}deg)` : "none";
        host.renderer?.transform(
          el,
          el.style.transform,
          el.style.transformOrigin,
        );
      }
    }
    for (const player of players.values()) player.paint(time, moving);
    host.renderer?.paint();
  }
  function loop(now) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    time += dt;
    last = now;
    host.frame?.(now, dt);
    const changed = host.camera?.step(dt, host.moving());
    if (changed) reconcile(false);
    if (host.moving() || changed) paint(changed);
    host.flush?.();
    if (running && !document.hidden && !raf) raf = requestAnimationFrame(loop);
  }
  function update() {
    if (host.camera?.step(0, host.moving())) reconcile();
    sync();
    if (!running || !raf || !host.moving()) paint();
  }
  function onVisibility() {
    last = performance.now();
    update();
  }
  document.addEventListener("visibilitychange", onVisibility);
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", update);
  const api = {
    reconcile,
    update,
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      media.removeEventListener("change", update);
      for (const p of players.values()) p.destroy();
      players.clear();
      suspended.clear();
    },
    stats: () => ({
      targets: actors.length + environment.length,
      sheets: players.size,
      running,
      animations: document.getAnimations().length,
      suspended: suspended.size,
      suspendedDetached: [...suspended].filter(
        (a) => !a.effect?.target?.isConnected,
      ).length,
    }),
  };
  liveMotion = api;
  return api;
}
