import {
  clampOffset,
  nearestRoom,
  visibleRooms,
  snapEase,
  edgeSpeed,
  swipeTarget,
} from "./model.js";
import { reconcileNode } from "../motion/scene-dom.js";

// No RAF here. Camera, actors and sheets are advanced by the motion controller.
export function createWorldCamera(host) {
  const rooms = new Map();
  const revisions = new Map();
  let ids = [],
    viewport = null,
    strip = null,
    offset = 0,
    transition = null,
    dragging = false,
    dragStart = 0,
    dragDelta = 0,
    dragPending = false,
    edge = 0,
    dwell = 0,
    updating = false,
    shown = "",
    width = 0,
    initialized = false;
  let visibilityCache = null,
    localBounds = new WeakMap(),
    overlayBounds = new WeakMap(),
    frameBounds = null,
    dotsDirty = true,
    dotId = "";
  const nodes = () =>
    visibleRooms(offset, ids.length)
      .map((i) => rooms.get(ids[i]))
      .filter(Boolean);
  function refresh(id, force = false) {
    const revision = host.revision?.();
    if (
      !force &&
      revision !== undefined &&
      rooms.has(id) &&
      revisions.get(id) === revision
    )
      return rooms.get(id);
    const fresh = document.createElement("div");
    fresh.className = `world-room ${id}`;
    fresh.dataset.worldRoom = id;
    fresh.dataset.motionKey = `room:${id}`;
    fresh.setAttribute("aria-label", host.label(id));
    fresh.innerHTML = host.room(id);
    // The existing room art also fills the status/home-indicator regions.
    // Actors and hit areas remain inside the safe scene-world rectangle.
    const background = fresh
      .querySelector(".scene-background")
      ?.getAttribute("src");
    if (background) fresh.style.backgroundImage = `url("${background}")`;
    let node = rooms.get(id);
    // Refreshing one room cannot change another room's local coordinates.
    // Retained nodes in the refreshed room still require fresh measurements.
    if (node)
      for (const el of [node, ...node.querySelectorAll("*")])
        localBounds.delete(el);
    if (node) reconcileNode(node, fresh);
    else {
      node = fresh;
      rooms.set(id, node);
    }
    node.style.left = `${ids.indexOf(id) * 100}%`;
    node.dataset.worldX = String(ids.indexOf(id));
    revisions.set(id, revision);
    return node;
  }
  function apply(refreshVisible = false) {
    if (!viewport || updating || !ids.length) return false;
    updating = true;
    visibilityCache = null;
    const wanted = visibleRooms(offset, ids.length).map((i) => ids[i]);
    const visibleKey = wanted.join(",");
    let changed = shown !== visibleKey;
    const id = ids[nearestRoom(offset, ids.length)];
    // Pagination buttons have fixed outer dimensions. Read their scroll target
    // before room mounting, chrome replacement and camera transform writes.
    const buttons =
      dotsDirty || dotId !== id
        ? [...document.querySelectorAll(".scene-pagination [data-act=goto]")]
        : null;
    const selectedButton = buttons?.find((b) => b.dataset.arg === id);
    let navScroll = null;
    if (selectedButton) {
      const nav = selectedButton.parentElement;
      const left = selectedButton.offsetLeft,
        right = left + selectedButton.offsetWidth;
      const scroll = nav.scrollLeft,
        viewportRight = scroll + nav.clientWidth;
      if (left < scroll) navScroll = { nav, left };
      else if (right > viewportRight)
        navScroll = { nav, left: right - nav.clientWidth };
    }
    // The same one/two mounted rooms need no repeated DOM bookkeeping between
    // boundaries. Explicit render/resize still refreshes their live state.
    if (changed || refreshVisible)
      for (const id of wanted) {
        const node =
          refreshVisible || !rooms.get(id)?.isConnected
            ? refresh(id, refreshVisible)
            : rooms.get(id);
        if (!node.isConnected) {
          strip.append(node);
          changed = true;
        }
        if (node.dataset.worldVisible !== "true")
          node.dataset.worldVisible = "true";
      }
    if (changed || refreshVisible) {
      for (const node of [...strip.children])
        if (!wanted.includes(node.dataset.worldRoom)) node.remove();
    }
    strip.style.transform = `translate3d(${-offset * width}px,0,0)`;
    viewport.dataset.cameraOffset = offset.toFixed(6);
    const cameraState = dragging
      ? "dragging"
      : edge
        ? "carrying"
        : transition
          ? "snapping"
          : "idle";
    if (viewport.dataset.cameraState !== cameraState)
      viewport.dataset.cameraState = cameraState;
    if (viewport.dataset.visibleRooms !== visibleKey)
      viewport.dataset.visibleRooms = visibleKey;
    shown = visibleKey;
    if (host.selected() !== id) {
      // Chrome reconciliation can reuse bench/tray nodes with different sizes.
      overlayBounds = new WeakMap();
      host.changed(id);
      changed = true;
    }
    // The bench follows its room; update only its composited transform. An
    // inherited variable on .game invalidated styles across every visible room
    // on each camera frame, especially expensive at DPR3 / CPU throttling.
    const bench = viewport.parentElement.querySelector(".direct-workbench");
    if (bench)
      bench.style.transform = `translate3d(${(nearestRoom(offset, ids.length) - offset) * width}px,0,0)`;
    if (buttons)
      for (const b of buttons) {
        const selected = b.dataset.arg === id;
        b.classList.toggle("active", selected);
        b.setAttribute("aria-current", selected ? "page" : "false");
      }
    if (navScroll) navScroll.nav.scrollLeft = navScroll.left;
    dotsDirty = false;
    dotId = id;
    updating = false;
    return changed;
  }
  function reconcile() {
    const next = document.querySelector("#stage.world-camera");
    if (!next) {
      viewport = null;
      strip = null;
      initialized = false;
      return;
    }
    const nextIds = host.scenes().map((x) => x.id);
    const oldId = ids[nearestRoom(offset, Math.max(1, ids.length))];
    if (next !== viewport) {
      viewport = next;
      strip = next.querySelector(".world-strip[data-world-owned]");
      initialized = false;
      shown = "";
    }
    width = viewport.clientWidth;
    frameBounds = null;
    localBounds = new WeakMap();
    overlayBounds = new WeakMap();
    dotsDirty = true;
    if (ids.join(",") !== nextIds.join(",")) {
      const shift = nextIds.indexOf(oldId) - ids.indexOf(oldId);
      if (initialized && nextIds.includes(oldId)) {
        offset += shift;
        dragStart += shift;
        if (transition) {
          const targetId = ids[nearestRoom(transition.to, ids.length)];
          transition.from += shift;
          transition.to = nextIds.includes(targetId)
            ? nextIds.indexOf(targetId)
            : clampOffset(transition.to + shift, nextIds.length);
        }
      }
      ids = nextIds;
      for (const [id, node] of rooms)
        if (!ids.includes(id)) {
          node.remove();
          rooms.delete(id);
          revisions.delete(id);
        }
      for (const [id, node] of rooms)
        node.style.left = `${ids.indexOf(id) * 100}%`;
    }
    if (!initialized) {
      offset = Math.max(0, ids.indexOf(host.selected()));
      transition = null;
      edge = 0;
      dragging = false;
      initialized = true;
    }
    offset = clampOffset(offset, ids.length);
    apply(!host.pointerActive());
    // Warm neighboring art without connecting hidden actors or starting their loops.
    for (const i of [Math.floor(offset) - 1, Math.ceil(offset) + 1])
      if (ids[i] && !rooms.has(ids[i])) refresh(ids[i]);
  }
  function toIndex(index, instant = false) {
    index = clampOffset(index, ids.length);
    edge = 0;
    dwell = 0;
    dragging = false;
    dragPending = false;
    if (instant || !host.moving() || Math.abs(offset - index) < 1e-6) {
      transition = null;
      offset = index;
      const changed = apply();
      host.visibleChanged(changed);
      return;
    }
    transition = { from: offset, to: index, elapsed: 0, duration: 0.36 };
    apply();
    host.wake();
  }
  const resize = new ResizeObserver(() => {
    if (viewport) width = viewport.clientWidth;
    frameBounds = null;
    localBounds = new WeakMap();
    overlayBounds = new WeakMap();
    const changed = apply(true);
    host.visibleChanged(changed);
  });
  function step(dt, moving) {
    if (!viewport || host.blocked()) return false;
    if (dragging && dragPending) {
      dragPending = false;
      offset = clampOffset(dragStart + dragDelta, ids.length);
      return apply();
    }
    if (!edge && !transition) return false;
    if (edge) {
      if (moving) offset = clampOffset(offset + edge * dt, ids.length);
      else {
        dwell += dt;
        if (dwell >= 0.65) {
          offset = clampOffset(
            nearestRoom(offset, ids.length) + Math.sign(edge),
            ids.length,
          );
          dwell = 0;
        }
      }
    } else if (transition) {
      if (!moving) {
        offset = transition.to;
        transition = null;
      } else {
        transition.elapsed += dt;
        const p = Math.min(1, transition.elapsed / transition.duration);
        offset =
          transition.from + (transition.to - transition.from) * snapEase(p);
        if (p >= 1) {
          offset = transition.to;
          transition = null;
        }
      }
    }
    return apply();
  }
  return {
    reconcile() {
      reconcile();
      if (viewport) resize.observe(viewport);
    },
    step,
    go(id, instant = false) {
      const i = ids.indexOf(id);
      if (i >= 0) toIndex(i, instant);
    },
    begin() {
      if (host.blocked() || !viewport) return;
      transition = null;
      edge = 0;
      dragging = true;
      dragStart = offset;
      dragDelta = 0;
      apply();
      host.wake();
    },
    drag(dx) {
      if (!dragging) return;
      dragDelta = -dx / width;
      if (host.moving()) {
        // Consume the latest pointer position once on the shared motion RAF.
        dragPending = true;
      }
    },
    release(cancel = false, velocity = 0) {
      if (!dragging) return;
      toIndex(
        cancel
          ? nearestRoom(offset, ids.length)
          : swipeTarget(dragStart, dragDelta, -velocity / width, ids.length),
      );
    },
    edge(x) {
      if (host.blocked() || !viewport) return;
      const v = edgeSpeed(x, viewport.getBoundingClientRect());
      if (v !== edge) dwell = 0;
      edge = v;
      if (edge) {
        transition = null;
        host.wake();
      }
      apply();
    },
    finishCarry(id) {
      edge = 0;
      dwell = 0;
      toIndex(
        id && ids.includes(id)
          ? ids.indexOf(id)
          : nearestRoom(offset, ids.length),
      );
    },
    active: () => Boolean(transition || edge || dragPending),
    dragging: () => dragging,
    roots: () => (viewport ? nodes() : null),
    dimensions: () => ({
      width,
      height: frameBounds?.height || viewport?.clientHeight || 0,
    }),
    contains(el) {
      if (visibilityCache?.has(el)) return visibilityCache.get(el);
      if (!viewport || !el?.isConnected) return false;
      const a = el.getBoundingClientRect(),
        frame = viewport.getBoundingClientRect(),
        room = el.closest("[data-world-room]")?.getBoundingClientRect(),
        b = room
          ? {
              left: Math.max(frame.left, room.left),
              right: Math.min(frame.right, room.right),
              top: Math.max(frame.top, room.top),
              bottom: Math.min(frame.bottom, room.bottom),
            }
          : frame;
      return (
        a.right > b.left &&
        a.left < b.right &&
        a.bottom > b.top &&
        a.top < b.bottom
      );
    },
    prepareVisibility(elements) {
      // One read phase before actor/environment transform writes. Live hitboxes
      // still use native elementFromPoint; only presentation visibility is cached.
      const map = new Map(),
        roomRects = new Map();
      if (!viewport) {
        visibilityCache = map;
        return;
      }
      const frame = (frameBounds ||= viewport.getBoundingClientRect());
      for (const el of elements) {
        if (map.has(el)) continue;
        if (!el.isConnected) {
          map.set(el, false);
          continue;
        }
        const room = el.closest("[data-world-room]");
        let r, a;
        if (room) {
          const x = (Number(room.dataset.worldX) - offset) * width;
          r = {
            left: frame.left + x,
            right: frame.left + x + width,
            top: frame.top,
            bottom: frame.bottom,
          };
          let local = localBounds.get(el);
          if (!local) {
            if (!roomRects.has(room))
              roomRects.set(room, room.getBoundingClientRect());
            const origin = roomRects.get(room),
              measured = el.getBoundingClientRect();
            local = {
              left: measured.left - origin.left,
              right: measured.right - origin.left,
              top: measured.top - origin.top,
              bottom: measured.bottom - origin.top,
            };
            localBounds.set(el, local);
          }
          a = {
            left: r.left + local.left,
            right: r.left + local.right,
            top: r.top + local.top,
            bottom: r.top + local.bottom,
          };
        } else {
          // Tray geometry is fixed until reconcile/resize; the workbench follows
          // its world origin. Reading their steam rects after every transform
          // write forces synchronous style/layout work during camera travel.
          const bench = el.closest(".direct-workbench");
          const shift = bench
            ? (nearestRoom(offset, ids.length) - offset) * width
            : 0;
          let local = overlayBounds.get(el);
          if (!local) {
            const measured = el.getBoundingClientRect();
            local = {
              left: measured.left - frame.left - shift,
              right: measured.right - frame.left - shift,
              top: measured.top - frame.top,
              bottom: measured.bottom - frame.top,
            };
            overlayBounds.set(el, local);
          }
          a = {
            left: frame.left + local.left + shift,
            right: frame.left + local.right + shift,
            top: frame.top + local.top,
            bottom: frame.top + local.bottom,
          };
        }
        const b = r
          ? {
              left: Math.max(frame.left, r.left),
              right: Math.min(frame.right, r.right),
              top: Math.max(frame.top, r.top),
              bottom: Math.min(frame.bottom, r.bottom),
            }
          : frame;
        map.set(
          el,
          a.right > b.left &&
            a.left < b.right &&
            a.bottom > b.top &&
            a.top < b.bottom,
        );
      }
      visibilityCache = map;
    },
    stats: () => ({
      offset,
      visible: shown.split(",").filter(Boolean),
      cached: rooms.size,
      state: viewport?.dataset.cameraState,
    }),
    dispose() {
      resize.disconnect();
      rooms.clear();
      revisions.clear();
      viewport = null;
      strip = null;
      transition = null;
    },
  };
}
