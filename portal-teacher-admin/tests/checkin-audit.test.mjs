import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deriveAuditSummary } from "../app/checkin-audit.ts";
import { mapExerciseRecordToCheckin } from "../app/teacher-data.ts";

const record = (auditStatus, creditedMinutes) => ({ auditStatus, creditedMinutes });

test("only valid records contribute credited minutes and progress", () => {
  const summary = deriveAuditSummary([
    record("valid", 120),
    record("invalid", 600),
    record("pending", 120),
  ], 1200);

  assert.equal(summary.validCount, 1);
  assert.equal(summary.invalidCount, 1);
  assert.equal(summary.pendingCount, 1);
  assert.equal(summary.validMinutes, 120);
  assert.equal(summary.remainingMinutes, 1080);
  assert.equal(summary.progressPercent, 10);
});

test("the teacher-configured target remains correct at and above its target", () => {
  const exact = deriveAuditSummary([record("valid", 900)], 900);
  assert.equal(exact.progressPercent, 100);
  assert.equal(exact.hasReachedTarget, true);
  assert.equal(exact.exceededMinutes, 0);

  const over = deriveAuditSummary([record("valid", 960)], 900);
  assert.equal(over.progressPercent, 100);
  assert.equal(over.exceededMinutes, 60);
});

test("switching audit state immediately changes the derived result", () => {
  const valid = deriveAuditSummary([record("valid", 120)], 600);
  const invalid = deriveAuditSummary([record("invalid", 120)], 600);
  const pending = deriveAuditSummary([record("pending", 120)], 600);

  assert.deepEqual([valid.validMinutes, valid.progressPercent], [120, 20]);
  assert.deepEqual([invalid.validMinutes, invalid.progressPercent], [0, 0]);
  assert.deepEqual([pending.validMinutes, pending.progressPercent], [0, 0]);
});

test("maps backend sport enums to the localized teacher label", () => {
  const checkin = mapExerciseRecordToCheckin({
    id: "record-1",
    studentId: "student-1",
    classSectionId: "class-1",
    enrollmentId: "enrollment-1",
    creditType: "COURSE_RELATED",
    sportType: "RUNNING",
    sportName: null,
    actualDurationSeconds: 60,
    creditedDurationSeconds: 60,
    businessDate: "2026-08-15",
    submittedAt: "2026-08-15T10:00:00.000Z",
    description: null,
    currentReview: { result: "VALID" },
  });

  assert.equal(checkin.sport, "跑步");
  assert.equal(checkin.status, "有效");
});

test("keeps reviewed records reachable from the teacher audit landing page", async () => {
  const workspace = await readFile(
    new URL("../app/teacher-workspace.tsx", import.meta.url),
    "utf8",
  );

  assert.match(workspace, /type CheckinReviewFilter = "all" \| "low_confidence" \| "history"/);
  assert.match(
    workspace,
    /label:\s*"全部历史记录",\s*count:\s*records\.length/,
  );
  assert.match(workspace, /showingHistory\s*\?\s*records/);
  assert.match(workspace, /切换到全部历史记录可回看已处理内容/);
  assert.match(workspace, /record\.auditStatus === "pending"/);
});
