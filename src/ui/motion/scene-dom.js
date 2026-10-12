// Reconcile the current scene in place. Actor/plant/sheet nodes keep their identity.
const key = (node) =>
  node.nodeType === 1
    ? node.getAttribute("data-motion-key") ||
      node.id ||
      (node.hasAttribute("data-seat") ? `seat:${node.dataset.seat}` : null)
    : null;
function same(a, b) {
  return (
    a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b)
  );
}
function sync(a, b) {
  if (a.nodeType !== 1) {
    if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue;
    return;
  }
  // A mounted sheet owns its viewport, not the template's fallback markup.
  const sheet = a.hasAttribute("data-sheet-mounted");
  // Camera owns the continuous world; chrome renders cannot replace its actors.
  if (a.hasAttribute("data-world-owned")) return;
  // Template poses use engine samples; keep the interpolated pose while a panel covers it.
  const pose = [...a.style]
    .filter(
      (name) =>
        (name !== "--guest-height" &&
          /^--(?:guest-|meal-|drink-)/.test(name)) ||
        ((a.hasAttribute("data-motion-actor") ||
          a.hasAttribute("data-motion-env") ||
          a.matches(".customer > .sprite")) &&
          ["transform", "transform-origin", "opacity"].includes(name)),
    )
    .map((name) => [name, a.style.getPropertyValue(name)]);
  for (const attr of [...a.attributes])
    if (
      !b.hasAttribute(attr.name) &&
      !attr.name.startsWith("data-sheet-") &&
      !(
        a.classList.contains("world-camera") &&
        /^data-(camera-|visible-rooms)/.test(attr.name)
      )
    )
      a.removeAttribute(attr.name);
  for (const attr of b.attributes)
    if (a.getAttribute(attr.name) !== attr.value)
      a.setAttribute(attr.name, attr.value);
  for (const [name, value] of pose) a.style.setProperty(name, value);
  if (sheet) return;
  const existing = [...a.childNodes].filter(
      (n) => !n.hasAttribute?.("data-sheet-mounted"),
    ),
    used = new Set();
  let previous = null;
  for (const fresh of [...b.childNodes]) {
    const id = key(fresh);
    const old =
      existing.find(
        (n) =>
          !used.has(n) && same(n, fresh) && (id || n === existing[used.size]),
      ) || existing.find((n) => !used.has(n) && same(n, fresh));
    const node = old || fresh;
    if (old) {
      used.add(old);
      sync(old, fresh);
    }
    const next = previous ? previous.nextSibling : a.firstChild;
    if (next !== node) a.insertBefore(node, next);
    previous = node;
  }
  for (const old of existing) if (!used.has(old)) old.remove();
}
export function renderScene(app, html) {
  const template = document.createElement("template");
  template.innerHTML = html;
  const oldGame = app.querySelector(".game.live-v2"),
    freshGame = template.content.querySelector(".game.live-v2");
  if (!oldGame || !freshGame) {
    app.replaceChildren(template.content);
    return;
  }
  const oldStage = oldGame.querySelector(".stage"),
    freshStage = freshGame.querySelector(".stage");
  const oldScene = oldStage?.className
    .split(" ")
    .find((c) => /^(front|guests[0-3]|kitchen|drinks|storage|garden)$/.test(c));
  const newScene = freshStage?.className
    .split(" ")
    .find((c) => /^(front|guests[0-3]|kitchen|drinks|storage|garden)$/.test(c));
  // Keep .game and .stage connected during same-scene renders, including open panels.
  if (oldScene !== newScene && !oldStage?.classList.contains("world-camera")) {
    app.replaceChildren(template.content);
    return;
  }
  sync(oldGame, freshGame);
  const oldOutside = [...app.childNodes].filter((n) => n !== oldGame);
  for (const n of oldOutside) n.remove();
  for (const n of [...template.content.childNodes])
    if (n !== freshGame) app.append(n);
}
export { sync as reconcileNode };
