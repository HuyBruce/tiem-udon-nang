// Safari's visual viewport changes as its address bar moves. Pin game height to
// CSS pixels at scale one; input zoom is prevented by viewport metadata.
export function observeViewport(changed) {
  let height = 0,
    width = 0;
  function update() {
    const viewport = window.visualViewport;
    const nextHeight = Math.round(viewport?.height || window.innerHeight);
    const nextWidth = Math.round(viewport?.width || window.innerWidth);
    if (viewport?.scale && Math.abs(viewport.scale - 1) > 0.01) return;
    if (nextHeight === height && nextWidth === width) return;
    height = nextHeight;
    width = nextWidth;
    document.documentElement.style.setProperty(
      "--viewport-height",
      `${height}px`,
    );
    changed?.();
  }
  update();
  window.addEventListener("resize", update);
  window.visualViewport?.addEventListener("resize", update);
  return () => {
    window.removeEventListener("resize", update);
    window.visualViewport?.removeEventListener("resize", update);
  };
}
