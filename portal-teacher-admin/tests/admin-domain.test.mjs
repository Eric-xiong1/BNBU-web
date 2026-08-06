import assert from "node:assert/strict";
import test from "node:test";

import {
  GRADE_CORRECTION_TRANSITIONS,
  HELP_ARTICLE_TRANSITIONS,
  SEMESTER_TRANSITIONS,
  USER_TRANSITIONS,
  buildUserImportPreview,
  parseCsv,
  validateEnduranceTable,
  validateSemesterInput,
} from "../app/admin-domain.ts";
import { createInitialAdminState } from "../app/admin-mock-data.ts";
import { AdminServiceError } from "../app/admin-types.ts";

function captureServiceError(operation) {
  try {
    operation();
  } catch (error) {
    assert.ok(error instanceof AdminServiceError);
    return error;
  }
  assert.fail("Expected an AdminServiceError");
}

test("the mock state uses stable enums and exactly one current semester", () => {
  const state = createInitialAdminState();
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.semesters.filter((semester) => semester.status === "current").length, 1);
  assert.ok(state.users.every((user) => ["ACTIVE", "DISABLED", "RECOVERY_REQUIRED"].includes(user.status)));
  assert.ok(["NORMAL", "READ_ONLY", "MAINTENANCE"].includes(state.systemMode.mode));
});

test("business state machines expose only documented transitions", () => {
  assert.deepEqual(SEMESTER_TRANSITIONS, {
    upcoming: ["current"],
    current: ["archived"],
    archived: [],
  });
  assert.deepEqual(USER_TRANSITIONS.ACTIVE, ["DISABLED", "RECOVERY_REQUIRED"]);
  assert.deepEqual(HELP_ARTICLE_TRANSITIONS, {
    draft: ["published"],
    published: ["archived"],
    archived: ["published"],
  });
  assert.deepEqual(GRADE_CORRECTION_TRANSITIONS.pending, ["approved", "rejected"]);
  assert.deepEqual(GRADE_CORRECTION_TRANSITIONS.corrected, ["closed"]);
});

test("semester validation rejects invalid years, reversed dates, and duplicate terms", () => {
  const state = createInitialAdminState();
  const error = captureServiceError(() => validateSemesterInput({
    name: "重复学期",
    academicYear: state.semesters[0].academicYear,
    term: state.semesters[0].term,
    startDate: "2026-09-10",
    endDate: "2026-09-01",
  }, state.semesters));
  assert.equal(error.fieldErrors.endDate, "DATE_ORDER");
  assert.equal(error.fieldErrors.term, "SEMESTER_DUPLICATE");

  const yearError = captureServiceError(() => validateSemesterInput({
    name: "Test",
    academicYear: "2026-2028",
    term: "summer",
    startDate: "2026-07-01",
    endDate: "2026-08-01",
  }, []));
  assert.equal(yearError.fieldErrors.academicYear, "ACADEMIC_YEAR_FORMAT");
});

test("CSV parsing preserves quoted commas and import preview catches duplicates atomically", () => {
  assert.deepEqual(parseCsv('id,name,note\r\n1,"Doe, Jane","said ""hello"""'), [
    ["id", "name", "note"],
    ["1", "Doe, Jane", 'said "hello"'],
  ]);

  const csv = [
    "employee_id,name,email,college,initial_password",
    "T2026991,Teacher One,teacher.one@example.edu,体育部,Temp2026!",
    "T2026991,Teacher Two,teacher.two@example.edu,体育部,Temp2026!",
  ].join("\n");
  const preview = buildUserImportPreview(csv, "teacher", []);
  assert.equal(preview.length, 2);
  assert.deepEqual(preview[0].errors, []);
  assert.ok(preview[1].errors.includes("ACCOUNT_DUPLICATE"));
});

test("endurance tables detect gaps and overlaps while accepting continuous ranges", () => {
  const base = {
    gender: "male",
    gradeGroup: "freshman_sophomore",
    runType: "1000m",
    tier: "pass",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const rule = (id, minSeconds, maxSeconds, score) => ({ ...base, id, minSeconds, maxSeconds, score });

  assert.deepEqual(validateEnduranceTable([rule("a", 0, 299, 100), rule("b", 300, 399, 80)]), []);
  assert.ok(validateEnduranceTable([rule("a", 0, 299, 100), rule("b", 301, 399, 80)]).some((issue) => issue.type === "gap"));
  assert.ok(validateEnduranceTable([rule("a", 0, 299, 100), rule("b", 299, 399, 80)]).some((issue) => issue.type === "overlap"));
});
