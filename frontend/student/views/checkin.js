import { SPORT_TYPES, STATUS_META } from "../core/constants.js";
import { escapeHtml, formatBytes, formatDate } from "../core/utils.js";

const statusLabels = {
  DRAFT: "草稿", SUBMITTED: "待审核", VALID: "已通过", INVALID: "已驳回", CANCELLED: "已取消",
  IN_PROGRESS: "运动中", PAUSED: "已暂停", COMPLETED: "已结束",
};
const sportLabels = Object.fromEntries(SPORT_TYPES.map((item) => [item.value.toUpperCase(), item.label]));
const statusLabel = (value) => statusLabels[value] || value || "待确认";
const sportLabel = (value, name) => name || sportLabels[String(value || "").toUpperCase()] || value || "运动";

function badge(value) {
  const label = statusLabel(value);
  const meta = STATUS_META[label] || { tone: "", label };
  return `<span class="badge ${meta.tone ? `badge-${meta.tone}` : ""}">${escapeHtml(meta.label)}</span>`;
}

function renderTasks(tasks, filter = "all") {
  const visible = tasks.filter((task) => filter === "all" || (filter === "done" ? task.status === "已完成" : task.status !== "已完成"));
  return `<div class="page-stack"><div class="filter-chips" aria-label="任务筛选">${[["all","全部"],["active","待完成"],["done","已完成"]].map(([id,label]) => `<button type="button" data-task-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>${visible.length ? `<div class="grid grid-2 task-card-grid">${visible.map((task) => `<article class="card task-card"><div class="card-body page-stack"><div class="section-row"><h2 class="card-title">${escapeHtml(task.title)}</h2>${badge(task.status)}</div><p>${escapeHtml(task.description || "")}</p><div class="page-caption">${escapeHtml(task.courseName || "课程任务")} · 截止 ${formatDate(task.deadline)}</div><button class="button button-tonal" type="button" data-action="use-task" data-task-id="${escapeHtml(task.id)}">开始课程运动</button></div></article>`).join("")}</div>` : '<div class="card"><div class="card-body muted">当前没有可开始的课程任务，也可发起自主运动。</div></div>'}</div>`;
}

function renderUploads(uploads, busy) {
  if (!uploads.length) return '<div class="upload-empty">尚未保留现场凭证</div>';
  return `<div class="proof-grid">${uploads.map((item) => `<article class="proof-item"><div class="proof-preview">${item.mediaType === "video" ? `<video src="${escapeHtml(item.previewUrl)}" muted controls playsinline></video>` : `<img src="${escapeHtml(item.previewUrl)}" alt="现场运动凭证">`}</div><div class="proof-meta"><strong>${item.mediaType === "video" ? `有声视频 · ${Number(item.durationSeconds || 0).toFixed(1)} 秒` : "现场照片"}</strong><span>${formatBytes(item.size)} · ${item.status === "success" ? "Backend 已确认" : item.status === "failed" ? "上传失败，可安全重试" : item.status === "uploading" ? `上传 ${item.progress}%` : "本地草稿"}</span></div><div class="progress"><i style="width:${Number(item.progress || 0)}%"></i></div><button class="button button-secondary" type="button" data-action="remove-upload" data-upload-id="${escapeHtml(item.id)}" ${busy ? "disabled" : ""}>删除 / 重拍</button></article>`).join("")}</div>`;
}

function cameraPanel({ cameraOpen, recording, canRecordVideo }) {
  if (!cameraOpen) return `<div class="action-row"><button class="button button-secondary" type="button" data-action="open-camera" data-capture-kind="photo">现场拍照</button><button class="button button-secondary" type="button" data-action="open-camera" data-capture-kind="video" ${canRecordVideo ? "" : "disabled"}>录制 15 秒有声视频</button></div>${canRecordVideo ? "" : '<p class="page-caption">当前浏览器不能直接生成 Backend 支持的 MP4/MOV/3GP 有声视频，请使用现场照片；不允许从相册导入。</p>'}`;
  return `<div class="camera-panel"><video id="evidence-camera" autoplay muted playsinline></video><div class="camera-status" role="status">${recording ? "正在录制有声视频，15 秒后自动停止…" : "现场相机已就绪"}</div><div class="action-row">${recording ? '<button class="button button-danger" type="button" data-action="stop-video-recording">结束录像</button>' : '<button class="button button-primary" type="button" data-action="capture-photo">拍摄照片</button><button class="button button-primary" type="button" data-action="start-video-recording">开始录像</button>'}<button class="button button-secondary" type="button" data-action="close-camera">关闭相机</button></div></div>`;
}

function renderIdle({ enrollments, courses, draft, selectedTask, error, busy }) {
  const selectedCredit = selectedTask ? "COURSE_RELATED" : (draft.creditType || "GENERAL");
  const descriptionRequired = selectedCredit === "GENERAL";
  const enrollmentId = selectedTask?.enrollmentId || draft.enrollmentId || enrollments[0]?.id || "";
  const selectedSport = selectedTask?.sportType || draft.sportType || "";
  return `<div class="page-stack">${error ? `<div class="notice auth-error">${escapeHtml(error)}</div>` : ""}<form id="exercise-start-form" class="card"><div class="card-body page-stack"><div><span class="eyebrow">SERVER SESSION</span><h2 class="card-title">开始本次运动</h2><p class="page-caption">计时与有效时长以 Backend 为准；不足 1 小时不会创建有效打卡。</p></div><label class="field"><span>打卡类别</span><select name="creditType"><option value="GENERAL" ${selectedCredit === "GENERAL" ? "selected" : ""}>自主运动</option><option value="COURSE_RELATED" ${selectedCredit === "COURSE_RELATED" ? "selected" : ""}>课程运动</option></select></label><label class="field"><span>所属教学班</span><select name="enrollmentId" required>${enrollments.map((item) => { const course = courses.find((value) => value.enrollmentId === item.id); return `<option value="${escapeHtml(item.id)}" ${item.id === enrollmentId ? "selected" : ""}>${escapeHtml(course?.name || item.classSectionId)}</option>`; }).join("")}</select></label><label class="field"><span>运动项目</span><select name="sportType" required><option value="">请选择</option>${SPORT_TYPES.filter((item) => item.value).map((item) => `<option value="${item.value.toUpperCase()}" ${selectedSport.toUpperCase() === item.value.toUpperCase() ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label><label class="field"><span>其他运动名称</span><input name="sportName" maxlength="100" value="${escapeHtml(draft.sportName || "")}" placeholder="仅选择“其他”时填写"></label><label class="field"><span>运动说明</span><textarea name="description" maxlength="200" ${descriptionRequired ? "required" : ""} placeholder="${descriptionRequired ? "自主运动必须填写，最多 200 字" : "课程运动可选，最多 200 字"}">${escapeHtml(draft.description || "")}</textarea><small>自主运动必填；课程运动可选；最多 200 个字符。</small></label><button class="button button-primary button-block" ${busy || !enrollments.length ? "disabled" : ""}>${busy ? "正在连接 Backend…" : enrollments.length ? "开始运动" : "请先加入课程"}</button></div></form></div>`;
}

function renderSession({ session, elapsedSeconds, uploads, error, busy, cameraOpen, recording, canRecordVideo }) {
  const status = session.status;
  const completed = status === "COMPLETED";
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor(elapsedSeconds % 3600 / 60);
  const seconds = Math.floor(elapsedSeconds % 60);
  const descriptionRequired = session.creditType !== "COURSE_RELATED";
  return `<div class="page-stack">${error ? `<div class="notice auth-error">${escapeHtml(error)}</div>` : ""}<section class="card session-card"><div class="card-body page-stack"><div class="section-row"><div><span class="eyebrow">BACKEND AUTHORITATIVE</span><h2 class="card-title">${escapeHtml(statusLabel(status))}</h2></div>${badge(status)}</div><output class="session-timer" aria-live="off">${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}</output><p class="page-caption">服务端有效运动 ${Math.floor(Number(session.actualDurationSeconds || 0) / 60)} 分钟 · 版本 ${session.version}</p><div class="action-row">${status === "IN_PROGRESS" ? '<button class="button button-secondary" data-session-action="pause">暂停</button><button class="button button-danger" data-session-action="finish">结束运动</button>' : status === "PAUSED" ? '<button class="button button-primary" data-session-action="resume">继续运动</button><button class="button button-danger" data-session-action="finish">结束运动</button>' : ""}${completed ? "" : `<button class="button button-secondary" data-session-action="cancel" ${busy ? "disabled" : ""}>放弃本次运动</button>`}</div></div></section>${completed ? `<section class="card"><div class="card-head"><h2 class="card-title">现场凭证</h2></div><div class="card-body page-stack"><p class="page-caption">结束后仍可补拍；保留的照片和最长 15 秒有声视频会全部上传，不支持相册旧素材。</p>${cameraPanel({ cameraOpen, recording, canRecordVideo })}${renderUploads(uploads, busy)}</div></section><form id="exercise-submit-form" class="card"><div class="card-body page-stack"><label class="field"><span>运动说明</span><textarea name="description" maxlength="200" ${descriptionRequired ? "required" : ""} placeholder="${descriptionRequired ? "自主运动必须填写，最多 200 字" : "课程运动可选，最多 200 字"}">${escapeHtml(session.description || "")}</textarea><small>自主运动必填；课程运动可选；最多 200 个字符。</small></label><button class="button button-primary button-block" ${busy ? "disabled" : ""}>${busy ? "上传与提交中…" : `提交全部 ${uploads.length} 个凭证`}</button></div></form>` : `<section class="card"><div class="card-body"><p class="page-caption">运动过程中可以现场拍摄凭证，结束运动后仍可补拍和重拍。</p>${cameraPanel({ cameraOpen, recording, canRecordVideo })}${renderUploads(uploads, busy)}</div></section>`}</div>`;
}

function renderRecords(records, filter = "all") {
  const visible = records.filter((item) => {
    if (filter === "pending") return item.status === "SUBMITTED";
    if (filter === "approved") return item.currentReview?.result === "VALID";
    if (filter === "attention") return item.currentReview?.result === "INVALID";
    return true;
  });
  return `<div class="page-stack"><div class="filter-chips">${[["all","全部"],["pending","待审核"],["approved","已通过"],["attention","需处理"]].map(([id,label]) => `<button type="button" data-record-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>${visible.length ? `<div class="record-list">${visible.map((record) => `<button class="record-card" type="button" data-route="record/${escapeHtml(record.id)}"><div class="record-copy"><div class="record-card-head"><strong>${escapeHtml(sportLabel(record.sportType, record.sportName))}</strong><span>${formatDate(record.submittedAt || record.businessDate)}</span></div><div class="record-card-head"><strong>${(Number(record.creditedDurationSeconds || record.actualDurationSeconds || 0) / 3600).toFixed(1)}h</strong>${badge(record.currentReview?.result || record.status)}</div><p>${escapeHtml(record.description || "")}</p></div></button>`).join("")}</div>` : '<div class="card"><div class="card-body muted">当前筛选条件下没有记录。</div></div>'}</div>`;
}

export function renderRecordDetail(record) {
  if (!record) return '<div class="card"><div class="card-body muted">记录不存在。</div></div>';
  return `<section class="page-stack"><button class="button button-secondary" data-route="checkin">← 返回打卡记录</button><div class="card"><div class="card-head"><h1 class="card-title">${escapeHtml(sportLabel(record.sportType, record.sportName))}</h1></div><div class="card-body page-stack"><div>${badge(record.currentReview?.result || record.status)} <span class="page-caption">${formatDate(record.submittedAt || record.businessDate)}</span></div><div class="detail-facts"><div><span>服务端实际时长</span><strong>${Math.round(Number(record.actualDurationSeconds || 0) / 60)} 分钟</strong></div><div><span>有效时长</span><strong>${Math.round(Number(record.creditedDurationSeconds || 0) / 60)} 分钟</strong></div><div><span>运动说明</span><strong>${escapeHtml(record.description)}</strong></div></div><div class="notice"><strong>教师反馈</strong><br>${escapeHtml(record.currentReview?.publicComment || "暂无反馈")}</div></div></div></section>`;
}

export function renderCheckin({ activeTab = "submit", tasks = [], records = [], draft = {}, uploads = [], selectedTask = null, error = "", busy = false, taskFilter = "all", recordFilter = "all", session = null, elapsedSeconds = 0, enrollments = [], courses = [], cameraOpen = false, recording = false, canRecordVideo = false }) {
  const content = activeTab === "tasks" ? renderTasks(tasks, taskFilter) : activeTab === "records" ? renderRecords(records, recordFilter) : session ? renderSession({ session, elapsedSeconds, uploads, error, busy, cameraOpen, recording, canRecordVideo }) : renderIdle({ enrollments, courses, draft: draft || {}, selectedTask, error, busy });
  return `<section class="page-stack checkin-page"><header><span class="eyebrow">CHECK-IN</span><h1 class="page-heading">运动打卡</h1><p class="page-caption">现场运动、服务端计时与全部凭证提交</p></header><div class="tabs" role="tablist">${[["tasks","任务"],["submit","运动"],["records","记录"]].map(([id,label]) => `<button type="button" role="tab" data-checkin-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`).join("")}</div>${content}</section>`;
}
