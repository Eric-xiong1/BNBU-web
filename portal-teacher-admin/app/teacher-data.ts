import {
  ApiError,
  apiErrorText,
  isUnsupported,
  request,
  requestWithMeta,
} from "./api-client";
import { businessDateTime } from "./business-time";
import type { AuditStatus } from "./checkin-audit";
import type {
  ClassSection,
  CourseCatalog,
  CourseInvite,
  CreateClassSectionBody,
  CreateReviewBody,
  Enrollment,
  ExemptionApplication,
  ExerciseRecord,
  ExerciseRecordEvidenceContext,
  MediaAccess,
  ReviewReasonCode,
  ReviewExemptionApplicationBody,
  ReviewRecord,
  Semester,
  StudentProfileApi,
  StructuredExemptionApplication,
  StudentScore,
  UpdateClassSectionWindowBody,
} from "./teacher-api-types";

export { apiErrorText, isUnsupported };

/** List endpoints may return a bare array or a cursor page object. */
function asList<T>(
  data: T[] | { items?: T[]; data?: T[] } | null | undefined,
): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

// Contract list endpoints page with an opaque `cursor` (limit 1–100, default
// 20). The workspace cross-checks records against the roster projection, so a
// partial first page is not just incomplete — it makes valid records look
// orphaned. Always drain every page before handing data to the UI.
const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

async function fetchAllPages<T>(
  path: string,
  params?: URLSearchParams,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query = new URLSearchParams(params);
    query.set("limit", String(PAGE_LIMIT));
    if (cursor) query.set("cursor", cursor);
    const envelope = await requestWithMeta<T[] | { items?: T[] }>(
      `${path}?${query.toString()}`,
    );
    rows.push(...asList(envelope.data));
    const pagination = envelope.meta?.pagination;
    if (!pagination?.hasMore || !pagination.nextCursor) return rows;
    cursor = pagination.nextCursor;
  }
  return rows;
}

export async function fetchClassSections(): Promise<ClassSection[]> {
  return fetchAllPages<ClassSection>("/class-sections");
}

export async function fetchCourse(courseId: string): Promise<CourseCatalog> {
  return request<CourseCatalog>(`/courses/${encodeURIComponent(courseId)}`);
}

export async function fetchCourses(): Promise<CourseCatalog[]> {
  return fetchAllPages<CourseCatalog>("/courses");
}

export async function fetchCurrentSemester(): Promise<Semester> {
  return request<Semester>("/semesters/current");
}

export async function createClassSection(
  body: CreateClassSectionBody,
): Promise<ClassSection> {
  return request<ClassSection>("/class-sections", { method: "POST", body });
}

/**
 * Persists the check-in window a teacher configured. Contract 1.5 accepts both
 * organization-local wall clock ("HH:MM") and RFC3339 time for the daily
 * fields; the portal's <input type="time"> already produces wall clock.
 * Course/other hour targets are ScoreRule concerns and stay out of this call.
 */
export async function updateClassSectionWindow(
  classSectionId: string,
  body: UpdateClassSectionWindowBody,
): Promise<ClassSection> {
  return request<ClassSection>(
    `/class-sections/${encodeURIComponent(classSectionId)}`,
    {
      method: "PATCH",
      body,
    },
  );
}

export async function createCourseInvite(
  classSectionId: string,
  expiresAt?: string | null,
): Promise<CourseInvite> {
  return request<CourseInvite>(
    `/class-sections/${encodeURIComponent(classSectionId)}/course-invites`,
    {
      method: "POST",
      body: expiresAt ? { expiresAt } : {},
    },
  );
}

export async function fetchExerciseRecords(
  classSectionId?: string,
): Promise<ExerciseRecord[]> {
  const query = new URLSearchParams();
  if (classSectionId) query.set("classSectionId", classSectionId);
  return fetchAllPages<ExerciseRecord>("/exercise-records", query);
}

export async function fetchExerciseRecord(
  recordId: string,
): Promise<ExerciseRecord> {
  return request<ExerciseRecord>(
    `/exercise-records/${encodeURIComponent(recordId)}`,
  );
}

export async function fetchExerciseRecordEvidenceContext(
  recordId: string,
): Promise<ExerciseRecordEvidenceContext> {
  return request<ExerciseRecordEvidenceContext>(
    `/exercise-records/${encodeURIComponent(recordId)}/evidence-context`,
  );
}

export async function openTeacherMedia(mediaId: string): Promise<string> {
  const access = await createMediaAccessUrl(mediaId, "VIEW_ORIGINAL");
  return access.accessUrl;
}

async function createMediaAccessUrl(
  mediaId: string,
  purpose: string,
): Promise<MediaAccess> {
  return request<MediaAccess>(
    `/media/${encodeURIComponent(mediaId)}/access-url`,
    {
      method: "POST",
      body: { purpose },
    },
  );
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
export async function fetchLatestExerciseReview(
  recordId: string,
): Promise<ReviewRecord | null> {
  const reviews = asList(
    await request<ReviewRecord[] | { items?: ReviewRecord[] }>(
      `/exercise-records/${encodeURIComponent(recordId)}/reviews?limit=1&sort=-reviewVersion`,
    ),
  );
  return reviews[0] ?? null;
}

/** Retry once on CONFLICT_VERSION_MISMATCH after re-fetching the record. */
export async function submitExerciseReviewWithRetry(
  recordId: string,
  buildBody: (
    record: ExerciseRecord,
    currentReviewVersion: number,
  ) => CreateReviewBody,
): Promise<ExerciseRecord> {
  let [record, latestReview] = await Promise.all([
    fetchExerciseRecord(recordId),
    fetchLatestExerciseReview(recordId),
  ]);
  try {
    await submitExerciseReview(
      recordId,
      buildBody(record, latestReview?.reviewVersion ?? 0),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code === "CONFLICT_VERSION_MISMATCH"
    ) {
      [record, latestReview] = await Promise.all([
        fetchExerciseRecord(recordId),
        fetchLatestExerciseReview(recordId),
      ]);
      await submitExerciseReview(
        recordId,
        buildBody(record, latestReview?.reviewVersion ?? 0),
      );
    } else {
      throw error;
    }
  }
  return fetchExerciseRecord(recordId);
}

export async function fetchEnrollments(
  classSectionId: string,
): Promise<Enrollment[]> {
  const query = new URLSearchParams({ classSectionId });
  return fetchAllPages<Enrollment>("/enrollments", query);
}

export async function fetchStudentProfile(
  studentId: string,
): Promise<StudentProfileApi> {
  return request<StudentProfileApi>(
    `/students/${encodeURIComponent(studentId)}`,
  );
}

export async function fetchStudentScores(
  classSectionId?: string,
): Promise<StudentScore[]> {
  const query = new URLSearchParams();
  if (classSectionId) query.set("classSectionId", classSectionId);
  return fetchAllPages<StudentScore>("/student-scores", query);
}

export async function removeEnrollment(
  enrollmentId: string,
  expectedVersion: number,
  reason: string,
): Promise<Enrollment> {
  return request<Enrollment>(
    `/enrollments/${encodeURIComponent(enrollmentId)}/remove`,
    { method: "POST", body: { expectedVersion, reason } },
  );
}

export async function fetchExemptionApplications(
  classSectionId?: string,
): Promise<StructuredExemptionApplication[]> {
  const query = new URLSearchParams();
  if (classSectionId) query.set("classSectionId", classSectionId);
  return fetchAllPages<StructuredExemptionApplication>(
    "/exemption-application-details",
    query,
  );
}

export async function reviewExemptionApplication(
  applicationId: string,
  body: ReviewExemptionApplicationBody,
): Promise<ExemptionApplication> {
  return request<ExemptionApplication>(
    `/exemption-applications/${encodeURIComponent(applicationId)}/review`,
    { method: "POST", body },
  );
}

export async function recalculateStudentScore(
  scoreId: string,
  expectedVersion: number,
): Promise<StudentScore> {
  return request<StudentScore>(
    `/student-scores/${encodeURIComponent(scoreId)}/recalculate`,
    { method: "POST", body: { expectedVersion } },
  );
}

export async function publishStudentScore(
  scoreId: string,
  expectedVersion: number,
): Promise<StudentScore> {
  return request<StudentScore>(
    `/student-scores/${encodeURIComponent(scoreId)}/publish`,
    { method: "POST", body: { expectedVersion } },
  );
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
  gender: "男" | "女" | "其他" | "未知";
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
  originalHours: number;
  approvedHours: number;
  description: string;
  submittedAt: string;
  status: "待审核" | "有效" | "已调整" | "系统抵扣";
  risk: "低风险" | "需关注" | "凭证模糊" | null;
  confidence: number | null;
  proof: string[];
  mediaIds: string[];
  locationExpired: boolean | null;
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
  gender: "男" | "女" | "其他" | "未知";
  gradeGroup: "大一/大二" | "大三/大四" | "未知";
  enduranceStatus: "NotRecorded" | "Recorded" | "Exempt" | "Absent" | "Unavailable";
  minutes?: number;
  seconds?: number;
  physicalScore?: number;
  published: boolean;
  scoreStatus?: string;
  qualificationStatus?: string;
  validCourseDurationSeconds?: number;
  validGeneralDurationSeconds?: number;
  totalValidDurationSeconds?: number;
  scoringSeconds?: number;
  excessSeconds?: number;
  baseScore?: number | null;
  adjustmentTotal?: number | null;
  calculatedAt?: string | null;
  publishedAt?: string | null;
  version: number;
};

export type TeacherExemptionView = {
  id: string;
  studentId: string;
  courseId: string;
  kind:
    | "耐力跑免测"
    | "校队认证"
    | "社团认证"
    | "体测免测"
    | "运动打卡减免"
    | "特殊情况";
  organization?: string;
  reason: string;
  material: string[];
  mediaIds: string[];
  submittedAt: string;
  status: "pending" | "supplement_required" | "approved" | "rejected";
  reviewComment?: string;
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
    // The accepted score rule is TOTAL_ONLY (20h); category splits are not authoritative.
    courseTarget: 20,
    otherTarget: 0,
    version: section.version,
    checkinWindow: {
      ...defaultWindow,
      windowMode:
        section.checkInWindowMode === "UNAVAILABLE"
          ? "unavailable"
          : "available",
      dateRangeStart: section.checkInStartDate ?? "",
      dateRangeEnd: section.checkInEndDate ?? "",
      dailyStartTime: formatTime(section.dailyStartTime) || "06:00",
      dailyEndTime: formatTime(section.dailyEndTime) || "22:00",
      excludedDates: (section.excludedDates ?? []).map((date) => ({
        date,
        reason: "—",
      })),
      semesterDeadline:
        section.submissionDeadlineAt?.slice(0, 10) ??
        section.checkInEndDate ??
        "",
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
    fetchCourses(),
    fetchCurrentSemester(),
  ]);
  const semesterLabel = semester?.displayName ?? semester?.name ?? "当前学期";
  const courseCache = new Map<string, CourseCatalog>();
  for (const item of catalog) courseCache.set(item.id, item);

  const courses: TeacherCourseView[] = [];
  for (const section of sections) {
    let course = courseCache.get(section.courseId) ?? null;
    if (!course) {
      course = await fetchCourse(section.courseId);
      courseCache.set(course.id, course);
    }
    courses.push(mapClassSectionToCourse(section, course, semesterLabel));
  }
  return { courses, catalog: [...courseCache.values()], semester };
}

function mapGender(value: string | null | undefined): "男" | "女" | "其他" | "未知" {
  if (value === "MALE" || value === "男") return "男";
  if (value === "FEMALE" || value === "女") return "女";
  if (value === "OTHER" || value === "其他") return "其他";
  return "未知";
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

export async function loadTeacherStudents(
  classSectionIds: string[],
): Promise<TeacherStudentView[]> {
  const rows: TeacherStudentView[] = [];
  const profileCache = new Map<string, StudentProfileApi>();

  for (const classSectionId of classSectionIds) {
    const enrollments = await fetchEnrollments(classSectionId);
    for (const enrollment of enrollments) {
      if (!profileCache.has(enrollment.studentId)) {
        profileCache.set(
          enrollment.studentId,
          await fetchStudentProfile(enrollment.studentId),
        );
      }
      const profile = profileCache.get(enrollment.studentId);
      if (!profile?.fullName?.trim() || !profile.studentNumber?.trim()) {
        throw new Error("STUDENT_PROFILE_IDENTITY_INCOMPLETE");
      }
      rows.push({
        id: enrollment.studentId,
        enrollmentId: enrollment.id,
        name: profile.fullName.trim(),
        number: profile.studentNumber.trim(),
        email:
          (profile.primaryEmail as string | null | undefined)?.trim() || "",
        gender: mapGender(profile.gender ?? null),
        grade: profile.gradeYear ? `${profile.gradeYear}级` : "—",
        courseId: enrollment.classSectionId,
        status: mapEnrollmentStatus(enrollment.status),
        joinedAt: enrollment.joinedAt,
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
  // Seed/backfill data can mark a record REVIEWED without exposing a review
  // row (currentReview stays null). The backend rejects any further review on
  // such records with CONFLICT_VERSION_MISMATCH, so queueing them as pending
  // would trap teachers in an unresolvable conflict loop.
  if (record.status === "REVIEWED") return "valid";
  return "pending";
}

const exerciseSportLabels: Record<string, string> = {
  RUNNING: "跑步",
  BASKETBALL: "篮球",
  FOOTBALL: "足球",
  BADMINTON: "羽毛球",
  TABLE_TENNIS: "乒乓球",
  SWIMMING: "游泳",
  FITNESS: "健身",
  CYCLING: "骑行",
  OTHER: "其他",
};

function exerciseSportLabel(sportType: string): string {
  const normalized = sportType.trim().toUpperCase();
  return exerciseSportLabels[normalized] ?? (sportType.trim() || "运动");
}

function reasonCodeLabel(
  code: ReviewReasonCode | null | undefined,
): string | undefined {
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
  运动时长不符合要求: "DURATION_INCONSISTENT",
  图片或视频无法证明运动过程: "INSUFFICIENT_EVIDENCE",
  媒体内容与运动无关: "INVALID_MEDIA",
  重复提交: "DUPLICATE_SUBMISSION",
  疑似代打卡: "IDENTITY_MISMATCH",
  运动记录异常: "OUTSIDE_ALLOWED_SCOPE",
  其他: "OTHER",
};

export function mapExerciseRecordToCheckin(
  record: ExerciseRecord,
  evidenceContext?: ExerciseRecordEvidenceContext,
  currentReviewVersion = 0,
): TeacherCheckinView {
  const durationMinutes = Math.round((record.actualDurationSeconds || 0) / 60);
  const creditedMinutes = Math.round(
    (record.creditedDurationSeconds || 0) / 60,
  );
  const mediaIds = evidenceContext?.mediaIds ?? [];
  const auditStatus = reviewToAuditStatus(record);
  return {
    id: record.id,
    studentId: record.studentId,
    courseId: record.classSectionId,
    enrollmentId: record.enrollmentId,
    creditType:
      record.creditType === "COURSE_RELATED" ? "课程相关" : "其他运动",
    sport: record.sportName?.trim() || exerciseSportLabel(record.sportType),
    // Slicing the raw ISO string would show UTC (8 hours behind Beijing);
    // teachers must read the record in the organization's time.
    startAt:
      businessDateTime(evidenceContext?.startedAt) || record.businessDate,
    endAt: businessDateTime(evidenceContext?.endedAt) || record.businessDate,
    durationMinutes,
    creditedMinutes,
    originalHours: Math.max(0, record.actualDurationSeconds) / 3600,
    approvedHours: Math.max(0, record.creditedDurationSeconds) / 3600,
    description: record.description ?? "",
    // The backend's business day is authoritative for "which day this counts
    // as"; the UTC date of the timestamp can fall on the previous day.
    submittedAt:
      record.businessDate || businessDateTime(record.submittedAt).slice(0, 10),
    status:
      auditStatus === "valid"
        ? "有效"
        : auditStatus === "invalid"
          ? "已调整"
          : "待审核",
    risk: null,
    confidence: null,
    proof: mediaIds.length
      ? mediaIds.map((_, index) => `凭证 ${index + 1}`)
      : [],
    mediaIds,
    locationExpired: null,
    reviewComment: record.currentReview?.publicComment ?? undefined,
    source: "student",
    auditStatus,
    invalidReason: reasonCodeLabel(record.currentReview?.reasonCode),
    auditRemark:
      record.currentReview?.reasonCode === "OTHER"
        ? (record.currentReview.publicComment ?? undefined)
        : undefined,
    version: record.version,
    reviewVersion: currentReviewVersion,
  };
}

export async function loadSubmittedCheckins(): Promise<TeacherCheckinView[]> {
  // The backend also returns DRAFT and CANCELLED records to the teacher, but
  // neither is reviewable (the review endpoint requires SUBMITTED), so they
  // must never enter the audit workspace.
  const records = (await fetchExerciseRecords()).filter(
    (item) => item.status === "SUBMITTED" || item.status === "REVIEWED",
  );
  const detailed = await Promise.all(
    records.map(async (item) => {
      const [detail, evidenceContext, latestReview] = await Promise.all([
        fetchExerciseRecord(item.id),
        fetchExerciseRecordEvidenceContext(item.id),
        fetchLatestExerciseReview(item.id),
      ]);
      return mapExerciseRecordToCheckin(
        { ...item, ...detail },
        evidenceContext,
        latestReview?.reviewVersion ?? 0,
      );
    }),
  );
  return detailed;
}

export function mapStudentScoreToGrade(
  score: StudentScore,
  meta: {
    studentId: string;
    classSectionId: string;
    gender?: "男" | "女" | "其他" | "未知";
    gradeGroup?: "大一/大二" | "大三/大四" | "未知";
  },
): TeacherGradeView {
  return {
    id: score.id,
    studentId: meta.studentId,
    courseId: meta.classSectionId,
    enrollmentId: score.enrollmentId,
    gender: meta.gender ?? "未知",
    gradeGroup: meta.gradeGroup ?? "未知",
    enduranceStatus: "Unavailable",
    physicalScore: score.finalScore ?? score.baseScore ?? undefined,
    published:
      Boolean(score.publishedAt) ||
      score.status === "PUBLISHED" ||
      score.status === "LOCKED",
    scoreStatus: score.status,
    qualificationStatus: score.qualificationStatus,
    validCourseDurationSeconds: score.validCourseDurationSeconds,
    validGeneralDurationSeconds: score.validGeneralDurationSeconds,
    totalValidDurationSeconds: score.totalValidDurationSeconds,
    scoringSeconds: score.scoringSeconds,
    excessSeconds: score.excessSeconds,
    baseScore: score.baseScore,
    adjustmentTotal: score.adjustmentTotal,
    calculatedAt: score.calculatedAt,
    publishedAt: score.publishedAt,
    version: score.version,
  };
}

export async function loadTeacherGrades(
  students: TeacherStudentView[],
  classSectionId?: string,
): Promise<TeacherGradeView[]> {
  const scores = await fetchStudentScores(classSectionId);
  const byEnrollment = new Map(
    students.map((student) => [student.enrollmentId, student]),
  );
  const byScoreEnrollment = new Map(
    scores.map((score) => [score.enrollmentId, score]),
  );
  const mapped = scores.map((score) => {
    const student = byEnrollment.get(score.enrollmentId);
    return mapStudentScoreToGrade(score, {
      studentId: student?.id ?? score.enrollmentId,
      classSectionId: student?.courseId ?? classSectionId ?? "",
      gender: student?.gender ?? "未知",
    });
  });
  for (const student of students) {
    if (byScoreEnrollment.has(student.enrollmentId)) continue;
    mapped.push({
      id: `pending:${student.enrollmentId}`,
      studentId: student.id,
      courseId: student.courseId,
      enrollmentId: student.enrollmentId,
      gender: student.gender,
      gradeGroup: "未知",
      enduranceStatus: "Unavailable",
      published: false,
      version: student.version,
    });
  }
  return mapped;
}

export async function loadTeacherExemptions(): Promise<TeacherExemptionView[]> {
  const applications = await fetchExemptionApplications();
  return applications.map((application) => ({
    id: application.id,
    studentId: application.studentId,
    courseId: application.classSectionId,
    kind:
      application.applicationSubtype === "RUN_800M" ||
      application.applicationSubtype === "RUN_1000M"
        ? "耐力跑免测"
        : application.applicationSubtype === "SCHOOL_TEAM"
          ? "校队认证"
          : application.applicationSubtype === "STUDENT_CLUB"
            ? "社团认证"
            : application.applicationType === "PHYSICAL_TEST"
              ? "体测免测"
              : application.applicationType === "EXERCISE_CHECK_IN"
                ? "运动打卡减免"
                : "特殊情况",
    organization:
      application.organizationName ??
      (application.applicationSubtype === "RUN_800M"
        ? "800m"
        : application.applicationSubtype === "RUN_1000M"
          ? "1000m"
          : undefined),
    reason: application.reason,
    material: application.mediaIds.map((_, index) => `凭证 ${index + 1}`),
    mediaIds: [...application.mediaIds],
    submittedAt: application.submittedAt ?? "",
    status:
      application.status === "APPROVED"
        ? "approved"
        : application.status === "REJECTED"
          ? "rejected"
          : application.status === "SUPPLEMENT_REQUIRED"
            ? "supplement_required"
            : "pending",
    reviewComment: application.publicComment ?? undefined,
    version: application.version,
  }));
}
