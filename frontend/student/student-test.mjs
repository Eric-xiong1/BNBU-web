import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, GRADE_WEIGHTS, uploadLimits } from "./core/constants.js";
import { createStore } from "./core/store.js";
import { demoWorkspace } from "./data/demo-data.js";
import { createStudentApi } from "./core/api.js";
import { routeFromHash } from "./app.js";
import { renderBottomNav, renderShell } from "./views/shell.js";
import { validateProofSelection, validateCheckin } from "./core/upload.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { renderCourses } from "./views/courses.js";
import { calculateGrade, renderGrades } from "./views/grades.js";
import { filterNotifications, renderProfile } from "./views/profile.js";
import { validateRunTime, validateExemption, renderEndurance, renderExemptions } from "./views/tools.js";
import { safeProofUrl } from "./core/utils.js";

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

test("bottom navigation renders all Android destinations", () => {
  const dock = renderBottomNav("home");
  for (const label of ["首页", "课程", "打卡", "成绩", "我的"]) assert.match(dock, new RegExp(label));
  assert.ok(dock.indexOf("首页") < dock.indexOf("打卡"));
  const shell = renderShell({ active: "checkin", content: "<p>内容</p>" });
  assert.doesNotMatch(shell, /checkin-action/);
  assert.match(shell, /bottom-nav/);
});

test("proof selection rejects a seventh image and second video", () => {
  const image = { type: "image/jpeg", size: 1000 };
  const video = { type: "video/mp4", size: 1000 };
  assert.match(validateProofSelection([...Array(7).fill(image)]).errors.join(" "), /最多 6 张/);
  assert.match(validateProofSelection([video, video]).errors.join(" "), /最多 1 个视频/);
});

test("check-in requires proof and custom other name", () => {
  const errors = validateCheckin({ hours: 1, sportType: "other", customSport: "", description: "南区操场慢跑", files: [] });
  assert.match(errors.join(" "), /自定义运动名称/);
  assert.match(errors.join(" "), /至少上传/);
});

test("check-in renders tasks submit records tabs with submit active", () => {
  const html = renderCheckin({ activeTab: "submit", tasks: [], records: [], draft: {}, uploads: [] });
  for (const label of ["任务", "提交", "记录"]) assert.match(html, new RegExp(label));
  assert.match(html, /aria-selected="true"[^>]*>提交/);
});

test("record list renders the first valid proof thumbnail and remaining count", () => {
  const html = renderCheckin({ activeTab: "records", records: [{ id: "r1", sportType: "running", hours: 1, status: "待审核", submittedAt: new Date().toISOString(), proofFiles: ["javascript:bad", "/uploads/run-a.jpg", "/uploads/run-b.jpg"] }] });
  assert.match(html, /class="record-thumb/);
  assert.match(html, /<img[^>]+src="\/uploads\/run-a\.jpg"[^>]+loading="eager"/);
  assert.match(html, /class="proof-count">\+1/);
  assert.doesNotMatch(html, /javascript:bad/);
});

test("record list distinguishes video and missing-proof fallbacks", () => {
  const video = renderCheckin({ activeTab: "records", records: [{ id: "v1", sportType: "fitness", hours: 1, status: "已通过", submittedAt: new Date().toISOString(), proofFiles: ["/uploads/workout.mp4"] }] });
  assert.match(video, /<video[^>]+src="\/uploads\/workout\.mp4"/);
  assert.match(video, /class="record-thumb-play"/);
  const missing = renderCheckin({ activeTab: "records", records: [{ id: "m1", sportType: "badminton", hours: 1, status: "已驳回", submittedAt: new Date().toISOString(), proofFiles: [] }] });
  assert.match(missing, /class="record-thumb record-thumb-fallback"/);
  assert.match(missing, /羽毛球/);
});

test("record detail previews all image and video proofs", () => {
  const html = renderRecordDetail({ id: "r1", sportType: "running", hours: 1, status: "待审核", submittedAt: new Date().toISOString(), proofFiles: ["/uploads/run.jpg", "/uploads/run.mp4"] });
  assert.match(html, /<img[^>]+src="\/uploads\/run\.jpg"/);
  assert.match(html, /<video[^>]+src="\/uploads\/run\.mp4"[^>]+controls/);
});

test("courses display code section tasks and related records", () => {
  const workspace = demoWorkspace();
  const html = renderCourses(workspace.courses, workspace.tasks, workspace.records);
  assert.match(html, /GEPE101 \/ Section 1004/);
  assert.match(html, /课程任务/);
  assert.match(html, /相关记录/);
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
