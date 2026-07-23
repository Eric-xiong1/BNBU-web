import { uploadLimits, DESC_MAX } from "./constants.js";
import { uid } from "./utils.js";

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const videoTypes = new Set(["video/mp4", "video/quicktime"]);

export function validateProofSelection(files) {
  const list = Array.from(files || []);
  const images = list.filter((file) => imageTypes.has(file.type));
  const videos = list.filter((file) => videoTypes.has(file.type));
  const errors = [];
  if (images.length > uploadLimits.images) errors.push(`最多 6 张图片，当前选择 ${images.length} 张`);
  if (videos.length > uploadLimits.videos) errors.push(`最多 1 个视频，当前选择 ${videos.length} 个`);
  for (const file of list) {
    if (!imageTypes.has(file.type) && !videoTypes.has(file.type)) errors.push(`${file.name || "文件"} 格式不支持`);
    if (imageTypes.has(file.type) && file.size > uploadLimits.imageBytes) errors.push(`${file.name || "图片"} 超过 8MB`);
    if (videoTypes.has(file.type) && file.size > uploadLimits.videoBytes) errors.push(`${file.name || "视频"} 超过 100MB`);
  }
  return { valid: errors.length === 0, errors, images: images.length, videos: videos.length };
}

// Validated when the student starts an exercise session (before the timer).
export function validateSessionStart({ creditType, courseId, sportType, customSport }) {
  const errors = [];
  if (!creditType) errors.push("请选择服务类别");
  if (creditType === "课程相关" && !courseId) errors.push("请选择本学期在读的体育课程");
  if (!sportType) errors.push("请选择运动项目");
  if (sportType === "other" && !String(customSport || "").trim()) errors.push("请填写自定义运动名称");
  if (String(customSport || "").length > 32) errors.push("自定义运动名称最多 32 个字符");
  return [...new Set(errors)];
}

// Validated when submitting after the session ends: description is optional but
// capped, at least one proof captured. Earned hours come from the session, not
// a manual field.
export function validateSubmission({ description, files }) {
  const errors = [];
  if (String(description || "").trim().length > DESC_MAX) errors.push(`运动说明最多 ${DESC_MAX} 个字符`);
  if (!files?.length) errors.push("请至少提交 1 个运动凭证");
  errors.push(...validateProofSelection((files || []).map((item) => item.file || item)).errors);
  return [...new Set(errors)];
}

export function createUploadItems(files, createObjectURL = globalThis.URL?.createObjectURL?.bind(globalThis.URL)) {
  return Array.from(files || []).map((file) => ({
    id: uid("upload"), file, previewUrl: createObjectURL ? createObjectURL(file) : "",
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    mimeType: file.type, size: file.size, status: "waiting", progress: 0,
  }));
}

export function releaseUpload(item, revokeObjectURL = globalThis.URL?.revokeObjectURL?.bind(globalThis.URL)) {
  if (item?.previewUrl?.startsWith("blob:") && revokeObjectURL) revokeObjectURL(item.previewUrl);
}
