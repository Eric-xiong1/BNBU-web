import { STORAGE_KEY } from "./constants.js";
import { clone } from "./utils.js";

const persistedKeys = ["session", "mode", "draft", "records", "notifications", "exemptions", "settings"];

export function createStore({ storage = globalThis.localStorage, initial }) {
  let state = clone(initial);
  const listeners = new Set();
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      for (const key of persistedKeys) if (key in saved) state[key] = saved[key];
    }
  } catch { /* ignore corrupt local state */ }

  const persist = () => {
    if (!storage) return;
    const snapshot = {};
    for (const key of persistedKeys) snapshot[key] = state[key];
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  };
  const emit = () => listeners.forEach((listener) => listener(state));

  return {
    getState: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    patch(update) { state = { ...state, ...(typeof update === "function" ? update(state) : update) }; persist(); emit(); return state; },
    saveDraft(draft) { state = { ...state, draft: { ...state.draft, ...draft, savedAt: new Date().toISOString() } }; persist(); emit(); },
    clearDraft() { state = { ...state, draft: null }; persist(); emit(); },
    persistSession(session, mode = "real") { state = { ...state, session, mode }; persist(); emit(); },
    clearSession() { state = { ...state, session: null, mode: "real" }; persist(); emit(); },
    reset(nextInitial = initial) { state = clone(nextInitial); storage?.removeItem(STORAGE_KEY); emit(); },
  };
}
