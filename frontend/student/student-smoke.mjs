// Smoke test for the Android-replica student web app.
// Exercises the framework-free logic modules (i18n, session policy, mock data,
// proof rules, local store) without a DOM. Run: node frontend/student/student-smoke.mjs

import assert from "node:assert/strict";

// localStorage shim so store.js is testable in Node. Safe with hoisted static
// imports: store.js only touches localStorage inside function bodies.
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem(key) { return memoryStorage.has(key) ? memoryStorage.get(key) : null; },
  setItem(key, value) { memoryStorage.set(key, String(value)); },
  removeItem(key) { memoryStorage.delete(key); },
};

import { t, tx, setLanguage } from "./js/i18n.js";
import {
  canStartExercise, hasSubmittedCheckInToday, startSession, pauseSession,
  resumeSession, sessionDurationMs, creditedHours, formatTimer,
  SESSION_MAX_MILLIS,
} from "./js/session.js";
import { createMockWorkspace, MOCK_INVITES, hourText } from "./js/data.js";
import { validateProofFile } from "./js/proofs.js";
import { localStore } from "./js/store.js";

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

check("daily submission guard follows the Beijing business day", () => {
  // The backend keys one check-in per enrollment per business date, so the
  // guard must use Beijing's day rather than the device's — otherwise a
  // student abroad is told they may check in and the submit is then rejected.
  // This instant is still 2026-07-29 in the Americas, already 07-30 in Beijing.
  const now = new Date("2026-07-29T16:00:00Z");
  const workspace = {
    records: [{ creditType: "general", businessDate: "2026-07-30" }],
  };
  assert.equal(hasSubmittedCheckInToday(workspace, now), true);
  workspace.records[0].businessDate = "2026-07-29";
  assert.equal(hasSubmittedCheckInToday(workspace, now), false);
});

check("hourText matches Kotlin Double.hourText()", () => {
  assert.equal(hourText(2), "2h");
  assert.equal(hourText(1.5), "1.5h");
});

check("time window blocks excluded dates and passed deadlines", () => {
  // 2026-07-29 04:00 UTC = 2026-07-29 12:00 Asia/Shanghai.
  const now = new Date(Date.UTC(2026, 6, 29, 4, 0, 0));
  const base = {
    windowMode: "semester_wide", dailyStartTime: "00:00", dailyEndTime: "23:59",
    excludedDates: [], dateRangeStart: null, dateRangeEnd: null, semesterDeadline: null,
  };
  assert.equal(canStartExercise(base, now), null);
  const excluded = canStartExercise({ ...base, excludedDates: ["2026-07-29"] }, now);
  assert.ok(excluded && excluded.length > 0);
  const pastDeadline = canStartExercise({ ...base, semesterDeadline: "2026-07-28" }, now);
  assert.ok(pastDeadline && pastDeadline.includes("2026-07-28"));
});

check("proof rules (v6.1 §5.1): format whitelist and size caps", () => {
  // MIME match, including jpeg→jpg canonicalization.
  assert.deepEqual(validateProofFile({ name: "a.jpeg", type: "image/jpeg", size: 100 }, "image"), { ok: true, extension: "jpg" });
  assert.deepEqual(validateProofFile({ name: "b.png", type: "image/png", size: 100 }, "image"), { ok: true, extension: "png" });
  // Extension fallback when the browser reports no MIME type (HEIC on mobile).
  assert.deepEqual(validateProofFile({ name: "c.HEIC", type: "", size: 100 }, "image"), { ok: true, extension: "heic" });
  assert.deepEqual(validateProofFile({ name: "d.mov", type: "", size: 100 }, "video"), { ok: true, extension: "mov" });
  // Rejected formats.
  assert.deepEqual(validateProofFile({ name: "e.gif", type: "image/gif", size: 100 }, "image"), { ok: false, error: "format" });
  assert.deepEqual(validateProofFile({ name: "f.avi", type: "video/x-msvideo", size: 100 }, "video"), { ok: false, error: "format" });
  // Size caps: 8MB images, 100MB videos.
  assert.deepEqual(validateProofFile({ name: "g.jpg", type: "image/jpeg", size: 8_000_001 }, "image"), { ok: false, error: "size" });
  assert.deepEqual(validateProofFile({ name: "h.mp4", type: "video/mp4", size: 100_000_001 }, "video"), { ok: false, error: "size" });
  assert.equal(validateProofFile({ name: "i.mp4", type: "video/mp4", size: 100_000_000 }, "video").ok, true);
});

check("store self-heals corrupted keys and merges overlay defaults", () => {
  // Corrupted JSON → defaults returned and the bad key removed.
  memoryStorage.set("bnbu.student.web.workspaceOverlay", "{not json");
  let overlay = localStore.getOverlay();
  assert.deepEqual(overlay.readNoticeIds, []);
  assert.equal(overlay.healthReminderAck, false);
  assert.equal(memoryStorage.has("bnbu.student.web.workspaceOverlay"), false);
  // Partial legacy overlay → missing fields filled, wrong shapes coerced.
  memoryStorage.set("bnbu.student.web.workspaceOverlay", JSON.stringify({ readNoticeIds: "oops", healthReminderAck: true }));
  overlay = localStore.getOverlay();
  assert.deepEqual(overlay.readNoticeIds, []);
  assert.equal(overlay.healthReminderAck, true);
  assert.deepEqual(overlay.newRecords, []);
  assert.equal(overlay.joinRequest, null);
  memoryStorage.delete("bnbu.student.web.workspaceOverlay");
});

check("exercise session round-trips through the store per account", () => {
  const session = startSession({ creditType: "course", sportType: "badminton" }, 5_000);
  localStore.setExerciseSession("acct-1", session);
  assert.deepEqual(localStore.getExerciseSession("acct-1"), session);
  assert.equal(localStore.getExerciseSession("acct-2"), null);
  localStore.clearExerciseSession("acct-1");
  assert.equal(localStore.getExerciseSession("acct-1"), null);
});

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nstudent smoke checks passed");
