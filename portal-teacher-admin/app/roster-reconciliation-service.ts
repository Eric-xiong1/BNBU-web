import { deriveReconciliationStats, reconcileRosters } from "./roster-reconciliation-engine";
import { createInitialRosterSnapshots } from "./roster-reconciliation-mock-data";
import { parseRosterFile, validateRosterImport } from "./roster-import";
import {
  RosterReconciliationStatus,
  RosterResolutionStatus,
  type ImportOfficialRosterInput,
  type OfficialRosterSnapshot,
  type ParsedRosterFile,
  type ReconciliationContext,
  type RosterApiAdapter,
  type RosterFieldMapping,
  type RosterOperationLog,
  type RosterReconciliationBundle,
  type RosterReconciliationResult,
  type ValidatedRosterImport,
} from "./roster-reconciliation-types";

export const ROSTER_API_PATHS = {
  officialRoster: (courseId: string) => `/api/v1/teacher/courses/${courseId}/official-roster`,
  rosterVersions: (courseId: string) => `/api/v1/teacher/courses/${courseId}/official-roster/versions`,
  uploadRoster: (courseId: string) => `/api/v1/teacher/courses/${courseId}/official-roster/imports`,
  reconcile: (courseId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations`,
  reconciliationStats: (courseId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations/latest/stats`,
  reconciliationResults: (courseId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations/latest/results`,
  resolution: (courseId: string, resultId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations/results/${resultId}/resolution`,
  note: (courseId: string, resultId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations/results/${resultId}/note`,
  export: (courseId: string) => `/api/v1/teacher/courses/${courseId}/roster-reconciliations/latest/export`,
} as const;

type MockRosterState = {
  schemaVersion: 1;
  snapshots: OfficialRosterSnapshot[];
  resultsByCourse: Record<string, RosterReconciliationResult[]>;
  lastReconciledAt: Record<string, string>;
};

const STORAGE_KEY = "bnbu-teacher-roster-reconciliation-mock-v1";
const contextsByCourse = new Map<string, ReconciliationContext>();
let memoryState: MockRosterState | null = null;

function initialState(): MockRosterState {
  return { schemaVersion: 1, snapshots: createInitialRosterSnapshots(), resultsByCourse: {}, lastReconciledAt: {} };
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function readState() {
  if (typeof window === "undefined") return memoryState ?? initialState();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<MockRosterState>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.snapshots) || !parsed.resultsByCourse) return initialState();
    return parsed as MockRosterState;
  } catch {
    return memoryState ?? initialState();
  }
}

function persistState(state: MockRosterState) {
  memoryState = clone(state);
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new RosterServiceError("STORAGE_UNAVAILABLE");
  }
}

function assertPermission(courseId: string) {
  // Local mock only: allow any teaching-class id (including backend OpaqueId).
  // Real roster API wiring is out of scope for this phase.
  if (!courseId.trim()) throw new RosterServiceError("FORBIDDEN");
}

async function waitForMock(delay = 220) {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, delay));
}

function currentRoster(state: MockRosterState, courseId: string) {
  return state.snapshots.find((snapshot) => snapshot.version.courseId === courseId && snapshot.version.isCurrent) ?? null;
}

function allOfficialStudents(state: MockRosterState) {
  return state.snapshots.filter((snapshot) => snapshot.version.isCurrent).flatMap((snapshot) => snapshot.students);
}

function bundleFor(state: MockRosterState, courseId: string): RosterReconciliationBundle {
  const context = contextsByCourse.get(courseId);
  const snapshot = currentRoster(state, courseId);
  const results = state.resultsByCourse[courseId] ?? [];
  const platformMembers = context?.platformMembers ?? [];
  const officialStudents = snapshot?.students ?? [];
  return {
    currentRoster: snapshot ? clone(snapshot) : null,
    versions: state.snapshots
      .filter((item) => item.version.courseId === courseId)
      .map((item) => item.version)
      .sort((a, b) => b.versionNumber - a.versionNumber),
    results: clone(results),
    stats: deriveReconciliationStats(
      officialStudents,
      platformMembers,
      courseId,
      results,
      state.lastReconciledAt[courseId],
    ),
    platformUpdatedAt: context ? new Date().toISOString() : undefined,
  };
}

function makeLog(action: RosterOperationLog["action"], detail?: string): RosterOperationLog {
  const createdAt = new Date().toISOString();
  return { id: `log:${createdAt}:${Math.random().toString(36).slice(2, 8)}`, action, actorName: "陈若宁", createdAt, detail };
}

function csvCell(value: string | undefined) {
  return `"${(value ?? "").replaceAll('"', '""')}"`;
}

function statusLabel(status: RosterReconciliationStatus) {
  const labels: Record<RosterReconciliationStatus, string> = {
    MATCHED: "已正确加入",
    NOT_JOINED: "未加入课程",
    WRONG_COURSE: "加错课程",
    NOT_IN_OFFICIAL_ROSTER: "非官方名单成员",
    INFO_MISMATCH: "信息不一致",
    POSSIBLE_MATCH: "疑似匹配",
    DUPLICATE: "重复记录",
    PENDING_CONFIRMATION: "待人工确认",
    RESOLVED: "已处理",
  };
  return labels[status];
}

export class RosterServiceError extends Error {
  constructor(public readonly code: "FORBIDDEN" | "NOT_FOUND" | "NO_OFFICIAL_ROSTER" | "STORAGE_UNAVAILABLE" | "VALIDATION") {
    super(code);
    this.name = "RosterServiceError";
  }
}

const mockAdapter: RosterApiAdapter = {
  async getBundle(courseId) {
    assertPermission(courseId);
    await waitForMock();
    return bundleFor(readState(), courseId);
  },

  async getOfficialRoster(courseId) {
    assertPermission(courseId);
    await waitForMock();
    return clone(currentRoster(readState(), courseId));
  },

  async getVersions(courseId) {
    assertPermission(courseId);
    await waitForMock();
    return bundleFor(readState(), courseId).versions;
  },

  async getStats(courseId) {
    assertPermission(courseId);
    await waitForMock();
    return bundleFor(readState(), courseId).stats;
  },

  async getResults(courseId) {
    assertPermission(courseId);
    await waitForMock();
    return bundleFor(readState(), courseId).results;
  },

  async importOfficialRoster(input) {
    assertPermission(input.course.id);
    await waitForMock(320);
    const validation = validateRosterImport(input.parsed, input.mapping);
    if (validation.validRows === 0) throw new RosterServiceError("VALIDATION");
    const state = clone(readState());
    const courseSnapshots = state.snapshots.filter((snapshot) => snapshot.version.courseId === input.course.id);
    const current = courseSnapshots.find((snapshot) => snapshot.version.isCurrent);
    state.snapshots.forEach((snapshot) => {
      if (snapshot.version.courseId === input.course.id) snapshot.version.isCurrent = false;
    });
    if (input.conflictStrategy === "REPLACE" && current) {
      state.snapshots = state.snapshots.filter((snapshot) => snapshot.version.id !== current.version.id);
    }
    const nextVersion = input.conflictStrategy === "REPLACE" && current
      ? current.version.versionNumber
      : Math.max(0, ...courseSnapshots.map((snapshot) => snapshot.version.versionNumber)) + 1;
    const importedAt = new Date().toISOString();
    const snapshot: OfficialRosterSnapshot = {
      version: {
        id: `roster:${input.course.id}:${importedAt}`,
        courseId: input.course.id,
        versionNumber: nextVersion,
        fileName: input.parsed.fileName,
        importedAt,
        importedBy: input.importedBy,
        totalRows: validation.totalRows,
        validRows: validation.validRows,
        invalidRows: validation.invalidRows,
        isCurrent: true,
        source: "FILE",
      },
      students: validation.students.map((student, index) => ({
        ...student,
        id: `official:${input.course.id}:${nextVersion}:${index + 1}`,
        courseId: input.course.id,
        courseName: student.courseName || input.course.name,
        courseCode: student.courseCode || input.course.code,
        teachingClassCode: student.teachingClassCode || input.course.teachingClassCode,
      })),
    };
    state.snapshots.push(snapshot);
    state.resultsByCourse[input.course.id] = [];
    persistState(state);
    const context = contextsByCourse.get(input.course.id);
    return context ? mockAdapter.reconcile(context) : bundleFor(state, input.course.id);
  },

  async reconcile(context) {
    assertPermission(context.course.id);
    await waitForMock(420);
    contextsByCourse.set(context.course.id, clone(context));
    const state = clone(readState());
    const snapshot = currentRoster(state, context.course.id);
    if (!snapshot) throw new RosterServiceError("NO_OFFICIAL_ROSTER");
    const now = new Date().toISOString();
    state.resultsByCourse[context.course.id] = reconcileRosters(
      allOfficialStudents(state),
      context,
      state.resultsByCourse[context.course.id] ?? [],
      now,
    );
    state.lastReconciledAt[context.course.id] = now;
    persistState(state);
    return bundleFor(state, context.course.id);
  },

  async updateResolution(courseId, resultIds, resolutionStatus) {
    assertPermission(courseId);
    await waitForMock();
    const state = clone(readState());
    const ids = new Set(resultIds);
    const action = resolutionStatus === RosterResolutionStatus.CONFIRMED
      ? "CONFIRMED"
      : resolutionStatus === RosterResolutionStatus.RESOLVED ? "RESOLVED" : "REOPENED";
    state.resultsByCourse[courseId] = (state.resultsByCourse[courseId] ?? []).map((result) => ids.has(result.id) ? {
      ...result,
      resolutionStatus,
      updatedAt: new Date().toISOString(),
      operationLogs: [makeLog(action), ...result.operationLogs],
    } : result);
    persistState(state);
    return bundleFor(state, courseId);
  },

  async saveTeacherNote(courseId, resultId, note) {
    assertPermission(courseId);
    await waitForMock();
    const state = clone(readState());
    let found = false;
    state.resultsByCourse[courseId] = (state.resultsByCourse[courseId] ?? []).map((result) => {
      if (result.id !== resultId) return result;
      found = true;
      return {
        ...result,
        teacherNote: note.trim() || undefined,
        updatedAt: new Date().toISOString(),
        operationLogs: [makeLog("NOTE_UPDATED", note.trim() ? "教师备注已更新" : "教师备注已清空"), ...result.operationLogs],
      };
    });
    if (!found) throw new RosterServiceError("NOT_FOUND");
    persistState(state);
    return bundleFor(state, courseId);
  },

  async exportResults(courseId, resultIds) {
    assertPermission(courseId);
    await waitForMock(120);
    const state = readState();
    const filterIds = resultIds ? new Set(resultIds) : null;
    const results = (state.resultsByCourse[courseId] ?? []).filter((result) => !filterIds || filterIds.has(result.id));
    const rows = [
      ["学号", "姓名", "官方课程", "当前加入课程", "对齐状态", "差异说明", "处理状态", "教师备注"],
      ...results.map((result) => [
        result.officialStudent?.studentNumber ?? result.platformMember?.studentNumber ?? "",
        result.officialStudent?.name ?? result.platformMember?.name ?? "",
        result.officialStudent ? `${result.officialStudent.courseName ?? ""} ${result.officialStudent.teachingClassCode ?? ""}`.trim() : "",
        result.platformMember?.courseId ?? "",
        statusLabel(result.status),
        result.reason,
        result.resolutionStatus,
        result.teacherNote ?? "",
      ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => csvCell(cell)).join(",")).join("\r\n")}`;
    return new Blob([csv], { type: "text/csv;charset=utf-8" });
  },
};

// The page talks only to this adapter. Replacing this binding with a fetch-backed
// adapter is the only change required when the teacher API becomes available.
export const rosterReconciliationService = mockAdapter;

export async function parseOfficialRosterFile(file: File): Promise<ParsedRosterFile> {
  return parseRosterFile(file);
}

export function validateOfficialRosterFile(parsed: ParsedRosterFile, mapping: RosterFieldMapping): ValidatedRosterImport {
  return validateRosterImport(parsed, mapping);
}

export type { ImportOfficialRosterInput };
