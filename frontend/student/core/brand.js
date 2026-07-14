import { icon } from "./icons.js";

export function brandMark({ className = "", decorative = false } = {}) {
  const accessibility = decorative ? 'alt="" aria-hidden="true"' : 'alt="BNBU 校徽"';
  return `<span class="brand-mark ${className}">${icon("home", "brand-mark-fallback")}<img class="brand-mark-image" src="./assets/bnbu-emblem.svg" ${accessibility}></span>`;
}
