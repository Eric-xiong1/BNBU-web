export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[char]);
}

export function safeProofUrl(value) {
  const url = String(value?.url ?? value ?? "");
  if (/^blob:/i.test(url)) return url;
  if (/^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|heic|heif|mp4|mov)$/i.test(url)) return url;
  return "";
}

export function formatDate(value, options = {}) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", ...options }).format(date);
}

export function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
