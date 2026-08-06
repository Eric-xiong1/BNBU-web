import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  deriveReconciliationStats,
  normalizeStudentNumber,
  reconcileRosters,
} from "../app/roster-reconciliation-engine.ts";
import { parseRosterFile, validateRosterImport } from "../app/roster-import.ts";
import {
  ROSTER_IMPORT_FIELDS,
  RosterReconciliationStatus,
  RosterResolutionStatus,
} from "../app/roster-reconciliation-types.ts";

const course1 = { id: "1", code: "PE101", name: "大学体育（一）", teachingClassCode: "01班" };
const course2 = { id: "2", code: "PE203", name: "羽毛球", teachingClassCode: "03班" };

function official(id, courseId, studentNumber, name, extra = {}) {
  return { id, courseId, studentNumber, name, ...extra };
}

function member(id, courseId, studentNumber, name, extra = {}) {
  return { id, courseId, studentNumber, name, joinedAt: "2026-08-02T08:00:00+08:00", joinMethod: "QR_CODE", ...extra };
}

test("reconciliation is student-number-first and explains every core exception", () => {
  const officialStudents = [
    official("o1", "1", "001", "Alice", { grade: "2025" }),
    official("o2", "1", "002", "Bob"),
    official("o3", "1", "003", "Cara"),
    official("o4", "1", "004", "Dana"),
    official("o5", "1", "005", "Duplicate"),
    official("o6", "1", "005", "Duplicate"),
    official("o7", "2", "006", "Eve"),
  ];
  const platformMembers = [
    member("p1", "1", "001", "Alice", { grade: "2024" }),
    member("p2", "2", "002", "Bob"),
    member("p3", "1", "099", "Dana"),
    member("p4", "1", "007", "Frank"),
    member("p5", "1", "006", "Eve"),
    member("p6", "1", "008", "Repeat"),
    member("p7", "1", "008", "Repeat"),
  ];
  const results = reconcileRosters(officialStudents, {
    course: course1,
    courses: [course1, course2],
    platformMembers,
  }, [], "2026-08-02T10:00:00.000Z");

  const statuses = new Set(results.map((result) => result.status));
  assert.ok(statuses.has(RosterReconciliationStatus.INFO_MISMATCH));
  assert.ok(statuses.has(RosterReconciliationStatus.WRONG_COURSE));
  assert.ok(statuses.has(RosterReconciliationStatus.NOT_JOINED));
  assert.ok(statuses.has(RosterReconciliationStatus.POSSIBLE_MATCH));
  assert.ok(statuses.has(RosterReconciliationStatus.NOT_IN_OFFICIAL_ROSTER));
  assert.ok(statuses.has(RosterReconciliationStatus.DUPLICATE));

  const possible = results.find((result) => result.status === RosterReconciliationStatus.POSSIBLE_MATCH);
  assert.equal(possible.officialStudent.studentNumber, "004");
  assert.equal(possible.platformMember.studentNumber, "099");
  assert.match(possible.reason, /姓名一致但学号不同/);

  const wrongCourse = results.find((result) => result.officialStudent?.studentNumber === "002");
  assert.equal(wrongCourse.status, RosterReconciliationStatus.WRONG_COURSE);
  assert.match(wrongCourse.reason, /当前加入了/);
});

test("resolved states and teacher notes survive a repeated reconciliation", () => {
  const officialStudents = [official("o1", "1", "001", "Alice")];
  const context = { course: course1, courses: [course1], platformMembers: [] };
  const first = reconcileRosters(officialStudents, context, [], "2026-08-02T10:00:00.000Z");
  const previous = [{ ...first[0], resolutionStatus: RosterResolutionStatus.RESOLVED, teacherNote: "Confirmed by registrar" }];
  const next = reconcileRosters(officialStudents, context, previous, "2026-08-02T11:00:00.000Z");

  assert.equal(next[0].resolutionStatus, RosterResolutionStatus.RESOLVED);
  assert.equal(next[0].teacherNote, "Confirmed by registrar");
});

test("student numbers remain strings with leading zeros and duplicate rows are excluded", () => {
  const headers = ["学号", "姓名"];
  const parsed = {
    fileName: "roster.csv",
    headers,
    rows: [
      { 学号: "000123", 姓名: "A" },
      { 学号: "A-002", 姓名: "B" },
      { 学号: "000123", 姓名: "A" },
    ],
    previewRows: [],
    suggestedMapping: Object.fromEntries(ROSTER_IMPORT_FIELDS.map((field) => [field, null])),
    sheetName: "Sheet1",
    totalRows: 3,
  };
  const mapping = { ...parsed.suggestedMapping, studentNumber: "学号", name: "姓名" };
  const validation = validateRosterImport(parsed, mapping);

  assert.equal(normalizeStudentNumber("'000123"), "000123");
  assert.equal(validation.validRows, 1);
  assert.equal(validation.students[0].studentNumber, "A-002");
  assert.ok(validation.errors.some((error) => error.code === "DUPLICATE_STUDENT_NUMBER"));
});

test("the import adapter parses xlsx, legacy xls, and csv rosters", async () => {
  const XLSX = await import("xlsx");
  const cptable = await import("xlsx/dist/cpexcel.full.mjs");
  XLSX.set_cptable(cptable);
  for (const extension of ["xlsx", "xls", "csv"]) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["学号", "姓名", "年级"],
      ["000123", "测试学生", "2025级"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "名单");
    const bytes = XLSX.write(workbook, { type: "buffer", bookType: extension });
    const file = new File([bytes], `roster.${extension}`);
    const parsed = await parseRosterFile(file);

    assert.equal(parsed.totalRows, 1);
    assert.equal(parsed.suggestedMapping.studentNumber, "学号");
    assert.equal(parsed.rows[0].学号, "000123");
  }
});

test("statistics keep official members, platform members, and resolution state separate", () => {
  const officials = [official("o1", "1", "001", "A"), official("o2", "1", "002", "B")];
  const members = [member("p1", "1", "001", "A")];
  const results = reconcileRosters(officials, { course: course1, courses: [course1], platformMembers: members });
  const stats = deriveReconciliationStats(officials, members, "1", results, "2026-08-02T10:00:00.000Z");

  assert.equal(stats.officialTotal, 2);
  assert.equal(stats.platformTotal, 1);
  assert.equal(stats.matched, 1);
  assert.equal(stats.notJoined, 1);
  assert.equal(stats.pending, 1);
});

test("teacher course entry reuses services and keeps mock data out of the page component", async () => {
  const [workspace, page, service, mock] = await Promise.all([
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/roster-reconciliation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/roster-reconciliation-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/roster-reconciliation-mock-data.ts", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /course-roster-reconciliation-button/);
  assert.match(workspace, /RosterReconciliationPage/);
  assert.match(page, /rosterReconciliationService/);
  assert.doesNotMatch(page, /roster-reconciliation-mock-data/);
  assert.match(service, /ROSTER_API_PATHS/);
  assert.match(service, /createInitialRosterSnapshots/);
  assert.match(mock, /OfficialRosterStudent/);
});
