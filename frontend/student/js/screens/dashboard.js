// Dashboard (#15) — feature/dashboard/DashboardScreen.kt.
// Section order: header → today check-in (with enrollment) → new-semester
// welcome (conditional) → join request entry OR course join entry → ongoing
// exercise resume (conditional) → total progress → breakdown.

import { t, tx, currentLocale } from "../i18n.js";
import { icon } from "../icons.js";
import { esc } from "../ui.js";
import { hourText } from "../data.js";
import { canStartExercise, hasSubmittedCheckInToday, loadSession, sessionDurationMs, formatTimer } from "../session.js";
import { joinRequestEntryPanel } from "./join.js";

function homeCard(contentHtml, padding = 18) {
  return `<div class="swiss-panel" style="padding:${padding}px">${contentHtml}</div>`;
}

function homeStatusPill(text, emphasized) {
  return `<span class="home-pill${emphasized ? " emphasized" : ""}">${esc(text)}</span>`;
}

function homeProgressBar(value, total, height) {
  const progress = total <= 0 ? 0 : Math.min(Math.max(value / total, 0), 1);
  return `<div class="home-progress" style="height:${height}px"><div class="fill" style="width:${progress * 100}%"></div></div>`;
}

function progressFactRow(label, value, emphasized = false) {
  return `<div class="row">
    <span class="body-small text-muted">${esc(label)}</span>
    <span class="grow"></span>
    <span class="body-small" style="color:${emphasized ? "var(--color-on-surface)" : "var(--color-on-surface-variant)"};font-weight:${emphasized ? 500 : 400}">${esc(value)}</span>
  </div>`;
}

function progressMetric({ title, value, total, rawValue, remaining }) {
  const offsetHours = Math.max(0, value - rawValue);
  const detail = remaining === 0
    ? t("dashboard_completed")
    : offsetHours > 0
      ? t("dashboard_remaining_after_offset", hourText(remaining))
      : t("dashboard_remaining", hourText(remaining));
  return `<div class="col" style="gap:10px">
    <div class="row" style="gap:12px">
      <span class="title-medium text-on-surface grow" style="font-weight:500">${esc(title)}</span>
      ${homeStatusPill(detail, value >= total)}
    </div>
    ${homeProgressBar(value, total, 6)}
    ${progressFactRow(t("dashboard_checked_in"), hourText(rawValue))}
    ${offsetHours > 0 ? progressFactRow(t("dashboard_organization_offset"), t("dashboard_offset_applied", hourText(offsetHours))) : ""}
    ${progressFactRow(t("dashboard_total"), `${hourText(value)} / ${hourText(total)}`, true)}
  </div>`;
}

function derivedProgress(app) {
  const progress = app.state.workspace.progress;
  const rule = app.state.workspace.hourRule;
  const cappedCourse = Math.min(progress.course, rule.courseRequired);
  const cappedGeneral = Math.min(progress.general, rule.generalRequired);
  const totalCompleted = Math.min(cappedCourse + cappedGeneral, rule.total);
  return {
    totalCompleted,
    totalRemaining: Math.max(0, rule.total - totalCompleted),
    completionRatio: rule.total <= 0 ? 0 : Math.min(1, totalCompleted / rule.total),
    courseRemaining: Math.max(0, rule.courseRequired - progress.course),
    generalRemaining: Math.max(0, rule.generalRequired - progress.general),
  };
}

export function renderDashboard(app) {
  const workspace = app.state.workspace;
  const student = workspace.student;
  const unread = app.unreadNoticeCount();
  const d = derivedProgress(app);
  const hasHourRisk = d.courseRemaining > 0 || d.generalRemaining > 0;
  const hasEnrollment = app.hasActiveEnrollment();
  const hasCheckedIn = hasSubmittedCheckInToday(workspace);

  // — Header —
  const header = `<div class="row" style="gap:16px">
    <div class="col grow" style="gap:4px">
      <span class="headline-large ellipsis" style="color:var(--color-on-surface);font-weight:700">${t("dashboard_greeting", esc(student.name))}</span>
      <span class="body-medium text-muted ellipsis">${esc(student.id)}</span>
    </div>
    <span class="bell-wrap">
      <button class="bell-btn pressable" data-action="dashboard.openNotifications" aria-label="${t("dashboard_open_notifications")}">
        ${icon("notifications", 22)}
      </button>
      ${unread > 0 ? `<span class="bell-badge">${unread > 99 ? "99+" : unread}</span>` : ""}
    </span>
  </div>`;

  // — Today check-in —
  let todayPanel = "";
  if (hasEnrollment) {
    const timeWindow = workspace.checkInTimeWindow;
    const isLoadingPolicy = timeWindow.windowMode === "unavailable";
    const blockedReason = isLoadingPolicy ? null : canStartExercise(timeWindow);
    const canStart = !isLoadingPolicy && blockedReason === null;
    const stateColor = isLoadingPolicy
      ? ["var(--color-surface-variant)", "var(--color-on-surface-variant)"]
      : canStart
        ? ["var(--color-primary-container)", "var(--color-on-primary-container)"]
        : ["var(--color-error-container)", "var(--color-on-error-container)"];
    const windowTitle = isLoadingPolicy
      ? tx("正在同步打卡时间窗", "Syncing check-in hours")
      : canStart
        ? tx("当前可开始运动", "You can start exercising now")
        : tx("当前不可开始运动", "You cannot start exercising now");
    const windowDetail = isLoadingPolicy
      ? tx("加载完成后将显示当前状态", "Your current status will appear once loading finishes.")
      : canStart
        ? tx(`每日打卡时间 ${timeWindow.dailyStartTime}–${timeWindow.dailyEndTime}`, `Daily check-in hours ${timeWindow.dailyStartTime}–${timeWindow.dailyEndTime}`)
        : blockedReason || "";
    const pillText = isLoadingPolicy ? tx("同步中", "Syncing") : canStart ? tx("可开始", "Available") : tx("不可开始", "Unavailable");
    todayPanel = homeCard(`
      <div class="row" style="gap:12px">
        <span class="title-large text-on-surface grow">${t("dashboard_today_checkin")}</span>
        ${hasCheckedIn ? `<span class="text-primary" style="display:inline-flex">${icon("check-circle", 22)}</span>` : ""}
      </div>
      <div style="height:16px"></div>
      <div class="headline-small text-on-surface">${t(hasCheckedIn ? "dashboard_today_checkin_complete" : "dashboard_today_checkin_pending")}</div>
      <div style="height:6px"></div>
      <div class="body-medium text-muted">${t(hasCheckedIn ? "dashboard_today_checkin_complete_hint" : "dashboard_today_checkin_pending_hint")}</div>
      <div style="height:16px"></div>
      <div class="row" style="gap:10px">
        <span class="window-icon" style="background:${stateColor[0]};color:${stateColor[1]}">${icon("timer", 18)}</span>
        <div class="col grow">
          <span class="body-medium text-on-surface" style="font-weight:500">${esc(windowTitle)}</span>
          <span class="body-small text-muted">${esc(windowDetail)}</span>
        </div>
        <span class="home-pill" style="background:${stateColor[0]};color:${stateColor[1]};font-weight:600">${esc(pillText)}</span>
      </div>
      ${!hasCheckedIn ? `<div style="height:20px"></div>
        <button class="primary-btn pressable" data-action="dashboard.openCheckIn">${icon("add-box", 20)}<span>${t("dashboard_start_checkin")}</span></button>` : ""}
    `, 20);
  }

  // — Join request entry / course join entry —
  const request = workspace.courseJoinRequest;
  const hasPendingJoinRequest = request && request.status !== "ACTIVE";
  let joinPanel = "";
  if (hasPendingJoinRequest) {
    joinPanel = joinRequestEntryPanel(request);
  } else if (!hasEnrollment) {
    joinPanel = homeCard(`
      <div class="title-large text-on-surface">${t("dashboard_join_course")}</div>
      <div style="height:8px"></div>
      <div class="body-medium text-muted">${t("dashboard_join_course_hint")}</div>
      <div style="height:20px"></div>
      <button class="primary-btn pressable" data-action="dashboard.scanJoin">${icon("qr-code-scanner", 20)}<span>${t("login_scan_button")}</span></button>
      <div style="height:4px"></div>
      <button class="text-btn pressable" data-action="dashboard.enterCode" style="width:100%;min-height:48px">
        ${icon("text-fields", 18)}<span class="label-large">${t("dashboard_enter_invite")}</span>
      </button>
    `);
  }

  // — Ongoing exercise resume —
  const session = loadSession(student.id);
  let resumePanel = "";
  if (session && (session.phase === "active" || session.phase === "paused")) {
    const duration = sessionDurationMs(session);
    const startTime = new Date(session.startedAt).toLocaleTimeString(currentLocale(), { hour: "2-digit", minute: "2-digit", hour12: false });
    resumePanel = homeCard(`
      <div class="row" style="gap:10px">
        <span class="text-primary" style="display:inline-flex">${icon("timer", 22)}</span>
        <span class="title-large text-on-surface">${t("dashboard_exercise_in_progress")}</span>
      </div>
      <div style="height:16px"></div>
      <div class="row"><span class="body-medium text-muted">${t("dashboard_exercise_start_time")}</span><span class="grow"></span><span class="body-medium text-on-surface" style="font-weight:500">${startTime}</span></div>
      <div style="height:10px"></div>
      <div class="row"><span class="body-medium text-muted">${t("dashboard_exercise_duration")}</span><span class="grow"></span><span class="body-medium text-on-surface" style="font-weight:500" data-dashboard-duration>${formatTimer(duration)}</span></div>
      <div style="height:20px"></div>
      <button class="primary-btn pressable" data-action="dashboard.openCheckIn">${icon("timer", 20)}<span>${t("dashboard_exercise_continue")}</span></button>
    `);
  }

  // — Progress overview —
  const completionPercent = Math.floor(d.completionRatio * 100);
  const overview = homeCard(`
    <div class="row" style="gap:12px">
      <span class="title-large text-on-surface grow">${t("dashboard_progress")}</span>
      ${homeStatusPill(workspace.progress.status, !hasHourRisk)}
    </div>
    <div style="height:28px"></div>
    <div class="body-small text-muted">${t("dashboard_total_completed")}</div>
    <div style="height:4px"></div>
    <div class="row" style="align-items:flex-end">
      <span style="font-size:44px;line-height:50px;font-weight:600;letter-spacing:-1px;color:var(--color-on-surface)">${hourText(d.totalCompleted)}</span>
      <span style="width:8px"></span>
      <span class="title-medium text-muted" style="padding-bottom:6px">/ ${hourText(workspace.hourRule.total)}</span>
      <span class="grow"></span>
      <span class="headline-small text-primary" style="padding-bottom:4px">${completionPercent}%</span>
    </div>
    <div style="height:18px"></div>
    ${homeProgressBar(d.totalCompleted, workspace.hourRule.total, 8)}
    <div style="height:12px"></div>
    <div class="body-medium" style="color:${d.totalRemaining === 0 ? "var(--color-primary)" : "var(--color-on-surface-variant)"};font-weight:${d.totalRemaining === 0 ? 500 : 400}">
      ${d.totalRemaining === 0 ? t("dashboard_goal_reached") : t("dashboard_total_remaining", hourText(d.totalRemaining))}
    </div>
  `, 20);

  // — Breakdown —
  const breakdown = `<div class="col" style="gap:12px">
    <span class="title-large text-on-surface">${t("dashboard_breakdown")}</span>
    ${homeCard(`
      ${progressMetric({ title: t("dashboard_course_exercise"), value: workspace.progress.course, total: workspace.hourRule.courseRequired, rawValue: workspace.progress.rawCourse, remaining: d.courseRemaining })}
      <div class="course-divider" style="margin:20px 0"></div>
      ${progressMetric({ title: t("dashboard_general_exercise"), value: workspace.progress.general, total: workspace.hourRule.generalRequired, rawValue: workspace.progress.rawGeneral, remaining: d.generalRemaining })}
    `)}
  </div>`;

  return `<div class="tab-content col" style="gap:28px;padding-top:4px">
    ${header}
    ${todayPanel}
    ${joinPanel}
    ${resumePanel}
    ${overview}
    ${breakdown}
  </div>`;
}

export const dashboardActions = {
  "dashboard.openNotifications": (app) => {
    app.state.notificationSheetOpen = true;
    app.ui.notifications = null;
    app.render();
  },
  "dashboard.openCheckIn": (app) => app.selectTab("checkin"),
  "dashboard.scanJoin": (app) => {
    app.ui.scan = null;
    app.openSub("scan", {});
  },
  "dashboard.enterCode": (app) => {
    app.ui.enterCode = null;
    app.openSub("enterCode", {});
  },
};
