// Real backend client for the unified BNBU Sports backend (OpenAPI 1.1,
// NestJS `/api/v1`). Envelope: success `{data, meta}` / error
// `{code, message, details, requestId, timestamp}`. Student sessions are
// established only by the QR/invite join flow (joinClassSectionWithInvite);
// password login stays TEACHER/ADMIN-only and the mock login button keeps
// working entirely offline.

import { tx } from "./i18n.js";

const NS = "bnbu.student.web.";

function readRaw(key) {
  try { return globalThis.localStorage?.getItem(NS + key) ?? null; } catch { return null; }
}
function writeRaw(key, value) {
  try {
    if (value === null || value === undefined) globalThis.localStorage?.removeItem(NS + key);
    else globalThis.localStorage?.setItem(NS + key, value);
  } catch { /* storage unavailable */ }
}

// ── Base URL ─────────────────────────────────────────────────────
// Same-origin by default: the preview server proxies /api/* to the local
// backend and /minio/* to its object storage, so no CORS is involved.
const DEFAULT_BASE = "/api/v1";

export function apiBaseUrl() {
  const fromQuery = new URLSearchParams(globalThis.location?.search || "").get("api");
  if (fromQuery) { writeRaw("apiBase", fromQuery); return fromQuery.replace(/\/$/, ""); }
  return (readRaw("apiBase") || DEFAULT_BASE).replace(/\/$/, "");
}

/** Rewrites direct MinIO object URLs onto the same-origin /minio proxy. */
export function proxyObjectUrl(url) {
  return String(url).replace(/^https?:\/\/(?:127\.0\.0\.1|localhost):9000/, "/minio");
}

// ── Token storage ────────────────────────────────────────────────
function readTokens() {
  try { return JSON.parse(readRaw("apiTokens") || "null"); } catch { return null; }
}
function writeTokens(tokens) {
  writeRaw("apiTokens", tokens ? JSON.stringify(tokens) : null);
}

export function hasApiSession() { return !!readTokens(); }
export function clearApiSession() {
  writeTokens(null);
  writeRaw("apiJoinContext", null);
}

export function storeAuthSession(authSession) {
  writeTokens({
    accessToken: authSession.accessToken,
    refreshToken: authSession.refreshToken,
    accessTokenExpiresAt: authSession.accessTokenExpiresAt,
    userId: authSession.user?.id || null,
  });
}

// Invite preview facts cached at join time (course/teacher display names are
// not readable through student projections afterwards).
export function storeJoinContext(context) { writeRaw("apiJoinContext", JSON.stringify(context)); }
export function readJoinContext() {
  try { return JSON.parse(readRaw("apiJoinContext") || "null"); } catch { return null; }
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Errors ───────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.code = body?.code || "UNKNOWN";
    this.details = body?.details || {};
    this.requestId = body?.requestId || null;
  }
}

export const isUnsupported = (error) => error instanceof ApiError && error.code === "SYSTEM_MODE_UNSUPPORTED";

export function apiErrorText(error) {
  if (!(error instanceof ApiError)) {
    return tx("网络连接失败，请确认后端服务已启动。", "Network connection failed. Make sure the backend service is running.");
  }
  if (isUnsupported(error)) return tx("该功能暂未开放。", "This feature is not yet available.");
  const known = {
    VALIDATION_FAILED: tx("提交的资料格式不正确，请检查后重试。", "Some fields are invalid. Check and try again."),
    UNAUTHORIZED: tx("登录状态已失效，请重新加入课程登录。", "Your session has expired. Join the course again to sign in."),
    FORBIDDEN: tx("没有权限执行该操作。", "You do not have permission for this action."),
    NOT_FOUND: tx("资源不存在或已被移除。", "The resource does not exist or was removed."),
    CONFLICT_VERSION_MISMATCH: tx("数据已在别处更新，请刷新后重试。", "The data changed elsewhere. Refresh and try again."),
    RATE_LIMITED: tx("操作过于频繁，请稍后再试。", "Too many attempts. Try again later."),
  };
  return known[error.code] || error.message;
}

// ── Request core ─────────────────────────────────────────────────
let refreshPromise = null;

async function rawRequest(path, { method = "GET", body, headers = {}, auth = true, idempotent = false } = {}) {
  const tokens = readTokens();
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (idempotent && !requestHeaders["Idempotency-Key"]) requestHeaders["Idempotency-Key"] = uuid();
  if (auth && tokens?.accessToken) requestHeaders["Authorization"] = `Bearer ${tokens.accessToken}`;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed = null;
  try { parsed = await response.json(); } catch { /* empty body */ }
  if (!response.ok) throw new ApiError(response.status, parsed);
  return parsed?.data;
}

async function refreshSession() {
  const tokens = readTokens();
  if (!tokens?.refreshToken) throw new ApiError(401, { code: "UNAUTHORIZED", message: "No refresh token" });
  const data = await rawRequest("/auth/refresh", {
    method: "POST",
    auth: false,
    idempotent: true,
    body: { refreshToken: tokens.refreshToken },
  });
  storeAuthSession(data);
  return data;
}

export async function request(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    const authenticated = options.auth !== false && readTokens();
    if (error instanceof ApiError && error.status === 401 && authenticated) {
      if (!refreshPromise) {
        refreshPromise = refreshSession().finally(() => { refreshPromise = null; });
      }
      await refreshPromise; // throws if the refresh itself fails
      return rawRequest(path, options);
    }
    throw error;
  }
}

// ── Auth & join flow ─────────────────────────────────────────────
export const previewInvite = (inviteToken) =>
  request(`/course-invites/${encodeURIComponent(inviteToken)}/preview`, { auth: false });

export async function joinWithInvite(inviteToken, profile) {
  // 1. one-time join capability from the public profile facts
  const capability = await request(`/course-invites/${encodeURIComponent(inviteToken)}/join-capabilities`, {
    method: "POST", auth: false, idempotent: true, body: profile,
  });
  // 2. consume it — atomically creates User/StudentProfile/Enrollment/AuthSession
  const joined = await rawRequest(`/course-invites/${encodeURIComponent(inviteToken)}/join`, {
    method: "POST", auth: false, idempotent: true,
    headers: { "X-Join-Capability": capability.joinCapability },
  });
  storeAuthSession(joined.authSession);
  return joined;
}

export async function logoutApi() {
  try { await request("/auth/logout", { method: "POST", idempotent: true }); } catch { /* best effort */ }
  clearApiSession();
}

// ── Student data ─────────────────────────────────────────────────
export const getMe = () => request("/me");
export const getCurrentSemester = () => request("/semesters/current");
export const listMyEnrollments = () => request("/enrollments");
export const listMyClassSections = () => request("/class-sections");
export const getCourseById = (courseId) => request(`/courses/${courseId}`);
export const listMyRecords = () => request("/exercise-records?limit=50&sort=-businessDate");
export const getRecord = (recordId) => request(`/exercise-records/${recordId}`);
export const listMyScores = () => request("/student-scores");
export const getActiveSession = () => request("/exercise-sessions/active");

// ── Exercise sessions ────────────────────────────────────────────
export const startServerSession = (enrollmentId) =>
  request("/exercise-sessions", {
    method: "POST", idempotent: true,
    body: { enrollmentId, clientObservedAt: new Date().toISOString() },
  });
export const pauseServerSession = (sessionId, expectedVersion) =>
  request(`/exercise-sessions/${sessionId}/pause`, {
    method: "POST", idempotent: true,
    body: { expectedVersion, clientObservedAt: new Date().toISOString() },
  });
export const resumeServerSession = (sessionId, expectedVersion) =>
  request(`/exercise-sessions/${sessionId}/resume`, {
    method: "POST", idempotent: true,
    body: { expectedVersion, clientObservedAt: new Date().toISOString() },
  });
export const finishServerSession = (sessionId, expectedVersion) =>
  request(`/exercise-sessions/${sessionId}/finish`, {
    method: "POST", idempotent: true,
    body: { expectedVersion, clientObservedAt: new Date().toISOString() },
  });
export const cancelServerSession = (sessionId, expectedVersion, reason) =>
  request(`/exercise-sessions/${sessionId}/cancel`, {
    method: "POST", idempotent: true,
    body: { expectedVersion, reason: reason || "student cancelled" },
  });

// ── Exercise records ─────────────────────────────────────────────
const SPORT_TYPE_MAP = {
  running: "RUNNING", basketball: "BASKETBALL", football: "FOOTBALL",
  badminton: "BADMINTON", table_tennis: "TABLE_TENNIS", swimming: "SWIMMING",
  fitness: "FITNESS", cycling: "CYCLING", other: "OTHER",
};
export const toServerSportType = (value) => SPORT_TYPE_MAP[value] || "OTHER";

export const createRecordDraft = ({ sessionId, creditType, sportType, sportName, description, studentRemark }) =>
  request("/exercise-records", {
    method: "POST", idempotent: true,
    body: {
      sessionId,
      creditType: creditType === "course" ? "COURSE_RELATED" : "GENERAL",
      sportType: toServerSportType(sportType),
      sportName: sportName || null,
      description,
      studentRemark: studentRemark || null,
      clientRequestId: uuid(),
    },
  });
export const submitRecord = (recordId, mediaIds, expectedVersion) =>
  request(`/exercise-records/${recordId}/submit`, {
    method: "POST", idempotent: true,
    body: { mediaIds, expectedVersion },
  });
export const discardRecord = (recordId, expectedVersion) =>
  request(`/exercise-records/${recordId}/discard`, {
    method: "POST", idempotent: true,
    body: { expectedVersion, reason: "student discarded" },
  });

// ── Media evidence ───────────────────────────────────────────────
export async function uploadMediaDraft(serverSessionId, draft, blob) {
  const isVideo = draft.type === "video";
  const initiated = await request("/media-uploads", {
    method: "POST", idempotent: true,
    body: {
      sessionId: serverSessionId,
      businessPurpose: "EXERCISE_RECORD",
      mediaType: isVideo ? "VIDEO" : "IMAGE",
      mimeType: blob.type || (isVideo ? "video/mp4" : "image/jpeg"),
      fileSizeBytes: blob.size,
      captureSource: "IN_APP_CAMERA",
      durationSeconds: isVideo ? Math.max(1, Math.round(draft.durationSeconds || 1)) : null,
    },
  });
  const put = await fetch(proxyObjectUrl(initiated.uploadUrl), {
    method: initiated.uploadMethod || "PUT",
    headers: initiated.requiredHeaders || {},
    body: blob,
  });
  if (!put.ok) throw new ApiError(put.status, { code: "MEDIA_UPLOAD_FAILED", message: `Object upload failed (${put.status})` });
  const etag = (put.headers.get("ETag") || "").replaceAll('"', "") || "unknown";
  await request(`/media-uploads/${initiated.uploadSessionId}/confirm`, {
    method: "POST", idempotent: true, body: { etag },
  });
  const media = await request(`/media/${initiated.mediaId}/bind`, {
    method: "POST", idempotent: true,
    body: { sessionId: serverSessionId, expectedVersion: 1 },
  }).catch(async (error) => {
    // Bind checks the media row version; re-read once if the worker already bumped it.
    if (error instanceof ApiError && error.code === "CONFLICT_VERSION_MISMATCH") {
      const current = await request(`/media/${initiated.mediaId}`);
      return request(`/media/${initiated.mediaId}/bind`, {
        method: "POST", idempotent: true,
        body: { sessionId: serverSessionId, expectedVersion: current.version },
      });
    }
    throw error;
  });
  // The media worker verifies bytes asynchronously; submission requires the
  // media to be AVAILABLE, so wait for verification to land (max ~15s).
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await request(`/media/${initiated.mediaId}`);
    if (current.uploadStatus === "AVAILABLE") return { mediaId: initiated.mediaId, media: current };
    if (current.uploadStatus === "REJECTED" || current.uploadStatus === "FAILED") {
      throw new ApiError(422, { code: "MEDIA_REJECTED", message: "Media verification failed" });
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return { mediaId: initiated.mediaId, media };
}

export const createMediaAccessUrl = (mediaId) =>
  request(`/media/${mediaId}/access-url`, {
    method: "POST", idempotent: true, body: { purpose: "STUDENT_REVIEW" },
  });

// Local per-record proof metadata cache (the contract has no student media
// listing; we remember what this device uploaded so detail pages can render).
export function cacheRecordProofs(recordId, proofs) {
  try {
    const all = JSON.parse(readRaw("recordProofCache") || "{}");
    all[recordId] = proofs;
    writeRaw("recordProofCache", JSON.stringify(all));
  } catch { /* ignore */ }
}
export function readRecordProofs(recordId) {
  try { return JSON.parse(readRaw("recordProofCache") || "{}")[recordId] || []; } catch { return []; }
}

// ── Default-deny probes (30 contract-complete but closed operations) ──
export const requestStudentSignInCode = (account) =>
  request("/auth/student-sign-in-codes", { method: "POST", auth: false, idempotent: true, body: { account } });

// ── Workspace assembly ───────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");
function formatLocal(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return String(dateInput);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const SERVER_SPORT_LABELS = {
  RUNNING: ["跑步", "Running"], BASKETBALL: ["篮球", "Basketball"], FOOTBALL: ["足球", "Football"],
  BADMINTON: ["羽毛球", "Badminton"], TABLE_TENNIS: ["乒乓球", "Table tennis"], SWIMMING: ["游泳", "Swimming"],
  FITNESS: ["健身", "Fitness"], CYCLING: ["骑行", "Cycling"], OTHER: ["其他", "Other"],
};

export function mapServerRecord(record, { courseIdBySection = {} } = {}) {
  const credited = (record.creditedDurationSeconds || 0) / 3600;
  const actual = (record.actualDurationSeconds || 0) / 3600;
  const review = record.currentReview;
  const reviewText = review
    ? review.result === "VALID"
      ? review.publicComment || tx("记录有效，已计入运动时长。", "Record valid; hours credited.")
      : review.result === "INVALID"
        ? (review.publicComment ? tx(`未通过：${review.publicComment}`, `Rejected: ${review.publicComment}`) : tx("记录未通过审核。", "Record was rejected."))
        : tx("已提交，等待教师审核。", "Submitted; awaiting teacher review.")
    : record.status === "SUBMITTED"
      ? tx("已提交，等待教师审核。", "Submitted; awaiting teacher review.")
      : null;
  const label = record.sportName || (SERVER_SPORT_LABELS[record.sportType] ? tx(...SERVER_SPORT_LABELS[record.sportType]) : record.sportType);
  const proofs = readRecordProofs(record.id);
  return {
    id: record.id,
    serverStatus: record.status,
    reviewResult: review?.result || null,
    courseId: record.creditType === "COURSE_RELATED" ? (courseIdBySection[record.classSectionId] || null) : null,
    taskTitle: record.description || tx("运动打卡", "Exercise check-in"),
    creditType: record.creditType === "COURSE_RELATED" ? "course" : "general",
    hours: credited > 0 ? credited : Math.round(actual * 10) / 10,
    submittedAt: formatLocal(record.submittedAt || record.businessDate),
    proofSummary: proofs.length ? "" : tx("凭证已提交", "Proof submitted"),
    proofPhotoCount: proofs.filter((p) => p.type === "image").length,
    proofVideoCount: proofs.filter((p) => p.type === "video").length,
    proofFiles: proofs.map((p) => ({ ...p, source: p.mediaId ? `media:${p.mediaId}` : p.source || "" })),
    teacherPublicFeedback: reviewText,
    teacherInternalNote: null,
    note: record.description || "",
    remark: record.studentRemark || "",
    sportType: label,
    startTime: null,
    endTime: record.submittedAt,
    actualDurationSeconds: record.actualDurationSeconds ?? null,
  };
}

/** Builds the workspace shape every screen already consumes from live data. */
export async function loadApiWorkspace() {
  const me = await getMe();
  const profile = me.studentProfile;
  if (!profile) throw new ApiError(403, { code: "FORBIDDEN", message: "Not a student account" });

  const [semester, enrollments, sections, records, scores, activeSession] = await Promise.all([
    getCurrentSemester().catch(() => null),
    listMyEnrollments().catch(() => []),
    listMyClassSections().catch(() => []),
    listMyRecords().catch(() => []),
    listMyScores().catch(() => []),
    getActiveSession().catch(() => null),
  ]);

  const joinContext = readJoinContext();
  const activeEnrollments = enrollments.filter((e) => e.status === "ACTIVE");
  const courseCache = {};
  for (const section of sections) {
    if (!courseCache[section.courseId]) {
      courseCache[section.courseId] = await getCourseById(section.courseId).catch(() => null);
    }
  }

  const courseIdBySection = {};
  const courses = sections.map((section) => {
    const course = courseCache[section.courseId];
    const enrollment = activeEnrollments.find((e) => e.classSectionId === section.id) || null;
    courseIdBySection[section.id] = section.courseId;
    const fromInvite = joinContext?.classSectionId === section.id ? joinContext : null;
    return {
      id: section.courseId,
      classSectionId: section.id,
      enrollmentId: enrollment?.id || null,
      code: course?.courseCode || fromInvite?.courseCode || section.classCode,
      section: section.classCode,
      name: course?.courseName || fromInvite?.courseName || section.displayName,
      semester: semester?.displayName || fromInvite?.semesterDisplayName || "",
      teacher: fromInvite?.teacherDisplayName || "",
      teacherId: section.teacherId,
      semesterId: section.semesterId,
      academicYear: semester?.academicYear || "",
      term: semester?.termCode || "",
      semesterStatus: "current",
      status: section.status === "ACTIVE" ? "active" : String(section.status).toLowerCase(),
      enrollmentStatus: enrollment ? "enrolled" : "ended",
      isCurrent: section.semesterId === (semester?.id || section.semesterId),
      deadline: section.submissionDeadlineAt ? formatLocal(section.submissionDeadlineAt) : "",
      students: null, pending: null, completion: null, missing: null,
      finalGrade: null, gradeStatus: null,
    };
  });

  const mappedRecords = records.map((r) => mapServerRecord(r, { courseIdBySection }));
  const validRecords = mappedRecords.filter((r) => r.serverStatus === "SUBMITTED" || r.serverStatus === "REVIEWED");
  const sum = (list) => list.reduce((total, r) => total + (Number(r.hours) || 0), 0);
  const courseHours = sum(validRecords.filter((r) => r.creditType === "course" && r.reviewResult !== "INVALID"));
  const generalHours = sum(validRecords.filter((r) => r.creditType === "general" && r.reviewResult !== "INVALID"));

  // Check-in window from the first ACTIVE enrolled section.
  const activeSection = sections.find((s) => activeEnrollments.some((e) => e.classSectionId === s.id) && s.status === "ACTIVE");
  const timeWindow = activeSection
    ? {
        windowMode: activeSection.checkInWindowMode === "AVAILABLE" ? "semester_wide" : "unavailable",
        dateRangeStart: activeSection.checkInStartDate || null,
        dateRangeEnd: activeSection.checkInEndDate || null,
        dailyStartTime: (activeSection.dailyStartTime || "00:00").slice(0, 5),
        dailyEndTime: (activeSection.dailyEndTime || "23:59").slice(0, 5),
        excludedDates: activeSection.excludedDates || [],
        semesterDeadline: activeSection.submissionDeadlineAt ? String(activeSection.submissionDeadlineAt).slice(0, 10) : null,
      }
    : { windowMode: "unavailable", dateRangeStart: null, dateRangeEnd: null, dailyStartTime: "", dailyEndTime: "", excludedDates: [], semesterDeadline: null };

  const publishedScore = scores.find((s) => s.status === "PUBLISHED") || null;

  return {
    workspace: {
      student: {
        id: profile.studentNumber,
        name: profile.fullName,
        email: me.user?.primaryEmail || "",
        college: profile.collegeName || "",
        className: profile.administrativeClassName || "",
        status: tx("正常", "Active"),
        gender: String(profile.gender || "").toLowerCase(),
        gradeLevel: "",
        admissionYear: profile.gradeYear,
        currentAcademicYear: semester?.academicYear || "",
        gradeCalculatedAt: "",
        accountStatus: me.user?.status || "ACTIVE",
      },
      courses,
      progress: {
        id: profile.studentNumber, name: profile.fullName,
        college: profile.collegeName || "", className: profile.administrativeClassName || "",
        course: courseHours, general: generalHours,
        rawCourse: courseHours, rawGeneral: generalHours,
        exam: 0, attendance: 0, physical: 0,
        status: tx("进行中", "In progress"),
        source: tx("真实后端数据", "Live backend data"),
        organizationCredit: null,
      },
      hourRule: { total: 20.0, courseRequired: 10.0, generalRequired: 10.0, dailyLimit: 2.0 },
      records: mappedRecords,
      grades: {
        studentId: profile.studentNumber,
        studentName: profile.fullName,
        visibleBlocks: [],
        totalScore: publishedScore ? Number(publishedScore.totalScore ?? publishedScore.score ?? null) : null,
        totalDisplay: publishedScore ? String(publishedScore.totalScore ?? publishedScore.score ?? "") : tx("未开放", "Not available"),
        isPassed: null,
        courseGradeStatus: publishedScore ? "published" : "rules_not_published",
        displayConfigVersion: 0,
        sourceTrace: publishedScore ? tx("成绩来自后端计分。", "Score from backend calculation.") : tx("成绩规则发布后可查看。", "Available after score rules are published."),
        enduranceRunTimeSeconds: null, enduranceRunStatus: "not_recorded", enduranceRunScore: null,
      },
      memberships: [],
      notices: [],
      teachers: [],
      exemptions: [],
      checkInTimeWindow: timeWindow,
      courseJoinRequest: null,
    },
    activeServerSession: activeSession,
  };
}
