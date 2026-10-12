import balance from "../../config/balance.json" with { type: "json" };
import labels from "../../data/ui-labels.vi.json" with { type: "json" };
import { gameMinutes, minutesText } from "../systems/time.js";

export const PAUSE_PANELS = new Set([
  "settings",
  "audio-info",
  "help",
  "reset",
  "summary",
  "morning",
  "manage",
  "inventory",
  "menu",
  "upgrades",
  "decor",
  "employees",
  "staff-recipes",
  "neighbourhood",
  "album",
  "reviews",
  "garden",
  "pets",
  "recipes",
  "decor-preview",
  "close-day",
  "stock-detail",
]);
export function pauseReason(ui, hidden = false) {
  if (hidden) return "hidden";
  if (!ui.started || ui.artPreview) return "start";
  return PAUSE_PANELS.has(ui.panel) ? ui.panel : "";
}
export function interpolatedMinutes(s, now, lastTick, paused) {
  return (
    gameMinutes(s) +
    (s.phase === "open" && !paused
      ? (Math.min(balance.clock.tickMilliseconds, Math.max(0, now - lastTick)) /
          1000) *
        balance.clock.minutesPerSecond
      : 0)
  );
}
export const returnSeconds = (milliseconds) =>
  Math.min(balance.clock.resumeMaxSeconds, Math.max(0, milliseconds / 1000));

export function createClockUI(host) {
  let digital, hour, minute, face, badge;
  let frames = [],
    lastFrame = 0,
    lastReport = 0,
    lastText = "",
    lastReason = null;
  const diagnostics = new URLSearchParams(location.search).get("debug");
  const perf = diagnostics === "perf";
  const overlay =
    diagnostics === "1" || perf ? document.createElement("output") : null;
  if (overlay) {
    overlay.className = "clock-diagnostics";
    overlay.setAttribute("aria-live", "off");
    document.body.append(overlay);
  }
  function frame(now, sample = true) {
    if (!digital?.isConnected || !badge?.isConnected) {
      digital = document.getElementById("clock");
      face = document.querySelector(".analog-clock");
      hour = face?.querySelector(".clock-hour");
      minute = face?.querySelector(".clock-minute");
      badge = digital && document.createElement("span");
      if (badge) {
        badge.className = "clock-pause";
        digital.after(badge);
      }
      lastText = "";
    }
    const s = host.state(),
      reason = host.pauseReason() || (s.phase !== "open" ? s.phase : "");
    const m = interpolatedMinutes(s, now, host.lastTick(), reason);
    const text = minutesText(m);
    if (digital && text !== lastText) {
      digital.textContent = text;
      face?.setAttribute("aria-label", text);
      lastText = text;
    }
    if (hour) hour.style.transform = `rotate(${m / 2}deg)`;
    if (minute) minute.style.transform = `rotate(${m * 6}deg)`;
    if (badge) {
      badge.hidden = !reason;
      badge.textContent = labels.clock.paused;
      badge.title = labels.clock.reasons[reason] || labels.clock.panel;
    }
    const heading = document.querySelector('.sheet [role="heading"]');
    let panelStatus =
      heading?.parentElement.querySelector(".panel-clock-pause");
    if (heading && reason && !panelStatus) {
      const status = document.createElement("span");
      status.className = "panel-clock-pause";
      status.id = "panel-clock-status";
      status.setAttribute("role", "status");
      status.textContent = labels.clock.paused;
      heading.after(status);
      heading.closest(".sheet").setAttribute("aria-describedby", status.id);
      panelStatus = status;
    }
    if (panelStatus) panelStatus.hidden = !reason;
    if (!overlay) return;
    if (
      sample &&
      lastFrame &&
      now - lastFrame < balance.clock.perfGapMilliseconds
    )
      frames.push(now - lastFrame);
    if (sample) lastFrame = now;
    if (frames.length > balance.clock.perfFrameWindow) frames.shift();
    if (
      now - lastReport < balance.clock.perfReportMilliseconds &&
      reason === lastReason
    )
      return;
    lastReason = reason;
    lastReport = now;
    const sorted = [...frames].sort((a, b) => a - b);
    const mean = frames.reduce((n, x) => n + x, 0) / Math.max(1, frames.length);
    const stats = {
      gameTime: text,
      lastTick: host.lastTick(),
      pauseReason: reason,
      fps: mean ? 1000 / mean : 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      nodes: perf ? document.getElementsByTagName("*").length : 0,
      animations: perf ? document.getAnimations().length : 0,
      memory: perf ? (performance.memory?.usedJSHeapSize ?? null) : null,
    };
    window.__udonClockStats = stats;
    overlay.textContent = `${labels.clock.diagnostic} ${text} · ${labels.clock.lastTick} ${Math.round(stats.lastTick)}ms\n${labels.clock.reason}: ${labels.clock.reasons[reason] || (reason ? labels.clock.panel : labels.clock.running)}${perf ? `\nFPS ${stats.fps.toFixed(1)} · p95 ${stats.p95.toFixed(1)}ms\nDOM ${stats.nodes} · ${labels.clock.animations} ${stats.animations}\n${labels.clock.memory} ${stats.memory === null ? labels.clock.unavailable : (stats.memory / 1048576).toFixed(1) + " MiB"}` : ""}`;
  }
  return { frame, perf };
}
