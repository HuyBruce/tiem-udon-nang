import { textVi } from "../i18n.js";
import { EVENTS } from "../data.js";

export const debugEnabled =
  new URLSearchParams(location.search).get("debug") === "1";
export const debugState = { speed: 1 };
// Keep test money, events and destructive reset away from the player's save.
export const debugStorage = debugEnabled
  ? {
      getItem: (key) => localStorage.getItem("debug-" + key),
      setItem: (key, value) => localStorage.setItem("debug-" + key, value),
      removeItem: (key) => localStorage.removeItem("debug-" + key),
    }
  : null;

export function mountDebug(getEngine) {
  if (!debugEnabled) return;
  const panel = document.createElement("details");
  panel.className = "debug-tools";
  panel.innerHTML = `<summary>${textVi("t_5ec4c18392a4")}</summary><p>${textVi("t_2dcdc9607ada")}=1</p>
    <label>${textVi("t_16ee09145b01")} <select data-debug="speed"><option value="1">${textVi("t_53f58e80cd74")}</option><option value="3">${textVi("t_e67ebaf1ac57")}</option><option value="10">${textVi("t_d5e1709795d9")}</option></select></label>
    <button data-debug="money">+ ¥10.000</button><button data-debug="customer">${textVi("t_8e76e3629209")}</button>
    <label>${textVi("t_bdcc1fe57085")} <select data-debug="event"><option value="">${textVi("t_23c1bd438c6b")}</option>${Object.entries(
      EVENTS,
    )
      .map(([id, e]) => `<option value="${id}">${e.name}</option>`)
      .join("")}</select></label>
    <label><input type="checkbox" data-debug="hits"> ${textVi("t_5c42e57602bf")}</label><output aria-live="polite"></output>`;
  panel.addEventListener("change", (event) => {
    const key = event.target.dataset.debug;
    if (key === "speed") debugState.speed = Number(event.target.value);
    if (key === "hits")
      document.documentElement.classList.toggle(
        "debug-hit-areas",
        event.target.checked,
      );
    if (key === "event") {
      const engine = getEngine();
      engine.s.forecast.event = event.target.value || null;
      engine.changed();
    }
  });
  panel.addEventListener("click", (event) => {
    const key = event.target.closest("button")?.dataset.debug;
    if (!key) return;
    const engine = getEngine();
    if (key === "money") engine.s.money += 10000;
    if (key === "customer") {
      const count = engine.s.customers.length;
      engine.spawn();
      panel.querySelector("output").textContent =
        engine.s.customers.length > count
          ? textVi("t_1036164461ac")
          : textVi("t_03954234be7e");
    }
    engine.changed();
  });
  document.body.append(panel);
}

export function debugTick(engine, dt) {
  for (let remaining = Math.min(dt, 2) * debugState.speed; remaining > 0;) {
    const step = Math.min(remaining, 1);
    engine.tick(step);
    remaining -= step;
  }
}
