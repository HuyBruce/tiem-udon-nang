import { textVi } from "../i18n.js";
import { migrateState } from "./migration.js";
import { newState } from "./state.js";
import { validState } from "./validation.js";
export const SAVE_KEY = "udon-nang-v1";
// A provider implements load(accountId), save(accountId, envelope). No native account API assumptions.
export class SaveService {
  constructor(storage = null, cloudProvider = null) {
    try {
      this.storage = storage || globalThis.localStorage;
    } catch {
      this.storage = null;
    }
    this.cloud = cloudProvider;
    this.error = null;
  }
  load() {
    for (const key of [SAVE_KEY, SAVE_KEY + "-backup"])
      try {
        const raw = this.storage.getItem(key);
        if (!raw) continue;
        const state = migrateState(JSON.parse(raw).state);
        if (!validState(state)) {
          this.error = textVi("t_eaa7c22386f1");
          continue;
        }
        const base = newState();
        return {
          ...base,
          ...state,
          settings: { ...base.settings, ...state.settings },
          staffOptions: { ...base.staffOptions, ...state.staffOptions },
        };
      } catch {
        this.error = textVi("t_2452645af3bd");
      }
    return null;
  }
  save(state) {
    try {
      if (!validState(state)) throw new Error("Invalid state");
      const previous = this.storage.getItem(SAVE_KEY);
      if (previous) {
        try {
          if (validState(JSON.parse(previous).state))
            this.storage.setItem(SAVE_KEY + "-backup", previous);
        } catch {
          /* Keep the last known-good backup if the primary is corrupt. */
        }
      }
      this.storage.setItem(
        SAVE_KEY,
        JSON.stringify({ updatedAt: Date.now(), state }),
      );
      this.error = null;
      return true;
    } catch {
      this.error = textVi("t_3d617cc3b34f");
      return false;
    }
  }
  async sync(accountId, state) {
    if (!this.cloud) throw new Error(textVi("t_1fc8144ec574"));
    return this.cloud.save(accountId, { updatedAt: Date.now(), state });
  }
  reset() {
    try {
      this.storage.removeItem(SAVE_KEY);
      this.storage.removeItem(SAVE_KEY + "-backup");
    } catch {
      this.error = textVi("t_c94c24935bff");
    }
  }
}
