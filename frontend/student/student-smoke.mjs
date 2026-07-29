// Smoke test for the Android-replica student web app.
// Exercises the framework-free logic modules (i18n, session policy, mock data)
// without a DOM. Run: node frontend/student/student-smoke.mjs

import assert from "node:assert/strict";
import { t, tx, setLanguage } from "./js/i18n.js";
import {
  canStartExercise, hasSubmittedCheckInToday, startSession, pauseSession,
  resumeSession, sessionDurationMs, creditedHours, formatTimer,
  SESSION_MAX_MILLIS,
} from "./js/session.js";
import { createMockWorkspace, MOCK_INVITES, hourText } from "./js/data.js";

const failures = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL - ${name}: ${error.message}`);
  }
};

check("i18n resolves zh by default and en after switch", () => {
  setLanguage("zh");
  assert.equal(t("navigation_dashboard"), "首页");
  assert.equal(tx("你好", "Hello"), "你好");
  setLanguage("en");
  assert.equal(t("navigation_dashboard"), "Home");
  assert.equal(t("notification_unread_count", 3), "3 unread");
  setLanguage("zh");
});

check("mock workspace matches MockStudentWorkspace.kt", () => {
  const workspace = createMockWorkspace();
  assert.equal(workspace.student.id, "2024010836");
  assert.equal(workspace.student.name, "林若晴");
  assert.equal(workspace.courses.length, 2);
  assert.equal(workspace.records.length, 8);
  assert.equal(workspace.progress.course, 8.0);
  assert.equal(workspace.progress.rawCourse, 6.0);
  assert.equal(workspace.notices.length, 3);
  assert.equal(workspace.exemptions.length, 1);
  assert.equal(workspace.checkInTimeWindow.windowMode, "semester_wide");
});

check("invite lookup table exposes shared demo codes", () => {
  assert.ok(MOCK_INVITES["BNBU-7K3P9Q"]);
  assert.equal(MOCK_INVITES["BNBU-EXPIRED"], null);
});

check("time window evaluator blocks unavailable policy", () => {
  const reason = canStartExercise({ windowMode: "unavailable", dailyStartTime: "", dailyEndTime: "", excludedDates: [] });
  assert.ok(reason && reason.length > 0);
  const open = canStartExercise({ windowMode: "semester_wide", dailyStartTime: "00:00", dailyEndTime: "23:59", excludedDates: [], dateRangeStart: null, dateRangeEnd: null, semesterDeadline: null });
  assert.equal(open, null);
});

check("session timing: pause/resume, 2h cap, credited hours", () => {
  const t0 = 1_000_000;
  let session = startSession({ creditType: "general", sportType: "running" }, t0);
  assert.equal(session.phase, "active");
  session = pauseSession(session, t0 + 10 * 60_000);
  assert.equal(sessionDurationMs(session, t0 + 60 * 60_000), 10 * 60_000);
  session = resumeSession(session, t0 + 20 * 60_000);
  const at3h = sessionDurationMs(session, t0 + 200 * 60_000);
  assert.equal(at3h, SESSION_MAX_MILLIS);
  assert.equal(creditedHours(59 * 60_000), 1);
  assert.equal(creditedHours(2 * 60 * 60_000), 2);
  assert.equal(formatTimer(3_723_000), "01:02:03");
});

check("daily submission guard uses local submission date", () => {
  const now = new Date(2026, 6, 29, 12, 0, 0);
  const workspace = {
    records: [{ creditType: "general", submittedAt: "2026-07-29 09:00" }],
  };
  assert.equal(hasSubmittedCheckInToday(workspace, now), true);
  workspace.records[0].submittedAt = "2026-07-28 09:00";
  assert.equal(hasSubmittedCheckInToday(workspace, now), false);
});

check("hourText matches Kotlin Double.hourText()", () => {
  assert.equal(hourText(2), "2h");
  assert.equal(hourText(1.5), "1.5h");
});

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nstudent smoke checks passed");
