import { SPORT_TYPES, STATUS_META } from "../core/constants.js";
import { escapeHtml, formatBytes, formatDate, safeProofUrl } from "../core/utils.js";

const sportLabel = (value) => SPORT_TYPES.find((item) => item.value === value)?.label || value || "自主运动";
const badge = (status) => { const meta = STATUS_META[status] || { tone: "", label: status || "未知" }; return `<span class="badge ${meta.tone ? `badge-${meta.tone}` : ""}">${escapeHtml(meta.label)}</span>`; };

function renderTasks(tasks) {
  if (!tasks.length) return '<div class="card"><div class="card-body muted">当前没有待完成任务，可直接提交自主运动打卡。</div></div>';
  return `<div class="grid grid-2">${tasks.map((task) => `<article class="card"><div class="card-body page-stack" style="gap:10px">
    <div style="display:flex;justify-content:space-between;gap:12px"><h2 class="card-title">${escapeHtml(task.title)}</h2>${badge(task.status)}</div>
    <p style="margin:0">${escapeHtml(task.description || "")}</p>
    <div class="page-caption">${escapeHtml(task.courseName || task.courseId || "课程任务")} · ${task.requiredHours || task.hours || 1} 小时 · 截止 ${formatDate(task.deadline)}</div>
    <button class="button button-primary" type="button" data-action="use-task" data-task-id="${escapeHtml(task.id)}">按此任务打卡</button>
  </div></article>`).join("")}</div>`;
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

function renderSubmit({ draft = {}, uploads = [], selectedTask = null, error = "", busy = false, dailyRemaining = 2 }) {
  const hours = draft.hours ?? selectedTask?.requiredHours ?? selectedTask?.hours ?? 1;
  return `<div class="page-stack">
    ${selectedTask ? `<div class="notice">已选择任务：${escapeHtml(selectedTask.title)}，课程和任务信息将自动带入。</div>` : ""}
    ${draft?.savedAt ? `<div class="notice">已恢复 ${formatDate(draft.savedAt)} 保存的草稿。刷新页面后需重新选择本地文件。</div>` : ""}
    ${error ? `<div class="notice" style="color:var(--danger);background:rgba(245,63,63,.08);border-color:rgba(245,63,63,.2)">${escapeHtml(error)}</div>` : ""}
    <form id="checkin-form" class="card"><div class="card-body page-stack">
      <div><h2 class="card-title">本次运动</h2><p class="page-caption">今日最多还可申报 ${dailyRemaining} 小时</p></div>
      <label class="field"><span>本次学时</span><select name="hours">${[0.5,1,1.5,2].map((value) => `<option value="${value}" ${Number(hours) === value ? "selected" : ""}>${value} 小时</option>`).join("")}</select></label>
      <label class="field"><span>运动项目（可选）</span><select name="sportType">${SPORT_TYPES.map((item) => `<option value="${item.value}" ${draft.sportType === item.value ? "selected" : ""}>${item.label}</option>`).join("")}</select></label>
      <label class="field" data-custom-sport><span>其他运动名称</span><input name="customSport" maxlength="32" value="${escapeHtml(draft.customSport || "")}" placeholder="选择其他时必填"></label>
      <label class="field"><span>补充说明</span><textarea name="description" maxlength="300" placeholder="填写时间、地点和运动内容">${escapeHtml(draft.description || "")}</textarea></label>
      <div class="field"><span>图片 / 视频凭证</span><p class="page-caption">最多 6 张图片（每张 8MB）和 1 个视频（100MB）</p>
        <label class="upload-picker"><input id="proof-picker" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime" multiple><span>＋ 选择或拍摄凭证</span></label>
      </div>
      ${renderUploads(uploads)}
      <div class="action-row"><button class="button button-secondary" type="button" data-action="save-draft">保存草稿</button><button class="button button-secondary" type="button" data-action="clear-draft">清除</button><button class="button button-primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "提交中…" : "提交打卡"}</button></div>
    </div></form>
  </div>`;
}

function renderRecords(records) {
  const visible = records.filter((item) => item.status !== "系统抵扣");
  if (!visible.length) return '<div class="card"><div class="card-body muted">还没有学生自主提交记录。</div></div>';
  return `<div class="record-list">${visible.map((record) => `<button class="record-card" type="button" data-route="record/${escapeHtml(record.id)}">
    <div><strong>${escapeHtml(sportLabel(record.sportType))}</strong><span>${formatDate(record.submittedAt)}</span></div>
    <div><strong>${record.hours}h</strong>${badge(record.status)}</div>
    <p>${escapeHtml(record.description || "")}</p>
    <span class="page-caption">凭证 ${record.proofFiles?.length || 0} 个${record.reviewComment ? ` · ${escapeHtml(record.reviewComment)}` : ""}</span>
  </button>`).join("")}</div>`;
}

export function renderRecordDetail(record) {
  if (!record) return '<div class="card"><div class="card-body muted">记录不存在。</div></div>';
  return `<section class="page-stack"><button class="button button-secondary" data-route="checkin" type="button">← 返回打卡记录</button>
    <div class="card"><div class="card-head"><h1 class="card-title">${escapeHtml(sportLabel(record.sportType))} · ${record.hours} 小时</h1></div><div class="card-body page-stack">
      <div>${badge(record.status)} <span class="page-caption">提交于 ${formatDate(record.submittedAt)}</span></div><p>${escapeHtml(record.description || "")}</p>
      <div class="proof-grid">${(record.proofFiles || []).map((proof) => { const url = safeProofUrl(proof); return url ? `<a class="proof-preview" href="${url}" target="_blank" rel="noopener"><span>查看凭证</span></a>` : ""; }).join("")}</div>
      <div class="notice"><strong>教师反馈</strong><br>${escapeHtml(record.reviewComment || "暂无反馈")}</div>
      ${["已驳回","补材料","需补材料"].includes(record.status) ? `<button class="button button-primary" type="button" data-action="supplement-record" data-record-id="${record.id}">补交材料</button>` : ""}
    </div></div></section>`;
}

export function renderCheckin({ activeTab = "submit", tasks = [], records = [], draft = {}, uploads = [], selectedTask = null, error = "", busy = false, dailyRemaining = 2 }) {
  const tabs = [["tasks","任务"],["submit","提交"],["records","记录"]];
  const content = activeTab === "tasks" ? renderTasks(tasks) : activeTab === "records" ? renderRecords(records) : renderSubmit({ draft, uploads, selectedTask, error, busy, dailyRemaining });
  return `<section class="page-stack"><header><h1 class="page-heading">运动打卡</h1><p class="page-caption">打卡优先 · 任务、提交与审核记录</p></header>
    <div class="tabs" role="tablist">${tabs.map(([id,label]) => `<button type="button" role="tab" data-checkin-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`).join("")}</div>${content}</section>`;
}
