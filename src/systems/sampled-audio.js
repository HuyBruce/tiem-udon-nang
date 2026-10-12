import bank from "../../data/audio-events.json" with { type: "json" };
import balance from "../../config/balance.json" with { type: "json" };
import words from "../../data/audio-strings.vi.json" with { type: "json" };
const urls =
  typeof window === "undefined"
    ? {}
    : import.meta.glob("../../assets/audio/generated/*.{m4a,wav}", {
        query: "?url",
        import: "default",
        eager: true,
      });
const url = (file) => urls["../../assets/audio/generated/" + file];
export const AUDIO_EVENTS = bank.events;
export const AUDIO_PREFS_KEY = "udon-audio-v1";
export function audioPreferences(raw) {
  return {
    version: 1,
    ambient: typeof raw?.ambient === "boolean" ? raw.ambient : true,
    ambientVolume: Number.isFinite(raw?.ambientVolume)
      ? Math.max(0, Math.min(1, raw.ambientVolume))
      : 0.5,
  };
}
export function chooseVariant(count, last, random = Math.random) {
  if (count < 2) return 0;
  const valid = Number.isInteger(last) && last >= 0 && last < count,
    r = Math.max(0, Math.min(0.999999, random()));
  if (!valid) return Math.floor(r * count);
  const i = Math.floor(r * (count - 1));
  return i >= last ? i + 1 : i;
}
export class AudioSystem {
  constructor(settings, options = {}) {
    this.settings = settings;
    this.options = options;
    this.ctx = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.last = new Map();
    this.voices = new Set();
    this.loops = new Map();
    this.busLevels = [null, null, null];
    this.ambient = null;
    this.timer = null;
    this.errors = [];
    this.eventsPlayed = [];
    this.hidden = false;
    this.environment = "room";
    this.generation = 0;
    try {
      this.preferences = audioPreferences(
        JSON.parse(globalThis.localStorage?.getItem(AUDIO_PREFS_KEY) || "null"),
      );
    } catch {
      this.preferences = audioPreferences(null);
    }
  }
  get config() {
    return balance.audio;
  }
  async start() {
    if (this.disposed) return false;
    if (!this.ctx) {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) {
        this.unavailable = true;
        return false;
      }
      this.ctx = new Context({ latencyHint: "interactive" });
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = this.config.openCutoffHz;
      this.compressor = this.ctx.createDynamicsCompressor();
      Object.assign(this.compressor.threshold, { value: -10 });
      this.compressor.ratio.value = 6;
      this.compressor.knee.value = 6;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.12;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.config.masterGain;
      this.filter.connect(this.compressor);
      this.compressor.connect(this.master);
      this.limiter = this.ctx.createWaveShaper();
      this.limiter.curve = Float32Array.from({ length: 4096 }, (_, i) => {
        const x = (i / 4095) * 2 - 1;
        return Math.max(
          -this.config.limiterCeiling,
          Math.min(this.config.limiterCeiling, x),
        );
      });
      this.limiter.oversample = "2x";
      this.master.connect(this.limiter);
      this.limiter.connect(this.ctx.destination);
      for (const name of ["musicBus", "sfxBus", "ambientBus"]) {
        this[name] = this.ctx.createGain();
        this[name].connect(this.filter);
      }
    }
    if (!this.unlocked) {
      try {
        if (globalThis.navigator?.audioSession)
          navigator.audioSession.type = "playback";
      } catch {}
      if (globalThis.Audio) {
        this.unlockElement = new Audio(url("unlock.wav"));
        this.unlockElement.playsInline = true;
        this.unlockElement.volume = 0.01;
        this.unlockElement.play().catch(() => {
          this.needsTouch = true;
        });
      }
      this.unlocked = true;
    }
    try {
      if (
        this.ctx.state !== "running" &&
        this.ctx.state !== "closed" &&
        !this.hidden
      )
        await this.ctx.resume();
      this.needsTouch = this.ctx.state !== "running";
    } catch {
      this.needsTouch = true;
    }
    this.syncSettings();
    if (!this.uiPreloaded) {
      this.uiPreloaded = true;
      void this.preload(words.groups.ui);
    }
    return !this.needsTouch;
  }
  setPreference(name, value) {
    if (name === "ambient" || name === "ambientVolume") {
      this.preferences = audioPreferences({
        ...this.preferences,
        [name]: value,
      });
      try {
        localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(this.preferences));
      } catch {}
      this.syncSettings();
    }
  }
  syncSettings() {
    if (!this.ctx) return;
    const levels = [
      this.settings.music ? (this.settings.musicVolume ?? 0.6) : 0,
      this.settings.sfx ? (this.settings.sfxVolume ?? 0.8) : 0,
      this.preferences.ambient ? this.preferences.ambientVolume : 0,
    ];
    [this.musicBus, this.sfxBus, this.ambientBus].forEach((bus, i) => {
      if (!bus || levels[i] === this.busLevels[i]) return;
      const g = bus.gain,
        t = this.ctx.currentTime;
      g.cancelScheduledValues(0);
      g.setValueAtTime(g.value, t);
      g.setTargetAtTime(levels[i], t, 0.025);
      this.busLevels[i] = levels[i];
    });
    for (const [key, v] of this.loops)
      if (!this.enabled(v.event.bus)) {
        this.stopVoice(v);
        this.loops.delete(key);
      }
  }
  enabled(bus) {
    return bus === "music"
      ? this.settings.music
      : bus === "ambient"
        ? this.preferences.ambient
        : this.settings.sfx;
  }
  async load(id, index = 0) {
    const e = AUDIO_EVENTS[id],
      entry = e?.variants[index];
    if (!entry || !this.ctx) return null;
    const key = entry.file;
    if (this.buffers.has(key)) return this.buffers.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const ctx = this.ctx;
    const promise = (async () => {
      try {
        const bytes = this.options.bytes
          ? await this.options.bytes(entry.file)
          : await fetch(url(entry.file)).then((r) => {
              if (!r.ok) throw Error(r.status);
              return r.arrayBuffer();
            });
        const b = await ctx.decodeAudioData(bytes.slice(0));
        if (!this.disposed) this.buffers.set(key, b);
        return b;
      } catch (err) {
        this.errors.push({ file: key, error: String(err) });
        this.errors = this.errors.slice(-20);
        return null;
      } finally {
        this.loading.delete(key);
      }
    })();
    this.loading.set(key, promise);
    return promise;
  }
  async preload(group) {
    return Promise.all(
      Object.entries(AUDIO_EVENTS)
        .filter(([, e]) => e.group === group)
        .flatMap(([id, e]) => e.variants.map((_, i) => this.load(id, i))),
    );
  }
  stopVoice(v) {
    if (!v || v.ended) return;
    v.ended = true;
    if (v.src) {
      try {
        v.src.stop();
      } catch {}
      v.src.onended = null;
      v.src.disconnect();
      v.gain.disconnect();
      v.pan?.disconnect();
    }
    this.voices.delete(v);
    for (const [key, loop] of this.loops)
      if (loop === v) this.loops.delete(key);
    if (this.ambient === v) this.ambient = null;
  }
  sound(buffer, id, index, { loop = false, gain = 1 } = {}) {
    const e = AUDIO_EVENTS[id];
    if (
      !buffer ||
      !this.ctx ||
      this.ctx.state !== "running" ||
      this.hidden ||
      !this.enabled(e.bus) ||
      this.disposed
    )
      return null;
    while (this.voices.size >= this.config.maxVoices) {
      const oldest =
        [...this.voices].find((v) => !v.loop) ||
        this.voices.values().next().value;
      this.stopVoice(oldest);
    }
    const src = this.ctx.createBufferSource(),
      g = this.ctx.createGain(),
      pan = this.ctx.createStereoPanner?.();
    src.buffer = buffer;
    src.loop = loop;
    if (loop) {
      src.loopStart = 0;
      src.loopEnd = Math.min(buffer.duration, e.variants[index].duration);
    }
    src.playbackRate.value = loop
      ? 1
      : 1 + (Math.random() * 2 - 1) * this.config.pitchVariation;
    g.gain.value =
      gain *
      (loop
        ? 1
        : 10 **
          (((Math.random() * 2 - 1) * this.config.volumeVariationDb) / 20));
    src.connect(g);
    if (pan) {
      g.connect(pan);
      pan.pan.value = this.pan || 0;
      pan.connect(this[e.bus + "Bus"]);
    } else g.connect(this[e.bus + "Bus"]);
    const v = { src, gain: g, pan, loop, event: e, kind: id };
    this.voices.add(v);
    src.onended = () => this.stopVoice(v);
    src.start();
    this.eventsPlayed.push({ id, index, at: this.ctx.currentTime });
    this.eventsPlayed = this.eventsPlayed.slice(-100);
    if (
      this.musicBus &&
      ["coin", "tip", "ping", "discover", "review"].includes(id)
    ) {
      const t = this.ctx.currentTime,
        base = this.busLevels[0] || 0;
      this.musicBus.gain.cancelScheduledValues(t);
      this.musicBus.gain.setTargetAtTime(base * this.config.duckGain, t, 0.02);
      this.musicBus.gain.setTargetAtTime(
        base,
        t + this.config.duckSeconds,
        0.12,
      );
    }
    return v;
  }
  async play(id = "click", options = {}) {
    if (this.settings.haptic)
      globalThis.navigator?.vibrate?.(
        ["ping", "coin", "bell"].includes(id) ? 20 : 8,
      );
    if (!AUDIO_EVENTS[id]) id = "click";
    if (!this.enabled(AUDIO_EVENTS[id].bus)) return null;
    if (!this.ctx) await this.start();
    if (!this.ctx) return null;
    const generation = this.generation,
      e = AUDIO_EVENTS[id],
      i = chooseVariant(e.variants.length, this.last.get(id) ?? -1);
    this.last.set(id, i);
    const b = await this.load(id, i);
    if (generation !== this.generation) return null;
    return this.sound(b, id, i, options);
  }
  loop(key, id, gain = 0.18) {
    const current = this.loops.get(key);
    if (current?.kind === id) {
      if (current.level !== gain) {
        current.level = gain;
        current.gain?.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.025);
      }
      return;
    }
    if (current) this.stopVoice(current);
    this.loops.delete(key);
    if (!id || this.hidden || !this.enabled(AUDIO_EVENTS[id].bus)) return;
    const e = AUDIO_EVENTS[id];
    const index = chooseVariant(e.variants.length, this.last.get(id) ?? -1);
    this.last.set(id, index);
    const token = { kind: id, event: e, level: gain };
    this.loops.set(key, token);
    void this.load(id, index).then((b) => {
      if (this.loops.get(key) !== token) return;
      this.loops.delete(key);
      const v = this.sound(b, id, index, { loop: true, gain: token.level });
      if (v) {
        v.level = token.level;
        this.loops.set(key, v);
        if (key === "environment") this.ambient = v;
      }
    });
  }
  syncAmbient(s, scene, panel, paused = false) {
    if (!this.ctx || this.disposed) return;
    this.syncSettings();
    this.hidden = Boolean(globalThis.document?.hidden);
    this.pan =
      scene === "front"
        ? -this.config.pan
        : scene === "garden"
          ? this.config.pan
          : 0;
    if (this.filter) {
      const cutoff = panel
        ? this.config.panelCutoffHz
        : this.config.openCutoffHz;
      if (cutoff !== this.lastCutoff) {
        this.filter.frequency.setTargetAtTime(
          cutoff,
          this.ctx.currentTime,
          0.08,
        );
        this.lastCutoff = cutoff;
      }
    }
    if (this.hidden) {
      this.stopAll();
      return;
    }
    const hours =
      (balance.clock.morningMinute +
        (s.elapsed || 0) * balance.clock.minutesPerSecond) /
      60;
    this.loop(
      "music",
      hours < 12 ? "morning" : hours < 17 ? "noon" : "evening",
      this.config.musicGain,
    );
    const outside = ["front", "garden"].includes(scene),
      weather = s.forecast?.weather;
    this.environment = outside
      ? weather === "rain"
        ? "rain"
        : weather === "snow"
          ? "snow"
          : hours >= 19
            ? "night"
            : s.forecast?.event === "festival"
              ? "festival"
              : "birds"
      : "room";
    this.loop("environment", this.environment, this.config.environmentGain);
    const hot =
      !paused && (scene === "kitchen" || ["cook", "broth"].includes(panel));
    const boiling =
      s.burners?.some((b) => b.stage === "boiling") ||
      s.brothBatch?.stage === "cooking" ||
      s.curryBatch?.stage === "cooking";
    this.loop(
      "boil",
      hot &&
        (s.burners?.some((b) => ["heating", "boiling"].includes(b.stage)) ||
          s.brothBatch?.stage === "cooking" ||
          s.curryBatch?.stage === "cooking")
        ? "boil"
        : null,
      boiling ? this.config.boilGain : this.config.boilHeatingGain,
    );
    this.loop(
      "fry",
      hot && s.fryer?.some((p) => p?.stage === "frying") ? "fry" : null,
      this.config.fryGain,
    );
    this.loop(
      "whisk",
      !paused && this.whisking ? "whisk" : null,
      this.config.whiskGain,
    );
    const previous = this.lastScene;
    if (scene !== previous) {
      this.lastScene = scene;
      void this.preload(
        scene === "kitchen"
          ? words.groups.kitchen
          : scene === "drinks"
            ? words.groups.drinks
            : scene.startsWith("guests")
              ? words.groups.guests
              : words.groups.ambient,
      );
    }
  }
  music() {
    this.loop("music", "morning", this.config.musicGain);
  }
  setWhisking(active) {
    this.whisking = active;
    this.loop("whisk", active ? "whisk" : null, this.config.whiskGain);
  }
  observeGuests(s, scene, paused) {
    const previous = this.guestAudio || new Map();
    const next = new Map();
    for (const c of s.customers) {
      const before = previous.get(c.id);
      const bucket = Math.floor(
        (s.elapsed || 0) / this.config.eatingCadenceSeconds,
      );
      const visible =
        scene.startsWith("guests") &&
        document.querySelector(`.customer[data-arg="${c.id}"]`);
      if (before && visible && !paused && this.ctx?.state === "running") {
        if (c.status === "eating" && before.status !== "eating")
          void this.play("serve", { gain: this.config.serveGain });
        if (c.status === "eating" && bucket !== before.bucket)
          void this.play(bucket % 2 ? "slurp" : "chew", {
            gain: this.config.eatingGain,
          });
        if (c.settled && !before.settled) {
          if (c.result?.tip)
            void this.play("tip", { gain: this.config.reactionGain });
          void this.play(c.happy ? "ahh" : "sad", {
            gain: this.config.reactionGain,
          });
          void this.play("review", { gain: this.config.eatingGain });
        }
      }
      next.set(c.id, { status: c.status, settled: c.settled, bucket });
    }
    this.guestAudio = next;
  }
  stopAll() {
    this.generation++;
    for (const v of [...this.voices]) this.stopVoice(v);
    this.loops.clear();
  }
  async setHidden(hidden) {
    this.hidden = hidden;
    if (hidden) {
      this.whisking = false;
      this.stopAll();
      this.unlockElement?.pause();
      await this.ctx?.suspend().catch(() => {});
    } else if (this.ctx) {
      try {
        await this.ctx.resume();
      } catch {}
      this.needsTouch = this.ctx.state !== "running";
    }
  }
  stats() {
    return {
      state: this.ctx?.state || "locked",
      unavailable: Boolean(this.unavailable),
      voices: this.voices.size,
      loops: [...this.loops.keys()],
      buffers: this.buffers.size,
      pending: this.loading.size,
      errors: this.errors.length,
      baseLatencyMs: (this.ctx?.baseLatency || 0) * 1000,
      needsTouch: Boolean(this.needsTouch),
      last: this.eventsPlayed.at(-1),
    };
  }
  async dispose() {
    this.disposed = true;
    this.stopAll();
    this.buffers.clear();
    this.unlockElement?.pause();
    this.unlockElement = null;
    await this.ctx?.close();
  }
}
