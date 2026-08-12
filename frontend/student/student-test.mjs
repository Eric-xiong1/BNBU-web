import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, GRADE_WEIGHTS, uploadLimits } from "./core/constants.js";
import { createStore } from "./core/store.js";
import { demoWorkspace } from "./data/demo-data.js";
import { createStudentApi } from "./core/api.js";
import { createInitialState, mergeCheckinDraft, normalizeV1Workspace, resolveStudentApiBase, routeFromHash } from "./app.js";
import { renderBottomNav, renderShell } from "./views/shell.js";
import { createUploadItems, validateExemptionProofSelection, validateProofSelection, validateCheckin } from "./core/upload.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { renderCourses } from "./views/courses.js";
import { calculateGrade, renderGrades } from "./views/grades.js";
import { renderProfile } from "./views/profile.js";
import { renderCourseJoin, renderEmailVerification } from "./views/account.js";
import { icon } from "./core/icons.js";
import { normalizeTheme, resolvedTheme } from "./core/theme.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderNotificationDrawer } from "./views/notifications.js";
import { renderPrivacyPolicy } from "./views/privacy.js";
import { renderLogin } from "./views/login.js";
import { renderFeedback, renderHelp } from "./views/support.js";

const response = (data, status = 200) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => "req-test" }, json: async () => data });

test("theme and Android navigation remain aligned", () => {
  for (const mode of ["light", "dark", "system"]) assert.equal(normalizeTheme(mode), mode);
  assert.equal(resolvedTheme("system", true), "dark");
  assert.deepEqual(NAV_ITEMS.map((item) => item.id), ["home", "courses", "checkin", "grades", "profile"]);
  assert.equal(Object.values(GRADE_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
  for (const name of ["home", "courses", "checkin", "grades", "profile"]) assert.match(icon(name, "nav-icon"), /<svg/);
});

test("exercise media policy matches current Android and Backend", () => {
  assert.deepEqual(uploadLimits, { images: 6, videos: 1, imageBytes: 10 * 1024 * 1024, videoDurationSeconds: 15 });
  const image = { file: { type: "image/jpeg", size: 1000 }, source: "camera", durationSeconds: null };
  const video = { file: { type: "video/mp4", size: 1000 }, source: "camera", durationSeconds: 15 };
  assert.equal(validateProofSelection([...Array(6).fill(image), video]).valid, true);
  assert.match(validateProofSelection([...Array(7).fill(image)]).errors.join(" "), /最多 6 张/);
  assert.match(validateProofSelection([video, video]).errors.join(" "), /最多 1 个视频/);
  assert.match(validateProofSelection([{ ...video, durationSeconds: 15.1 }]).errors.join(" "), /最长 15 秒/);
  assert.match(validateProofSelection([{ ...image, source: "gallery" }]).errors.join(" "), /不是本次现场拍摄/);
  assert.match(validateProofSelection([{ file: { type: "image/webp", size: 1000 }, source: "camera" }]).errors.join(" "), /格式不支持/);
});

test("exemption proof picker remains separate from camera-only exercise policy", () => {
  const file = { type: "image/jpeg", size: 1000, name: "proof.jpg" };
  assert.equal(validateExemptionProofSelection([{ file, source: "gallery" }]).valid, true);
  assert.match(validateExemptionProofSelection(Array(21).fill(file)).errors.join(" "), /最多 20 个/);
  assert.match(validateExemptionProofSelection([{ ...file, size: 10 * 1024 * 1024 + 1 }]).errors.join(" "), /超过 10MB/);
});

test("check-in validation is server-session shaped", () => {
  const proof = { file: { type: "image/jpeg", size: 1000 }, source: "camera" };
  assert.match(validateCheckin({ durationSeconds: 3599, sportType: "RUNNING", description: "跑步", files: [proof] }).join(" "), /不足 1 小时/);
  assert.match(validateCheckin({ durationSeconds: 3600, sportType: "OTHER", customSport: "", description: "训练", files: [proof] }).join(" "), /自定义运动名称/);
  assert.match(validateCheckin({ durationSeconds: 3600, creditType: "GENERAL", sportType: "RUNNING", description: "", files: [proof] }).join(" "), /自主运动必须填写/);
  assert.deepEqual(validateCheckin({ durationSeconds: 3600, creditType: "COURSE_RELATED", sportType: "RUNNING", description: "", files: [proof] }), []);
  assert.match(validateCheckin({ durationSeconds: 3600, creditType: "COURSE_RELATED", sportType: "RUNNING", description: "x".repeat(201), files: [proof] }).join(" "), /最多 200/);
  assert.match(validateCheckin({ durationSeconds: 3600, sportType: "RUNNING", description: "跑步", files: [] }).join(" "), /至少保留/);
  assert.deepEqual(validateCheckin({ durationSeconds: 3600, sportType: "RUNNING", description: "南区操场慢跑", files: [proof] }), []);
});

test("student API is pinned to /api/v1 email OTP", async () => {
  const calls = [];
  const api = createStudentApi({ fetchImpl: async (url, options) => { calls.push({ url, options }); return response({ data: { challengeId: "challenge", expiresAt: "2026-08-12T12:00:00Z" }, meta: { requestId: "req" } }, 202); } });
  await api.requestSignInCode("BNBU", "student@bnbu.edu.cn");
  assert.equal(calls[0].url, "/api/v1/auth/student-sign-in-codes");
  assert.deepEqual(JSON.parse(calls[0].options.body), { organizationCode: "BNBU", account: "student@bnbu.edu.cn", channel: "EMAIL", locale: "zh-CN" });
  assert.ok(calls[0].options.headers["Idempotency-Key"]);
  assert.doesNotMatch(JSON.stringify(calls[0]), /password|phone|SMS/);
});

test("student runtime Backend is explicit and production-safe", () => {
  assert.equal(resolveStudentApiBase(""), "/api/v1");
  assert.equal(resolveStudentApiBase("https://sports-api.example.edu/api/v1/"), "https://sports-api.example.edu/api/v1");
  assert.equal(resolveStudentApiBase("http://127.0.0.1:3000/api/v1"), "http://127.0.0.1:3000/api/v1");
  assert.throws(() => resolveStudentApiBase("http://sports-api.example.edu/api/v1"), /HTTPS/);
  assert.throws(() => resolveStudentApiBase("https://sports-api.example.edu/api"), /\/api\/v1/);
});

test("student API preserves Backend errors and never converts them to demo data", async () => {
  const api = createStudentApi({ fetchImpl: async () => response({ code: "AUTH_VERIFICATION_CODE_INVALID", message: "验证码无效" }, 422) });
  await assert.rejects(() => api.verifySignInCode("challenge", "1234", "device"), (error) => error.status === 422 && error.code === "AUTH_VERIFICATION_CODE_INVALID");
});

test("exercise session control uses Backend version and observation time", async () => {
  const calls = [];
  const api = createStudentApi({ getToken: () => "token", fetchImpl: async (url, options) => { calls.push({ url, options }); return response({ data: { id: "session", status: "COMPLETED", version: 3 } }); } });
  await api.controlExerciseSession("session", "finish", 2);
  assert.equal(calls[0].url, "/api/v1/exercise-sessions/session/finish");
  const body = JSON.parse(calls[0].options.body);
  assert.equal(body.expectedVersion, 2);
  assert.ok(Date.parse(body.clientObservedAt));
});

test("record submit sends every retained media id in retained order", async () => {
  let body;
  const api = createStudentApi({ fetchImpl: async (_url, options) => { body = JSON.parse(options.body); return response({ data: { id: "record", status: "SUBMITTED" } }); } });
  await api.submitExerciseRecord("record", ["media-b", "media-a"], 4);
  assert.deepEqual(body, { mediaIds: ["media-b", "media-a"], expectedVersion: 4 });
});

test("workspace normalization follows Backend projections", () => {
  const normalized = normalizeV1Workspace({
    currentUser: { user: { id: "u", role: "STUDENT", emailVerified: true, primaryEmailMasked: "s***@bnbu.edu.cn" }, studentProfile: { id: "s", fullName: "学生", studentNumber: "20260001", gender: "MALE", gradeYear: 2026 } },
    enrollments: [{ id: "e", classSectionId: "cs", status: "ACTIVE" }],
    sections: [{ id: "cs", courseId: "c", classCode: "1004", displayName: "Section 1004" }], courses: [{ id: "c", courseCode: "GEPE101", courseName: "大学体育" }],
    records: [{ id: "r", creditType: "GENERAL", actualDurationSeconds: 3600, creditedDurationSeconds: 3600, status: "SUBMITTED", currentReview: { result: "PENDING" } }],
    scores: [{ enrollmentId: "e", validCourseDurationSeconds: 1200, validGeneralDurationSeconds: 2400, totalValidDurationSeconds: 3600, totalRequiredSeconds: 36000 }], notifications: [{ id: "n", body: "通知", readAt: null }], exemptions: [],
  });
  assert.equal(normalized.student.emailVerified, true);
  assert.equal(normalized.courses[0].enrollmentId, "e");
  assert.equal(normalized.records[0].hours, 1);
  assert.equal(normalized.summary.courseHours, 1200 / 3600);
  assert.equal(normalized.summary.generalHours, 2400 / 3600);
  assert.equal(normalized.notifications[0].isUnread, true);
});

test("login view contains only email verification controls", () => {
  const html = renderLogin();
  for (const text of ["BNBU SPORTS", "学生邮箱登录", "学校代码", "学校邮箱", "发送邮箱验证码"]) assert.match(html, new RegExp(text));
  assert.doesNotMatch(html, /name="password"|type="tel"|name="phone"/);
  assert.match(html, /首次扫码 \/ 邀请码入课/);
  assert.match(renderLogin({ challenge: { expiresAt: new Date().toISOString() }, account: "student@bnbu.edu.cn" }), /student-code-form/);
});

test("email verification view supports first bind and rebind", () => {
  assert.match(renderEmailVerification({ user: { emailVerified: false, version: 1 } }), /绑定学校邮箱/);
  const rebound = renderEmailVerification({ user: { emailVerified: true, primaryEmailMasked: "s***@bnbu.edu.cn" }, challenge: { mode: "REBIND", expiresAt: new Date().toISOString() } });
  assert.match(rebound, /当前邮箱验证码/);
  assert.match(rebound, /新邮箱验证码/);
});

test("unverified accounts cannot reach join form", () => {
  const blocked = renderCourseJoin({ user: { emailVerified: false } });
  assert.match(blocked, /请先验证邮箱/);
  assert.doesNotMatch(blocked, /invite-preview-form/);
  const ready = renderCourseJoin({ user: { emailVerified: true } });
  assert.match(ready, /扫描二维码/);
  assert.match(ready, /课程邀请码/);
  const firstJoin = renderCourseJoin({ user: {}, allowPending: true });
  assert.match(firstJoin, /invite-preview-form/);
  assert.match(firstJoin, /返回邮箱登录/);
});

test("check-in view exposes server session and camera-only evidence", () => {
  const idle = renderCheckin({ activeTab: "submit", enrollments: [{ id: "e", classSectionId: "cs" }], courses: [{ enrollmentId: "e", name: "体育" }] });
  assert.match(idle, /SERVER SESSION/);
  assert.match(idle, /不足 1 小时/);
  assert.doesNotMatch(idle, /type="file"|本次学时/);
  const completed = renderCheckin({ activeTab: "submit", session: { id: "s", status: "COMPLETED", version: 2, actualDurationSeconds: 3600 }, elapsedSeconds: 3600, uploads: [], canRecordVideo: true });
  assert.match(completed, /现场拍照/);
  assert.match(completed, /录制 15 秒有声视频/);
  assert.match(completed, /提交全部 0 个凭证/);
});

test("record details show Backend-authoritative durations", () => {
  const html = renderRecordDetail({ id: "r", sportType: "RUNNING", actualDurationSeconds: 3700, creditedDurationSeconds: 3600, description: "慢跑", status: "SUBMITTED", currentReview: { result: "PENDING" } });
  assert.match(html, /服务端实际时长/);
  assert.match(html, /有效时长/);
  assert.doesNotMatch(html, /补交材料/);
});

test("course list includes direct scan or invite entry", () => {
  const html = renderCourses(demoWorkspace().courses, demoWorkspace().tasks, demoWorkspace().records);
  assert.match(html, /扫码或输入邀请码加入课程/);
  assert.match(html, /GEPE101 \/ Section 1004/);
});

test("profile removes endurance entry and adds email security", () => {
  const html = renderProfile(demoWorkspace());
  assert.match(html, /绑定学校邮箱/);
  assert.doesNotMatch(html, /耐力跑成绩换算/);
  assert.match(html, /免测与免打卡/);
});

test("store restores drafts and clears account-scoped data on logout", () => {
  const memory = new Map(); const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  const first = createStore({ storage, initial: createInitialState() }); first.saveDraft({ exerciseContext: { description: "慢跑" } });
  assert.equal(createStore({ storage, initial: createInitialState() }).getState().draft.exerciseContext.description, "慢跑");
  first.patch({ session: { accessToken: "secret" }, student: { id: "s" }, records: [{ id: "r" }] }); first.clearSession();
  assert.equal(first.getState().session, null); assert.deepEqual(first.getState().student, {}); assert.deepEqual(first.getState().records, []);
});

test("shell, dashboard, grades, notifications and privacy remain available", () => {
  assert.match(renderBottomNav("home"), /bottom-nav/);
  assert.match(renderShell({ active: "home", content: "x", syncMessage: "真实同步失败" }), /data-action="retry-sync"/);
  assert.match(renderDashboard(demoWorkspace()), /学时进度/);
  assert.equal(calculateGrade({ checkin: 80, exam: 90, performance: 85, physical: 70 }).total, 81.5);
  assert.match(renderGrades(demoWorkspace().grades), /数据来源/);
  const backendGrade = renderGrades({ sources: [{ totalValidDurationSeconds: 3600, validCourseDurationSeconds: 1200, validGeneralDurationSeconds: 2400, status: "NOT_CALCULATED", qualificationStatus: "NOT_QUALIFIED", finalScore: null }] });
  assert.match(backendGrade, /Backend 返回的成绩/);
  assert.doesNotMatch(backendGrade, /专项考试 ×/);
  assert.match(renderNotificationDrawer({ notices: demoWorkspace().notifications }), /role="dialog"/);
  assert.match(renderPrivacyPolicy(), /隐私政策/);
});

test("routing recognizes new email and join destinations", () => {
  assert.equal(routeFromHash("#/email").name, "email");
  assert.equal(routeFromHash("#/join").name, "join");
  assert.equal(routeFromHash("#/help").name, "help");
  assert.equal(routeFromHash("#/feedback").name, "feedback");
  assert.equal(routeFromHash("#unknown").name, "home");
  assert.deepEqual(mergeCheckinDraft({ description: "旧" }, { description: "新" }), { description: "新" });
});

test("help and feedback use Backend-safe rendered content", () => {
  assert.match(renderHelp({ articles: [{ title: "上传帮助", category: "MEDIA", bodyMarkdown: "第一段\n\n第二段" }] }), /上传帮助/);
  assert.doesNotMatch(renderHelp({ articles: [{ title: "x", category: "x", bodyMarkdown: "<script>alert(1)<\/script>" }] }), /<script>/);
  assert.match(renderFeedback({ items: [{ status: "RESOLVED", content: "建议", publicReply: "已处理" }] }), /官方回复/);
});

test("captured upload items are marked camera-origin", () => {
  const file = new Blob(["x"], { type: "image/jpeg" });
  const [item] = createUploadItems([file], () => "blob:test");
  assert.equal(item.source, "camera");
});
