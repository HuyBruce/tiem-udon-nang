let timer, current;
export function dialogueMotion(element, settings, animated) {
  clearInterval(timer);
  if (!element) {
    current = null;
    return;
  }
  const text = element.textContent;
  if (settings.dialogue !== "slow" || !animated) {
    current = null;
    return;
  }
  if (current?.text !== text)
    current = { text, started: performance.now(), complete: false };
  const session = current;
  element.style.minHeight = `${element.getBoundingClientRect().height}px`;
  element.style.animation = "none";
  element.setAttribute("aria-label", text);
  element.setAttribute("tabindex", "0");
  const finish = () => {
    session.complete = true;
    element.textContent = text;
    clearInterval(timer);
  };
  const update = () => {
    if (!element.isConnected) {
      clearInterval(timer);
      return;
    }
    const count = session.complete
      ? text.length
      : Math.floor((performance.now() - session.started) / 35);
    element.textContent = text.slice(0, count);
    if (count >= text.length) finish();
  };
  // Opening a touch panel can retarget the remaining click to this new node.
  // A fresh pointerdown identifies an intentional tap on the dialogue itself.
  element.addEventListener("pointerdown", finish);
  element.addEventListener("click", (e) => {
    if (e.detail === 0) finish();
  });
  element.addEventListener("keydown", (e) => {
    if (["Enter", " "].includes(e.key)) {
      e.preventDefault();
      finish();
    }
  });
  update();
  if (!session.complete) timer = setInterval(update, 35);
}
