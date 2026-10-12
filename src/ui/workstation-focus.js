// Presentation only. No timing, stock or score is changed here.
export function workstationFocus(state, scene, pot = 0, selected = null) {
  if (scene === 'drinks') return 'cup';
  if (scene !== 'kitchen') return null;
  if (state.pots[pot]?.lifted) return 'bowl';
  if (['broth', 'fryer', 'board', 'sink'].includes(selected)) return selected;
  return 'pot';
}
