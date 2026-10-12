import balance from "../../config/balance.json" with { type: "json" };
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { washCount, washSeconds } from "../systems/washing.js";
import { sprite } from "./assets.js";
export function sinkContents(s) {
  return `<span class="sink-contents" aria-hidden="true">${Array.from({ length: s.sink }, (_, i) => sprite("gdw-dirty-bowl", "", "sink-dirty", `style="--stack:${i}"`)).join("")}<span class="sink-clean-rack"></span><span class="sink-wash-fx">${sprite("gdw-water", "", "sink-water")}${sprite("gdw-soap", "", "sink-soap")}${sprite("gdw-brush", "", "sink-brush")}</span></span><span class="sink-status" data-sink-status>${s.sink ? `${labels.washing.batch} · ${s.sink}` : labels.washing.empty}</span>`;
}
// A manual job is transient UI state. Bowls stay in the saved sink until done.
export function createWashing(host) {
  let job = null,
    clean = 0,
    staffAt = -Infinity;
  let active = false,
    brush,
    water;
  let pendingClean = false;
  let owner = host.getEngine();
  const state = () => host.getEngine().s;
  function start() {
    if (job) return false;
    if (!state().sink) {
      host.notify(labels.washing.noDishes);
      return false;
    }
    job = { start: state().elapsed, count: washCount(state().sink) };
    host.audio.play("wash");
    update();
    return true;
  }
  function observe(count) {
    clean = count;
    pendingClean = true;
    staffAt = state().elapsed;
  }
  function update() {
    if (owner !== host.getEngine()) {
      owner = host.getEngine();
      job = null;
      clean = 0;
      staffAt = -Infinity;
      pendingClean = false;
    }
    const s = state();
    if (job && (s.elapsed < job.start || !s.sink)) job = null;
    if (job && s.elapsed - job.start >= washSeconds()) {
      const n = washCount(s.sink, job.count);
      job = null;
      if (n) {
        host.audio.play("rack");
        clean = n;
        pendingClean = true;
        host.getEngine().wash(n);
        host.notify(labels.washing.done);
      }
    }
    const basin = document.querySelector(
      ".world-room.kitchen .scene-sprite:has([data-wash])",
    );
    if (!basin) return;
    active =
      Boolean(job) ||
      Boolean(s.employees.binh && s.sink) ||
      s.elapsed - staffAt < balance.washing.feedbackMilliseconds / 1000;
    const motion = host.animate() && !host.paused();
    basin.dataset.washing = String(active);
    basin.dataset.washMoving = String(motion);
    const status = basin.querySelector("[data-sink-status]");
    if (status)
      status.textContent = job
        ? `${labels.washing.busy} · ${job.count}`
        : active
          ? labels.washing.busy
          : s.sink
            ? `${labels.washing.batch} · ${s.sink}`
            : labels.washing.empty;
    const rack = basin.querySelector(".sink-clean-rack");
    if (rack && Number(rack.dataset.count) !== clean) {
      rack.dataset.count = clean;
      rack.innerHTML = Array.from({ length: clean }, (_, i) =>
        sprite("gdw-clean-bowl", "", "sink-clean", `style="--stack:${i}"`),
      ).join("");
    }
    if (rack && pendingClean) {
      if (motion)
        for (const bowl of rack.children)
          bowl.animate(
            [
              { transform: "translateX(-65px) rotate(-12deg)", opacity: 0 },
              { transform: "translateX(0) rotate(0)", opacity: 1 },
            ],
            {
              duration: balance.washing.feedbackMilliseconds,
              easing: "ease-out",
            },
          );
      pendingClean = false;
    }
    brush = basin.querySelector(".sink-brush");
    water = basin.querySelector(".sink-water");
    if (!motion && brush) brush.style.transform = "none";
    if (water) water.style.opacity = active ? "1" : "0";
  }
  function frame(now) {
    if (!active || !brush?.isConnected || !host.animate() || host.paused())
      return;
    const time = now / 1000;
    brush.style.transform = `translateX(${Math.sin(time * 18) * 8}px) rotate(${Math.sin(time * 18) * 8}deg)`;
    if (water) water.style.opacity = String(0.7 + 0.25 * Math.sin(time * 24));
  }
  return {
    start,
    update,
    observe,
    frame,
    reset() {
      job = null;
      clean = 0;
      staffAt = -Infinity;
    },
  };
}
