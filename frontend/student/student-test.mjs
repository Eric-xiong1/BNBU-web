import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, GRADE_WEIGHTS, uploadLimits } from "./core/constants.js";
import { createStore } from "./core/store.js";
import { demoWorkspace } from "./data/demo-data.js";
import { createStudentApi } from "./core/api.js";
import { createInitialState, mergeCheckinDraft, normalizeHydration, routeFromHash } from "./app.js";
import { renderBottomNav, renderShell } from "./views/shell.js";
import { validateProofSelection, validateSessionStart, validateSubmission } from "./core/upload.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { earnedHoursFromActiveMs, sessionElapsedMs, shouldAutoEnd, pauseSession, resumeSession, hasServedToday, formatTimer, startSession } from "./core/session.js";
import { renderCourses } from "./views/courses.js";
import { calculateGrade, renderGrades } from "./views/grades.js";
import { filterNotifications, renderProfile } from "./views/profile.js";
import { validateRunTime, validateExemption, renderEndurance, renderExemptions, renderExemptionDetail } from "./views/tools.js";
import { safeProofUrl } from "./core/utils.js";
import { icon } from "./core/icons.js";
import { normalizeTheme, resolvedTheme } from "./core/theme.js";
import { dashboardRisk, renderDashboard } from "./views/dashboard.js";
import { renderNotificationDrawer } from "./views/notifications.js";
import { renderPrivacyPolicy } from "./views/privacy.js";
import { renderLogin } from "./views/login.js";
import { localEnduranceScore } from "./core/endurance.js";

test("theme preference accepts Android modes and rejects unknown values", () => {
  for (const mode of ["light", "dark", "system"]) assert.equal(normalizeTheme(mode), mode);
  assert.equal(normalizeTheme("purple"), "light");
});

test("system theme resolves through the supplied media preference", () => {
  assert.equal(resolvedTheme("system", true), "dark");
  assert.equal(resolvedTheme("system", false), "light");
});

test("navigation icons are accessible inline SVG", () => {
  assert.match(icon("home"), /<svg/);
  assert.match(icon("home"), /aria-hidden="true"/);
  assert.doesNotMatch(icon("missing"), /undefined/);
});

test("bottom navigation icons use solid SVGs without changing utility icons", () => {
  for (const name of ["courses", "checkin", "grades", "profile"]) {
    const svg = icon(name, "nav-icon");
    assert.match(svg, /data-icon-style="solid"/);
    assert.match(svg, /fill="currentColor"/);
    assert.match(svg, /stroke="none"/);
  }

  for (const name of ["notifications", "back", "close", "refresh", "moon", "shield"]) {
    const svg = icon(name);
    assert.match(svg, /data-icon-style="outline"/);
    assert.match(svg, /fill="none"/);
    assert.match(svg, /stroke="currentColor"/);
  }
});

test("courses navigation uses the Android MenuBook artwork", () => {
  const svg = icon("courses", "nav-icon");
  assert.match(svg, /M21,5c-1\.11,-0\.35/);
  assert.match(svg, /M17\.5,10\.5c0\.88,0/);
  assert.match(svg, /M17\.5,14\.33c-1\.7,0/);
});

test("dashboard derives Android progress and actionable risk", () => {
  const workspace = demoWorkspace();
  const html = renderDashboard(workspace);
  for (const text of ["学时进度", "课程相关", "其他运动", "重点计划", "运动服务"]) assert.match(html, new RegExp(text));
  assert.match(html, /data-action="open-notifications"/);
  assert.match(html, /class="dashboard-identity"/);
  assert.match(html, /class="brand-mark dashboard-emblem"/);
  assert.match(html, /src="\.\/assets\/bnbu-emblem\.svg"/);
  assert.match(html, /alt="BNBU 校徽"/);
});

test("dashboard prioritizes an in-progress session over generic hour gaps", () => {
  const risk = dashboardRisk({ activeSession: { id: "s", status: "running" }, summary: { courseHours: 9, generalHours: 9, rule: { courseRequired: 10, generalRequired: 10 } } });
  assert.equal(risk.route, "checkin");
  assert.equal(risk.action, "继续运动");
});

test("student navigation matches Android tab order", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.id), ["home", "courses", "checkin", "grades", "profile"]);
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ["首页", "课程", "打卡", "成绩", "我的"]);
});

test("grade weights total 100 percent", () => {
  assert.equal(Object.values(GRADE_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
});

test("upload limits match product contract", () => {
  assert.deepEqual(uploadLimits, {
    images: 6,
    videos: 1,
    imageBytes: 8 * 1024 * 1024,
    videoBytes: 100 * 1024 * 1024,
  });
});

test("proof URLs accept uploads and bundled demo thumbnails only", () => {
  assert.equal(safeProofUrl("/uploads/run.jpg"), "/uploads/run.jpg");
  assert.equal(safeProofUrl("./assets/demo-run.svg"), "./assets/demo-run.svg");
  assert.equal(safeProofUrl("/student/assets/untrusted.svg"), "");
});

test("store restores a saved draft", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  const first = createStore({ storage, initial: demoWorkspace() });
  first.saveDraft({ hours: 1.5, description: "南区操场慢跑五公里" });
  const second = createStore({ storage, initial: demoWorkspace() });
  assert.equal(second.getState().draft.hours, 1.5);
});

test("login rejects a non-student role", async () => {
  const api = createStudentApi({
    fetchImpl: async () => ({ ok: true, json: async () => ({ token: "x", user: { role: "teacher" } }) }),
  });
  await assert.rejects(() => api.login("teacher", "pw"), /仅限学生账号/);
});

test("upload normalizes urls-only backend responses", async () => {
  const api = createStudentApi({
    fetchImpl: async () => ({ ok: true, json: async () => ({ urls: ["/uploads/a.jpg"], count: 1 }) }),
  });
  const result = await api.uploadProofs([new Blob(["x"], { type: "image/jpeg" })]);
  assert.equal(result[0].url, "/uploads/a.jpg");
  assert.equal(result[0].mediaType, "image");
});

test("empty and unknown routes fall back to dashboard", () => {
  assert.equal(routeFromHash("").name, "home");
  assert.equal(routeFromHash("#unknown").name, "home");
  assert.equal(routeFromHash("#/home").name, "home");
});

test("logout clears account-scoped cached data but preserves settings", () => {
  const memory = new Map();
  const storage = { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: (key) => memory.delete(key) };
  const store = createStore({ storage, initial: createInitialState() });
  store.patch({ session: { token: "old" }, student: { id: "old-user" }, records: [{ id: "old-record" }], notifications: [{ id: "old-notice" }], exemptions: [{ id: "old-exemption" }], draft: { description: "old-draft" }, settings: { themeMode: "dark", reducedMotion: true } });
  store.clearSession();
  const state = store.getState();
  assert.equal(state.session, null);
  assert.deepEqual(state.student, {});
  assert.deepEqual(state.records, []);
  assert.deepEqual(state.notifications, []);
  assert.deepEqual(state.exemptions, []);
  assert.equal(state.draft, null);
  assert.equal(state.settings.themeMode, "dark");
});

test("student API preserves HTTP status for expired-session handling", async () => {
  const api = createStudentApi({ fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ code: "UNAUTHORIZED", message: "登录已过期" }) }) });
  await assert.rejects(api.summary, (error) => error.status === 401 && error.code === "UNAUTHORIZED");
});

test("local endurance scoring uses the complete national threshold table", () => {
  assert.deepEqual(localEnduranceScore({ timeSeconds: 225, gender: "female", gradeLevel: "FS" }), { score: 78, tier: "pass", timeSeconds: 225, gender: "female", gradeLevel: "FS", population: "F/FS", source: "local" });
  assert.equal(localEnduranceScore({ timeSeconds: 225, gender: "male", gradeLevel: "JS" }).score, 78);
  assert.equal(localEnduranceScore({ timeSeconds: 500, gender: "female", gradeLevel: "FS" }).score, 10);
});

test("real-session initial state never exposes demo student data", () => {
  const state = createInitialState();
  assert.deepEqual(state.student, {});
  assert.deepEqual(state.courses, []);
  assert.deepEqual(state.teacher, {});
});

test("hydration normalizes backend student DTOs for the views", () => {
  const data = normalizeHydration({
    summary: { courses: [{ courseId: "c1", courseCode: "GEPE101", courseSection: "1004", courseName: "大学体育", teacherName: "陈老师", courseHours: 5 }], teachers: [{ teacherId: "t1", teacherName: "陈老师" }] },
    grades: { components: {} }, identity: [{ id: "m", validUntil: "2026-12-31", offset: "可抵扣" }],
    notifications: [{ id: "n", time: "2026-07-01T00:00:00Z", isUnread: true }],
    profile: { id: "s1", name: "学生", gradeLevel: "sophomore" }, records: [], exemptions: [],
  });
  assert.equal(data.courses[0].name, "大学体育");
  assert.equal(data.notifications[0].createdAt, "2026-07-01T00:00:00Z");
  assert.equal(data.memberships[0].expiresAt, "2026-12-31");
  assert.equal(data.memberships[0].offsetStatus, "可抵扣");
  assert.equal(data.teacher.name, "陈老师");
  assert.equal(data.student.gradeLabel, "大二");
});

test("transient check-in values override only saved draft fields", () => {
  assert.deepEqual(mergeCheckinDraft({ hours: 1, description: "已保存" }, { hours: 1.5, description: "刚输入", sportType: "running" }), { hours: 1.5, description: "刚输入", sportType: "running" });
});

test("bottom navigation renders all Android destinations", () => {
  const dock = renderBottomNav("home");
  for (const label of ["首页", "课程", "打卡", "成绩", "我的"]) assert.match(dock, new RegExp(label));
  assert.ok(dock.indexOf("首页") < dock.indexOf("打卡"));
  assert.match(dock, /class="brand-mark nav-brand-mark"/);
  assert.match(dock, /src="\.\/assets\/bnbu-emblem\.svg"/);
  assert.match(dock, /alt="" aria-hidden="true"/);
  assert.match(dock, /brand-mark-fallback/);
  const shell = renderShell({ active: "checkin", content: "<p>内容</p>" });
  assert.doesNotMatch(shell, /checkin-action/);
  assert.match(shell, /bottom-nav/);
});

test("login presents the Android student identity and password control", () => {
  const html = renderLogin();
  for (const text of ["BNBU SPORTS", "体育打卡与成绩进度", "学生登录", "进入演示学生端"]) assert.match(html, new RegExp(text));
  assert.match(html, /data-action="toggle-password"/);
  assert.match(html, /class="[^"]*auth-grid/);
});

test("shell renders a retryable cached-data banner", () => {
  const html = renderShell({ active: "home", content: "<p>缓存内容</p>", syncMessage: "网络不可用，当前展示上次同步数据" });
  assert.match(html, /网络不可用，当前展示上次同步数据/);
  assert.match(html, /data-action="retry-sync"/);
});

test("proof selection rejects a seventh image and second video", () => {
  const image = { type: "image/jpeg", size: 1000 };
  const video = { type: "video/mp4", size: 1000 };
  assert.match(validateProofSelection([...Array(7).fill(image)]).errors.join(" "), /最多 6 张/);
  assert.match(validateProofSelection([video, video]).errors.join(" "), /最多 1 个视频/);
});

test("session start requires a custom name for other, submission requires proof", () => {
  const startErrors = validateSessionStart({ creditType: "其他运动", sportType: "other", customSport: "" });
  assert.match(startErrors.join(" "), /自定义运动名称/);
  const submitErrors = validateSubmission({ description: "南区操场慢跑", files: [] });
  assert.match(submitErrors.join(" "), /至少提交/);
});

test("session submission caps the description length", () => {
  const errors = validateSubmission({ description: "运".repeat(201), files: [{ type: "image/jpeg", size: 1000 }] });
  assert.match(errors.join(" "), /最多 200/);
});

test("check-in renders exercise and records tabs with exercise active", () => {
  const html = renderCheckin({ activeTab: "session", records: [], phase: "idle", courses: [] });
  for (const label of ["运动", "记录"]) assert.match(html, new RegExp(label));
  assert.match(html, /aria-selected="true"[^>]*>运动/);
});

test("record list renders the first valid proof thumbnail and remaining count", () => {
  const html = renderCheckin({ activeTab: "records", records: [{ id: "r1", sportType: "running", hours: 1, status: "有效", submittedAt: new Date().toISOString(), proofFiles: ["javascript:bad", "/uploads/run-a.jpg", "/uploads/run-b.jpg"] }] });
  assert.match(html, /class="record-thumb/);
  assert.match(html, /<img[^>]+src="\/uploads\/run-a\.jpg"[^>]+loading="eager"/);
  assert.match(html, /class="proof-count">\+1/);
  assert.doesNotMatch(html, /javascript:bad/);
});

test("record list distinguishes video and marks invalid records uncounted", () => {
  const video = renderCheckin({ activeTab: "records", records: [{ id: "v1", sportType: "fitness", hours: 1, status: "有效", submittedAt: new Date().toISOString(), proofFiles: ["/uploads/workout.mp4"] }] });
  assert.match(video, /<video[^>]+src="\/uploads\/workout\.mp4"/);
  assert.match(video, /class="record-thumb-play"/);
  const invalid = renderCheckin({ activeTab: "records", records: [{ id: "m1", sportType: "badminton", hours: 1, status: "无效", invalidReason: "凭证缺失", submittedAt: new Date().toISOString(), proofFiles: [] }] });
  assert.match(invalid, /class="record-thumb record-thumb-fallback"/);
  assert.match(invalid, /羽毛球/);
  assert.match(invalid, /不计入学时/);
});

test("record detail previews proofs and discloses invalid reason", () => {
  const html = renderRecordDetail({ id: "r1", sportType: "running", hours: 1, status: "有效", startTime: new Date().toISOString(), endTime: new Date().toISOString(), submittedAt: new Date().toISOString(), proofFiles: ["/uploads/run.jpg", "/uploads/run.mp4"] });
  assert.match(html, /<img[^>]+src="\/uploads\/run\.jpg"/);
  assert.match(html, /<video[^>]+src="\/uploads\/run\.mp4"[^>]+controls/);
  const invalid = renderRecordDetail({ id: "r2", sportType: "running", hours: 1, status: "无效", invalidReason: "凭证无法核验", proofFiles: [] });
  assert.match(invalid, /不计入学时/);
  assert.match(invalid, /凭证无法核验/);
});

test("courses display code section and related records without tasks", () => {
  const workspace = demoWorkspace();
  const html = renderCourses(workspace.courses, workspace.records);
  assert.match(html, /GEPE101 \/ Section 1004/);
  assert.match(html, /课程相关记录/);
  assert.doesNotMatch(html, /课程任务/);
});

test("check-in setup lets the student pick a category and sport before starting", () => {
  const workspace = demoWorkspace();
  const idle = renderCheckin({ activeTab: "session", phase: "idle", setup: {}, courses: workspace.courses, records: [] });
  assert.match(idle, /data-setup-sport="running"/);
  assert.match(idle, /服务类别/);
  assert.match(idle, /data-action="start-session"/);
});

test("check-in running phase renders a live timer and end control", () => {
  const session = { id: "s", creditType: "其他运动", sportType: "running", customSport: "", status: "running", startTime: new Date(Date.now() - 65 * 60 * 1000).toISOString(), pausedAccumMs: 0, lastPauseAt: null };
  const html = renderCheckin({ activeTab: "session", phase: "running", session, now: Date.now(), uploads: [] });
  assert.match(html, /data-action="end-session"/);
  assert.match(html, /data-action="pause-session"/);
  assert.match(html, /01:05:0\d/);
});

test("check-in today-done blocks a second daily session", () => {
  const html = renderCheckin({ activeTab: "session", phase: "today-done", records: [], todayRecord: { sportType: "running", hours: 1, submittedAt: new Date().toISOString() } });
  assert.match(html, /今日已完成一次运动服务/);
});

test("courses separate current and historical semesters", () => {
  const workspace = demoWorkspace();
  const html = renderCourses(workspace.courses, workspace.records);
  assert.match(html, /当前学期课程/);
  assert.match(html, /历史课程/);
  assert.match(html, /任课老师/);
});

test("session earns 0/1/2 hours at the correct duration thresholds", () => {
  const min = 60 * 60 * 1000;
  assert.equal(earnedHoursFromActiveMs(min - 1000), 0);
  assert.equal(earnedHoursFromActiveMs(min), 1);
  assert.equal(earnedHoursFromActiveMs(2 * min - 1000), 1);
  assert.equal(earnedHoursFromActiveMs(2 * min), 2);
});

test("session elapsed excludes paused time and auto-ends at 2h", () => {
  const now = 10_000_000;
  const started = startSession({ creditType: "其他运动", sportType: "running" }, now);
  assert.equal(sessionElapsedMs(started, now + 30 * 60 * 1000), 30 * 60 * 1000);
  const paused = pauseSession(started, now + 30 * 60 * 1000);
  assert.equal(sessionElapsedMs(paused, now + 50 * 60 * 1000), 30 * 60 * 1000); // frozen while paused
  const resumed = resumeSession(paused, now + 50 * 60 * 1000);
  assert.equal(sessionElapsedMs(resumed, now + 80 * 60 * 1000), 60 * 60 * 1000); // 30 + 30 active
  const full = startSession({ creditType: "其他运动", sportType: "running" }, now);
  assert.equal(shouldAutoEnd(full, now + 2 * 60 * 60 * 1000), true);
  assert.equal(shouldAutoEnd(full, now + 90 * 60 * 1000), false);
});

test("hasServedToday ignores invalidated records and formatTimer pads", () => {
  const now = Date.now();
  assert.equal(hasServedToday([{ status: "有效", startTime: new Date(now).toISOString() }], now), true);
  assert.equal(hasServedToday([{ status: "无效", startTime: new Date(now).toISOString() }], now), false);
  assert.equal(hasServedToday([{ status: "有效", startTime: new Date(now - 2 * 86400e3).toISOString() }], now), false);
  assert.equal(formatTimer(65 * 1000), "01:05");
  assert.equal(formatTimer(3661 * 1000), "01:01:01");
});

test("grade estimate uses 25 30 20 25 weights", () => {
  assert.equal(calculateGrade({ checkin: 80, exam: 90, performance: 85, physical: 70 }).total, 81.5);
});

test("grade view discloses formula missing items and sources", () => {
  const html = renderGrades({ components: { checkin: 80, exam: null, performance: 85, physical: 70 }, sources: ["教师录入", "打卡审核"] });
  for (const text of ["总分预估", "25%", "30%", "20%", "计算公式", "缺失项", "数据来源"]) assert.match(html, new RegExp(text));
});

test("notification unread filter returns only unread items", () => {
  assert.ok(filterNotifications(demoWorkspace().notifications, "unread").every((item) => item.isUnread));
});

test("profile exposes identity offsets notices tools settings and logout", () => {
  const html = renderProfile(demoWorkspace());
  for (const text of ["学生身份", "校队 / 社团抵扣", "通知", "耐力跑成绩换算", "免测申请", "设置", "退出登录"]) assert.match(html, new RegExp(text));
});

test("notification drawer supports list detail and read actions", () => {
  const notices = demoWorkspace().notifications;
  const list = renderNotificationDrawer({ notices, filter: "all" });
  assert.match(list, /role="dialog"/);
  assert.match(list, /data-action="mark-all-read"/);
  const detail = renderNotificationDrawer({ notices, selectedId: notices[0].id });
  assert.match(detail, /通知详情/);
  assert.match(detail, /data-action="close-notifications"/);
});

test("privacy policy includes Android data and rights sections", () => {
  const html = renderPrivacyPolicy();
  for (const text of ["隐私政策", "体育数据", "使用目的", "你的权利", "联系我们"]) assert.match(html, new RegExp(text));
});

test("profile exposes teacher identity organization and Android tools", () => {
  const html = renderProfile(demoWorkspace());
  for (const text of ["任课老师", "校队 / 社团认证", "耐力跑成绩换算", "免测与免打卡", "隐私政策"]) assert.match(html, new RegExp(text));
});

test("profile theme settings expose light dark and system", () => {
  const html = renderProfile(demoWorkspace());
  for (const value of ["light", "dark", "system"]) assert.match(html, new RegExp(`value="${value}"`));
});

test("grade page keeps the four Android weighted components", () => {
  const html = renderGrades(demoWorkspace().grades);
  for (const text of ["体育打卡", "专项考试", "平时表现", "体测", "计算公式", "数据来源"]) assert.match(html, new RegExp(text));
});

test("run time requires seconds between zero and 59", () => {
  assert.match(validateRunTime("3", "60").join(" "), /0–59/);
  assert.deepEqual(validateRunTime("3", "45"), []);
});

test("exemption requires type and reason", () => {
  assert.match(validateExemption({ type: "", reason: "", proofs: [] }).join(" "), /项目/);
  assert.match(validateExemption({ type: "800m", reason: "", proofs: [] }).join(" "), /原因/);
});

test("tool views include result and application states", () => {
  assert.match(renderEndurance({ student: demoWorkspace().student }), /耐力跑成绩换算/);
  assert.match(renderExemptions(demoWorkspace().exemptions), /我的申请/);
});

test("exemption list links to detail and supplement actions", () => {
  const item = { id: "ex-1", type: "800m", reason: "伤病恢复期", status: "需补材料", proofFiles: [], createdAt: new Date().toISOString(), reviewComment: "补交诊断证明" };
  const html = renderExemptions([item]);
  assert.match(html, /data-exemption-id="ex-1"/);
  assert.match(html, /补交证明/);
  assert.match(renderExemptionDetail(item), /处理意见/);
});

test("endurance result explains population and rule source", () => {
  const html = renderEndurance({ student: { gender: "female", genderLabel: "女", gradeLevel: "FS", gradeLabel: "大一" }, result: { score: 88, tier: "good", timeSeconds: 225, source: "local", population: "F/FS" } });
  assert.match(html, /F\/FS/);
  assert.match(html, /本地规则换算/);
});
