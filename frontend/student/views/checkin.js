import { SPORT_TYPES, STATUS_META } from "../core/constants.js";
import { escapeHtml, formatBytes, formatDate, safeProofUrl } from "../core/utils.js";

const sportLabel = (value) => SPORT_TYPES.find((item) => item.value === value)?.label || value || "自主运动";
const badge = (status) => { const meta = STATUS_META[status] || { tone: "", label: status || "未知" }; return `<span class="badge ${meta.tone ? `badge-${meta.tone}` : ""}">${escapeHtml(meta.label)}</span>`; };

function proofItems(proofs = []) {
  return proofs.map((proof) => ({
    proof,
    url: safeProofUrl(proof),
    isVideo: proof?.mediaType === "video" || String(proof?.mimeType || "").startsWith("video/") || /\.(mp4|mov)$/i.test(String(proof?.url ?? proof ?? "")),
  })).filter((item) => item.url);
}

function proofMedia(item, { detail = false, label = "运动凭证" } = {}) {
  const url = escapeHtml(item.url);
  if (item.isVideo) {
    return `<video src="${url}" ${detail ? "controls" : "muted preload=\"metadata\""} aria-label="${escapeHtml(label)}"></video>${detail ? "" : '<span class="record-thumb-play" aria-hidden="true">▶</span>'}`;
  }
  const image = `<img src="${url}" alt="${escapeHtml(label)}" loading="${detail ? "lazy" : "eager"}">`;
  return detail ? `<a class="proof-preview" href="${url}" target="_blank" rel="noopener">${image}</a>` : image;
}

function renderTasks(tasks, filter = "all") {
  const filters = [["all","全部"],["active","待完成"],["done","已完成"]];
  const visible = tasks.filter((task) => filter === "all" || (filter === "done" ? task.status === "已完成" : task.status !== "已完成"));
  return `<div class="page-stack"><div class="filter-chips" aria-label="任务筛选">${filters.map(([id,label]) => `<button type="button" data-task-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>
    ${visible.length ? `<div class="grid grid-2 task-card-grid">${visible.map((task) => `<article class="card task-card"><div class="card-body page-stack">
    <div style="display:flex;justify-content:space-between;gap:12px"><h2 class="card-title">${escapeHtml(task.title)}</h2>${badge(task.status)}</div>
    <p style="margin:0">${escapeHtml(task.description || "")}</p>
    <div class="page-caption">${escapeHtml(task.courseName || task.courseId || "课程任务")} · ${task.requiredHours || task.hours || 1} 小时 · 截止 ${formatDate(task.deadline)}</div>
    <button class="button button-tonal" type="button" data-action="use-task" data-task-id="${escapeHtml(task.id)}">按此任务打卡</button>
  </div></article>`).join("")}</div>` : '<div class="card"><div class="card-body muted">当前筛选条件下没有任务，可直接提交自主运动打卡。</div></div>'}</div>`;
}

function renderUploads(uploads) {
  if (!uploads.length) return '<div class="upload-empty">尚未选择凭证</div>';
  return `<div class="proof-grid">${uploads.map((item) => `<article class="proof-item">
    <div class="proof-preview">${item.mediaType === "video" ? `<video src="${escapeHtml(item.previewUrl)}" muted controls></video>` : `<img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.file?.name || "运动凭证")}">`}</div>
    <div class="proof-meta"><strong>${escapeHtml(item.file?.name || "凭证")}</strong><span>${formatBytes(item.size)} · ${item.status === "success" ? "上传成功" : item.status === "failed" ? "上传失败" : item.status === "uploading" ? `上传 ${item.progress}%` : "等待上传"}</span></div>
    <div class="progress"><i style="width:${Number(item.progress || 0)}%"></i></div>
    <button class="button button-secondary" type="button" data-action="remove-upload" data-upload-id="${item.id}">删除</button>
  </article>`).join("")}</div>`;
}

function renderSubmit({ draft = {}, uploads = [], selectedTask = null, error = "", busy = false, dailyRemaining = 2, showAllSports = false }) {
  const hours = draft.hours ?? selectedTask?.requiredHours ?? selectedTask?.hours ?? 1;
  const selectedSport = draft.sportType || "";
  const sportOptions = SPORT_TYPES.filter((item) => item.value);
  const visibleSports = showAllSports ? sportOptions : sportOptions.slice(0, 4);
  return `<div class="page-stack">
    ${selectedTask ? `<div class="selected-task-panel"><span class="eyebrow">SELECTED TASK</span><strong>${escapeHtml(selectedTask.title)}</strong><small>课程和任务信息将自动带入本次打卡。</small></div>` : ""}
    ${draft?.savedAt ? `<div class="notice">已恢复 ${formatDate(draft.savedAt)} 保存的草稿。刷新页面后需重新选择本地文件。</div>` : ""}
    ${error ? `<div class="notice" style="color:var(--danger);background:rgba(245,63,63,.08);border-color:rgba(245,63,63,.2)">${escapeHtml(error)}</div>` : ""}
    <form id="checkin-form" class="card checkin-form-card"><div class="card-body page-stack">
      <div><span class="eyebrow">SUBMISSION</span><h2 class="card-title">本次运动</h2><p class="page-caption">今日最多还可申报 ${dailyRemaining} 小时</p></div>
      <div class="field"><span>本次学时</span><div class="hour-stepper"><button type="button" data-hour-step="-0.5" aria-label="减少半小时">−</button><output data-hour-value>${Number(hours)} 小时</output><button type="button" data-hour-step="0.5" aria-label="增加半小时">＋</button><input type="hidden" name="hours" value="${Number(hours)}"></div><small class="page-caption">每次 0.5 小时，单次不超过 ${dailyRemaining} 小时</small></div>
      <div class="field"><span>运动项目（可选）</span><input type="hidden" name="sportType" value="${escapeHtml(selectedSport)}"><div class="sport-selector">
        ${visibleSports.map((item) => `<button class="sport-option ${selectedSport === item.value ? "is-selected" : ""}" type="button" data-sport-type="${item.value}" aria-pressed="${selectedSport === item.value}"><span class="sport-mark">${escapeHtml(item.label.slice(0,1))}</span><strong>${escapeHtml(item.label)}</strong></button>`).join("")}
        ${showAllSports ? `<button class="sport-option ${selectedSport === "other" ? "is-selected" : ""}" type="button" data-sport-type="other" aria-pressed="${selectedSport === "other"}"><span class="sport-mark">其</span><strong>其他</strong></button>` : ""}
      </div><button class="text-action" type="button" data-action="toggle-sports">${showAllSports ? "收起运动项目" : "查看更多运动项目"}</button></div>
      <label class="field custom-sport-field" data-custom-sport ${selectedSport === "other" ? "" : "hidden"}><span>其他运动名称</span><input name="customSport" maxlength="32" value="${escapeHtml(draft.customSport || "")}" placeholder="选择其他时必填"></label>
      <label class="field"><span>补充说明</span><textarea name="description" maxlength="300" placeholder="填写时间、地点和运动内容">${escapeHtml(draft.description || "")}</textarea></label>
      <div class="field"><span>图片 / 视频凭证</span><p class="page-caption">最多 6 张图片（每张 8MB）和 1 个视频（100MB）</p>
        <label class="upload-picker"><input id="proof-picker" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime" multiple><span>＋ 选择或拍摄凭证</span></label>
      </div>
      ${renderUploads(uploads)}
      <div class="action-row"><button class="button button-secondary" type="button" data-action="save-draft">保存草稿</button><button class="button button-secondary" type="button" data-action="clear-draft">清除</button><button class="button button-primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "提交中…" : "提交打卡"}</button></div>
    </div></form>
  </div>`;
}

function renderRecords(records, filter = "all") {
  const filters = [["all","全部"],["pending","待审核"],["approved","已通过"],["attention","需处理"]];
  const visible = records.filter((item) => item.status !== "系统抵扣").filter((item) => {
    if (filter === "pending") return ["待审核","待确认"].includes(item.status);
    if (filter === "approved") return item.status === "已通过";
    if (filter === "attention") return ["已驳回","补材料","需补材料"].includes(item.status);
    return true;
  });
  const cards = visible.length ? `<div class="record-list">${visible.map((record) => {
    const proofs = proofItems(record.proofFiles);
    const label = sportLabel(record.sportType);
    const thumb = proofs.length
      ? `<div class="record-thumb">${proofMedia(proofs[0], { label: `${label}凭证` })}${proofs.length > 1 ? `<span class="proof-count">+${proofs.length - 1}</span>` : ""}</div>`
      : `<div class="record-thumb record-thumb-fallback"><strong>${escapeHtml(label.slice(0, 1))}</strong><span>${escapeHtml(label)}</span></div>`;
    return `<button class="record-card record-card-media" type="button" data-route="record/${escapeHtml(record.id)}">
      ${thumb}<div class="record-copy"><div class="record-card-head"><strong>${escapeHtml(label)}</strong><span>${formatDate(record.submittedAt)}</span></div>
      <div class="record-card-head"><strong>${record.hours}h</strong>${badge(record.status)}</div>
      <p>${escapeHtml(record.description || "")}</p>
      <span class="page-caption">凭证 ${proofs.length} 个${record.reviewComment ? ` · ${escapeHtml(record.reviewComment)}` : ""}</span></div>
    </button>`;
  }).join("")}</div>` : '<div class="card"><div class="card-body muted">当前筛选条件下没有学生自主提交记录。</div></div>';
  return `<div class="page-stack"><div class="filter-chips" aria-label="记录筛选">${filters.map(([id,label]) => `<button type="button" data-record-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>${cards}</div>`;
}

export function renderRecordDetail(record) {
  if (!record) return '<div class="card"><div class="card-body muted">记录不存在。</div></div>';
  const proofs = proofItems(record.proofFiles);
  return `<section class="page-stack"><button class="button button-secondary" data-route="checkin" type="button">← 返回打卡记录</button>
    <div class="card"><div class="card-head"><h1 class="card-title">${escapeHtml(sportLabel(record.sportType))} · ${record.hours} 小时</h1></div><div class="card-body page-stack">
      <div>${badge(record.status)} <span class="page-caption">提交于 ${formatDate(record.submittedAt)}</span></div><p>${escapeHtml(record.description || "")}</p>
      <div class="proof-grid">${proofs.map((proof, index) => `<div class="proof-detail">${proofMedia(proof, { detail: true, label: `${sportLabel(record.sportType)}凭证 ${index + 1}` })}</div>`).join("") || '<div class="upload-empty">该记录没有有效凭证</div>'}</div>
      <div class="notice"><strong>教师反馈</strong><br>${escapeHtml(record.reviewComment || "暂无反馈")}</div>
      ${["已驳回","补材料","需补材料"].includes(record.status) ? `<button class="button button-primary" type="button" data-action="supplement-record" data-record-id="${record.id}">补交材料</button>` : ""}
    </div></div></section>`;
}

export function renderCheckin({ activeTab = "submit", tasks = [], records = [], draft = {}, uploads = [], selectedTask = null, error = "", busy = false, dailyRemaining = 2, taskFilter = "all", recordFilter = "all", showAllSports = false }) {
  draft = draft || {};
  const tabs = [["tasks","任务"],["submit","提交"],["records","记录"]];
  const content = activeTab === "tasks" ? renderTasks(tasks, taskFilter) : activeTab === "records" ? renderRecords(records, recordFilter) : renderSubmit({ draft, uploads, selectedTask, error, busy, dailyRemaining, showAllSports });
  const draftDate = draft?.savedAt || draft?.updatedAt;
  return `<section class="page-stack checkin-page"><header><span class="eyebrow">CHECK-IN</span><h1 class="page-heading">运动打卡</h1><p class="page-caption">任务、提交与审核记录</p></header>
    ${draftDate ? `<div class="draft-resume"><div><span class="eyebrow">本地草稿</span><strong>上次保存于 ${formatDate(draftDate)}</strong><small>本地文件需要重新选择</small></div><button class="button button-tonal" type="button" data-action="restore-draft">恢复草稿</button></div>` : ""}
    <div class="tabs" role="tablist">${tabs.map(([id,label]) => `<button type="button" role="tab" data-checkin-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`).join("")}</div>${content}</section>`;
}
