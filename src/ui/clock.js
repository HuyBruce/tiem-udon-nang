import { clockText, gameMinutes } from "../systems/time.js";
import { assetUrl } from "./assets.js";

export function clockFace(s) {
  const m = gameMinutes(s);
  return `<span class="analog-clock" role="img" aria-label="${clockText(s)}" style="background-image:url('${assetUrl("ui-clock-face")}')"><span class="clock-hour" style="transform:rotate(${m / 2}deg)"></span><span class="clock-minute" style="transform:rotate(${m * 6}deg)"></span><span class="clock-pivot"></span></span>`;
}
