import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the streamlined unified sign-in page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>BNBU 体育课程管理平台<\/title>/i);
  assert.match(html, /体育课程管理平台/);
  assert.match(html, /登录管理平台/);
  assert.match(html, /\/branding\/sports-logo\.png/);
  assert.doesNotMatch(html, /一个入口|职责隔离|管理员工作台|登录并进入工作台/);
  assert.doesNotMatch(html, /\/bnbu-emblem\.svg/);
  assert.doesNotMatch(html, /教师端演示|管理员端演示/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("keeps the supplied logo and unified authentication flow on the login surface", async () => {
  const [app, css, language] = await Promise.all([
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/language.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal((app.match(/\/branding\/sports-logo\.png/g) ?? []).length, 1);
  assert.match(app, /await passwordLogin\(trimmedAccount, password\)/);
  assert.match(app, /await requestAccountRecovery\(/);
  assert.match(app, /await completeAccountRecovery\(/);
  assert.match(app, /setWorkspaceMode\("real"\)/);
  assert.doesNotMatch(app, /IS_DEMO_ENVIRONMENT|onDemoLogin|demoUsers|demoSession/);
  assert.match(app, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(app, /aria-label="显示或隐藏密码"/);
  assert.match(app, /disabled=\{isSubmitting\}/);
  assert.doesNotMatch(app, /className="login-intro"|className="demo-grid"/);
  assert.match(css, /\.login-logo\s*\{[^}]*object-fit:\s*contain/);
  assert.doesNotMatch(css, /\.login-intro|\.demo-grid|\.role-principles/);
  assert.match(language, /["']?登录管理平台["']?:\s*"Sign in to the Management Platform"/);
  assert.match(
    language,
    /["']?系统将根据账号权限自动进入对应工作台["']?:\s*"You will be directed to the appropriate workspace based on your account permissions\."/,
  );
});

test("keeps role responsibilities and semantic theme tokens in source", async () => {
  const [app, css, page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /教师空间/);
  assert.match(app, /管理空间/);
  assert.match(app, /打卡审核/);
  assert.match(app, /NORMAL/);
  assert.match(css, /--color-primary:\s*#007aff/i);
  assert.match(css, /--color-primary:\s*#0a84ff/i);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(page, /PortalApp/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});

test("uses a same-origin API default with an explicit local development proxy", async () => {
  const [apiClient, viteConfig] = await Promise.all([
    readFile(new URL("../app/api-client.ts", import.meta.url), "utf8"),
    readFile(new URL("../vite.config.ts", import.meta.url), "utf8"),
  ]);

  assert.match(apiClient, /const DEFAULT_BASE = "\/api\/v1"/);
  assert.doesNotMatch(apiClient, /const DEFAULT_BASE = "http:\/\/127\.0\.0\.1:3000/);
  assert.match(viteConfig, /"\/api\/v1"/);
  assert.match(viteConfig, /BNBU_LOCAL_BACKEND_ORIGIN/);
  assert.match(viteConfig, /http:\/\/127\.0\.0\.1:3000/);
});

test("keeps teacher and admin sidebars resizable, collapsible, and locally persisted", async () => {
  const [app, css, workspaceCss, sidebarController] = await Promise.all([
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.css", import.meta.url), "utf8"),
    readFile(new URL("../app/use-resizable-sidebar.ts", import.meta.url), "utf8"),
  ]);

  assert.match(app, /"--sidebar-width": `\$\{sidebarWidth\}px`/);
  assert.match(app, /useResizableSidebar\(role \?\? "teacher"\)/);
  assert.match(sidebarController, /SIDEBAR_COLLAPSED_WIDTH\s*=\s*84/);
  assert.match(sidebarController, /SIDEBAR_MIN_WIDTH\s*=\s*240/);
  assert.match(sidebarController, /SIDEBAR_MAX_WIDTH\s*=\s*320/);
  assert.match(sidebarController, /SIDEBAR_TRANSITION_MS\s*=\s*260/);
  assert.match(sidebarController, /requestAnimationFrame\(applyDragFrame\)/);
  assert.match(sidebarController, /setPointerCapture\(event\.pointerId\)/);
  assert.match(sidebarController, /releasePointerCapture/);
  assert.match(sidebarController, /teacher:\s*"bnbu-teacher-sidebar"/);
  assert.match(sidebarController, /admin:\s*"bnbu-admin-sidebar"/);
  assert.match(sidebarController, /JSON\.stringify\(sidebarStates\[sidebarRole\]\)/);
  assert.match(app, /title=\{isSidebarCollapsed \? item\.label : undefined\}/);
  assert.match(app, /className="sidebar-collapse-button"/);
  assert.match(workspaceCss, /--sidebar-content-visibility/);
  assert.match(workspaceCss, /max-inline-size:\s*calc\(220px \* var\(--sidebar-content-visibility\)\)/);
  assert.match(css, /\.app-shell\.is-resizing-sidebar\s*\{\s*transition:\s*none;/);
  assert.match(css, /--sidebar-transition-duration:\s*260ms/);
  assert.doesNotMatch(workspaceCss, /grid-template-columns:\s*(?:220|232)px\s+minmax\(0,\s*1fr\)/);
  assert.ok(
    (workspaceCss.match(/grid-template-columns:\s*var\(--sidebar-width\)\s+minmax\(0,\s*1fr\)/g) ?? []).length >= 3,
    "workspace layout overrides must preserve the live sidebar width",
  );
});

test("keeps teacher overview metrics single-sourced and separate from status filters", async () => {
  const [app, workspace, ui, teacherCss] = await Promise.all([
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.css", import.meta.url), "utf8"),
  ]);

  assert.match(ui, /export function PageHeader/);
  assert.match(ui, /export function PageSummaryMetrics/);
  assert.match(ui, /export function SummaryMetric/);
  assert.match(ui, /export function StatusFilterTabs/);
  assert.match(app, /workspace-header-focused/);
  assert.doesNotMatch(app, /teacherPageMetrics/);
  assert.doesNotMatch(app, /待查看学生|申请总数|今日逾期/);
  assert.doesNotMatch(app, /id: "joinRequests"|label: "入班审核"/);
  assert.doesNotMatch(app, /grades:\s*\[\{\s*value:/);

  assert.match(workspace, /label: "未达标人数"/);
  assert.match(workspace, /ariaLabel="课程管理核心统计"/);
  assert.match(workspace, /label: "教学班"/);
  assert.match(workspace, /label: "在班学生"/);
  assert.match(workspace, /label: "近 24 小时加入"/);
  assert.match(workspace, /joinedWithinLast24Hours/);
  assert.match(
    workspace,
    /students\.filter\(\s*\(student\)\s*=>\s*student\.status === "active",?\s*\)\.length/,
  );
  assert.doesNotMatch(workspace, /pendingRequests\.length|renderJoinRequests|join-review/);
  assert.match(workspace, /label: "打卡记录"/);
  assert.match(workspace, /label: "待审核记录"/);
  assert.match(workspace, /label: "已标记无效"/);
  assert.match(workspace, /label: "涉及学生"/);
  assert.match(workspace, /label: "需要关注记录"/);
  assert.match(workspace, /label: "全部申请"/);
  // Contract 2.0.2: the queue and the headline both read the server's review
  // result. Inferring "unreviewed" from a missing comment would be a second
  // derivation of state the Backend owns.
  assert.doesNotMatch(workspace, /!record\.reviewComment/);
  assert.match(
    workspace,
    /const pendingRecords = records\.filter\(\s*\(record\)\s*=>\s*record\.auditStatus === "pending",?\s*\)/,
  );
  assert.match(
    workspace,
    /new Set\(\s*records\.map\(\s*\(record\)\s*=>\s*record\.studentId,?\s*\),?\s*\)/,
  );
  assert.doesNotMatch(workspace, /学生管理摘要|打卡审核摘要|免测与组织认证摘要|入班审核摘要|成绩完整度|本学期已通过/);

  assert.match(teacherCss, /\.page-summary-metrics/);
  assert.match(teacherCss, /\.summary-metric\.is-attention b/);
  assert.match(teacherCss, /\.status-tabs button:focus-visible/);
});

test("uses the direct-enrollment roster as the teacher membership surface", async () => {
  const [app, workspace, profile] = await Promise.all([
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/student-profile.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(app, /入班审核|学生加入审核/);
  assert.match(workspace, /status: MembershipStatus/);
  assert.match(workspace, /joinedAt: string/);
  assert.match(workspace, /joinMethod: "qr" \| "manual_import"/);
  assert.match(workspace, /<th>加入信息<\/th>/);
  assert.match(workspace, /<th>成员状态<\/th>/);
  assert.match(workspace, /移出课程/);
  assert.match(workspace, /无需教师审批/);
  assert.match(
    workspace,
    /student\.status === "active"\s*\|\|\s*records\.some/,
  );
  assert.match(profile, /\| "joinedAt"/);
  assert.match(profile, /\| "joinMethod"/);
});

test("keeps teacher course cards free of the retired task business", async () => {
  const [workspace, teacherCss] = await Promise.all([
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.css", import.meta.url), "utf8"),
  ]);

  assert.match(workspace, /teacher-course-card/);
  assert.doesNotMatch(workspace, /TaskStatus|SportTask|tasks:|当前任务|运动任务|暂无进行中的任务/);
  assert.doesNotMatch(teacherCss, /task-course-card|course-current-task/);
});

test("uses one progressive student identity pattern across teacher workflows", async () => {
  const [workspace, profile, profileHook, teacherCss, app] = await Promise.all([
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/student-profile.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/use-student-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.css", import.meta.url), "utf8"),
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(profile, /export function StudentIdentity/);
  assert.match(profile, /export function StudentHoverCard/);
  assert.match(profile, /export function StudentDetailDrawer/);
  assert.match(profile, /export function StudentInfoFields/);
  assert.match(profile, /showHover = \(delay = 150/);
  assert.match(profile, /setMounted\(open\), open \? 0 : 160/);
  assert.match(profile, /matchMedia\("\(hover: hover\) and \(pointer: fine\)"\)/);
  assert.match(profile, /matches\(":focus-visible"\)/);
  assert.match(profile, /event\.key === "Escape"/);
  assert.match(profile, /event\.key !== "Enter" && event\.key !== " "/);
  assert.match(profileHook, /export function useStudentProfile/);
  assert.match(profileHook, /profileCache/);
  assert.match(profileHook, /pendingProfileLoads/);
  assert.doesNotMatch(profileHook, /\bfetch\(/);

  assert.ok(
    (workspace.match(/studentIdentity\(/g) ?? []).length >= 8,
    "teacher lists and workflow summaries should reuse the shared student identity",
  );
  assert.doesNotMatch(workspace, /<Person\b|function Person/);
  assert.doesNotMatch(workspace, /className="table-sub[^"]*"[^>]*title=\{(?:student|request)\.email\}/);
  assert.doesNotMatch(app, /function TeacherPage|Legacy visual prototype/);

  assert.match(teacherCss, /\.student-hover-card\.is-open/);
  assert.match(teacherCss, /\.student-detail-drawer/);
  assert.match(teacherCss, /student-hover-in 160ms/);
  assert.match(teacherCss, /@media \(max-width: 620px\)[\s\S]*\.student-detail-drawer/);
});

test("uses one portal-backed AppSelect instead of native browser selects", async () => {
  const [component, styles, workspace, tickets, app, ...adminPages] = await Promise.all([
    readFile(new URL("../app/app-select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/app-select.css", import.meta.url), "utf8"),
    readFile(new URL("../app/teacher-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-ticket-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/portal-app.tsx", import.meta.url), "utf8"),
    ...["admin-audit", "admin-help", "admin-rules", "admin-semesters", "admin-support", "admin-system", "admin-users"].map((name) => readFile(new URL(`../app/${name}.tsx`, import.meta.url), "utf8")),
  ]);
  const selectionSurfaces = [workspace, tickets, app, ...adminPages].join("\n");

  assert.ok((selectionSurfaces.match(/<AppSelect\b/g) ?? []).length >= 30);
  assert.doesNotMatch(selectionSurfaces, /<(?:select|option)\b/i);
  assert.match(component, /createPortal/);
  assert.match(component, /role="combobox"/);
  assert.match(component, /role="listbox"/);
  assert.match(component, /role="option"/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /event\.key === "ArrowDown"/);
  assert.match(component, /event\.key === "Enter"/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(styles, /--app-select-height:\s*60px/);
  assert.match(styles, /--app-select-menu-radius:\s*12px/);
  assert.match(styles, /--app-select-option-height:\s*42px/);
  assert.match(styles, /\.app-select\.is-open \.app-select-chevron/);
  assert.match(styles, /\.app-select-option\.is-selected/);
  assert.match(styles, /z-index:\s*5000/);
});
