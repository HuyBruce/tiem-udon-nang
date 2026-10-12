import { textVi } from "../i18n.js";
import { SIDES } from "../data.js";

// Older saves keep a boolean side; those orders always meant tempura.
export const sideId = (part) =>
  part?.side ? part.sideKind || "tempura" : null;
export const sideName = (part) =>
  SIDES[sideId(part)]?.name || textVi("t_bc2b97d69a94");
export const sidePrice = (part) => SIDES[sideId(part)]?.price || 0;
export const availableSides = (day) =>
  Object.keys(SIDES).filter((id) => day >= SIDES[id].availableFromDay);
