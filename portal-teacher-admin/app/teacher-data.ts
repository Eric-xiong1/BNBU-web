import { ApiError, apiErrorText, isUnsupported, request } from "./api-client";
import { businessDateTime } from "./business-time";
import type { AuditStatus } from "./checkin-audit";
import type {
  ClassSection,
  CourseCatalog,
  CourseInvite,
  CreateClassSectionBody,
  CreateReviewBody,
  Enrollment,
  ExerciseRecord,
  MediaAccess,
  ReviewReasonCode,
  Semester,
  StudentProfileApi,
  StudentScore,
  UpdateClassSectionWindowBody,
} from "./teacher-api-types";

export { apiErrorText, isUnsupported };

/** List endpoints may return a bare array or a cursor page object. */
function asList<T>(data: T[] | { items?: T[]; data?: T[] } | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function fetchClassSections(): Promise<ClassSection[]> {
  return asList(await request<ClassSection[] | { items?: ClassSection[] }>("/class-sections"));
}

export async function fetchCourse(courseId: string): Promise<CourseCatalog> {
  return request<CourseCatalog>(`/courses/${encodeURIComponent(courseId)}`);
}

export async function fetchCourses(): Promise<CourseCatalog[]> {
  return asList(await request<CourseCatalog[] | { items?: CourseCatalog[] }>("/courses"));
}

export async function fetchCurrentSemester(): Promise<Semester> {
  return request<Semester>("/semesters/current");
}

export async function createClassSection(body: CreateClassSectionBody): Promise<ClassSection> {
  return request<ClassSection>("/class-sections", { method: "POST", body });
}

/**
 * Persists the check-in window a teacher configured. Contract 1.4 accepts both
 * organization-local wall clock ("HH:MM") and RFC3339 time for the daily
 * fields; the portal's <input type="time"> already produces wall clock.
 * Course/other hour targets are ScoreRule concerns and stay out of this call.
 */
export async function updateClassSectionWindow(
  classSectionId: string,
  body: UpdateClassSectionWindowBody,
): Promise<ClassSection> {
  return request<ClassSection>(`/class-sections/${encodeURIComponent(classSectionId)}`, {
    method: "PATCH",
    body,
  });
}

export async function createCourseInvite(classSectionId: string, expiresAt?: string | null): Promise<CourseInvite> {
  return request<CourseInvite>(`/class-sections/${encodeURIComponent(classSectionId)}/course-invites`, {
    method: "POST",
    body: expiresAt ? { expiresAt } : {},
  });
}

export async function fetchSubmittedExerciseRecords(classSectionId?: string): Promise<ExerciseRecord[]> {
  const query = new URLSearchParams({ status: "SUBMITTED" });
  if (classSectionId) query.set("classSectionId", classSectionId);
  return asList(
    await request<ExerciseRecord[] | { items?: ExerciseRecord[] }>(`/exercise-records?${query.toString()}`),
  );
}

export async function fetchExerciseRecord(recordId: string): Promise<ExerciseRecord> {
  return request<ExerciseRecord>(`/exercise-records/${encodeURIComponent(recordId)}`);
}

export async function openTeacherMedia(mediaId: string): Promise<string> {
  try {
    const access = await createMediaAccessUrl(mediaId, "TEACHER_REVIEW");
    return access.accessUrl;
  } catch (error) {
    if (error instanceof ApiError && (error.code === "VALIDATION_FAILED" || error.status === 422)) {
      const access = await createMediaAccessUrl(mediaId, "VIEW_ORIGINAL");
      return access.accessUrl;
    }
    throw error;
  }
}

async function createMediaAccessUrl(mediaId: string, purpose: string): Promise<MediaAccess> {
  return request<MediaAccess>(`/media/${encodeURIComponent(mediaId)}/access-url`, {
    method: "POST",
    body: { purpose },
  });
}

export async function submitExerciseReview(
  recordId: string,
  body: CreateReviewBody,
): Promise<unknown> {
  return request(`/exercise-records/${encodeURIComponent(recordId)}/reviews`, {
    method: "POST",
    body,
  });
}

/** Retry once on CONFLICT_VERSION_MISMATCH after re-fetching the record. */
export async function submitExerciseReviewWithRetry(
  recordId: string,
  buildBody: (record: ExerciseRecord) => CreateReviewBody,
): Promise<ExerciseRecord> {
  let record = await fetchExerciseRecord(recordId);
  try {
    await submitExerciseReview(recordId, buildBody(record));
  } catch (error) {
    if (error instanceof ApiError && error.code === "CONFLICT_VERSION_MISMATCH") {
      record = await fetchExerciseRecord(recordId);
      await submitExerciseReview(recordId, buildBody(record));
    } else {
      throw error;
    }
  }
  return fetchExerciseRecord(recordId);
}

export async function fetchEnrollments(classSectionId: string): Promise<Enrollment[]> {
  const query = new URLSearchParams({ classSectionId });
  return asList(
    await request<Enrollment[] | { items?: Enrollment[] }>(`/enrollments?${query.toString()}`),
  );
}

export async function fetchStudentProfile(studentId: string): Promise<StudentProfileApi | null> {
  try {
    return await request<StudentProfileApi>(`/students/${encodeURIComponent(studentId)}`);
  } catch (error) {
    if (isUnsupported(error) || (error instanceof ApiError && (error.status === 403 || error.status === 404))) {
      return null;
    }
    throw error;
  }
}

export async function fetchStudentScores(classSectionId?: string): Promise<StudentScore[]> {
  const query = new URLSearchParams();
  if (classSectionId) query.set("classSectionId", classSectionId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return asList(await request<StudentScore[] | { items?: StudentScore[] }>(`/student-scores${suffix}`));
}

export type TeacherCourseView = {
  id: string;
  code: string;
  section: string;
  name: string;
  semester: string;
  semesterId: string;
  courseId: string;
  status: "ACTIVE" | "ENDED";
  courseTarget: number;
  otherTarget: number;
  version: number;
  checkinWindow: {
    windowMode: "available" | "unavailable";
    dateRangeStart: string;
    dateRangeEnd: string;
    dailyStartTime: string;
    dailyEndTime: string;
    excludedDates: { date: string; reason: string }[];
    semesterDeadline: string;
  };
  invite?: { code: string; expiresAt: string; status: "active" | "revoked" };
};

export type TeacherStudentView = {
  id: string;
  enrollmentId: string;
  name: string;
  number: string;
  email: string;
  gender: "男" | "女" | "其他";
  grade: string;
  courseId: string;
  status: "active" | "removed" | "exited" | "disabled";
  joinedAt: string;
  joinMethod: "qr" | "manual_import";
  courseHours: number;
  otherHours: number;
  version: number;
};

export type TeacherCheckinView = {
  id: string;
  studentId: string;
  courseId: string;
  enrollmentId: string;
  creditType: "课程相关" | "其他运动" | "系统抵扣";
  sport: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  creditedMinutes: number;
  originalHours: 1 | 2;
  approvedHours: 0 | 1 | 2;
  description: string;
  submittedAt: string;
  status: "有效" | "已调整" | "系统抵扣";
  risk: "低风险" | "需关注" | "凭证模糊";
  confidence: number;
  proof: string[];
  mediaIds: string[];
  locationExpired: boolean;
  reviewComment?: string;
  internalNote?: string;
  source: "student" | "system";
  auditStatus: AuditStatus;
  invalidReason?: string;
  auditRemark?: string;
  version: number;
  reviewVersion: number;
};

export type TeacherGradeView = {
  id: string;
  studentId: string;
  courseId: string;
  enrollmentId: string;
  gender: "男" | "女";
  gradeGroup: "大一/大二" | "大三/大四";
  enduranceStatus: "NotRecorded" | "Recorded" | "Exempt" | "Absent";
  minutes?: number;
  seconds?: number;
  physicalScore?: number;
  published: boolean;
  version: number;
};

const defaultWindow = {
  windowMode: "available" as const,
  dateRangeStart: "",
  dateRangeEnd: "",
  dailyStartTime: "06:00",
  dailyEndTime: "22:00",
  excludedDates: [] as { date: string; reason: string }[],
  semesterDeadline: "",
};

function mapSectionStatus(status: string): "ACTIVE" | "ENDED" {
  return status === "ACTIVE" ? "ACTIVE" : "ENDED";
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
}

export function mapClassSectionToCourse(
  section: ClassSection,
  course: CourseCatalog | null,
  semesterLabel: string,
): TeacherCourseView {
  return {
    id: section.id,
    code: course?.courseCode ?? section.classCode,
    section: section.classCode,
    name: course?.courseName ?? section.displayName,
    semester: semesterLabel,
    semesterId: section.semesterId,
    courseId: section.courseId,
    status: mapSectionStatus(section.status),
    courseTarget: 10,
    otherTarget: 10,
    version: section.version,
    checkinWindow: {
      ...defaultWindow,
      windowMode: section.checkInWindowMode === "UNAVAILABLE" ? "unavailable" : "available",
      dateRangeStart: section.checkInStartDate ?? "",
      dateRangeEnd: section.checkInEndDate ?? "",
      dailyStartTime: formatTime(section.dailyStartTime) || "06:00",
      dailyEndTime: formatTime(section.dailyEndTime) || "22:00",
      excludedDates: (section.excludedDates ?? []).map((date) => ({ date, reason: "—" })),
      semesterDeadline: section.submissionDeadlineAt?.slice(0, 10) ?? section.checkInEndDate ?? "",
    },
  };
}

export async function loadTeacherCourses(): Promise<{
  courses: TeacherCourseView[];
  catalog: CourseCatalog[];
  semester: Semester | null;
}> {
  const [sections, catalog, semester] = await Promise.all([
    fetchClassSections(),
    fetchCourses().catch(() => [] as CourseCatalog[]),
    fetchCurrentSemester().catch(() => null),
  ]);
  const semesterLabel = semester?.displayName ?? semester?.name ?? "当前学期";
  const courseCache = new Map<string, CourseCatalog>();
  for (const item of catalog) courseCache.set(item.id, item);

  const courses: TeacherCourseView[] = [];
  for (const section of sections) {
    let course = courseCache.get(section.courseId) ?? null;
    if (!course) {
      try {
        course = await fetchCourse(section.courseId);
        courseCache.set(course.id, course);
      } catch {
        course = null;
      }
    }
    courses.push(mapClassSectionToCourse(section, course, semesterLabel));
  }
  return { courses, catalog: [...courseCache.values()], semester };
}

function mapGender(value: string | null | undefined): "男" | "女" | "其他" {
  if (value === "MALE" || value === "男") return "男";
  if (value === "FEMALE" || value === "女") return "女";
  return "其他";
}

function mapEnrollmentStatus(status: string): TeacherStudentView["status"] {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") return "active";
  if (upper === "REMOVED") return "removed";
  if (upper === "ENDED" || upper === "EXITED") return "exited";
  return "disabled";
}

function mapJoinMethod(source: string): "qr" | "manual_import" {
  return /INVITE|QR/i.test(source) ? "qr" : "manual_import";
}

export async function loadTeacherStudents(classSectionIds: string[]): Promise<TeacherStudentView[]> {
  const rows: TeacherStudentView[] = [];
  const profileCache = new Map<string, StudentProfileApi | null>();

  for (const classSectionId of classSectionIds) {
    const enrollments = await fetchEnrollments(classSectionId);
    for (const enrollment of enrollments) {
      if (!profileCache.has(enrollment.studentId)) {
        profileCache.set(enrollment.studentId, await fetchStudentProfile(enrollment.studentId));
      }
      const profile = profileCache.get(enrollment.studentId);
      const shortId = enrollment.studentId.slice(-8);
      rows.push({
        id: enrollment.studentId,
        enrollmentId: enrollment.id,
        name: profile?.fullName?.trim() || `学生 ${shortId}`,
        number: profile?.studentNumber?.trim() || shortId,
        email: (profile?.primaryEmail as string | null | undefined)?.trim() || "",
        gender: mapGender(profile?.gender ?? null),
        grade: profile?.gradeYear ? `${profile.gradeYear}级` : "—",
        courseId: enrollment.classSectionId,
        status: mapEnrollmentStatus(enrollment.status),
        joinedAt: enrollment.joinedAt.replace("T", " ").slice(0, 16),
        joinMethod: mapJoinMethod(enrollment.source),
        courseHours: 0,
        otherHours: 0,
        version: enrollment.version,
      });
    }
  }
  return rows;
}

function reviewToAuditStatus(record: ExerciseRecord): AuditStatus {
  const result = record.currentReview?.result;
  if (result === "VALID") return "valid";
  if (result === "INVALID") return "invalid";
  return "pending";
}

function hoursFromSeconds(seconds: number): 0 | 1 | 2 {
  const hours = Math.round(seconds / 3600);
  if (hours <= 0) return 0;
  if (hours === 1) return 1;
  return 2;
}

function reasonCodeLabel(code: ReviewReasonCode | null | undefined): string | undefined {
  if (!code) return undefined;
  const map: Record<ReviewReasonCode, string> = {
    INSUFFICIENT_EVIDENCE: "图片或视频无法证明运动过程",
    INVALID_MEDIA: "媒体内容与运动无关",
    DURATION_INCONSISTENT: "运动时长不符合要求",
    IDENTITY_MISMATCH: "疑似代打卡",
    DUPLICATE_SUBMISSION: "重复提交",
    OUTSIDE_ALLOWED_SCOPE: "运动记录异常",
    OTHER: "其他",
  };
  return map[code];
}

export const INVALID_REASON_TO_CODE: Record<string, ReviewReasonCode> = {
  "运动时长不符合要求": "DURATION_INCONSISTENT",
  "图片或视频无法证明运动过程": "INSUFFICIENT_EVIDENCE",
  "媒体内容与运动无关": "INVALID_MEDIA",
  "重复提交": "DUPLICATE_SUBMISSION",
  "疑似代打卡": "IDENTITY_MISMATCH",
  "运动记录异常": "OUTSIDE_ALLOWED_SCOPE",
  "其他": "OTHER",
};

export function mapExerciseRecordToCheckin(record: ExerciseRecord): TeacherCheckinView {
  const durationMinutes = Math.round((record.actualDurationSeconds || 0) / 60);
  const creditedMinutes = Math.round((record.creditedDurationSeconds || 0) / 60);
  const mediaIds = record.mediaIds ?? [];
  const auditStatus = reviewToAuditStatus(record);
  return {
    id: record.id,
    studentId: record.studentId,
    courseId: record.classSectionId,
    enrollmentId: record.enrollmentId,
    creditType: record.creditType === "COURSE_RELATED" ? "课程相关" : "其他运动",
    sport: record.sportName || record.sportType || "运动",
    // Slicing the raw ISO string would show UTC (8 hours behind Beijing);
    // teachers must read the record in the organization's time.
    startAt: businessDateTime(record.submittedAt) || record.businessDate,
    endAt: businessDateTime(record.submittedAt) || record.businessDate,
    durationMinutes,
    creditedMinutes,
    originalHours: hoursFromSeconds(record.actualDurationSeconds) || 1,
    approvedHours: hoursFromSeconds(record.creditedDurationSeconds),
    description: record.description,
    // The backend's business day is authoritative for "which day this counts
    // as"; the UTC date of the timestamp can fall on the previous day.
    submittedAt: record.businessDate || businessDateTime(record.submittedAt).slice(0, 10),
    status: auditStatus === "valid" ? "有效" : "已调整",
    risk: "低风险",
    confidence: 0.9,
    proof: mediaIds.length ? mediaIds.map((_, index) => `凭证 ${index + 1}`) : [],
    mediaIds,
    locationExpired: false,
    reviewComment: record.currentReview?.publicComment ?? undefined,
    source: "student",
    auditStatus,
    invalidReason: reasonCodeLabel(record.currentReview?.reasonCode),
    auditRemark: record.currentReview?.reasonCode === "OTHER" ? (record.currentReview.publicComment ?? undefined) : undefined,
    version: record.version,
    reviewVersion: record.currentReview?.result === "PENDING" || !record.currentReview ? 1 : 1,
  };
}

/** Local联调 bridge: make-test-record.ps1 writes media ids here because record projection omits mediaIds. */
async function loadDevRecordMediaMap(): Promise<Record<string, string[]>> {
  try {
    const response = await fetch("/.dev-record-media.json", { cache: "no-store" });
    if (!response.ok) return {};
    const parsed = (await response.json()) as Record<string, string[] | { mediaIds?: string[] }>;
    const result: Record<string, string[]> = {};
    for (const [recordId, value] of Object.entries(parsed)) {
      if (Array.isArray(value)) result[recordId] = value;
      else if (value?.mediaIds) result[recordId] = value.mediaIds;
    }
    return result;
  } catch {
    return {};
  }
}

export async function loadSubmittedCheckins(): Promise<TeacherCheckinView[]> {
  const [records, mediaMap] = await Promise.all([fetchSubmittedExerciseRecords(), loadDevRecordMediaMap()]);
  const detailed = await Promise.all(
    records.map(async (item) => {
      try {
        const detail = await fetchExerciseRecord(item.id);
        const mediaIds = detail.mediaIds ?? item.mediaIds ?? mediaMap[item.id] ?? mediaMap[detail.id] ?? [];
        return mapExerciseRecordToCheckin({ ...item, ...detail, mediaIds });
      } catch {
        return mapExerciseRecordToCheckin({ ...item, mediaIds: item.mediaIds ?? mediaMap[item.id] ?? [] });
      }
    }),
  );
  return detailed;
}

export function mapStudentScoreToGrade(
  score: StudentScore,
  meta: { studentId: string; classSectionId: string; gender?: "男" | "女"; gradeGroup?: "大一/大二" | "大三/大四" },
): TeacherGradeView {
  return {
    id: score.id,
    studentId: meta.studentId,
    courseId: meta.classSectionId,
    enrollmentId: score.enrollmentId,
    gender: meta.gender ?? "男",
    gradeGroup: meta.gradeGroup ?? "大一/大二",
    enduranceStatus: "NotRecorded",
    physicalScore: score.finalScore ?? score.baseScore ?? undefined,
    published: Boolean(score.publishedAt) || score.status === "PUBLISHED" || score.status === "LOCKED",
    version: score.version,
  };
}

export async function loadTeacherGrades(
  students: TeacherStudentView[],
  classSectionId?: string,
): Promise<TeacherGradeView[]> {
  const scores = await fetchStudentScores(classSectionId);
  if (!scores.length) return [];
  const byEnrollment = new Map(students.map((student) => [student.enrollmentId, student]));
  return scores.map((score) => {
    const student = byEnrollment.get(score.enrollmentId);
    return mapStudentScoreToGrade(score, {
      studentId: student?.id ?? score.enrollmentId,
      classSectionId: student?.courseId ?? classSectionId ?? "",
      gender: student?.gender === "女" ? "女" : "男",
    });
  });
}

export function expectedReviewVersionOf(record: TeacherCheckinView | ExerciseRecord): number {
  if ("reviewVersion" in record && typeof record.reviewVersion === "number") return record.reviewVersion;
  return 1;
}
