import { uploadLimits } from "./constants.js";
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

export function validateCheckin({ hours, sportType, customSport, description, files, dailyRemaining = 2 }) {
  const errors = [];
  const numericHours = Number(hours);
  if (!Number.isFinite(numericHours) || numericHours < 0.5 || numericHours > 2) errors.push("本次学时须在 0.5–2 小时之间");
  if (numericHours > Number(dailyRemaining)) errors.push(`今日最多还可申报 ${dailyRemaining} 小时`);
  if (sportType === "other" && !String(customSport || "").trim()) errors.push("请填写自定义运动名称");
  if (String(customSport || "").length > 32) errors.push("自定义运动名称最多 32 个字符");
  const length = String(description || "").trim().length;
  if (length < 5 || length > 300) errors.push("补充说明须为 5–300 个字符");
  if (!files?.length) errors.push("请至少上传 1 个有效凭证");
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
