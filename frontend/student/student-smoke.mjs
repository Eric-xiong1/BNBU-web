// Smoke test for the Contract 2.0.2 Web student client.
// Exercises the framework-free logic modules (i18n, session policy, synthetic
// fixtures, API projection mapping, proof rules, local store) without a DOM.

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
import { canNormalizeCapturedImage, mimeEssence, validateProofFile } from "./js/proofs.js";
import { mapPublishedScore, mapServerRecord, mapServerStudent } from "./js/api.js";
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

check("proof rules follow the exact Contract 2.0.2 media allowlist", () => {
  assert.equal(mimeEssence("video/webm;codecs=vp8,opus"), "video/webm");
  assert.deepEqual(validateProofFile({ type: "image/jpeg", size: 100 }, "image"), {
    ok: true, extension: "jpg", mimeType: "image/jpeg", durationSeconds: null,
  });
  assert.deepEqual(validateProofFile({ type: "image/png", size: 100 }, "image"), {
    ok: true, extension: "png", mimeType: "image/png", durationSeconds: null,
  });
  assert.equal(canNormalizeCapturedImage({ name: "capture.HEIC", type: "" }), true);
  assert.equal(canNormalizeCapturedImage({ name: "capture.webp", type: "image/webp" }), true);
  assert.deepEqual(validateProofFile({ type: "image/webp", size: 100 }, "image"), { ok: false, error: "format" });
  assert.deepEqual(validateProofFile({ type: "image/jpeg", size: 10_485_761 }, "image"), { ok: false, error: "size" });

  const webm = validateProofFile({ type: "video/webm;codecs=vp8,opus", size: 100 }, "video", { durationSeconds: 14.1 });
  assert.deepEqual(webm, { ok: true, extension: "webm", mimeType: "video/webm", durationSeconds: 15 });
  for (const type of ["video/mp4", "video/quicktime", "video/3gpp", "video/webm"]) {
    assert.equal(validateProofFile({ type, size: 100 }, "video", { durationSeconds: 15 }).ok, true);
  }
  assert.deepEqual(validateProofFile({ type: "video/x-matroska", size: 100 }, "video", { durationSeconds: 10 }), { ok: false, error: "format" });
  assert.deepEqual(validateProofFile({ name: "capture.mov", type: "", size: 100 }, "video", { durationSeconds: 10 }), { ok: false, error: "format" });
  assert.deepEqual(validateProofFile({ type: "video/mp4", size: 100 }, "video", { durationSeconds: 15.4 }), { ok: false, error: "duration" });
  assert.deepEqual(validateProofFile({ type: "video/mp4", size: 100 }, "video", { durationSeconds: null }), { ok: false, error: "duration" });
  assert.deepEqual(validateProofFile({ type: "video/mp4", size: 0 }, "video", { durationSeconds: 10 }), { ok: false, error: "empty" });
  assert.deepEqual(validateProofFile({ type: "video/mp4", size: 536_870_913 }, "video", { durationSeconds: 10 }), { ok: false, error: "size" });
});

check("/me mapping uses the Contract 2.0.2 masked email and verification fields", () => {
  const student = mapServerStudent(
    { user: { primaryEmailMasked: "s***@example.edu", emailVerified: true, version: 4, status: "ACTIVE" } },
    { studentNumber: "00001234", fullName: "Synthetic Student", gender: "FEMALE", gradeYear: 2026, collegeName: null, administrativeClassName: null },
    { academicYear: "2026-2027" },
  );
  assert.equal(student.id, "00001234");
  assert.equal(student.email, "s***@example.edu");
  assert.equal(student.emailVerified, true);
  assert.equal(student.userVersion, 4);
});

check("a submitted record is valid on arrival and credits the server's hours", () => {
  // Contract 2.0.2: /submit atomically appends the system ReviewRecord v1
  // (result VALID, teacherId null) and the record becomes REVIEWED.
  const record = mapServerRecord({
    id: "record-1", status: "REVIEWED", creditType: "GENERAL",
    classSectionId: "section-1", sportType: "RUNNING", sportName: null,
    actualDurationSeconds: 3900, creditedDurationSeconds: 3600,
    businessDate: "2026-08-18", submittedAt: "2026-08-18T02:05:00Z",
    description: "晨跑 5 公里",
    currentReview: { result: "VALID", reasonCode: null, publicComment: null },
  });

  assert.equal(record.reviewResult, "VALID");
  assert.equal(record.hours, 1);
  assert.match(record.teacherPublicFeedback, /记录有效/);
});

check("a teacher's INVALID verdict reaches the student verbatim", () => {
  const invalidRecord = (creditedDurationSeconds) => mapServerRecord({
    id: "record-2", status: "REVIEWED", creditType: "GENERAL",
    classSectionId: "section-1", sportType: "BADMINTON", sportName: null,
    actualDurationSeconds: 3900, creditedDurationSeconds,
    businessDate: "2026-08-18", submittedAt: "2026-08-18T02:05:00Z",
    description: "羽毛球专项练习",
    currentReview: {
      result: "INVALID", reasonCode: "INSUFFICIENT_EVIDENCE",
      publicComment: "凭证无法证明运动过程，请重新打卡。",
    },
  });

  // 2.0.2 has no way for an INVALID review to zero creditedDurationSeconds
  // (creditedDurationOverrideSeconds is blocked until ADR-047), so a rejected
  // record normally keeps the credit it was submitted with — exactly what
  // `npm run demo:setup` seeds. The client passes the server value through and
  // leaves the exclusion to the review result.
  const stillCredited = invalidRecord(3600);
  assert.equal(stillCredited.reviewResult, "INVALID");
  assert.equal(stillCredited.hours, 1);
  assert.match(stillCredited.teacherPublicFeedback, /凭证无法证明运动过程/);

  // And when the server credits nothing, the client must not invent hours from
  // the actual duration.
  assert.equal(invalidRecord(0).hours, 0);
});

check("published scores read finalScore/baseScore and never invent a zero", () => {
  const published = mapPublishedScore({
    status: "PUBLISHED", finalScore: 86.5, baseScore: 80, adjustmentTotal: 6.5,
  });
  assert.equal(published.totalScore, 86.5);
  assert.equal(published.totalDisplay, "86.5");

  // finalScore is nullable even once PUBLISHED; baseScore is the fallback.
  const baseOnly = mapPublishedScore({
    status: "PUBLISHED", finalScore: null, baseScore: 78, adjustmentTotal: null,
  });
  assert.equal(baseOnly.totalScore, 78);
  assert.equal(baseOnly.totalDisplay, "78");

  // A published 0 is a legal score (DecimalScore has no minimum) and must not
  // be swallowed by a truthiness fallback.
  const publishedZero = mapPublishedScore({
    status: "PUBLISHED", finalScore: 0, baseScore: 80, adjustmentTotal: -80,
  });
  assert.equal(publishedZero.totalScore, 0);
  assert.equal(publishedZero.totalDisplay, "0");

  const pendingCalc = mapPublishedScore({
    status: "PUBLISHED", finalScore: null, baseScore: null, adjustmentTotal: null,
  });
  assert.equal(pendingCalc.totalScore, null);
  assert.equal(pendingCalc.totalDisplay, "待计算");

  const unpublished = mapPublishedScore(null);
  assert.equal(unpublished.totalScore, null);
  assert.equal(unpublished.totalDisplay, "未开放");
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
