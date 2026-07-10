const fs = require("fs");
const vm = require("vm");

const code = fs.readFileSync(new URL("./app.js", `file://${__dirname}/`), "utf8");
const serverCode = fs.readFileSync(new URL("../backend/server.js", `file://${__dirname}/`), "utf8");
const app = { innerHTML: "" };
const storage = new Map();
const downloads = [];

const context = {
  console,
  downloads,
  code,
  serverCode,
  fetch: async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "{\"ok\":true}",
  }),
  Blob: function BlobMock(parts, options) {
    this.parts = parts;
    this.options = options;
  },
  URL: {
    createObjectURL: () => "blob:mock",
    revokeObjectURL: () => {},
  },
  window: {
    __BNBU_SUPPRESS_RENDER_ERRORS: true,
    __BNBU_STAY_IN_WEB_APP: true,
    localStorage: {
      getItem: (key) => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    location: { reload: () => {} },
  },
  document: {
    querySelector: (selector) => (selector === "#app" ? app : null),
    createElement: () => ({
      click: () => downloads.push(true),
      set href(value) {
        this._href = value;
      },
      set download(value) {
        this._download = value;
      },
    }),
    addEventListener: () => {},
  },
  setTimeout,
  clearTimeout,
};

const tests = `
  (async () => {
    const failures = [];
    const protectedReadRoutes = serverCode.match(/app\\.get\\('\\/api\\/(?:teacher|admin)[^\\n]+requireAuth/g) || [];
    if (protectedReadRoutes.length) failures.push("teacher/admin read routes must use requireRole: " + protectedReadRoutes.join(", "));
    if (serverCode.includes("CORS_ORIGIN || req.headers.origin")) failures.push("production CORS reflects arbitrary origins");
    if (!serverCode.includes("normalizeProofFiles")) failures.push("backend proof file allowlist missing");
    if (code.includes("if (isApiLive() && !state.apiLoading)")) failures.push("render-triggered API fetch loop pattern still present");
    if (!code.includes("safeProofUrl")) failures.push("frontend proof URL sanitizer missing");
    if (!code.includes("submitReviewDecision")) failures.push("review action API submit helper missing");
    if (serverCode.includes("r.actualStudents || r.students")) failures.push("course list must not turn zero actual students into configured capacity");
    if (serverCode.includes("stats.total || course.students")) failures.push("dashboard must not turn zero roster rows into configured capacity");

    const roles = [
      ["teacher", teacherNav],
      ["admin", adminNav],
      ["manager", managerNav],
    ];

    const originalFetch = fetch;
    const originalRetryCount = apiRequestPolicy.retryCount;
    let dashboardFetches = 0;
    apiRequestPolicy.retryCount = 0;
    fetch = async (url) => {
      if (String(url).includes("/api/teacher/courses/gepe/dashboard")) {
        dashboardFetches += 1;
        if (dashboardFetches > 1) return new Promise(() => {});
        return {
          ok: false,
          status: 500,
          statusText: "Server Error",
          text: async () => JSON.stringify({ message: "down" }),
        };
      }
      return originalFetch(url);
    };
    state.loggedIn = true;
    state.role = "teacher";
    state.route = "teacher-dashboard";
    state.courseId = "gepe";
    state.token = "demo-token-teacher";
    state.dashboardCache = {};
    renderRoute();
    await sleep(0);
    await sleep(0);
    await sleep(0);
    fetch = originalFetch;
    apiRequestPolicy.retryCount = originalRetryCount;
    state.token = null;
    state.dashboardCache = {};
    if (dashboardFetches > 1) failures.push("teacher dashboard repeats failed render-time API fetch: " + dashboardFetches);

    let rosterFetches = 0;
    apiRequestPolicy.retryCount = 0;
    fetch = async (url) => {
      if (String(url).includes("/api/teacher/courses/basketball/students")) {
        rosterFetches += 1;
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => JSON.stringify([]),
        };
      }
      return originalFetch(url);
    };
    state.loggedIn = true;
    state.role = "teacher";
    state.route = "teacher-students";
    state.courseId = "basketball";
    state.token = "demo-token-teacher";
    state.rosters = { basketball: seedRoster("basketball") };
    state.rosterSources = {};
    apiLoadState.clear();
    renderRoute();
    await sleep(0);
    await sleep(0);
    await sleep(0);
    fetch = originalFetch;
    apiRequestPolicy.retryCount = originalRetryCount;
    state.token = null;
    if (rosterFetches !== 1) failures.push("teacher-students did not fetch API roster exactly once: " + rosterFetches);
    if (!Array.isArray(state.rosters.basketball) || state.rosters.basketball.length !== 0) failures.push("API empty roster must override seeded basketball roster");

    for (const [role, nav] of roles) {
      state.loggedIn = true;
      state.role = role;
      for (const [route] of nav) {
        state.route = route;
        try {
          renderRoute();
          if (!app.innerHTML || app.innerHTML.length < 500) failures.push(route + ": short html");
          if (app.innerHTML.includes("页面建设中")) failures.push(route + ": fallback page");
          if (app.innerHTML.includes("undefined")) failures.push(route + ": contains undefined");
          if (app.innerHTML.includes("NaN")) failures.push(route + ": contains NaN");
          if (/data-phys-endurance[^>]*placeholder="[^"]*""/.test(app.innerHTML)) failures.push(route + ": malformed physical endurance placeholder");
        } catch (error) {
          failures.push(route + ": " + error.message);
        }
      }
    }

    state.loggedIn = true;
    state.role = "teacher";
    state.courseId = "gepe";
    state.route = "teacher-physical";
    renderRoute();
    if (/data-phys-endurance[^>]*placeholder="[^"]*""/.test(app.innerHTML)) failures.push("physical endurance placeholder is malformed");

    state.loggedIn = true;
    state.role = "teacher";
    state.route = "teacher-students";
    state.studentSearch = "\\" autofocus onfocus=alert(99) x=\\"";
    renderRoute();
    if (/value=""\s+autofocus\s+onfocus=alert\(99\)/.test(app.innerHTML)) failures.push("student search value not escaped");
    state.studentSearch = "";

    const originalGepeRoster = state.rosters.gepe;
    const baseStudent = JSON.parse(JSON.stringify((originalGepeRoster && originalGepeRoster[0]) || seedRoster("gepe")[0]));
    const maliciousStudent = {
      ...baseStudent,
      id: "22308888",
      name: "<img src=x onerror=alert(11)>",
      college: "<svg onload=alert(12)>",
      status: "\\\"><img src=x onerror=alert(13)>",
    };
    state.rosters.gepe = [maliciousStudent];
    state.courseId = "gepe";
    for (const route of ["teacher-students", "teacher-progress", "teacher-exam", "teacher-attendance", "teacher-physical", "teacher-grades"]) {
      state.loggedIn = true;
      state.role = "teacher";
      state.route = route;
      renderRoute();
      if (/<script[^>]*>|<img src=x[^>]*>|<svg onload[^>]*>/i.test(app.innerHTML)) failures.push(route + ": student data rendered unsafe HTML");
    }
    state.rosters.gepe = originalGepeRoster;

    state.role = "teacher";
    state.route = "admin-dashboard";
    renderRoute();
    if (state.route !== "teacher-dashboard") failures.push("role fallback failed");

    mergeState(state, { "__proto__": { polluted: true }, unknownKey: "ignored" });
    if ({}.polluted || state.unknownKey) failures.push("state merge accepted unsafe keys");

    state.courseId = "gepe";
    const rosterRows = importRowsFromCsv("姓名,学号,学院,班级,课程代码,Section,选课状态\\n许一,22309901,工商管理学院,2026A,GEPE101,1004,已选\\n许二,22309902,数据科学学院,2026B,GEPE101,Section 1004,已选\\n许三,22309903,人文社科学院,2026C,GEPE101,section 1004,已选\\n许四,22309904,人文社科学院,2026D,GEPE101,9999,已选");
    state.importPreview = buildImportPreview(rosterRows);
    if (state.importPreview.filter((row) => row.valid).length !== 3) failures.push("roster import validation failed");
    if (!state.importPreview.some((row) => row.status === "Section不匹配")) failures.push("section mismatch validation failed");

    const memberRows = importMembershipRowsFromCsv("组织,学生姓名,学号,有效期,认证状态,备注\\n跑步社,新同学,22309951,2026-09-01,认证有效,CSV导入\\n不存在社,无效同学,22309952,2026-09-01,待确认,CSV导入", "club");
    state.managerImportPreview = buildMembershipImportPreview(memberRows, "club");
    if (state.managerImportPreview.filter((row) => row.valid).length !== 1) failures.push("membership import validation failed");

    const review = state.reviews.find((item) => item.id === "r1");
    const student = courseRoster("gepe").find((item) => item.id === review.studentId);
    const beforeHours = student.course;
    applyReviewDecision(review, "approve", review.hours);
    review.status = "已通过";
    if (student.course <= beforeHours) failures.push("review approve did not add hours");
    applyReviewDecision(review, "reject", review.hours);
    review.status = "已驳回";
    if (student.course !== beforeHours) failures.push("review reject did not roll back hours");

    state.loggedIn = true;
    state.role = "admin";
    state.route = "admin-api-handoff";
    renderRoute();
    if (!app.innerHTML.includes("API 联调配置")) failures.push("api handoff panel missing");
    if (!app.innerHTML.includes("稳定性 / 安全 / 兼容性基线")) failures.push("quality gates panel missing");
    state.apiBaseUrl = "http://127.0.0.1:8080";
    state.apiHealthPath = "/api/health";
    if (apiHealthUrl() !== "http://127.0.0.1:8080/api/health") failures.push("api health url mismatch");
    if (apiUrlPolicy("javascript:alert(1)").status !== "bad") failures.push("api url policy failed");
    state.apiBaseUrl = "http://127.0.0.1:8080/api";
    if (getApiBase() !== "http://127.0.0.1:8080") failures.push("api base should strip trailing /api");
    await checkApiHealth();
    if (state.apiHealth.status !== "ok") failures.push("api health check failed");
    if (!state.apiHealth.attempts) failures.push("api retry metadata missing");

    downloadRouteMatrix();
    downloadEndpointMap();
    downloadHandoffManifest();
    downloadQualityChecklist();
    if (downloads.length < 4) failures.push("download helpers failed");

    const snapshot = integrationSnapshot();
    if (snapshot.endpointCount !== backendEndpoints.length) failures.push("snapshot endpoint mismatch");
    if (!snapshot.routes.some((item) => item.route === "admin-api-handoff")) failures.push("snapshot route missing");
    if (!snapshot.qualityGates?.length) failures.push("snapshot quality gates missing");
    if (!snapshot.apiRequestPolicy?.timeoutMs) failures.push("snapshot api request policy missing");
    const manifest = handoffManifest();
    if (!manifest.frontendFiles.includes("frontend/quality-smoke.cjs")) failures.push("quality smoke missing from manifest");

    const maliciousReview = {
      id: "xss-review",
      courseId: "gepe",
      studentId: "22301142",
      name: "<img src=x onerror=alert(1)>",
      type: "课程相关",
      hours: 1,
      risk: "<script>alert(2)</script>",
      status: "待确认",
      task: "<img src=x onerror=alert(3)>",
      reason: "<svg onload=alert(4)>",
      comment: "\\" autofocus onfocus=alert(5) x=\\"",
      proofFiles: ["javascript:alert(6)", "/uploads/proof-ok.jpg"],
    };
    state.reviews.push(maliciousReview);
    state.loggedIn = true;
    state.role = "teacher";
    state.activeReviewId = maliciousReview.id;
    state.route = "teacher-review";
    renderRoute();
    const rawReviewTag = app.innerHTML.match(/<script[^>]*>|<img src=x[^>]*>|<svg onload[^>]*>/i);
    if (rawReviewTag) failures.push("review page did not escape untrusted text: " + rawReviewTag[0]);
    if (app.innerHTML.includes("javascript:alert")) failures.push("review page rendered unsafe proof URL");
    if (!app.innerHTML.includes("/uploads/proof-ok.jpg")) failures.push("review page dropped safe proof URL");
    state.reviews = state.reviews.filter((item) => item.id !== maliciousReview.id);

    const savedRules = state.admin.gradeRules;
    state.role = "admin";
    state.admin.gradeRules = null;
    state.route = "admin-dashboard";
    renderRoute();
    if (!app.innerHTML.includes("页面遇到错误")) failures.push("runtime error guard failed");
    state.admin.gradeRules = savedRules;
    state.route = "admin-api-handoff";
    renderRoute();
    if (!app.innerHTML.includes("API 联调配置")) failures.push("runtime recovery failed");

    if (failures.length) throw new Error(failures.join(" | "));
    globalThis.__result = {
      routes: roles.reduce((sum, [, nav]) => sum + nav.length, 0),
      endpoints: backendEndpoints.length,
      downloads: downloads.length,
      health: state.apiHealth.status,
      qualityGroups: snapshot.qualityGates.length,
    };
  })()
`;

Promise.resolve(vm.runInNewContext(`${code}\n${tests}`, context, { timeout: 5000 }))
  .then(() => {
    console.log(`BNBU Web self-test passed: ${JSON.stringify(context.__result)}`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
