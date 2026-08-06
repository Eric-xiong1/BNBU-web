export const RosterReconciliationStatus = {
  MATCHED: "MATCHED",
  NOT_JOINED: "NOT_JOINED",
  WRONG_COURSE: "WRONG_COURSE",
  NOT_IN_OFFICIAL_ROSTER: "NOT_IN_OFFICIAL_ROSTER",
  INFO_MISMATCH: "INFO_MISMATCH",
  POSSIBLE_MATCH: "POSSIBLE_MATCH",
  DUPLICATE: "DUPLICATE",
  PENDING_CONFIRMATION: "PENDING_CONFIRMATION",
  RESOLVED: "RESOLVED",
} as const;

export type RosterReconciliationStatus = (typeof RosterReconciliationStatus)[keyof typeof RosterReconciliationStatus];

export const RosterResolutionStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  RESOLVED: "RESOLVED",
} as const;

export type RosterResolutionStatus = (typeof RosterResolutionStatus)[keyof typeof RosterResolutionStatus];

export type JoinMethod = "QR_CODE" | "MANUAL" | "IMPORT";

export interface OfficialRosterStudent {
  id: string;
  courseId: string;
  studentNumber: string;
  name: string;
  gender?: string;
  grade?: string;
  major?: string;
  administrativeClass?: string;
  courseName?: string;
  courseCode?: string;
  teachingClassCode?: string;
  sourceRow?: number;
}

export interface PlatformCourseMember {
  id: string;
  courseId: string;
  studentId?: string;
  studentNumber: string;
  name: string;
  gender?: string;
  grade?: string;
  joinedAt: string;
  joinMethod: JoinMethod;
}

export interface RosterCourseReference {
  id: string;
  code: string;
  name: string;
  teachingClassCode: string;
}

export interface RosterDifference {
  field: "studentNumber" | "name" | "gender" | "grade" | "major" | "administrativeClass" | "course";
  officialValue?: string;
  platformValue?: string;
}

export interface RosterOperationLog {
  id: string;
  action: "RECONCILED" | "CONFIRMED" | "RESOLVED" | "REOPENED" | "NOTE_UPDATED";
  actorName: string;
  createdAt: string;
  detail?: string;
}

export interface RosterReconciliationResult {
  id: string;
  courseId: string;
  officialStudent?: OfficialRosterStudent;
  platformMember?: PlatformCourseMember;
  status: RosterReconciliationStatus;
  differences: RosterDifference[];
  reason: string;
  resolutionStatus: RosterResolutionStatus;
  teacherNote?: string;
  updatedAt: string;
  operationLogs: RosterOperationLog[];
}

export interface OfficialRosterVersion {
  id: string;
  courseId: string;
  versionNumber: number;
  fileName: string;
  importedAt: string;
  importedBy: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  isCurrent: boolean;
  source: "FILE" | "OFFICIAL_API";
}

export interface OfficialRosterSnapshot {
  version: OfficialRosterVersion;
  students: OfficialRosterStudent[];
}

export interface RosterReconciliationStats {
  officialTotal: number;
  platformTotal: number;
  matched: number;
  notJoined: number;
  wrongCourse: number;
  otherExceptions: number;
  pending: number;
  lastReconciledAt?: string;
}

export interface RosterReconciliationBundle {
  currentRoster: OfficialRosterSnapshot | null;
  versions: OfficialRosterVersion[];
  results: RosterReconciliationResult[];
  stats: RosterReconciliationStats;
  platformUpdatedAt?: string;
}

export const ROSTER_IMPORT_FIELDS = [
  "studentNumber",
  "name",
  "gender",
  "grade",
  "major",
  "administrativeClass",
  "courseName",
  "courseCode",
  "teachingClassCode",
] as const;

export type RosterImportField = (typeof ROSTER_IMPORT_FIELDS)[number];
export type RosterFieldMapping = Record<RosterImportField, string | null>;

export interface RosterImportRowError {
  rowNumber: number;
  code: "MISSING_STUDENT_NUMBER" | "INVALID_STUDENT_NUMBER" | "DUPLICATE_STUDENT_NUMBER" | "EMPTY_ROW";
  message: string;
}

export interface ParsedRosterFile {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  previewRows: Record<string, string>[];
  suggestedMapping: RosterFieldMapping;
  sheetName: string;
  totalRows: number;
}

export interface ValidatedRosterImport {
  students: Omit<OfficialRosterStudent, "id" | "courseId">[];
  errors: RosterImportRowError[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export type RosterImportConflictStrategy = "REPLACE" | "NEW_VERSION";

export interface ImportOfficialRosterInput {
  course: RosterCourseReference;
  parsed: ParsedRosterFile;
  mapping: RosterFieldMapping;
  importedBy: string;
  conflictStrategy: RosterImportConflictStrategy;
}

export interface ReconciliationContext {
  course: RosterCourseReference;
  courses: RosterCourseReference[];
  platformMembers: PlatformCourseMember[];
}

export interface RosterApiAdapter {
  getBundle(courseId: string): Promise<RosterReconciliationBundle>;
  getOfficialRoster(courseId: string): Promise<OfficialRosterSnapshot | null>;
  getVersions(courseId: string): Promise<OfficialRosterVersion[]>;
  getStats(courseId: string): Promise<RosterReconciliationStats>;
  getResults(courseId: string): Promise<RosterReconciliationResult[]>;
  importOfficialRoster(input: ImportOfficialRosterInput): Promise<RosterReconciliationBundle>;
  reconcile(context: ReconciliationContext): Promise<RosterReconciliationBundle>;
  updateResolution(
    courseId: string,
    resultIds: string[],
    resolutionStatus: RosterResolutionStatus,
  ): Promise<RosterReconciliationBundle>;
  saveTeacherNote(courseId: string, resultId: string, note: string): Promise<RosterReconciliationBundle>;
  exportResults(courseId: string, resultIds?: string[]): Promise<Blob>;
}
