// Exercise check-in flow (#20–#24) — feature/checkin/CheckInScreen.kt,
// ExerciseCheckInScreen.kt, CheckInRecords.kt, SessionMediaManager.kt and the
// session controller. States: Idle → Active ↔ Paused → Finished → Submitted.
// Draft lifecycle follows 业务流程_学生端.md v6.1 §4.6/§5.3: an under-1h end
// keeps local drafts (the student may start again the same day); only an
// explicit discard or a successful submission clears them.

import { tx, currentLocale } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner, emptyPlaceholder, validationPanel, sectionTitle, statusBadge } from "../ui.js";
import { hourText } from "../data.js";
import { canNormalizeCapturedImage, validateProofFile } from "../proofs.js";
import {
  canStartExercise, hasSubmittedCheckInToday, loadSession, saveSession, clearSession,
  startSession, pauseSession, resumeSession, sessionDurationMs, shouldAutoEnd,
  creditedHours, formatTimer, businessToday, SESSION_MIN_CREDIT_MILLIS, SESSION_MAX_MILLIS,
} from "../session.js";
import {
  startServerSession, pauseServerSession, resumeServerSession, finishServerSession,
  cancelServerSession, getActiveSession, createRecordDraft, submitRecord,
  uploadMediaDraft, cacheRecordProofs, createMediaAccessUrl, proxyObjectUrl,
  listMyRecords, apiErrorText, ApiError,
  isQualificationReached, sessionStartErrorText,
  MAX_PROOF_VIDEO_SECONDS, MAX_PROOF_IMAGES, MAX_PROOF_VIDEOS,
} from "../api.js";

const MAX_DESCRIPTION = 200;
// Mirrors the backend's MEDIA-001 limits (see api.js).
const MAX_IMAGES = MAX_PROOF_IMAGES;
const MAX_VIDEOS = MAX_PROOF_VIDEOS;
const MAX_REQUEST_BYTES = 120_000_000;
const OTHER = "other";

const SPORT_OPTIONS = [
  { value: "running", zh: "跑步", en: "Running", icon: "directions-run" },
  { value: "basketball", zh: "篮球", en: "Basketball", icon: "directions-run" },
  { value: "football", zh: "足球", en: "Football", icon: "directions-run" },
  { value: "badminton", zh: "羽毛球", en: "Badminton", icon: "directions-run" },
  { value: "table_tennis", zh: "乒乓球", en: "Table tennis", icon: "directions-run" },
  { value: "swimming", zh: "游泳", en: "Swimming", icon: "directions-run" },
  { value: "fitness", zh: "健身", en: "Fitness", icon: "fitness-center" },
  { value: "cycling", zh: "骑行", en: "Cycling", icon: "directions-run" },
  { value: OTHER, zh: "其他", en: "Other", icon: "more-horiz" },
];

const creditTypeLabel = (creditType) =>
  creditType === "course" ? tx("课程相关", "Course-related") : creditType === "general" ? tx("其他运动", "Other exercise") : tx("系统抵扣", "System offset");

function sportLabel(details) {
  if (details.sportType === OTHER) return details.customSportName || "";
  const option = SPORT_OPTIONS.find((o) => o.value === details.sportType);
  return option ? tx(option.zh, option.en) : details.sportType;
}

/** courseSportSelection (ExerciseSessionState.kt): sport inferred from course name. */
function courseSportSelection(courseName) {
  const name = courseName.trim();
  const known = [
    ["table_tennis", "乒乓球", ["乒乓球", "table tennis", "ping pong", "ping-pong"]],
    ["badminton", "羽毛球", ["羽毛球", "badminton"]],
    ["basketball", "篮球", ["篮球", "basketball"]],
    ["football", "足球", ["足球", "football", "soccer"]],
    ["swimming", "游泳", ["游泳", "swimming"]],
    ["running", "跑步", ["跑步", "长跑", "running"]],
    ["cycling", "骑行", ["骑行", "cycling"]],
    ["fitness", "健身", ["健身", "体能", "力量训练", "fitness"]],
  ];
  const lower = name.toLowerCase();
  for (const [sportType, displayName, keywords] of known) {
    if (keywords.some((k) => lower.includes(k.toLowerCase()))) return { sportType, displayName, customSportName: null };
  }
  const paren = [...name.matchAll(/[（(]([^（）()]+)[）)]/g)].pop()?.[1]?.trim();
  const displayName = paren || name || "课程运动";
  return { sportType: OTHER, displayName, customSportName: displayName };
}

function checkinState(app) {
  if (!app.ui.checkin) {
    app.ui.checkin = {
      tab: "exercise",
      selectedRecordId: null,
      setup: { creditType: "general", generalSportType: "running", generalCustomSportName: "" },
      finish: { confirmed: false, submitting: false },
      mediaNotice: null,
      captureError: null,
      recordOpenError: null,
      drafts: [],
      pendingRetakeId: null,
    };
  }
  return app.ui.checkin;
}

/** The single current enrolled-and-open course (shared lookup). */
function findCurrentCourse(workspace) {
  return workspace.courses.find(
    (c) => c.isCurrent && c.enrollmentStatus === "enrolled" && ["active", "open", "enabled"].includes(String(c.status).trim().toLowerCase())
  ) || null;
}

function accountId(app) {
  return app.state.workspace.student.id;
}

function healthAcknowledged(app) {
  return app.overlay.healthReminderAck === true;
}

// ── Readiness (evaluateCheckInReadiness) ──
function evaluateReadiness(app) {
  const workspace = app.state.workspace;
  if (String(workspace.student.accountStatus).toUpperCase() !== "ACTIVE") {
    return { canStart: false, blockedReason: tx("账号状态异常，无法打卡", "Account status prevents check-in.") };
  }
  if (!app.hasActiveEnrollment()) {
    return { canStart: false, blockedReason: tx("你尚未加入本学期体育课程，请先扫码或输入邀请码加入", "You have not joined a sports course this semester. Scan a QR code or enter an invitation code first.") };
  }
  if (!findCurrentCourse(workspace)) {
    return { canStart: false, blockedReason: tx("当前课程尚未开放打卡，请联系任课教师", "Check-in is not open for the current course. Contact your instructor.") };
  }
  const windowReason = canStartExercise(workspace.checkInTimeWindow);
  if (windowReason) return { canStart: false, blockedReason: windowReason };
  if (hasSubmittedCheckInToday(workspace)) {
    return { canStart: false, blockedReason: tx("今日已打卡，每天只能提交一次", "You have already checked in today. Only one submission is allowed per day.") };
  }
  return { canStart: true, blockedReason: null };
}

const formatDateTime = (ms) => new Date(ms).toLocaleString(currentLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const formatDateOnly = (ms) => new Date(ms).toLocaleDateString(currentLocale(), { year: "numeric", month: "short", day: "numeric" });
const formatTimeOnly = (ms) => new Date(ms).toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit" });

function statusPill(label, color) {
  return `<span class="checkin-pill" style="background:color-mix(in srgb, ${color} 12%, transparent);color:${color}">
    <span class="dot" style="background:${color}"></span>${esc(label)}
  </span>`;
}

const GREEN = "#34C759";
const ORANGE = "#FF9500";
const RED = "#FF3B30";
const BLUE = "var(--color-primary)";

// ═══════════════════════════════════════════════════════════════
//  Root
// ═══════════════════════════════════════════════════════════════

export function renderCheckIn(app) {
  const ui = checkinState(app);
  const session = loadSession(accountId(app));
  const phase = session?.phase || "idle";

  if (ui.selectedRecordId) {
    const record = app.state.workspace.records.find((r) => r.id === ui.selectedRecordId);
    if (record) return renderRecordDetail(app, record);
    ui.selectedRecordId = null;
  }

  const focused = phase === "active" || phase === "paused" || phase === "finished";
  let inner;
  if (ui.tab === "records" && !focused) {
    inner = renderRecordsTab(app);
  } else if (phase === "active" || phase === "paused") {
    inner = renderRunning(app, session, phase === "paused");
  } else if (phase === "finished") {
    inner = renderFinished(app, session);
  } else if (phase === "submitted") {
    inner = renderSubmitted(app, session);
  } else {
    inner = renderPreparation(app);
  }

  const header = focused ? "" : `
    <div class="headline-medium" style="color:var(--color-on-background)">${tx("运动打卡", "Exercise check-in")}</div>
    <div style="height:14px"></div>
    <div class="checkin-tabbar">
      <button class="checkin-tab pressable" aria-selected="${ui.tab === "exercise"}" data-action="checkin.tab" data-tab="exercise">${tx("运动", "Exercise")}</button>
      <button class="checkin-tab pressable" aria-selected="${ui.tab === "records"}" data-action="checkin.tab" data-tab="records">${tx("记录", "Records")}</button>
    </div>
    <div style="height:16px"></div>`;

  return `<div class="tab-content checkin-root">${header}${inner}</div>`;
}

// ═══════════════════════════════════════════════════════════════
//  #20 Preparation
// ═══════════════════════════════════════════════════════════════

function renderPreparation(app) {
  const ui = checkinState(app);
  const workspace = app.state.workspace;

  if (!app.hasActiveEnrollment()) {
    // [Android 当前实现] the no-course branch passes empty join callbacks:
    // the entry card is displayed but its buttons perform no navigation.
    return `<div class="col" style="gap:16px">
      ${sectionTitle(tx("加入体育课程", "Join a sports course"))}
      <div class="swiss-panel">
        <div class="title-large text-on-surface">${tx("加入体育课程", "Join a sports course")}</div>
        <div style="height:8px"></div>
        <div class="body-medium text-muted">${tx("扫码或输入邀请码加入本学期体育课", "Scan a QR code or enter an invitation code for this semester’s sports course.")}</div>
        <div style="height:20px"></div>
        <button class="primary-btn pressable" data-action="checkin.noop">${icon("qr-code-scanner", 20)}<span>${tx("扫码加入课程", "Scan QR to Join Course")}</span></button>
        <div style="height:4px"></div>
        <button class="text-btn pressable" data-action="checkin.noop" style="width:100%;min-height:48px">${icon("text-fields", 18)}<span class="label-large">${tx("输入邀请码", "Enter invitation code")}</span></button>
      </div>
    </div>`;
  }

  const timeWindow = workspace.checkInTimeWindow;
  const readiness = evaluateReadiness(app);
  const blocked = readiness.blockedReason;
  const currentCourse = findCurrentCourse(workspace);
  const courseSport = currentCourse ? courseSportSelection(currentCourse.name) : null;
  const setup = ui.setup;
  const isCourse = setup.creditType === "course";
  const sportType = isCourse ? (courseSport?.sportType || "") : setup.generalSportType;
  const customSportName = isCourse ? (courseSport?.customSportName || "") : setup.generalCustomSportName;
  const detailsValid = isCourse
    ? !!courseSport
    : sportType !== OTHER || (customSportName.trim() !== "" && customSportName.length <= 32);
  const hasSubmittedToday = hasSubmittedCheckInToday(workspace);
  // "Today" follows the backend's business day (Beijing), matching the daily
  // check-in rule; only display timestamps stay in the student's local time.
  const todayKey = businessToday();
  const todayHours = workspace.records
    .filter((r) => r.creditType !== "offset" && (r.businessDate || r.submittedAt || "").slice(0, 10) === todayKey)
    .reduce((sum, r) => sum + (Number(r.hours) || 0), 0);

  const sportOptions = isCourse
    ? (courseSport
        ? [{ value: courseSport.sportType, zh: courseSport.displayName, en: courseSport.displayName, icon: SPORT_OPTIONS.find((o) => o.value === courseSport.sportType)?.icon || "more-horiz" }]
        : [])
    : SPORT_OPTIONS;

  const sportRows = [];
  for (let i = 0; i < sportOptions.length; i += 4) sportRows.push(sportOptions.slice(i, i + 4));

  return `<div class="checkin-prep">
    <div class="col" style="gap:20px;padding-bottom:104px">
      <div class="swiss-panel">
        <div class="row" style="align-items:flex-start">
          <div class="col grow">
            <div class="headline-small text-on-surface">${blocked === null ? tx("准备开始", "Ready to start") : tx("暂时无法开始", "Unable to start")}</div>
            <div style="height:5px"></div>
            <div class="body-medium text-muted">${blocked === null ? tx("选择运动项目，开始记录有效时长", "Choose an exercise to start recording active time.") : esc(blocked)}</div>
          </div>
          ${statusPill(blocked === null ? tx("可打卡", "Available") : tx("不可打卡", "Unavailable"), blocked === null ? GREEN : ORANGE)}
        </div>
        <div class="course-divider" style="margin:18px 0 14px"></div>
        <div class="row" style="gap:10px">
          <span class="text-primary" style="display:inline-flex;flex:none">${icon("timer", 20)}</span>
          <div class="col grow">
            <span class="body-medium text-on-surface" style="font-weight:500">${tx(`每日 ${timeWindow.dailyStartTime}–${timeWindow.dailyEndTime}`, `Daily ${timeWindow.dailyStartTime}–${timeWindow.dailyEndTime}`)}</span>
            ${timeWindow.dateRangeStart || timeWindow.dateRangeEnd ? `<span class="body-small text-muted">${tx(`${timeWindow.dateRangeStart || ""} 至 ${timeWindow.dateRangeEnd || ""}`, `${timeWindow.dateRangeStart || ""} to ${timeWindow.dateRangeEnd || ""}`)}</span>` : ""}
          </div>
        </div>
        ${currentCourse ? `<div style="height:14px"></div>
        <div class="row" style="gap:10px;align-items:flex-start">
          <span class="checkin-course-dot"><span></span></span>
          <div class="col grow">
            <span class="body-medium text-on-surface" style="font-weight:500">${esc(`${currentCourse.code} / Section ${currentCourse.section} · ${currentCourse.name}`)}</span>
            ${currentCourse.teacher ? `<span class="body-small text-muted">${tx(`任课教师 ${currentCourse.teacher}`, `Instructor: ${currentCourse.teacher}`)}</span>` : ""}
          </div>
        </div>` : ""}
        ${timeWindow.excludedDates.length ? `<div style="height:12px"></div><span class="body-small text-muted">${tx(`排除日期：${timeWindow.excludedDates.slice(0, 3).join("、")}`, `Excluded dates: ${timeWindow.excludedDates.slice(0, 3).join(", ")}`)}${timeWindow.excludedDates.length > 3 ? tx(" 等", " etc.") : ""}</span>` : ""}
        ${hasSubmittedToday ? `<div style="height:12px"></div><span class="body-small" style="color:${ORANGE};font-weight:500">${tx(`今日已提交 ${hourText(todayHours)}，每日限提交一次`, `${hourText(todayHours)} submitted today; one submission per day.`)}</span>` : ""}
      </div>

      <div class="col" style="gap:10px">
        <div class="row" style="align-items:flex-end">
          <span class="title-large text-on-surface">${tx("本次运动", "This exercise")}</span>
          <span class="grow"></span>
          <span class="body-small text-muted">${tx("选择打卡类别与运动项目", "Choose a check-in category and exercise type")}</span>
        </div>
        <div class="swiss-panel" style="padding:16px">
          <div class="title-small text-on-surface">${tx("打卡类别", "Check-in category")}</div>
          <div style="height:10px"></div>
          <div class="row" style="gap:8px">
            <button class="category-btn pressable${isCourse ? " selected" : ""}" data-action="checkin.creditType" data-value="course">${tx("课程相关", "Course-related")}</button>
            <button class="category-btn pressable${!isCourse ? " selected" : ""}" data-action="checkin.creditType" data-value="general">${tx("自主运动", "Independent exercise")}</button>
          </div>
          <div class="course-divider" style="margin:18px 0 16px"></div>
          <div class="title-small text-on-surface">${isCourse ? tx("课程运动", "Course exercise") : tx("运动项目", "Exercise type")}</div>
          <div style="height:10px"></div>
          <div class="col" style="gap:8px">
            ${sportRows.map((row) => `<div class="row" style="gap:8px">${row
              .map((option) => `<button class="sport-btn pressable${sportType === option.value ? " selected" : ""}" data-action="checkin.sport" data-value="${esc(option.value)}">
                ${icon(option.icon, 22)}<span class="label-medium ellipsis">${esc(tx(option.zh, option.en))}</span>
              </button>`)
              .join("")}</div>`).join("")}
          </div>
          ${isCourse && currentCourse ? `<div style="height:10px"></div><span class="body-small text-muted">${tx(`已根据当前课程“${currentCourse.name}”自动选择`, `Automatically selected for the current course “${currentCourse.name}”.`)}</span>` : ""}
          ${!isCourse && sportType === OTHER ? `<div style="height:12px"></div>
            <div class="col">
              <label class="field-label" for="custom-sport">${tx("具体运动名称", "Exercise name")}</label>
              <input id="custom-sport" class="text-field" maxlength="32" value="${esc(customSportName)}" data-input="checkin.customSport" />
              <div class="field-supporting" data-custom-sport-counter>${customSportName.length}/32</div>
            </div>` : ""}
        </div>
      </div>

      <div class="row" style="gap:10px;align-items:flex-start;padding:0 2px">
        <span class="text-muted" style="display:inline-flex;flex:none">${icon("camera-alt", 18)}</span>
        <span class="body-small text-muted">${tx("运动中可随时现场拍照或录像。凭证仅保存在本机，结束运动并确认后才会提交。", "You can take photos or videos while exercising. Proof stays on this device until you end the session and confirm submission.")}</span>
      </div>
    </div>
    <div class="start-exercise-bar">
      <div class="start-exercise-divider"></div>
      ${blocked ? `<div class="body-small text-muted" style="text-align:center;padding-top:8px">${esc(blocked)}</div>` : ""}
      <button class="checkin-cta pressable" data-action="checkin.start" ${detailsValid && blocked === null ? "" : "disabled"} style="margin-top:${blocked ? 8 : 12}px">
        ${icon("play-arrow", 24)}<span class="title-small">${detailsValid && blocked === null ? tx("开始运动", "Start exercise") : tx("当前不可开始", "Cannot start now")}</span>
      </button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  #21 Running / paused
// ═══════════════════════════════════════════════════════════════

function draftListHtml(app) {
  const ui = checkinState(app);
  if (!ui.drafts.length) {
    return `<div class="body-small text-muted">${tx("暂无现场凭证，可拍照或录像补充。", "No on-site proof yet. Take a photo or record a video.")}</div>`;
  }
  return `<div class="col" style="gap:10px">${ui.drafts
    .map(
      (draft) => {
        const locked = ui.finish.submitting || Boolean(draft.mediaId);
        return `<div class="draft-row">
        <span class="draft-thumb">${draft.url && draft.type === "image" ? `<img src="${draft.url}" alt="">` : icon(draft.type === "video" ? "videocam" : "photo", 22)}</span>
        <div class="col grow" style="gap:2px;min-width:0">
          <span class="body-medium text-on-surface ellipsis">${esc(draft.fileName)}</span>
          <span class="body-small text-muted">${draft.type === "video" ? tx("视频", "Video") : tx("照片", "Photo")} · ${(draft.byteCount / 1_000_000).toFixed(1)} MB${draft.durationSeconds ? ` · ${Math.ceil(draft.durationSeconds)}s` : ""}${draft.mediaId ? tx(" · 已验证", " · verified") : ""}</span>
        </div>
        <button class="icon-btn pressable" data-action="checkin.retakeDraft" data-draft-id="${esc(draft.id)}" aria-label="${tx("重拍", "Retake")}" ${locked ? "disabled" : ""} style="width:40px;height:40px">${icon("refresh", 20)}</button>
        <button class="icon-btn pressable text-error" data-action="checkin.deleteDraft" data-draft-id="${esc(draft.id)}" aria-label="${tx("删除", "Delete")}" ${locked ? "disabled" : ""} style="width:40px;height:40px">${icon("delete", 20)}</button>
      </div>`;
      }
    )
    .join("")}</div>`;
}

function captureButtonsHtml(app, { allowVideo }) {
  const ui = checkinState(app);
  const imageCount = ui.drafts.filter((d) => d.type === "image").length;
  const videoCount = ui.drafts.filter((d) => d.type === "video").length;
  const photoLimit = imageCount >= MAX_IMAGES;
  const videoLimit = videoCount >= MAX_VIDEOS;
  let limitNote = "";
  if (photoLimit && allowVideo && videoLimit) {
    limitNote = tx("照片和视频均已达到数量上限，删除已有素材后可继续拍摄。", "Photo and video limits are reached. Delete existing media before capturing more.");
  } else if (photoLimit) {
    limitNote = tx(`照片已达到 ${MAX_IMAGES} 张上限，删除后可继续拍摄。`, `The ${MAX_IMAGES}-photo limit is reached. Delete a photo to capture another.`);
  } else if (allowVideo && videoLimit) {
    limitNote = tx(`视频已达到 ${MAX_VIDEOS} 个上限，删除后可继续录制。`, `The ${MAX_VIDEOS}-video limit is reached. Delete the video to record another.`);
  }
  return `
    ${ui.captureError ? validationPanel(ui.captureError) : ""}
    <div class="row" style="gap:10px">
      <button class="capture-btn pressable" data-action="checkin.capturePhoto" ${photoLimit ? "disabled" : ""}>${icon("camera-alt", 20)}<span>${tx("现场拍照", "Take photo")}</span></button>
      ${allowVideo ? `<button class="capture-btn pressable" data-action="checkin.captureVideo" ${videoLimit ? "disabled" : ""}>${icon("videocam", 20)}<span>${tx("现场录像", "Record video")}</span></button>` : ""}
    </div>
    ${limitNote ? `<div class="body-small" style="color:${ORANGE};margin-top:8px">${esc(limitNote)}</div>` : ""}
    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" capture="environment" style="display:none" data-change="checkin.photoPicked" data-capture-input="photo" />
    <input type="file" accept="video/mp4,video/quicktime,video/3gpp,video/webm" capture="environment" style="display:none" data-change="checkin.videoPicked" data-capture-input="video" />`;
}

function renderRunning(app, session, paused) {
  const ui = checkinState(app);
  const duration = sessionDurationMs(session);
  const details = session.details;
  return `<div class="col" style="gap:0;padding-bottom:24px">
    <div class="row">
      <div class="col grow">
        <span class="headline-small text-on-surface">${esc(sportLabel(details))}</span>
        <span class="body-small text-muted">${creditTypeLabel(details.creditType)}</span>
      </div>
      ${statusPill(paused ? tx("已暂停", "Paused") : tx("记录中", "Recording"), paused ? ORANGE : GREEN)}
    </div>
    <div style="height:18px"></div>
    <div class="swiss-panel" style="padding:28px 18px;display:flex;flex-direction:column;align-items:center">
      <span class="text-primary" style="display:inline-flex">${icon("timer", 24)}</span>
      <div style="height:12px"></div>
      <span class="timer-value" data-timer-value>${formatTimer(duration)}</span>
      <span class="body-medium text-muted">${paused ? tx("计时已暂停", "Timer paused") : tx("有效运动时长", "Active exercise time")}</span>
      <div class="course-divider" style="margin:24px 0 18px;width:100%"></div>
      <div class="row" style="width:100%">
        <div class="col grow" style="align-items:center"><span class="session-metric-value">${formatTimeOnly(session.startedAt)}</span><span class="label-medium text-muted" style="margin-top:4px">${tx("开始", "Started")}</span></div>
        <div class="col grow" style="align-items:center"><span class="session-metric-value" data-timer-hours>${creditedHours(duration)}h</span><span class="label-medium text-muted" style="margin-top:4px">${tx("预计学时", "Expected hours")}</span></div>
        <div class="col grow" style="align-items:center"><span class="session-metric-value">${ui.drafts.length}</span><span class="label-medium text-muted" style="margin-top:4px">${tx("现场凭证", "On-site proof")}</span></div>
      </div>
    </div>
    <div style="height:14px"></div>
    <div class="swiss-panel" style="padding:16px">
      <div class="row">
        <div class="col grow">
          <span class="title-medium text-on-surface">${tx("现场凭证", "On-site proof")}</span>
          <span class="body-small text-muted">${tx("仅保存在本机，结束后再确认提交", "Saved only on this device until you confirm submission after ending.")}</span>
        </div>
      </div>
      <div style="height:14px"></div>
      ${captureButtonsHtml(app, { allowVideo: true })}
      <div style="height:14px"></div>
      ${draftListHtml(app)}
    </div>
    <div style="height:20px"></div>
    ${paused
      ? `<button class="checkin-cta pressable" data-action="checkin.resume">${icon("play-arrow", 24)}<span>${tx("继续运动", "Continue exercise")}</span></button>`
      : `<button class="checkin-cta pressable" data-action="checkin.pause">${icon("pause", 24)}<span>${tx("暂停运动", "Pause exercise")}</span></button>`}
    <div style="height:10px"></div>
    <button class="checkin-end-btn pressable" data-action="checkin.requestFinish">${icon("stop", 20)}<span>${tx("结束运动", "End exercise")}</span></button>
    <div style="height:8px"></div>
    <button class="outlined-btn pressable" data-action="checkin.debugAddHour" style="width:auto;align-self:flex-start;min-height:40px;padding:0 16px;font-size:14px">${tx("开发测试：增加60分钟", "Debug: add 60 minutes")}</button>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  #22 Finished — complete and submit
// ═══════════════════════════════════════════════════════════════

function summaryRow(label, value) {
  return `<div class="row" style="padding:4px 0">
    <span class="body-medium text-muted">${esc(label)}</span>
    <span class="grow"></span>
    <span class="body-medium text-on-surface" style="font-weight:500;text-align:right">${esc(value)}</span>
  </div>`;
}

function renderFinished(app, session) {
  const ui = checkinState(app);
  const details = session.details;
  const credited = creditedHours(session.activeDurationMillis);
  const retainedImages = ui.drafts.filter((d) => d.type === "image").length;
  const retainedVideos = ui.drafts.filter((d) => d.type === "video").length;
  const isGeneral = details.creditType === "general";
  return `<div class="col" style="gap:16px;padding-bottom:28px">
    <div class="col">
      <span class="headline-medium text-on-surface">${tx("完成记录", "Complete record")}</span>
      <div style="height:4px"></div>
      <span class="body-medium text-muted">${tx("补充说明、确认现场凭证并提交", "Add notes, confirm on-site proof, and submit")}</span>
    </div>
    <div class="swiss-panel">
      <span class="display-small text-on-surface">${formatTimer(session.activeDurationMillis)}</span>
      <div style="height:8px"></div>
      <span class="body-large text-on-surface">${tx(`有效运动时长 · 计入 ${credited} 小时`, `Active exercise time · ${credited} credited hours`)}</span>
      <div style="height:6px"></div>
      <span class="body-large text-muted">${creditTypeLabel(details.creditType)} · ${esc(sportLabel(details))}</span>
    </div>
    <div class="swiss-panel" style="padding:16px">
      <span class="title-medium text-on-surface">${isGeneral ? tx("运动说明（必填）", "Exercise description (required)") : tx("运动说明（选填）", "Exercise description (optional)")}</span>
      <div style="height:8px"></div>
      <textarea class="text-field" rows="3" maxlength="${MAX_DESCRIPTION}" placeholder="${isGeneral ? tx("请填写本次运动内容", "Describe this exercise") : tx("可补充本次课程运动内容", "Optionally describe this course exercise")}" data-input="checkin.description">${esc(details.description || "")}</textarea>
      <div class="field-supporting"><span data-description-counter>${tx(`已输入 ${(details.description || "").length}/${MAX_DESCRIPTION}`, `${(details.description || "").length}/${MAX_DESCRIPTION} entered`)}</span><br>${isGeneral ? tx(`自主运动说明不能为空，最多 ${MAX_DESCRIPTION} 字`, `Independent exercise requires a nonblank description of up to ${MAX_DESCRIPTION} characters.`) : tx(`课程运动说明可不填写；填写时最多 ${MAX_DESCRIPTION} 字且不能只含空格`, `Course exercise description is optional; when provided, it must be nonblank and at most ${MAX_DESCRIPTION} characters.`)}</div>
    </div>
    <div class="swiss-panel" style="padding:16px">
      <span class="title-medium text-on-surface">${tx("现场补拍", "Capture more proof")}</span>
      <div style="height:8px"></div>
      <span class="body-small text-muted">${tx("运动结束后仍可现场拍照或录制最长 15 秒的有声视频，不提供相册旧素材入口。提交时会自动包含当前保留的全部凭证。", "After exercise, you may still take a photo or record a video with sound up to 15 seconds. Existing gallery media is not offered, and every retained proof item is included automatically.")}</span>
      <div style="height:12px"></div>
      ${captureButtonsHtml(app, { allowVideo: true })}
      <div class="course-divider" style="margin:18px 0 16px"></div>
      <span class="title-medium text-on-surface">${tx("待提交凭证", "Proof to submit")}</span>
      <span class="body-small text-muted">${tx("至少保留 1 项；下列全部凭证都会上传", "Keep at least 1 item; every item below will be uploaded")}</span>
      <div style="height:10px"></div>
      ${draftListHtml(app)}
    </div>
    ${ui.mediaNotice ? `<div class="body-small text-primary">${esc(ui.mediaNotice)}</div>` : ""}
    <span class="body-small text-muted">${tx(`最多 ${MAX_IMAGES} 张照片和 ${MAX_VIDEOS} 个视频，视频不超过 ${MAX_PROOF_VIDEO_SECONDS} 秒且需有声音`, `Up to ${MAX_IMAGES} photos and ${MAX_VIDEOS} video; video must be at most ${MAX_PROOF_VIDEO_SECONDS}s with sound`)}</span>
    <div class="row" style="align-items:flex-end">
      <span class="title-large text-on-surface">${tx("提交确认", "Confirm submission")}</span>
      <span class="grow"></span>
      <span class="body-small text-muted">${tx("请核对以下信息", "Review the following information")}</span>
    </div>
    <div class="swiss-panel" style="padding:16px">
      <div class="col" style="gap:8px">
        ${summaryRow(tx("打卡类别", "Check-in category"), creditTypeLabel(details.creditType))}
        ${summaryRow(tx("运动项目", "Exercise type"), sportLabel(details))}
        ${summaryRow(tx("开始时间", "Start time"), formatDateTime(session.startedAt))}
        ${summaryRow(tx("结束时间", "End time"), formatDateTime(session.endedAt))}
        ${summaryRow(tx("实际运动时长", "Active duration"), formatTimer(session.activeDurationMillis))}
        ${summaryRow(tx("计入学时", "Credited hours"), tx(`${credited} 小时`, `${credited} hours`))}
        ${summaryRow(tx("打卡日期", "Check-in date"), formatDateOnly(session.startedAt))}
        ${summaryRow(tx("凭证数量", "Proof count"), tx(`${retainedImages} 张照片`, `${retainedImages} photos`) + (retainedVideos > 0 ? tx(` + ${retainedVideos} 个视频`, ` + ${retainedVideos} videos`) : ""))}
      </div>
    </div>
    <div class="swiss-panel" style="padding:8px 16px 8px 8px">
      <label class="row" style="gap:8px;cursor:pointer">
        <input type="checkbox" class="checkbox" data-change="checkin.confirm" ${ui.finish.confirmed ? "checked" : ""} />
        <span class="body-medium text-on-surface">${tx("我确认以上信息和提交的凭证内容真实有效。", "I confirm that the information and proof submitted above are truthful and valid.")}</span>
      </label>
    </div>
    <div class="col">
      <button class="checkin-cta pressable" data-action="checkin.submit" ${ui.finish.confirmed && !ui.finish.submitting && app.isWriteAllowed() ? "" : "disabled"}>
        ${ui.finish.submitting ? `${spinner(18, "on-primary")}<span style="width:8px"></span>` : ""}
        <span>${ui.finish.submitting ? tx("提交中…", "Submitting…") : tx("提交打卡", "Submit check-in")}</span>
      </button>
      <button class="text-btn pressable" data-action="checkin.abandon" ${ui.finish.submitting ? "disabled" : ""} style="width:100%"><span style="color:${RED}">${tx("放弃本次记录", "Discard this record")}</span></button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  #23 Submitted
// ═══════════════════════════════════════════════════════════════

function renderSubmitted(app, session) {
  const summary = session.summary;
  return `<div class="col" style="gap:18px;padding:18px 0 28px">
    <div class="col" style="align-items:center;padding:10px 0">
      <span class="submit-success-circle">${icon("check-circle", 34)}</span>
      <div style="height:16px"></div>
      <span class="headline-medium" style="color:var(--color-on-background)">${tx("提交成功", "Submitted")}</span>
      <div style="height:6px"></div>
      <span class="body-medium text-muted">${tx(`已计入 ${summary.creditedHours} 小时`, `${summary.creditedHours} hours credited`)}</span>
    </div>
    <div class="swiss-panel" style="padding:16px">
      <div class="col" style="gap:8px">
        ${summaryRow(tx("打卡日期", "Check-in date"), summary.date)}
        ${summaryRow(tx("开始时间", "Start time"), summary.startTime)}
        ${summaryRow(tx("结束时间", "End time"), summary.endTime)}
        ${summaryRow(tx("运动时长", "Exercise duration"), summary.duration)}
        ${summaryRow(tx("打卡类别", "Check-in category"), summary.creditType)}
        ${summaryRow(tx("运动项目", "Exercise type"), summary.sportType)}
        ${summaryRow(tx("凭证数量", "Proof count"), tx(`${summary.proofCount} 个`, `${summary.proofCount} items`))}
      </div>
    </div>
    <div class="col">
      <button class="checkin-cta pressable" data-action="checkin.viewRecords">${tx("查看打卡记录", "View check-in records")}</button>
      <button class="text-btn pressable" data-action="checkin.returnHome" style="width:100%">${tx("返回运动首页", "Back to exercise home")}</button>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  Records tab (#20 records) and record detail (#24)
// ═══════════════════════════════════════════════════════════════

const recordSportName = (record) => {
  const value = (record.sportType || "").trim();
  if (!value) {
    return ["", "运动打卡", "Exercise check-in"].includes(record.taskTitle.trim()) ? tx("运动打卡", "Exercise check-in") : record.taskTitle;
  }
  const map = {
    running: ["跑步", "Running"], 跑步: ["跑步", "Running"],
    basketball: ["篮球", "Basketball"], 篮球: ["篮球", "Basketball"],
    football: ["足球", "Football"], 足球: ["足球", "Football"],
    badminton: ["羽毛球", "Badminton"], 羽毛球: ["羽毛球", "Badminton"],
    table_tennis: ["乒乓球", "Table tennis"], 乒乓球: ["乒乓球", "Table tennis"],
    swimming: ["游泳", "Swimming"], 游泳: ["游泳", "Swimming"],
    fitness: ["健身", "Fitness"], 健身: ["健身", "Fitness"],
    cycling: ["骑行", "Cycling"], 骑行: ["骑行", "Cycling"],
    yoga: ["瑜伽", "Yoga"], 瑜伽: ["瑜伽", "Yoga"],
  };
  const match = map[value.toLowerCase()] || map[value];
  return match ? tx(match[0], match[1]) : value;
};

function proofSummaryText(record) {
  if (record.proofPhotoCount === 0 && record.proofVideoCount === 0) return record.proofSummary;
  const parts = [];
  if (record.proofPhotoCount > 0) parts.push(tx(`${record.proofPhotoCount} 张图片`, `${record.proofPhotoCount} ${record.proofPhotoCount === 1 ? "photo" : "photos"}`));
  if (record.proofVideoCount > 0) parts.push(tx(`${record.proofVideoCount} 个短视频`, `${record.proofVideoCount} ${record.proofVideoCount === 1 ? "video" : "videos"}`));
  return parts.join(tx("，", ", "));
}

function renderRecordsTab(app) {
  const records = app.state.workspace.records.filter((r) => r.creditType !== "offset");
  // Same rule as the dashboard progress: rejected records are listed but do
  // not add hours, so the two screens can never show different totals.
  const totalHours = records
    .filter((r) => r.reviewResult !== "INVALID")
    .reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const intro = `<div class="col" style="gap:18px">
    <div class="col" style="gap:6px">
      ${sectionTitle(tx("打卡记录", "Check-in records"))}
      <span class="body-medium text-muted">${tx("查看每次运动的学时与记录详情", "View the hours and details of every exercise.")}</span>
    </div>
    ${records.length ? `<div class="swiss-panel" style="padding:18px 20px">
      <div class="row">
        <div class="col grow" style="gap:3px">
          <span class="label-medium text-muted">${tx("计入学时", "Credited hours")}</span>
          <span class="headline-medium text-on-surface">${hourText(totalHours)}</span>
        </div>
        <div class="col" style="align-items:flex-end;gap:4px">
          <span class="body-medium text-on-surface" style="font-weight:500">${tx(`共 ${records.length} 条记录`, `${records.length} records`)}</span>
          <span class="body-small text-muted">${tx("运动记录汇总", "Exercise record summary")}</span>
        </div>
      </div>
    </div>` : ""}
  </div>`;

  const cards = records
    .map((record) => {
      const course = record.courseId ? app.state.workspace.courses.find((c) => c.id === record.courseId) : null;
      const courseName = course?.name || tx("自主运动", "Independent exercise");
      return `<button class="course-card pressable" data-action="checkin.openRecord" data-record-id="${esc(record.id)}" style="text-align:left">
        <div class="col" style="gap:4px">
          <span class="title-large text-on-surface ellipsis">${esc(recordSportName(record))}</span>
          <span class="body-small text-muted">${esc(record.submittedAt.split(" ")[0] || tx("未提供", "Not available"))}</span>
        </div>
        <div class="row">
          <span class="title-medium text-on-surface">${hourText(record.hours)}</span>
          <span style="width:6px"></span>
          <span class="body-small text-muted">${tx("计入学时", "Credited hours")}</span>
          <span class="grow"></span>
          ${record.reviewResult === "INVALID" || record.reviewResult === "PENDING"
            ? `${statusBadge(reviewStatusText(record))}<span style="width:8px"></span>`
            : ""}
          <span class="label-medium text-muted">${creditTypeLabel(record.creditType)}</span>
        </div>
        <div class="course-divider"></div>
        <div class="row">
          <div class="col grow" style="gap:7px;min-width:0">
            <span class="row" style="gap:8px"><span class="text-muted" style="display:inline-flex">${icon("school", 17)}</span><span class="body-small text-muted ellipsis">${esc(courseName)}</span></span>
            <span class="row" style="gap:8px"><span class="text-muted" style="display:inline-flex">${icon("attach-file", 17)}</span><span class="body-small text-muted ellipsis">${esc(proofSummaryText(record))}</span></span>
          </div>
          <span style="width:12px"></span>
          <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 20)}</span>
        </div>
      </button>`;
    })
    .join("");

  return `<div class="col" style="gap:14px;padding-bottom:28px">
    ${intro}
    ${records.length === 0
      ? emptyPlaceholder(tx("暂无记录", "No records"), tx("当前账号还没有可展示的打卡记录。", "There are no check-in records to show for this account."))
      : `<div class="row" style="padding-top:2px">
          <span class="title-medium text-on-surface grow">${tx("全部记录", "All records")}</span>
          <span class="label-medium text-muted">${tx(`${records.length} 条`, `${records.length} records`)}</span>
        </div>${cards}`}
  </div>`;
}

function mediaThumb(proof, aspect = "16/9") {
  const displayable = /^(https?:\/\/|content:\/\/|file:\/\/|blob:|data:|\/)/.test(proof.source || "");
  const inner = displayable && proof.type === "image"
    ? `<img src="${esc(proof.source)}" alt="${esc(proof.fileName)}" style="width:100%;height:100%;object-fit:cover">`
    : `<div class="col" style="align-items:center;justify-content:center;height:100%;gap:6px">
        ${icon(proof.type === "video" ? "videocam" : "photo", 28)}
        <span class="label-small" style="max-width:90%;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(proof.fileName || tx("媒体文件", "Media file"))}</span>
      </div>`;
  const videoOverlay = proof.type === "video"
    ? `<span class="media-play-overlay">${icon("play-arrow", 30)}</span><span class="media-video-tag">${tx("视频", "Video")}</span>`
    : "";
  return `<div class="media-thumb" style="aspect-ratio:${aspect}">${inner}${videoOverlay}</div>`;
}

function detailInfoRow(iconName, label, value, last = false) {
  return `<div class="row" style="align-items:flex-start;padding:9px 0">
      <span class="text-muted" style="display:inline-flex;flex:none">${icon(iconName, 18)}</span>
      <span style="width:10px"></span>
      <span class="body-medium text-muted" style="width:68px;flex:none">${esc(label)}</span>
      <span class="body-medium text-on-surface grow" style="font-weight:500">${esc(value)}</span>
    </div>${last ? "" : `<div class="course-divider"></div>`}`;
}

// Contract 2.0.2: a submitted record is VALID immediately, and the only later
// teacher action is appending INVALID. The student therefore has to be able to
// see that verdict — it is the sole reason credited hours can drop.
function reviewStatusText(record) {
  if (record.reviewResult === "VALID") return tx("有效", "Valid");
  if (record.reviewResult === "INVALID") return tx("无效", "Invalid");
  if (record.reviewResult === "PENDING") return tx("待审核", "Under review");
  return null;
}

function recordDetailTime(value) {
  if (!value) return tx("未提供", "Not available");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(currentLocale(), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function durationDetail(record) {
  const total = record.actualDurationSeconds;
  if (total === null || total === undefined) return tx("未提供", "Not available");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  let out = "";
  if (hours > 0) out += tx(`${hours}小时`, `${hours}h`);
  if (minutes > 0 || (hours === 0 && seconds === 0)) out += tx(`${minutes}分钟`, `${minutes}m`);
  if (seconds > 0) out += tx(`${seconds}秒`, `${seconds}s`);
  return out;
}

function renderRecordDetail(app, record) {
  const ui = checkinState(app);
  const course = record.courseId ? app.state.workspace.courses.find((c) => c.id === record.courseId) : null;
  const courseName = course?.name || tx("自主运动", "Independent exercise");
  const taskTitle = ["", "运动打卡", "Exercise check-in"].includes(record.taskTitle.trim()) ? tx("运动打卡", "Exercise check-in") : record.taskTitle;
  return `<div class="tab-content col" style="gap:14px">
    <button class="row pressable" data-action="checkin.recordBack" style="height:52px;width:100%">
      <span class="text-primary" style="display:inline-flex">${icon("chevron-left", 28)}</span>
      <span style="width:8px"></span>
      <span class="title-medium text-on-surface">${tx("打卡详情", "Check-in details")}</span>
    </button>
    <div class="swiss-panel" style="padding:20px">
      <div class="row"><span class="grow"></span><span class="body-small text-muted">${esc(record.submittedAt.split(" ")[0])}</span></div>
      <div style="height:18px"></div>
      <span class="headline-small text-on-surface">${esc(recordSportName(record))}</span>
      <div style="height:4px"></div>
      <span class="body-medium text-muted">${esc(taskTitle)}</span>
      <div class="course-divider" style="margin:20px 0 16px"></div>
      <span class="headline-medium text-on-surface">${hourText(record.hours)}</span>
      <span class="label-medium text-muted">${tx("计入学时", "Credited hours")}</span>
    </div>
    <div class="row" style="padding-top:8px"><span class="title-medium text-on-surface grow">${tx("记录信息", "Record information")}</span></div>
    <div class="swiss-panel" style="padding:6px 18px">
      ${reviewStatusText(record) ? detailInfoRow("info-outline", tx("审核状态", "Review status"), reviewStatusText(record)) : ""}
      ${detailInfoRow("timer", tx("提交时间", "Submitted"), record.submittedAt)}
      ${detailInfoRow("timer", tx("开始时间", "Started"), recordDetailTime(record.startTime))}
      ${detailInfoRow("timer", tx("结束时间", "Ended"), recordDetailTime(record.endTime))}
      ${detailInfoRow("timer", tx("实际运动时长", "Active duration"), durationDetail(record))}
      ${detailInfoRow("school", tx("关联课程", "Course"), courseName)}
      ${detailInfoRow("info-outline", tx("打卡类别", "Check-in category"), creditTypeLabel(record.creditType))}
      ${detailInfoRow("attach-file", tx("凭证", "Proof"), proofSummaryText(record), true)}
    </div>
    ${record.teacherPublicFeedback ? `
      <div class="row" style="padding-top:8px"><span class="title-medium text-on-surface grow">${tx("审核结果", "Review result")}</span></div>
      <div class="swiss-panel"><span class="body-medium text-on-surface">${esc(record.teacherPublicFeedback)}</span></div>` : ""}
    ${record.note ? `
      <div class="row" style="padding-top:8px"><span class="title-medium text-on-surface grow">${tx("运动说明", "Exercise notes")}</span></div>
      <div class="swiss-panel"><span class="body-medium text-on-surface">${esc(record.note)}</span></div>` : ""}
    ${record.remark ? `
      <div class="row" style="padding-top:8px"><span class="title-medium text-on-surface grow">${tx("补充备注", "Additional note")}</span></div>
      <div class="swiss-panel"><span class="body-medium text-on-surface">${esc(record.remark)}</span></div>` : ""}
    ${ui.recordOpenError ? validationPanel(ui.recordOpenError) : ""}
    <div class="row" style="padding-top:8px">
      <span class="title-medium text-on-surface grow">${tx("照片与视频", "Photos & videos")}</span>
      <span class="label-medium text-muted">${tx(`${record.proofFiles.length} 个`, `${record.proofFiles.length} items`)}</span>
    </div>
    ${record.proofFiles.length === 0
      ? emptyPlaceholder(tx("暂无照片或视频", "No photos or videos"), tx("这条记录没有可展示的媒体文件。", "This record has no media files to display."))
      : record.proofFiles
          .map(
            (proof) => `<button class="course-card pressable" data-action="checkin.openProof" data-source="${esc(proof.source)}" data-type="${proof.type}" style="padding:0;overflow:hidden;gap:0;text-align:left">
              ${mediaThumb(proof)}
              <div class="row" style="padding:12px 14px;gap:8px">
                <span class="text-muted" style="display:inline-flex">${icon(proof.type === "video" ? "videocam" : "photo", 18)}</span>
                <span class="body-medium text-on-surface grow ellipsis">${esc(proof.fileName)}</span>
                ${proof.durationSeconds ? `<span class="label-medium text-muted">${proof.durationSeconds >= 60 ? tx(`${Math.floor(proof.durationSeconds / 60)}分${Math.round(proof.durationSeconds % 60)}秒`, `${Math.floor(proof.durationSeconds / 60)}m${Math.round(proof.durationSeconds % 60)}s`) : tx(`${Math.round(proof.durationSeconds)}秒`, `${Math.round(proof.durationSeconds)}s`)}</span>` : ""}
                <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 20)}</span>
              </div>
            </button>`
          )
          .join("")}
    <div style="height:28px"></div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  Session transitions
// ═══════════════════════════════════════════════════════════════

function persist(app, session) {
  saveSession(accountId(app), session);
}

function apiFailureDialog(app, error, title) {
  const diagnostics = error instanceof ApiError
    ? `\n\n${tx("错误码", "Error code")}: ${error.code}${error.requestId ? `\nrequestId: ${error.requestId}` : ""}`
    : "";
  app.showDialog({
    title: title || tx("操作失败", "Action failed"),
    body: `${apiErrorText(error)}${diagnostics}`,
    buttons: [{ label: tx("我知道了", "Got it"), action: "dialog.close" }],
  });
}

function finishSession(app, session, { auto }) {
  const ui = checkinState(app);
  const duration = sessionDurationMs(session);
  if (duration < SESSION_MIN_CREDIT_MILLIS && !auto) {
    // <1h: no credit and the timer resets, but local drafts are KEPT so the
    // student can start again within today's open hours (v6.1 §4.6/§5.3).
    if (app.isApiMode() && session.serverId) {
      cancelServerSession(session.serverId, session.serverVersion, "under one hour, not credited").catch(() => {});
    }
    clearSession(accountId(app));
    app.showDialog({
      title: tx("运动提示", "Exercise notice"),
      body: tx(
        "运动时长未满 1 小时，本次不会计入打卡时长，计时已清零。已拍摄的本地草稿已保留，今日开放时段内可继续开始运动。",
        "This exercise is under 1 hour and will not count toward check-in hours. The timer was reset. Your local drafts were kept, and you can start again within today’s open hours."
      ),
      buttons: [{ label: tx("我知道了", "Got it"), action: "dialog.close" }],
    });
    return;
  }
  const complete = (serverSession) => {
    const paused = session.phase === "active" ? pauseSession(session) : session;
    const finished = {
      ...paused,
      phase: "finished",
      endedAt: Date.now(),
      activeDurationMillis: Math.min(paused.accumulatedMs, SESSION_MAX_MILLIS),
      serverVersion: serverSession ? serverSession.version : paused.serverVersion,
      serverActualDurationSeconds: serverSession ? serverSession.actualDurationSeconds : null,
    };
    ui.finish = { confirmed: false, submitting: false };
    persist(app, finished);
    app.render();
  };
  if (app.isApiMode() && session.serverId) {
    finishServerSession(session.serverId, session.serverVersion).then(complete, (error) => {
      apiFailureDialog(app, error, tx("结束运动失败", "Could not end the session"));
    });
  } else {
    complete(null);
  }
}

function pickCaptureInput(app, kind) {
  const input = app._viewport?.querySelector(`[data-capture-input="${kind}"]`);
  input?.click();
}

async function normalizeCapturedPhoto(file) {
  if (!canNormalizeCapturedImage(file)) throw new Error("unsupported-source-image");
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image-decode-failed"));
      element.src = sourceUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error("image-decode-failed");

    // Fresh JPEG bytes omit the original EXIF/GPS blocks. Backend still
    // performs the authoritative location-metadata and integrity checks.
    const maxDimension = 4096;
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("image-encode-unavailable");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const jpeg = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("image-encode-failed")), "image/jpeg", 0.9);
    });
    return new File([jpeg], `proof_photo_${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

async function readVideoDuration(url) {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    const finish = (value) => {
      video.removeAttribute("src");
      video.load();
      resolve(value);
    };
    video.preload = "metadata";
    video.onloadedmetadata = () => finish(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => finish(null);
    video.src = url;
  });
}

async function addDraftFromFile(app, file, type, replaceId = null) {
  const ui = checkinState(app);
  ui.captureError = null;
  const name = file.name || (type === "image" ? tx("图片文件", "image file") : tx("视频文件", "video file"));
  const rejectWith = (message) => {
    ui.captureError = message;
    app.render();
  };

  let uploadFile = file;
  if (type === "image") {
    try {
      uploadFile = await normalizeCapturedPhoto(file);
    } catch {
      rejectWith(tx(
        `「${name}」无法在当前浏览器中转换为不含位置元数据的 JPEG，请重新拍摄或使用 JPEG/PNG。`,
        `“${name}” cannot be converted to a location-metadata-free JPEG in this browser. Capture it again or use JPEG/PNG.`
      ));
      return;
    }
  }

  // Video duration is measured below. The one-second value here is only used
  // to run the exact MIME/size precheck and is never sent to Backend.
  const preVerdict = validateProofFile(uploadFile, type, { durationSeconds: type === "video" ? 1 : null });
  if (!preVerdict.ok) {
    if (preVerdict.error === "format" || preVerdict.error === "empty") {
      rejectWith(type === "video"
        ? tx(`「${name}」格式不支持。视频仅允许 MP4、MOV、3GP、WebM，且最终 MIME 不能为空。`, `“${name}” is unsupported. Videos must be MP4, MOV, 3GP, or WebM and the final MIME must not be empty.`)
        : tx(`「${name}」无法转换为有效的 JPEG/PNG。`, `“${name}” could not be converted to a valid JPEG/PNG.`));
    } else {
      rejectWith(type === "image"
        ? tx(`「${name}」超过单张图片 8MB 上限。`, `“${name}” exceeds the 8MB per-photo limit.`)
        : tx(`「${name}」文件过大，请重新录制。`, `“${name}” is too large. Record again.`));
    }
    return;
  }
  const url = URL.createObjectURL(uploadFile);
  let durationSeconds = null;
  let verdict = preVerdict;
  if (type === "video") {
    durationSeconds = await readVideoDuration(url);
    // The backend caps exercise videos at 15 recorded seconds; catching it here
    // saves the student an upload that would be rejected anyway.
    verdict = validateProofFile(uploadFile, type, { durationSeconds });
    if (!verdict.ok && verdict.error === "duration") {
      URL.revokeObjectURL(url);
      rejectWith(durationSeconds === null
        ? tx(`无法读取「${name}」的实际时长，请重新录制。`, `The actual duration of “${name}” could not be read. Record it again.`)
        : tx(
          `「${name}」时长 ${durationSeconds.toFixed(1)} 秒，超过 ${MAX_PROOF_VIDEO_SECONDS} 秒上限，请重新录制。`,
          `“${name}” is ${durationSeconds.toFixed(1)}s long, over the ${MAX_PROOF_VIDEO_SECONDS}s limit. Record again.`
        ));
      return;
    }
  }
  const draft = {
    id: replaceId || `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    fileName: `proof_${type === "image" ? "photo" : "video"}_${Date.now()}.${verdict.extension}`,
    byteCount: uploadFile.size,
    durationSeconds,
    url,
    blob: uploadFile,
    mimeType: verdict.mimeType,
  };
  const index = replaceId ? ui.drafts.findIndex((d) => d.id === replaceId) : -1;
  if (index >= 0) {
    if (ui.drafts[index].url?.startsWith("blob:")) URL.revokeObjectURL(ui.drafts[index].url);
    ui.drafts[index] = draft;
  } else {
    // A stale replace target (e.g. deleted meanwhile) falls back to appending
    // so the fresh capture is never silently dropped.
    ui.drafts.push(draft);
  }
  ui.mediaNotice = type === "image" ? tx("已添加现场照片。", "On-site photo added.") : tx("已添加现场视频。", "On-site video added.");
  app.render();
}

function submitCheckIn(app, session) {
  const ui = checkinState(app);
  const details = session.details;
  const retained = [...ui.drafts];
  if (retained.length === 0) {
    app.showDialog({ title: tx("凭证检查", "Proof check"), body: tx("请至少保留 1 项现场凭证", "Keep at least one on-site proof item."), buttons: [{ label: tx("确定", "OK"), action: "dialog.close" }] });
    return;
  }
  if (details.creditType === "general" && !(details.description || "").trim()) {
    app.showDialog({ title: tx("凭证检查", "Proof check"), body: tx("请填写运动说明", "Enter exercise details."), buttons: [{ label: tx("确定", "OK"), action: "dialog.close" }] });
    return;
  }
  const totalBytes = retained.reduce((sum, d) => sum + d.byteCount, 0);
  if (totalBytes > MAX_REQUEST_BYTES) {
    app.showDialog({ title: tx("凭证检查", "Proof check"), body: tx("凭证总大小超过 120MB，请减少后重试。", "Total proof size exceeds 120MB. Remove some and try again."), buttons: [{ label: tx("确定", "OK"), action: "dialog.close" }] });
    return;
  }
  ui.finish.submitting = true;
  app.render();
  if (app.isApiMode() && session.serverId) {
    submitCheckInApi(app, session, retained);
    return;
  }
  setTimeout(() => {
    ui.finish.submitting = false;
    const credited = creditedHours(session.activeDurationMillis);
    const pad = (n) => String(n).padStart(2, "0");
    const started = new Date(session.startedAt);
    const submittedAt = `${started.getFullYear()}-${pad(started.getMonth() + 1)}-${pad(started.getDate())} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
    const currentCourse = findCurrentCourse(app.state.workspace);
    const proofs = retained.map((d, index) => ({
      id: `${session.startedAt}-proof-${index}`,
      type: d.type,
      fileName: d.fileName,
      byteCount: d.byteCount,
      durationSeconds: d.durationSeconds,
      source: d.url || "",
    }));
    const record = {
      id: `record-${session.startedAt}`,
      courseId: details.creditType === "course" ? currentCourse?.id || null : null,
      taskTitle: tx("运动打卡", "Exercise check-in"),
      creditType: details.creditType,
      hours: credited,
      submittedAt,
      proofSummary: `${proofs.filter((p) => p.type === "image").length} 张图片${proofs.some((p) => p.type === "video") ? "，1 个短视频" : ""}`,
      proofPhotoCount: proofs.filter((p) => p.type === "image").length,
      proofVideoCount: proofs.filter((p) => p.type === "video").length,
      proofFiles: proofs,
      teacherPublicFeedback: null,
      teacherInternalNote: null,
      note: details.description || "",
      sportType: sportLabel(details),
      startTime: new Date(session.startedAt).toISOString(),
      endTime: new Date(session.endedAt).toISOString(),
      actualDurationSeconds: Math.floor(session.activeDurationMillis / 1000),
    };
    app.overlay.newRecords.unshift(record);
    app.saveOverlay();
    app.state.workspace.records.unshift(record);
    const progress = app.state.workspace.progress;
    if (record.creditType === "course") {
      progress.course += credited;
      progress.rawCourse += credited;
    } else {
      progress.general += credited;
      progress.rawGeneral += credited;
    }
    const submitted = {
      phase: "submitted",
      summary: {
        date: formatDateOnly(session.startedAt),
        startTime: formatTimeOnly(session.startedAt),
        endTime: formatTimeOnly(session.endedAt),
        duration: formatTimer(session.activeDurationMillis),
        creditedHours: credited,
        creditType: creditTypeLabel(details.creditType),
        sportType: sportLabel(details),
        proofCount: proofs.length,
      },
    };
    persist(app, submitted);
    ui.drafts = [];
    app.render();
  }, 900);
}

/** Real submission: record draft → media upload/confirm/bind → submit. */
async function submitCheckInApi(app, session, retained) {
  const ui = checkinState(app);
  const details = session.details;
  try {
    // A retried submission finds its daily draft already created — reuse it.
    let record = (await listMyRecords()).find(
      (r) => r.status === "DRAFT" && r.sessionId === session.serverId
    ) || null;
    if (!record) {
      record = await createRecordDraft({
        sessionId: session.serverId,
        creditType: details.creditType,
        sportType: details.sportType,
        sportName: details.customSportName || null,
        description: (details.description || "").trim() || null,
      });
    }
    const uploaded = [];
    for (let index = 0; index < retained.length; index++) {
      const draft = retained[index];
      ui.mediaNotice = tx(`正在处理凭证 ${index + 1}/${retained.length}…`, `Processing proof ${index + 1}/${retained.length}…`);
      app.render();
      const blob = draft.blob || (await fetch(draft.url).then((r) => r.blob()));
      const mediaId = draft.mediaId || (await uploadMediaDraft(session.serverId, draft, blob)).mediaId;
      uploaded.push({
        mediaId,
        type: draft.type,
        fileName: draft.fileName,
        byteCount: draft.byteCount,
        durationSeconds: draft.durationSeconds,
      });
    }
    ui.mediaNotice = tx("全部凭证已验证，正在提交打卡…", "All proof is verified. Submitting the check-in…");
    app.render();
    const submittedRecord = await submitRecord(record.id, uploaded.map((u) => u.mediaId), record.version);
    cacheRecordProofs(record.id, uploaded);
    ui.finish.submitting = false;
    const credited = (submittedRecord.creditedDurationSeconds || 0) / 3600 || creditedHours(session.activeDurationMillis);
    const submitted = {
      phase: "submitted",
      summary: {
        date: formatDateOnly(session.startedAt),
        startTime: formatTimeOnly(session.startedAt),
        endTime: formatTimeOnly(session.endedAt),
        duration: formatTimer(session.activeDurationMillis),
        creditedHours: credited,
        creditType: creditTypeLabel(details.creditType),
        sportType: sportLabel(details),
        proofCount: uploaded.length,
      },
    };
    persist(app, submitted);
    for (const draft of ui.drafts) if (draft.url?.startsWith("blob:")) URL.revokeObjectURL(draft.url);
    ui.drafts = [];
    app.render();
    app.reloadApiWorkspace();
  } catch (error) {
    ui.finish.submitting = false;
    apiFailureDialog(app, error, tx("提交失败", "Submission failed"));
    app.render();
  }
}

// 1 Hz heartbeat: refresh timer text in place; auto end at the 2h cap.
export function checkinTick(app) {
  if (!app.state.authenticated) return;
  const session = loadSession(accountId(app));
  if (!session) return;
  if (session.phase === "active") {
    if (shouldAutoEnd(session)) {
      // The 2h cap pauses timing and forces the completion step (non-cancellable).
      const ui = checkinState(app);
      const paused = pauseSession(session);
      const finished = { ...paused, phase: "finished", endedAt: Date.now(), activeDurationMillis: Math.min(paused.accumulatedMs, SESSION_MAX_MILLIS) };
      ui.finish = { confirmed: false, submitting: false };
      if (app.isApiMode() && finished.serverId) {
        finishServerSession(finished.serverId, finished.serverVersion)
          .then((serverSession) => {
            const current = loadSession(accountId(app));
            if (current?.serverId === finished.serverId) {
              persist(app, { ...current, serverVersion: serverSession.version, serverActualDurationSeconds: serverSession.actualDurationSeconds });
            }
          })
          .catch(() => { /* the submit step surfaces any leftover state errors */ });
      }
      persist(app, finished);
      app.showDialog({
        title: tx("今日运动已达 2 小时上限", "Daily exercise limit reached"),
        body: tx("计时已自动暂停，运动时长不再累计。请进入下一步补充运动说明，并保留至少 1 项现场凭证后提交打卡。", "The timer has paused and no more time will be counted. Next, add exercise notes and retain at least one on-site proof item before submitting."),
        dismissible: false,
        buttons: [{ label: tx("去补充说明和凭证", "Add notes and proof"), action: "dialog.close" }],
      });
      return;
    }
    const duration = sessionDurationMs(session);
    const timerEl = app._viewport?.querySelector("[data-timer-value]");
    if (timerEl) timerEl.textContent = formatTimer(duration);
    const hoursEl = app._viewport?.querySelector("[data-timer-hours]");
    if (hoursEl) hoursEl.textContent = `${creditedHours(duration)}h`;
    const dashboardEl = app._viewport?.querySelector("[data-dashboard-duration]");
    if (dashboardEl) dashboardEl.textContent = formatTimer(duration);
  }
}

// ═══════════════════════════════════════════════════════════════
//  Actions
// ═══════════════════════════════════════════════════════════════

export const checkinActions = {
  "checkin.noop": () => {},
  "checkin.tab": (app, el) => {
    checkinState(app).tab = el.dataset.tab;
    app.render();
  },
  "checkin.creditType": (app, el) => {
    checkinState(app).setup.creditType = el.dataset.value;
    app.render();
  },
  "checkin.sport": (app, el) => {
    const ui = checkinState(app);
    if (ui.setup.creditType !== "general") return;
    ui.setup.generalSportType = el.dataset.value;
    if (el.dataset.value !== OTHER) ui.setup.generalCustomSportName = "";
    app.render();
  },
  "checkin.customSport": (app, el) => {
    const ui = checkinState(app);
    ui.setup.generalCustomSportName = el.value.slice(0, 32);
    const counter = app._viewport?.querySelector("[data-custom-sport-counter]");
    if (counter) counter.textContent = `${ui.setup.generalCustomSportName.length}/32`;
    const startBtn = app._viewport?.querySelector('[data-action="checkin.start"]');
    if (startBtn) startBtn.disabled = ui.setup.generalCustomSportName.trim() === "";
  },
  "checkin.start": (app) => {
    const ui = checkinState(app);
    const readiness = evaluateReadiness(app);
    if (!readiness.canStart) {
      app.render();
      return;
    }
    const workspace = app.state.workspace;
    const currentCourse = findCurrentCourse(workspace);
    const isCourse = ui.setup.creditType === "course";
    const courseSport = currentCourse ? courseSportSelection(currentCourse.name) : null;
    const details = {
      creditType: ui.setup.creditType,
      sportType: isCourse ? courseSport?.sportType || OTHER : ui.setup.generalSportType,
      customSportName: isCourse
        ? courseSport?.customSportName || null
        : ui.setup.generalSportType === OTHER
          ? ui.setup.generalCustomSportName.trim()
          : null,
      description: "",
    };
    const afterStart = (serverSession) => {
      const local = startSession(details);
      if (serverSession) {
        local.serverId = serverSession.id;
        local.serverVersion = serverSession.version;
        local.enrollmentId = serverSession.enrollmentId;
      }
      persist(app, local);
      // Drafts kept from an under-1h attempt stay available (v6.1 §5.3);
      // submission and explicit discard are the only clearing points.
      app.render();
    };
    const begin = () => {
      if (!app.isApiMode()) { afterStart(null); return; }
      const enrollmentId = currentCourse?.enrollmentId
        || workspace.courses.find((c) => c.enrollmentId)?.enrollmentId;
      if (!enrollmentId) {
        apiFailureDialog(app, new ApiError(400, { code: "NO_ENROLLMENT", message: "" }), tx("无法开始运动", "Cannot start"));
        return;
      }
      const startOnServer = () => startServerSession(enrollmentId).then(afterStart);
      startOnServer().catch((error) => {
        // The backend refuses a new session once the qualifying total is
        // reached, reusing SESSION_ALREADY_COMPLETED. That is not a stray
        // session, so it must not trigger the cleanup-and-retry below.
        if (isQualificationReached(error)) throw error;
        // A stray active server session (e.g. cleared local storage) blocks new
        // starts — cancel it once and retry.
        if (error instanceof ApiError && error.status === 409) {
          return getActiveSession().then((active) => {
            if (!active) throw error;
            return cancelServerSession(active.id, active.version, "orphaned session cleanup")
              .then(startOnServer);
          });
        }
        throw error;
      }).catch((error) => {
        if (isQualificationReached(error)) {
          app.showDialog({
            title: tx("已达到合格时长", "Qualifying hours reached"),
            body: sessionStartErrorText(error),
            buttons: [{ label: tx("我知道了", "Got it"), action: "dialog.close" }],
          });
          return;
        }
        apiFailureDialog(app, error, tx("无法开始运动", "Cannot start"));
      });
    };
    if (!healthAcknowledged(app)) {
      // First-time health and safety reminder ("我知道了" only).
      app.showDialog({
        title: tx("健康安全提醒", "Health and safety reminder"),
        body: tx("请根据自身身体状况适量运动。如感不适应立即停止，必要时及时就医。", "Exercise within your limits. Stop immediately if you feel unwell and seek medical help when necessary."),
        dismissible: false,
        buttons: [{ label: tx("我知道了", "Got it"), action: "checkin.ackHealth" }],
      });
      return;
    }
    begin();
  },
  "checkin.ackHealth": (app) => {
    app.overlay.healthReminderAck = true;
    app.saveOverlay();
    app.state.dialog = null;
    checkinActions["checkin.start"](app);
  },
  "checkin.pause": (app) => {
    const session = loadSession(accountId(app));
    if (session?.phase !== "active") return;
    const apply = (serverSession) => {
      const paused = pauseSession(session);
      if (serverSession) paused.serverVersion = serverSession.version;
      persist(app, paused);
      app.render();
    };
    if (app.isApiMode() && session.serverId) {
      pauseServerSession(session.serverId, session.serverVersion).then(apply, (error) => apiFailureDialog(app, error, tx("暂停失败", "Pause failed")));
    } else {
      apply(null);
    }
  },
  "checkin.resume": (app) => {
    const session = loadSession(accountId(app));
    if (session?.phase !== "paused") return;
    const apply = (serverSession) => {
      const resumed = resumeSession(session);
      if (serverSession) resumed.serverVersion = serverSession.version;
      persist(app, resumed);
      app.render();
    };
    if (app.isApiMode() && session.serverId) {
      resumeServerSession(session.serverId, session.serverVersion).then(apply, (error) => apiFailureDialog(app, error, tx("继续失败", "Resume failed")));
    } else {
      apply(null);
    }
  },
  "checkin.requestFinish": (app) => {
    const session = loadSession(accountId(app));
    if (!session) return;
    const duration = sessionDurationMs(session);
    const short = duration < SESSION_MIN_CREDIT_MILLIS;
    app.showDialog({
      title: tx("你确定要结束本次运动吗？", "End this exercise session?"),
      body: short
        ? tx("运动未满 1 小时，结束后不会计入打卡，计时将清零；已拍摄的本地草稿将保留。", "This exercise is under 1 hour. Ending it will not count toward check-in hours and will reset the timer; your local drafts will be kept.")
        : "",
      buttons: [
        { label: tx("取消", "Cancel"), action: "dialog.close" },
        { label: tx("确认结束", "End exercise"), action: "checkin.confirmFinish" },
      ],
    });
  },
  "checkin.confirmFinish": (app) => {
    app.state.dialog = null;
    const session = loadSession(accountId(app));
    if (!session) return;
    finishSession(app, session, { auto: false });
  },
  "checkin.debugAddHour": (app) => {
    const session = loadSession(accountId(app));
    if (!session || (session.phase !== "active" && session.phase !== "paused")) return;
    persist(app, { ...session, accumulatedMs: session.accumulatedMs + 60 * 60 * 1000 });
    app.render();
  },
  "checkin.capturePhoto": (app) => pickCaptureInput(app, "photo"),
  "checkin.captureVideo": (app) => {
    // Just-in-time video/audio disclosure before the system camera opens.
    app.showDialog({
      title: tx("录像与声音说明", "Video and audio notice"),
      body: tx(
        `继续后将打开设备的系统相机录制视频。按打卡规则，视频最长 ${MAX_PROOF_VIDEO_SECONDS} 秒且必须包含声音——请勿在系统相机中关闭录音，否则提交时会被退回并需要重录。视频仅在你明确提交后才会上传；提交前可随时删除草稿。`,
        `Continuing opens your device's system camera. Check-in videos may be at most ${MAX_PROOF_VIDEO_SECONDS} seconds and must contain sound — do not mute the camera, or the submission will be rejected and you will need to record again. The video is uploaded only after you explicitly submit it, and you can remove the draft before then.`
      ),
      buttons: [
        { label: tx("取消", "Cancel"), action: "dialog.close" },
        { label: tx("继续录制", "Continue recording"), action: "checkin.videoNoticeContinue" },
      ],
    });
  },
  "checkin.videoNoticeContinue": (app) => {
    app.state.dialog = null;
    app.render();
    pickCaptureInput(app, "video");
  },
  "checkin.photoPicked": (app, el) => {
    const file = el.files?.[0];
    el.value = "";
    if (!file) return;
    const ui = checkinState(app);
    addDraftFromFile(app, file, "image", ui.pendingRetakeId || null);
    ui.pendingRetakeId = null;
  },
  "checkin.videoPicked": (app, el) => {
    const file = el.files?.[0];
    el.value = "";
    if (!file) return;
    const ui = checkinState(app);
    addDraftFromFile(app, file, "video", ui.pendingRetakeId || null);
    ui.pendingRetakeId = null;
  },
  "checkin.retakeDraft": (app, el) => {
    const ui = checkinState(app);
    const draft = ui.drafts.find((d) => d.id === el.dataset.draftId);
    if (!draft || ui.finish.submitting || draft.mediaId) return;
    ui.pendingRetakeId = draft.id;
    if (draft.type === "video") {
      checkinActions["checkin.captureVideo"](app);
    } else {
      pickCaptureInput(app, "photo");
    }
  },
  "checkin.deleteDraft": (app, el) => {
    const ui = checkinState(app);
    const draftId = el.dataset.draftId;
    const draft = ui.drafts.find((item) => item.id === draftId);
    if (!draft || ui.finish.submitting || draft.mediaId) return;
    app.showDialog({
      title: tx("删除这条媒体？", "Delete this media?"),
      body: tx("删除后不可恢复。", "This cannot be undone."),
      buttons: [
        { label: tx("取消", "Cancel"), action: "dialog.close" },
        { label: tx("删除", "Delete"), action: "checkin.deleteDraftConfirm", args: { "draft-id": draftId } },
      ],
    });
  },
  "checkin.deleteDraftConfirm": (app, el) => {
    const ui = checkinState(app);
    const draft = ui.drafts.find((d) => d.id === el.dataset.draftId);
    if (!draft || ui.finish.submitting || draft.mediaId) return;
    if (draft?.url?.startsWith("blob:")) URL.revokeObjectURL(draft.url);
    ui.drafts = ui.drafts.filter((d) => d.id !== el.dataset.draftId);
    app.state.dialog = null;
    app.render();
  },
  "checkin.description": (app, el) => {
    const session = loadSession(accountId(app));
    if (!session || session.phase !== "finished") return;
    session.details.description = el.value.slice(0, MAX_DESCRIPTION);
    persist(app, session);
    const counter = app._viewport?.querySelector("[data-description-counter]");
    if (counter) counter.textContent = tx(`已输入 ${session.details.description.length}/${MAX_DESCRIPTION}`, `${session.details.description.length}/${MAX_DESCRIPTION} entered`);
  },
  "checkin.confirm": (app, el) => {
    checkinState(app).finish.confirmed = el.checked;
    const submit = app._viewport?.querySelector('[data-action="checkin.submit"]');
    if (submit) submit.disabled = !el.checked || checkinState(app).finish.submitting || !app.isWriteAllowed();
  },
  "checkin.submit": (app) => {
    const session = loadSession(accountId(app));
    if (!session || session.phase !== "finished") return;
    if (!checkinState(app).finish.confirmed || !app.isWriteAllowed()) return;
    submitCheckIn(app, session);
  },
  "checkin.abandon": (app) => {
    app.showDialog({
      title: tx("放弃待提交记录？", "Discard pending record?"),
      body: tx("本次运动时长和所有本地媒体草稿都会被删除。", "The exercise duration and all local media drafts will be deleted."),
      buttons: [
        { label: tx("取消", "Cancel"), action: "dialog.close" },
        { label: tx("确认放弃", "Discard"), action: "checkin.abandonConfirm" },
      ],
    });
  },
  "checkin.abandonConfirm": (app) => {
    const ui = checkinState(app);
    const session = loadSession(accountId(app));
    if (app.isApiMode() && session?.serverId && session.phase !== "finished") {
      cancelServerSession(session.serverId, session.serverVersion, "student discarded").catch(() => {});
    }
    for (const draft of ui.drafts) if (draft.url?.startsWith("blob:")) URL.revokeObjectURL(draft.url);
    ui.drafts = [];
    clearSession(accountId(app));
    app.state.dialog = null;
    app.render();
  },
  "checkin.viewRecords": (app) => {
    clearSession(accountId(app));
    checkinState(app).tab = "records";
    app.render();
  },
  "checkin.returnHome": (app) => {
    clearSession(accountId(app));
    checkinState(app).tab = "exercise";
    app.render();
  },
  "checkin.openRecord": (app, el) => {
    const ui = checkinState(app);
    ui.selectedRecordId = el.dataset.recordId;
    ui.recordOpenError = null;
    app.navDirection = "forward";
    app.render();
  },
  "checkin.recordBack": (app) => {
    checkinState(app).selectedRecordId = null;
    app.navDirection = "back";
    app.render();
  },
  "checkin.openProof": (app, el) => {
    const ui = checkinState(app);
    const source = el.dataset.source || "";
    if (source.startsWith("media:")) {
      // Real backend media: exchange the id for a short-lived access URL.
      createMediaAccessUrl(source.slice(6)).then(
        (access) => { globalThis.open(proxyObjectUrl(access.accessUrl), "_blank", "noopener"); },
        (error) => {
          ui.recordOpenError = apiErrorText(error);
          app.render();
        }
      );
      ui.recordOpenError = null;
      return;
    }
    if (/^(https?:\/\/|blob:|data:)/.test(source)) {
      globalThis.open(source, "_blank", "noopener");
      ui.recordOpenError = null;
    } else {
      ui.recordOpenError = tx("该媒体文件没有可用的预览地址。", "This media file has no usable preview address.");
      app.render();
    }
  },
};

// Record detail back returns to the record list (返回规则).
export function checkinBackInterceptor(app) {
  if (app.screenKey() === "tab-checkin" && app.ui.checkin?.selectedRecordId) {
    app.ui.checkin.selectedRecordId = null;
    app.navDirection = "back";
    app.render();
    return true;
  }
  return false;
}
