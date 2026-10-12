// Included ONLY by the isolated benchmark build, never the ordinary index/PWA.
import * as effects from "../src/ui/experience.js";
import { motionStats } from "../src/ui/motion/controller.js";
window.__gdvEffects = effects;
window.__gdvMotionStats = motionStats;
