import { SESSION } from "./constants.js";
import { uid } from "./utils.js";

// ── Elapsed-time math (timestamp based, never setInterval accumulation) ──
// activeMs = wall clock since start, minus all completed pauses, minus the
// currently-open pause if the session is paused. This survives reloads and
// backgrounding because it is derived from stored timestamps each tick.
export function sessionElapsedMs(session, now = Date.now()) {
  if (!session?.startTime) return 0;
  const started = new Date(session.startTime).getTime();
  if (!Number.isFinite(started)) return 0;
  const openPause = session.status === "paused" && session.lastPauseAt
    ? Math.max(0, now - new Date(session.lastPauseAt).getTime())
    : 0;
  return Math.max(0, now - started - (session.pausedAccumMs || 0) - openPause);
}

// 0 / 1 / 2 hours by active duration. <1h → 0, [1h,2h) → 1, ≥2h → 2.
export function earnedHoursFromActiveMs(activeMs) {
  if (activeMs >= SESSION.fullMs) return 2;
  if (activeMs >= SESSION.minMs) return 1;
  return 0;
}

// Auto-end: reached the 2h cap, or paused continuously beyond the max window.
export function shouldAutoEnd(session, now = Date.now()) {
  if (!session) return false;
  if (sessionElapsedMs(session, now) >= SESSION.fullMs) return true;
  if (session.status === "paused" && session.lastPauseAt) {
    if (now - new Date(session.lastPauseAt).getTime() >= SESSION.maxPauseMs) return true;
  }
  return false;
}

export function startSession({ creditType, courseId = null, sportType = "", customSport = "" }, now = Date.now()) {
  return {
    id: uid("sess"),
    creditType, courseId, sportType, customSport,
    startTime: new Date(now).toISOString(),
    status: "running",
    pausedAccumMs: 0,
    lastPauseAt: null,
    pauseCount: 0,
  };
}

export function pauseSession(session, now = Date.now()) {
  if (!session || session.status !== "running") return session;
  return { ...session, status: "paused", lastPauseAt: new Date(now).toISOString(), pauseCount: (session.pauseCount || 0) + 1 };
}

export function resumeSession(session, now = Date.now()) {
  if (!session || session.status !== "paused") return session;
  const pausedFor = session.lastPauseAt ? Math.max(0, now - new Date(session.lastPauseAt).getTime()) : 0;
  return { ...session, status: "running", lastPauseAt: null, pausedAccumMs: (session.pausedAccumMs || 0) + pausedFor };
}

// Freeze the session into a result: active duration → earned hours + end time.
export function endSession(session, now = Date.now()) {
  const activeMs = sessionElapsedMs(session, now);
  return {
    activeMs,
    earnedHours: earnedHoursFromActiveMs(activeMs),
    startTime: session?.startTime || new Date(now).toISOString(),
    endTime: new Date(now).toISOString(),
  };
}

// MM:SS, switching to HH:MM:SS once the hour mark is reached.
export function formatTimer(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

// Local (Asia/Shanghai) natural-day key for a timestamp.
export function shanghaiDayKey(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  // Shift to UTC+8 then read the date portion.
  return new Date(date.getTime() + 8 * 3600e3).toISOString().slice(0, 10);
}

// One service submission per natural day: a record already submitted today
// (by its start time) blocks starting a new session. Invalidated records do
// not occupy the daily slot.
export function hasServedToday(records = [], now = Date.now()) {
  const today = shanghaiDayKey(now);
  return records.some((record) => {
    if (record?.status === "无效" || record?.status === "已驳回") return false;
    const stamp = record?.startTime || record?.submittedAt;
    return stamp && shanghaiDayKey(stamp) === today;
  });
}
