import assert from "node:assert/strict";
import test from "node:test";

import { deriveAuditSummary } from "../app/checkin-audit.ts";

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
