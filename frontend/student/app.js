import { createStore } from "./core/store.js";
import { createDemoApi, createStudentApi } from "./core/api.js";
import { demoWorkspace } from "./data/demo-data.js";
import { renderLogin } from "./views/login.js";
import { renderShell } from "./views/shell.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { createUploadItems, releaseUpload, validateCheckin, validateExemptionProofSelection, validateProofSelection } from "./core/upload.js";
import { renderCourseDetail, renderCourses } from "./views/courses.js";
import { renderGrades } from "./views/grades.js";
import { renderProfile } from "./views/profile.js";
import { renderExemptionDetail, renderExemptionForm, renderExemptions, validateExemption } from "./views/tools.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderNotificationDrawer } from "./views/notifications.js";
import { renderPrivacyPolicy } from "./views/privacy.js";
import { renderCourseJoin, renderEmailVerification } from "./views/account.js";
import { renderFeedback, renderHelp } from "./views/support.js";
import { applyTheme, normalizeTheme } from "./core/theme.js";
import { clearSessionMedia, loadSessionMedia, saveSessionMedia } from "./core/media-drafts.js";

const ROUTES = new Set(["home", "checkin", "courses", "grades", "profile", "notifications", "exemptions", "exemption-new", "settings", "privacy", "email", "join", "help", "feedback"]);
const deviceId = () => {
  const key = "bnbuStudentWebDeviceId";
  let value = globalThis.localStorage?.getItem(key);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `web-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    globalThis.localStorage?.setItem(key, value);
  }
  return value;
};
export function routeFromHash(hash = "") {
  const raw = String(hash).replace(/^#\/?/, "");
  const [name, id] = raw.split("/");
  if (name === "course" && id) return { name: "course-detail", id };
  if (name === "record" && id) return { name: "record-detail", id };
  if (name === "exemption" && id) return { name: "exemption-detail", id };
  return ROUTES.has(name) ? { name } : { name: "home" };
}

const titles = { home: "首页", checkin: "运动打卡", courses: "课程", "course-detail": "课程详情", grades: "成绩", profile: "我的", notifications: "通知", exemptions: "免测申请", "exemption-new": "提交免测申请", "exemption-detail": "申请详情", settings: "设置", privacy: "隐私政策", "record-detail": "打卡详情", email: "邮箱认证", join: "加入课程", help: "帮助中心", feedback: "问题反馈" };

function activeForRoute(name) {
  if (["course-detail", "join"].includes(name)) return "courses";
  if (["notifications", "exemptions", "exemption-new", "exemption-detail", "settings", "privacy", "email", "help", "feedback"].includes(name)) return "profile";
  if (name === "record-detail") return "checkin";
  return name;
}

export function createInitialState() {
  return {
    ...demoWorkspace(), session: null, mode: "real", student: {}, teacher: {}, courses: [], enrollments: [], tasks: [], records: [],
    grades: { components: {}, sources: [] }, memberships: [], notifications: [], exemptions: [], preferences: { locale: "zh-CN", pushEnabled: false, emailEnabled: false, version: 1 }, helpArticles: [], feedback: [], releasePolicy: null, draft: null,
    summary: { courseHours: 0, generalHours: 0, totalCompleted: 0, pendingCount: 0, rule: { total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2 } },
  };
}

const reviewStatus = (record) => ({ VALID: "已通过", INVALID: "已驳回", PENDING: "待审核" }[record.currentReview?.result] || ({ SUBMITTED: "待审核", DRAFT: "草稿" }[record.status] || record.status));
const normalizeExemption = (item) => ({ ...item, type: ({ PHYSICAL_TEST: "免体测", EXERCISE_CHECK_IN: "免运动打卡", SPECIAL_CIRCUMSTANCE: "特殊情况" }[item.applicationType] || item.type || item.applicationType), status: ({ DRAFT: "草稿", SUBMITTED: "待审核", SUPPLEMENT_REQUIRED: "需补材料", APPROVED: "已通过", REJECTED: "已驳回" }[item.status] || item.status), createdAt: item.submittedAt || item.createdAt, proofFiles: item.proofFiles || [], reviewComment: item.publicComment || item.reviewComment || "" });

export function normalizeV1Workspace(snapshot = {}) {
  const sectionsById = new Map((snapshot.sections || []).map((item) => [item.id, item]));
  const coursesById = new Map((snapshot.courses || []).map((item) => [item.id, item]));
  const studentProfile = snapshot.currentUser?.studentProfile || {};
  const user = snapshot.currentUser?.user || {};
  const records = (snapshot.records || []).map((item) => ({ ...item, hours: Number(item.creditedDurationSeconds || item.actualDurationSeconds || 0) / 3600, submittedAt: item.submittedAt || item.businessDate, statusLabel: reviewStatus(item), reviewComment: item.currentReview?.publicComment || "" }));
  const enrollments = (snapshot.enrollments || []).filter((item) => item.status === "ACTIVE");
  const courses = enrollments.map((enrollment) => {
    const section = sectionsById.get(enrollment.classSectionId) || {};
    const course = coursesById.get(section.courseId) || {};
    const score = (snapshot.scores || []).find((item) => item.enrollmentId === enrollment.id) || {};
    return {
      id: section.id || course.id, enrollmentId: enrollment.id, classSectionId: section.id, courseId: course.id,
      courseCode: course.courseCode || "—", section: section.classCode || section.displayName || "—", name: course.courseName || section.displayName || "课程",
      teacher: "任课教师", semester: "当前学期", semesterStatus: "current", enrollmentStatus: "enrolled", requiredHours: Number(score.totalRequiredSeconds || 36000) / 3600,
      completedHours: Number(score.totalValidDurationSeconds || 0) / 3600,
    };
  });
  const courseSeconds = (snapshot.scores || []).reduce((sum, item) => sum + Number(item.validCourseDurationSeconds || 0), 0);
  const generalSeconds = (snapshot.scores || []).reduce((sum, item) => sum + Number(item.validGeneralDurationSeconds || 0), 0);
  const notifications = (snapshot.notifications || []).map((item) => ({ ...item, message: item.body, category: item.notificationType, isUnread: !item.readAt }));
  return {
    student: { ...studentProfile, ...user, name: studentProfile.fullName, studentNumber: studentProfile.studentNumber, college: studentProfile.collegeName, className: studentProfile.administrativeClassName, gradeLabel: studentProfile.gradeYear ? `${studentProfile.gradeYear} 级` : "", gender: studentProfile.gender, genderLabel: ({ MALE: "男", FEMALE: "女", OTHER: "其他" }[studentProfile.gender] || ""), primaryEmailMasked: user.primaryEmailMasked, emailVerified: user.emailVerified },
    enrollments, courses, records, notifications, exemptions: (snapshot.exemptions || []).map(normalizeExemption), preferences: snapshot.preferences || {}, helpArticles: snapshot.helpArticles || [], feedback: snapshot.feedback || [], releasePolicy: snapshot.releasePolicy || null, memberships: [], tasks: [],
    grades: { components: {}, sources: snapshot.scores || [], updatedAt: new Date().toISOString() },
    summary: { courseHours: courseSeconds / 3600, generalHours: generalSeconds / 3600, totalCompleted: (courseSeconds + generalSeconds) / 3600, pendingCount: records.filter((item) => item.status === "SUBMITTED").length, rule: { total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2 } },
  };
}

export function normalizeHydration(input = {}) {
  if (input.workspace) return normalizeV1Workspace(input.workspace);
  const profile = input.profile?.profile || input.profile || {};
  return { student: profile, courses: input.summary?.courses || [], tasks: [...(input.taskGroups?.pending || []), ...(input.taskGroups?.completed || [])], records: input.records || [], notifications: input.notifications?.items || input.notifications || [], exemptions: input.exemptions || [], memberships: input.identity?.memberships || [], grades: input.grades || {}, summary: input.summary || {} };
}

export function mergeCheckinDraft(saved = {}, transient = {}) { return { ...(saved || {}), ...(transient || {}) }; }

export function resolveStudentApiBase(value = globalThis.BNBU_STUDENT_CONFIG?.apiBaseUrl || "") {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "/api/v1";
  let url;
  try { url = new URL(raw); } catch { throw new Error("学生端 Backend 地址无效"); }
  const localHttp = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  if ((!localHttp && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/api/v1")) {
    throw new Error("学生端 Backend 必须使用以 /api/v1 结尾的 HTTPS 地址");
  }
  return raw;
}

export function createStudentApp({ root, storage = globalThis.localStorage } = {}) {
  const store = createStore({ storage, initial: createInitialState() });
  const realApi = createStudentApi({ baseUrl: resolveStudentApiBase(), getToken: () => store.getState().session?.accessToken || store.getState().session?.token });
  const demoApi = createDemoApi({ store });
  const ui = {
    login: { error: "", busy: false, challenge: null, account: "", organizationCode: "BNBU" }, syncMessage: "", syncBusy: false,
    checkinTab: "submit", taskFilter: "all", recordFilter: "all", selectedTaskId: null, checkinError: "", checkinBusy: false,
    exerciseSession: null, exerciseContext: null, uploads: [], cameraOpen: false, captureKind: "photo", recording: false,
    cameraStream: null, recorder: null, recordedChunks: [], sessionTicker: null,
    email: { challenge: null, error: "", busy: false }, publicJoin: false, join: { token: "", preview: null, error: "", busy: false, scanning: false, stream: null, timer: null },
    notificationOpen: false, selectedNoticeId: null, noticeFilter: "all", exemptionUploads: [], exemptionError: "", exemptionBusy: false, supplementExemptionId: null, feedbackError: "", feedbackBusy: false,
  };
  const api = () => store.getState().mode === "demo" ? demoApi : realApi;
  const go = (route) => { globalThis.location.hash = `#/${route}`; };
  const canRecordVideo = () => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.("video/mp4");

  function elapsedSeconds() {
    const session = ui.exerciseSession;
    if (!session) return 0;
    const base = Number(session.actualDurationSeconds || 0);
    if (session.status !== "IN_PROGRESS") return base;
    const refreshedAt = Date.parse(session._receivedAt || new Date().toISOString());
    return Math.min(7200, base + Math.max(0, Math.floor((Date.now() - refreshedAt) / 1000)));
  }

  function render() {
    if (!root) return;
    const state = store.getState();
    applyTheme(state.settings?.themeMode || "light");
    if (!state.session && !ui.publicJoin) {
      root.innerHTML = renderLogin(ui.login);
      return;
    }
    const route = routeFromHash(globalThis.location?.hash);
    let content;
    if (ui.publicJoin) content = renderCourseJoin({ user: {}, allowPending: true, ...ui.join });
    else if (route.name === "home") content = renderDashboard(state);
    else if (route.name === "checkin") content = renderCheckin({ activeTab: ui.checkinTab, tasks: state.tasks, records: state.records, draft: state.draft || {}, uploads: ui.uploads, selectedTask: state.tasks.find((item) => item.id === ui.selectedTaskId), error: ui.checkinError, busy: ui.checkinBusy, taskFilter: ui.taskFilter, recordFilter: ui.recordFilter, session: ui.exerciseSession, elapsedSeconds: elapsedSeconds(), enrollments: state.enrollments, courses: state.courses, cameraOpen: ui.cameraOpen, recording: ui.recording, canRecordVideo: canRecordVideo() });
    else if (route.name === "record-detail") content = renderRecordDetail(state.records.find((item) => item.id === route.id));
    else if (route.name === "courses") content = renderCourses(state.courses, state.tasks, state.records);
    else if (route.name === "course-detail") { const course = state.courses.find((item) => item.id === route.id); content = renderCourseDetail(course, state.tasks.filter((item) => item.courseId === course?.courseId), state.records.filter((item) => item.classSectionId === course?.classSectionId)); }
    else if (route.name === "grades") content = renderGrades(state.grades);
    else if (["profile", "notifications"].includes(route.name)) content = renderProfile(state);
    else if (route.name === "email") content = renderEmailVerification({ user: state.student, ...ui.email });
    else if (route.name === "join") content = renderCourseJoin({ user: state.student, ...ui.join });
    else if (route.name === "exemptions") content = renderExemptions(state.exemptions);
    else if (route.name === "exemption-detail") content = renderExemptionDetail(state.exemptions.find((item) => item.id === route.id));
    else if (route.name === "exemption-new") content = renderExemptionForm({ student: state.student, enrollments: state.enrollments, proofs: ui.exemptionUploads, error: ui.exemptionError, busy: ui.exemptionBusy, supplementTarget: state.exemptions.find((item) => item.id === ui.supplementExemptionId) });
    else if (route.name === "help") content = renderHelp({ articles: state.helpArticles });
    else if (route.name === "feedback") content = renderFeedback({ items: state.feedback, error: ui.feedbackError, busy: ui.feedbackBusy });
    else content = renderPrivacyPolicy();
    if (ui.publicJoin) { root.innerHTML = content; if (ui.join.scanning) attachQrPreview(); return; }
    const overlay = (ui.notificationOpen || route.name === "notifications") ? renderNotificationDrawer({ notices: state.notifications, filter: ui.noticeFilter, selectedId: ui.selectedNoticeId }) : "";
    root.innerHTML = renderShell({ active: activeForRoute(route.name), title: titles[route.name], content, mode: state.mode, unread: state.notifications.filter((item) => item.isUnread).length, overlay, syncMessage: ui.syncMessage, syncBusy: ui.syncBusy });
    if (ui.cameraOpen) attachCameraPreview();
    if (ui.join.scanning) attachQrPreview();
  }

  async function requestLoginCode(form) {
    const data = new FormData(form);
    ui.login.busy = true; ui.login.error = ""; ui.login.account = String(data.get("account") || "").trim(); ui.login.organizationCode = String(data.get("organizationCode") || "").trim().toUpperCase(); render();
    try { ui.login.challenge = await realApi.requestSignInCode(ui.login.organizationCode, ui.login.account); }
    catch (error) { ui.login.error = error.message; }
    finally { ui.login.busy = false; render(); }
  }

  async function verifyLoginCode(form) {
    ui.login.busy = true; ui.login.error = ""; render();
    try {
      const session = await realApi.verifySignInCode(ui.login.challenge.challengeId, String(new FormData(form).get("code") || ""), deviceId());
      if (session.user?.role !== "STUDENT") throw new Error("仅限学生账号登录");
      store.persistSession(session, "real");
      await hydrateReal();
      go("home");
    } catch (error) { ui.login.error = error.message; }
    finally { ui.login.busy = false; render(); }
  }

  async function hydrateReal() {
    ui.syncBusy = true;
    try {
      const workspace = await realApi.workspace();
      store.patch(normalizeV1Workspace(workspace));
      ui.syncMessage = "";
      const savedSessionId = store.getState().draft?.sessionId;
      let active = await realApi.activeExerciseSession().catch(() => null);
      if (!active && savedSessionId) active = await realApi.getExerciseSession(savedSessionId).catch(() => null);
      if (active && ["IN_PROGRESS", "PAUSED", "COMPLETED"].includes(active.status)) {
        ui.exerciseSession = { ...active, ...(store.getState().draft?.exerciseContext || {}), _receivedAt: new Date().toISOString() };
        ui.exerciseContext = store.getState().draft?.exerciseContext || null;
        const restored = await loadSessionMedia(active.id);
        ui.uploads.forEach(releaseUpload);
        ui.uploads = restored.map((item) => ({ ...createUploadItems([item.file], undefined, { durationSeconds: item.durationSeconds })[0], mediaId: item.mediaId || null, status: item.mediaId ? "success" : "waiting", progress: item.mediaId ? 100 : 0 }));
      } else if (savedSessionId) {
        await clearSessionMedia(savedSessionId).catch(() => {});
        store.clearDraft();
      }
    } catch (error) {
      if (error.status === 401) { ui.login.error = "登录已过期，请重新登录"; store.clearSession(); }
      else ui.syncMessage = `同步失败：${error.message}。真实模式不会回退到 Mock 数据。`;
    } finally { ui.syncBusy = false; }
  }

  async function startExercise(form) {
    const data = new FormData(form);
    const context = { enrollmentId: String(data.get("enrollmentId") || ""), creditType: String(data.get("creditType") || "GENERAL"), sportType: String(data.get("sportType") || ""), sportName: String(data.get("sportName") || "").trim() || null, description: String(data.get("description") || "").trim(), clientRequestId: `web-${globalThis.crypto?.randomUUID?.() || Date.now()}`, startRetryKey: globalThis.crypto?.randomUUID?.() || `start-${Date.now()}`, createRetryKey: globalThis.crypto?.randomUUID?.() || `create-${Date.now()}`, submitRetryKey: globalThis.crypto?.randomUUID?.() || `submit-${Date.now()}` };
    const errors = validateCheckin({ durationSeconds: 3600, ...context, customSport: context.sportName, files: [{ file: new Blob(["x"], { type: "image/jpeg" }), source: "camera" }] }).filter((item) => !/凭证/.test(item));
    if (errors.length) { ui.checkinError = errors.join("；"); return render(); }
    ui.checkinBusy = true; ui.checkinError = ""; render();
    try {
      const session = await realApi.startExerciseSession(context.enrollmentId, context.startRetryKey);
      ui.exerciseContext = context; ui.exerciseSession = { ...session, description: context.description, _receivedAt: new Date().toISOString() };
      store.saveDraft({ exerciseContext: context, sessionId: session.id });
    } catch (error) { ui.checkinError = error.message; }
    finally { ui.checkinBusy = false; render(); }
  }

  async function controlExercise(action) {
    if (!ui.exerciseSession) return;
    if (action === "finish" && elapsedSeconds() < 3600) {
      if (!(globalThis.confirm?.("运动不足 1 小时，结束后不会创建有效打卡，并会清除本地草稿。确认结束？") ?? true)) return;
    }
    ui.checkinBusy = true; ui.checkinError = ""; render();
    try {
      if (action === "cancel") {
        await realApi.cancelExerciseSession(ui.exerciseSession.id, ui.exerciseSession.version, "Student discarded the exercise from Web");
        clearExercise();
      } else {
        const result = await realApi.controlExerciseSession(ui.exerciseSession.id, action, ui.exerciseSession.version);
        if (action === "finish" && Number(result.actualDurationSeconds || 0) < 3600) clearExercise();
        else ui.exerciseSession = { ...result, ...ui.exerciseContext, _receivedAt: new Date().toISOString() };
      }
    } catch (error) { ui.checkinError = error.message; }
    finally { ui.checkinBusy = false; render(); }
  }

  function clearExercise() {
    const sessionId = ui.exerciseSession?.id;
    stopCamera();
    ui.uploads.forEach(releaseUpload); ui.uploads = []; ui.exerciseSession = null; ui.exerciseContext = null; ui.selectedTaskId = null; store.clearDraft(); clearSessionMedia(sessionId).catch(() => {});
  }

  async function submitExercise(form) {
    const description = String(new FormData(form).get("description") || "").trim();
    const context = { ...(ui.exerciseContext || store.getState().draft?.exerciseContext || {}), description };
    const errors = validateCheckin({ durationSeconds: ui.exerciseSession?.actualDurationSeconds, creditType: context.creditType, sportType: context.sportType, customSport: context.sportName, description, files: ui.uploads });
    if (errors.length) { ui.checkinError = errors.join("；"); return render(); }
    if (ui.exerciseSession?.status !== "COMPLETED") { ui.checkinError = "Backend 尚未确认运动结束，请联网重试"; return render(); }
    ui.checkinBusy = true; ui.checkinError = ""; render();
    try {
      const media = [];
      for (let index = 0; index < ui.uploads.length; index += 1) {
        if (ui.uploads[index].mediaId) { media.push({ id: ui.uploads[index].mediaId }); continue; }
        ui.uploads[index] = { ...ui.uploads[index], status: "uploading", progress: 0 }; render();
        const evidence = await realApi.uploadExerciseMedia(ui.exerciseSession.id, ui.uploads[index], ({ percent }) => { ui.uploads[index] = { ...ui.uploads[index], progress: percent }; render(); });
        ui.uploads[index] = { ...ui.uploads[index], mediaId: evidence.id, status: "success", progress: 100 }; media.push(evidence); await saveSessionMedia(ui.exerciseSession.id, ui.uploads); render();
      }
      const recordContent = { creditType: context.creditType, sportType: context.sportType, ...(context.sportType === "OTHER" ? { sportName: context.sportName } : {}), description };
      let draft = store.getState().draft?.recordDraft;
      if (draft?.sessionId === ui.exerciseSession.id) {
        const current = await realApi.recordDetail(draft.id);
        if (current.status === "SUBMITTED") {
          store.patch((state) => ({ records: [{ ...current, statusLabel: "待审核" }, ...state.records.filter((item) => item.id !== current.id)] }));
          clearExercise(); ui.checkinTab = "records"; return;
        }
        draft = await realApi.updateExerciseRecord(draft.id, { ...recordContent, expectedVersion: current.version });
      } else {
        draft = await realApi.createExerciseRecord({ sessionId: ui.exerciseSession.id, ...recordContent, clientRequestId: context.clientRequestId }, context.createRetryKey);
      }
      store.saveDraft({ recordDraft: draft });
      const submitted = await realApi.submitExerciseRecord(draft.id, media.map((item) => item.id), draft.version, context.submitRetryKey);
      store.patch((state) => ({ records: [{ ...submitted, statusLabel: "待审核" }, ...state.records.filter((item) => item.id !== submitted.id)] }));
      clearExercise(); ui.checkinTab = "records";
    } catch (error) { ui.checkinError = error.message; ui.uploads = ui.uploads.map((item) => item.status === "success" ? item : { ...item, status: "failed", progress: 0 }); }
    finally { ui.checkinBusy = false; render(); }
  }

  async function openCamera(kind) {
    if (!navigator.mediaDevices?.getUserMedia) { ui.checkinError = "当前浏览器不支持现场相机"; return render(); }
    if (kind === "video" && !canRecordVideo()) { ui.checkinError = "当前浏览器不能生成 Backend 支持的 MP4 有声视频，请改用现场照片"; return render(); }
    stopCamera();
    try {
      ui.captureKind = kind; ui.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: kind === "video" }); ui.cameraOpen = true; render();
    } catch { ui.checkinError = "无法打开相机或麦克风，请检查浏览器权限"; render(); }
  }

  function attachCameraPreview() { const video = root?.querySelector("#evidence-camera"); if (video && ui.cameraStream) video.srcObject = ui.cameraStream; }
  function stopCamera() {
    if (ui.recorder?.state === "recording") ui.recorder.stop();
    ui.cameraStream?.getTracks?.().forEach((track) => track.stop()); ui.cameraStream = null; ui.cameraOpen = false; ui.recording = false; ui.recorder = null;
  }

  function capturePhoto() {
    const video = root?.querySelector("#evidence-camera");
    if (!video?.videoWidth) { ui.checkinError = "相机画面尚未就绪"; return render(); }
    const canvas = document.createElement("canvas"); canvas.width = video.videoWidth; canvas.height = video.videoHeight; canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `exercise-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
      const items = createUploadItems([file]); const result = validateProofSelection([...ui.uploads, ...items]);
      if (!result.valid) { items.forEach(releaseUpload); ui.checkinError = result.errors.join("；"); }
      else { ui.uploads.push(...items); ui.checkinError = ""; saveSessionMedia(ui.exerciseSession?.id, ui.uploads).catch(() => { ui.checkinError = "现场凭证本地保存失败，请勿刷新页面"; }); }
      render();
    }, "image/jpeg", 0.88);
  }

  function startVideoRecording() {
    if (!ui.cameraStream || !canRecordVideo()) return;
    ui.recordedChunks = []; ui.recordingStartedAt = performance.now();
    ui.recorder = new MediaRecorder(ui.cameraStream, { mimeType: "video/mp4" });
    ui.recorder.ondataavailable = (event) => { if (event.data.size) ui.recordedChunks.push(event.data); };
    ui.recorder.onstop = () => {
      const durationSeconds = Math.min(15, Math.max(.1, (performance.now() - ui.recordingStartedAt) / 1000));
      const file = new File(ui.recordedChunks, `exercise-${Date.now()}.mp4`, { type: "video/mp4", lastModified: Date.now() });
      const items = createUploadItems([file], undefined, { durationSeconds }); const result = validateProofSelection([...ui.uploads, ...items]);
      if (!result.valid) { items.forEach(releaseUpload); ui.checkinError = result.errors.join("；"); } else { ui.uploads.push(...items); saveSessionMedia(ui.exerciseSession?.id, ui.uploads).catch(() => { ui.checkinError = "视频草稿本地保存失败，请勿刷新页面"; }); }
      ui.recording = false; render();
    };
    ui.recorder.start(500); ui.recording = true; setTimeout(() => { if (ui.recorder?.state === "recording") ui.recorder.stop(); }, 15000); render();
  }

  async function requestEmail(form) {
    ui.email.busy = true; ui.email.error = ""; render();
    try { ui.email.challenge = await realApi.requestEmailChallenge(String(new FormData(form).get("email") || "").trim(), store.getState().student.version); }
    catch (error) { ui.email.error = error.message; }
    finally { ui.email.busy = false; render(); }
  }

  async function verifyEmail(form) {
    const data = new FormData(form); ui.email.busy = true; ui.email.error = ""; render();
    try { const current = await realApi.verifyEmailChallenge(ui.email.challenge.challengeId, String(data.get("newEmailCode") || ""), String(data.get("currentEmailCode") || "")); store.patch({ student: { ...current.studentProfile, ...current.user } }); ui.email.challenge = null; go("profile"); }
    catch (error) { ui.email.error = error.message; }
    finally { ui.email.busy = false; render(); }
  }

  async function previewInvite(formOrToken) {
    const token = typeof formOrToken === "string" ? formOrToken : String(new FormData(formOrToken).get("inviteToken") || "").trim();
    ui.join.busy = true; ui.join.error = ""; ui.join.token = token; render();
    try { ui.join.preview = await realApi.previewInvite(token); }
    catch (error) { ui.join.error = error.message; }
    finally { ui.join.busy = false; render(); }
  }

  async function joinCourse(form) {
    const data = new FormData(form); ui.join.busy = true; ui.join.error = ""; render();
    try {
      const profile = { fullName: String(data.get("fullName") || "").trim(), studentNumber: String(data.get("studentNumber") || "").trim(), gender: String(data.get("gender") || ""), gradeYear: Number(data.get("gradeYear")) };
      const capability = await realApi.issueJoinCapability(ui.join.token, profile);
      const joined = await realApi.joinCourse(ui.join.token, capability.joinCapability);
      if (joined.authSession) store.persistSession(joined.authSession, "real");
      ui.publicJoin = false;
      ui.join.preview = null; ui.join.token = ""; await hydrateReal(); go("courses");
    } catch (error) { ui.join.error = error.message; }
    finally { ui.join.busy = false; render(); }
  }

  async function submitExemption(form) {
    const data = new FormData(form);
    const payload = { enrollmentId: String(data.get("enrollmentId") || ""), type: String(data.get("type") || ""), reason: String(data.get("reason") || "").trim(), proofs: ui.exemptionUploads };
    const errors = validateExemption(payload);
    if (!payload.enrollmentId) errors.push("请选择所属教学班");
    if (errors.length) { ui.exemptionError = errors.join("；"); return render(); }
    ui.exemptionBusy = true; ui.exemptionError = ""; render();
    try {
      if (store.getState().mode === "demo") {
        const uploaded = ui.exemptionUploads.length ? await demoApi.uploadProofs(ui.exemptionUploads.map((item) => item.file)) : [];
        await demoApi.submitExemption({ type: payload.type, reason: payload.reason, proofFiles: uploaded.map((item) => item.url) });
        ui.exemptionUploads.forEach(releaseUpload); ui.exemptionUploads = []; go("exemptions"); return;
      }
      const uploaded = [];
      for (const item of ui.exemptionUploads) uploaded.push(await realApi.uploadExemptionMedia(payload.enrollmentId, item));
      const target = store.getState().exemptions.find((item) => item.id === ui.supplementExemptionId);
      let draft;
      if (target) draft = await realApi.updateExemption(target.id, { reason: payload.reason, mediaIds: [...new Set([...(target.mediaIds || []), ...uploaded.map((item) => item.id)])], expectedVersion: target.version });
      else draft = await realApi.createExemption({ enrollmentId: payload.enrollmentId, applicationType: payload.type, reason: payload.reason, mediaIds: uploaded.map((item) => item.id) });
      const submitted = draft.status === "DRAFT" ? await realApi.submitExemption(draft.id, draft.version) : draft;
      store.patch((state) => ({ exemptions: [normalizeExemption(submitted), ...state.exemptions.filter((item) => item.id !== submitted.id)] }));
      ui.exemptionUploads.forEach(releaseUpload); ui.exemptionUploads = []; ui.supplementExemptionId = null; go("exemptions");
    } catch (error) { ui.exemptionError = error.message; }
    finally { ui.exemptionBusy = false; render(); }
  }

  async function submitFeedback(form) {
    const data = new FormData(form); const category = String(data.get("category") || "OTHER"); const content = String(data.get("content") || "").trim();
    if (!content || content.length > 2000) { ui.feedbackError = "反馈内容须为 1–2000 个字符"; return render(); }
    ui.feedbackBusy = true; ui.feedbackError = ""; render();
    try {
      if (store.getState().mode === "demo") store.patch((state) => ({ feedback: [{ id: `demo-${Date.now()}`, category, content, status: "OPEN", createdAt: new Date().toISOString() }, ...state.feedback] }));
      else { const item = await realApi.createFeedback(category, content); store.patch((state) => ({ feedback: [item, ...state.feedback] })); }
      form.reset();
    } catch (error) { ui.feedbackError = error.message; }
    finally { ui.feedbackBusy = false; render(); }
  }

  async function updateBackendPreference(name, checked) {
    if (store.getState().mode !== "real") { store.patch((state) => ({ preferences: { ...state.preferences, [name]: checked } })); return; }
    try {
      const current = store.getState().preferences;
      const updated = await realApi.updatePreferences({ locale: current.locale || "zh-CN", pushEnabled: name === "pushEnabled" ? checked : Boolean(current.pushEnabled), emailEnabled: name === "emailEnabled" ? checked : Boolean(current.emailEnabled), expectedVersion: current.version });
      store.patch({ preferences: updated });
    } catch (error) { ui.syncMessage = `偏好设置保存失败：${error.message}`; render(); }
  }

  async function startQrScan() {
    if (!globalThis.BarcodeDetector || !navigator.mediaDevices?.getUserMedia) { ui.join.error = "当前浏览器不支持二维码扫描，请直接输入邀请码"; return render(); }
    try { ui.join.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }); ui.join.scanning = true; render(); scanQrLoop(); }
    catch { ui.join.error = "无法打开相机，请检查浏览器权限"; render(); }
  }
  function attachQrPreview() { const video = root?.querySelector("#qr-camera"); if (video && ui.join.stream) video.srcObject = ui.join.stream; }
  async function scanQrLoop() {
    const video = root?.querySelector("#qr-camera");
    if (!ui.join.scanning || !video) return;
    try { const codes = await new BarcodeDetector({ formats: ["qr_code"] }).detect(video); if (codes[0]?.rawValue) { const raw = codes[0].rawValue; const token = (() => { try { const url = new URL(raw); return url.searchParams.get("inviteToken") || url.pathname.split("/").filter(Boolean).pop(); } catch { return raw; } })(); stopQrScan(); return previewInvite(token); } } catch { /* keep scanning */ }
    ui.join.timer = setTimeout(scanQrLoop, 500);
  }
  function stopQrScan() { clearTimeout(ui.join.timer); ui.join.stream?.getTracks?.().forEach((track) => track.stop()); ui.join.stream = null; ui.join.scanning = false; }

  root?.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) return go(routeButton.dataset.route);
    if (event.target.closest('[data-action="demo-login"]')) { const demo = demoWorkspace(); store.patch(demo); store.persistSession(demo.session, "demo"); go("home"); return render(); }
    if (event.target.closest('[data-action="reset-demo"]')) { const demo = demoWorkspace(); store.reset(createInitialState()); store.patch(demo); store.persistSession(demo.session, "demo"); go("home"); return render(); }
    if (event.target.closest('[data-action="public-course-join"]')) { ui.publicJoin = true; ui.join = { ...ui.join, token: "", preview: null, error: "", scanning: false }; return render(); }
    if (event.target.closest('[data-action="leave-public-join"]')) { stopQrScan(); ui.publicJoin = false; return render(); }
    if (event.target.closest('[data-action="change-login-email"]')) { ui.login.challenge = null; return render(); }
    if (event.target.closest('[data-action="retry-sync"]')) { await hydrateReal(); return render(); }
    const tab = event.target.closest("[data-checkin-tab]"); if (tab) { ui.checkinTab = tab.dataset.checkinTab; return render(); }
    const taskFilter = event.target.closest("[data-task-filter]"); if (taskFilter) { ui.taskFilter = taskFilter.dataset.taskFilter; return render(); }
    const recordFilter = event.target.closest("[data-record-filter]"); if (recordFilter) { ui.recordFilter = recordFilter.dataset.recordFilter; return render(); }
    const task = event.target.closest('[data-action="use-task"]'); if (task) { ui.selectedTaskId = task.dataset.taskId; ui.checkinTab = "submit"; go("checkin"); return render(); }
    const sessionAction = event.target.closest("[data-session-action]"); if (sessionAction) return controlExercise(sessionAction.dataset.sessionAction);
    const camera = event.target.closest('[data-action="open-camera"]'); if (camera) return openCamera(camera.dataset.captureKind);
    if (event.target.closest('[data-action="capture-photo"]')) return capturePhoto();
    if (event.target.closest('[data-action="start-video-recording"]')) return startVideoRecording();
    if (event.target.closest('[data-action="stop-video-recording"]')) { if (ui.recorder?.state === "recording") ui.recorder.stop(); return; }
    if (event.target.closest('[data-action="close-camera"]')) { stopCamera(); return render(); }
    const remove = event.target.closest('[data-action="remove-upload"]'); if (remove) { const item = ui.uploads.find((value) => value.id === remove.dataset.uploadId); releaseUpload(item); ui.uploads = ui.uploads.filter((value) => value.id !== remove.dataset.uploadId); await saveSessionMedia(ui.exerciseSession?.id, ui.uploads).catch(() => {}); return render(); }
    if (event.target.closest('[data-action="restart-email-verification"]')) { ui.email.challenge = null; return render(); }
    if (event.target.closest('[data-action="start-qr-scan"]')) return startQrScan();
    if (event.target.closest('[data-action="stop-qr-scan"]')) { stopQrScan(); return render(); }
    if (event.target.closest('[data-action="open-notifications"]')) { ui.notificationOpen = true; return render(); }
    if (event.target.closest('[data-action="close-notifications"]')) { ui.notificationOpen = false; ui.selectedNoticeId = null; return render(); }
    const openNotice = event.target.closest('[data-action="open-notice"], [data-action="read-notice"]');
    if (openNotice) { const id = openNotice.dataset.noticeId; ui.selectedNoticeId = id; const notice = store.getState().notifications.find((item) => item.id === id); if (notice?.isUnread && store.getState().mode === "real") await realApi.markNotificationRead(id); store.patch((state) => ({ notifications: state.notifications.map((item) => item.id === id ? { ...item, isUnread: false } : item) })); return render(); }
    if (event.target.closest('[data-action="back-notices"]')) { ui.selectedNoticeId = null; return render(); }
    if (event.target.closest('[data-action="mark-all-read"]')) { const unread = store.getState().notifications.filter((item) => item.isUnread); if (store.getState().mode === "real") await Promise.all(unread.map((item) => realApi.markNotificationRead(item.id))); store.patch((state) => ({ notifications: state.notifications.map((item) => ({ ...item, isUnread: false })) })); return; }
    if (event.target.closest('[data-action="logout"]')) { try { if (store.getState().mode === "real") await realApi.logout(store.getState().session?.refreshToken); } catch { /* local sign-out still clears secrets */ } clearExercise(); store.clearSession(); globalThis.location.hash = ""; return render(); }
    const supplementExemption = event.target.closest('[data-action="supplement-exemption"]'); if (supplementExemption) { ui.supplementExemptionId = supplementExemption.dataset.exemptionId; go("exemption-new"); return render(); }
    const removeExemption = event.target.closest('[data-action="remove-exemption-upload"]'); if (removeExemption) { const item = ui.exemptionUploads.find((value) => value.id === removeExemption.dataset.uploadId); releaseUpload(item); ui.exemptionUploads = ui.exemptionUploads.filter((value) => value.id !== removeExemption.dataset.uploadId); return render(); }
  });

  root?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (event.target.id === "student-login-form") requestLoginCode(event.target);
    else if (event.target.id === "student-code-form") verifyLoginCode(event.target);
    else if (event.target.id === "exercise-start-form") startExercise(event.target);
    else if (event.target.id === "exercise-submit-form") submitExercise(event.target);
    else if (event.target.id === "email-verification-form") ui.email.challenge ? verifyEmail(event.target) : requestEmail(event.target);
    else if (event.target.id === "invite-preview-form") previewInvite(event.target);
    else if (event.target.id === "course-join-form") joinCourse(event.target);
    else if (event.target.id === "exemption-form") submitExemption(event.target);
    else if (event.target.id === "feedback-form") submitFeedback(event.target);
  });

  root?.addEventListener("change", (event) => {
    if (event.target.matches('#exercise-start-form [name="creditType"]')) {
      const description = event.target.form?.elements?.description;
      if (description) {
        const required = event.target.value === "GENERAL";
        description.required = required;
        description.placeholder = required ? "自主运动必须填写，最多 200 字" : "课程运动可选，最多 200 字";
      }
    }
    if (event.target.id === "exemption-proof-picker") {
      const items = createUploadItems(event.target.files);
      const result = validateExemptionProofSelection([...ui.exemptionUploads, ...items]);
      if (!result.valid) { items.forEach(releaseUpload); ui.exemptionError = result.errors.join("；"); }
      else { ui.exemptionUploads.push(...items); ui.exemptionError = ""; }
      return render();
    }
    if (event.target.matches('[data-setting="reducedMotion"]')) store.patch((state) => ({ settings: { ...state.settings, reducedMotion: event.target.checked } }));
    if (event.target.matches('[data-setting="themeMode"]')) { const themeMode = normalizeTheme(event.target.value); store.patch((state) => ({ settings: { ...state.settings, themeMode } })); applyTheme(themeMode); }
    if (event.target.matches('[data-preference="pushEnabled"], [data-preference="emailEnabled"]')) updateBackendPreference(event.target.dataset.preference, event.target.checked);
  });
  globalThis.addEventListener?.("hashchange", () => { if (routeFromHash(globalThis.location.hash).name !== "join") stopQrScan(); render(); });
  store.subscribe(render); render();
  if (store.getState().session && store.getState().mode === "real") hydrateReal().finally(render);
  ui.sessionTicker = setInterval(() => { if (ui.exerciseSession?.status === "IN_PROGRESS" && routeFromHash(globalThis.location?.hash).name === "checkin") render(); }, 1000);
  return { store, api, render, go };
}

if (typeof document !== "undefined") createStudentApp({ root: document.querySelector("#student-app") });
