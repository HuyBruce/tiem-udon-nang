export function validAnimationAsset(a) {
  return Boolean(
    a?.type === "anim" &&
    /^animations\/[a-z0-9-]+\.webp$/.test(a.file) &&
    Number.isInteger(a.frames) &&
    a.frames >= 2 &&
    a.frames <= 32 &&
    Number.isFinite(a.fps) &&
    a.fps >= 1 &&
    a.fps <= 24 &&
    typeof a.loop === "boolean" &&
    Number.isInteger(a.frameWidth) &&
    a.frameWidth >= 16 &&
    a.frameWidth <= 768 &&
    Number.isInteger(a.frameHeight) &&
    a.frameHeight >= 16 &&
    a.frameHeight <= 768 &&
    typeof a.fallback === "string" &&
    ["planned", "ready"].includes(a.status),
  );
}
export function sheetFrame(a, seconds, moving = true) {
  return moving
    ? Math.min(
        a.frames - 1,
        a.loop
          ? Math.floor(seconds * a.fps) % a.frames
          : Math.floor(seconds * a.fps),
      )
    : 0;
}
export function createSheetPlayer(fallback, asset, load, clock = () => 0) {
  let strip = null,
    window = null,
    cancelled = false,
    loaded = false;
  const startedAt = clock();
  fallback.dataset.sheetStatus = "fallback";
  async function start() {
    if (!validAnimationAsset(asset) || asset.status !== "ready") return;
    try {
      const url = await load(asset.file);
      if (!url || cancelled || !fallback.isConnected) return;
      const image = new Image();
      image.src = url;
      await image.decode();
      if (
        image.naturalWidth !== asset.frameWidth * asset.frames ||
        image.naturalHeight !== asset.frameHeight
      )
        throw new Error("Sheet dimensions");
      if (cancelled || !fallback.isConnected) return;
      const wrapper = document.createElement("span");
      wrapper.className = `${fallback.className} sheet-viewport`;
      wrapper.dataset.sheetMounted = "true";
      wrapper.style.aspectRatio = `${asset.frameWidth}/${asset.frameHeight}`;
      image.className = "sheet-strip";
      image.alt = "";
      image.draggable = false;
      image.style.width = `${asset.frames * 100}%`;
      wrapper.append(image);
      fallback.parentElement.append(wrapper);
      strip = image;
      window = wrapper;
      loaded = true;
      fallback.dataset.sheetStatus = "ready";
      fallback.style.opacity = "0";
    } catch {
      fallback.dataset.sheetStatus = "error";
    }
  }
  start();
  return {
    paint(seconds, moving) {
      if (!loaded) return;
      fallback.style.opacity = "0";
      const frame = sheetFrame(asset, Math.max(0, seconds - startedAt), moving);
      window.dataset.frame = String(frame);
      strip.style.transform = `translateX(${(-frame * 100) / asset.frames}%)`;
    },
    destroy() {
      cancelled = true;
      window?.remove();
      fallback.style.opacity = "";
      fallback.dataset.sheetStatus = "fallback";
    },
    get loaded() {
      return loaded;
    },
  };
}
