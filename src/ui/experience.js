import { sprite } from "./assets.js";
import { transient, withEffectBatch } from "./motion/effects.js";
export { effectStats, clearEffects } from "./motion/effects.js";
import { capAnimations } from "./motion/animation-budget.js";

// Put feedback above the scene so a state render does not cut it short.
function animateAndRemove(node, frames, options) {
  return transient(node, frames, options, node.className);
}

export function touchFeedback(target) {
  if (
    !target?.matches(
      "[data-act],select[data-work-detail],select[data-work-finish],select[data-work-drink],select[data-work-drink-topping]",
    )
  )
    return;
  const rect = target.getBoundingClientRect();
  const x = rect.x + rect.width / 2,
    y = rect.y + rect.height / 2;
  return withEffectBatch(() => {
    const ripple = document.createElement("div");
    ripple.className = "touch-ripple";
    ripple.setAttribute("aria-hidden", "true");
    ripple.style.left = `${x - 26}px`;
    ripple.style.top = `${y - 26}px`;
    animateAndRemove(
      ripple,
      [
        { transform: "scale(.25)", opacity: 0.9 },
        { transform: "scale(1.6)", opacity: 0 },
      ],
      { duration: 440, easing: "ease-out" },
    );
    for (let i = 0; i < 3; i++) {
      const star = document.createElement("div");
      star.className = "touch-spark";
      star.setAttribute("aria-hidden", "true");
      star.innerHTML = sprite("ui-star");
      star.style.left = `${x - 9}px`;
      star.style.top = `${y - 9}px`;
      const dx = (i - 1) * 35,
        dy = i === 1 ? -52 : -28;
      animateAndRemove(
        star,
        [
          { transform: "translate(0,0) scale(.4)", opacity: 1 },
          {
            transform: `translate(${dx}px,${dy}px) rotate(${(i - 1) * 35}deg) scale(1)`,
            opacity: 0,
          },
        ],
        { duration: 580, easing: "ease-out" },
      );
    }
  });
}

export function moneyFeedback(
  delta,
  anchor = null,
  animated = true,
  emotion = "",
) {
  const wallet = document.querySelector("#money");
  if (!wallet && !anchor) return;
  if (animated && !anchor) {
    wallet.getAnimations().forEach((a) => a.cancel());
    wallet.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.1)", offset: 0.35 },
        { transform: "scale(1)" },
      ],
      {
        duration: 420,
        easing: "ease-out",
      },
    );
  }
  const rect = (anchor || wallet).getBoundingClientRect();
  const label = document.createElement("div");
  label.className = `money-feedback ${delta > 0 ? "gain" : "spend"} ${anchor ? "guest-payment" : ""}`;
  label.setAttribute("aria-hidden", "true");
  label.textContent = `${delta > 0 ? "+" : "−"} ¥${Math.abs(delta).toLocaleString("vi-VN")}${emotion ? " " + emotion : ""}`;
  label.style.left = `${rect.x + rect.width / 2}px`;
  if (!anchor)
    document
      .querySelectorAll(".money-feedback:not(.guest-payment)")
      .forEach((node) => node.remove());
  label.style.top = `${anchor ? rect.y + rect.height * 0.12 : rect.bottom + 28}px`;
  if (!animated) {
    label.style.transform = "translateX(-50%)";
    transient(label, null, { duration: 1800 }, "money");
    return label;
  }
  animateAndRemove(
    label,
    [
      { transform: "translate(-50%, 8px)", opacity: 0 },
      { transform: "translate(-50%, 0)", opacity: 1, offset: 0.2 },
      { transform: "translate(-50%, -18px)", opacity: 0 },
    ],
    { duration: anchor ? 1800 : 1100, easing: "ease-out" },
  );
  return label;
}

export function ingredientFlight(
  imageHTML,
  fromElement,
  targetSelector,
  delay = 0,
) {
  const target =
    typeof targetSelector === "string"
      ? document.querySelector(targetSelector)?.getBoundingClientRect()
      : targetSelector;
  const from = fromElement?.getBoundingClientRect();
  if (!target || !from) return;
  const x = from.x + from.width / 2 - 20,
    y = from.y + from.height / 2 - 20;
  const dx = target.x + target.width / 2 - 20 - x,
    dy = target.y + target.height / 2 - 20 - y;
  const node = document.createElement("div");
  node.className = "ingredient-flight";
  node.innerHTML = imageHTML;
  node.setAttribute("aria-hidden", "true");
  node.style.left = `${x}px`;
  node.style.top = `${y}px`;
  animateAndRemove(
    node,
    [
      { transform: "translate(0,0) scale(.8)", opacity: 0.95 },
      {
        transform: `translate(${dx * 0.5}px,${dy * 0.5 - 28}px) scale(1)`,
        opacity: 1,
        offset: 0.5,
      },
      { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0 },
    ],
    { duration: 560, delay, fill: "backwards", easing: "ease-in-out" },
  );
}

export function objectFeedback(selector, motion = "pop") {
  requestAnimationFrame(() => {
    const node = document.querySelector(selector);
    if (!node) return;
    const frames =
      motion === "whisk"
        ? [
            { transform: "rotate(-5deg)" },
            { transform: "rotate(5deg)" },
            { transform: "rotate(-3deg)" },
            { transform: "rotate(0deg)" },
          ]
        : [
            { transform: "scale(.94)" },
            { transform: "scale(1.055)", offset: 0.45 },
            { transform: "scale(1)" },
          ];
    const art = node.matches("button")
      ? node.querySelector(".sprite,.food-layers") || node
      : node;
    art.getAnimations().forEach((a) => a.cancel());
    art.animate(frames, { duration: 480, easing: "ease-out" });
    capAnimations();
  });
}

export function pourFeedback(selector = ".cook-bowl") {
  const rect = document.querySelector(selector)?.getBoundingClientRect();
  if (!rect) return;
  const stream = document.createElement("div");
  stream.className = "pour-stream";
  stream.innerHTML = sprite("broth-pour-stream");
  stream.style.left = `${rect.x + rect.width * 0.48}px`;
  stream.style.top = `${rect.y + 5}px`;
  stream.setAttribute("aria-hidden", "true");
  animateAndRemove(
    stream,
    [
      { transform: "scaleY(0)", opacity: 0 },
      { transform: "scaleY(1)", opacity: 0.9, offset: 0.25 },
      { transform: "scaleY(1)", opacity: 0 },
    ],
    { duration: 800, easing: "ease-out" },
  );
}

export function servedFeedback(customerId, delighted) {
  requestAnimationFrame(() => {
    const place = document.querySelector(
      `.customer[data-arg="${customerId}"]`,
    )?.parentElement;
    const dish = place?.querySelector(".table-bowl,.combo-served-visual");
    dish?.getAnimations().forEach((a) => a.cancel());
    dish?.animate(
      [
        { transform: "scale(.85)" },
        { transform: "scale(1.06)", offset: 0.55 },
        { transform: "scale(1)" },
      ],
      { duration: 460, easing: "ease-out" },
    );
    capAnimations();
    if (!delighted || !place) return;
    const rect = place.getBoundingClientRect();
    const heart = document.createElement("div");
    heart.className = "meal-heart";
    heart.setAttribute("aria-hidden", "true");
    heart.innerHTML = sprite("ui-heart");
    heart.style.left = `${rect.x + rect.width * 0.6}px`;
    heart.style.top = `${rect.y + rect.height * 0.2}px`;
    animateAndRemove(
      heart,
      [
        { transform: "translateY(8px) scale(.6)", opacity: 0 },
        { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.25 },
        { transform: "translateY(-35px) scale(.8)", opacity: 0 },
      ],
      { duration: 1000, easing: "ease-out" },
    );
  });
}
