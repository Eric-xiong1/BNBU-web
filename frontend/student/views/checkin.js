import { SPORT_TYPES, RECORD_STATUS_META, isCountedStatus, DESC_MAX, SESSION } from "../core/constants.js";
import { escapeHtml, formatBytes, formatDate, safeProofUrl } from "../core/utils.js";
import { formatTimer, sessionElapsedMs, earnedHoursFromActiveMs } from "../core/session.js";

const sportLabel = (value, custom = "") => value === "other"
  ? (custom || "其他运动")
  : (SPORT_TYPES.find((item) => item.value === value)?.label || value || "自主运动");
const creditLabel = (value) => value === "课程相关" ? "课程相关运动" : "自主其他运动";

function statusBadge(status) {
  const meta = RECORD_STATUS_META[status] || (isCountedStatus(status) ? RECORD_STATUS_META["有效"] : RECORD_STATUS_META["无效"]);
  return `<span class="badge ${meta.tone ? `badge-${meta.tone}` : ""}">${escapeHtml(meta.label)}</span>`;
}

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

function renderUploads(uploads, { removable = true } = {}) {
  if (!uploads.length) return '<div class="upload-empty">尚未拍摄或选择凭证</div>';
  return `<div class="proof-grid">${uploads.map((item) => `<article class="proof-item">
    <div class="proof-preview">${item.mediaType === "video" ? `<video src="${escapeHtml(item.previewUrl)}" muted controls></video>` : `<img src="${escapeHtml(item.previewUrl)}" alt="${escapeHtml(item.file?.name || "运动凭证")}">`}</div>
    <div class="proof-meta"><strong>${escapeHtml(item.file?.name || "凭证")}</strong><span>${formatBytes(item.size)} · ${item.status === "success" ? "上传成功" : item.status === "failed" ? "上传失败" : item.status === "uploading" ? `上传 ${item.progress}%` : "已就绪"}</span></div>
    <div class="progress"><i style="width:${Number(item.progress || 0)}%"></i></div>
    ${removable ? `<button class="button button-secondary" type="button" data-action="remove-upload" data-upload-id="${item.id}">删除</button>` : ""}
  </article>`).join("")}</div>`;
}

function proofPicker(id, hint = "＋ 拍摄或选择凭证") {
  return `<label class="upload-picker"><input id="${id}" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime" multiple><span>${escapeHtml(hint)}</span></label>`;
}

// ── Setup (idle): choose category + project before starting ────────────────
function renderSetup({ setup = {}, courses = [], error = "", healthAck = true }) {
  const creditType = setup.creditType || "其他运动";
  const sportType = setup.sportType || "";
  const currentCourses = courses.filter((course) => course.semesterStatus !== "archived");
  const sportOptions = SPORT_TYPES.filter((item) => item.value);
  return `<div class="page-stack session-setup">
    ${!healthAck ? `<div class="health-notice" role="alertdialog" aria-label="健康安全提醒"><span class="eyebrow">健康安全提醒</span>
      <p>请根据自身身体状况适量运动。如有不适请立即停止，必要时及时就医。</p>
      <button class="button button-primary" type="button" data-action="ack-health">我知道了</button></div>` : ""}
    ${error ? `<div class="notice notice-danger">${escapeHtml(error)}</div>` : ""}
    <form id="session-setup-form" class="card checkin-form-card"><div class="card-body page-stack">
      <div><span class="eyebrow">START</span><h2 class="card-title">开始一次运动</h2><p class="page-caption">运动满 1 小时计 1 学时，满 2 小时计 2 学时并自动结束</p></div>
      <input type="hidden" name="creditType" value="${escapeHtml(creditType)}">
      <div class="field"><span>服务类别</span><div class="segmented" role="tablist">
        ${[["课程相关", "课程相关运动"], ["其他运动", "自主其他运动"]].map(([value, label]) => `<button class="segmented-option ${creditType === value ? "is-selected" : ""}" type="button" data-setup-credit="${value}" aria-pressed="${creditType === value}">${label}</button>`).join("")}
      </div></div>
      <label class="field" data-course-field ${creditType === "课程相关" ? "" : "hidden"}><span>关联体育课程</span>
        <select name="courseId">${currentCourses.length ? `<option value="">请选择课程</option>${currentCourses.map((course) => `<option value="${escapeHtml(course.id)}" ${setup.courseId === course.id ? "selected" : ""}>${escapeHtml(course.courseCode)} · ${escapeHtml(course.name)}</option>`).join("")}` : '<option value="">本学期暂无在读体育课程</option>'}</select>
      </label>
      <div class="field"><span>运动项目</span><input type="hidden" name="sportType" value="${escapeHtml(sportType)}"><div class="sport-selector">
        ${sportOptions.map((item) => `<button class="sport-option ${sportType === item.value ? "is-selected" : ""}" type="button" data-setup-sport="${item.value}" aria-pressed="${sportType === item.value}"><span class="sport-mark">${escapeHtml(item.label.slice(0, 1))}</span><strong>${escapeHtml(item.label)}</strong></button>`).join("")}
      </div></div>
      <label class="field custom-sport-field" data-custom-sport ${sportType === "other" ? "" : "hidden"}><span>其他运动名称</span><input name="customSport" maxlength="32" value="${escapeHtml(setup.customSport || "")}" placeholder="选择其他时必填"></label>
      <button class="button button-primary button-block" type="button" data-action="start-session">开始运动</button>
    </div></form>
  </div>`;
}

// ── Running / paused timer ─────────────────────────────────────────────────
function renderTimer({ session, now = Date.now(), uploads = [], error = "", busy = false }) {
  const activeMs = sessionElapsedMs(session, now);
  const percent = Math.min(100, Math.round((activeMs / SESSION.fullMs) * 100));
  const earned = earnedHoursFromActiveMs(activeMs);
  const paused = session.status === "paused";
  return `<div class="page-stack session-live">
    ${error ? `<div class="notice notice-danger">${escapeHtml(error)}</div>` : ""}
    <div class="card timer-card"><div class="card-body page-stack">
      <div class="timer-meta"><span class="eyebrow">${paused ? "已暂停" : "运动进行中"}</span><strong>${escapeHtml(creditLabel(session.creditType))} · ${escapeHtml(sportLabel(session.sportType, session.customSport))}</strong></div>
      <div class="timer-dial ${paused ? "is-paused" : "is-running"}" style="--timer-percent:${percent}" role="timer" aria-label="已运动时长">
        <div class="timer-dial-face"><output data-timer-value>${formatTimer(activeMs)}</output><small data-timer-earned>${earned > 0 ? `已达 ${earned} 学时` : "满 1 小时起计学时"}</small></div>
      </div>
      <p class="page-caption timer-hint">计时以开始时间为准，切后台或刷新不影响；请勿在其他设备重复开始运动。</p>
      <div class="action-row timer-actions">
        ${paused
          ? `<button class="button button-primary" type="button" data-action="resume-session">继续运动</button>`
          : `<button class="button button-secondary" type="button" data-action="pause-session">暂停</button>`}
        <button class="button button-danger" type="button" data-action="end-session" ${busy ? "disabled" : ""}>结束运动</button>
      </div>
    </div></div>
    <div class="card"><div class="card-body page-stack">
      <div><span class="eyebrow">DRAFT</span><h2 class="card-title">运动凭证草稿</h2><p class="page-caption">运动过程中可现场拍摄，最多 6 张图片 + 1 个视频，仅保存在本设备</p></div>
      ${proofPicker("session-proof-picker", "＋ 现场拍摄凭证")}
      ${renderUploads(uploads)}
    </div></div>
  </div>`;
}

// ── Finishing: earned >= 1h, supplement + submit ───────────────────────────
function renderFinishing({ pending = {}, uploads = [], error = "", busy = false }) {
  return `<div class="page-stack session-finish">
    ${error ? `<div class="notice notice-danger">${escapeHtml(error)}</div>` : ""}
    <div class="card result-card"><div class="card-body page-stack">
      <span class="eyebrow">SESSION COMPLETE</span>
      <div class="result-hours"><strong>${pending.earnedHours} 学时</strong><span>本次运动计入</span></div>
      <div class="result-facts"><div><span>实际运动</span><strong>${formatTimer(pending.activeMs)}</strong></div><div><span>开始</span><strong>${formatDate(pending.startTime)}</strong></div><div><span>结束</span><strong>${formatDate(pending.endTime)}</strong></div></div>
    </div></div>
    <form id="submit-form" class="card checkin-form-card"><div class="card-body page-stack">
      <label class="field"><span>运动说明（选填）</span><textarea name="description" maxlength="${DESC_MAX}" placeholder="填写时间、地点和运动内容，最多 ${DESC_MAX} 字">${escapeHtml(pending.description || "")}</textarea></label>
      <div class="field"><span>运动凭证</span><p class="page-caption">至少提交 1 个凭证。可从运动中拍摄的草稿选用，或现场再拍</p>
        ${proofPicker("submit-proof-picker", "＋ 拍摄或补充凭证")}
      </div>
      ${renderUploads(uploads)}
      <div class="action-row"><button class="button button-secondary" type="button" data-action="discard-finish">放弃本次</button><button class="button button-primary" type="submit" ${busy ? "disabled" : ""}>${busy ? "提交中…" : "确认提交"}</button></div>
    </div></form>
  </div>`;
}

function renderTodayDone(record) {
  const summary = record
    ? `<div class="result-facts"><div><span>项目</span><strong>${escapeHtml(sportLabel(record.sportType, record.customSport))}</strong></div><div><span>计入</span><strong>${record.hours} 学时</strong></div><div><span>时间</span><strong>${formatDate(record.submittedAt || record.startTime)}</strong></div></div>`
    : "";
  return `<div class="page-stack"><div class="card today-done"><div class="card-body page-stack">
    <span class="eyebrow">TODAY</span><h2 class="card-title">今日已完成一次运动服务</h2>
    <p class="page-caption">每个自然日仅可提交一次运动服务，请明天再来。</p>
    ${summary}
    <button class="button button-tonal" type="button" data-checkin-tab="records">查看运动记录</button>
  </div></div></div>`;
}

function renderRecords(records, filter = "all") {
  const filters = [["all", "全部"], ["counted", "已计入"], ["uncounted", "未计入"]];
  const visible = records.filter((item) => {
    if (filter === "counted") return isCountedStatus(item.status);
    if (filter === "uncounted") return !isCountedStatus(item.status);
    return true;
  });
  const cards = visible.length ? `<div class="record-list">${visible.map((record) => {
    const proofs = proofItems(record.proofFiles);
    const label = sportLabel(record.sportType, record.customSport);
    const thumb = proofs.length
      ? `<div class="record-thumb">${proofMedia(proofs[0], { label: `${label}凭证` })}${proofs.length > 1 ? `<span class="proof-count">+${proofs.length - 1}</span>` : ""}</div>`
      : `<div class="record-thumb record-thumb-fallback"><strong>${escapeHtml(label.slice(0, 1))}</strong><span>${escapeHtml(label)}</span></div>`;
    return `<button class="record-card record-card-media" type="button" data-route="record/${escapeHtml(record.id)}">
      ${thumb}<div class="record-copy"><div class="record-card-head"><strong>${escapeHtml(label)}</strong><span>${formatDate(record.startTime || record.submittedAt)}</span></div>
      <div class="record-card-head"><strong>${record.hours}h</strong>${statusBadge(record.status)}</div>
      <p>${escapeHtml(record.description || creditLabel(record.creditType))}</p>
      <span class="page-caption">凭证 ${proofs.length} 个${!isCountedStatus(record.status) && record.invalidReason ? ` · ${escapeHtml(record.invalidReason)}` : ""}</span></div>
    </button>`;
  }).join("")}</div>` : '<div class="card"><div class="card-body muted">当前筛选条件下没有运动记录。</div></div>';
  return `<div class="page-stack"><div class="filter-chips" aria-label="记录筛选">${filters.map(([id, label]) => `<button type="button" data-record-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div>${cards}</div>`;
}

export function renderRecordDetail(record) {
  if (!record) return '<div class="card"><div class="card-body muted">记录不存在。</div></div>';
  const proofs = proofItems(record.proofFiles);
  const label = sportLabel(record.sportType, record.customSport);
  const counted = isCountedStatus(record.status);
  return `<section class="page-stack"><button class="button button-secondary" data-route="checkin" type="button">← 返回运动记录</button>
    <div class="card"><div class="card-head"><h1 class="card-title">${escapeHtml(label)} · ${record.hours} 学时</h1></div><div class="card-body page-stack">
      <div>${statusBadge(record.status)} <span class="page-caption">${escapeHtml(creditLabel(record.creditType))} · 提交于 ${formatDate(record.submittedAt || record.startTime)}</span></div>
      <div class="result-facts"><div><span>开始</span><strong>${formatDate(record.startTime)}</strong></div><div><span>结束</span><strong>${formatDate(record.endTime)}</strong></div><div><span>计入</span><strong>${record.hours} 学时</strong></div></div>
      <p>${escapeHtml(record.description || "本次运动未填写说明")}</p>
      <div class="proof-grid">${proofs.map((proof, index) => `<div class="proof-detail">${proofMedia(proof, { detail: true, label: `${label}凭证 ${index + 1}` })}</div>`).join("") || '<div class="upload-empty">该记录没有有效凭证</div>'}</div>
      ${!counted ? `<div class="notice notice-danger"><strong>不计入学时</strong><br>${escapeHtml(record.invalidReason || "该记录被教师标记为无效")}${record.teacherComment ? `<br>${escapeHtml(record.teacherComment)}` : ""}</div>` : ""}
    </div></div></section>`;
}

export function renderCheckin({ activeTab = "session", records = [], session = null, now = Date.now(), phase = "idle", setup = {}, courses = [], uploads = [], pending = null, error = "", busy = false, recordFilter = "all", healthAck = true, todayRecord = null } = {}) {
  const tabs = [["session", "运动"], ["records", "记录"]];
  let content;
  if (activeTab === "records") {
    content = renderRecords(records, recordFilter);
  } else if (phase === "finishing") {
    content = renderFinishing({ pending: pending || {}, uploads, error, busy });
  } else if (phase === "running" || phase === "paused") {
    content = renderTimer({ session, now, uploads, error, busy });
  } else if (phase === "today-done") {
    content = renderTodayDone(todayRecord);
  } else {
    content = renderSetup({ setup, courses, error, healthAck });
  }
  return `<section class="page-stack checkin-page"><header><span class="eyebrow">EXERCISE</span><h1 class="page-heading">运动服务</h1><p class="page-caption">开始运动 · 计时 · 结束记录</p></header>
    <div class="tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-checkin-tab="${id}" aria-selected="${activeTab === id}">${label}</button>`).join("")}</div>${content}</section>`;
}
