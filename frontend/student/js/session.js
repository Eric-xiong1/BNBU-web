// Exercise session model + check-in time-window policy evaluator,
// replicated from feature/checkin/session/* and ExerciseCheckInScreen.kt
// (CheckInTimeWindow.canStartExercise). Business time is Asia/Shanghai.

import { tx } from "./i18n.js";
import { localStore } from "./store.js";

export const SESSION_MAX_MILLIS = 2 * 60 * 60 * 1000; // 2h auto end
export const SESSION_MIN_CREDIT_MILLIS = 60 * 60 * 1000; // <1h → not credited
export const MAX_EXERCISE_DESCRIPTION_LENGTH = 200;
export const OTHER_SPORT_TYPE = "other";

// ── Shanghai business time ──
export function shanghaiParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}`,
  };
}

/** CheckInTimeWindow.canStartExercise — returns a blocked reason or null. */
export function canStartExercise(timeWindow, now = new Date()) {
  if (timeWindow.windowMode === "unavailable") {
    return tx("打卡规则尚未从服务器加载，请刷新后重试", "Check-in rules have not loaded from the server. Refresh and try again.");
  }
  const { date: today, time: currentTime } = shanghaiParts(now);
  const valid = (t) => /^\d{2}:\d{2}$/.test(t);
  if (!valid(timeWindow.dailyStartTime) || !valid(timeWindow.dailyEndTime)) {
    return tx("打卡时间配置无效，请联系管理员", "The check-in time configuration is invalid. Contact an administrator.");
  }
  const start = timeWindow.dailyStartTime;
  const end = timeWindow.dailyEndTime;
  const within = start <= end
    ? currentTime >= start && currentTime <= end
    : currentTime >= start || currentTime <= end;
  if (!within) {
    return tx(`当前不在可运动时段（${start} - ${end}）`, `Exercise is unavailable now (${start} - ${end}).`);
  }
  if (timeWindow.excludedDates.includes(today)) {
    return tx("今日为特殊排除日，不可开始运动", "Today is an excluded date; exercise cannot be started.");
  }
  const dateValid = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  if ((timeWindow.dateRangeStart && !dateValid(timeWindow.dateRangeStart)) ||
      (timeWindow.dateRangeEnd && !dateValid(timeWindow.dateRangeEnd))) {
    return tx("打卡日期范围配置无效，请联系管理员", "The check-in date range is invalid. Contact an administrator.");
  }
  if ((timeWindow.dateRangeStart && today < timeWindow.dateRangeStart) ||
      (timeWindow.dateRangeEnd && today > timeWindow.dateRangeEnd)) {
    return tx(
      `当前不在开放日期（${timeWindow.dateRangeStart || ""} 至 ${timeWindow.dateRangeEnd || ""}）`,
      `Check-in is unavailable outside ${timeWindow.dateRangeStart || ""} to ${timeWindow.dateRangeEnd || ""}.`
    );
  }
  if (timeWindow.semesterDeadline) {
    if (!dateValid(timeWindow.semesterDeadline)) {
      return tx("学期截止日期配置无效，请联系管理员", "The semester deadline configuration is invalid. Contact an administrator.");
    }
    if (today > timeWindow.semesterDeadline) {
      return tx(`已超过本学期打卡截止日期（${timeWindow.semesterDeadline}）`, `The semester check-in deadline (${timeWindow.semesterDeadline}) has passed.`);
    }
  }
  return null;
}

/** StudentAppState.hasSubmittedCheckInToday — local submission date. */
export function hasSubmittedCheckInToday(workspace, now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return workspace.records.some(
    (record) => record.creditType !== "offset" && record.submittedAt.slice(0, 10) === today
  );
}

// ── Exercise session store (ExerciseSessionStore / -Controller) ──
// state: { phase: "active"|"paused"|"finished", startedAt, accumulatedMs,
//          lastResumedAt, details: {courseId, creditType, sportType, customSport},
//          drafts: [media] }

export function loadSession(accountId) {
  return localStore.getExerciseSession(accountId);
}

export function saveSession(accountId, session) {
  localStore.setExerciseSession(accountId, session);
}

export function clearSession(accountId) {
  localStore.clearExerciseSession(accountId);
}

export function startSession(details, now = Date.now()) {
  return {
    phase: "active",
    startedAt: now,
    accumulatedMs: 0,
    lastResumedAt: now,
    details,
    drafts: [],
  };
}

export function pauseSession(session, now = Date.now()) {
  if (session.phase !== "active") return session;
  return {
    ...session,
    phase: "paused",
    accumulatedMs: session.accumulatedMs + Math.max(0, now - session.lastResumedAt),
    lastResumedAt: null,
  };
}

export function resumeSession(session, now = Date.now()) {
  if (session.phase !== "paused") return session;
  return { ...session, phase: "active", lastResumedAt: now };
}

/** effectiveDurationMillis, capped at the 2-hour limit. */
export function sessionDurationMs(session, now = Date.now()) {
  if (!session) return 0;
  const raw = session.phase === "active" && session.lastResumedAt
    ? session.accumulatedMs + Math.max(0, now - session.lastResumedAt)
    : session.accumulatedMs;
  return Math.min(raw, SESSION_MAX_MILLIS);
}

export function shouldAutoEnd(session, now = Date.now()) {
  return session && session.phase === "active" && sessionDurationMs(session, now) >= SESSION_MAX_MILLIS;
}

/** normalizedCheckInHours: ≥2h → 2h, else 1h (once past the 1h minimum). */
export function creditedHours(durationMs, dailyLimit = 2) {
  const hours = durationMs / 3_600_000;
  return hours >= 2 && dailyLimit >= 2 ? 2 : 1;
}

export function formatTimer(durationMs) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalSeconds / 3600))}:${pad(Math.floor((totalSeconds % 3600) / 60))}:${pad(totalSeconds % 60)}`;
}
