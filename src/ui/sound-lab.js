import {
  AUDIO_EVENTS,
  AUDIO_PREFS_KEY,
  audioPreferences,
} from "../systems/audio.js";
import words from "../../data/audio-strings.vi.json" with { type: "json" };
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
export function readAudioPreferences() {
  try {
    return audioPreferences(JSON.parse(localStorage.getItem(AUDIO_PREFS_KEY)));
  } catch {
    return audioPreferences(null);
  }
}
export function audioSettingsMarkup() {
  const p = readAudioPreferences();
  return `<label class="setting">${words.ambient}<input type="checkbox" data-audio-setting="ambient" ${p.ambient ? "checked" : ""}><span class="toggle" aria-hidden="true"></span></label><label class="setting volume">${words.ambientVolume}<input type="range" data-audio-setting="ambientVolume" min="0" max="1" step="0.05" value="${p.ambientVolume}"></label><p class="fine" data-audio-status></p><button class="wide" data-act="panel" data-arg="audio-info">${words.info}</button>`;
}
export function updateAudioStatus(app, audio) {
  const node = app.querySelector("[data-audio-status]");
  if (!node) return;
  const stats = audio.stats();
  const message = stats.unavailable
    ? words.unavailable
    : stats.needsTouch
      ? words.retry
      : stats.state === "locked"
        ? words.locked
        : "";
  if (node.textContent !== message) node.textContent = message;
}
export function audioCreditsMarkup() {
  return `<div class="panel-heading"><h2>${words.info}</h2></div><h3>${words.credits}</h3><p>${words.creditText}</p><p><a href="https://opengameart.org/content/general-household-sound-effects" target="_blank" rel="noopener">bretbernhoft · CC0</a></p><p><a href="https://kenney.nl/assets/interface-sounds" target="_blank" rel="noopener">Kenney · CC0</a></p>`;
}
export function mountSoundLab(app, audio) {
  app.udonSoundAudio = audio;
  const key = "udon-sound-review-v1";
  let feedback = {};
  try {
    const r = JSON.parse(localStorage.getItem(key));
    if (r?.version === 1 && r.items && typeof r.items === "object")
      feedback = r.items;
  } catch {}
  let sequence = 0;
  const groups = [...new Set(Object.values(AUDIO_EVENTS).map((e) => e.group))];
  app.innerHTML = `<main class="sound-lab"><header><h1>${words.title}</h1><p>${words.intro}</p><p role="status" data-sound-status>${words.locked}</p><div class="sound-actions"><button data-sound-sequence>${words.sequence}</button><button data-sound-stop>${words.stop}</button><button data-sound-export>${words.export}</button><a href="/">${words.return}</a></div></header>${groups
    .map(
      (group) =>
        `<section><h2>${group}</h2>${Object.entries(AUDIO_EVENTS)
          .filter(([, e]) => e.group === group)
          .map(([id, e]) => {
            const r = feedback[id] || {};
            return `<article class="sound-row" data-sound-row="${id}"><div class="sound-label"><strong>${e.label}</strong><small>${id} · ${e.variants.length} · ${e.source}</small></div><button data-sound-play="${id}">${words.play}</button><div class="sound-checks">${["heard", "good", "bad"].map((f) => `<label><input type="checkbox" data-sound-feedback="${id}:${f}" ${r[f] ? "checked" : ""}>${words[f]}</label>`).join("")}</div><label class="sound-note">${words.note}<input type="text" data-sound-feedback="${id}:note" maxlength="500" value="${esc(r.note || "")}"></label></article>`;
          })
          .join("")}</section>`,
    )
    .join("")}<footer>${audioCreditsMarkup()}</footer></main>`;
  const status = () => {
    const s = audio.stats();
    app.querySelector("[data-sound-status]").textContent = s.unavailable
      ? words.unavailable
      : s.needsTouch
        ? words.retry
        : `${words.status}: ${s.state} · ${s.voices}/24 ${words.voices} · ${s.buffers} ${words.loaded} · ${s.baseLatencyMs.toFixed(1)} ms ${words.latency} · ${s.errors} ${words.error}`;
  };
  app.addEventListener("click", async (e) => {
    const play = e.target.closest("[data-sound-play]");
    if (play) {
      e.stopPropagation();
      await audio.start();
      await audio.play(play.dataset.soundPlay, {
        loop: AUDIO_EVENTS[play.dataset.soundPlay].loop,
        gain: 0.3,
      });
      status();
    }
    if (e.target.closest("[data-sound-stop]")) {
      sequence++;
      audio.stopAll();
      status();
    }
    if (e.target.closest("[data-sound-sequence]")) {
      await audio.start();
      const token = ++sequence;
      for (const id of [
        "ingredient",
        "water",
        "noodles",
        "chop",
        "ping",
        "lift",
        "broth",
        "topping",
        "wood",
        "order",
        "serve",
        "slurp",
        "ahh",
        "coin",
        "wash",
        "rack",
      ]) {
        if (token !== sequence || document.hidden) break;
        await audio.play(id);
        status();
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
    }
    if (e.target.closest("[data-sound-export]")) {
      const blob = new Blob(
          [JSON.stringify({ version: 1, items: feedback }, null, 2)],
          { type: "application/json" },
        ),
        href = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = href;
      a.download = "nhan-xet-am-thanh-udon.json";
      a.click();
      URL.revokeObjectURL(href);
    }
  });
  app.addEventListener("input", (e) => {
    const value = e.target.dataset.soundFeedback;
    if (!value) return;
    const [id, field] = value.split(":");
    if (!AUDIO_EVENTS[id]) return;
    feedback[id] = {
      ...feedback[id],
      [field]:
        e.target.type === "checkbox"
          ? e.target.checked
          : e.target.value.slice(0, 500),
    };
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ version: 1, items: feedback }),
      );
    } catch {}
  });
  const timer = setInterval(status, 500);
  window.addEventListener(
    "pagehide",
    () => {
      clearInterval(timer);
      sequence++;
      void audio.dispose();
    },
    { once: true },
  );
  return { feedback, status };
}
