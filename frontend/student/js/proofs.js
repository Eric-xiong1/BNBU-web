// Proof-file rules — pure functions (no DOM) so the smoke test can exercise
// them in Node. Aligned with the backend business rules (MEDIA-001/MEDIA-002):
//   Images: JPG / PNG / WebP / HEIC / HEIF, ≤ 8MB each
//   Videos: at most 15 recorded seconds and must carry sound. Container format
//           and file size are device-defined and NOT business limits, so the
//           client only sanity-checks them.

export const PROOF_IMAGE_MAX_BYTES = 8_000_000;
/** Transport sanity ceiling only; the backend sets no business size limit. */
export const PROOF_VIDEO_MAX_BYTES = 200_000_000;
/** Hard business rule: exercise-record video is capped at 15 recorded seconds. */
export const PROOF_VIDEO_MAX_SECONDS = 15;

const SPECS = {
  image: {
    maxBytes: PROOF_IMAGE_MAX_BYTES,
    // MIME type → canonical extension
    types: { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic", "image/heif": "heif" },
    // Extension fallback: mobile browsers may report an empty MIME type for HEIC/HEIF.
    extensions: { jpg: "jpg", jpeg: "jpg", png: "png", webp: "webp", heic: "heic", heif: "heif" },
  },
  video: {
    maxBytes: PROOF_VIDEO_MAX_BYTES,
    // Browsers record to whatever the device supports (webm on desktop Chrome,
    // mp4/mov on iOS). The backend accepts any container, so these only pick a
    // sensible file extension.
    types: { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-matroska": "mkv", "video/3gpp": "3gp" },
    extensions: { mp4: "mp4", mov: "mov", webm: "webm", mkv: "mkv", "3gp": "3gp", m4v: "mp4" },
  },
};

/**
 * Validates a captured file against the proof rules.
 * `durationSeconds` is required to enforce the 15-second video cap; pass it
 * once the browser has read the recording's metadata.
 * @param {{name?: string, type?: string, size: number}} file
 * @param {"image"|"video"} kind
 * @param {{durationSeconds?: number|null}} [facts]
 * @returns {{ok: true, extension: string} | {ok: false, error: "format"|"size"|"duration"}}
 */
export function validateProofFile(file, kind, facts = {}) {
  const spec = SPECS[kind];
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  const rawExt = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const byType = spec.types[mime];
  const byExt = spec.extensions[rawExt];
  // Unknown video containers are still accepted: the device decides the format.
  if (!byType && !byExt && kind === "image") return { ok: false, error: "format" };
  if (file.size > spec.maxBytes) return { ok: false, error: "size" };
  if (kind === "video") {
    const seconds = facts.durationSeconds;
    // Rounded because browsers report fractional durations for a clip the user
    // recorded as exactly 15 seconds.
    if (typeof seconds === "number" && Number.isFinite(seconds) && Math.round(seconds) > PROOF_VIDEO_MAX_SECONDS) {
      return { ok: false, error: "duration" };
    }
  }
  return { ok: true, extension: byType || byExt || (kind === "video" ? "mp4" : "jpg") };
}
