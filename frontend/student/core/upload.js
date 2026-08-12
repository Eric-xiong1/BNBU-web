import { uploadLimits } from "./constants.js";
import { uid } from "./utils.js";

const imageTypes = new Set(["image/jpeg", "image/png"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/3gpp"]);

export function validateProofSelection(files) {
  const list = Array.from(files || []);
  const filesOnly = list.map((item) => item.file || item);
  const images = filesOnly.filter((file) => imageTypes.has(file.type));
  const videos = filesOnly.filter((file) => videoTypes.has(file.type));
  const errors = [];
  if (images.length > uploadLimits.images) errors.push(`最多 6 张图片，当前选择 ${images.length} 张`);
  if (videos.length > uploadLimits.videos) errors.push(`最多 1 个视频，当前选择 ${videos.length} 个`);
  for (let index = 0; index < filesOnly.length; index += 1) {
    const file = filesOnly[index];
    const item = list[index];
    if (!imageTypes.has(file.type) && !videoTypes.has(file.type)) errors.push(`${file.name || "文件"} 格式不支持`);
    if (imageTypes.has(file.type) && file.size > uploadLimits.imageBytes) errors.push(`${file.name || "图片"} 超过 10MB`);
    if (videoTypes.has(file.type) && (!Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0 || item.durationSeconds > uploadLimits.videoDurationSeconds)) {
      errors.push(`${file.name || "视频"} 必须是最长 15 秒的有声现场录像`);
    }
    if (item.source !== "camera") errors.push(`${file.name || "凭证"} 不是本次现场拍摄，不能上传`);
  }
  return { valid: errors.length === 0, errors, images: images.length, videos: videos.length };
}

export function validateCheckin({ durationSeconds, creditType = "GENERAL", sportType, customSport, description, files }) {
  const errors = [];
  if (Number(durationSeconds) < 3600) errors.push("运动不足 1 小时，不能创建有效打卡记录");
  if (Number(durationSeconds) > 7200) errors.push("单次运动不能超过 2 小时");
  if (!sportType) errors.push("请选择运动项目");
  if (String(sportType).toUpperCase() === "OTHER" && !String(customSport || "").trim()) errors.push("请填写自定义运动名称");
  if (String(customSport || "").length > 100) errors.push("自定义运动名称最多 100 个字符");
  const length = String(description || "").trim().length;
  if (String(creditType).toUpperCase() === "GENERAL" && length < 1) errors.push("自主运动必须填写运动说明");
  if (length > 200) errors.push("运动说明最多 200 个字符");
  if (!files?.length) errors.push("请至少保留 1 个现场凭证");
  errors.push(...validateProofSelection(files || []).errors);
  return [...new Set(errors)];
}

export function createUploadItems(files, createObjectURL = globalThis.URL?.createObjectURL?.bind(globalThis.URL), metadata = {}) {
  return Array.from(files || []).map((file) => ({
    id: uid("upload"), file, previewUrl: createObjectURL ? createObjectURL(file) : "",
    mediaType: file.type.startsWith("video/") ? "video" : "image",
    mimeType: file.type, size: file.size, source: "camera", durationSeconds: metadata.durationSeconds ?? null,
    status: "waiting", progress: 0,
  }));
}

export function validateExemptionProofSelection(files) {
  const list = Array.from(files || []).map((item) => item.file || item);
  const errors = [];
  if (list.length > 20) errors.push("证明文件最多 20 个");
  for (const file of list) {
    if (!imageTypes.has(file.type)) errors.push(`${file.name || "证明文件"} 格式不支持`);
    if (file.size < 1) errors.push(`${file.name || "证明文件"} 不能为空`);
    if (imageTypes.has(file.type) && file.size > uploadLimits.imageBytes) errors.push(`${file.name || "证明文件"} 超过 10MB`);
  }
  return { valid: errors.length === 0, errors };
}

export function releaseUpload(item, revokeObjectURL = globalThis.URL?.revokeObjectURL?.bind(globalThis.URL)) {
  if (item?.previewUrl?.startsWith("blob:") && revokeObjectURL) revokeObjectURL(item.previewUrl);
}
