import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, GRADE_WEIGHTS, uploadLimits } from "./core/constants.js";
import { createStore } from "./core/store.js";
import { demoWorkspace } from "./data/demo-data.js";
import { createStudentApi } from "./core/api.js";
import { routeFromHash } from "./app.js";
import { renderBottomNav } from "./views/shell.js";

test("check-in is the first navigation item", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.id), ["checkin", "home", "courses", "grades", "profile"]);
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

test("unknown routes fall back to check-in", () => {
  assert.equal(routeFromHash("#unknown").name, "checkin");
});

test("bottom nav renders check-in first and all five destinations", () => {
  const html = renderBottomNav("checkin");
  assert.ok(html.indexOf("打卡") < html.indexOf("首页"));
  for (const label of ["打卡", "首页", "课程", "成绩", "我的"]) assert.match(html, new RegExp(label));
});
