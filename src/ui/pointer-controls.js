// Shared pointer handling preserves the existing scene swipe and detail-panel gestures.
import { textVi } from "../i18n.js";
import { createDragGhost } from "./drag-ghost.js";
export function bindPointerControls(app, host) {
  let gesture = null,
    ghost = null,
    blockClickUntil = 0,
    suppressPointerClick = false;
  const {
    handle,
    canAnimate,
    cutLine,
    advanceHandmade,
    advanceDrink,
    notify,
    navigate,
    render,
    ui,
    servedFeedback,
  } = host;
  app.addEventListener("pointerdown", (e) => {
    blockClickUntil = 0;
    suppressPointerClick = false;
    if (e.button !== 0 || e.target.closest("input,select")) return;
    const drag = e.target.closest("[data-drag]"),
      chop = e.target.closest("[data-chop]"),
      wash = e.target.closest("[data-wash]"),
      craft = e.target.closest("[data-craft]"),
      stage = e.target.closest("#stage"),
      navigation = e.target.closest(".scene-pagination"),
      interactive = e.target.closest(
        "button,a,[data-act],[data-drop],input,select,textarea,[role=button]",
      ),
      cameraOrigin =
        !drag &&
        !chop &&
        !wash &&
        !craft &&
        (navigation || (stage && !interactive && !ui.panel));
    if (
      !drag &&
      !chop &&
      !wash &&
      !craft &&
      !stage &&
      !e.target.closest("[data-act]")
    )
      return;
    gesture = {
      x: e.clientX,
      y: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      id: e.pointerId,
      drag: drag?.dataset.drag,
      element: drag || craft || chop || wash,
      clickTarget: e.target.closest("[data-act],[data-cut]"),
      chop: !!chop,
      board: chop?.getBoundingClientRect(),
      wash: !!wash,
      craft: craft?.dataset.craft,
      points: [[e.clientX, e.clientY]],
      samples: [[e.clientX, e.timeStamp]],
      swipe: !!cameraOrigin,
      cameraStarted: false,
      moved: false,
    };
    if (drag || chop || wash || craft) {
      e.preventDefault();
      app.setPointerCapture(e.pointerId);
    }
  });
  app.addEventListener("pointermove", (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture,
      dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (Math.hypot(dx, dy) > 9) g.moved = true;
    if (
      g.swipe &&
      g.moved &&
      !g.cameraStarted &&
      Math.abs(dx) > Math.abs(dy) * 1.3
    ) {
      host.camera.begin();
      host.swipeSound?.();
      g.cameraStarted = true;
      app.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
    if (g.cameraStarted) host.camera.drag(dx);
    if (g.craft === "whisk" && g.moved && !g.whiskSound) {
      g.whiskSound = true;
      host.whiskSound?.(true);
    }
    g.samples.push([e.clientX, e.timeStamp]);
    while (g.samples.length > 2 && g.samples[1][1] < e.timeStamp - 100)
      g.samples.shift();
    g.points.push([e.clientX, e.clientY]);
    g.lastX = e.clientX;
    g.lastY = e.clientY;
    if (g.drag && g.moved) {
      if (!ghost) {
        const game = document.querySelector(".game");
        if (game)
          game.dataset.dragFood = String(
            /^(dish:|bowl:|pot:|fryer:|prepared:|drink$)/.test(g.drag),
          );
        const picked = createDragGhost(g.element);
        ghost = picked.ghost;
        g.ghostX = Math.max(
          0,
          Math.min(picked.rect.width, g.x - picked.rect.left),
        );
        g.ghostY = Math.max(
          0,
          Math.min(picked.rect.height, g.y - picked.rect.top),
        );
      }
      ghost.style.transform = `translate3d(${e.clientX - g.ghostX}px,${e.clientY - g.ghostY}px,0)`;
      host.camera.edge(e.clientX);
    }
    if (g.drag || g.chop || g.wash || g.craft) e.preventDefault();
  });
  function endGesture(e, cancel = false) {
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    if (g.whiskSound) host.whiskSound?.(false);
    if (g.cameraStarted) {
      const [x, t] = g.samples[0];
      const elapsed = e.timeStamp - t;
      host.camera.release(
        cancel,
        elapsed > 0 && elapsed < 180 ? ((e.clientX - x) / elapsed) * 1000 : 0,
      );
    }
    if (cancel && g.drag) host.camera.finishCarry();
    ghost?.remove();
    ghost = null;
    // Read the target while the food-only trash is still visible.
    const pointTarget =
      !cancel && g.drag
        ? document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-drop]")
        : null;
    delete document.querySelector(".game")?.dataset.dragFood;
    if (app.hasPointerCapture(e.pointerId))
      app.releasePointerCapture(e.pointerId);
    if (cancel) {
      blockClickUntil = performance.now() + 350;
      suppressPointerClick = true;
      host.work.reset();
      render();
      return;
    }
    const dx = e.clientX - g.x,
      dy = e.clientY - g.y;
    if (!g.moved) {
      if (!g.clickTarget) host.work.invalidTap(g.element);
      if (g.drag || g.chop || g.wash || e.pointerType === "touch") {
        blockClickUntil = performance.now() + 350;
        suppressPointerClick = true;
        const target = g.clickTarget;
        if (target?.dataset.cut !== undefined)
          cutLine(Number(target.dataset.cut), 1);
        else if (target?.dataset.act)
          handle(target.dataset.act, target.dataset.arg, target);
      }
      return;
    }
    blockClickUntil = performance.now() + 350;
    suppressPointerClick = true;
    if (g.craft) {
      const length = g.points
        .slice(1)
        .reduce(
          (n, p, i) =>
            n + Math.hypot(p[0] - g.points[i][0], p[1] - g.points[i][1]),
          0,
        );
      const xs = g.points.map((p) => p[0]),
        ys = g.points.map((p) => p[1]);
      const circular =
        Math.max(...xs) - Math.min(...xs) > 35 &&
        Math.max(...ys) - Math.min(...ys) > 35 &&
        Math.hypot(dx, dy) < 65;
      if (
        g.element?.hasAttribute("data-direct-craft") &&
        length > 90 &&
        (g.craft !== "whisk" || circular)
      )
        host.work.craft(g.craft, g.element);
      else if (g.craft === "handmade" && length > 70) advanceHandmade();
      else if (length > 90 && (g.craft !== "whisk" || circular))
        advanceDrink(g.craft, document.querySelector(".drink-gesture"), 1);
      else
        notify(
          g.craft === "whisk"
            ? textVi("t_a8e19731c498")
            : textVi("t_16f499494838"),
        );
    } else if (g.drag) {
      let target = pointTarget;
      // The empty worktop lets pot taps through, but remains a valid drop zone.
      const worktop = document.querySelector(
        '.work-vessel[data-drop="worktop"]',
      );
      if (g.drag.startsWith("pot:") && worktop) {
        const r = worktop.getBoundingClientRect();
        if (
          e.clientX >= r.left &&
          e.clientX <= r.right &&
          e.clientY >= r.top &&
          e.clientY <= r.bottom
        )
          target = worktop;
      }
      const drop = target?.dataset.drop,
        room = target?.closest("[data-world-room]")?.dataset.worldRoom;
      if (room) ui.scene = room;
      if (host.work.drop(g.drag, drop, g.element)) {
      } else if (g.drag === "noodles" && drop?.startsWith("pot:"))
        host.getEngine().noodles(Number(drop.split(":")[1]));
      else if (g.drag.startsWith("bowl:") && drop === "tray")
        host.getEngine().tray(Number(g.drag.split(":")[1]));
      else if (g.drag.startsWith("dish:") && drop?.startsWith("customer:")) {
        if (host.getEngine().serve(g.drag.slice(5), drop.slice(9))) {
          ui.selectedDish = null;
          const c = host
            .getEngine()
            .s.customers.find((customer) => customer.id === drop.slice(9));
          if (canAnimate())
            servedFeedback(c.id, c.result?.correct && c.result.score >= 85);
        }
        render();
      } else notify(textVi("t_0a5204f4d6ca"));
      host.camera.finishCarry(room);
    } else if (g.chop) {
      const r = g.board,
        x = (((g.x + e.clientX) / 2 - r.left) / r.width) * 100,
        i = Math.round((x - 25) / 25);
      if (i >= 0 && i < 3 && Math.abs(dy) > 25 && Math.abs(dx) < r.width * 0.23)
        g.element?.hasAttribute("data-direct-chop")
          ? host.work.chop(
              Math.abs(x - (25 + i * 25)) < 12 ? 1 : 0.5,
              g.element,
            )
          : cutLine(i, Math.abs(x - (25 + i * 25)) < 12 ? 1 : 0.5);
      else if (g.element?.hasAttribute("data-direct-chop"))
        notify("Vuốt dao từ trên xuống trên thớt, hoặc chạm thớt để thái.");
    } else if (g.wash && Math.hypot(dx, dy) > 25) {
      host.work.wash(g.element);
    }
  }
  app.addEventListener("pointerup", (e) => endGesture(e));
  app.addEventListener("pointercancel", (e) => endGesture(e, true));
  app.addEventListener("lostpointercapture", (e) => {
    // Touch starts with implicit capture on its button. Transferring that capture
    // to the app during a camera swipe must not cancel the active gesture.
    if (e.target === app && !app.hasPointerCapture(e.pointerId))
      endGesture(e, true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gesture) endGesture({ pointerId: gesture.id }, true);
  });
  return {
    active: () => !!gesture,
    ignoreClick(e) {
      if (suppressPointerClick && e.detail !== 0) {
        suppressPointerClick = false;
        return true;
      }
      return performance.now() < blockClickUntil;
    },
  };
}
