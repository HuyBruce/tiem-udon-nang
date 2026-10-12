import { guestFrame, guestScene } from "./guest-scene.js";
import { moneyFeedback } from "./experience.js";

// Disposable display history only. Every pose is derived from live engine time.
export function createGuestMotion(host) {
  const settled = new Map(
    host.state().customers.map((c) => [c.id, Boolean(c.settled)]),
  );
  let sampleAt = performance.now(),
    sampleElapsed = host.state().elapsed,
    lastOffset = 0,
    paused = true;
  let dimensions = "",
    heights = new WeakMap();
  function observe(s) {
    for (const c of s.customers) {
      if (settled.get(c.id) === false && c.settled && c.result) {
        const anchor = document.querySelector(`.customer[data-arg="${c.id}"]`);
        if (
          anchor &&
          (host.visible
            ? host.visible(anchor)
            : host.scene().startsWith("guests"))
        ) {
          const label = moneyFeedback(
            c.result.payment + c.result.tip,
            anchor,
            host.moving(),
            c.happy ? "♡" : "…",
          );
          if (label) {
            label.dataset.customer = c.id;
            label.dataset.emotion = c.happy ? "happy" : "disappointed";
          }
        }
      }
      settled.set(c.id, Boolean(c.settled));
    }
    const live = new Set(s.customers.map((c) => c.id));
    for (const id of settled.keys()) if (!live.has(id)) settled.delete(id);
  }
  function paint() {
    const s = host.state();
    if (host.blocked() || document.hidden) return;
    const moving = host.moving() && !document.hidden;
    const offset = !moving
      ? 0
      : paused
        ? lastOffset
        : Math.min(0.25, (performance.now() - sampleAt) / 1000);
    if (moving && !paused) lastOffset = offset;
    const elapsed = s.elapsed + offset;
    const stage = document.querySelector(".stage");
    if (!stage) return;
    const size = host.dimensions?.() || {
      width: stage.clientWidth,
      height: stage.clientHeight,
    };
    const roomWidth = size.width,
      stamp = `${size.width}:${size.height}`;
    if (dimensions !== stamp) {
      dimensions = stamp;
      heights = new WeakMap();
    }
    const places = [...stage.querySelectorAll("[data-guest]")]
      .filter((place) => !host.visible || host.visible(place))
      .map((place) => {
        if (!heights.has(place)) heights.set(place, place.clientHeight);
        return { place, height: heights.get(place) };
      });
    stage.style.setProperty("--guest-room-width", `${roomWidth}px`);
    const guestMotion = moving ? "on" : "off";
    if (stage.dataset.guestMotion !== guestMotion)
      stage.dataset.guestMotion = guestMotion;
    for (const { place, height } of places) {
      const c = s.customers.find((c) => c.id === place.dataset.guest);
      if (!c) continue;
      const f = guestFrame(c, elapsed, moving, offset);
      host.renderer?.()?.guest(place, f, height, roomWidth);
      const body = place.querySelector(".customer");
      if (body.dataset.motion !== f.phase) body.dataset.motion = f.phase;
      if (body.dataset.reaction !== f.reaction)
        body.dataset.reaction = f.reaction;
      body.style.setProperty("--guest-lean", `${f.lean}deg`);
      body.style.setProperty("--guest-shift", `${f.shift}px`);
      body.style.setProperty("--guest-scale", f.scaleY);
      body.style.setProperty("--guest-x", f.x);
      body.style.setProperty("--guest-bob", `${f.bob}px`);
      body.style.setProperty("--guest-opacity", f.opacity);
      body.style.setProperty("--guest-turn", f.turn);
      const image = body.querySelector(":scope > .sprite");
      if (image)
        image.style.transform = `translate(${f.shift}px,${f.bob}px) rotate(${f.lean}deg) scale(${f.turn},${f.scaleY})`;
      const call = body.querySelector(".customer-call");
      if (call) call.style.visibility = f.call ? "visible" : "hidden";
      place.style.setProperty(
        "--meal-lift",
        `${-f.bowlLift * height * 0.38}px`,
      );
      place.style.setProperty(
        "--drink-lift",
        `${-f.drinkLift * height * 0.36}px`,
      );
      place.style.setProperty("--meal-tilt", `${f.bowlLift * -7}deg`);
      const bar = place.querySelector("[data-patience]");
      if (bar) {
        const ratio = c.patience / c.maxPatience;
        bar.style.width = `${ratio * 100}%`;
        const urgency =
          ratio <= 0.2 ? "low" : ratio <= 0.45 ? "warning" : "calm";
        if (bar.parentElement.dataset.urgency !== urgency)
          bar.parentElement.dataset.urgency = urgency;
        const value = String(Math.round(ratio * 100));
        if (bar.parentElement.getAttribute("aria-valuenow") !== value)
          bar.parentElement.setAttribute("aria-valuenow", value);
      }
    }
  }
  function update(s, isPaused) {
    observe(s);
    if (s.elapsed !== sampleElapsed) {
      sampleAt = performance.now();
      sampleElapsed = s.elapsed;
      lastOffset = 0;
    } else if (paused && !isPaused) {
      sampleAt = performance.now() - lastOffset * 1000;
    }
    paused = isPaused;
    paint();
  }
  return {
    observe,
    paint,
    update,
    scene: () => guestScene(host.state(), host.ui, host.moving()),
  };
}
