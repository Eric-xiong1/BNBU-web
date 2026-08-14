// Real backend client for the unified BNBU Sports backend (Contract 1.5,
// NestJS `/api/v1`). Envelope: success `{data, meta}` / error
// `{code, message, details, requestId, timestamp}`. Student sessions are
// established by the student email challenge flow or by the QR/invite join
// flow. Password login stays TEACHER/ADMIN-only. The optional local demo entry
// still uses a real backend student session and never falls back to mock data.

import { currentLocale, tx } from "./i18n.js";
import { validateProofFile } from "./proofs.js";

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

function contractLocale() { return currentLocale() === "en-US" ? "en" : "zh-CN"; }

function organizationCode() {
  const fromQuery = new URLSearchParams(globalThis.location?.search || "").get("org");
  if (fromQuery) {
    writeRaw("organizationCode", fromQuery.toUpperCase());
    return fromQuery.toUpperCase();
  }
  return (readRaw("organizationCode") || "BNBU").toUpperCase();
}

function stableDeviceId() {
  let value = readRaw("deviceId");
  if (!value) {
    value = `web-${uuid()}`.slice(0, 128);
    writeRaw("deviceId", value);
  }
  return value;
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

// ── Backend business limits mirrored for client-side messaging ───
// Keep in sync with docs/backend-contracts/04-business-rules.md.
export const QUALIFYING_TOTAL_SECONDS = 72_000;   // 20 h — no new check-ins after this
export const MAX_PROOF_VIDEO_SECONDS = 15;        // EXERCISE_RECORD video hard cap
export const MAX_PROOF_IMAGES = 6;
export const MAX_PROOF_VIDEOS = 1;
export const CHECK_IN_WINDOW_START = "06:00";     // Beijing time, inclusive
export const CHECK_IN_WINDOW_END = "22:00";       // Beijing time, inclusive

/**
 * True when starting an exercise was refused because the student already met
 * the qualifying total. The backend reuses SESSION_ALREADY_COMPLETED for this
 * and sends no distinguishing details, so the meaning comes from the operation:
 * only `startExerciseSession` can fail this way for a qualified student.
 */
export const isQualificationReached = (error) =>
  error instanceof ApiError && error.status === 409 && error.code === "SESSION_ALREADY_COMPLETED";

/** Message for a failure raised while starting an exercise session. */
export function sessionStartErrorText(error) {
  if (isQualificationReached(error)) {
    return tx("已达到合格打卡时长，无需继续打卡。", "You have reached the qualifying hours. No further check-ins are needed.");
  }
  return apiErrorText(error);
}

export function apiErrorText(error) {
  if (!(error instanceof ApiError)) {
    return tx("网络连接失败，请确认后端服务已启动。", "Network connection failed. Make sure the backend service is running.");
  }
  if (isUnsupported(error)) return tx("该功能暂未开放。", "This feature is not yet available.");
  // Keys are the backend's stable Contract 1.5 error codes.
  const known = {
    // Auth / session
    AUTH_REQUIRED: tx("请先登录后再继续操作。", "Sign in before continuing."),
    AUTH_TOKEN_INVALID: tx("登录凭证无效，请重新加入课程登录。", "Your credential is invalid. Join the course again to sign in."),
    AUTH_TOKEN_EXPIRED: tx("登录状态已过期，请重新加入课程登录。", "Your session expired. Join the course again to sign in."),
    AUTH_SESSION_REVOKED: tx("当前登录会话已失效，请重新登录。", "This session was revoked. Sign in again."),
    AUTH_ACCOUNT_DISABLED: tx("账号已被停用，请联系管理员。", "This account is disabled. Contact an administrator."),
    AUTH_RATE_LIMITED: tx("操作过于频繁，请稍后再试。", "Too many attempts. Try again later."),
    AUTH_CREDENTIAL_INVALID: tx("账号或凭证不正确。", "The account or credential is incorrect."),
    AUTH_VERIFICATION_CODE_INVALID: tx("验证码不正确或已过期。", "The verification code is incorrect or expired."),
    USER_IDENTITY_CONFLICT: tx("身份信息与已有账号冲突，请联系教师核对。", "Your identity conflicts with an existing account. Ask your teacher to check."),
    USER_NOT_FOUND: tx("账号不存在或已被移除。", "The account does not exist or was removed."),
    USER_STATUS_NOT_ACTIVE: tx("账号状态不允许该操作。", "Your account status does not allow this action."),
    // Permission
    PERMISSION_DENIED: tx("没有权限执行该操作。", "You do not have permission for this action."),
    PERMISSION_RESOURCE_NOT_FOUND: tx("资源不存在或无权访问。", "The resource does not exist or is not accessible."),
    PERMISSION_RESOURCE_SCOPE_DENIED: tx("无权访问该资源。", "You cannot access this resource."),
    PERMISSION_COURSE_SCOPE_DENIED: tx("无权访问该教学班。", "This class section is outside your scope."),
    // Validation / concurrency
    VALIDATION_FAILED: tx("提交的资料格式不正确，请检查后重试。", "Some fields are invalid. Check and try again."),
    VALIDATION_FIELD_REQUIRED: tx("有必填项未填写，请补充后重试。", "A required field is missing."),
    VALIDATION_FORMAT_INVALID: tx("填写格式不正确，请检查后重试。", "The format is invalid. Check and try again."),
    VALIDATION_ENUM_UNSUPPORTED: tx("选择的选项不受支持，请重新选择。", "That option is not supported. Choose another."),
    VALIDATION_DURATION_INVALID: tx("时长填写不正确。", "The duration is invalid."),
    CONFLICT_VERSION_MISMATCH: tx("数据已在别处更新，请刷新后重试。", "The data changed elsewhere. Refresh and try again."),
    CONFLICT_REQUEST_IN_PROGRESS: tx("上一次操作仍在处理中，请稍候再试。", "The previous request is still processing. Try again shortly."),
    CONFLICT_IDEMPOTENCY_KEY_REUSED: tx("请求重复，请刷新后重试。", "Duplicate request. Refresh and try again."),
    CONFLICT_RESOURCE_ALREADY_EXISTS: tx("该资源已存在。", "This resource already exists."),
    CONFLICT_STATE_TRANSITION: tx("当前状态不支持该操作。", "This action is not allowed in the current state."),
    CONFLICT_UNSUPPORTED_RESOURCE_STATE: tx("当前状态不支持该操作。", "The resource is not in a supported state."),
    // Course invite / enrollment
    COURSE_INVITE_INVALID: tx("邀请码无效，请向教师确认。", "This invitation code is invalid. Check with your teacher."),
    AUTH_JOIN_CAPABILITY_INVALID: tx("加入凭证无效，请重新扫码或输入邀请码。", "The join credential is invalid. Scan or enter the code again."),
    COURSE_CLASS_SECTION_NOT_FOUND: tx("教学班不存在或已被移除。", "The class section does not exist or was removed."),
    COURSE_CLASS_SECTION_NOT_WRITABLE: tx("该教学班当前不可写入。", "This class section is not writable."),
    COURSE_CHECKIN_WINDOW_CLOSED: tx("该课程的打卡窗口已关闭。", "The check-in window for this course is closed."),
    COURSE_DEADLINE_PASSED: tx("已超过课程提交截止时间。", "The course submission deadline has passed."),
    COURSE_SEMESTER_ARCHIVED: tx("该学期已归档。", "This semester is archived."),
    ENROLLMENT_NOT_FOUND: tx("选课记录不存在。", "The enrollment was not found."),
    COURSE_INVITE_EXPIRED: tx("邀请码已过期，请向教师索取新的邀请。", "This invitation expired. Ask your teacher for a new one."),
    COURSE_INVITE_REVOKED: tx("邀请码已被撤销，请向教师索取新的邀请。", "This invitation was revoked. Ask your teacher for a new one."),
    COURSE_CLASS_SECTION_NOT_JOINABLE: tx("该教学班当前不开放加入。", "This class section is not open for joining."),
    AUTH_JOIN_CAPABILITY_EXPIRED: tx("加入凭证已过期，请重新扫码或输入邀请码。", "The join credential expired. Scan or enter the code again."),
    AUTH_JOIN_CAPABILITY_ALREADY_USED: tx("该加入凭证已被使用，请重新获取。", "That join credential was already used. Request a new one."),
    ENROLLMENT_ALREADY_ACTIVE: tx("你已加入该课程，无需重复加入。", "You have already joined this course."),
    ENROLLMENT_SEMESTER_CONFLICT: tx("本学期已加入其他体育课程，不能重复选课。", "You already joined another PE course this term."),
    ENROLLMENT_NOT_ACTIVE: tx("你的选课状态不是在读，无法执行该操作。", "Your enrollment is not active."),
    // Exercise session. Note: SESSION_ALREADY_COMPLETED means "qualification
    // reached" when it comes back from starting a session — see
    // sessionStartErrorText below.
    SESSION_OUTSIDE_TIME_WINDOW: tx("当前不在可打卡时段内（北京时间 06:00–22:00）。", "Outside the check-in window (06:00–22:00 Beijing time)."),
    SESSION_ALREADY_ACTIVE: tx("已有进行中的运动，请先结束当前运动。", "An exercise session is already running. Finish it first."),
    SESSION_ALREADY_COMPLETED: tx("本次运动已结束。", "This exercise session is already completed."),
    SESSION_DURATION_CAP_REACHED: tx("本次运动已达时长上限。", "This session reached the duration cap."),
    SESSION_ALREADY_USED: tx("该运动已用于提交打卡，无法重复使用。", "This session was already used for a submission."),
    SESSION_NOT_COMPLETED: tx("请先结束运动再提交打卡。", "Finish the exercise before submitting."),
    SESSION_NOT_FOUND: tx("运动记录不存在或已结束。", "The exercise session was not found."),
    SESSION_TRANSITION_NOT_ALLOWED: tx("当前运动状态不支持该操作。", "This action is not allowed in the current session state."),
    SESSION_RESUME_WINDOW_EXPIRED: tx("暂停时间过长，无法继续本次运动。", "This session can no longer be resumed."),
    SESSION_RECONCILIATION_REQUIRED: tx("运动数据需要校准，请重新进入打卡页。", "This session needs reconciliation. Reopen the check-in page."),
    SESSION_TIMELINE_INVALID: tx("运动时间数据异常，请重新开始。", "The session timeline is invalid. Start again."),
    SESSION_EVENT_OUT_OF_ORDER: tx("操作顺序异常，请刷新后重试。", "The action arrived out of order. Refresh and try again."),
    // Exercise record
    EXERCISE_RECORD_DURATION_NOT_CREDITABLE: tx("本次运动时长不足，不能计入打卡。", "This session is too short to be credited."),
    EXERCISE_RECORD_DAILY_LIMIT_REACHED: tx("今日打卡次数已达上限。", "You reached today's check-in limit."),
    EXERCISE_RECORD_DUPLICATE_SUBMISSION: tx("该打卡已提交，请勿重复提交。", "This record was already submitted."),
    EXERCISE_RECORD_MEDIA_INCOMPLETE: tx("凭证尚未处理完成，请稍后再提交。", "The proof is still processing. Try submitting again shortly."),
    EXERCISE_RECORD_NOT_FOUND: tx("打卡记录不存在。", "The check-in record was not found."),
    EXERCISE_RECORD_ALREADY_EXISTS_FOR_SESSION: tx("本次运动已创建过打卡记录。", "A record already exists for this session."),
    MEDIA_EVIDENCE_REQUIRED: tx("请至少上传一项打卡凭证。", "At least one proof item is required."),
    // Media
    MEDIA_NOT_AVAILABLE: tx("凭证仍在处理中，请稍候。", "The proof is still being processed."),
    MEDIA_SIZE_EXCEEDED: tx("文件超过大小上限。", "The file exceeds the size limit."),
    MEDIA_TYPE_NOT_ALLOWED: tx("不支持该文件格式。", "This file type is not supported."),
    MEDIA_COUNT_LIMIT_EXCEEDED: tx(`凭证数量超过上限（最多 ${MAX_PROOF_IMAGES} 张照片、${MAX_PROOF_VIDEOS} 个视频）。`, `Too many proof items (up to ${MAX_PROOF_IMAGES} photos and ${MAX_PROOF_VIDEOS} video).`),
    MEDIA_UPLOAD_SESSION_EXPIRED: tx("上传已超时，请重新拍摄上传。", "The upload expired. Capture and upload again."),
    // Media rules added by the backend's 15-second exercise-video update
    MEDIA_VIDEO_DURATION_EXCEEDED: tx(`打卡视频最长 ${MAX_PROOF_VIDEO_SECONDS} 秒，请重新录制。`, `Check-in videos may be at most ${MAX_PROOF_VIDEO_SECONDS} seconds. Record again.`),
    MEDIA_AUDIO_TRACK_REQUIRED: tx("打卡视频必须包含声音，请开启麦克风后重新录制。", "Check-in videos must contain sound. Enable the microphone and record again."),
    MEDIA_LOCATION_METADATA_NOT_ALLOWED: tx("凭证包含位置元数据，请重新拍摄或使用不含位置信息的文件。", "The proof contains location metadata. Capture it again or use a file without location data."),
    MEDIA_CAPTURE_SOURCE_NOT_ALLOWED: tx("打卡凭证必须现场拍摄，不能从相册选择。", "Proof must be captured in the app, not chosen from the gallery."),
    MEDIA_INTEGRITY_MISMATCH: tx("上传的文件与声明不一致，请重新上传。", "The uploaded file does not match its declaration. Upload again."),
    MEDIA_OBJECT_NOT_FOUND: tx("凭证文件丢失，请重新上传。", "The proof file is missing. Upload again."),
    MEDIA_ALREADY_BOUND: tx("该凭证已绑定到其他记录。", "This proof is already bound to another record."),
    MEDIA_PURPOSE_MISMATCH: tx("凭证用途不匹配。", "The proof purpose does not match."),
    MEDIA_ACCESS_DENIED: tx("无权查看该凭证。", "You are not allowed to view this proof."),
    MEDIA_BIND_TARGET_INVALID: tx("凭证绑定目标无效，请重新提交。", "The proof binding target is invalid. Submit again."),
    MEDIA_PROCESSING_INCOMPLETE: tx("凭证仍在处理中，请稍候再提交。", "The proof is still processing. Try again shortly."),
    MEDIA_VERIFICATION_INCOMPLETE: tx("凭证校验尚未完成，请稍候。", "Proof verification is not finished yet."),
    MEDIA_TRANSITION_NOT_ALLOWED: tx("凭证当前状态不支持该操作。", "This action is not allowed for the proof's current state."),
    MEDIA_FAILURE_NOT_RETRYABLE: tx("该凭证上传失败且无法重试，请重新拍摄。", "This upload failed permanently. Capture it again."),
    // System mode (Contract 1.4 documents the full 503 family)
    SYSTEM_READ_ONLY: tx("系统当前为只读模式，暂时无法提交。", "The system is read-only right now, so changes cannot be saved."),
    SYSTEM_MAINTENANCE: tx("系统正在维护中，请稍后再试。", "The system is under maintenance. Try again later."),
    SYSTEM_SERVICE_UNAVAILABLE: tx("依赖服务暂时不可用，请稍后再试。", "A required service is unavailable. Try again later."),
    SYSTEM_DEPENDENCY_TIMEOUT: tx("服务响应超时，请稍后再试。", "The service timed out. Try again later."),
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
  if (!tokens?.refreshToken) throw new ApiError(401, { code: "AUTH_REQUIRED", message: "No refresh token" });
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

/**
 * Signs in as the local demo student. The account is an ordinary backend
 * student — every screen it shows is real backend data; the preview server
 * merely renews its session, because an enrolled student cannot re-join.
 * Returns null when no demo account is configured (or outside the preview
 * server), so the caller can hide the entry point.
 */
export async function demoSignIn() {
  const response = await fetch("/dev/demo-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (response.status === 404) return null;
  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, {
      code: parsed?.code || "DEMO_SIGN_IN_FAILED",
      message: parsed?.message || "演示账号登录失败。",
    });
  }
  storeAuthSession(parsed.data.authSession);
  return parsed.data.student;
}

/** The configured demo student, or null when the entry point should stay hidden. */
export async function demoAccountInfo() {
  try {
    const response = await fetch("/dev/demo-session", { method: "GET" });
    if (!response.ok) return null;
    return (await response.json()).data.student;
  } catch {
    return null;
  }
}

export async function logoutApi() {
  const refreshToken = readTokens()?.refreshToken;
  try {
    if (refreshToken) await request("/auth/logout", { method: "POST", idempotent: true, body: { refreshToken } });
  } catch { /* best effort */ }
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

export const createRecordDraft = ({ sessionId, creditType, sportType, sportName, description }) =>
  request("/exercise-records", {
    method: "POST", idempotent: true,
    body: {
      sessionId,
      creditType: creditType === "course" ? "COURSE_RELATED" : "GENERAL",
      sportType: toServerSportType(sportType),
      sportName: sportName || null,
      description,
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
async function sha256Hex(blob) {
  if (!globalThis.crypto?.subtle) {
    throw new ApiError(0, {
      code: "MEDIA_HASH_UNAVAILABLE",
      message: tx("当前页面无法安全计算文件摘要，请使用 HTTPS 或本机地址后重试。", "This page cannot securely hash the file. Use HTTPS or a local address and try again."),
    });
  }
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function uploadMediaDraft(serverSessionId, draft, blob) {
  const isVideo = draft.type === "video";
  const verdict = validateProofFile(blob, draft.type, { durationSeconds: draft.durationSeconds });
  if (!verdict.ok) {
    const code = verdict.error === "duration" ? "MEDIA_VIDEO_DURATION_EXCEEDED" : verdict.error === "size" ? "MEDIA_SIZE_EXCEEDED" : "MEDIA_TYPE_NOT_ALLOWED";
    throw new ApiError(422, { code, message: "Media draft failed Contract 1.5 validation" });
  }

  const declaredContentSha256 = await sha256Hex(blob);
  const signature = `${verdict.mimeType}:${blob.size}:${declaredContentSha256}:${verdict.durationSeconds ?? "image"}`;
  if (draft.pendingUpload?.signature !== signature) draft.pendingUpload = null;

  if (!draft.pendingUpload) {
    draft.initiateIdempotencyKey ||= uuid();
    const initiated = await request("/media-uploads", {
      method: "POST",
      headers: { "Idempotency-Key": draft.initiateIdempotencyKey },
      body: {
        sessionId: serverSessionId,
        businessPurpose: "EXERCISE_RECORD",
        mediaType: isVideo ? "VIDEO" : "IMAGE",
        mimeType: verdict.mimeType,
        fileSizeBytes: blob.size,
        captureSource: "IN_APP_CAMERA",
        declaredContentSha256,
        durationSeconds: isVideo ? verdict.durationSeconds : null,
      },
    });
    draft.pendingUpload = {
      signature,
      initiated,
      objectUploaded: false,
      confirmed: null,
      bound: false,
      confirmIdempotencyKey: uuid(),
      bindIdempotencyKey: uuid(),
    };
  }

  const pending = draft.pendingUpload;
  const initiated = pending.initiated;
  try {
    if (!pending.objectUploaded) {
      const put = await fetch(proxyObjectUrl(initiated.uploadUrl), {
        method: initiated.uploadMethod || "PUT",
        headers: initiated.requiredHeaders || {},
        body: blob,
      });
      if (!put.ok) throw new ApiError(put.status, { code: "MEDIA_UPLOAD_FAILED", message: `Object upload failed (${put.status})` });
      pending.etag = (put.headers.get("ETag") || "").replaceAll('"', "") || "unknown";
      pending.objectUploaded = true;
    }

    if (!pending.confirmed) {
      pending.confirmed = await request(`/media-uploads/${initiated.uploadSessionId}/confirm`, {
        method: "POST",
        headers: { "Idempotency-Key": pending.confirmIdempotencyKey },
        body: { etag: pending.etag },
      });
    }

    if (!pending.bound) {
      await request(`/media/${initiated.mediaId}/bind`, {
        method: "POST",
        headers: { "Idempotency-Key": pending.bindIdempotencyKey },
        body: { sessionId: serverSessionId, expectedVersion: pending.confirmed.version },
      });
      pending.bound = true;
    }
  } catch (error) {
    if (error instanceof ApiError && ["MEDIA_UPLOAD_SESSION_EXPIRED", "MEDIA_INTEGRITY_MISMATCH", "MEDIA_VIDEO_DURATION_EXCEEDED", "MEDIA_AUDIO_TRACK_REQUIRED", "MEDIA_LOCATION_METADATA_NOT_ALLOWED"].includes(error.code)) {
      draft.pendingUpload = null;
      draft.initiateIdempotencyKey = uuid();
    }
    throw error;
  }

  // The media worker verifies bytes asynchronously; submission requires the
  // media to be AVAILABLE, so wait for verification to land (max ~15s).
  for (let attempt = 0; attempt < 20; attempt++) {
    const current = await request(`/media/${initiated.mediaId}`);
    if (current.uploadStatus === "AVAILABLE") {
      draft.mediaId = initiated.mediaId;
      draft.pendingUpload = null;
      return { mediaId: initiated.mediaId, media: current };
    }
    if (current.uploadStatus === "FAILED") {
      draft.pendingUpload = null;
      draft.initiateIdempotencyKey = uuid();
      throw new ApiError(422, { code: "MEDIA_FAILURE_NOT_RETRYABLE", message: "Media verification failed" });
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new ApiError(422, { code: "MEDIA_VERIFICATION_INCOMPLETE", message: "Media verification did not finish in time" });
}

export const createMediaAccessUrl = (mediaId) =>
  request(`/media/${mediaId}/access-url`, {
    method: "POST", idempotent: true, body: { purpose: "VIEW_ORIGINAL" },
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

// ── Email-only student authentication and binding ────────────────
export const requestStudentSignInCode = (account) =>
  request("/auth/student-sign-in-codes", {
    method: "POST", auth: false, idempotent: true,
    body: { organizationCode: organizationCode(), account: account.trim(), channel: "EMAIL", locale: contractLocale() },
  });

export async function verifyStudentSignInCode(challengeId, code) {
  const authSession = await request("/auth/student-sign-in-codes/verify", {
    method: "POST", auth: false, idempotent: true,
    body: { challengeId, code, deviceId: stableDeviceId() },
  });
  storeAuthSession(authSession);
  return authSession;
}

export const requestEmailVerificationChallenge = (email, expectedVersion) =>
  request("/me/email-verification-challenges", {
    method: "POST", idempotent: true,
    body: { email: email.trim(), locale: contractLocale(), expectedVersion },
  });

export const verifyEmailVerificationChallenge = (challengeId, { newEmailCode, currentEmailCode = null }) =>
  request(`/me/email-verification-challenges/${challengeId}/verify`, {
    method: "POST", idempotent: true,
    body: currentEmailCode ? { currentEmailCode, newEmailCode } : { newEmailCode },
  });

// ── Workspace assembly ───────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");
function formatLocal(dateInput) {
  if (!dateInput) return "";
  // A bare business date (YYYY-MM-DD) is a calendar day, not an instant:
  // `new Date("2026-08-09")` parses as UTC midnight and would render as the
  // previous day west of Greenwich. Pass it through untouched.
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateInput))) return String(dateInput);
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
    // The backend's business day (Beijing). Daily rules are evaluated against
    // this, never against the device date.
    businessDate: record.businessDate,
    // Timestamps stay in the student's local time; only the daily rules and the
    // teacher/admin portal are pinned to Beijing.
    submittedAt: formatLocal(record.submittedAt || record.businessDate),
    proofSummary: proofs.length ? "" : tx("凭证已提交", "Proof submitted"),
    proofPhotoCount: proofs.filter((p) => p.type === "image").length,
    proofVideoCount: proofs.filter((p) => p.type === "video").length,
    proofFiles: proofs.map((p) => ({ ...p, source: p.mediaId ? `media:${p.mediaId}` : p.source || "" })),
    teacherPublicFeedback: reviewText,
    teacherInternalNote: null,
    note: record.description || "",
    remark: "",
    sportType: label,
    startTime: null,
    endTime: record.submittedAt,
    actualDurationSeconds: record.actualDurationSeconds ?? null,
  };
}

/** Maps the exact Contract 1.5 `/me` projection without inventing plaintext contacts. */
export function mapServerStudent(me, profile, semester = null) {
  return {
    id: profile.studentNumber,
    name: profile.fullName,
    email: me.user?.primaryEmailMasked || "",
    emailVerified: Boolean(me.user?.emailVerified),
    userVersion: me.user?.version || 1,
    college: profile.collegeName || "",
    className: profile.administrativeClassName || "",
    status: tx("正常", "Active"),
    gender: String(profile.gender || "").toLowerCase(),
    gradeLevel: "",
    admissionYear: profile.gradeYear,
    currentAcademicYear: semester?.academicYear || "",
    gradeCalculatedAt: "",
    accountStatus: me.user?.status || "ACTIVE",
  };
}

/** Builds the workspace shape every screen already consumes from live data. */
export async function loadApiWorkspace() {
  const me = await getMe();
  const profile = me.studentProfile;
  if (!profile) throw new ApiError(403, { code: "FORBIDDEN", message: "Not a student account" });

  const optionalNotFound = (promise) => promise.catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });
  const [semester, enrollments, sections, records, scores, activeSession] = await Promise.all([
    optionalNotFound(getCurrentSemester()),
    listMyEnrollments(),
    listMyClassSections(),
    listMyRecords(),
    listMyScores(),
    optionalNotFound(getActiveSession()),
  ]);

  const joinContext = readJoinContext();
  const activeEnrollments = enrollments.filter((e) => e.status === "ACTIVE");
  const courseCache = {};
  for (const section of sections) {
    if (!courseCache[section.courseId]) {
      courseCache[section.courseId] = await getCourseById(section.courseId);
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

  // Only submitted work counts as a check-in record. DRAFT (never submitted)
  // and CANCELLED rows stay out of the list so the record page and the
  // dashboard progress can never disagree.
  const mappedRecords = records
    .filter((r) => r.status === "SUBMITTED" || r.status === "REVIEWED")
    .map((r) => mapServerRecord(r, { courseIdBySection }));
  const sum = (list) => list.reduce((total, r) => total + (Number(r.hours) || 0), 0);
  // Rejected records are shown in the list but never counted toward hours.
  const countable = mappedRecords.filter((r) => r.reviewResult !== "INVALID");
  const courseHours = sum(countable.filter((r) => r.creditType === "course"));
  const generalHours = sum(countable.filter((r) => r.creditType === "general"));

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
      student: mapServerStudent(me, profile, semester),
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
