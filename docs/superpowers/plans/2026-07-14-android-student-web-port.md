# Android Student Web Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `frontend/student/` into a responsive Web counterpart of the Android student app while preserving the existing static SPA, demo mode, upload flow, and future API boundaries.

**Architecture:** Keep the existing ES Modules application and central store. Add focused pure-render modules for dashboard, notifications, privacy, icons, and theme behavior; extend `createStudentApp` only for orchestration and event handling. CSS custom properties reproduce Android Material 3 light/dark tokens across mobile, tablet, and desktop without adding a framework.

**Tech Stack:** HTML5, CSS custom properties, native JavaScript ES Modules, Node.js built-in test runner, Playwright smoke tests already used by the repository.

---

### Task 1: Restore Android Information Architecture

**Files:**
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/core/constants.js`
- Modify: `frontend/student/views/shell.js`
- Modify: `frontend/student/app.js`

- [ ] **Step 1: Write failing route and navigation tests**

Add tests that require the Android tab order, dashboard default, and dashboard title:

```js
test("student navigation matches Android tab order", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.id), ["home", "courses", "checkin", "grades", "profile"]);
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), ["首页", "课程", "打卡", "成绩", "我的"]);
});

test("empty and unknown routes fall back to dashboard", () => {
  assert.equal(routeFromHash("").name, "home");
  assert.equal(routeFromHash("#unknown").name, "home");
});

test("bottom navigation renders all Android destinations", () => {
  const html = renderBottomNav("home");
  for (const label of ["首页", "课程", "打卡", "成绩", "我的"]) assert.match(html, new RegExp(label));
  assert.ok(html.indexOf("首页") < html.indexOf("打卡"));
});
```

- [ ] **Step 2: Run tests and verify the information-architecture tests fail**

Run: `npm run test:student`

Expected: failures showing the current three-item dock and `checkin` fallback.

- [ ] **Step 3: Implement Android navigation and dashboard routing**

Replace `NAV_ITEMS` with five semantic icon keys:

```js
export const NAV_ITEMS = [
  { id: "home", label: "首页", route: "home", icon: "home" },
  { id: "courses", label: "课程", route: "courses", icon: "courses" },
  { id: "checkin", label: "打卡", route: "checkin", icon: "checkin" },
  { id: "grades", label: "成绩", route: "grades", icon: "grades" },
  { id: "profile", label: "我的", route: "profile", icon: "profile" },
];
```

Add `home` to `ROUTES`, make `routeFromHash` fall back to `home`, set the title to `首页`, route successful and demo logins to `home`, and remove the detached floating check-in action from `renderShell`.

- [ ] **Step 4: Run tests and verify navigation is green**

Run: `npm run test:student`

Expected: navigation and route tests pass; dashboard-render tests may still be absent.

- [ ] **Step 5: Commit the information architecture**

```bash
git add frontend/student/student-test.mjs frontend/student/core/constants.js frontend/student/views/shell.js frontend/student/app.js
git commit -m "feat(student-web): restore Android navigation structure"
```

### Task 2: Add Material 3 Theme and SVG Icon Foundation

**Files:**
- Create: `frontend/student/core/icons.js`
- Create: `frontend/student/core/theme.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/views/shell.js`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing theme and icon tests**

```js
import { icon } from "./core/icons.js";
import { normalizeTheme, resolvedTheme } from "./core/theme.js";

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
```

- [ ] **Step 2: Run tests and verify missing modules fail**

Run: `npm run test:student`

Expected: module-not-found failures for `core/icons.js` and `core/theme.js`.

- [ ] **Step 3: Implement icon and theme helpers**

`core/theme.js` must export deterministic helpers and one DOM side effect:

```js
export function normalizeTheme(value) {
  return ["light", "dark", "system"].includes(value) ? value : "light";
}

export function resolvedTheme(value, systemDark = false) {
  const mode = normalizeTheme(value);
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

export function applyTheme(value, documentRef = globalThis.document, matchMediaRef = globalThis.matchMedia) {
  const media = typeof matchMediaRef === "function" ? matchMediaRef("(prefers-color-scheme: dark)") : null;
  const result = resolvedTheme(value, Boolean(media?.matches));
  if (documentRef?.documentElement) documentRef.documentElement.dataset.theme = result;
  return result;
}
```

`core/icons.js` must map `home`, `courses`, `checkin`, `grades`, `profile`, `notifications`, `back`, `close`, `refresh`, `moon`, and `shield` to consistent 24px outlined SVG paths and return an empty string for unknown keys.

- [ ] **Step 4: Replace CSS tokens and navigation characters**

Define Android-aligned light tokens under `:root` and dark tokens under `:root[data-theme="dark"]`:

```css
:root {
  --primary: #1A73E8;
  --on-primary: #FFFFFF;
  --primary-container: #D3E3FD;
  --on-primary-container: #041E49;
  --secondary: #FD7E14;
  --tertiary: #00897B;
  --page: #F8F9FA;
  --surface: #FFFFFF;
  --surface-variant: #F1F3F9;
  --text: #202124;
  --body: #44474E;
  --muted: #5F6368;
  --outline: #747775;
  --border: rgba(116,119,117,.28);
  --danger: #D93025;
  --error-container: #F9DEDC;
}

:root[data-theme="dark"] {
  --primary: #8AB4F8;
  --on-primary: #062E6F;
  --primary-container: #0842A0;
  --on-primary-container: #D3E3FD;
  --page: #0F172A;
  --surface: #1E2433;
  --surface-variant: #2A3142;
  --text: #E2E2E3;
  --body: #C4C6D0;
  --muted: #AEB3C0;
  --outline: #8E918F;
  --border: rgba(142,145,143,.35);
  --danger: #FFB4AB;
  --error-container: #93000A;
}
```

Update `renderBottomNav` to call `icon(item.icon)` and remove the old `strong` character icons.

- [ ] **Step 5: Run tests and commit the visual foundation**

Run: `npm run test:student`

Expected: all student tests pass.

```bash
git add frontend/student/core/icons.js frontend/student/core/theme.js frontend/student/student-test.mjs frontend/student/views/shell.js frontend/student/styles.css
git commit -m "feat(student-web): add Material theme and icon system"
```

### Task 3: Build Android Dashboard and Loading Status

**Files:**
- Create: `frontend/student/views/dashboard.js`
- Modify: `frontend/student/data/demo-data.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing dashboard behavior tests**

```js
import { dashboardRisk, renderDashboard } from "./views/dashboard.js";

test("dashboard derives Android progress and actionable risk", () => {
  const workspace = demoWorkspace();
  const html = renderDashboard(workspace);
  for (const text of ["学时进度", "课程相关", "其他运动", "重点计划", "近期任务"]) assert.match(html, new RegExp(text));
  assert.match(html, /data-action="open-notifications"/);
});

test("dashboard prioritizes supplement records over generic hour gaps", () => {
  const risk = dashboardRisk({ records: [{ status: "需补材料" }], summary: { courseHours: 9, generalHours: 9, rule: { courseRequired: 10, generalRequired: 10 } } });
  assert.equal(risk.route, "checkin");
  assert.match(risk.message, /补交/);
});
```

- [ ] **Step 2: Run tests and verify the dashboard module is missing**

Run: `npm run test:student`

Expected: module-not-found failure for `views/dashboard.js`.

- [ ] **Step 3: Implement pure dashboard derivation and rendering**

Create `dashboardRisk(state)` with this priority: supplement records, course gap, general gap, all complete. Create `renderDashboard(state)` with greeting, notification action, one progress card, risk card, focus-plan rows, and up to three recent active tasks. Use `escapeHtml` for all user-derived text and `Math.max(0, requirement - completed)` for gaps.

- [ ] **Step 4: Wire dashboard and cached-data banner**

Import `renderDashboard` in `app.js`, render it for `home`, and add state fields `isShowingCachedData` and `syncError`. Pass a sync banner to `renderShell` when either field is present, with `data-action="retry-sync"`.

- [ ] **Step 5: Add dashboard responsive CSS and verify tests**

Add `.dashboard-grid`, `.progress-hero`, `.progress-split`, `.risk-panel`, and `.focus-list` styles. Use one column on phones, two columns above 720px, and ensure card backgrounds use theme tokens.

Run: `npm run test:student`

Expected: all student tests pass.

- [ ] **Step 6: Commit dashboard work**

```bash
git add frontend/student/views/dashboard.js frontend/student/data/demo-data.js frontend/student/app.js frontend/student/student-test.mjs frontend/student/styles.css
git commit -m "feat(student-web): add Android dashboard"
```

### Task 4: Align Courses, Grades, and Profile Content

**Files:**
- Modify: `frontend/student/views/courses.js`
- Modify: `frontend/student/views/grades.js`
- Modify: `frontend/student/views/profile.js`
- Modify: `frontend/student/data/demo-data.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing content-parity tests**

```js
test("courses separate current and historical semesters", () => {
  const workspace = demoWorkspace();
  const html = renderCourses(workspace.courses, workspace.tasks, workspace.records);
  assert.match(html, /当前学期课程/);
  assert.match(html, /历史课程/);
  assert.match(html, /任课老师/);
});

test("profile exposes teacher identity organization and Android tools", () => {
  const html = renderProfile(demoWorkspace());
  for (const text of ["任课老师", "校队 / 社团认证", "耐力跑成绩换算", "免测与免打卡", "隐私政策"]) assert.match(html, new RegExp(text));
});

test("grade page keeps the four Android weighted components", () => {
  const html = renderGrades(demoWorkspace().grades);
  for (const text of ["体育打卡", "专项考试", "平时表现", "体测", "计算公式", "数据来源"]) assert.match(html, new RegExp(text));
});
```

- [ ] **Step 2: Run tests and verify course/profile parity fails**

Run: `npm run test:student`

Expected: failures for historical courses, teacher panel, and privacy entry.

- [ ] **Step 3: Extend demo data with explicit semester and teacher facts**

Add one archived course with `semesterStatus: "archived"`, keep current courses with `semesterStatus: "current"`, and add:

```js
teacher: {
  name: "陈老师",
  title: "大学体育任课教师",
  email: "pe@bnbu.edu.cn",
}
```

- [ ] **Step 4: Implement current/history course grouping and profile panels**

Render current courses directly and historical courses inside an accessible `<details>` block. Add teacher and organization panels to `renderProfile`; change the exemption label to `免测与免打卡`; add privacy and inline settings entries. Keep all existing endurance, notification, reset, and logout actions.

- [ ] **Step 5: Refine grade and cross-page card styles**

Replace inline legacy spacing with `.course-card`, `.course-history`, `.teacher-card`, `.identity-grid`, and `.grade-component-grid`; retain calculation behavior unchanged.

- [ ] **Step 6: Run tests and commit page parity**

Run: `npm run test:student`

Expected: all student tests pass.

```bash
git add frontend/student/views/courses.js frontend/student/views/grades.js frontend/student/views/profile.js frontend/student/data/demo-data.js frontend/student/student-test.mjs frontend/student/styles.css
git commit -m "feat(student-web): align course grade and profile pages"
```

### Task 5: Align Check-In Workspace Without Regressing Uploads

**Files:**
- Modify: `frontend/student/views/checkin.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing Android check-in interaction tests**

```js
test("check-in renders Android task filters and sport selector", () => {
  const workspace = demoWorkspace();
  const html = renderCheckin({ activeTab: "submit", tasks: workspace.tasks, records: workspace.records, draft: workspace.draft });
  assert.match(html, /data-task-filter="all"/);
  assert.match(html, /data-sport-type="running"/);
  assert.match(html, /本次学时/);
});

test("check-in retains draft supplement and media behavior", () => {
  const workspace = demoWorkspace();
  const html = renderCheckin({ activeTab: "records", records: workspace.records, draft: { updatedAt: new Date().toISOString() } });
  assert.match(html, /本地草稿/);
  assert.match(html, /需补材料/);
  assert.match(html, /record-thumb/);
});
```

- [ ] **Step 2: Run tests and verify missing task/sport controls fail**

Run: `npm run test:student`

Expected: failures for `data-task-filter` and `data-sport-type`.

- [ ] **Step 3: Implement explicit UI state for filters and expanded sports**

Extend `ui` with:

```js
taskFilter: "all",
recordFilter: "all",
showAllSports: false,
```

Filter rendered tasks and records in `app.js`. Handle `data-task-filter`, `data-record-filter`, `data-sport-type`, and `data-action="toggle-sports"` without changing upload or submission payloads.

- [ ] **Step 4: Rework check-in markup to Android component hierarchy**

Use segmented controls for tasks/submit/records, tonal filter chips, a selected-task panel, 0.5-hour stepper, icon-based sport option grid, note editor, upload panel, draft card, submit summary, and record media grid. Keep `validateCheckin`, `validateProofSelection`, upload retry, object URL release, confirmation, and supplement paths intact.

- [ ] **Step 5: Add mobile and desktop form layout rules**

Use a 680px form column on desktop, two-column sport choices above 600px, two-column task/record layouts above 900px, and a single column on phones. Keep every interactive control at least 44px.

- [ ] **Step 6: Run student tests and check upload regressions**

Run: `npm run test:student`

Expected: all validation, upload, draft, task, and media tests pass.

- [ ] **Step 7: Commit check-in alignment**

```bash
git add frontend/student/views/checkin.js frontend/student/app.js frontend/student/student-test.mjs frontend/student/styles.css
git commit -m "feat(student-web): align Android check-in workspace"
```

### Task 6: Add Notification Drawer, Privacy, and Theme Settings

**Files:**
- Create: `frontend/student/views/notifications.js`
- Create: `frontend/student/views/privacy.js`
- Modify: `frontend/student/views/profile.js`
- Modify: `frontend/student/views/shell.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing notification, privacy, and setting tests**

```js
import { renderNotificationDrawer } from "./views/notifications.js";
import { renderPrivacyPolicy } from "./views/privacy.js";

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

test("profile theme settings expose light dark and system", () => {
  const html = renderProfile(demoWorkspace());
  for (const value of ["light", "dark", "system"]) assert.match(html, new RegExp(`value="${value}"`));
});
```

- [ ] **Step 2: Run tests and verify new modules/settings fail**

Run: `npm run test:student`

Expected: module-not-found failures for notification and privacy views.

- [ ] **Step 3: Implement the bottom drawer and privacy view**

Create a fixed overlay with scrim, `role="dialog"`, `aria-modal="true"`, list/detail states, close and back actions, filters, and mark-read controls. Create a standalone privacy page with the six sections from the Android source and a profile back action.

- [ ] **Step 4: Wire drawer state, keyboard close, and theme persistence**

Extend `ui` with `notificationOpen` and `selectedNoticeId`. Open the drawer from dashboard/header/profile, close on scrim, close button, or Escape, and mark selected notifications read. Handle `data-setting="themeMode"` by persisting settings and calling `applyTheme`; subscribe to system theme changes only while mode is `system`.

- [ ] **Step 5: Style drawer, theme selector, and privacy typography**

Use a 28px top radius on phone drawers, a maximum 720px width on desktop, a 70vh list area, visible focus styles, and dark-token-compatible surfaces.

- [ ] **Step 6: Run tests and commit secondary surfaces**

Run: `npm run test:student`

Expected: all student tests pass.

```bash
git add frontend/student/views/notifications.js frontend/student/views/privacy.js frontend/student/views/profile.js frontend/student/views/shell.js frontend/student/app.js frontend/student/student-test.mjs frontend/student/styles.css
git commit -m "feat(student-web): add notifications privacy and themes"
```

### Task 7: Complete Endurance and Exemption Parity

**Files:**
- Modify: `frontend/student/views/tools.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/core/api.js`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/styles.css`

- [ ] **Step 1: Write failing detail and supplement tests**

```js
test("exemption list links to detail and supplement actions", () => {
  const item = { id: "ex-1", type: "800m", reason: "伤病恢复期", status: "需补材料", proofFiles: [], createdAt: new Date().toISOString(), reviewComment: "补交诊断证明" };
  const html = renderExemptions([item]);
  assert.match(html, /data-exemption-id="ex-1"/);
  assert.match(html, /补交证明/);
});

test("endurance result explains population and rule source", () => {
  const html = renderEndurance({ student: { gender: "female", genderLabel: "女", gradeLabel: "大一" }, result: { score: 88, tier: "good", timeSeconds: 225, source: "local", population: "F/FS" } });
  assert.match(html, /F\/FS/);
  assert.match(html, /本地规则换算/);
});
```

- [ ] **Step 2: Run tests and verify missing detail/supplement behavior fails**

Run: `npm run test:student`

Expected: failures for detail links, supplement action, or population trace.

- [ ] **Step 3: Add exemption detail and supplement rendering**

Support `exemption/:id` route, render organization, reason, time, proof list, status, reviewer comment, and a supplement button when status is `需补材料` or `已驳回`. Reuse the existing proof picker and upload adapter; supplement payload must contain the selected proof URLs and target exemption ID.

- [ ] **Step 4: Add API boundary without database dependency**

Add `supplementExemption(id, proofFiles)` to both APIs. The real adapter should call `PUT /student/exemptions/:id/supplement`; the demo adapter should update the in-memory record to `待审核`. No server or schema changes are part of this task.

- [ ] **Step 5: Expand endurance trace and validation copy**

Show gender, grade population, distance, input time, score tier, and whether the result came from the server or complete local fallback table.

- [ ] **Step 6: Run tests and commit tool parity**

Run: `npm run test:student`

Expected: all student tests pass.

```bash
git add frontend/student/views/tools.js frontend/student/app.js frontend/student/core/api.js frontend/student/student-test.mjs frontend/student/styles.css
git commit -m "feat(student-web): complete scoring and exemption parity"
```

### Task 8: Expand Browser Smoke Tests and Capture Acceptance Evidence

**Files:**
- Modify: `frontend/student/student-smoke.cjs`
- Modify: `docs/STUDENT_WEB_ACCEPTANCE.md`
- Create: `docs/acceptance/student-web/android-port-mobile-home.png`
- Create: `docs/acceptance/student-web/android-port-mobile-checkin.png`
- Create: `docs/acceptance/student-web/android-port-mobile-profile-dark.png`
- Create: `docs/acceptance/student-web/android-port-tablet-courses.png`
- Create: `docs/acceptance/student-web/android-port-desktop-home.png`
- Create: `docs/acceptance/student-web/android-port-desktop-checkin.png`

- [ ] **Step 1: Write failing smoke assertions for the full Android surface**

Extend the smoke script to assert the five navigation labels, dashboard default, notification drawer, every root page, privacy, endurance, exemption, light/dark theme switch, and no horizontal overflow at `390x844`, `768x1024`, and `1440x900`.

```js
const routes = ["home", "courses", "checkin", "grades", "profile"];
for (const route of routes) {
  await page.locator(`[data-route="${route}"]`).last().click();
  await page.waitForTimeout(120);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`${route} overflows horizontally by ${overflow}px`);
}
```

- [ ] **Step 2: Run smoke tests and verify new checks expose remaining gaps**

Run in terminal 1: `npm run preview`

Run in terminal 2: `$env:STUDENT_WEB_URL='http://127.0.0.1:4174/student/index.html'; npm run smoke:student`

Expected: any unimplemented route, theme, drawer, or overflow check fails with the responsible page name.

- [ ] **Step 3: Fix only smoke-discovered layout or accessibility issues**

For each failure, add a minimal regression assertion to `student-test.mjs` when it is behavioral, then adjust the responsible view or CSS. Do not weaken the smoke assertion or increase the overflow tolerance.

- [ ] **Step 4: Capture acceptance screenshots**

Use the smoke browser to save the six named screenshots after entering demo mode and waiting for fonts/layout to settle. Each screenshot must show the page title, relevant Android-aligned content, and navigation where applicable.

- [ ] **Step 5: Update acceptance documentation**

Document the preview URL, demo entry, five root pages, secondary features, three viewport sizes, theme coverage, API boundary, screenshot paths, and the explicit limitation that production database integration is deferred.

- [ ] **Step 6: Run smoke tests again and commit evidence**

Run: `$env:STUDENT_WEB_URL='http://127.0.0.1:4174/student/index.html'; npm run smoke:student`

Expected: smoke suite exits 0 and reports each viewport.

```bash
git add frontend/student/student-smoke.cjs docs/STUDENT_WEB_ACCEPTANCE.md docs/acceptance/student-web/android-port-*.png
git commit -m "test(student-web): add Android port acceptance evidence"
```

### Task 9: Full Regression and Delivery Audit

**Files:**
- Modify only if a fresh regression test identifies a defect.

- [ ] **Step 1: Run the complete automated suite**

```powershell
npm run test:student
npm run test:web
npm run test:api
```

Expected: every command exits 0 with zero failures.

- [ ] **Step 2: Run the production-style static preview smoke**

Run in terminal 1: `npm run preview`

Run in terminal 2:

```powershell
$env:STUDENT_WEB_URL='http://127.0.0.1:4174/student/index.html'
npm run smoke:student
```

Expected: all root/secondary routes, themes, dialogs, and viewport overflow checks pass.

- [ ] **Step 3: Audit the design requirement by requirement**

Verify from current files and rendered evidence:

- native JS SPA remains in `frontend/student/`;
- no backend database/schema file changed;
- API Adapter, uploads, session, drafts, and demo mode remain;
- five Android root destinations and dashboard default are present;
- dashboard, notification drawer, courses, check-in, grades, profile, endurance, exemption, privacy, and themes are functional;
- mobile, tablet, and desktop screenshots exist;
- acceptance documentation states that production database integration is deferred.

- [ ] **Step 4: Check repository state and diff quality**

Run:

```powershell
git status --short
git diff --check HEAD~8..HEAD
git log -10 --oneline --decorate
```

Expected: no whitespace errors; only pre-existing user-owned untracked paths remain outside committed work.

- [ ] **Step 5: Commit any verification-only corrections**

If verification required a correction, stage only the responsible files and commit with a narrow message. If no correction was required, do not create an empty commit.

