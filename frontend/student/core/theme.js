export function normalizeTheme(value) {
  return ["light", "dark", "system"].includes(value) ? value : "light";
}

export function resolvedTheme(value, systemDark = false) {
  const mode = normalizeTheme(value);
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function applyTheme(value, documentRef = globalThis.document, matchMediaRef = globalThis.matchMedia) {
  const media = typeof matchMediaRef === "function" ? matchMediaRef("(prefers-color-scheme: dark)") : null;
  const result = resolvedTheme(value, Boolean(media?.matches));
  if (documentRef?.documentElement) documentRef.documentElement.dataset.theme = result;
  return result;
}
