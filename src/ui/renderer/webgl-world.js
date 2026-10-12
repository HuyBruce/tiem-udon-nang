// Textures come from decoded runtime images. No new animation loop: the 4A
// controller calls paint(), including camera transforms and motion matrices.
export async function createWebGLWorld(canvas, width, height, resolution) {
  const {
    Application,
    Container,
    Graphics,
    Sprite,
    Texture,
    ImageSource,
    CanvasSource,
    Matrix,
    Ticker,
  } = await import("pixi.js");
  const app = new Application();
  await app.init({
    canvas,
    width,
    height,
    resolution,
    autoDensity: true,
    preference: "webgl",
    backgroundAlpha: 0,
    antialias: false,
    autoStart: false,
    sharedTicker: false,
    gcActive: false,
    eventMode: "none",
    eventFeatures: {
      move: false,
      globalMove: false,
      click: false,
      wheel: false,
    },
  });
  app.stop();
  // The renderer scheduler otherwise starts Ticker.system even with autoStart
  // false. This game owns cleanup and paints only from the existing 4A clock.
  app.renderer.scheduler.destroy();
  // HTML owns pointer capture and drop targets. Disable Pixi's event ticker too.
  app.renderer.events.setTargetElement(null);
  const gl = app.renderer.gl,
    debugInfo = gl.getExtension("WEBGL_debug_renderer_info"),
    gpu = debugInfo
      ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : "unavailable";
  const textures = new Map(),
    rooms = new Map();
  function texture(image, filter) {
    const url = image.currentSrc || image.src;
    const key = `${url}:${filter}`;
    let entry = textures.get(key);
    if (!entry) {
      let source;
      if (/\.svg(?:[?#]|$)/i.test(url) || filter !== "none") {
        const raster = document.createElement("canvas");
        raster.width = image.naturalWidth;
        raster.height = image.naturalHeight;
        const context = raster.getContext("2d");
        context.filter = filter;
        context.drawImage(image, 0, 0);
        source = new CanvasSource({ resource: raster });
      } else source = new ImageSource({ resource: image });
      entry = { texture: new Texture({ source }), refs: 0 };
      textures.set(key, entry);
    }
    entry.refs++;
    return { key, entry };
  }
  function rectangleMask(rects) {
    let left = 0,
      top = 0,
      right = width,
      bottom = height;
    for (const r of rects) {
      left = Math.max(left, r.x);
      top = Math.max(top, r.y);
      right = Math.min(right, r.x + r.width);
      bottom = Math.min(bottom, r.y + r.height);
    }
    return new Graphics()
      .rect(left, top, Math.max(0, right - left), Math.max(0, bottom - top))
      .fill(0xffffff);
  }
  function attach(model) {
    const container = new Container(),
      items = [];
    const mask = rectangleMask([]);
    container.addChild(mask);
    container.mask = mask;
    for (const item of model.items) {
      const { key, entry } = texture(item.image, item.filter);
      const sprite = new Sprite(entry.texture);
      const r = item.rect;
      const base = new DOMMatrix()
        .translate(r.x, r.y)
        .scale(r.width / entry.texture.width, r.height / entry.texture.height);
      sprite.setFromMatrix(
        new Matrix(base.a, base.b, base.c, base.d, base.e, base.f),
      );
      sprite.alpha = item.opacity;
      container.addChild(sprite);
      if (
        item.clips.some(
          (c) =>
            item.rect.x < c.x ||
            item.rect.y < c.y ||
            item.rect.x + item.rect.width > c.x + c.width + 0.1 ||
            item.rect.y + item.rect.height > c.y + c.height + 0.1,
        )
      ) {
        const clip = rectangleMask(item.clips);
        container.addChild(clip);
        sprite.mask = clip;
      }
      items.push({ item, sprite, key, base });
    }
    app.stage.addChild(container);
    rooms.set(model, { container, items });
  }
  function release(model) {
    const room = rooms.get(model);
    if (!room) return;
    // Every mask owns its GraphicsContext. Passing only children:true leaves
    // those contexts registered in Pixi's renderer after each room refresh.
    room.container.destroy({ children: true, context: true });
    for (const { key } of room.items) {
      const entry = textures.get(key);
      if (entry) entry.refs--;
    }
    rooms.delete(model);
  }
  function prune() {
    for (const [key, entry] of textures)
      if (entry.refs === 0) {
        entry.texture.destroy(true);
        textures.delete(key);
      }
  }
  return {
    release,
    prune,
    resize(w, h, dpr) {
      width = w;
      height = h;
      app.renderer.resolution = dpr;
      app.renderer.resize(w, h);
    },
    paint(models, visible, offset) {
      const computed = new Map();
      function pose(group) {
        if (!computed.has(group)) {
          const parent = group.parent
            ? pose(group.parent)
            : { matrix: new DOMMatrix(), opacity: 1 };
          computed.set(group, {
            matrix: parent.matrix
              .translate(...group.pivot)
              .multiply(group.matrix)
              .translate(-group.pivot[0], -group.pivot[1]),
            opacity: parent.opacity * group.opacity,
          });
        }
        return computed.get(group);
      }
      for (const model of models.values()) {
        if (!rooms.has(model)) attach(model);
        const room = rooms.get(model);
        room.container.visible = visible.includes(model.room);
        if (!room.container.visible) continue;
        room.container.x = (Number(model.room.dataset.worldX) - offset) * width;
        for (const { item, sprite, base } of room.items) {
          sprite.visible =
            item.el.isConnected && item.el.dataset.sheetStatus !== "ready";
          if (!item.motion.length) continue;
          const combined = pose(item.motion.at(-1));
          const matrix = combined.matrix.multiply(base);
          sprite.setFromMatrix(
            new Matrix(
              matrix.a,
              matrix.b,
              matrix.c,
              matrix.d,
              matrix.e,
              matrix.f,
            ),
          );
          sprite.alpha = item.opacity * combined.opacity;
        }
      }
      prune();
      app.renderer.render(app.stage);
    },
    stats: () => ({
      backend: "webgl",
      gpu,
      textures: textures.size,
      textureBytes: [...textures.values()].reduce(
        (n, e) => n + e.texture.source.width * e.texture.source.height * 4,
        0,
      ),
      tickerStarted: app.ticker.started,
      systemTickerListeners: Ticker.system.count,
      sharedTickerListeners: Ticker.shared.count,
    }),
    dispose() {
      for (const model of [...rooms.keys()]) release(model);
      prune();
      app.destroy(false);
    },
  };
}
