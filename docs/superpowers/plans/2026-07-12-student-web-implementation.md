# BNBU Student Sports Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one mobile-first `/student/` Web application that places check-in first while covering dashboard, courses, grades, profile, notifications, endurance conversion, exemptions, drafts, and supplement flows.

**Architecture:** Keep the repository's zero-build vanilla JavaScript deployment model. Add an isolated ES-module student application under `frontend/student/`, with small domain, API, store, upload, and view modules; add focused student endpoints to the existing Express server for data the current API cannot supply. Real APIs are preferred, while an explicit local demo adapter provides a fully interactive acceptance fallback.

**Tech Stack:** HTML5, CSS3, browser ES modules, Node.js `node:test`, Express, MySQL2, Multer, existing static preview server.

---

## File map

```text
backend/server.js                         Extend student read APIs and mixed proof upload
backend/test/phase3-api.test.cjs          Backend contract regression coverage
database/schema.sql                       Persist sport type and mixed media URLs

frontend/student/index.html               Student entry document and CSP-compatible module boot
frontend/student/package.json             Marks student `.js` files as ES modules for browser/Node tests
frontend/student/styles.css               BNBU Material tokens and responsive student layout
frontend/student/app.js                   Route orchestration, session boot, view mounting
frontend/student/core/constants.js        Routes, nav items, sport types, limits, grade weights
frontend/student/core/utils.js            Escaping, formatting, URL safety, ID helpers
frontend/student/core/store.js            Immutable-ish state updates and local persistence
frontend/student/core/api.js              Real/demo API adapter and normalized response shapes
frontend/student/core/upload.js           Validation, preview lifecycle, progress and retry
frontend/student/data/demo-data.js        Complete deterministic student acceptance dataset
frontend/student/views/login.js           Student login and demo entry
frontend/student/views/shell.js           Top bar, first-position check-in nav, toast/dialog host
frontend/student/views/checkin.js         Tasks, submit, records, drafts, supplement UI
frontend/student/views/home.js            Hours, risk, actions, weekly plan, tasks, notices
frontend/student/views/courses.js          Course list/detail/tasks/related records
frontend/student/views/grades.js           Estimate, weights, formula, missing data, source trace
frontend/student/views/profile.js          Identity, offsets, notices, settings and logout
frontend/student/views/tools.js            Endurance conversion and exemption list/form
frontend/student/student-test.mjs          Domain, route, rendering and state tests
frontend/student/student-smoke.cjs         HTTP/security/static asset acceptance smoke
frontend/preview-server.cjs                Add `.mp4`, `.mov`, `.heic`, `.heif`, `.mjs` MIME support
frontend/README.md                         Document `/student/` entry and demo account
package.json                               Add student test and smoke scripts
```

## Task 1: Student entry, tokens, and structural smoke

**Files:**
- Create: `frontend/student/index.html`
- Create: `frontend/student/package.json`
- Create: `frontend/student/styles.css`
- Create: `frontend/student/app.js`
- Create: `frontend/student/student-smoke.cjs`
- Modify: `frontend/preview-server.cjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing static-entry smoke test**

```js
// frontend/student/student-smoke.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert.match(html, /<div id="student-app"><\/div>/);
assert.match(html, /type="module" src="\.\/app\.js"/);
assert.match(css, /--primary:\s*#165DFF/i);
assert.match(css, /--page:\s*#F5F7FA/i);
assert.match(css, /safe-area-inset-bottom/);
console.log("student static entry smoke passed");
```

- [ ] **Step 2: Run it and verify RED**

Run: `node frontend/student/student-smoke.cjs`  
Expected: FAIL with `ENOENT` for `frontend/student/index.html`.

- [ ] **Step 3: Create the minimal CSP-safe entry and visual foundation**

```html
<!-- frontend/student/index.html -->
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#165DFF">
  <title>BNBU Sports · 学生端</title>
  <link rel="stylesheet" href="./styles.css">
</head>
<body>
  <div id="student-app"></div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

```json
{"type":"module"}
```

```js
// frontend/student/app.js
const root = document.querySelector("#student-app");
root.innerHTML = '<main class="student-loading" aria-live="polite">正在加载学生端…</main>';
```

Define `styles.css` with the exact tokens `#165DFF`, `#4080FF`, `#E8F3FF`, `#F5F7FA`, `#FFFFFF`, `#1D2129`, `#4E5969`, `#86909C`, `#E5E6EB`, `#00B42A`, `#FF7D00`, and `#F53F3F`; use 8px/12px radii, 44px minimum controls, 16px mobile gutters, and a bottom bar padded by `env(safe-area-inset-bottom)`.

- [ ] **Step 4: Add scripts and preview MIME mappings**

```json
"test:student": "node --test frontend/student/student-test.mjs && node frontend/student/student-smoke.cjs",
"smoke:student": "node frontend/student/student-smoke.cjs"
```

Add `.mjs`, `.mp4`, `.mov`, `.heic`, and `.heif` to `contentTypes` in `frontend/preview-server.cjs`.

- [ ] **Step 5: Run GREEN**

Run: `npm run smoke:student`  
Expected: `student static entry smoke passed`.

- [ ] **Step 6: Commit**

```bash
git add frontend/student frontend/preview-server.cjs package.json
git commit -m "feat(student-web): scaffold mobile student entry"
```

## Task 2: Domain constants, utilities, demo data, and store

**Files:**
- Create: `frontend/student/core/constants.js`
- Create: `frontend/student/core/utils.js`
- Create: `frontend/student/core/store.js`
- Create: `frontend/student/data/demo-data.js`
- Create: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing domain and persistence tests**

```js
// frontend/student/student-test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { NAV_ITEMS, GRADE_WEIGHTS, uploadLimits } from "./core/constants.js";
import { createStore } from "./core/store.js";
import { demoWorkspace } from "./data/demo-data.js";

test("check-in is the first navigation item", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.id), ["checkin", "home", "courses", "grades", "profile"]);
});

test("grade weights total 100 percent", () => {
  assert.equal(Object.values(GRADE_WEIGHTS).reduce((sum, value) => sum + value, 0), 1);
});

test("upload limits match product contract", () => {
  assert.deepEqual(uploadLimits, { images: 6, videos: 1, imageBytes: 8 * 1024 * 1024, videoBytes: 100 * 1024 * 1024 });
});

test("store restores a saved draft", () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v), removeItem: (k) => memory.delete(k) };
  const first = createStore({ storage, initial: demoWorkspace() });
  first.saveDraft({ hours: 1.5, description: "南区操场慢跑五公里" });
  const second = createStore({ storage, initial: demoWorkspace() });
  assert.equal(second.getState().draft.hours, 1.5);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test frontend/student/student-test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `core/constants.js`.

- [ ] **Step 3: Implement stable domain contracts**

```js
// frontend/student/core/constants.js
export const NAV_ITEMS = [
  { id: "checkin", label: "打卡", route: "checkin" },
  { id: "home", label: "首页", route: "home" },
  { id: "courses", label: "课程", route: "courses" },
  { id: "grades", label: "成绩", route: "grades" },
  { id: "profile", label: "我的", route: "profile" },
];
export const GRADE_WEIGHTS = { checkin: 0.25, exam: 0.30, performance: 0.20, physical: 0.25 };
export const uploadLimits = { images: 6, videos: 1, imageBytes: 8 * 1024 * 1024, videoBytes: 100 * 1024 * 1024 };
export const SPORT_TYPES = ["running", "basketball", "football", "badminton", "swimming", "fitness", "cycling", "other"];
```

Implement `escapeHtml`, `safeProofUrl`, `formatDate`, `formatBytes`, and `uid` in `utils.js`. Implement `createStore({storage, initial})` with `getState`, `subscribe`, `patch`, `saveDraft`, `clearDraft`, `persistSession`, `clearSession`, and storage key `bnbuStudentWebV1`. `demoWorkspace()` must include one student, two courses, three tasks, five records covering all review states, four grade components, two memberships, four notifications, two exemptions, weekly plan data, and an empty upload queue.

- [ ] **Step 4: Run GREEN**

Run: `node --test frontend/student/student-test.mjs`  
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/student/core frontend/student/data frontend/student/student-test.mjs
git commit -m "feat(student-web): add domain state and demo workspace"
```

## Task 3: Backend student contracts and mixed proof upload

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/test/phase3-api.test.cjs`
- Modify: `database/schema.sql`

- [ ] **Step 1: Add failing endpoint contract tests**

Add assertions to `phase3-api.test.cjs` that inspect the server source and exercise the test server:

```js
assert.match(serverSource, /app\.get\('\/api\/student\/courses\/\:id'/);
assert.match(serverSource, /app\.get\('\/api\/student\/grades'/);
assert.match(serverSource, /video\/mp4/);
assert.match(serverSource, /video\/quicktime/);
assert.match(serverSource, /files:\s*7/);
assert.match(schemaSource, /sport_type/i);
```

- [ ] **Step 2: Run RED**

Run: `npm test --prefix backend`  
Expected: FAIL because the student course/grade endpoints, video MIME types, seven-file limit, and `sport_type` column are absent.

- [ ] **Step 3: Upgrade upload validation and response normalization**

In `server.js`, replace the image-only allowlist with:

```js
const IMAGE_MIME = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
const VIDEO_MIME = new Set(['video/mp4','video/quicktime']);
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;
```

Use Multer's 100 MB global limit and seven-file count, then reject more than six images, more than one video, or any image above 8 MB. Return:

```js
{
  files: req.files.map((file) => ({
    url: '/uploads/' + file.filename,
    mediaType: IMAGE_MIME.has(file.mimetype) ? 'image' : 'video',
    mimeType: file.mimetype,
    size: file.size,
  })),
  urls: req.files.map((file) => '/uploads/' + file.filename),
  count: req.files.length,
}
```

Update proof URL validation to accept `jpg`, `jpeg`, `png`, `webp`, `heic`, `heif`, `mp4`, and `mov`, with at most seven unique URLs.

- [ ] **Step 4: Add student course and grade read endpoints**

Implement `GET /api/student/courses/:id` scoped by `student_progress.student_id`, returning course identity, teacher, progress, tasks, and related records. Implement `GET /api/student/grades` returning raw components, weights `{checkin:.25, exam:.30, performance:.20, physical:.25}`, weighted values, missing items, source trace, and update time. Never expose another student's rows.

- [ ] **Step 5: Persist sport type**

Add `sport_type VARCHAR(32) NULL` to `sport_records` in `schema.sql`; include `sportType` in create/list/detail/supplement mappings while keeping older rows valid.

- [ ] **Step 6: Run GREEN**

Run: `npm test --prefix backend`  
Expected: all backend tests pass with zero failures.

- [ ] **Step 7: Commit**

```bash
git add backend/server.js backend/test/phase3-api.test.cjs database/schema.sql
git commit -m "feat(api): complete student sports web contracts"
```

## Task 4: API adapter, authentication, and explicit demo fallback

**Files:**
- Create: `frontend/student/core/api.js`
- Create: `frontend/student/views/login.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/app.js`

- [ ] **Step 1: Write failing normalization/auth tests**

```js
import { createStudentApi } from "./core/api.js";

test("login rejects a non-student role", async () => {
  const api = createStudentApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ token: "x", user: { role: "teacher" } }) }) });
  await assert.rejects(() => api.login("teacher", "pw"), /仅限学生账号/);
});

test("upload normalizes urls-only backend responses", async () => {
  const api = createStudentApi({ fetchImpl: async () => ({ ok: true, json: async () => ({ urls: ["/uploads/a.jpg"], count: 1 }) }) });
  const result = await api.uploadProofs([new Blob(["x"], { type: "image/jpeg" })]);
  assert.equal(result[0].url, "/uploads/a.jpg");
  assert.equal(result[0].mediaType, "image");
});
```

- [ ] **Step 2: Run RED**

Run: `node --test frontend/student/student-test.mjs`  
Expected: FAIL because `createStudentApi` is missing.

- [ ] **Step 3: Implement the API adapter**

`createStudentApi` must expose `health`, `login`, `me`, `logout`, `summary`, `tasks`, `courseDetail`, `grades`, `identity`, `notifications`, `markNotificationRead`, `uploadProofs`, `submitRecord`, `records`, `recordDetail`, `supplementRecord`, `convertEndurance`, `listExemptions`, and `submitExemption`. Every request uses same-origin `/api`, an `Authorization: Bearer` header when a token exists, JSON error messages, and a 20-second timeout except uploads.

Provide `createDemoApi({store})` with the same methods. Demo writes must mutate store data and wait deterministic short durations; every demo screen displays `演示模式（未连接后端）`.

- [ ] **Step 4: Implement login rendering and boot**

`renderLogin({onSubmit,onDemo})` must render the existing BNBU split login language: blue gradient brand panel on desktop, stacked brand panel on mobile, white 12px-radius form card, 44px inputs, and a full-width blue primary button. `app.js` restores session, verifies `/auth/me`, routes valid students to `checkin`, and otherwise mounts login.

- [ ] **Step 5: Run GREEN**

Run: `node --test frontend/student/student-test.mjs`  
Expected: auth and upload normalization tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/student/core/api.js frontend/student/views/login.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): add auth and api adapters"
```

## Task 5: Responsive shell and routing

**Files:**
- Create: `frontend/student/views/shell.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/styles.css`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing route/nav tests**

```js
import { routeFromHash } from "./app.js";
import { renderBottomNav } from "./views/shell.js";

test("unknown routes fall back to check-in", () => assert.equal(routeFromHash("#unknown").name, "checkin"));
test("bottom nav renders check-in first and all five destinations", () => {
  const html = renderBottomNav("checkin");
  assert.ok(html.indexOf("打卡") < html.indexOf("首页"));
  for (const label of ["打卡","首页","课程","成绩","我的"]) assert.match(html, new RegExp(label));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test frontend/student/student-test.mjs`  
Expected: FAIL because routing and shell exports are missing.

- [ ] **Step 3: Implement hash routing and shell**

Supported route names: `checkin`, `home`, `courses`, `course-detail`, `grades`, `profile`, `notifications`, `endurance`, `exemptions`, `exemption-new`, and `settings`. Render a sticky mobile top bar, `<main>`, toast region, modal host, and fixed bottom nav. Secondary tools use a back button and keep the five-item nav state on `profile`.

- [ ] **Step 4: Add responsive CSS**

At `max-width:600px`, use one column and fixed bottom nav. At `601–900px`, allow two-column cards. Above `900px`, center the content at 1120px and render the five-item nav as a compact top/side rail without changing order. Verify no element forces a width beyond `100vw`.

- [ ] **Step 5: Run GREEN**

Run: `node --test frontend/student/student-test.mjs`  
Expected: routing/nav tests pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/student/app.js frontend/student/views/shell.js frontend/student/styles.css frontend/student/student-test.mjs
git commit -m "feat(student-web): add responsive student shell"
```

## Task 6: Check-in-first workspace

**Files:**
- Create: `frontend/student/core/upload.js`
- Create: `frontend/student/views/checkin.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing validation and rendering tests**

```js
import { validateProofSelection, validateCheckin } from "./core/upload.js";
import { renderCheckin } from "./views/checkin.js";

test("proof selection rejects a seventh image and second video", () => {
  const image = { type: "image/jpeg", size: 1000 };
  const video = { type: "video/mp4", size: 1000 };
  assert.match(validateProofSelection([...Array(7).fill(image)]).errors.join(" "), /最多 6 张/);
  assert.match(validateProofSelection([video, video]).errors.join(" "), /最多 1 个视频/);
});

test("check-in requires proof and custom other name", () => {
  assert.match(validateCheckin({ hours: 1, sportType: "other", customSport: "", description: "南区操场慢跑", files: [] }).join(" "), /自定义运动名称/);
});

test("check-in renders tasks submit records tabs with submit active", () => {
  const html = renderCheckin({ activeTab: "submit", tasks: [], records: [], draft: {}, uploads: [] });
  for (const label of ["任务", "提交", "记录"]) assert.match(html, new RegExp(label));
  assert.match(html, /aria-selected="true"[^>]*>提交/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test frontend/student/student-test.mjs`  
Expected: FAIL because upload/check-in modules are missing.

- [ ] **Step 3: Implement uploads and drafts**

Create local preview objects with `waiting|uploading|success|failed`, revoke object URLs on removal, expose progress callbacks, retry only failed files, and prevent business submission until every valid file has a server URL. Save draft fields without raw `File` objects; explain that files must be reselected after a full browser restart.

- [ ] **Step 4: Implement task, submit, record, detail, and supplement UI**

Tasks filter by all/pending/completed. Submit supports 0.5-hour steps through 2 hours, eight sport types, 32-character custom sport, 5–300-character description, 6-image/1-video picker, previews, delete, progress, save draft, clear, and second confirmation. Records filter by status, hide system offsets, open detail, and offer supplement actions for rejected/material-needed records.

- [ ] **Step 5: Run GREEN**

Run: `npm run test:student`  
Expected: all student tests and static smoke pass.

- [ ] **Step 6: Commit**

```bash
git add frontend/student/core/upload.js frontend/student/views/checkin.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): implement check-in workspace"
```

## Task 7: Dashboard and courses

**Files:**
- Create: `frontend/student/views/home.js`
- Create: `frontend/student/views/courses.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing dashboard/course render tests**

```js
import { renderHome } from "./views/home.js";
import { renderCourses } from "./views/courses.js";

test("home contains all required sections", () => {
  const html = renderHome(demoWorkspace());
  for (const text of ["学时进度","风险提示","行动入口","周计划","近期任务","通知"]) assert.match(html, new RegExp(text));
});

test("courses display code section tasks and related records", () => {
  const workspace = demoWorkspace();
  const html = renderCourses(workspace.courses, workspace.tasks, workspace.records);
  assert.match(html, /GEPE101 \/ Section 1004/);
  assert.match(html, /课程任务/);
  assert.match(html, /相关记录/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test frontend/student/student-test.mjs`  
Expected: FAIL because home/courses modules are missing.

- [ ] **Step 3: Implement home**

Render total/course/general progress, pending count, gap and deadline risks, direct action cards, seven-day plan, three nearest tasks, and three latest notifications. Every action uses a route callback, and empty sections have useful guidance.

- [ ] **Step 4: Implement courses**

Render course cards keyed by `courseCode + Section`; course detail shows teacher, semester, required/completed hours, progress, tasks, and related records. A task action routes to check-in with `courseId` and `taskId` preselected.

- [ ] **Step 5: Run GREEN and commit**

Run: `npm run test:student`  
Expected: all tests pass.

```bash
git add frontend/student/views/home.js frontend/student/views/courses.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): add dashboard and courses"
```

## Task 8: Transparent grades

**Files:**
- Create: `frontend/student/views/grades.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing grade calculation tests**

```js
import { calculateGrade, renderGrades } from "./views/grades.js";

test("grade estimate uses 25 30 20 25 weights", () => {
  assert.equal(calculateGrade({ checkin: 80, exam: 90, performance: 85, physical: 70 }).total, 81.5);
});

test("grade view discloses formula missing items and sources", () => {
  const html = renderGrades({ components: { checkin: 80, exam: null, performance: 85, physical: 70 }, sources: ["教师录入", "打卡审核"] });
  for (const text of ["总分预估","25%","30%","20%","计算公式","缺失项","数据来源"]) assert.match(html, new RegExp(text));
});
```

- [ ] **Step 2: Run RED, implement, and run GREEN**

Run RED: `node --test frontend/student/student-test.mjs`  
Expected: missing grades module.

Implement a pure `calculateGrade` that preserves missing values, excludes pending check-ins from the official component, reports weighted rows and rounds the displayed total to one decimal. Render four component cards, formula expansion, missing-risk panel, source trace, and update time.

Run GREEN: `npm run test:student`  
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/student/views/grades.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): add transparent grade estimate"
```

## Task 9: Profile, offsets, notifications, settings

**Files:**
- Create: `frontend/student/views/profile.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing profile/notification tests**

```js
import { filterNotifications, renderProfile } from "./views/profile.js";

test("notification unread filter returns only unread items", () => {
  assert.ok(filterNotifications(demoWorkspace().notifications, "unread").every((item) => item.isUnread));
});

test("profile exposes identity offsets notices tools settings and logout", () => {
  const html = renderProfile(demoWorkspace());
  for (const text of ["学生身份","校队 / 社团抵扣","通知","耐力跑成绩换算","免测申请","设置","退出登录"]) assert.match(html, new RegExp(text));
});
```

- [ ] **Step 2: Run RED, implement, and run GREEN**

Run RED: `node --test frontend/student/student-test.mjs`.

Implement identity header, offset cards with valid/available status, notification list with all/unread/review filters, detail view, mark-read and batched all-read, settings with reduced-motion preference, demo reset confirmation, and logout session cleanup.

Run GREEN: `npm run test:student`.

- [ ] **Step 3: Commit**

```bash
git add frontend/student/views/profile.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): add profile offsets and notifications"
```

## Task 10: Endurance conversion and exemptions

**Files:**
- Create: `frontend/student/views/tools.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`

- [ ] **Step 1: Write failing tool tests**

```js
import { validateRunTime, validateExemption, renderEndurance, renderExemptions } from "./views/tools.js";

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
```

- [ ] **Step 2: Run RED, implement, and run GREEN**

Run RED: `node --test frontend/student/student-test.mjs`.

Implement gender-derived 800m/1000m selection, minute/second numeric validation, API/local fallback result with score/tier/rule label, exemption tabs for list/new, reason validation, shared proof uploader, duplicate-pending prevention, confirmation, and result status cards.

Run GREEN: `npm run test:student`.

- [ ] **Step 3: Commit**

```bash
git add frontend/student/views/tools.js frontend/student/app.js frontend/student/student-test.mjs
git commit -m "feat(student-web): add endurance and exemption tools"
```

## Task 11: Full verification, visual QA, and handoff docs

**Files:**
- Modify: `frontend/README.md`
- Create: `docs/STUDENT_WEB_ACCEPTANCE.md`
- Modify: `frontend/student/student-smoke.cjs`

- [ ] **Step 1: Extend HTTP smoke to the student entry**

Make `student-smoke.cjs` request `WEB_URL + /student/index.html`, assert status 200, CSP, `nosniff`, `DENY`, module asset 200, stylesheet 200, and a 404 traversal probe.

- [ ] **Step 2: Run complete automated verification**

Run:

```bash
npm run test:student
npm run test:web
npm run test:api
```

Expected: every command exits 0 with zero failures.

- [ ] **Step 3: Run the preview and browser acceptance matrix**

Run: `npm run preview` and open `http://127.0.0.1:4174/student/index.html`.

Verify at 390×844, 768×1024, and 1440×900:

```text
login → demo student → check-in submit → upload preview/progress → confirm
records → detail → supplement
home → risk action → task
courses → course detail → task prefill
grades → formula → missing/source panels
profile → offset → notifications → mark read
endurance → conversion result
exemptions → submit → list result
```

Acceptance: no horizontal overflow, no clipped buttons, no sidebar stack on mobile, no console errors, and check-in is first/default.

- [ ] **Step 4: Capture and document evidence**

Save desktop, tablet, and mobile screenshots under `docs/acceptance/student-web/`. Write `STUDENT_WEB_ACCEPTANCE.md` with commands, pass/fail counts, real API limitations, demo account/entry, screenshot links, and remaining deployment prerequisites.

- [ ] **Step 5: Commit**

```bash
git add frontend/README.md frontend/student/student-smoke.cjs docs/STUDENT_WEB_ACCEPTANCE.md docs/acceptance/student-web
git commit -m "docs(student-web): add acceptance evidence and runbook"
```

## Final verification gate

Before declaring completion, run fresh commands from `BNBU-web/`:

```bash
npm run test:student
npm run test:web
npm run test:api
git status --short
```

Required result: all three test commands exit 0; `git status --short` contains no unintended files; `/student/` has verified screenshots at all three target viewports; the acceptance document distinguishes real API results from demo-mode results.
