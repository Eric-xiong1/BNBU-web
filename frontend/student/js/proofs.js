// Proof-file rules from 业务流程_学生端.md v6.1 §5.1/§9.7 — pure functions
// (no DOM) so the smoke test can exercise them in Node.
//   Images: JPG / PNG / WebP / HEIC / HEIF, ≤ 8MB each
//   Videos: MP4 / MOV, ≤ 100MB each

export const PROOF_IMAGE_MAX_BYTES = 8_000_000;
export const PROOF_VIDEO_MAX_BYTES = 100_000_000;

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
    types: { "video/mp4": "mp4", "video/quicktime": "mov" },
    extensions: { mp4: "mp4", mov: "mov" },
  },
};

/**
 * Validates a captured file against the v6.1 proof rules.
 * @param {{name?: string, type?: string, size: number}} file
 * @param {"image"|"video"} kind
 * @returns {{ok: true, extension: string} | {ok: false, error: "format"|"size"}}
 */
export function validateProofFile(file, kind) {
  const spec = SPECS[kind];
  const mime = String(file.type || "").toLowerCase();
  const name = String(file.name || "");
  const rawExt = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
  const byType = spec.types[mime];
  const byExt = spec.extensions[rawExt];
  if (!byType && !byExt) return { ok: false, error: "format" };
  if (file.size > spec.maxBytes) return { ok: false, error: "size" };
  return { ok: true, extension: byType || byExt };
}
