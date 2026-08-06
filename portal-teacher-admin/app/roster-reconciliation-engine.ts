import {
  RosterReconciliationStatus,
  RosterResolutionStatus,
  type OfficialRosterStudent,
  type PlatformCourseMember,
  type ReconciliationContext,
  type RosterDifference,
  type RosterReconciliationResult,
  type RosterReconciliationStats,
} from "./roster-reconciliation-types";

const COLLATOR = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

export function normalizeStudentNumber(value: string) {
  return value.trim().replace(/^['\u2019]/, "");
}

export function normalizeRosterName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function groupByStudentNumber<T extends { studentNumber: string }>(items: T[]) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => {
    const key = normalizeStudentNumber(item.studentNumber);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return groups;
}

function stableResultId(
  courseId: string,
  status: RosterReconciliationStatus,
  official?: OfficialRosterStudent,
  member?: PlatformCourseMember,
) {
  return [courseId, status, official?.id ?? "none", member?.id ?? "none"].join(":");
}

function makeResult(input: {
  courseId: string;
  status: RosterReconciliationStatus;
  reason: string;
  officialStudent?: OfficialRosterStudent;
  platformMember?: PlatformCourseMember;
  differences?: RosterDifference[];
  now: string;
}): RosterReconciliationResult {
  return {
    id: stableResultId(input.courseId, input.status, input.officialStudent, input.platformMember),
    courseId: input.courseId,
    officialStudent: input.officialStudent,
    platformMember: input.platformMember,
    status: input.status,
    differences: input.differences ?? [],
    reason: input.reason,
    resolutionStatus: input.status === RosterReconciliationStatus.MATCHED
      ? RosterResolutionStatus.RESOLVED
      : RosterResolutionStatus.PENDING,
    updatedAt: input.now,
    operationLogs: [{
      id: `log:${input.now}:${input.officialStudent?.id ?? input.platformMember?.id ?? "record"}`,
      action: "RECONCILED",
      actorName: "系统",
      createdAt: input.now,
      detail: input.reason,
    }],
  };
}

function compareIdentity(official: OfficialRosterStudent, platform: PlatformCourseMember) {
  const fields: Array<[RosterDifference["field"], string | undefined, string | undefined]> = [
    ["name", official.name, platform.name],
    ["gender", official.gender, platform.gender],
    ["grade", official.grade, platform.grade],
  ];
  return fields.flatMap(([field, officialValue, platformValue]) => {
    if (!officialValue || !platformValue) return [];
    const normalizedOfficial = field === "name" ? normalizeRosterName(officialValue) : officialValue.trim().toLocaleLowerCase();
    const normalizedPlatform = field === "name" ? normalizeRosterName(platformValue) : platformValue.trim().toLocaleLowerCase();
    return normalizedOfficial === normalizedPlatform ? [] : [{ field, officialValue, platformValue }];
  });
}

function differenceFieldLabel(field: RosterDifference["field"]) {
  return ({ name: "姓名", gender: "性别", grade: "年级" } as Partial<Record<RosterDifference["field"], string>>)[field] ?? field;
}

function restoreResolution(
  result: RosterReconciliationResult,
  previous: RosterReconciliationResult | undefined,
) {
  if (!previous || result.status === RosterReconciliationStatus.MATCHED) return result;
  return {
    ...result,
    resolutionStatus: previous.resolutionStatus,
    teacherNote: previous.teacherNote,
    operationLogs: [...result.operationLogs, ...previous.operationLogs.filter((log) => log.action !== "RECONCILED")],
  };
}

export function reconcileRosters(
  officialStudents: OfficialRosterStudent[],
  context: ReconciliationContext,
  previousResults: RosterReconciliationResult[] = [],
  now = new Date().toISOString(),
) {
  const { course, courses, platformMembers } = context;
  const currentOfficial = officialStudents.filter((student) => student.courseId === course.id);
  const currentPlatform = platformMembers.filter((member) => member.courseId === course.id);
  const officialGroups = groupByStudentNumber(currentOfficial);
  const platformGroups = groupByStudentNumber(currentPlatform);
  const allOfficialGroups = groupByStudentNumber(officialStudents);
  const allPlatformGroups = groupByStudentNumber(platformMembers);
  const consumedOfficialIds = new Set<string>();
  const consumedPlatformIds = new Set<string>();
  const results: RosterReconciliationResult[] = [];

  for (const [studentNumber, entries] of officialGroups) {
    if (entries.length < 2) continue;
    entries.forEach((entry) => consumedOfficialIds.add(entry.id));
    const platform = platformGroups.get(studentNumber)?.[0];
    if (platform) consumedPlatformIds.add(platform.id);
    results.push(makeResult({
      courseId: course.id,
      status: RosterReconciliationStatus.DUPLICATE,
      officialStudent: entries[0],
      platformMember: platform,
      differences: [{ field: "studentNumber", officialValue: `${entries.length} 条相同学号记录`, platformValue: platform?.studentNumber }],
      reason: `官方名单中学号 ${studentNumber} 出现 ${entries.length} 次，需要先清理重复数据。`,
      now,
    }));
  }

  for (const [studentNumber, entries] of platformGroups) {
    if (entries.length < 2) continue;
    entries.forEach((entry) => consumedPlatformIds.add(entry.id));
    const official = officialGroups.get(studentNumber)?.[0];
    if (official) consumedOfficialIds.add(official.id);
    results.push(makeResult({
      courseId: course.id,
      status: RosterReconciliationStatus.DUPLICATE,
      officialStudent: official,
      platformMember: entries[0],
      differences: [{ field: "studentNumber", officialValue: official?.studentNumber, platformValue: `${entries.length} 条课程成员记录` }],
      reason: `平台课程中学号 ${studentNumber} 出现 ${entries.length} 次，可能由重复扫码或重复导入导致。`,
      now,
    }));
  }

  currentOfficial.forEach((official) => {
    if (consumedOfficialIds.has(official.id)) return;
    const number = normalizeStudentNumber(official.studentNumber);
    const exactCurrent = (platformGroups.get(number) ?? []).find((member) => !consumedPlatformIds.has(member.id));
    if (exactCurrent) {
      consumedOfficialIds.add(official.id);
      consumedPlatformIds.add(exactCurrent.id);
      const differences = compareIdentity(official, exactCurrent);
      results.push(makeResult({
        courseId: course.id,
        status: differences.length > 0 ? RosterReconciliationStatus.INFO_MISMATCH : RosterReconciliationStatus.MATCHED,
        officialStudent: official,
        platformMember: exactCurrent,
        differences,
        reason: differences.length > 0
          ? `学号完全一致，但 ${differences.map((item) => differenceFieldLabel(item.field)).join("、")} 与官方名单不同。`
          : "学号及主要身份信息与官方名单一致。",
        now,
      }));
      return;
    }

    const exactElsewhere = (allPlatformGroups.get(number) ?? []).find((member) => member.courseId !== course.id);
    if (exactElsewhere) {
      consumedOfficialIds.add(official.id);
      consumedPlatformIds.add(exactElsewhere.id);
      const actualCourse = courses.find((item) => item.id === exactElsewhere.courseId);
      results.push(makeResult({
        courseId: course.id,
        status: RosterReconciliationStatus.WRONG_COURSE,
        officialStudent: official,
        platformMember: exactElsewhere,
        differences: [{
          field: "course",
          officialValue: `${course.name} · ${course.teachingClassCode}`,
          platformValue: actualCourse ? `${actualCourse.name} · ${actualCourse.teachingClassCode}` : exactElsewhere.courseId,
        }],
        reason: `该学生学号与本课程官方名单一致，但当前加入了${actualCourse ? `“${actualCourse.name} · ${actualCourse.teachingClassCode}”` : "另一门课程"}，因此被标记为加错课程。`,
        now,
      }));
      return;
    }

    const possible = currentPlatform.find((member) =>
      !consumedPlatformIds.has(member.id)
      && normalizeRosterName(member.name) === normalizeRosterName(official.name)
      && normalizeStudentNumber(member.studentNumber) !== number,
    );
    if (possible) {
      consumedOfficialIds.add(official.id);
      consumedPlatformIds.add(possible.id);
      results.push(makeResult({
        courseId: course.id,
        status: RosterReconciliationStatus.POSSIBLE_MATCH,
        officialStudent: official,
        platformMember: possible,
        differences: [{ field: "studentNumber", officialValue: official.studentNumber, platformValue: possible.studentNumber }],
        reason: "姓名一致但学号不同，系统不会自动认定为同一学生，需要教师人工确认。",
        now,
      }));
      return;
    }

    consumedOfficialIds.add(official.id);
    results.push(makeResult({
      courseId: course.id,
      status: RosterReconciliationStatus.NOT_JOINED,
      officialStudent: official,
      reason: "该学生存在于官方名单，但平台当前没有相同学号的课程成员。",
      now,
    }));
  });

  currentPlatform.forEach((member) => {
    if (consumedPlatformIds.has(member.id)) return;
    const number = normalizeStudentNumber(member.studentNumber);
    const officialElsewhere = (allOfficialGroups.get(number) ?? []).find((student) => student.courseId !== course.id);
    if (officialElsewhere) {
      const officialCourse = courses.find((item) => item.id === officialElsewhere.courseId);
      results.push(makeResult({
        courseId: course.id,
        status: RosterReconciliationStatus.WRONG_COURSE,
        officialStudent: officialElsewhere,
        platformMember: member,
        differences: [{
          field: "course",
          officialValue: officialCourse ? `${officialCourse.name} · ${officialCourse.teachingClassCode}` : officialElsewhere.courseId,
          platformValue: `${course.name} · ${course.teachingClassCode}`,
        }],
        reason: `该学生学号属于${officialCourse ? `“${officialCourse.name} · ${officialCourse.teachingClassCode}”` : "教师的另一门课程"}官方名单，但实际加入了本课程。`,
        now,
      }));
    } else {
      results.push(makeResult({
        courseId: course.id,
        status: RosterReconciliationStatus.NOT_IN_OFFICIAL_ROSTER,
        platformMember: member,
        reason: "该平台课程成员的学号未出现在本课程或教师其他课程的官方名单中。",
        now,
      }));
    }
    consumedPlatformIds.add(member.id);
  });

  const previousById = new Map(previousResults.map((result) => [result.id, result]));
  return results
    .map((result) => restoreResolution(result, previousById.get(result.id)))
    .sort((a, b) => {
      if (a.status === RosterReconciliationStatus.MATCHED && b.status !== RosterReconciliationStatus.MATCHED) return 1;
      if (a.status !== RosterReconciliationStatus.MATCHED && b.status === RosterReconciliationStatus.MATCHED) return -1;
      const numberA = a.officialStudent?.studentNumber ?? a.platformMember?.studentNumber ?? "";
      const numberB = b.officialStudent?.studentNumber ?? b.platformMember?.studentNumber ?? "";
      return COLLATOR.compare(numberA, numberB);
    });
}

export function deriveReconciliationStats(
  officialStudents: OfficialRosterStudent[],
  platformMembers: PlatformCourseMember[],
  courseId: string,
  results: RosterReconciliationResult[],
  lastReconciledAt?: string,
): RosterReconciliationStats {
  const count = (status: RosterReconciliationStatus) => results.filter((result) => result.status === status).length;
  const primaryStatuses = new Set<RosterReconciliationStatus>([
    RosterReconciliationStatus.MATCHED,
    RosterReconciliationStatus.NOT_JOINED,
    RosterReconciliationStatus.WRONG_COURSE,
  ]);
  const otherExceptions = results.filter((result) => !primaryStatuses.has(result.status)).length;
  return {
    officialTotal: officialStudents.filter((student) => student.courseId === courseId).length,
    platformTotal: platformMembers.filter((member) => member.courseId === courseId).length,
    matched: count(RosterReconciliationStatus.MATCHED),
    notJoined: count(RosterReconciliationStatus.NOT_JOINED),
    wrongCourse: count(RosterReconciliationStatus.WRONG_COURSE),
    otherExceptions,
    pending: results.filter((result) => result.resolutionStatus === RosterResolutionStatus.PENDING).length,
    lastReconciledAt,
  };
}
