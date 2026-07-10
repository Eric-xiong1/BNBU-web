const logoSvg = `
  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <g class="emblem-axis">
      <line x1="50" y1="17" x2="50" y2="36" />
      <line x1="50" y1="64" x2="50" y2="83" />
      <line x1="17" y1="50" x2="36" y2="50" />
      <line x1="64" y1="50" x2="83" y2="50" />
    </g>
    <g class="emblem-dots">
      <circle cx="50" cy="10" r="7" />
      <circle cx="50" cy="90" r="7" />
      <circle cx="10" cy="50" r="7" />
      <circle cx="90" cy="50" r="7" />
    </g>
    <g class="emblem-glyphs">
      <path d="M32 27 L21 38 L36 54 Q45 47 40 40 L31 31" />
      <path d="M63 24 L56 38 L58 53 L75 36" />
      <path d="M68 73 L79 62 L64 46 Q55 53 60 60 L69 69" />
      <path d="M37 76 L44 62 L42 47 L25 64" />
    </g>
    <text x="50" y="54" text-anchor="middle">2005</text>
  </svg>
`;

const courses = [
  {
    id: "gepe",
    code: "GEPE101",
    section: "1004",
    name: "全人教育体育模块",
    semester: "2026 SPRING",
    students: 82,
    pending: 24,
    completion: 63,
    missing: 19,
    courseHours: 6.4,
    generalHours: 8.8,
    exportState: "待清理",
    deadline: "第 6 周周日 23:59",
  },
  {
    id: "basketball",
    code: "PEB203",
    section: "2003",
    name: "篮球基础与训练",
    semester: "2026 SPRING",
    students: 46,
    pending: 11,
    completion: 71,
    missing: 8,
    courseHours: 7.2,
    generalHours: 8.1,
    exportState: "可预检",
    deadline: "第 8 周周五 18:00",
  },
  {
    id: "fitness",
    code: "PEF112",
    section: "1008",
    name: "体适能训练",
    semester: "2026 SPRING",
    students: 58,
    pending: 17,
    completion: 54,
    missing: 22,
    courseHours: 5.8,
    generalHours: 7.4,
    exportState: "待清理",
    deadline: "第 7 周周日 23:59",
  },
];

const baseStudents = [
  { id: "22301142", name: "陈雨晴", college: "工商管理学院", course: 6, general: 10, exam: 86, attendance: 90, physical: 78, status: "差课程 4h", gender: "female", gradeLevel: "sophomore" },
  { id: "22301087", name: "林子航", college: "数据科学学院", course: 10, general: 7, exam: 79, attendance: 84, physical: 82, status: "差其他 3h", gender: "male", gradeLevel: "freshman" },
  { id: "22301205", name: "黄嘉仪", college: "人文社科学院", course: 10, general: 10, exam: 91, attendance: 96, physical: 88, status: "已完成", gender: "female", gradeLevel: "junior" },
  { id: "22301318", name: "宋亦然", college: "理工科技学院", course: 4, general: 5, exam: 72, attendance: 76, physical: 69, status: "风险较高", gender: "male", gradeLevel: "sophomore" },
  { id: "22301776", name: "梁思远", college: "文化创意学院", course: 10, general: 10, exam: 88, attendance: 92, physical: 84, status: "已完成", gender: "male", gradeLevel: "senior" },
  { id: "22301904", name: "邓悦宁", college: "金融数学学院", course: 8, general: 10, exam: 83, attendance: 80, physical: 80, status: "差课程 2h", gender: "female", gradeLevel: "junior" },
];

const state = {
  loggedIn: false,
  role: "teacher",
  route: "teacher-dashboard",
  courseId: "gepe",
  token: null,
  authUser: null,
  loginError: null,
  loginLoading: false,
  imported: false,
  studentSearch: "",
  studentFilter: "all",
  taskStatusFilter: "all",
  reviewSearch: "",
  reviewStatusFilter: "open",
  activeReviewId: "r1",
  teacherNotice: "",
  managerNotice: "",
  managerSearch: "",
  managerStatusFilter: "all",
  adminOrganizationFilter: "all",
  adminCourseFilter: "all",
  apiBaseUrl: "",
  apiHealthPath: "/api/health",
  apiHealth: null,
  apiLastRequest: null,
  importPreview: [],
  studentDetailId: "",
  studentHoursDetail: null,
  studentOrgIdentity: null,
  pendingCerts: [],
  conversionTableData: null,
  courseExemptionsData: null,
  apiLoading: false,
  notifications: [],
  notificationsOpen: false,
  courses: [],
  gradeData: null,
  managerImportPreview: [],
  exemptions: [
    { id: 'ex1', studentId: '22301142', studentName: '陈雨晴', type: '800m', reason: '膝盖旧伤复发，医生建议暂停剧烈运动', status: '待审核', proofFiles: [], reviewComment: '', createdAt: '2026-06-15 10:30' },
    { id: 'ex2', studentId: '22301318', studentName: '宋亦然', type: '1000m', reason: '哮喘病史，无法进行长时间耐力跑', status: '待审核', proofFiles: [], reviewComment: '', createdAt: '2026-06-14 14:20' },
  ],
  rosters: {},
  scoreBook: {},
  submissions: [],
  rosterSources: {},
  memberships: [
    { id: "m1", type: "team", organization: "羽毛球队", studentId: "22301142", studentName: "陈雨晴", status: "认证有效", validUntil: "2026-09-01", offset: "可抵扣", comment: "校队名单已确认", updatedBy: "体育部管理员", updatedAt: "2026.06.01 10:30" },
    { id: "m2", type: "team", organization: "篮球校队", studentId: "22301087", studentName: "林子航", status: "待确认", validUntil: "2026-09-01", offset: "待确认", comment: "等待负责人确认", updatedBy: "篮球校队负责人", updatedAt: "2026.06.10 14:20" },
    { id: "m3", type: "club", organization: "跑步社", studentId: "22301205", studentName: "黄嘉仪", status: "认证有效", validUntil: "2026-09-01", offset: "可抵扣", comment: "社团活动记录完整", updatedBy: "跑步社负责人", updatedAt: "2026.06.04 16:15" },
    { id: "m4", type: "club", organization: "摄影社", studentId: "22301318", studentName: "宋亦然", status: "非体育类", validUntil: "不抵扣", offset: "不抵扣", comment: "组织类型不计体育抵扣", updatedBy: "体育部管理员", updatedAt: "2026.06.02 09:12" },
  ],
  logs: [
    { id: "log1", actor: "体育部管理员", action: "发布体育学时规则", target: "BNBU-SPORT-2026-v1", time: "2026.06.01 09:00" },
    { id: "log2", actor: "王老师", action: "处理异常打卡", target: "GEPE101 / 黄嘉仪", time: "2026.06.10 17:42" },
    { id: "log3", actor: "跑步社负责人", action: "确认社团成员身份", target: "黄嘉仪 / 跑步社", time: "2026.06.04 16:15" },
  ],
  deliveryRecords: [
    { courseId: "gepe", status: "未提交", submittedAt: "-", submittedBy: "王老师", issueCount: 0, comment: "等待老师提交导出预检" },
    { courseId: "basketball", status: "未提交", submittedAt: "-", submittedBy: "李老师", issueCount: 0, comment: "等待老师提交导出预检" },
    { courseId: "fitness", status: "未提交", submittedAt: "-", submittedBy: "陈老师", issueCount: 0, comment: "等待老师提交导出预检" },
  ],
  tasks: [
    { id: "t1", courseId: "gepe", title: "课外跑步训练 Week 06", hours: 2, deadline: "第 6 周周日", proof: "App 截图 + 场地照", status: "进行中" },
    { id: "t2", courseId: "gepe", title: "体能训练签到", hours: 1, deadline: "第 7 周周五", proof: "照片", status: "草稿" },
    { id: "t3", courseId: "basketball", title: "篮球投篮练习", hours: 1.5, deadline: "第 8 周周五", proof: "训练截图 + 照片", status: "进行中" },
    { id: "t4", courseId: "fitness", title: "核心力量训练", hours: 2, deadline: "第 7 周周日", proof: "App 截图", status: "进行中" },
  ],
  reviews: [
    { id: "r1", courseId: "gepe", studentId: "22301142", name: "陈雨晴", type: "课程相关", hours: 2, approvedHours: 0, risk: "同图复用", status: "待确认", task: "课外跑步训练 Week 06", reason: "图片哈希命中历史记录", comment: "", applied: false },
    { id: "r2", courseId: "gepe", studentId: "22301087", name: "林子航", type: "其他运动", hours: 1.5, approvedHours: 0, risk: "时长偏高", status: "需复核", task: "自主篮球训练", reason: "单次时长接近上限", comment: "", applied: false },
    { id: "r3", courseId: "gepe", studentId: "22301205", name: "黄嘉仪", type: "课程相关", hours: 1, approvedHours: 0, risk: "无异常", status: "可通过", task: "体能训练签到", reason: "凭证完整", comment: "", applied: false },
    { id: "r4", courseId: "gepe", studentId: "22301318", name: "宋亦然", type: "其他运动", hours: 1, approvedHours: 0, risk: "缺少场地照", status: "补材料", task: "自主运动打卡", reason: "缺少现场图片", comment: "", applied: false },
    { id: "r5", courseId: "basketball", studentId: "22301087", name: "林子航", type: "课程相关", hours: 1, approvedHours: 0, risk: "截图模糊", status: "待确认", task: "篮球投篮练习", reason: "凭证清晰度不足", comment: "", applied: false },
    { id: "r6", courseId: "fitness", studentId: "22301904", name: "邓悦宁", type: "其他运动", hours: 2, approvedHours: 0, risk: "定位异常", status: "需复核", task: "核心力量训练", reason: "提交地点与任务场地不一致", comment: "", applied: false },
  ],
  adminNotice: "",
  manualCredits: [],
  pendingCertsFilter: "all",
  conversionTab: "freshman_sophomore-male",
  dashboardCache: {},
  adminOverview: null,
  admin: {
    semesters: [
      { id: "s1", name: "2026 Spring", dateRange: "2026.02.24 - 2026.06.28", status: "进行中", locked: "否" },
      { id: "s2", name: "2026 Fall", dateRange: "2026.09.01 - 2026.12.28", status: "草稿", locked: "否" },
    ],
    courses: [
      { id: "ac1", code: "GEPE101", section: "1004", name: "全人教育体育模块", teacher: "王老师", students: 82, semester: "2026 Spring", status: "正常" },
      { id: "ac2", code: "PEB203", section: "2003", name: "篮球基础与训练", teacher: "李老师", students: 46, semester: "2026 Spring", status: "正常" },
      { id: "ac3", code: "PEF112", section: "1008", name: "体适能训练", teacher: "陈老师", students: 58, semester: "2026 Spring", status: "草稿" },
    ],
    users: [
      { id: "u1", name: "王老师", email: "teacher@bnbu.edu.cn", role: "体育任课老师", scope: "GEPE101 / Section 1004", status: "正常" },
      { id: "u2", name: "李老师", email: "basketball@bnbu.edu.cn", role: "体育任课老师", scope: "PEB203 / Section 2003", status: "正常" },
      { id: "u3", name: "跑步社负责人", email: "club@bnbu.edu.cn", role: "组织负责人", scope: "跑步社", status: "待确认" },
    ],
    sportRules: {
      version: "BNBU-SPORT-2026-v1",
      total: 20,
      courseRequired: 10,
      generalRequired: 10,
      dailyLimit: 2,
      stackAllowed: "不允许",
      organizationOffset: "允许体育类组织抵扣",
      status: "正常",
    },
    gradeRules: [
      { id: "g1", key: "checkin", name: "体育打卡", weight: 25, source: "课程相关 + 其他运动", status: "草稿" },
      { id: "g2", key: "exam", name: "专项考试", weight: 30, source: "任课老师录入", status: "草稿" },
      { id: "g3", key: "attendance", name: "平时表现", weight: 20, source: "签到 / 课堂表现", status: "草稿" },
      { id: "g4", key: "physical", name: "体测", weight: 25, source: "体测换算表", status: "草稿" },
    ],
    conversionRules: [
      { id: "cv1", item: "1000m / 800m", metric: "时间", method: "分段线性换算", version: "CN-2026-v1", status: "正常" },
      { id: "cv2", item: "50m", metric: "秒数", method: "成绩越小分越高", version: "CN-2026-v1", status: "正常" },
      { id: "cv3", item: "立定跳远", metric: "米", method: "成绩越大分越高", version: "CN-2026-v1", status: "正常" },
      { id: "cv4", item: "BMI", metric: "区间", method: "区间映射", version: "CN-2026-v1", status: "草稿" },
    ],
    exportTemplate: {
      name: "BNBU-final-v1",
      format: "CSV",
      fields: ["学号", "姓名", "课程代码", "Section", "体育打卡", "专项考试", "平时表现", "体测", "总分", "备注"],
      status: "已匹配",
    },
    teams: [
      { id: "tm1", name: "羽毛球队", type: "校队", members: 28, offset: "可抵扣", owner: "体育部", status: "正常" },
      { id: "tm2", name: "篮球校队", type: "校队", members: 16, offset: "可抵扣", owner: "体育部", status: "正常" },
    ],
    clubs: [
      { id: "cl1", name: "跑步社", type: "体育类", members: 64, offset: "可抵扣", owner: "学生社团", status: "正常" },
      { id: "cl2", name: "摄影社", type: "非体育类", members: 41, offset: "不抵扣", owner: "学生社团", status: "正常" },
    ],
  },
};

const app = document.querySelector("#app");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeProofUrl(value) {
  const text = String(value || "").trim();
  return /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|heic|heif)$/i.test(text) ? text : "";
}

function safeProofUrls(value) {
  if (!Array.isArray(value)) return [];
  return value.map(safeProofUrl).filter(Boolean);
}

function renderProofLink(url, count) {
  const safe = safeProofUrl(url);
  if (!safe) return "";
  return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" class="ghost-button" style="font-size:11px;padding:2px 6px">查看(${Number(count) || 1})</a>`;
}

function setAdminNotice(message) {
  state.adminNotice = message;
}

function adminNotice() {
  if (!state.adminNotice) return "";
  return `<div class="admin-notice" role="status">${escapeHtml(state.adminNotice)}</div>`;
}

function setTeacherNotice(message) {
  state.teacherNotice = message;
}

function teacherNotice() {
  if (!state.teacherNotice) return "";
  return `<div class="teacher-notice" role="status">${escapeHtml(state.teacherNotice)}</div>`;
}

function setManagerNotice(message) {
  state.managerNotice = message;
}

function managerNotice() {
  if (!state.managerNotice) return "";
  return `<div class="teacher-notice" role="status">${escapeHtml(state.managerNotice)}</div>`;
}

function selectedAttr(value, expected) {
  return value === expected ? "selected" : "";
}

const storageKey = "bnbuSportsWebStateV1";
const teacherAppUrl = "./teacher/index.html";
const previewUrl = "http://127.0.0.1:4174/index.html?fresh=quality-v1";
const maxStorageBytes = 900000;
const apiRequestPolicy = {
  timeoutMs: 5000,
  retryCount: 2,
  retryDelayMs: 250,
  maxResponsePreview: 180,
  allowedLocalOrigins: ["http://127.0.0.1", "http://localhost", "http://[::1]"],
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeApiPath(value = "/health") {
  const raw = String(value || "/health").trim();
  if (!raw) return "/health";
  // If it's an absolute URL, extract just the path portion
  if (raw.includes("://")) {
    try {
      const url = new URL(raw);
      return url.pathname + url.search;
    } catch {
      return "/health";
    }
  }
  const compact = raw.replace(/[<>"'`\\\s]/g, "");
  return compact.startsWith("/") ? compact : `/${compact}`;
}

function normalizeApiBase(value = "") {
  return String(value || "").trim().replace(/[<>"'`\\\s]/g, "").replace(/\/+$/, "").replace(/\/api$/i, "");
}

function saveTeacherAuthSession() {
  try {
    window.sessionStorage.setItem("bnbuAuthSession", JSON.stringify({
      token: state.token,
      user: state.authUser,
      role: state.role,
      apiBaseUrl: state.apiBaseUrl || "",
    }));
  } catch {
    // sessionStorage may be unavailable
  }
}

function redirectToTeacherApp(demo = false) {
  if (window.__BNBU_STAY_IN_WEB_APP) return false;
  if (!demo) saveTeacherAuthSession();
  window.location.href = demo ? `${teacherAppUrl}?demo=1` : teacherAppUrl;
  return true;
}

function shouldUseTeacherShell() {
  return state.loggedIn && state.role === "teacher" && !window.__BNBU_STAY_IN_WEB_APP;
}

function apiHealthUrl() {
  const base = normalizeApiBase(state.apiBaseUrl || "");
  return `${base}${normalizeApiPath(state.apiHealthPath)}`;
}

function apiUrlPolicy(url) {
  const value = String(url || "").trim();
  if (!value) {
    return { status: "bad", message: "API URL 不能为空。" };
  }
  if (/[<>"'`\\\s]/.test(value)) {
    return { status: "bad", message: "API URL 含有非法字符，请只填写 http(s) 地址或同一域名下的路径。" };
  }
  // Allow same-origin relative paths (e.g., /api/health) when Nginx proxies /api/* to the backend
  if (/^\//.test(value)) {
    return { status: "ok", message: "同域路径 — 由 Nginx 反向代理至后端 API，不经过外网。" };
  }
  if (!/^https?:\/\//i.test(value)) {
    return { status: "bad", message: "API URL 只允许以 / 开头的同域路径，或 http:// / https:// 开头的完整地址。" };
  }

  const isLocalHttp = apiRequestPolicy.allowedLocalOrigins.some((origin) => value.toLowerCase().startsWith(origin));
  if (/^http:\/\//i.test(value) && !isLocalHttp) {
    return { status: "warn", message: "非本地 HTTP 地址仅用于调试，正式部署必须使用 HTTPS。" };
  }

  return { status: "ok", message: isLocalHttp ? "本地联调地址已允许。" : "HTTPS 地址符合正式联调要求。" };
}

async function apiRequest(url, options = {}) {
  const policy = apiUrlPolicy(url);
  if (policy.status === "bad") {
    const error = new Error(policy.message);
    error.code = "API_URL_BLOCKED";
    throw error;
  }

  const maxRetries = Number.isFinite(options.retries) ? options.retries : apiRequestPolicy.retryCount;
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const startedAt = Date.now();
    const supportsAbort = typeof AbortController === "function";
    const controller = supportsAbort ? new AbortController() : null;
    const timeoutId = supportsAbort
      ? setTimeout(() => controller.abort(), options.timeoutMs || apiRequestPolicy.timeoutMs)
      : null;

    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
          "X-BNBU-Web-Client": "sports-grade-web",
          ...(options.headers || {}),
        },
        signal: controller?.signal,
      });
      const text = await response.text();
      const result = {
        response,
        text,
        latencyMs: Date.now() - startedAt,
        attempts: attempt + 1,
        policy,
      };
      if (response.ok || response.status < 500 || attempt >= maxRetries) return result;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) break;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    await sleep(apiRequestPolicy.retryDelayMs * (attempt + 1));
  }

  const error = new Error(lastError?.name === "AbortError" ? "请求超时，请检查后端服务响应时间。" : lastError?.message || "无法连接后端服务");
  error.cause = lastError;
  throw error;
}

// ── API helpers (v4 backend integration) ────────────────────────
function getApiBase() { return normalizeApiBase(state.apiBaseUrl || window.location.origin); }
function isApiLive() { return state.apiHealth && state.apiHealth.status === 'ok'; }
const apiLoadState = new Map();

function shouldStartApiLoad(key) {
  if (!isApiLive() && !state.token) return false;
  const status = apiLoadState.get(key);
  if (status === "loading" || status === "loaded" || status === "failed") return false;
  apiLoadState.set(key, "loading");
  state.apiLoading = true;
  return true;
}

function finishApiLoad(key, ok) {
  apiLoadState.set(key, ok ? "loaded" : "failed");
  state.apiLoading = false;
}

function loadRouteDataOnce(key, hasData, loadData) {
  if (hasData()) return;
  if (!shouldStartApiLoad(key)) return;
  Promise.resolve()
    .then(loadData)
    .then(() => finishApiLoad(key, Boolean(hasData())))
    .catch(() => finishApiLoad(key, false))
    .finally(() => renderRoute());
}

function apiAuthHeaders() {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (state.token) h['Authorization'] = 'Bearer ' + state.token;
  return h;
}

async function apiFetch(path, options = {}) {
  return apiRequest(getApiBase() + path, { ...options, headers: { ...apiAuthHeaders(), ...(options.headers || {}) }, method: options.method || 'GET' });
}

async function apiFetchJson(path, options = {}) {
  const result = await apiFetch(path, options);
  const data = JSON.parse(result.text);
  if (!result.response.ok) throw new Error(data.message || 'API request failed');
  return data;
}

async function apiFetchJsonSafe(path, options = {}) {
  try { return await apiFetchJson(path, options); } catch (_e) { return null; }
}

// ── Grade data (backend wiring) ──────────────────────────────────
async function fetchCourseGrades(courseId) {
  if (!state.token && !isApiLive()) return;
  var data = await apiFetchJsonSafe('/api/teacher/courses/' + encodeURIComponent(courseId) + '/grades');
  if (data) { state.gradeData = data; }
}

// ── Notifications (backend wiring) ──────────────────────────────
async function fetchNotifications() {
  if (!state.token && !isApiLive()) return;
  const data = await apiFetchJsonSafe('/api/common/notifications');
  if (data) { state.notifications = data; }
}

async function markNotificationRead(id) {
  if (!state.token && !isApiLive()) return false;
  const result = await apiFetchJsonSafe(`/api/common/notifications/${id}/read`, { method: 'PUT' });
  if (result) {
    const n = state.notifications.find(function(x) { return x.id === id; });
    if (n) n.isUnread = false;
  }
  return !!result;
}

async function markAllNotificationsRead() {
  if (!state.token && !isApiLive()) return;
  const unread = state.notifications.filter(function(n) { return n.isUnread; });
  const results = await Promise.all(unread.map(function(n) { return markNotificationRead(n.id); }));
  return results.every(Boolean);
}

function unreadNotificationCount() {
  return state.notifications.filter(function(n) { return n.isUnread; }).length;
}

function formatNotificationTime(isoString) {
  if (!isoString) return '';
  var d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  var now = new Date();
  var diffMs = now - d;
  var diffMin = Math.floor(diffMs / 60000);
  var diffHr = Math.floor(diffMs / 3600000);
  var diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return diffMin + ' 分钟前';
  if (diffHr < 24) return diffHr + ' 小时前';
  if (diffDay < 7) return diffDay + ' 天前';
  var month = d.getMonth() + 1;
  var day = d.getDate();
  return d.getFullYear() + '/' + (month < 10 ? '0' : '') + month + '/' + (day < 10 ? '0' : '') + day;
}

function categoryLabel(cat) {
  var map = { '审核反馈': '审核', '系统通知': '系统', '课程通知': '课程', '成绩通知': '成绩' };
  return map[cat] || cat || '通知';
}

// ── Admin config loader (Phase 3 backend wiring) ─────────────────
async function loadAdminConfig() {
  if (!isApiLive() && !state.token) return;
  if (state.role !== "admin") return; // Only admins need admin config data
  const [sportRules, gradeRules, exportTemplate, semesters, courses, users, orgs] = await Promise.all([
    apiFetchJsonSafe('/api/admin/sport-rules'),
    apiFetchJsonSafe('/api/admin/grade-rules'),
    apiFetchJsonSafe('/api/admin/export-template'),
    apiFetchJsonSafe('/api/admin/semesters'),
    apiFetchJsonSafe('/api/admin/courses'),
    apiFetchJsonSafe('/api/admin/users'),
    apiFetchJsonSafe('/api/admin/organizations'),
  ]);
  if (sportRules) state.admin.sportRules = sportRules;
  if (gradeRules) state.admin.gradeRules = gradeRules;
  if (exportTemplate) state.admin.exportTemplate = exportTemplate;
  if (semesters) {
    state.admin.semesters = semesters.map((r) => ({
      id: r.id, name: r.name, dateRange: r.date_range || r.dateRange || '',
      status: r.status, locked: r.locked || '否',
    }));
  }
  if (courses) {
    state.admin.courses = courses.map((r) => ({
      id: r.id, code: r.code, section: r.section || '1004', name: r.name,
      teacher: r.teacher || '', students: r.students || 0,
      semester: r.semester || '', status: r.status || '正常',
    }));
  }
  if (users) {
    state.admin.users = users.map((r) => ({
      id: r.id, name: r.name, email: r.email, role: r.role,
      scope: r.scope || '', status: r.status || '正常',
    }));
  }
  if (orgs) {
    const teams = [];
    const clubs = [];
    orgs.forEach((o) => {
      const item = { id: o.id, name: o.name, type: o.type === 'team' ? '校队' : '社团', members: o.members || 0, offset: o.offset || '不抵扣', owner: o.manager_name || o.owner || '待设置', status: o.status || '正常' };
      if (o.type === 'team') teams.push(item);
      else clubs.push(item);
    });
    if (teams.length) state.admin.teams = teams;
    if (clubs.length) state.admin.clubs = clubs;
  }
}

// ── Dashboard fetcher (teacher + admin) ──────────────────────────
async function fetchCourseDashboard(courseId) {
  const data = await apiFetchJsonSafe(`/api/teacher/courses/${courseId}/dashboard`);
  if (data) {
    state.dashboardCache = state.dashboardCache || {};
    state.dashboardCache[courseId] = data;
    // Also sync back to the course array for nav display
    const course = courses.find((c) => c.id === courseId);
    if (course) {
      course.students = data.students;
      course.completion = data.completion;
      course.pending = data.pending;
      course.missing = data.missing;
      course.courseHours = Number(data.courseHours || 0);
      course.generalHours = Number(data.generalHours || 0);
      course.exportState = data.exportState;
    }
  }
}

async function fetchAdminOverview() {
  const data = await apiFetchJsonSafe('/api/admin/overview');
  if (data) {
    state.adminOverview = data;
    // Sync course stats back
    if (Array.isArray(data)) {
      data.forEach((item) => {
        const course = state.admin.courses.find((c) => c.id === item.id);
        if (course) {
          course.students = item.students;
          course.completion = item.completion;
          course.status = item.exportState === '可归档' ? '正常' : '需关注';
        }
      });
    }
  }
}

async function fetchAdminLogs() {
  const data = await apiFetchJsonSafe('/api/admin/logs');
  if (data && Array.isArray(data.items)) {
    state.logs = data.items.map((r) => ({
      id: r.id, actor: r.actor || '', action: r.action || '', target: r.target || '', time: r.time || '',
    }));
  }
}

async function fetchCourseReviews(courseId) {
  const data = await apiFetchJsonSafe(`/api/teacher/courses/${courseId}/reviews`);
  if (data && Array.isArray(data)) {
    state.reviews = data.map((r) => ({
      id: r.id,
      courseId: r.course_id || courseId,
      studentId: r.student_id,
      name: r.name || r.student_name || '',
      type: r.type || '课程相关',
      hours: Number(r.hours || r.approved_hours || 0),
      approvedHours: Number(r.approved_hours || 0),
      risk: r.risk || '无异常',
      status: r.status || '待确认',
      task: r.task || '',
      reason: r.reason || '',
      comment: r.comment || '',
      applied: Boolean(r.applied),
      proofFiles: Array.isArray(r.proofFiles) ? r.proofFiles : [],
    }));
  }
}

// ── Feature #1: Student hours detail ────────────────────────────
async function fetchStudentHoursDetail(courseId, studentId) {
  return apiFetchJson(`/api/teacher/courses/${courseId}/students/${studentId}/hours-detail`);
}

async function submitManualCredit(courseId, studentId, payload) {
  return apiFetchJson(`/api/teacher/courses/${courseId}/students/${studentId}/manual-credit`, { method: 'POST', body: JSON.stringify(payload) });
}

// ── Feature #2: Pending certifications ──────────────────────────
async function fetchPendingCertifications(courseId) {
  return apiFetchJson(`/api/teacher/courses/${courseId}/pending-certifications`);
}

async function confirmCertification(certId, adjustedHours) {
  return apiFetchJson(`/api/teacher/certifications/${certId}/confirm`, { method: 'PUT', body: JSON.stringify({ adjustedHours }) });
}

async function rejectCertification(certId, reason) {
  return apiFetchJson(`/api/teacher/certifications/${certId}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) });
}

// ── Feature #3: Conversion table & auto-convert ─────────────────
async function fetchConversionTable(gradeGroup, gender) {
  return apiFetchJson(`/api/admin/conversion-table/${gradeGroup}/${gender}`);
}

async function saveConversionTable(gradeGroup, gender, entries) {
  return apiFetchJson(`/api/admin/conversion-table/${gradeGroup}/${gender}`, { method: 'PUT', body: JSON.stringify({ entries }) });
}

async function validateAllConversionTables() {
  return apiFetchJson('/api/admin/conversion-table/validate');
}

async function calculateEnduranceScore(studentId, rawSeconds) {
  return apiFetchJson(`/api/teacher/conversion/calculate?studentId=${encodeURIComponent(studentId)}&rawSeconds=${rawSeconds}`);
}

// ── Feature #4: Exemptions ──────────────────────────────────────
async function fetchCourseExemptions(courseId) {
  return apiFetchJson(`/api/teacher/courses/${courseId}/exemptions`);
}

async function reviewExemption(exemptionId, decision, comment) {
  return apiFetchJson(`/api/teacher/exemptions/${exemptionId}/decision`, { method: 'PUT', body: JSON.stringify({ decision, comment }) });
}

// ── Feature #5: Organization identity ───────────────────────────
async function submitReviewDecision(reviewId, decision, approvedHours, comment) {
  return apiFetchJson(`/api/teacher/reviews/${encodeURIComponent(reviewId)}/decision`, {
    method: 'PUT',
    body: JSON.stringify({ decision, approvedHours, comment }),
  });
}

async function fetchStudentOrgIdentity(courseId, studentId) {
  return apiFetchJson(`/api/teacher/courses/${courseId}/students/${studentId}/organization-identity`);
}

async function flagOrgIdentity(studentId, identityId, flag, comment) {
  return apiFetchJson(`/api/teacher/students/${studentId}/organization-identity/${identityId}/flag`, { method: 'PUT', body: JSON.stringify({ flag, comment }) });
}

function browserCapabilityRows() {
  const storageAvailable = (() => {
    try {
      const key = "__bnbu_storage_probe__";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  })();
  const cssGridSupported = typeof CSS === "undefined" || typeof CSS.supports !== "function" ? "unknown" : CSS.supports("display", "grid");

  return [
    { item: "Fetch API", status: typeof fetch === "function" ? "已支持" : "缺失", detail: "后端联调、健康检查、未来真实数据源" },
    { item: "AbortController", status: typeof AbortController === "function" ? "已支持" : "降级", detail: "支持时启用 5s 请求超时；不支持时仍保留错误兜底" },
    { item: "localStorage", status: storageAvailable ? "已支持" : "降级", detail: "演示态保存；正式接后端后仅保留少量 UI 偏好" },
    { item: "Blob 下载", status: typeof Blob === "function" && typeof URL !== "undefined" && Boolean(URL.createObjectURL) ? "已支持" : "降级", detail: "CSV、状态快照、接口清单下载" },
    { item: "CSS Grid", status: cssGridSupported === true ? "已支持" : cssGridSupported === "unknown" ? "待浏览器验证" : "缺失", detail: "桌面端布局核心能力，目标覆盖 Chrome / Edge / Safari / Firefox 近两版" },
  ];
}

function qualityGateGroups() {
  return [
    {
      group: "稳定性",
      items: [
        { item: "200 名 Web 用户同时在线", status: "前端就绪", detail: "静态资源无服务端会话锁；后端需用水平扩展或连接池承接真实写入压力" },
        { item: "API 请求超时", status: "已配置", detail: `${apiRequestPolicy.timeoutMs}ms 超时，避免页面长时间卡死` },
        { item: "API 请求重试", status: "已配置", detail: `5xx 或网络失败最多重试 ${apiRequestPolicy.retryCount} 次，使用递增退避` },
        { item: "本地状态容错", status: "已配置", detail: "localStorage 不可用或损坏时自动回退到默认演示状态" },
      ],
    },
    {
      group: "安全",
      items: [
        { item: "内容安全策略 CSP", status: "已配置", detail: "限制脚本来源、禁止对象嵌入和跨站 frame 嵌套" },
        { item: "API 地址校验", status: "已配置", detail: "阻止非 http(s)、非法字符和可疑健康检查路径" },
        { item: "XSS 输出转义", status: "已覆盖", detail: "用户可输入内容进入页面前统一 escapeHtml" },
        { item: "CSV 服务端终验", status: "交付要求", detail: "前端只做预检，正式写入必须由后端再次校验和审计" },
      ],
    },
    {
      group: "兼容性",
      items: [
        { item: "目标浏览器", status: "已定义", detail: "Chrome / Edge / Safari / Firefox 最近两个稳定版本" },
        { item: "无构建依赖", status: "已完成", detail: "原生 HTML/CSS/JS，降低浏览器和部署环境差异" },
        { item: "响应式桌面优先", status: "已完成", detail: "320px 起有基础降级，正式 Web 面向老师和管理员桌面使用" },
        { item: "缓存刷新", status: "已配置", detail: "入口带 no-store 和版本化 CSS，减少本地预览旧文件干扰" },
      ],
    },
  ];
}

function mergeState(target, source) {
  Object.entries(source || {}).forEach(([key, value]) => {
    if (["__proto__", "constructor", "prototype"].includes(key)) return;
    if (!(key in target)) return;
    if (value && typeof value === "object" && !Array.isArray(value) && target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      mergeState(target[key], value);
    } else {
      target[key] = value;
    }
  });
}

function hydrateState() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    if (saved.length > maxStorageBytes) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    mergeState(state, JSON.parse(saved));
    if (!["teacher", "admin", "manager"].includes(state.role)) {
      state.role = "teacher";
      state.route = "teacher-dashboard";
      state.loggedIn = false;
    }
    // Restore auth state from localStorage — verify async against /api/auth/me
    // Only force logout if the server tells us the token is invalid
    if (state.token) {
      verifyStoredToken(); // async check — kicks to login only on failure
    } else {
      state.loggedIn = false;
      state.token = null;
      state.authUser = null;
    }
    state.loginError = null;
    state.loginLoading = false;
    if (typeof state.route === "string" && state.route.startsWith("student-")) {
      state.role = "teacher";
      state.route = "teacher-dashboard";
    }
    if (!routeAllowedForRole(state.route, state.role)) {
      state.route = defaultRouteForRole(state.role);
    }
  } catch {
    window.localStorage.removeItem(storageKey);
  }
}

async function verifyStoredToken() {
  try {
    const base = state.apiBaseUrl || window.location.origin;
    const resp = await fetch(`${base}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    if (!resp.ok) {
      // Token invalid or expired — clear auth and show login
      state.token = null;
      state.authUser = null;
      state.loggedIn = false;
      renderRoute();
      return;
    }
    const data = await resp.json();
    state.authUser = data.user;
    state.role = data.user.role;
    // Preserve the user's saved route if valid for their role; fall back to server default
    if (!routeAllowedForRole(state.route, state.role)) {
      state.route = (data.routes && data.routes.length > 0) ? data.routes[0] : defaultRouteForRole(data.user.role);
    }
    state.loggedIn = true;
    loadAdminConfig(); // fire-and-forget: populate admin config from backend
    fetchTeacherCourses(); // fire-and-forget: load teacher courses
    fetchNotifications(); // fire-and-forget: load notification list
    if (state.role === "teacher") {
      redirectToTeacherApp();
      return;
    }
  } catch {
    // Server unreachable — keep token and auth state from storage, user stays logged in
    state.loggedIn = true;
    if (state.role === "teacher") {
      redirectToTeacherApp();
      return;
    }
  }
  renderRoute();
}

function saveState() {
  try {
    const serialized = JSON.stringify(state);
    if (serialized.length > maxStorageBytes) return;
    window.localStorage.setItem(storageKey, serialized);
  } catch {
    // Local preview can still run when storage is unavailable.
  }
}

const teacherNav = [
  ["teacher-dashboard", "课程工作台"],
  ["teacher-courses", "我的课程"],
  ["teacher-tasks", "课程任务"],
  ["teacher-import", "名单导入"],
  ["teacher-students", "学生名单"],
  ["teacher-progress", "打卡进度"],
  ["teacher-review", "异常审核"],
  ["teacher-exam", "专项考试"],
  ["teacher-attendance", "签到 / 平时分"],
  ["teacher-physical", "体测录入"],
  ["teacher-grades", "成绩汇总"],
  ["teacher-export", "成绩导出"],
  ["teacher-student-detail", "学生学时明细"],
  ["teacher-pending-certifications", "抵扣待确认"],
  ["teacher-scoring", "耐力跑换算"],
  ["teacher-exemptions", "免测审核"],
];

const adminNav = [
  ["admin-dashboard", "管理端首页"],
  ["admin-overview", "全校数据看板"],
  ["admin-semesters", "学期设置"],
  ["admin-courses", "课程与老师"],
  ["admin-users", "用户管理"],
  ["admin-sport-rules", "体育学时标准"],
  ["admin-grade-rules", "成绩规则"],
  ["admin-conversion", "体测换算表"],
  ["admin-export-template", "导出模板"],
  ["admin-teams", "校队管理"],
  ["admin-clubs", "社团管理"],
  ["admin-organization-audit", "组织抵扣审核"],
  ["admin-delivery-audit", "成绩归档审核"],
  ["admin-api-handoff", "接口联调交付"],
  ["admin-logs", "操作日志"],
  ["admin-student-detail", "学生学时明细"],
  ["admin-pending-certifications", "抵扣待确认"],
  ["admin-scoring", "耐力跑换算"],
  ["admin-exemptions", "免测审核"],
  ["admin-import-students", "学生导入"],
  ["admin-conversion-detail", "换算表详情"],
];

const managerNav = [
  ["manager-team", "校队成员认证"],
  ["manager-club", "社团成员认证"],
];

const backendEndpoints = [
  { group: "Auth", method: "POST", path: "/api/auth/login", route: "login", priority: "P0", note: "账号、角色、默认路由" },
  { group: "Auth", method: "GET", path: "/api/auth/me", route: "all", priority: "P0", note: "当前用户与路由权限" },
  { group: "Teacher", method: "GET", path: "/api/teacher/courses", route: "teacher-courses", priority: "P0", note: "老师可见课程" },
  { group: "Teacher", method: "GET", path: "/api/teacher/courses/{courseId}/dashboard", route: "teacher-dashboard", priority: "P0", note: "课程指标" },
  { group: "Teacher", method: "GET", path: "/api/teacher/courses/{courseId}/students", route: "teacher-students", priority: "P0", note: "课程名单与进度" },
  { group: "Teacher", method: "POST", path: "/api/teacher/courses/{courseId}/students/import/preview", route: "teacher-import", priority: "P0", note: "名单 CSV 预检" },
  { group: "Teacher", method: "POST", path: "/api/teacher/courses/{courseId}/students/import/confirm", route: "teacher-import", priority: "P0", note: "确认导入有效名单" },
  { group: "Teacher", method: "GET/POST/PATCH/DELETE", path: "/api/teacher/courses/{courseId}/tasks", route: "teacher-tasks", priority: "P0", note: "课程任务管理" },
  { group: "Reviews", method: "GET", path: "/api/teacher/courses/{courseId}/reviews", route: "teacher-review", priority: "P0", note: "异常打卡队列" },
  { group: "Reviews", method: "PUT", path: "/api/teacher/reviews/{reviewId}/decision", route: "teacher-review", priority: "P0", note: "通过、驳回、补材料" },
  { group: "Scores", method: "PUT", path: "/api/teacher/courses/{courseId}/scores/exam", route: "teacher-exam", priority: "P0", note: "专项考试批量保存" },
  { group: "Scores", method: "PUT", path: "/api/teacher/courses/{courseId}/scores/attendance", route: "teacher-attendance", priority: "P0", note: "签到/平时分批量保存" },
  { group: "Scores", method: "PUT", path: "/api/teacher/courses/{courseId}/scores/physical", route: "teacher-physical", priority: "P0", note: "体测原始数据与换算分" },
  { group: "Scores", method: "GET", path: "/api/teacher/courses/{courseId}/grades", route: "teacher-grades", priority: "P0", note: "四块成绩汇总" },
  { group: "Export", method: "GET", path: "/api/teacher/courses/{courseId}/export/precheck", route: "teacher-export", priority: "P0", note: "导出阻断检查" },
  { group: "Export", method: "GET", path: "/api/teacher/courses/{courseId}/export", route: "teacher-export", priority: "P0", note: "CSV/XLSX 成绩表" },
  { group: "Delivery", method: "POST", path: "/api/teacher/courses/{courseId}/delivery", route: "teacher-export", priority: "P0", note: "老师提交体育部归档" },
  { group: "Admin", method: "GET", path: "/api/admin/overview", route: "admin-overview", priority: "P0", note: "全校课程健康度" },
  { group: "Admin", method: "GET/POST", path: "/api/admin/semesters", route: "admin-semesters", priority: "P1", note: "学期配置" },
  { group: "Admin", method: "GET/POST", path: "/api/admin/courses", route: "admin-courses", priority: "P1", note: "课程与老师配置" },
  { group: "Admin", method: "GET/POST", path: "/api/admin/users", route: "admin-users", priority: "P1", note: "Web 用户配置" },
  { group: "Admin", method: "GET/PUT", path: "/api/admin/sport-rules", route: "admin-sport-rules", priority: "P0", note: "体育学时标准" },
  { group: "Admin", method: "GET/PUT", path: "/api/admin/grade-rules", route: "admin-grade-rules", priority: "P0", note: "成绩权重" },
  { group: "Admin", method: "GET/POST", path: "/api/admin/conversion-rules", route: "admin-conversion", priority: "P1", note: "体测换算表" },
  { group: "Admin", method: "GET/PUT", path: "/api/admin/export-template", route: "admin-export-template", priority: "P0", note: "导出模板字段" },
  { group: "Organizations", method: "GET/POST", path: "/api/admin/organizations", route: "admin-teams / admin-clubs", priority: "P1", note: "校队/社团配置" },
  { group: "Organizations", method: "GET/POST", path: "/api/manager/memberships", route: "manager-team / manager-club", priority: "P0", note: "组织负责人新增认证" },
  { group: "Organizations", method: "POST", path: "/api/manager/memberships/import/preview", route: "manager-team / manager-club", priority: "P0", note: "成员 CSV 预检" },
  { group: "Organizations", method: "POST", path: "/api/manager/memberships/import/confirm", route: "manager-team / manager-club", priority: "P0", note: "确认导入成员" },
  { group: "Organizations", method: "PUT", path: "/api/manager/memberships/{membershipId}/decision", route: "manager-team / manager-club", priority: "P0", note: "负责人确认/驳回" },
  { group: "Organizations", method: "PUT", path: "/api/admin/memberships/{membershipId}/decision", route: "admin-organization-audit", priority: "P0", note: "管理员复核抵扣" },
  { group: "Delivery", method: "GET", path: "/api/admin/deliveries", route: "admin-delivery-audit", priority: "P0", note: "成绩归档审核列表" },
  { group: "Delivery", method: "PUT", path: "/api/admin/deliveries/{courseId}/decision", route: "admin-delivery-audit", priority: "P0", note: "确认归档/退回/提醒" },
  { group: "Logs", method: "GET", path: "/api/admin/logs", route: "admin-logs", priority: "P1", note: "操作日志" },
  { group: "v4", method: "GET", path: "/api/teacher/courses/{courseId}/students/{studentId}/hours-detail", route: "teacher-student-detail", priority: "P0", note: "学生学时来源聚合" },
  { group: "v4", method: "POST", path: "/api/teacher/courses/{courseId}/students/{studentId}/manual-credit", route: "teacher-student-detail", priority: "P0", note: "老师手动加抵卡" },
  { group: "v4", method: "GET", path: "/api/teacher/courses/{courseId}/pending-certifications", route: "teacher-pending-certifications", priority: "P0", note: "待确认抵扣列表" },
  { group: "v4", method: "PUT", path: "/api/teacher/certifications/{certId}/confirm", route: "teacher-pending-certifications", priority: "P0", note: "确认校队/社团抵扣" },
  { group: "v4", method: "PUT", path: "/api/teacher/certifications/{certId}/reject", route: "teacher-pending-certifications", priority: "P0", note: "驳回抵扣" },
  { group: "v4", method: "GET", path: "/api/admin/conversion-table/{gradeGroup}/{gender}", route: "admin-conversion-detail", priority: "P1", note: "获取换算表" },
  { group: "v4", method: "PUT", path: "/api/admin/conversion-table/{gradeGroup}/{gender}", route: "admin-conversion-detail", priority: "P1", note: "批量配置换算表" },
  { group: "v4", method: "POST", path: "/api/admin/conversion-table/validate", route: "admin-conversion-detail", priority: "P1", note: "验证换算表无空档" },
  { group: "v4", method: "GET", path: "/api/teacher/conversion/calculate", route: "teacher-physical", priority: "P0", note: "根据学生ID+原始成绩返回换算分" },
  { group: "v4", method: "GET", path: "/api/teacher/courses/{courseId}/exemptions", route: "teacher-exemptions", priority: "P0", note: "课程范围免测申请" },
  { group: "v4", method: "GET", path: "/api/teacher/courses/{courseId}/students/{studentId}/organization-identity", route: "teacher-student-detail", priority: "P0", note: "老师查看学生组织身份" },
  { group: "v4", method: "PUT", path: "/api/teacher/students/{studentId}/organization-identity/{identityId}/flag", route: "teacher-student-detail", priority: "P0", note: "老师标记确认/存疑" },
];

// ── Teacher course list (API-backed with hardcoded fallback) ─────
var hardcodedCourseDefaults = {
  gepe:       { courseHours: 6.4, generalHours: 8.8, exportState: '待清理', deadline: '第 6 周周日 23:59' },
  basketball: { courseHours: 7.2, generalHours: 8.1, exportState: '可预检', deadline: '第 8 周周五 18:00' },
  fitness:    { courseHours: 5.8, generalHours: 7.4, exportState: '待清理', deadline: '第 7 周周日 23:59' },
};

async function fetchTeacherCourses() {
  if (!state.token && !isApiLive()) return;
  var data = await apiFetchJsonSafe('/api/teacher/courses');
  if (data && data.length > 0) {
    state.courses = data.map(function(r) {
      var defaults = hardcodedCourseDefaults[r.id] || { courseHours: 0, generalHours: 0, exportState: '待设置', deadline: '待设置' };
      return {
        id: r.id,
        code: r.code || '',
        section: r.section || '',
        name: r.name || '',
        semester: r.semester || '',
        students: r.actualStudents || r.students || 0,
        pending: r.pending || 0,
        completion: r.completion || 0,
        missing: r.missing || 0,
        teacher: r.teacher || '',
        courseHours: defaults.courseHours,
        generalHours: defaults.generalHours,
        exportState: defaults.exportState,
        deadline: defaults.deadline,
      };
    });
  }
}

async function fetchCourseStudents(courseId) {
  if (!state.token && !isApiLive()) return;
  var data = await apiFetchJsonSafe('/api/teacher/courses/' + encodeURIComponent(courseId) + '/students');
  if (Array.isArray(data)) {
    state.rosters[courseId] = data.map(function(student) {
      return {
        id: student.id,
        name: student.name || '',
        college: student.college || '',
        course: Number(student.course || 0),
        general: Number(student.general || 0),
        rawGeneral: Number(student.rawGeneral ?? student.general ?? 0),
        exam: Number(student.exam || 0),
        attendance: Number(student.attendance || 0),
        physical: Number(student.physical || 0),
        status: student.status || '',
        className: student.className || '',
        organizationCredit: student.organizationCredit || null,
        source: 'api',
      };
    });
    state.rosterSources = state.rosterSources || {};
    state.rosterSources[courseId] = 'api';
  }
}

function rosterLoadedFromApi(courseId = state.courseId) {
  return Boolean(state.rosterSources && state.rosterSources[courseId] === 'api');
}

function ensureCourseRosterLoaded(courseId = state.courseId) {
  loadRouteDataOnce(
    `course-roster:${courseId}`,
    () => rosterLoadedFromApi(courseId),
    () => fetchCourseStudents(courseId)
  );
}

function allCourses() {
  if (state.courses && state.courses.length > 0) return state.courses;
  return courses;
}

function currentCourse() {
  var list = allCourses();
  return list.find(function(c) { return c.id === state.courseId; }) || list[0];
}

function courseSection(course = currentCourse()) {
  return normalizeSection(course.section || "1004") || "1004";
}

function normalizeSection(value) {
  return String(value || "")
    .trim()
    .replace(/^section\s*[:#-]?\s*/i, "")
    .replace(/^sec\s*[:#-]?\s*/i, "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function sectionDisplay(value = courseSection()) {
  const section = normalizeSection(value);
  return section ? `Section ${section}` : "Section 1004";
}

function courseOfferingLabel(course = currentCourse()) {
  return `${course.code} / ${sectionDisplay(courseSection(course))}`;
}

function defaultRouteForRole(role = state.role) {
  if (role === "admin") return "admin-dashboard";
  if (role === "manager") return "manager-team";
  return "teacher-dashboard";
}

function routeAllowedForRole(route = state.route, role = state.role) {
  const nav = role === "admin" ? adminNav : role === "manager" ? managerNav : teacherNav;
  return nav.some(([id]) => id === route);
}

function sportRuleTargets() {
  const rules = state.admin.sportRules;
  return {
    courseRequired: Number(rules.courseRequired) || 10,
    generalRequired: Number(rules.generalRequired) || 10,
    total: Number(rules.total) || 20,
  };
}

function clampScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function average(values) {
  const clean = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function courseScoreStore(courseId = state.courseId) {
  if (!state.scoreBook[courseId]) state.scoreBook[courseId] = {};
  return state.scoreBook[courseId];
}

function defaultScoreRecord(student, index) {
  const baseExam = Number(student.exam) || 0;
  const examItems = baseExam > 0 ? [0, 1, 2].map((itemIndex) => clampScore(Math.max(60, baseExam - itemIndex * 3 + index))) : [0, 0, 0];
  return {
    examItems,
    exam: average(examItems),
    attendanceWeeks: {
      week6: index === 1 ? "迟到" : "出勤",
      week7: "出勤",
    },
    attendance: student.attendance,
    physicalItems: {
      endurance: index % 2 ? "4:12" : "3:58",
      sprint: index % 2 ? "8.6" : "8.1",
      jump: index % 2 ? "2.12" : "2.28",
    },
    physical: student.physical,
    examStatus: "草稿",
    attendanceStatus: "已保存",
    physicalStatus: "已保存",
  };
}

function scoreRecordForStudent(student, index, courseId = state.courseId) {
  const store = courseScoreStore(courseId);
  if (!store[student.id]) store[student.id] = defaultScoreRecord(student, index);
  return store[student.id];
}

function formatDateTime(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function logAction(actor, action, target) {
  state.logs.unshift({
    id: `log${Date.now()}${Math.round(Math.random() * 1000)}`,
    actor,
    action,
    target,
    time: formatDateTime(),
  });
}

function organizationConfigForMembership(membership) {
  const collection = membership.type === "team" ? state.admin.teams : state.admin.clubs;
  return collection.find((item) => item.name === membership.organization) || null;
}

function organizationCanOffset(membership) {
  const config = organizationConfigForMembership(membership);
  if (membership.type === "team") return config ? config.offset === "可抵扣" : true;
  return Boolean(config && config.type.includes("体育") && config.offset === "可抵扣");
}

function organizationCreditForStudent(studentId) {
  return (
    state.memberships.find(
      (membership) =>
        membership.studentId === studentId &&
        membership.status === "认证有效" &&
        membership.offset === "可抵扣" &&
        organizationCanOffset(membership),
    ) || null
  );
}

function membershipOffsetState(membership) {
  if (membership.status !== "认证有效") return "未生效";
  if (membership.offset !== "可抵扣") return "不抵扣";
  return organizationCanOffset(membership) ? "抵扣生效" : "规则不允许";
}

function organizationOptions(type) {
  const collection = type === "team" ? state.admin.teams : state.admin.clubs;
  return collection.map((item) => item.name);
}

function seedRoster(courseId) {
  const offset = Math.max(0, courses.findIndex((item) => item.id === courseId));
  return baseStudents.map((student, index) => ({
      ...student,
      course: Math.max(0, Math.min(10, student.course + offset - (index % 2))),
      general: Math.max(0, Math.min(10, student.general - offset + (index % 3 === 0 ? 0 : 1))),
    source: "seed",
  }));
}

function courseRoster(courseId = state.courseId) {
  if (!state.rosters[courseId]) {
    state.rosters[courseId] = seedRoster(courseId);
    state.rosterSources = state.rosterSources || {};
    if (!state.rosterSources[courseId]) state.rosterSources[courseId] = "seed";
  }
  return state.rosters[courseId];
}

function progressStatus(student) {
  const targets = sportRuleTargets();
  if (student.course >= targets.courseRequired && student.general >= targets.generalRequired) return "已完成";
  if (student.status === "风险较高" || student.physical < 70) return "风险较高";
  const courseGap = Math.max(0, targets.courseRequired - student.course);
  const generalGap = Math.max(0, targets.generalRequired - student.general);
  if (courseGap && generalGap) return `差课程 ${courseGap}h / 其他 ${generalGap}h`;
  if (courseGap) return `差课程 ${courseGap}h`;
  if (generalGap) return `差其他 ${generalGap}h`;
  return "待确认";
}

function studentsForCourse(courseId = state.courseId) {
  const targets = sportRuleTargets();
  return courseRoster(courseId).map((student, index) => {
    const score = scoreRecordForStudent(student, index, courseId);
    const organizationCredit = organizationCreditForStudent(student.id);
    const rawGeneral = Number(student.general || 0);
    const effectiveGeneral = organizationCredit ? Math.max(rawGeneral, targets.generalRequired) : rawGeneral;
    return {
      ...student,
      rawGeneral,
      general: effectiveGeneral,
      exam: score.exam,
      attendance: score.attendance,
      physical: score.physical,
      organizationCredit,
      status: progressStatus({ ...student, general: effectiveGeneral, exam: score.exam, attendance: score.attendance, physical: score.physical }),
      score,
    };
  });
}

function courseMetrics(courseId = state.courseId) {
  // Prefer API dashboard data when available
  const cached = state.dashboardCache && state.dashboardCache[courseId];
  if (cached) {
    const unresolvedReviews = state.reviews.filter((item) => (item.courseId || "gepe") === courseId && !["已通过", "已驳回"].includes(item.status)).length;
    return {
      students: cached.students || 0,
      pending: unresolvedReviews || cached.pending || 0,
      completion: cached.completion || 0,
      missing: cached.missing || 0,
      courseHours: Number(cached.courseHours || 0).toFixed(1),
      generalHours: Number(cached.generalHours || 0).toFixed(1),
      exportState: cached.exportState || "待清理",
    };
  }
  const students = studentsForCourse(courseId);
  const targets = sportRuleTargets();
  const completeCount = students.filter((student) => student.course >= targets.courseRequired && student.general >= targets.generalRequired).length;
  const unresolvedReviews = state.reviews.filter((item) => (item.courseId || "gepe") === courseId && !["已通过", "已驳回"].includes(item.status)).length;
  const missing = students.length - completeCount;
  const avgCourse = students.length ? students.reduce((sum, student) => sum + student.course, 0) / students.length : 0;
  const avgGeneral = students.length ? students.reduce((sum, student) => sum + student.general, 0) / students.length : 0;
  const completion = students.length ? Math.round((completeCount / students.length) * 100) : 0;
  return {
    students: students.length,
    pending: unresolvedReviews,
    completion,
    missing,
    courseHours: avgCourse.toFixed(1),
    generalHours: avgGeneral.toFixed(1),
    exportState: missing || unresolvedReviews ? "待清理" : "可导出",
  };
}

function reviewsForCourse(courseId = state.courseId) {
  return state.reviews.filter((item) => (item.courseId || "gepe") === courseId);
}

function filteredReviewsForCourse() {
  const keyword = state.reviewSearch.trim().toLowerCase();
  return reviewsForCourse().filter((review) => {
    const isClosed = ["已通过", "已驳回"].includes(review.status);
    const matchesKeyword = !keyword || review.name.toLowerCase().includes(keyword) || review.studentId.includes(keyword) || review.risk.toLowerCase().includes(keyword);
    const matchesStatus =
      state.reviewStatusFilter === "all" ||
      (state.reviewStatusFilter === "open" && !isClosed) ||
      (state.reviewStatusFilter === "safe" && review.status === "可通过") ||
      (state.reviewStatusFilter === "risk" && ["待确认", "需复核", "补材料"].includes(review.status)) ||
      (state.reviewStatusFilter === "closed" && isClosed);
    return matchesKeyword && matchesStatus;
  });
}

function activeReview() {
  const reviews = reviewsForCourse();
  return reviews.find((item) => item.id === state.activeReviewId) || reviews[0] || null;
}

function filteredStudents() {
  const keyword = state.studentSearch.trim().toLowerCase();
  return studentsForCourse().filter((student) => {
    const targets = sportRuleTargets();
    const status = student.course >= targets.courseRequired && student.general >= targets.generalRequired ? "complete" : student.status === "风险较高" ? "risk" : "incomplete";
    const matchesKeyword = !keyword || student.name.toLowerCase().includes(keyword) || student.id.includes(keyword);
    const matchesStatus =
      state.studentFilter === "all" ||
      (state.studentFilter === "complete" && status === "complete") ||
      (state.studentFilter === "incomplete" && status === "incomplete") ||
      (state.studentFilter === "risk" && status === "risk");
    return matchesKeyword && matchesStatus;
  });
}

function tasksForCourse(courseId = state.courseId) {
  return state.tasks.filter((task) => task.courseId === courseId);
}

function filteredTasksForCourse(courseId = state.courseId) {
  return tasksForCourse(courseId).filter((task) => state.taskStatusFilter === "all" || task.status === state.taskStatusFilter);
}

function exportIssues(courseId = state.courseId) {
  const students = studentsForCourse(courseId);
  const targets = sportRuleTargets();
  const missingPhysical = students.filter((student) => !student.physical || student.physical < 70);
  const checkinNotEnough = students.filter((student) => student.course < targets.courseRequired || student.general < targets.generalRequired);
  const unresolvedReviews = reviewsForCourse(courseId).filter((item) => !["已通过", "已驳回"].includes(item.status));
  return {
    missingPhysical,
    checkinNotEnough,
    unresolvedReviews,
    templateMatched: state.admin.exportTemplate.status === "已匹配",
  };
}

function exportBlocked(issues = exportIssues()) {
  return issues.missingPhysical.length > 0 || issues.checkinNotEnough.length > 0 || issues.unresolvedReviews.length > 0 || !issues.templateMatched;
}

function issueCount(issues) {
  return issues.missingPhysical.length + issues.checkinNotEnough.length + issues.unresolvedReviews.length + (issues.templateMatched ? 0 : 1);
}

function deliveryRecordForCourse(courseId = state.courseId) {
  let record = state.deliveryRecords.find((item) => item.courseId === courseId);
  if (!record) {
    record = {
      courseId,
      status: "未提交",
      submittedAt: "-",
      submittedBy: "体育任课老师",
      issueCount: 0,
      comment: "等待老师提交导出预检",
    };
    state.deliveryRecords.push(record);
  }
  return record;
}

async function submitDeliveryForCurrentCourse() {
  const course = currentCourse();
  const issues = exportIssues(course.id);
  const blocked = exportBlocked(issues);
  const count = issueCount(issues);
  const record = deliveryRecordForCourse(course.id);
  record.status = blocked ? "待清理" : "待管理员确认";
  record.submittedAt = formatDateTime();
  record.submittedBy = "体育任课老师";
  record.issueCount = count;
  record.comment = blocked ? `预检提交：仍有 ${count} 项问题，需要清理后再归档。` : "预检通过，等待体育部管理员确认归档。";
  record.updatedAt = record.submittedAt;

  const result = await apiFetchJsonSafe(`/api/teacher/courses/${course.id}/delivery`, {
    method: 'POST',
    body: JSON.stringify({ comment: record.comment }),
  });
  if (result) {
    record.status = result.status || record.status;
    record.id = result.id || record.id;
    setTeacherNotice(`${courseOfferingLabel(course)} 成绩预检已提交到服务器。${blocked ? `仍有 ${count} 项问题。` : "预检通过！"}`);
  } else {
    logAction("体育任课老师", "提交成绩预检", `${courseOfferingLabel(course)} / ${record.status}`);
    setTeacherNotice(blocked ? `${courseOfferingLabel(course)} 预检已本地保存，但仍有 ${count} 项问题。` : `${courseOfferingLabel(course)} 预检已本地保存。`);
  }
}

function taskStatsForCourse(courseId) {
  const courseTasks = tasksForCourse(courseId);
  return {
    total: courseTasks.length,
    active: courseTasks.filter((task) => task.status === "进行中").length,
    draft: courseTasks.filter((task) => task.status === "草稿").length,
    closed: courseTasks.filter((task) => task.status === "已关闭").length,
  };
}

function courseHealthRows() {
  return allCourses().map((course) => {
    const metrics = courseMetrics(course.id);
    const issues = exportIssues(course.id);
    const count = issueCount(issues);
    const delivery = deliveryRecordForCourse(course.id);
    const tasks = taskStatsForCourse(course.id);
    const health =
      delivery.status === "已归档"
        ? "已归档"
        : delivery.status === "待管理员确认" && count === 0
          ? "可归档"
          : count > 0 || metrics.pending > 0 || metrics.missing > 0
            ? "需跟进"
            : "正常";
    return {
      course,
      metrics,
      issues,
      issueCount: count,
      delivery,
      tasks,
      health,
    };
  });
}

function filteredCourseHealthRows() {
  return courseHealthRows().filter((row) => {
    if (state.adminCourseFilter === "all") return true;
    if (state.adminCourseFilter === "risk") return row.health === "需跟进";
    if (state.adminCourseFilter === "ready") return row.health === "可归档" || row.health === "正常";
    if (state.adminCourseFilter === "archived") return row.delivery.status === "已归档";
    return true;
  });
}

function statusClass(value) {
  if (["已完成", "可通过", "已通过", "正常", "已匹配", "可预检", "认证有效", "进行中", "已保存", "已录入", "可抵扣", "抵扣生效", "已归档", "可归档", "已配置", "已覆盖", "已定义", "前端就绪", "ok", "已支持"].includes(value)) return "ok";
  if (["需复核", "待清理", "待确认", "待审核", "待认证", "草稿", "未生效", "未提交", "待管理员确认", "需跟进", "交付要求", "降级", "待浏览器验证", "warn"].includes(value)) return "warn";
  if (["补材料", "已驳回", "风险较高", "缺失", "不通过", "不抵扣", "规则不允许", "非体育类", "已关闭", "退回清理", "bad"].includes(value)) return "bad";
  if (typeof value === "string" && value.startsWith("差")) return "warn";
  return "neutral";
}

function gradeWeights() {
  const weights = {
    checkin: 0.25,
    exam: 0.3,
    attendance: 0.2,
    physical: 0.25,
  };
  state.admin.gradeRules.forEach((rule) => {
    weights[rule.key] = Number(rule.weight || 0) / 100;
  });
  return weights;
}

function checkinScore(student) {
  const targets = sportRuleTargets();
  const completed = Math.min(student.course, targets.courseRequired) + Math.min(student.general, targets.generalRequired);
  return Math.round((completed / targets.total) * 100);
}

function gradeTotal(student) {
  const weights = gradeWeights();
  return Math.round(
    checkinScore(student) * weights.checkin +
      student.exam * weights.exam +
      student.attendance * weights.attendance +
      student.physical * weights.physical,
  );
}

function gradeBreakdown(student) {
  const weights = gradeWeights();
  const checkin = checkinScore(student);
  return {
    checkinScore: checkin,
    checkinWeighted: Math.round(checkin * weights.checkin),
    examWeighted: Math.round(student.exam * weights.exam),
    attendanceWeighted: Math.round(student.attendance * weights.attendance),
    physicalWeighted: Math.round(student.physical * weights.physical),
    total: gradeTotal(student),
  };
}

function gradeSourceSummary(student) {
  const approvedReviews = reviewsForCourse().filter((review) => review.studentId === student.id && review.status === "已通过");
  const checkinSource = student.organizationCredit
    ? `组织抵扣：${student.organizationCredit.organization}`
    : approvedReviews.length
      ? `审核通过 ${approvedReviews.length} 条`
      : "打卡累计";
  return {
    roster: student.source === "import" ? "CSV 导入" : "课程初始名单",
    checkin: checkinSource,
    exam: student.score.examStatus,
    attendance: student.score.attendanceStatus,
    physical: student.score.physicalStatus,
  };
}

function progressBar(value, max = 10) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return `<div class="progress-bar"><span style="width:${pct}%"></span></div>`;
}

function renderLogo() {
  return `<div class="brand-mark" role="img" aria-label="BNBU 黑白校徽标识">${logoSvg}</div>`;
}

function renderLogin() {
  app.innerHTML = `
    <div class="auth-shell">
      <aside class="auth-brand">
        <div class="auth-brand-inner">
          <span class="brand-mark">BNBU</span>
          <span class="brand-sub">Sports 管理端</span>
          <h1>体育成绩管理系统</h1>
          <p class="auth-brand-desc">面向 BNBU 体育部的 Web 工作台。打卡审核、考试录入、体测换算与成绩导出，统一在一个可靠流程中完成。</p>
          <div class="auth-features">
            <div class="auth-feature">
              <span class="auth-feature-icon" aria-hidden="true">📋</span>
              <div><strong>教师 Material 工作台</strong><span>打卡全览、审核、体测与成绩汇总</span></div>
            </div>
            <div class="auth-feature">
              <span class="auth-feature-icon" aria-hidden="true">⚙️</span>
              <div><strong>管理员配置中心</strong><span>学期、课程、规则与导出模板</span></div>
            </div>
            <div class="auth-feature">
              <span class="auth-feature-icon" aria-hidden="true">🏅</span>
              <div><strong>组织负责人</strong><span>校队 / 社团 membership 与抵扣确认</span></div>
            </div>
          </div>
        </div>
        <p class="auth-brand-footer">BNBU Sports · 2025–2026</p>
      </aside>
      <main class="auth-main">
        <div class="auth-card">
          <header class="auth-card-header">
            <h2>统一登录</h2>
            <p>体育任课老师登录后将进入 Material 教师工作台</p>
          </header>
          <form class="auth-form" data-action="login">
            <div class="auth-field">
              <label for="loginAccount">账号</label>
              <input id="loginAccount" value="" aria-label="账号" autocomplete="username" placeholder="工号 / 邮箱" />
            </div>
            <div class="auth-field">
              <label for="loginPassword">密码</label>
              <input id="loginPassword" type="password" value="" aria-label="密码" autocomplete="current-password" placeholder="请输入密码" />
            </div>
            <div class="auth-field">
              <label for="loginRole">登录角色</label>
              <select id="loginRole" name="role" aria-label="角色">
                <option value="teacher">体育任课老师</option>
                <option value="admin">体育部管理员</option>
                <option value="manager">校队 / 社团负责人</option>
              </select>
            </div>
            ${state.loginError ? `<div class="auth-error"><p>${escapeHtml(state.loginError)}</p></div>` : ""}
            <button class="auth-submit" type="submit" ${state.loginLoading ? "disabled" : ""}>${state.loginLoading ? "登录中…" : "进入系统"}</button>
            <div class="auth-role-hint"><strong>提示：</strong>选择「体育任课老师」并登录成功后，将自动跳转至与左侧品牌一致的 Material 教师端界面。</div>
          </form>
          <div class="auth-divider">或快速体验演示</div>
          <p class="auth-demo-label">无需账号，一键进入各角色演示环境</p>
          <div class="auth-demo-grid">
            <button class="auth-demo-btn" type="button" data-action="quick-teacher">教师端<em>Material UI</em></button>
            <button class="auth-demo-btn" type="button" data-action="quick-admin">管理员<em>配置中心</em></button>
            <button class="auth-demo-btn" type="button" data-action="quick-manager">负责人<em>组织管理</em></button>
          </div>
        </div>
      </main>
    </div>
  `;
}

function navForRole() {
  if (state.role === "admin") return adminNav;
  if (state.role === "manager") return managerNav;
  return teacherNav;
}

function routeTitle() {
  const route = navForRole().find(([id]) => id === state.route);
  return route ? route[1] : "工作台";
}

function renderNotificationBell() {
  var unread = unreadNotificationCount();
  return [
    '<button type="button" class="icon-button notification-bell" aria-label="通知" data-action="toggle-notifications">',
    '<span class="bell-icon">🔔</span>',
    unread > 0 ? '<span class="notification-badge">' + unread + '</span>' : '',
    '</button>'
  ].join('');
}

function renderNotificationPanel() {
  var list = state.notifications || [];
  var unread = unreadNotificationCount();
  var html = '';
  html += '<div class="notification-dropdown' + (state.notificationsOpen ? ' is-open' : '') + '">';
  html += '<div class="notification-header">';
  html += '<strong>通知</strong>';
  if (unread > 0) {
    html += '<span class="notification-header-badge">' + unread + ' 条未读</span>';
    html += '<button type="button" class="text-button" data-action="mark-all-read">全部已读</button>';
  }
  html += '</div>';
  html += '<div class="notification-list">';
  if (list.length === 0) {
    html += '<p class="notification-empty">暂无通知</p>';
  } else {
    for (var i = 0; i < list.length; i++) {
      var n = list[i];
      html += '<div class="notification-item' + (n.isUnread ? ' is-unread' : '') + '" data-action="mark-read" data-notif-id="' + n.id + '">';
      html += '<div class="notification-item-top">';
      html += '<span class="notification-category cat-' + (n.category || 'system') + '">' + categoryLabel(n.category) + '</span>';
      html += '<span class="notification-time">' + formatNotificationTime(n.time) + '</span>';
      html += '</div>';
      html += '<p class="notification-title">' + escapeHtml(n.title || '') + '</p>';
      html += '<p class="notification-message">' + escapeHtml(n.message || '') + '</p>';
      html += '</div>';
    }
  }
  html += '</div></div>';
  return html;
}

function renderCourseSwitcher() {
  if (state.role !== "teacher") return "";
  var list = allCourses();
  return `
    <div class="course-switcher">
      <button type="button" class="ghost-button course-switch-button" aria-expanded="false">切换课程</button>
      <div class="course-menu" aria-label="课程切换菜单">
        ${list
          .map(
            (course) => `
              <button type="button" class="${course.id === state.courseId ? "is-current" : ""}" data-course="${course.id}">
                <strong>${courseOfferingLabel(course)}</strong>
                <span>${course.name}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderLayout(content) {
  const course = currentCourse();
  const title = state.role === "teacher" ? course.name : routeTitle();
  const meta = state.role === "teacher" ? `${course.semester} / ${courseOfferingLabel(course)}` : "BNBU Sports · 体育成绩管理";
  const roleName = state.role === "teacher" ? "体育任课老师" : state.role === "admin" ? "体育部管理员" : "组织负责人";
  const navGroupTitle = state.role === "admin" ? "系统管理" : state.role === "manager" ? "组织管理" : "教学工作";
  app.innerHTML = `
    <div class="app-shell material-shell">
      <aside class="sidebar">
        <div class="material-brand">
          <span class="brand-mark">BNBU</span>
          <span class="brand-sub">Sports 管理端</span>
        </div>
        <nav class="nav-list">
          <div class="nav-section">${navGroupTitle}</div>
          ${navForRole()
            .map(([id, label]) => `<button class="nav-item ${state.route === id ? "is-active" : ""}" data-route="${id}">${label}</button>`)
            .join("")}
        </nav>
        <div class="sidebar-footer">
          <p class="sidebar-user-label">当前账号</p>
          <strong>${state.authUser?.name || roleName}</strong>
          <span>${state.authUser?.email || state.role + "@bnbu.edu.cn"}</span>
          <div class="button-row">
            <button class="ghost-button" type="button" data-action="logout">退出登录</button>
            <button class="ghost-button" type="button" data-action="reset-demo">重置演示</button>
          </div>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div>
            <p class="topbar-meta">${meta}</p>
            <h2>${title}</h2>
          </div>
          <div class="top-actions">
            ${renderNotificationBell()}
            ${renderNotificationPanel()}
            ${renderCourseSwitcher()}
            ${state.role === "teacher" ? `<button type="button" class="primary-button" data-route="teacher-tasks">创建任务</button>` : ""}
          </div>
        </header>
        <section class="page">${content}</section>
      </main>
    </div>
  `;
}

function renderDashboard() {
  const course = currentCourse();
  const metrics = courseMetrics();
  const targets = sportRuleTargets();
  return `
    <section class="hero-grid">
      <div class="hero-title">
        <p class="eyebrow">COURSE CONTROL</p>
        <h3>${metrics.students} 名学生<br />${metrics.pending} 条待审核<br />${metrics.completion}% 完成率</h3>
      </div>
      <div class="metric-strip">
        <article class="metric-cell"><span>课程相关</span><strong>${metrics.courseHours} / ${targets.courseRequired}h</strong><small>平均完成</small></article>
        <article class="metric-cell"><span>其他运动</span><strong>${metrics.generalHours} / ${targets.generalRequired}h</strong><small>含组织抵扣</small></article>
        <article class="metric-cell"><span>缺失项</span><strong>${metrics.missing}</strong><small>学生需处理</small></article>
        <article class="metric-cell"><span>导出状态</span><strong>${metrics.exportState}</strong><small>${metrics.pending} 个异常</small></article>
      </div>
    </section>
    <section class="content-grid">
      ${panel("待审核记录", "REVIEW QUEUE", renderReviewQueue())}
      <aside class="side-stack">
        ${panel("下一截止", "NEXT DEADLINE", `
          <div class="panel-body">
            <h3>${course.deadline}</h3>
            <div style="display:grid;gap:18px;margin-top:20px">
              <div><strong>课程相关完成</strong>${progressBar(Number(metrics.courseHours), targets.courseRequired)}</div>
              <div><strong>其他运动完成</strong>${progressBar(Number(metrics.generalHours), targets.generalRequired)}</div>
              <div><strong>成绩可导出</strong>${progressBar(metrics.completion, 100)}</div>
            </div>
          </div>
        `)}
        ${panel("当前异常", "SELECTED RECORD", renderSelectedReviewSummary())}
      </aside>
      ${panel("学生打卡进度", "STUDENT PROGRESS", renderProgressRows())}
      ${panel("四块成绩", "GRADE MIX", renderGradeMix())}
      ${panel("期末导出检查", "PRE EXPORT CHECK", renderExportTiles(), "panel-wide")}
    </section>
  `;
}

function renderReviewQueue() {
  const reviews = reviewsForCourse();
  if (!reviews.length) return `<div class="empty">当前课程暂无待审核记录。</div>`;
  return `
    <div class="table-wrap">
      <table class="review-table">
        <thead><tr><th>学生</th><th>类型</th><th>申请</th><th>风险</th><th>状态</th><th>处理</th></tr></thead>
        <tbody>
          ${reviews
            .map(
              (item) => `
                <tr class="${item.id === state.activeReviewId ? "is-hot" : ""}" data-review="${item.id}">
                  <td><strong>${escapeHtml(item.name)}</strong><br /><small>${escapeHtml(item.studentId)}</small></td>
                  <td>${escapeHtml(item.type)}</td>
                  <td>${item.hours}h</td>
                  <td>${escapeHtml(item.risk)}</td>
                  <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                  <td><button class="ghost-button" data-route="teacher-review">查看</button></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSelectedReviewSummary() {
  const active = activeReview();
  if (!active) return `<div class="empty">没有选中的异常记录。</div>`;
  return `
    <div class="panel-body selected-record">
      <div>
        <span class="status ${statusClass(active.status)}">${escapeHtml(active.status)}</span>
        <h3>${escapeHtml(active.name)}</h3>
        <p class="muted">${escapeHtml(active.studentId)} / ${escapeHtml(active.type)} / ${active.hours}h</p>
      </div>
      <dl>
        <dt>提交任务</dt>
        <dd>${escapeHtml(active.task)}</dd>
        <dt>异常原因</dt>
        <dd>${escapeHtml(active.reason)}</dd>
      </dl>
      <button class="primary-button" data-route="teacher-review">进入审核</button>
    </div>
  `;
}

function panel(title, eyebrow, body, extraClass = "") {
  return `
    <section class="panel ${extraClass}">
      <div class="panel-header">
        <div>
          <p class="eyebrow">${eyebrow}</p>
          <h3>${title}</h3>
        </div>
      </div>
      ${body}
    </section>
  `;
}

function renderReviewTable(compact = false) {
  const allReviews = reviewsForCourse();
  const reviews = compact ? allReviews : filteredReviewsForCourse();
  const active = reviews.find((item) => item.id === state.activeReviewId) || reviews[0] || activeReview();
  const activeProofFiles = safeProofUrls(active?.proofFiles);
  if (!allReviews.length || !active) return `<div class="empty">当前课程暂无异常打卡记录。</div>`;
  const controls = compact
    ? ""
    : `
      <div class="panel-body review-toolbar">
        <div class="form-grid">
          <div class="field"><label for="reviewSearch">搜索异常</label><input id="reviewSearch" data-review-search placeholder="姓名 / 学号 / 风险" value="${escapeHtml(state.reviewSearch)}" /></div>
          <div class="field">
            <label for="reviewStatusFilter">状态筛选</label>
            <select id="reviewStatusFilter" data-review-status-filter>
              <option value="open" ${selectedAttr(state.reviewStatusFilter, "open")}>未处理</option>
              <option value="safe" ${selectedAttr(state.reviewStatusFilter, "safe")}>可通过</option>
              <option value="risk" ${selectedAttr(state.reviewStatusFilter, "risk")}>需人工判断</option>
              <option value="closed" ${selectedAttr(state.reviewStatusFilter, "closed")}>已处理</option>
              <option value="all" ${selectedAttr(state.reviewStatusFilter, "all")}>全部</option>
            </select>
          </div>
        </div>
        <div class="button-row">
          <button class="ghost-button" data-action="batch-approve-safe">批量通过可通过</button>
          <button class="ghost-button" data-action="clear-review-filter">清空筛选</button>
        </div>
      </div>
    `;
  if (!compact && !reviews.length) return `${controls}<div class="empty">没有匹配的异常记录。</div>`;
  const table = reviews.length
    ? `
      <div class="table-wrap">
        <table>
          <thead><tr><th>学生</th><th>类型</th><th>申请</th><th>风险</th><th>状态</th></tr></thead>
          <tbody>
            ${reviews
              .map(
                (item) => `
                  <tr class="${item.id === state.activeReviewId ? "is-hot" : ""}" data-review="${item.id}">
                    <td><strong>${escapeHtml(item.name)}</strong><br /><small>${escapeHtml(item.studentId)}</small></td>
                    <td>${escapeHtml(item.type)}</td>
                    <td>${item.hours}h</td>
                    <td>${escapeHtml(item.risk)}</td>
                    <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `
    : `<div class="empty">没有匹配的异常记录。</div>`;
  return `
    ${controls}
    <div class="${compact ? "two-col" : "content-grid"}" style="${compact ? "grid-template-columns:minmax(0,1fr) 330px;gap:0" : ""}">
      ${table}
      <aside class="proof-card">
        <div class="proof-media">
          ${activeProofFiles.length > 0 ? activeProofFiles.map((url, i) => `
            <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="proof-thumb" title="查看大图">
              <img src="${escapeHtml(url)}" alt="凭证 ${i + 1}" loading="lazy" onerror="this.parentElement.style.display='none'" />
            </a>
          `).join('') : `<div class="proof-empty"><span>无上传凭证</span><small>学生未提交打卡图片</small></div>`}
        </div>
        <div class="proof-meta"><small>${activeProofFiles.length} 张凭证 · ${escapeHtml(active.task)}</small></div>
        <dl>
          <dt>提交任务</dt><dd>${escapeHtml(active.task)}</dd>
          <dt>异常原因</dt><dd>${escapeHtml(active.reason)}</dd>
          <dt>审核记录</dt><dd>${escapeHtml(active.comment || "尚未填写")}</dd>
        </dl>
        <div class="form-grid review-form">
          <div class="field"><label for="approvedHours">有效小时</label><input id="approvedHours" data-approved-hours value="${active.approvedHours || active.hours}" /></div>
          <div class="field"><label for="reviewComment">审核备注</label><input id="reviewComment" data-review-comment value="${escapeHtml(active.comment || "")}" placeholder="填写驳回、补材料或通过说明" /></div>
        </div>
        <div class="button-row">
          <button class="danger-button" data-review-action="reject">驳回</button>
          <button class="ghost-button" data-review-action="supplement">补材料</button>
          <button class="primary-button" data-review-action="approve">通过</button>
        </div>
      </aside>
    </div>
  `;
}

function renderProgressRows() {
  const targets = sportRuleTargets();
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>学生</th><th>课程相关</th><th>其他运动</th><th>状态</th></tr></thead>
        <tbody>
          ${studentsForCourse()
            .map(
              (student) => `
                <tr>
                  <td><strong>${escapeHtml(student.name)}</strong><br /><small>${escapeHtml(student.id)}</small></td>
                  <td>${student.course} / ${targets.courseRequired} ${progressBar(student.course, targets.courseRequired)}</td>
                  <td>${student.organizationCredit ? `${student.rawGeneral} → ${student.general}` : student.general} / ${targets.generalRequired} ${progressBar(student.general, targets.generalRequired)}${student.organizationCredit ? `<small>${escapeHtml(student.organizationCredit.organization)} 组织抵扣</small>` : ""}</td>
                  <td><span class="status ${statusClass(student.status)}">${escapeHtml(student.status)}</span></td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderGradeMix() {
  const weights = gradeWeights();
  return `
    <div class="panel-list">
      ${[
        ["体育打卡", `${Math.round(weights.checkin * 100)}%`, "课程相关 + 其他运动"],
        ["专项考试", `${Math.round(weights.exam * 100)}%`, "老师录入专项成绩"],
        ["平时表现", `${Math.round(weights.attendance * 100)}%`, "签到与课堂表现"],
        ["体测", `${Math.round(weights.physical * 100)}%`, "原始数据自动换算"],
      ]
        .map(([name, value, desc]) => `<div class="list-row" style="grid-template-columns:1fr auto"><div><strong>${name}</strong><br /><small>${desc}</small></div><strong>${value}</strong></div>`)
        .join("")}
    </div>
  `;
}

function renderExportTiles() {
  const issues = exportIssues();
  return `
    <div class="data-grid panel-body">
      ${[
        ["缺少体测", issues.missingPhysical.length],
        ["打卡未满", issues.checkinNotEnough.length],
        ["异常未处理", issues.unresolvedReviews.length],
        ["模板字段", issues.templateMatched ? "已匹配" : "缺失"],
      ]
        .map(([label, value]) => `<article class="data-tile"><span class="muted">${label}</span><strong>${value}</strong></article>`)
        .join("")}
    </div>
  `;
}

function renderCourses() {
  return `
    <div class="course-card-grid">
      ${courses
        .map((course) => {
          const metrics = courseMetrics(course.id);
          return `
            <article class="course-card ${course.id === state.courseId ? "is-active" : ""}" data-course-card="${course.id}">
              <div>
                <p class="eyebrow">${course.semester} / ${courseOfferingLabel(course)}</p>
                <h3>${course.name}</h3>
              </div>
              <dl>
                <div><dt>学生</dt><dd>${metrics.students}</dd></div>
                <div><dt>待审核</dt><dd>${metrics.pending}</dd></div>
                <div><dt>完成率</dt><dd>${metrics.completion}%</dd></div>
                <div><dt>导出</dt><dd>${metrics.exportState}</dd></div>
              </dl>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderTasks() {
  const courseTasks = filteredTasksForCourse();
  const allTasks = tasksForCourse();
  const activeCount = allTasks.filter((task) => task.status === "进行中").length;
  const draftCount = allTasks.filter((task) => task.status === "草稿").length;
  const closedCount = allTasks.filter((task) => task.status === "已关闭").length;
  return `
    <div class="two-col">
      ${panel("课程任务列表", "P0-14", `
        <div class="panel-body review-toolbar">
          <div class="data-grid compact-data-grid">
            <article class="data-tile"><span class="muted">进行中</span><strong>${activeCount}</strong></article>
            <article class="data-tile"><span class="muted">草稿</span><strong>${draftCount}</strong></article>
            <article class="data-tile"><span class="muted">已关闭</span><strong>${closedCount}</strong></article>
            <article class="data-tile"><span class="muted">当前筛选</span><strong>${courseTasks.length}</strong></article>
          </div>
          <div class="field">
            <label for="taskStatusFilter">任务状态</label>
            <select id="taskStatusFilter" data-task-status-filter>
              <option value="all" ${selectedAttr(state.taskStatusFilter, "all")}>全部任务</option>
              <option value="进行中" ${selectedAttr(state.taskStatusFilter, "进行中")}>进行中</option>
              <option value="草稿" ${selectedAttr(state.taskStatusFilter, "草稿")}>草稿</option>
              <option value="已关闭" ${selectedAttr(state.taskStatusFilter, "已关闭")}>已关闭</option>
            </select>
          </div>
        </div>
        <div class="table-wrap">
          <table><thead><tr><th>任务</th><th>小时</th><th>截止</th><th>证明</th><th>状态</th><th>操作</th></tr></thead><tbody>
            ${courseTasks
              .map(
                (task) => `
                  <tr>
                    <td><strong>${escapeHtml(task.title)}</strong><br /><small>${escapeHtml(task.updatedAt || "未发布")}</small></td>
                    <td>${task.hours}h</td>
                    <td>${escapeHtml(task.deadline)}</td>
                    <td>${escapeHtml(task.proof)}</td>
                    <td><span class="status ${statusClass(task.status)}">${escapeHtml(task.status)}</span></td>
                    <td>
                      <div class="button-row">
                        <button class="ghost-button" data-task-action="publish" data-task-id="${task.id}">发布</button>
                        <button class="ghost-button" data-task-action="close" data-task-id="${task.id}">关闭</button>
                        <button class="danger-button" data-task-action="delete" data-task-id="${task.id}">删除</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody></table>
        </div>
        ${courseTasks.length ? "" : `<div class="empty">当前筛选下没有课程任务。</div>`}
      `)}
      ${panel("创建课程相关任务", "TASK FORM", `
        <form class="panel-body form-grid" data-action="create-task">
          <div class="field"><label for="taskTitle">任务标题</label><input id="taskTitle" name="title" value="课外跑步训练 Week 08" /></div>
          <div class="field"><label for="taskHours">可获得小时</label><input id="taskHours" name="hours" value="2" /></div>
          <div class="field"><label for="taskDeadline">截止时间</label><input id="taskDeadline" name="deadline" value="第 8 周周日 23:59" /></div>
          <div class="field"><label for="taskProof">证明要求</label><input id="taskProof" name="proof" value="运动 App 截图 + 场地照片" /></div>
          <div class="field"><label for="taskStatus">初始状态</label><select id="taskStatus" name="status"><option>草稿</option><option>进行中</option></select></div>
          <div class="field" style="grid-column:1/-1"><label for="taskDesc">任务说明</label><textarea id="taskDesc">完成指定跑步训练并上传证明。</textarea></div>
          <button class="primary-button" type="submit">保存任务</button>
        </form>
      `)}
    </div>
  `;
}

function demoImportRows() {
  return [
    { name: "吴嘉琪", id: "22301888", college: "工商管理学院", className: "2026A", courseCode: currentCourse().code, section: courseSection(), enrollmentStatus: "已选" },
    { name: "周明熙", id: "22301889", college: "理工科技学院", className: "2026B", courseCode: currentCourse().code, section: courseSection(), enrollmentStatus: "已选" },
    { name: "何安然", id: "", college: "数据科学学院", className: "2026C", courseCode: currentCourse().code, section: courseSection(), enrollmentStatus: "已选" },
    { name: "赵书言", id: "22301999", college: "文化创意学院", className: "2026D", courseCode: "OTHER101", section: courseSection(), enrollmentStatus: "已选" },
    { name: "陆景澄", id: "22301998", college: "人文社科学院", className: "2026E", courseCode: currentCourse().code, section: "9999", enrollmentStatus: "已选" },
    { name: "顾清澜", id: "22301997", college: "人文社科学院", className: "2026F", courseCode: currentCourse().code, section: courseSection(), enrollmentStatus: "退课" },
  ];
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/^﻿/, "")
    .toLowerCase();
}

function importRowsFromCsv(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const indexFor = (...names) => headers.findIndex((header) => names.map(normalizeHeader).includes(header));
  const nameIndex = indexFor("姓名", "学生姓名", "name");
  const idIndex = indexFor("学号", "studentId", "id");
  const collegeIndex = indexFor("学院", "college");
  const classIndex = indexFor("班级", "class", "className");
  const courseIndex = indexFor("课程代码", "课程", "courseCode");
  const sectionIndex = indexFor("section", "教学班", "小班", "班号", "sectionCode");
  const statusIndex = indexFor("选课状态", "状态", "enrollmentStatus");

  return rows.slice(1).map((row) => ({
    name: row[nameIndex] || "",
    id: row[idIndex] || "",
    college: row[collegeIndex] || "",
    className: row[classIndex] || "",
    courseCode: row[courseIndex] || currentCourse().code,
    section: normalizeSection(row[sectionIndex] || courseSection()),
    enrollmentStatus: row[statusIndex] || "已选",
  }));
}

function buildImportPreview(rows = demoImportRows()) {
  const existingIds = new Set(courseRoster().map((student) => student.id));
  const seen = new Set();
  return rows.map((row) => {
    let status = "通过";
    let valid = true;
    const courseCode = row.courseCode || currentCourse().code;
    const section = normalizeSection(row.section || courseSection());
    const enrollmentStatus = row.enrollmentStatus || "已选";
    if (!row.name) {
      status = "缺少姓名";
      valid = false;
    } else if (!row.id) {
      status = "缺少学号";
      valid = false;
    } else if (!row.college) {
      status = "缺少学院";
      valid = false;
    } else if (courseCode !== currentCourse().code) {
      status = "课程代码不匹配";
      valid = false;
    } else if (section !== normalizeSection(courseSection())) {
      status = "Section不匹配";
      valid = false;
    } else if (enrollmentStatus !== "已选") {
      status = "非已选状态";
      valid = false;
    } else if (existingIds.has(row.id)) {
      status = "学生已在当前课程";
      valid = false;
    } else if (seen.has(row.id)) {
      status = "重复学号";
      valid = false;
    }
    if (row.id) seen.add(row.id);
    return { ...row, courseCode, section, enrollmentStatus, valid, status };
  });
}

async function confirmImportPreview() {
  if (!state.importPreview.length) state.importPreview = buildImportPreview();
  const imported = state.importPreview.filter((row) => row.valid);
  const rejected = state.importPreview.filter((row) => !row.valid);

  // Try backend confirm first
  const result = await apiFetchJsonSafe(`/api/teacher/courses/${state.courseId}/students/import/confirm`, {
    method: 'POST',
    body: JSON.stringify({ rows: imported }),
  });
  if (result) {
    setTeacherNotice(`${courseOfferingLabel()} 后端导入完成：${result.importedCount} 名入库，${result.rejectedCount} 名被拒绝。`);
  } else {
    // Fallback: local import
    const roster = courseRoster();
    imported.forEach((row) => {
      roster.push({
        id: row.id,
        name: row.name,
        college: row.college,
        className: row.className || "",
        section: row.section || courseSection(),
        course: 0, general: 0, exam: 0, attendance: 0, physical: 0,
        status: "新导入",
        source: "import",
      });
    });
    setTeacherNotice(`${courseOfferingLabel()} 已本地导入 ${imported.length} 名有效学生，${rejected.length} 行未通过校验。`);
  }
  state.importPreview = buildImportPreview(rejected);
  state.imported = true;
  logAction("体育任课老师", "确认导入课程名单", `${courseOfferingLabel()} / ${imported.length} 名`);
}

function renderImport() {
  const previewRows = state.importPreview.length ? state.importPreview : buildImportPreview();
  const validCount = previewRows.filter((row) => row.valid).length;
  const invalidCount = previewRows.length - validCount;
  const preview = state.imported || state.importPreview.length
    ? `
      <div class="table-wrap">
        <table><thead><tr><th>姓名</th><th>学号</th><th>学院</th><th>班级</th><th>课程</th><th>Section</th><th>选课</th><th>校验</th></tr></thead><tbody>
          ${previewRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.name)}</td>
                  <td>${escapeHtml(row.id)}</td>
                  <td>${escapeHtml(row.college)}</td>
                  <td>${escapeHtml(row.className || "-")}</td>
                  <td>${escapeHtml(row.courseCode || "-")}</td>
                  <td>${escapeHtml(row.section ? sectionDisplay(row.section) : "-")}</td>
                  <td>${escapeHtml(row.enrollmentStatus || "-")}</td>
                  <td><span class="status ${row.valid ? "ok" : "bad"}">${escapeHtml(row.status)}</span></td>
                </tr>
              `,
            )
            .join("")}
        </tbody></table>
      </div>
    `
    : `<div class="empty">点击“模拟导入名单”后展示字段校验与错误行预览。</div>`;
  return panel("学生名单导入", "P0-05", `
    <div class="panel-body">
      ${teacherNotice()}
      <div class="notice">支持 Excel/CSV 导入，必须校验姓名、学号、学院、班级、课程代码、Section、选课状态。</div>
      <div class="form-grid" style="margin:16px 0">
        <div class="field">
          <label for="rosterCsvFile">选择 CSV 名单</label>
          <input id="rosterCsvFile" type="file" accept=".csv,text/csv" data-roster-file />
        </div>
        <div class="notice">当前教学班：${courseOfferingLabel()}。CSV 首行建议使用：姓名、学号、学院、班级、课程代码、Section、选课状态。</div>
      </div>
      <div class="button-row" style="margin:16px 0">
        <button class="primary-button" data-action="simulate-import">模拟导入名单</button>
        <button class="ghost-button" data-action="download-import-template">下载模板</button>
        <button class="ghost-button" data-action="confirm-import">确认导入</button>
      </div>
      ${
        state.importPreview.length
          ? `<div class="notice">本次预检：${validCount} 行可导入，${invalidCount} 行需处理。确认导入只会写入通过校验的行。</div>`
          : ""
      }
      ${preview}
    </div>
  `);
}

function renderStudents() {
  const rows = filteredStudents();
  const targets = sportRuleTargets();
  const course = currentCourse();
  return panel("学生名单", "P0-06", `
    <div class="panel-body">
      <div class="form-grid" style="margin-bottom:16px">
        <div class="field"><label for="studentSearch">搜索学生</label><input id="studentSearch" data-student-search placeholder="姓名 / 学号" value="${escapeHtml(state.studentSearch)}" /></div>
        <div class="field">
          <label for="studentFilter">状态筛选</label>
          <select id="studentFilter" data-student-filter>
            <option value="all" ${state.studentFilter === "all" ? "selected" : ""}>全部</option>
            <option value="incomplete" ${state.studentFilter === "incomplete" ? "selected" : ""}>未完成</option>
            <option value="complete" ${state.studentFilter === "complete" ? "selected" : ""}>已完成</option>
            <option value="risk" ${state.studentFilter === "risk" ? "selected" : ""}>有异常</option>
          </select>
        </div>
      </div>
      <div class="table-wrap"><table><thead><tr><th>学生</th><th>学院</th><th>任课老师</th><th>课程相关</th><th>其他运动</th><th>状态</th></tr></thead><tbody>
        ${studentListRows(rows, targets, course)}
      </tbody></table></div>
      ${rows.length === 0 ? `<div class="empty">没有匹配的学生</div>` : ""}
    </div>
  `);
}

function studentListRows(rows, targets = sportRuleTargets(), course = currentCourse()) {
  return rows
    .map(
      (student) => `
        <tr>
          <td><strong>${escapeHtml(student.name)}</strong><br /><small>${escapeHtml(student.id)}</small></td>
          <td>${escapeHtml(student.college)}</td>
          <td>${escapeHtml(course.teacher || state.authUser?.name || '—')}</td>
          <td>${student.course}/${targets.courseRequired}</td>
          <td>
            ${student.organizationCredit ? `${student.rawGeneral} → ${student.general}` : student.general}/${targets.generalRequired}
            ${student.organizationCredit ? `<br /><small>${escapeHtml(student.organizationCredit.organization)} 抵扣</small>` : ""}
          </td>
          <td><span class="status ${statusClass(student.status)}">${escapeHtml(student.status)}</span></td>
        </tr>
      `,
    )
    .join("");
}

function renderReviewPage() {
  return panel("异常打卡处理", "P0-08", `${teacherNotice()}${renderReviewTable(false)}`);
}

function attendanceOptions(selected) {
  return ["出勤", "迟到", "请假", "缺勤"].map((value) => `<option ${selectedAttr(selected, value)}>${value}</option>`).join("");
}

function renderExam() {
  const items = ["足球绕杆", "篮球投篮", "耐力跑"];
  return panel("专项考试录入", "P0-09", `
    ${teacherNotice()}
    <form data-score-form="exam">
      <div class="table-wrap"><table><thead><tr><th>学生</th>${items.map((item) => `<th>${item}</th>`).join("")}<th>折算分</th><th>状态</th></tr></thead><tbody>
        ${studentsForCourse()
          .map(
            (student) => `
              <tr>
                <td><strong>${escapeHtml(student.name)}</strong><br /><small>${escapeHtml(student.id)}</small></td>
                ${items
                  .map((_, itemIndex) => `<td><input class="input-cell" name="exam_${escapeHtml(student.id)}_${itemIndex}" type="number" min="0" max="100" value="${escapeHtml(student.score.examItems[itemIndex])}" /></td>`)
                  .join("")}
                <td><strong>${student.exam}</strong></td>
                <td><span class="status ${statusClass(student.score.examStatus)}">${escapeHtml(student.score.examStatus)}</span></td>
              </tr>
            `,
          )
          .join("")}
      </tbody></table></div>
      <div class="button-row panel-body"><button class="ghost-button" type="submit">保存草稿</button><button class="primary-button" type="submit">批量保存</button></div>
    </form>
  `);
}

function renderAttendance() {
  return panel("签到 / 平时分", "P0-10", `
    ${teacherNotice()}
    <form data-score-form="attendance">
      <div class="table-wrap"><table><thead><tr><th>学生</th><th>第 6 周</th><th>第 7 周</th><th>表现分</th><th>汇总</th></tr></thead><tbody>
        ${studentsForCourse()
          .map(
            (student) => `
              <tr>
                <td><strong>${escapeHtml(student.name)}</strong><br /><small>${escapeHtml(student.id)}</small></td>
                <td><select name="att_${escapeHtml(student.id)}_week6">${attendanceOptions(student.score.attendanceWeeks.week6)}</select></td>
                <td><select name="att_${escapeHtml(student.id)}_week7">${attendanceOptions(student.score.attendanceWeeks.week7)}</select></td>
                <td><input class="input-cell" name="att_${escapeHtml(student.id)}_score" type="number" min="0" max="100" value="${escapeHtml(student.attendance)}" /></td>
                <td><span class="status ${statusClass(student.score.attendanceStatus)}">${escapeHtml(student.score.attendanceStatus)}</span></td>
              </tr>
            `,
          )
          .join("")}
      </tbody></table></div>
      <div class="button-row panel-body"><button class="ghost-button" type="submit">保存草稿</button><button class="primary-button" type="submit">批量保存</button></div>
    </form>
  `);
}

function renderPhysical() {
  const students = studentsForCourse();
  return panel("体测录入与换算", "P0-11", `
    ${teacherNotice()}
    <form data-score-form="physical">
      <div class="table-wrap"><table><thead><tr><th>学生</th><th>性别</th><th>年级</th><th>跑步成绩</th><th>50m</th><th>跳远</th><th>自动换算</th><th>换算分</th></tr></thead><tbody>
        ${students.map((student) => {
          const genderLabel = student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '?';
          const gradeLabel = student.gradeLevel === 'freshman' ? '大一' : student.gradeLevel === 'sophomore' ? '大二' : student.gradeLevel === 'junior' ? '大三' : student.gradeLevel === 'senior' ? '大四' : '?';
          return `
              <tr>
                <td><strong>${escapeHtml(student.name)}</strong><br /><small>${escapeHtml(student.id)}</small></td>
                <td>${genderLabel}</td>
                <td>${gradeLabel}</td>
                <td><input class="input-cell" name="phys_${escapeHtml(student.id)}_endurance" value="${escapeHtml(student.score.physicalItems.endurance)}" style="width:80px" data-phys-endurance data-student-id="${escapeHtml(student.id)}" data-gender="${escapeHtml(student.gender || '')}" data-grade="${escapeHtml(student.gradeLevel || '')}" placeholder="如 3&#39;30" /></td>
                <td><input class="input-cell" name="phys_${escapeHtml(student.id)}_sprint" value="${escapeHtml(student.score.physicalItems.sprint)}" /></td>
                <td><input class="input-cell" name="phys_${escapeHtml(student.id)}_jump" value="${escapeHtml(student.score.physicalItems.jump)}" /></td>
                <td><button type="button" class="ghost-button" data-auto-convert data-student-id="${escapeHtml(student.id)}" style="font-size:11px;padding:2px 6px">换算</button><br /><small id="convertResult_${escapeHtml(student.id)}" class="status"></small></td>
                <td><input class="input-cell" name="phys_${escapeHtml(student.id)}_score" id="phys_score_${escapeHtml(student.id)}" type="number" min="0" max="100" value="${escapeHtml(student.physical)}" /></td>
              </tr>
            `;
          }).join("")}
      </tbody></table></div>
      <div class="button-row panel-body">
        <button type="button" class="ghost-button" data-convert-all>一键换算全部</button>
        <button class="ghost-button" type="submit">保存草稿</button>
        <button class="primary-button" type="submit">批量保存</button>
      </div>
    </form>
  `);
}

function renderGrades() {
  var weights = gradeWeights();
  var weightText = '当前权重：体育打卡 ' + Math.round(weights.checkin * 100) + '% / 专项 ' + Math.round(weights.exam * 100) + '% / 平时 ' + Math.round(weights.attendance * 100) + '% / 体测 ' + Math.round(weights.physical * 100) + '%';

  var rowsHtml = '';
  if (state.gradeData && state.gradeData.length > 0) {
    // API data rows
    for (var gi = 0; gi < state.gradeData.length; gi++) {
      var g = state.gradeData[gi];
      var cs = g.checkinScore || 0;
      var gExam = g.exam || 0;
      var gAtt = g.attendance || 0;
      var gPhy = g.physical || 0;
      var gTotal = g.total || 0;
      var missing = g.missingItems || [];
      var checkinOk = missing.indexOf('physical') === -1 && cs > 0;
      rowsHtml += '<tr><td><strong>' + escapeHtml(g.studentName || g.studentId || '') + '</strong><br /><small>' + escapeHtml(g.studentId || '') + '</small></td><td>' + cs + '<br /><small>学时: ' + (g.course_hours || 0) + ' / ' + (g.general_hours || 0) + '</small></td><td>' + gExam + '<br /><small>计 ' + Math.round(gExam * weights.exam / 100) + '</small></td><td>' + gAtt + '<br /><small>计 ' + Math.round(gAtt * weights.attendance / 100) + '</small></td><td>' + gPhy + '<br /><small>计 ' + Math.round(gPhy * weights.physical / 100) + '</small></td><td><strong>' + gTotal + '</strong></td><td><small>来源：API 数据</small></td><td><span class="status ' + (missing.length === 0 ? 'ok' : 'warn') + '">' + (missing.length === 0 ? '无' : missing.join(', ')) + '</span></td></tr>';
    }
  } else {
    // Fallback: local computation from baseStudents
    var targets = sportRuleTargets();
    for (var si = 0; si < studentsForCourse().length; si++) {
      var student = studentsForCourse()[si];
      var breakdown = gradeBreakdown(student);
      var sources = gradeSourceSummary(student);
      var checkinComplete = student.course >= targets.courseRequired && student.general >= targets.generalRequired;
      rowsHtml += '<tr><td><strong>' + escapeHtml(student.name) + '</strong><br /><small>' + escapeHtml(student.id) + '</small></td><td>' + breakdown.checkinScore + '<br /><small>计 ' + breakdown.checkinWeighted + (student.organizationCredit ? ' / ' + escapeHtml(student.organizationCredit.organization) + ' 抵扣' : '') + '</small></td><td>' + student.exam + '<br /><small>计 ' + breakdown.examWeighted + '</small></td><td>' + student.attendance + '<br /><small>计 ' + breakdown.attendanceWeighted + '</small></td><td>' + student.physical + '<br /><small>计 ' + breakdown.physicalWeighted + '</small></td><td><strong>' + breakdown.total + '</strong></td><td><small>名单：' + escapeHtml(sources.roster) + '<br />打卡：' + escapeHtml(sources.checkin) + '<br />专项：' + escapeHtml(sources.exam) + ' / 平时：' + escapeHtml(sources.attendance) + ' / 体测：' + escapeHtml(sources.physical) + '</small></td><td><span class="status ' + (checkinComplete ? 'ok' : 'warn') + '">' + (checkinComplete ? '无' : '打卡未满') + '</span></td></tr>';
    }
  }

  return panel('成绩汇总', 'P0-12', [
    teacherNotice(),
    '<div class="notice">' + weightText + '</div>',
    '<div class="table-wrap"><table><thead><tr><th>学生</th><th>体育打卡</th><th>专项</th><th>平时</th><th>体测</th><th>总分</th><th>来源追溯</th><th>缺失项</th></tr></thead><tbody>',
    rowsHtml,
    '</tbody></table></div>'
  ].join(''));
}

function renderExport() {
  const issues = exportIssues();
  const blocked = exportBlocked(issues);
  const delivery = deliveryRecordForCourse();
  return panel("成绩导出", "P0-13", `
    ${teacherNotice()}
    ${renderExportTiles()}
    <div class="panel-body">
      <div class="notice">导出前检查会阻止遗漏体测、未处理异常和模板字段缺失。CSV 会按管理员配置的字段顺序在前端生成。</div>
      ${
        blocked
          ? `<div class="notice export-blocker">当前仍有 ${issues.missingPhysical.length + issues.checkinNotEnough.length + issues.unresolvedReviews.length + (issues.templateMatched ? 0 : 1)} 类/项问题，暂不可导出正式成绩。</div>`
          : `<div class="notice export-ready">所有导出检查已通过，可以下载正式成绩 CSV。</div>`
      }
      <div class="table-wrap" style="margin-top:16px">
        <table>
          <thead><tr><th>检查项</th><th>详情</th><th>建议</th></tr></thead>
          <tbody>
            <tr><td>缺少/低体测</td><td>${issues.missingPhysical.map((item) => item.name).join("、") || "无"}</td><td>补录体测原始数据</td></tr>
            <tr><td>打卡未满</td><td>${issues.checkinNotEnough.map((item) => item.name).join("、") || "无"}</td><td>提醒学生补齐 A/B 类学时</td></tr>
            <tr><td>异常未处理</td><td>${issues.unresolvedReviews.map((item) => item.name).join("、") || "无"}</td><td>进入异常审核页处理</td></tr>
          </tbody>
        </table>
      </div>
      <div class="delivery-card">
        <div>
          <p class="eyebrow">COURSE DELIVERY</p>
          <h3>成绩交付状态</h3>
        </div>
        <dl>
          <div><dt>当前状态</dt><dd><span class="status ${statusClass(delivery.status)}">${escapeHtml(delivery.status)}</span></dd></div>
          <div><dt>提交时间</dt><dd>${escapeHtml(delivery.submittedAt)}</dd></div>
          <div><dt>问题数</dt><dd>${delivery.issueCount}</dd></div>
          <div><dt>说明</dt><dd>${escapeHtml(delivery.comment)}</dd></div>
        </dl>
      </div>
      <div class="button-row" style="margin-top:16px">
        <button class="ghost-button" data-action="download-issue-list">下载问题清单</button>
        <button class="ghost-button" data-action="submit-delivery">提交预检给体育部</button>
        <button class="${blocked ? "ghost-button" : "primary-button"}" data-action="download-csv">${blocked ? "检查未通过" : "下载成绩 CSV"}</button>
      </div>
    </div>
  `);
}

function adminFrame(primary, secondary = "") {
  return `
    ${adminNotice()}
    ${secondary ? `<div class="two-col admin-config-grid">${primary}${secondary}</div>` : primary}
  `;
}

function adminConfigStats() {
  const gradeWeight = state.admin.gradeRules.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const draftItems = [
    ...state.admin.semesters,
    ...state.admin.courses,
    ...state.admin.users,
    ...state.admin.gradeRules,
    ...state.admin.conversionRules,
  ].filter((item) => ["草稿", "待确认"].includes(item.status)).length;

  return {
    gradeWeight,
    draftItems,
    teacherCount: state.admin.users.filter((user) => user.role === "体育任课老师").length,
    courseCount: state.admin.courses.length,
    membershipCount: state.memberships.length,
    offsetCount: state.memberships.filter((membership) => membershipOffsetState(membership) === "抵扣生效").length,
    pendingMemberships: state.memberships.filter((membership) => membership.status === "待确认").length,
    deliveryPending: state.deliveryRecords.filter((record) => record.status === "待管理员确认").length,
    deliveryArchived: state.deliveryRecords.filter((record) => record.status === "已归档").length,
  };
}

function roleRouteMatrix() {
  return [
    ...teacherNav.map(([route, label]) => ({ role: "teacher", roleName: "体育任课老师", route, label })),
    ...adminNav.map(([route, label]) => ({ role: "admin", roleName: "体育部管理员", route, label })),
    ...managerNav.map(([route, label]) => ({ role: "manager", roleName: "组织负责人", route, label })),
  ];
}

function integrationSnapshot() {
  const courseRows = allCourses().map((course) => {
    const issues = exportIssues(course.id);
    return {
      id: course.id,
      code: course.code,
      section: courseSection(course),
      name: course.name,
      semester: course.semester,
      metrics: courseMetrics(course.id),
      rosterCount: courseRoster(course.id).length,
      taskCount: tasksForCourse(course.id).length,
      reviewCount: reviewsForCourse(course.id).length,
      exportIssues: {
        missingPhysical: issues.missingPhysical.length,
        checkinNotEnough: issues.checkinNotEnough.length,
        unresolvedReviews: issues.unresolvedReviews.length,
        templateMatched: issues.templateMatched,
      },
      delivery: deliveryRecordForCourse(course.id),
    };
  });
  return {
    generatedAt: formatDateTime(),
    product: "BNBU 体育成绩管理 Web",
    frontendPreview: previewUrl,
    visualTheme: {
      primary: "#3A9DF6",
      secondary: "#7EBEFB",
      cssFile: "frontend/styles-campus-blue.css",
    },
    qualityGates: qualityGateGroups(),
    browserCapabilities: browserCapabilityRows(),
    apiRequestPolicy,
    storageKey,
    apiContract: "backend/openapi.yaml",
    roles: [
      { role: "teacher", name: "体育任课老师", defaultRoute: defaultRouteForRole("teacher") },
      { role: "admin", name: "体育部管理员", defaultRoute: defaultRouteForRole("admin") },
      { role: "manager", name: "组织负责人", defaultRoute: defaultRouteForRole("manager") },
    ],
    routes: roleRouteMatrix(),
    endpointCount: backendEndpoints.length,
    endpoints: backendEndpoints,
    courses: courseRows,
    adminConfig: {
      sportRules: state.admin.sportRules,
      gradeRules: state.admin.gradeRules,
      conversionRules: state.admin.conversionRules,
      exportTemplate: state.admin.exportTemplate,
      teams: state.admin.teams,
      clubs: state.admin.clubs,
    },
    memberships: state.memberships,
    deliveryRecords: state.deliveryRecords,
    auditLogCount: state.logs.length,
  };
}

function downloadJsonSnapshot() {
  downloadTextFile("BNBU-web-backend-handoff-snapshot.json", JSON.stringify(integrationSnapshot(), null, 2), "application/json;charset=utf-8");
  setAdminNotice("后端联调状态快照已导出。");
}

function downloadRouteMatrix() {
  const rows = [["角色", "角色名称", "路由", "页面"]];
  roleRouteMatrix().forEach((item) => rows.push([item.role, item.roleName, item.route, item.label]));
  downloadTextFile("BNBU-web-route-matrix.csv", csvFromRows(rows));
  setAdminNotice("Web 路由矩阵已导出。");
}

function downloadEndpointMap() {
  const rows = [["分组", "方法", "接口", "前端页面", "优先级", "说明"]];
  backendEndpoints.forEach((item) => rows.push([item.group, item.method, item.path, item.route, item.priority, item.note]));
  downloadTextFile("BNBU-web-api-endpoint-map.csv", csvFromRows(rows));
  setAdminNotice("接口清单已导出。");
}

function handoffManifest() {
  return {
    generatedAt: formatDateTime(),
    previewUrl,
    frontendFiles: [
      "frontend/README.md",
      "frontend/index.html",
      "frontend/app.js",
      "frontend/styles-campus-blue.css",
      "frontend/self-test.cjs",
      "frontend/quality-smoke.cjs",
      "frontend/preview-server.cjs",
      "frontend/teacher/index.html",
      "frontend/teacher/app.js",
      "frontend/teacher/api.js",
      "frontend/teacher/styles.css",
    ],
    handoffFiles: [
      "backend/README.md",
      "backend/openapi.yaml",
      "backend/data-dictionary.md",
      "backend/sample-payloads.json",
      "backend/integration-checklist.md",
      "backend/mock-api.cjs",
      "database/schema.sql",
    ],
    requiredBackendPriority: [
      "Auth and role routes",
      "Teacher course workspace APIs",
      "Roster import preview and confirm",
      "Score batch save APIs",
      "Export precheck and delivery archive APIs",
      "Organization membership and offset APIs",
      "Audit log APIs",
    ],
    qualityGates: qualityGateGroups(),
    apiRequestPolicy,
  };
}

function downloadHandoffManifest() {
  downloadTextFile("BNBU-backend-handoff-manifest.json", JSON.stringify(handoffManifest(), null, 2), "application/json;charset=utf-8");
  setAdminNotice("后端交付包 manifest 已导出。");
}

function downloadQualityChecklist() {
  const rows = [["类别", "检查项", "状态", "说明"]];
  qualityGateGroups().forEach((group) => {
    group.items.forEach((item) => rows.push([group.group, item.item, item.status, item.detail]));
  });
  browserCapabilityRows().forEach((item) => rows.push(["当前浏览器能力", item.item, item.status, item.detail]));
  downloadTextFile("BNBU-web-quality-security-checklist.csv", csvFromRows(rows));
  setAdminNotice("稳定性、安全与兼容性清单已导出。");
}

async function checkApiHealth() {
  const url = apiHealthUrl();
  const policy = apiUrlPolicy(url);
  state.apiHealth = {
    status: "checking",
    url,
    checkedAt: formatDateTime(),
    policyStatus: policy.status,
    policyMessage: policy.message,
    message: policy.status === "bad" ? policy.message : "正在检查后端服务...",
  };
  renderRoute();
  try {
    const result = await apiRequest(url);
    const { response, text } = result;
    state.apiLastRequest = {
      url,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      checkedAt: formatDateTime(),
      status: response.ok ? "ok" : "warn",
    };
    state.apiHealth = {
      status: response.ok ? "ok" : "warn",
      url,
      checkedAt: formatDateTime(),
      policyStatus: result.policy.status,
      policyMessage: result.policy.message,
      httpStatus: response.status,
      latencyMs: result.latencyMs,
      attempts: result.attempts,
      message: text.slice(0, apiRequestPolicy.maxResponsePreview) || response.statusText || "无响应正文",
    };
    setAdminNotice(response.ok ? "后端健康检查通过。" : `后端已响应，但 HTTP 状态为 ${response.status}。`);
  } catch (error) {
    state.apiLastRequest = {
      url,
      attempts: apiRequestPolicy.retryCount + 1,
      checkedAt: formatDateTime(),
      status: "bad",
      message: error?.message || "无法连接后端服务",
    };
    state.apiHealth = {
      status: "bad",
      url,
      checkedAt: formatDateTime(),
      policyStatus: policy.status,
      policyMessage: policy.message,
      message: error?.message || "无法连接后端服务",
    };
    setAdminNotice("后端健康检查失败，请确认服务地址、端口与 CORS。");
  }
  renderRoute();
}

function renderAdminDashboard() {
  const stats = adminConfigStats();
  const sportRules = state.admin.sportRules;
  return `
    ${adminNotice()}
    <div class="data-grid">
      <article class="data-tile"><span class="muted">课程数量</span><strong>${stats.courseCount}</strong></article>
      <article class="data-tile"><span class="muted">老师账号</span><strong>${stats.teacherCount}</strong></article>
      <article class="data-tile"><span class="muted">成绩权重</span><strong>${stats.gradeWeight}%</strong></article>
      <article class="data-tile"><span class="muted">组织抵扣</span><strong>${stats.offsetCount}/${stats.membershipCount}</strong></article>
      <article class="data-tile"><span class="muted">待归档</span><strong>${stats.deliveryPending}</strong></article>
    </div>
    <section class="content-grid">
      ${panel("配置快捷入口", "ADMIN CONFIG", `
        <div class="panel-list">
          ${[
            ["体育学时标准", `${sportRules.total}h / ${sportRules.courseRequired}+${sportRules.generalRequired}`, sportRules.status, "admin-sport-rules"],
            ["成绩规则", state.admin.gradeRules.map((item) => `${item.weight}%`).join(" / "), stats.gradeWeight === 100 ? "正常" : "需复核", "admin-grade-rules"],
            ["体测换算表", state.admin.conversionRules[0]?.version || "未设置", "正常", "admin-conversion"],
            ["换秒表(新版)", "每1秒一个分数", "正常", "admin-conversion-detail"],
            ["导出模板", `${state.admin.exportTemplate.name} / ${state.admin.exportTemplate.format}`, state.admin.exportTemplate.status, "admin-export-template"],
            ["组织抵扣审核", `${stats.pendingMemberships} 条待确认`, stats.pendingMemberships ? "待确认" : "正常", "admin-organization-audit"],
            ["成绩归档审核", `${stats.deliveryPending} 门待确认 / ${stats.deliveryArchived} 门已归档`, stats.deliveryPending ? "待管理员确认" : "正常", "admin-delivery-audit"],
            ["操作日志", `${state.logs.length} 条记录`, "正常", "admin-logs"],
          ]
            .map(
              ([name, value, status, route]) => `
                <button class="config-row config-action-row" data-route="${route}">
                  <div><strong>${name}</strong><br /><small>${value}</small></div>
                  <span class="status ${statusClass(status)}">${status}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      `)}
      ${panel("规则版本", "CURRENT POLICY", `
        <div class="panel-body policy-card">
          <p class="eyebrow">${escapeHtml(sportRules.version)}</p>
          <h3>${sportRules.total} 小时</h3>
          <dl>
            <dt>课程相关</dt><dd>${sportRules.courseRequired} 小时</dd>
            <dt>其他运动</dt><dd>${sportRules.generalRequired} 小时</dd>
            <dt>单日上限</dt><dd>${sportRules.dailyLimit} 小时</dd>
            <dt>抵扣规则</dt><dd>${escapeHtml(sportRules.organizationOffset)}</dd>
          </dl>
        </div>
      `)}
    </section>
  `;
}

function renderAdminOverview() {
  const rows = filteredCourseHealthRows();
  const allRows = courseHealthRows();
  const avgCompletion = allRows.length ? Math.round(allRows.reduce((sum, row) => sum + row.metrics.completion, 0) / allRows.length) : 0;
  const issueTotal = allRows.reduce((sum, row) => sum + row.issueCount, 0);
  const pendingReviews = allRows.reduce((sum, row) => sum + row.metrics.pending, 0);
  const readyCount = allRows.filter((row) => row.health === "可归档" || row.health === "正常").length;
  return `
    ${adminNotice()}
    <div class="data-grid">
      <article class="data-tile"><span class="muted">平均完成率</span><strong>${avgCompletion}%</strong></article>
      <article class="data-tile"><span class="muted">待审核记录</span><strong>${pendingReviews}</strong></article>
      <article class="data-tile"><span class="muted">预检问题</span><strong>${issueTotal}</strong></article>
      <article class="data-tile"><span class="muted">可归档课程</span><strong>${readyCount}</strong></article>
    </div>
    ${panel("全校课程进度", "SCHOOL OVERVIEW", `
      <div class="panel-body review-toolbar">
        <div class="form-grid">
          <div class="field">
            <label for="adminCourseFilter">课程状态</label>
            <select id="adminCourseFilter" data-admin-course-filter>
              <option value="all" ${selectedAttr(state.adminCourseFilter, "all")}>全部课程</option>
              <option value="risk" ${selectedAttr(state.adminCourseFilter, "risk")}>需跟进</option>
              <option value="ready" ${selectedAttr(state.adminCourseFilter, "ready")}>可归档 / 正常</option>
              <option value="archived" ${selectedAttr(state.adminCourseFilter, "archived")}>已归档</option>
            </select>
          </div>
        </div>
        <div class="button-row">
          <button class="ghost-button" data-action="download-school-issue-list">下载全校问题清单</button>
          <button class="ghost-button" data-action="remind-all-risk-courses">提醒需跟进课程</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>课程</th><th>完成率</th><th>待审核</th><th>预检问题</th><th>任务</th><th>归档</th><th>健康状态</th><th>操作</th></tr></thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><strong>${courseOfferingLabel(row.course)}</strong><br /><small>${row.course.name}</small></td>
                    <td>${row.metrics.completion}% ${progressBar(row.metrics.completion, 100)}</td>
                    <td>${row.metrics.pending}</td>
                    <td><strong>${row.issueCount}</strong><br /><small>体测 ${row.issues.missingPhysical.length} / 打卡 ${row.issues.checkinNotEnough.length} / 异常 ${row.issues.unresolvedReviews.length}</small></td>
                    <td>${row.tasks.active} 进行中<br /><small>${row.tasks.draft} 草稿 / ${row.tasks.closed} 关闭</small></td>
                    <td><span class="status ${statusClass(row.delivery.status)}">${escapeHtml(row.delivery.status)}</span><br /><small>${escapeHtml(row.delivery.submittedAt)}</small></td>
                    <td><span class="status ${statusClass(row.health)}">${escapeHtml(row.health)}</span></td>
                    <td>
                      <div class="button-row">
                        <button class="ghost-button" data-admin-course-action="remind-course" data-course-id="${row.course.id}">提醒老师</button>
                        <button class="ghost-button" data-admin-course-action="open-delivery" data-course-id="${row.course.id}">归档页</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      ${rows.length ? "" : `<div class="empty">当前筛选下没有课程。</div>`}
    `)}
  `;
}

function renderAdminApiHandoff() {
  const p0Count = backendEndpoints.filter((endpoint) => endpoint.priority === "P0").length;
  const p1Count = backendEndpoints.length - p0Count;
  const routeCount = roleRouteMatrix().length;
  const snapshot = integrationSnapshot();
  const health = state.apiHealth;
  const policy = apiUrlPolicy(apiHealthUrl());
  const qualityGroups = qualityGateGroups();
  const browserRows = browserCapabilityRows();
  return `
    ${adminNotice()}
    <div class="data-grid">
      <article class="data-tile"><span class="muted">P0 接口</span><strong>${p0Count}</strong></article>
      <article class="data-tile"><span class="muted">P1 接口</span><strong>${p1Count}</strong></article>
      <article class="data-tile"><span class="muted">Web 路由</span><strong>${routeCount}</strong></article>
      <article class="data-tile"><span class="muted">质量门禁</span><strong>${qualityGroups.reduce((sum, group) => sum + group.items.length, 0)}</strong></article>
    </div>
    ${panel("后端交付状态", "BACKEND HANDOFF", `
      <div class="panel-body">
        <div class="notice">当前 Web 已完成老师端、管理端、组织负责人端的前端闭环。后端接入时以 <strong>backend/openapi.yaml</strong> 为接口草案，以导出的状态快照核对字段。稳定性目标按 <strong>200 名 Web 用户同时登录操作</strong> 做后端联调压测。</div>
        <div class="button-row" style="margin-top:16px">
          <button class="primary-button" data-action="download-handoff-snapshot">导出状态快照 JSON</button>
          <button class="ghost-button" data-action="download-route-matrix">导出路由矩阵 CSV</button>
          <button class="ghost-button" data-action="download-endpoint-map">导出接口清单 CSV</button>
          <button class="ghost-button" data-action="download-handoff-manifest">导出交付包 Manifest</button>
          <button class="ghost-button" data-action="download-quality-checklist">导出质量安全清单</button>
        </div>
      </div>
    `)}
    ${panel("API 联调配置", "API CHECK", `
      <div class="panel-body">
        <div class="form-grid">
          <div class="field">
            <label for="apiBaseUrl">API Base URL</label>
            <input id="apiBaseUrl" data-api-base-url value="${escapeHtml(state.apiBaseUrl)}" placeholder="http://127.0.0.1:8080/api" />
          </div>
          <div class="field">
            <label for="apiHealthPath">健康检查路径</label>
            <input id="apiHealthPath" data-api-health-path value="${escapeHtml(state.apiHealthPath)}" placeholder="/health" />
          </div>
        </div>
        <div class="button-row" style="margin-top:16px">
          <button class="primary-button" data-action="check-api-health">检查后端连接</button>
        </div>
        <div class="notice ${policy.status === "bad" ? "export-blocker" : ""}" style="margin-top:16px">
          请求策略：${apiRequestPolicy.timeoutMs}ms 超时 / 最多重试 ${apiRequestPolicy.retryCount} 次 / URL 策略为 <strong>${escapeHtml(policy.status)}</strong>，${escapeHtml(policy.message)}
        </div>
        ${
          health
            ? `<div class="delivery-card">
                <div>
                  <p class="eyebrow">LAST CHECK</p>
                  <h3>${escapeHtml(health.url)}</h3>
                </div>
                <dl>
                  <div><dt>状态</dt><dd><span class="status ${statusClass(health.status)}">${escapeHtml(health.status)}</span></dd></div>
                  <div><dt>时间</dt><dd>${escapeHtml(health.checkedAt)}</dd></div>
                  <div><dt>HTTP</dt><dd>${escapeHtml(health.httpStatus || "-")}</dd></div>
                  <div><dt>耗时</dt><dd>${escapeHtml(health.latencyMs ? `${health.latencyMs}ms` : "-")}</dd></div>
                  <div><dt>重试</dt><dd>${escapeHtml(health.attempts ? `${health.attempts} 次请求` : "-")}</dd></div>
                  <div><dt>URL 策略</dt><dd>${escapeHtml(health.policyMessage || "-")}</dd></div>
                  <div><dt>摘要</dt><dd>${escapeHtml(health.message)}</dd></div>
                </dl>
              </div>`
            : `<div class="notice" style="margin-top:16px">后端启动后，在这里输入 Base URL 并检查连接。默认检查 <strong>${escapeHtml(apiHealthUrl())}</strong>。</div>`
        }
      </div>
    `)}
    ${panel("稳定性 / 安全 / 兼容性基线", "QUALITY GATES", `
      <div class="quality-grid">
        ${qualityGroups
          .map(
            (group) => `
              <article class="quality-card">
                <p class="eyebrow">${escapeHtml(group.group)}</p>
                <div class="panel-list">
                  ${group.items
                    .map(
                      (item) => `
                        <div class="list-row quality-row">
                          <div><strong>${escapeHtml(item.item)}</strong><br /><small>${escapeHtml(item.detail)}</small></div>
                          <span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                        </div>
                      `,
                    )
                    .join("")}
                </div>
              </article>
            `,
          )
          .join("")}
      </div>
      <div class="table-wrap" style="margin-top:16px">
        <table>
          <thead><tr><th>当前浏览器能力</th><th>状态</th><th>说明</th></tr></thead>
          <tbody>
            ${browserRows
              .map(
                (item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.item)}</strong></td>
                    <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                    <td>${escapeHtml(item.detail)}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `)}
    <div class="two-col admin-config-grid">
      ${panel("后端优先级", "IMPLEMENTATION ORDER", `
        <div class="panel-list">
          ${[
            ["1", "账号与角色", "登录、当前用户、路由权限"],
            ["2", "老师课程工作台", "课程、名单、进度、异常"],
            ["3", "成绩录入", "专项、平时、体测批量保存"],
            ["4", "导出与归档", "预检、CSV/XLSX、体育部确认"],
            ["5", "管理端配置", "规则、模板、用户、组织"],
            ["6", "审计日志", "所有写操作落 actor/action/target/time"],
          ]
            .map(([step, title, desc]) => `<div class="list-row" style="grid-template-columns:auto 1fr"><strong>${step}</strong><div><strong>${title}</strong><br /><small>${desc}</small></div></div>`)
            .join("")}
        </div>
      `)}
      ${panel("联调边界", "FRONTEND CONTRACT", `
        <div class="panel-body policy-card">
          <dl>
            <dt>本地存储键</dt><dd>${storageKey}</dd>
            <dt>正式样式</dt><dd>styles-campus-blue.css</dd>
            <dt>学生端</dt><dd>原生 App，不在 Web 路由内</dd>
            <dt>导出职责</dt><dd>正式版建议后端生成文件</dd>
            <dt>CSV 校验</dt><dd>前端可预检，服务端必须终验</dd>
          </dl>
        </div>
      `)}
    </div>
    ${panel("API 映射表", "ENDPOINT MAP", `
      <div class="table-wrap">
        <table>
          <thead><tr><th>分组</th><th>方法</th><th>接口</th><th>页面</th><th>优先级</th><th>说明</th></tr></thead>
          <tbody>
            ${backendEndpoints
              .map(
                (endpoint) => `
                  <tr>
                    <td><strong>${endpoint.group}</strong></td>
                    <td>${endpoint.method}</td>
                    <td><small>${endpoint.path}</small></td>
                    <td>${endpoint.route}</td>
                    <td><span class="status ${endpoint.priority === "P0" ? "warn" : "neutral"}">${endpoint.priority}</span></td>
                    <td>${endpoint.note}</td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `)}
  `;
}

function renderAdminSemesters() {
  return adminFrame(
    panel("学期设置", "P1-02", `
      <div class="table-wrap">
        <table>
          <thead><tr><th>学期</th><th>日期范围</th><th>状态</th><th>锁定</th><th>操作</th></tr></thead>
          <tbody>
            ${state.admin.semesters
              .map(
                (semester) => `
                  <tr>
                    <td><strong>${escapeHtml(semester.name)}</strong></td>
                    <td>${escapeHtml(semester.dateRange)}</td>
                    <td><span class="status ${statusClass(semester.status)}">${escapeHtml(semester.status)}</span></td>
                    <td>${escapeHtml(semester.locked)}</td>
                    <td>
                      <div class="button-row">
                        <button class="ghost-button" data-action="activate-semester" data-admin-id="${semester.id}">设为当前</button>
                        <button class="danger-button" data-admin-delete="semesters" data-admin-id="${semester.id}">删除</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `),
    panel("新增学期", "SEMESTER FORM", `
      <form class="panel-body form-grid" data-admin-form="semester">
        <div class="field"><label for="semesterName">学期名称</label><input id="semesterName" name="name" value="2027 Spring" /></div>
        <div class="field"><label for="semesterRange">日期范围</label><input id="semesterRange" name="dateRange" value="2027.02.23 - 2027.06.27" /></div>
        <div class="field"><label for="semesterStatus">状态</label><select id="semesterStatus" name="status"><option>草稿</option><option>进行中</option><option>已归档</option></select></div>
        <div class="field"><label for="semesterLocked">成绩锁定</label><select id="semesterLocked" name="locked"><option>否</option><option>是</option></select></div>
        <button class="primary-button" type="submit">保存学期</button>
      </form>
    `),
  );
}

function renderAdminCourses() {
  return adminFrame(
    panel("课程与老师管理", "P1-03", `
      <div class="table-wrap">
        <table>
          <thead><tr><th>课程</th><th>Section</th><th>老师</th><th>学期</th><th>学生</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${state.admin.courses
              .map(
                (course) => `
                  <tr>
                    <td><strong>${escapeHtml(course.code)}</strong><br /><small>${escapeHtml(course.name)}</small></td>
                    <td>${escapeHtml(sectionDisplay(course.section || "1004"))}</td>
                    <td>${escapeHtml(course.teacher)}</td>
                    <td>${escapeHtml(course.semester)}</td>
                    <td>${course.students}</td>
                    <td><span class="status ${statusClass(course.status)}">${escapeHtml(course.status)}</span></td>
                    <td><button class="danger-button" data-admin-delete="courses" data-admin-id="${course.id}">删除</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `),
    panel("新增课程", "COURSE FORM", `
      <form class="panel-body form-grid" data-admin-form="course">
        <div class="field"><label for="courseCode">课程代码</label><input id="courseCode" name="code" value="PER210" /></div>
        <div class="field"><label for="courseSection">Section</label><input id="courseSection" name="section" value="1004" /></div>
        <div class="field"><label for="courseName">课程名称</label><input id="courseName" name="name" value="飞盘基础" /></div>
        <div class="field"><label for="courseTeacher">任课老师</label><input id="courseTeacher" name="teacher" value="赵老师" /></div>
        <div class="field"><label for="courseSemester">所属学期</label><input id="courseSemester" name="semester" value="2026 Spring" /></div>
        <div class="field"><label for="courseStudents">学生数</label><input id="courseStudents" name="students" type="number" value="36" /></div>
        <div class="field"><label for="courseStatus">状态</label><select id="courseStatus" name="status"><option>草稿</option><option selected>正常</option><option>已归档</option></select></div>
        <button class="primary-button" type="submit">保存课程</button>
      </form>
    `),
  );
}

function renderAdminUsers() {
  return adminFrame(
    panel("用户管理", "P1-04", `
      <div class="table-wrap">
        <table>
          <thead><tr><th>用户</th><th>邮箱</th><th>角色</th><th>权限范围</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${state.admin.users
              .map(
                (user) => `
                  <tr>
                    <td><strong>${escapeHtml(user.name)}</strong></td>
                    <td>${escapeHtml(user.email)}</td>
                    <td>${escapeHtml(user.role)}</td>
                    <td>${escapeHtml(user.scope)}</td>
                    <td><span class="status ${statusClass(user.status)}">${escapeHtml(user.status)}</span></td>
                    <td><button class="danger-button" data-admin-delete="users" data-admin-id="${user.id}">删除</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `),
    panel("新增用户", "USER FORM", `
      <form class="panel-body form-grid" data-admin-form="user">
        <div class="field"><label for="userName">姓名</label><input id="userName" name="name" value="新任课老师" /></div>
        <div class="field"><label for="userEmail">邮箱</label><input id="userEmail" name="email" value="new.teacher@bnbu.edu.cn" /></div>
        <div class="field"><label for="userRole">角色</label><select id="userRole" name="role"><option>体育任课老师</option><option>体育部管理员</option><option>组织负责人</option></select></div>
        <div class="field"><label for="userScope">权限范围</label><input id="userScope" name="scope" value="GEPE101" /></div>
        <button class="primary-button" type="submit">保存用户</button>
      </form>
    `),
  );
}

function renderSportRules() {
  const rules = state.admin.sportRules;
  return adminFrame(
    panel("体育学时标准", "P1-05", `
      <form class="panel-body form-grid" data-admin-form="sport-rules">
        <div class="field"><label for="sportVersion">规则版本</label><input id="sportVersion" name="version" value="${escapeHtml(rules.version)}" /></div>
        <div class="field"><label for="sportStatus">状态</label><select id="sportStatus" name="status"><option ${selectedAttr(rules.status, "草稿")}>草稿</option><option ${selectedAttr(rules.status, "正常")}>正常</option><option ${selectedAttr(rules.status, "需复核")}>需复核</option></select></div>
        <div class="field"><label for="sportTotal">总学时</label><input id="sportTotal" name="total" type="number" value="${rules.total}" /></div>
        <div class="field"><label for="sportCourse">课程相关</label><input id="sportCourse" name="courseRequired" type="number" value="${rules.courseRequired}" /></div>
        <div class="field"><label for="sportGeneral">其他运动</label><input id="sportGeneral" name="generalRequired" type="number" value="${rules.generalRequired}" /></div>
        <div class="field"><label for="sportDaily">单日上限</label><input id="sportDaily" name="dailyLimit" type="number" step="0.5" value="${rules.dailyLimit}" /></div>
        <div class="field"><label for="sportStack">抵扣叠加</label><select id="sportStack" name="stackAllowed"><option ${selectedAttr(rules.stackAllowed, "不允许")}>不允许</option><option ${selectedAttr(rules.stackAllowed, "允许")}>允许</option></select></div>
        <div class="field"><label for="sportOffset">组织抵扣</label><input id="sportOffset" name="organizationOffset" value="${escapeHtml(rules.organizationOffset)}" /></div>
        <button class="primary-button" type="submit">保存学时规则</button>
      </form>
    `),
    panel("规则预览", "RULE PREVIEW", `
      <div class="panel-body policy-card">
        <h3>${rules.total}h</h3>
        <div class="data-grid compact-data-grid">
          <article class="data-tile"><span class="muted">课程相关</span><strong>${rules.courseRequired}</strong></article>
          <article class="data-tile"><span class="muted">其他运动</span><strong>${rules.generalRequired}</strong></article>
          <article class="data-tile"><span class="muted">单日上限</span><strong>${rules.dailyLimit}</strong></article>
          <article class="data-tile"><span class="muted">叠加</span><strong>${escapeHtml(rules.stackAllowed)}</strong></article>
        </div>
      </div>
    `),
  );
}

function renderGradeRulesAdmin() {
  const total = state.admin.gradeRules.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  return panel("成绩规则配置", "P1-06", `
    ${adminNotice()}
    <form data-admin-form="grade-rules">
      <div class="table-wrap">
        <table>
          <thead><tr><th>成绩块</th><th>权重</th><th>数据来源</th><th>状态</th></tr></thead>
          <tbody>
            ${state.admin.gradeRules
              .map(
                (rule) => `
                  <tr>
                    <td><strong>${escapeHtml(rule.name)}</strong></td>
                    <td><input class="input-cell" name="${rule.key}" type="number" min="0" max="100" value="${rule.weight}" />%</td>
                    <td>${escapeHtml(rule.source)}</td>
                    <td><span class="status ${statusClass(rule.status)}">${escapeHtml(rule.status)}</span></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div class="panel-body config-toolbar">
        <div class="weight-total ${total === 100 ? "is-ok" : "is-bad"}">总权重 ${total}%</div>
        <div class="button-row">
          <button class="ghost-button" type="submit">保存草稿</button>
          <button class="primary-button" type="button" data-action="publish-grade">发布规则</button>
        </div>
      </div>
    </form>
  `);
}

function renderConversionRules() {
  // Overview dashboard — links to per-population detail pages
  var populations = [
    { key: 'freshman_sophomore-male', label: '大一/大二 · 男 · 1000m', gradeGroup: 'freshman_sophomore', gender: 'male', icon: '🏃' },
    { key: 'freshman_sophomore-female', label: '大一/大二 · 女 · 800m', gradeGroup: 'freshman_sophomore', gender: 'female', icon: '🏃‍♀️' },
    { key: 'junior_senior-male', label: '大三/大四 · 男 · 1000m', gradeGroup: 'junior_senior', gender: 'male', icon: '🏃' },
    { key: 'junior_senior-female', label: '大三/大四 · 女 · 800m', gradeGroup: 'junior_senior', gender: 'female', icon: '🏃‍♀️' },
  ];

  var cards = populations.map(function(p) {
    return [
      '<div class="conversion-pop-card" style="border:2px solid var(--line);padding:16px;cursor:pointer" data-route="admin-conversion-detail" data-conversion-tab-preset="' + p.key + '">',
      '<p class="eyebrow">' + p.icon + ' ' + p.label + '</p>',
      '<p style="font-size:12px;color:var(--color-muted);margin:4px 0">每1秒一个分数点 · ' + (p.gender === 'male' ? '1000m' : '800m') + '</p>',
      '<button class="ghost-button" style="margin-top:8px" data-route="admin-conversion-detail" data-conversion-tab-preset="' + p.key + '">管理换算表 →</button>',
      '</div>'
    ].join('');
  }).join('');

  return adminFrame(
    panel("体测换算表", "P1-07 ENDURANCE SCORING", `
      ${adminNotice()}
      <p style="color:var(--color-muted);font-size:13px;margin-bottom:16px">
        耐力跑成绩按每1秒一个分数点进行换算。点击下方卡片进入各年级组/性别的详细管理页面，支持查看、编辑和批量导入换算数据。
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
        ${cards}
      </div>
    `)
  );
}

function renderExportTemplateAdmin() {
  const template = state.admin.exportTemplate;
  return adminFrame(
    panel("导出模板配置", "P1-08", `
      <form class="panel-body form-grid" data-admin-form="export-template">
        <div class="field"><label for="templateName">模板名称</label><input id="templateName" name="name" value="${escapeHtml(template.name)}" /></div>
        <div class="field"><label for="templateFormat">文件格式</label><select id="templateFormat" name="format"><option ${selectedAttr(template.format, "CSV")}>CSV</option><option ${selectedAttr(template.format, "Excel")}>Excel</option></select></div>
        <div class="field" style="grid-column:1/-1"><label for="templateFields">字段顺序</label><textarea id="templateFields" name="fields">${template.fields.map(escapeHtml).join("\n")}</textarea></div>
        <button class="primary-button" type="submit">保存模板</button>
      </form>
    `),
    panel("导出预览", "EXPORT PREVIEW", `
      <div class="table-wrap">
        <table>
          <thead><tr>${template.fields.map((field) => `<th>${escapeHtml(field)}</th>`).join("")}</tr></thead>
          <tbody><tr>${template.fields.map((field) => `<td>${field === "学号" ? "22301142" : field === "姓名" ? "陈雨晴" : field === "课程代码" ? currentCourse().code : field === "Section" ? sectionDisplay() : field === "总分" ? "86" : "-"}</td>`).join("")}</tr></tbody>
        </table>
      </div>
    `),
  );
}

function renderAdminOrganizations(title, eyebrow, collection) {
  const items = state.admin[collection];
  return adminFrame(
    panel(title, eyebrow, `
      <div class="table-wrap">
        <table>
          <thead><tr><th>组织</th><th>类型</th><th>成员</th><th>抵扣</th><th>负责人</th><th>状态</th><th>操作</th></tr></thead>
          <tbody>
            ${items
              .map(
                (item) => `
                  <tr>
                    <td><strong>${escapeHtml(item.name)}</strong></td>
                    <td>${escapeHtml(item.type)}</td>
                    <td>${item.members}</td>
                    <td>${escapeHtml(item.offset)}</td>
                    <td>${escapeHtml(item.owner)}</td>
                    <td><span class="status ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
                    <td><button class="danger-button" data-admin-delete="${collection}" data-admin-id="${item.id}">删除</button></td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `),
    panel("新增组织", "ORGANIZATION FORM", `
      <form class="panel-body form-grid" data-admin-form="organization" data-collection="${collection}">
        <div class="field"><label for="${collection}Name">组织名称</label><input id="${collection}Name" name="name" value="${collection === "teams" ? "排球校队" : "瑜伽社"}" /></div>
        <div class="field"><label for="${collection}Type">类型</label><input id="${collection}Type" name="type" value="${collection === "teams" ? "校队" : "体育类"}" /></div>
        <div class="field"><label for="${collection}Members">成员数</label><input id="${collection}Members" name="members" type="number" value="24" /></div>
        <div class="field"><label for="${collection}Offset">抵扣</label><select id="${collection}Offset" name="offset"><option>可抵扣</option><option>不抵扣</option></select></div>
        <div class="field"><label for="${collection}Owner">负责人</label><input id="${collection}Owner" name="owner" value="体育部" /></div>
        <button class="primary-button" type="submit">保存组织</button>
      </form>
    `),
  );
}

function filteredOrganizationAuditRows() {
  return state.memberships.filter((membership) => {
    const offsetState = membershipOffsetState(membership);
    return (
      state.adminOrganizationFilter === "all" ||
      (state.adminOrganizationFilter === "pending" && membership.status === "待确认") ||
      (state.adminOrganizationFilter === "effective" && offsetState === "抵扣生效") ||
      (state.adminOrganizationFilter === "blocked" && ["不抵扣", "规则不允许", "未生效"].includes(offsetState))
    );
  });
}

function renderAdminOrganizationAudit() {
  const rows = filteredOrganizationAuditRows();
  const total = state.memberships.length;
  const effective = state.memberships.filter((membership) => membershipOffsetState(membership) === "抵扣生效").length;
  const pending = state.memberships.filter((membership) => membership.status === "待确认").length;
  const blocked = state.memberships.filter((membership) => ["不抵扣", "规则不允许"].includes(membershipOffsetState(membership))).length;
  return `
    ${adminNotice()}
    <div class="data-grid">
      <article class="data-tile"><span class="muted">认证记录</span><strong>${total}</strong></article>
      <article class="data-tile"><span class="muted">抵扣生效</span><strong>${effective}</strong></article>
      <article class="data-tile"><span class="muted">待确认</span><strong>${pending}</strong></article>
      <article class="data-tile"><span class="muted">不抵扣</span><strong>${blocked}</strong></article>
    </div>
    ${panel("组织抵扣审核", "OFFSET AUDIT", `
      <div class="panel-body review-toolbar">
        <div class="field">
          <label for="adminOrganizationFilter">审核范围</label>
          <select id="adminOrganizationFilter" data-admin-organization-filter>
            <option value="all" ${selectedAttr(state.adminOrganizationFilter, "all")}>全部记录</option>
            <option value="pending" ${selectedAttr(state.adminOrganizationFilter, "pending")}>待确认</option>
            <option value="effective" ${selectedAttr(state.adminOrganizationFilter, "effective")}>抵扣生效</option>
            <option value="blocked" ${selectedAttr(state.adminOrganizationFilter, "blocked")}>未抵扣 / 规则不允许</option>
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>学生</th><th>组织</th><th>身份状态</th><th>抵扣状态</th><th>来源</th><th>操作</th></tr></thead>
          <tbody>
            ${rows
              .map((membership) => {
                const offsetState = membershipOffsetState(membership);
                const config = organizationConfigForMembership(membership);
                return `
                  <tr>
                    <td><strong>${escapeHtml(membership.studentName)}</strong><br /><small>${escapeHtml(membership.studentId)}</small></td>
                    <td>${escapeHtml(membership.organization)}<br /><small>${membership.type === "team" ? "校队" : "社团"} / ${escapeHtml(config?.type || "未配置")}</small></td>
                    <td><span class="status ${statusClass(membership.status)}">${escapeHtml(membership.status)}</span></td>
                    <td><span class="status ${statusClass(offsetState)}">${escapeHtml(offsetState)}</span></td>
                    <td><strong>${escapeHtml(membership.updatedBy || "未知")}</strong><br /><small>${escapeHtml(membership.updatedAt || "-")} / ${escapeHtml(membership.comment || "无备注")}</small></td>
                    <td>
                      <div class="button-row">
                        <button class="ghost-button" data-admin-member-action="confirm-member" data-member-id="${membership.id}">确认有效</button>
                        <button class="ghost-button" data-admin-member-action="force-offset" data-member-id="${membership.id}">认可抵扣</button>
                        <button class="danger-button" data-admin-member-action="revoke-offset" data-member-id="${membership.id}">取消抵扣</button>
                      </div>
                    </td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
      ${rows.length ? "" : `<div class="empty">没有符合筛选条件的组织认证记录。</div>`}
    `)}
  `;
}

function renderAdminLogs() {
  return panel("操作日志", "AUDIT LOG", `
    <div class="table-wrap">
      <table>
        <thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th></tr></thead>
        <tbody>
          ${state.logs
            .map(
              (log) => `
                <tr>
                  <td>${escapeHtml(log.time)}</td>
                  <td><strong>${escapeHtml(log.actor)}</strong></td>
                  <td>${escapeHtml(log.action)}</td>
                  <td>${escapeHtml(log.target)}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `);
}

function renderAdminDeliveryAudit() {
  const records = allCourses().map((course) => {
    const record = deliveryRecordForCourse(course.id);
    const issues = exportIssues(course.id);
    const count = issueCount(issues);
    if (record.status === "未提交") {
      record.issueCount = count;
    }
    return { course, record, issues, count };
  });
  const pending = records.filter(({ record }) => record.status === "待管理员确认").length;
  const blocked = records.filter(({ record }) => ["待清理", "退回清理"].includes(record.status)).length;
  const archived = records.filter(({ record }) => record.status === "已归档").length;
  return `
    ${adminNotice()}
    <div class="data-grid">
      <article class="data-tile"><span class="muted">待确认</span><strong>${pending}</strong></article>
      <article class="data-tile"><span class="muted">待清理</span><strong>${blocked}</strong></article>
      <article class="data-tile"><span class="muted">已归档</span><strong>${archived}</strong></article>
      <article class="data-tile"><span class="muted">课程总数</span><strong>${records.length}</strong></article>
    </div>
    ${panel("成绩归档审核", "GRADE DELIVERY", `
      <div class="table-wrap">
        <table>
          <thead><tr><th>课程</th><th>老师提交</th><th>预检问题</th><th>状态</th><th>说明</th><th>操作</th></tr></thead>
          <tbody>
            ${records
              .map(
                ({ course, record, issues, count }) => `
                  <tr>
                    <td><strong>${courseOfferingLabel(course)}</strong><br /><small>${course.name}</small></td>
                    <td>${escapeHtml(record.submittedBy)}<br /><small>${escapeHtml(record.submittedAt)}</small></td>
                    <td>
                      <strong>${count}</strong>
                      <br /><small>体测 ${issues.missingPhysical.length} / 打卡 ${issues.checkinNotEnough.length} / 异常 ${issues.unresolvedReviews.length}</small>
                    </td>
                    <td><span class="status ${statusClass(record.status)}">${escapeHtml(record.status)}</span></td>
                    <td>${escapeHtml(record.comment)}</td>
                    <td>
                      <div class="button-row">
                        <button class="ghost-button" data-delivery-action="remind" data-course-id="${course.id}">提醒老师</button>
                        <button class="primary-button" data-delivery-action="archive" data-course-id="${course.id}">确认归档</button>
                        <button class="danger-button" data-delivery-action="return" data-course-id="${course.id}">退回清理</button>
                      </div>
                    </td>
                  </tr>
                `,
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `)}
  `;
}

function renderStudentDetail() {
  const allStudents = studentsForCourse();
  const studentId = state.studentDetailId || (allStudents[0]?.id || "");
  const student = allStudents.find((s) => s.id === studentId);
  if (!student) return `<div class="empty">未找到学生</div>`;

  // Async fetch: load API data when available
  const studentDetailLoadKey = `student-detail:${state.courseId}:${studentId}`;
  if (shouldStartApiLoad(studentDetailLoadKey)) {
    Promise.all([
      fetchStudentHoursDetail(state.courseId, studentId).catch(() => null),
      fetchStudentOrgIdentity(state.courseId, studentId).catch(() => null),
    ]).then(([detailData, orgData]) => {
      finishApiLoad(studentDetailLoadKey, Boolean(detailData || orgData));
      if (detailData) state.studentHoursDetail = detailData;
      if (orgData) state.studentOrgIdentity = orgData;
      renderRoute();
    });
  }

  // Build the unified records view (Feature #1)
  const recordsHtml = buildStudentRecordsHtml(studentId);
  // Build org identity panel (Feature #5)
  const orgIdentityHtml = buildOrgIdentityHtml(studentId);
  // Build manual credit form (Feature #1)
  const manualCreditHtml = buildManualCreditForm(studentId);

  return `
    ${teacherNotice()}
    <div class="two-col">
      <div>
        ${panel("学生学时明细", "ALL HOUR SOURCES — AGGREGATED", `
          <div class="panel-body review-toolbar">
            <div class="form-grid">
              <div class="field">
                <label for="studentDetailId">选择学生</label>
                <select id="studentDetailId" data-student-detail-select>
                  ${allStudents.map((s) => `<option value="${s.id}" ${selectedAttr(s.id, studentId)}>${escapeHtml(s.name)} (${s.id})</option>`).join("")}
                </select>
              </div>
            </div>
          </div>
          ${recordsHtml}
        `)}
        ${panel("学时汇总", "HOURS SUMMARY BY SOURCE", buildStudentHoursSummaryHtml(studentId))}
      </div>
      <div>
        ${studentInfoPanel(student)}
        ${studentHoursPanel(student)}
        ${orgIdentityHtml}
        ${manualCreditHtml}
      </div>
    </div>
  `;
}

function studentInfoPanel(student) {
  const genderLabel = student.gender === 'male' ? '男' : student.gender === 'female' ? '女' : '未设置';
  const gradeLabel = student.gradeLevel === 'freshman' ? '大一' : student.gradeLevel === 'sophomore' ? '大二' : student.gradeLevel === 'junior' ? '大三' : student.gradeLevel === 'senior' ? '大四' : '未设置';
  return panel("学生信息", "STUDENT PROFILE", `
    <div class="panel-body">
      <div class="setting-line"><strong>学号</strong><span>${escapeHtml(student.id)}</span></div>
      <div class="setting-line"><strong>姓名</strong><span>${escapeHtml(student.name)}</span></div>
      <div class="setting-line"><strong>学院</strong><span>${escapeHtml(student.college || '未设置')}</span></div>
      <div class="setting-line"><strong>性别</strong><span>${genderLabel}</span></div>
      <div class="setting-line"><strong>年级</strong><span>${gradeLabel}</span></div>
      <div class="setting-line"><strong>状态</strong><span class="status ${statusClass(student.status)}">${escapeHtml(student.status)}</span></div>
    </div>
  `);
}

function studentHoursPanel(student) {
  const targets = sportRuleTargets();
  const coursePct = Math.min(100, Math.round((student.course / targets.courseRequired) * 100));
  const generalPct = Math.min(100, Math.round((student.general / targets.generalRequired) * 100));
  return panel("体育学时进度", "SPORT HOURS", `
    <div class="panel-body">
      <div class="progress-row">
        <span>课程相关</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${coursePct}%"></div></div>
        <strong>${student.course} / ${targets.courseRequired}h</strong>
      </div>
      <div class="progress-row" style="margin-top:10px">
        <span>其他运动</span>
        <div class="progress-bar"><div class="progress-fill" style="width:${generalPct}%"></div></div>
        <strong>${student.general} / ${targets.generalRequired}h</strong>
      </div>
      <div class="score-grid" style="margin-top:14px">
        <div class="score-cell"><span>考试</span><strong>${student.exam || '-'}</strong></div>
        <div class="score-cell"><span>出勤</span><strong>${student.attendance || '-'}</strong></div>
        <div class="score-cell"><span>体测</span><strong>${student.physical || '-'}</strong></div>
      </div>
    </div>
  `);
}

function buildStudentHoursSummaryHtml(studentId) {
  const targets = sportRuleTargets();
  const allStudents = studentsForCourse();
  const student = allStudents.find((s) => s.id === studentId);
  // Use API data when available
  if (state.studentHoursDetail && state.studentHoursDetail.summary && state.studentHoursDetail.studentId === studentId) {
    const s = state.studentHoursDetail.summary;
    const totalApproved = s.totalApproved || 0;

    return `
      <div class="panel-body">
        <div class="setting-line"><strong>学生自提交（课程相关）</strong><span>${(s.studentSubmitted || 0).toFixed(1)}h (审批通过)</span></div>
        <div class="setting-line"><strong>学生自提交（总申请）</strong><span>${(s.totalApplied || 0).toFixed(1)}h</span></div>
        <div class="setting-line"><strong>校队抵扣</strong><span>${(s.teamOffset || 0).toFixed(1)}h</span></div>
        <div class="setting-line"><strong>社团抵扣</strong><span>${(s.clubOffset || 0).toFixed(1)}h</span></div>
        <div class="setting-line"><strong>老师任务完成</strong><span>${(s.teacherTask || 0).toFixed(1)}h</span></div>
        <div class="setting-line"><strong>老师手动加抵</strong><span>${(s.manualCredit || 0).toFixed(1)}h</span></div>
        <div class="setting-line" style="border-top:1.5px solid var(--color-text);padding-top:8px;margin-top:8px"><strong>合计</strong><span><strong>${totalApproved.toFixed(1)}h</strong></span></div>
        <div class="setting-line" style="margin-top:8px"><strong>课程相关</strong><span><strong>${student.course.toFixed(1)} / ${targets.courseRequired}h</strong></span></div>
        <div class="setting-line"><strong>其他运动</strong><span><strong>${student.general.toFixed(1)} / ${targets.generalRequired}h</strong></span></div>
      </div>
    `;
  }

  // Local mock fallback
  if (!student) return `<div class="panel-body"><p class="empty">未找到学生</p></div>`;
  // Aggregate from all sources
  const reviewHours = state.reviews
    .filter(r => r.studentId === studentId && r.courseId === state.courseId && ['已通过','可通过'].includes(r.status))
    .reduce((s, r) => s + (r.approvedHours || r.hours || 0), 0);
  const checkinHours = state.reviews
    .filter(r => r.studentId === studentId && r.courseId === state.courseId)
    .reduce((s, r) => s + r.hours, 0);
  const membershipHours = state.memberships
    .filter(m => m.studentId === studentId && m.offset === '可抵扣' && m.status === '认证有效')
    .reduce((s, m) => s + (m.offsetHours || 10.0), 0);
  const manualHours = (state.manualCredits || [])
    .filter(mc => mc.studentId === studentId && mc.courseId === state.courseId)
    .reduce((s, mc) => s + mc.hours, 0);
  const totalApproved = reviewHours + membershipHours + manualHours;

  return `
    <div class="panel-body">
      <div class="setting-line"><strong>学生自提交（课程相关）</strong><span>${reviewHours.toFixed(1)}h (审批通过)</span></div>
      <div class="setting-line"><strong>学生自提交（总申请）</strong><span>${checkinHours.toFixed(1)}h</span></div>
      <div class="setting-line"><strong>校队/社团抵扣</strong><span>${membershipHours.toFixed(1)}h</span></div>
      <div class="setting-line"><strong>老师手动加抵</strong><span>${manualHours.toFixed(1)}h</span></div>
      <div class="setting-line" style="border-top:1.5px solid var(--color-text);padding-top:8px;margin-top:8px"><strong>合计</strong><span><strong>${totalApproved.toFixed(1)}h</strong></span></div>
      <div class="setting-line" style="margin-top:8px"><strong>课程相关</strong><span><strong>${student.course.toFixed(1)} / ${targets.courseRequired}h</strong></span></div>
      <div class="setting-line"><strong>其他运动</strong><span><strong>${student.general.toFixed(1)} / ${targets.generalRequired}h</strong></span></div>
    </div>
  `;
}

function buildOrgIdentityHtml(studentId) {
  // Use API data when available
  if (state.studentOrgIdentity && state.studentOrgIdentity.identities) {
    const identities = state.studentOrgIdentity.identities;
    if (identities.length === 0) return panel("组织身份", "ORGANIZATION IDENTITY", `<div class="panel-body"><p class="empty">该学生无校队/社团身份记录</p></div>`);

    return panel("组织身份", "ORGANIZATION IDENTITY", `
      <div class="panel-body">
        ${identities.map(m => {
          const typeLabel = m.typeLabel || (m.type === 'team' ? '校队' : '社团');
          const isSport = m.isSport !== undefined ? (m.isSport ? '是' : '否') : (m.type === 'team' ? '是' : '是');
          const statusClass = m.status === '认证有效' ? 'status-ok' : m.status === '不通过' || m.status === '非体育类' ? 'status-risk' : 'status-pending';
          const offsetClass = m.offsetStatus === '可抵扣' ? 'status-ok' : m.offsetStatus === '不抵扣' ? 'status-risk' : 'status-pending';
          return `
          <div class="org-identity-card" style="margin-bottom:12px;padding:12px;border:1.5px solid var(--color-border)">
            <div class="setting-line"><strong>${escapeHtml(m.organization)}</strong><span>${typeLabel}</span></div>
            <div class="setting-line"><span>组织类型</span><span>${typeLabel}</span></div>
            <div class="setting-line"><span>是否体育类</span><span>${isSport}</span></div>
            <div class="setting-line"><span>身份状态</span><span class="status ${statusClass}">${escapeHtml(m.statusLabel || m.status)}</span></div>
            <div class="setting-line"><span>有效期</span><span>${escapeHtml(m.validUntil || '-')}</span></div>
            <div class="setting-line"><span>抵扣状态</span><span class="status ${offsetClass}">${escapeHtml(m.offsetStatusLabel || m.offsetStatus)}</span></div>
            <div class="setting-line"><span>抵扣小时</span><span>${(m.offsetHours || 10.0)}h</span></div>
            <div class="setting-line"><span>认证人</span><span>${escapeHtml(m.confirmedBy || m.updatedBy || '-')}</span></div>
            ${m.comment ? `<div class="setting-line"><span>备注</span><span style="font-size:12px;color:var(--color-muted)">${escapeHtml(m.comment)}</span></div>` : ''}
            ${m.rejectionReason ? `<div class="setting-line"><span>驳回原因</span><span style="color:var(--color-red)">${escapeHtml(m.rejectionReason)}</span></div>` : ''}
            <div class="button-row" style="margin-top:8px">
              <button class="ghost-button" data-org-flag="confirmed" data-org-id="${m.id}" data-student-id="${studentId}">标记已确认</button>
              <button class="danger-button" data-org-flag="questionable" data-org-id="${m.id}" data-student-id="${studentId}">标记存疑</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    `);
  }

  // Local mock fallback
  const identities = state.memberships.filter(m => m.studentId === studentId);
  if (identities.length === 0) return panel("组织身份", "ORGANIZATION IDENTITY", `<div class="panel-body"><p class="empty">该学生无校队/社团身份记录</p></div>`);

  return panel("组织身份", "ORGANIZATION IDENTITY", `
    <div class="panel-body">
      ${identities.map(m => {
        const typeLabel = m.type === 'team' ? '校队' : '社团';
        const isSport = m.type === 'team' ? '是' : (m.status === '非体育类' ? '否' : '是');
        const statusClass = m.status === '认证有效' ? 'status-ok' : m.status === '不通过' || m.status === '非体育类' ? 'status-risk' : 'status-pending';
        const offsetClass = m.offset === '可抵扣' ? 'status-ok' : m.offset === '不抵扣' ? 'status-risk' : 'status-pending';
        return `
        <div class="org-identity-card" style="margin-bottom:12px;padding:12px;border:1.5px solid var(--color-border)">
          <div class="setting-line"><strong>${escapeHtml(m.organization)}</strong><span>${typeLabel}</span></div>
          <div class="setting-line"><span>组织类型</span><span>${typeLabel}</span></div>
          <div class="setting-line"><span>是否体育类</span><span>${isSport}</span></div>
          <div class="setting-line"><span>身份状态</span><span class="status ${statusClass}">${escapeHtml(m.status)}</span></div>
          <div class="setting-line"><span>有效期</span><span>${escapeHtml(m.validUntil || '-')}</span></div>
          <div class="setting-line"><span>抵扣状态</span><span class="status ${offsetClass}">${escapeHtml(m.offset)}</span></div>
          <div class="setting-line"><span>认证人</span><span>${escapeHtml(m.updatedBy || '-')}</span></div>
          ${m.comment ? `<div class="setting-line"><span>备注</span><span style="font-size:12px;color:var(--color-muted)">${escapeHtml(m.comment)}</span></div>` : ''}
          <div class="button-row" style="margin-top:8px">
            <button class="ghost-button" data-org-flag="confirmed" data-org-id="${m.id}" data-student-id="${studentId}">标记已确认</button>
            <button class="danger-button" data-org-flag="questionable" data-org-id="${m.id}" data-student-id="${studentId}">标记存疑</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `);
}

function buildManualCreditForm(studentId) {
  return panel("手动加抵卡", "MANUAL CREDIT", `
    <form class="panel-body form-grid" data-manual-credit-form data-student-id="${studentId}">
      <div class="field">
        <label for="manualCreditType">抵扣类型</label>
        <select id="manualCreditType">
          <option value="课程相关">课程相关</option>
          <option value="其他运动">其他运动</option>
        </select>
      </div>
      <div class="field">
        <label for="manualCreditHours">抵扣小时数</label>
        <input id="manualCreditHours" type="number" min="0.5" max="20" step="0.5" value="1" />
      </div>
      <div class="field" style="grid-column:1/-1">
        <label for="manualCreditReason">原因说明（必填）</label>
        <textarea id="manualCreditReason" style="width:100%;min-height:60px" placeholder="请输入加抵原因，例如：参加校级运动会训练"></textarea>
      </div>
      <button type="submit" class="primary-button">确认加抵</button>
    </form>
    <div id="manualCreditResult" class="panel-body" style="display:none"></div>
  `);
}

function buildStudentRecordsHtml(studentId) {
  const targets = sportRuleTargets();

  // Use API data when available, otherwise fall back to mock/local state
  if (state.studentHoursDetail && state.studentHoursDetail.items && state.studentHoursDetail.studentId === studentId) {
    const items = state.studentHoursDetail.items;
    if (items.length === 0) return `<div class="empty">该学生暂无打卡记录</div>`;
    return `
      <div class="table-wrap">
        <table>
          <thead><tr><th>来源类型</th><th>运动类型</th><th>申请小时</th><th>审批小时</th><th>提交时间</th><th>审核状态</th><th>审核人</th><th>凭证</th></tr></thead>
          <tbody>
            ${items.map((r) => `
              <tr>
                <td>${escapeHtml(r.sourceType)}</td>
                <td>${escapeHtml(r.sportType)}</td>
                <td>${r.appliedHours}h</td>
                <td>${r.approvedHours}h</td>
                <td>${escapeHtml(r.submittedAt || '-')}</td>
                <td><span class="status ${r.status === '系统抵扣' ? 'status-offset' : r.status === '待审核' || r.status === '待确认' ? 'status-pending' : r.status === '可通过' || r.status === '已通过' ? 'status-ok' : 'status-risk'}">${escapeHtml(r.status)}</span></td>
                <td>${escapeHtml(r.reviewer || '-')}</td>
                <td>${renderProofLink(r.proofFiles?.[0], r.proofFiles?.length) || '-'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // Local mock fallback
  // Collect all records: from reviews, from memberships, from manual credits
  const reviewRecords = state.reviews
    .filter((r) => r.studentId === studentId && r.courseId === state.courseId)
    .map((r) => ({
      id: r.id, source: '学生自提交', sourceCategory: 'student', creditType: r.type, hours: r.hours,
      approvedHours: r.approvedHours, status: r.status === '待确认' ? '待审核' : r.status === '可通过' ? '可通过' : r.status,
      description: r.task || r.reason, reviewComment: r.comment, submittedAt: '',
      taskId: r.task || '', proofFiles: r.proofFiles || []
    }));

  const membershipRecords = state.memberships
    .filter((m) => m.studentId === studentId && m.offset === '可抵扣' && m.status === '认证有效')
    .map((m) => ({
      id: 'offset-' + m.id, source: m.type === 'team' ? '校队抵扣' : '社团抵扣', sourceCategory: m.type, creditType: '其他运动',
      hours: m.offsetHours || 10.0, approvedHours: m.offsetHours || 10.0, status: '系统抵扣',
      description: m.organization + ' 抵扣', reviewComment: m.comment, submittedAt: '',
      taskId: m.organization
    }));

  const manualRecords = (state.manualCredits || [])
    .filter(mc => mc.studentId === studentId && mc.courseId === state.courseId)
    .map(mc => ({
      id: 'manual-' + mc.id, source: '老师手动加抵', sourceCategory: 'manual', creditType: mc.creditType, hours: mc.hours,
      approvedHours: mc.hours, status: '已通过',
      description: mc.reason, reviewComment: '', submittedAt: mc.createdAt || '',
      taskId: ''
    }));

  const allRecords = [...reviewRecords, ...membershipRecords, ...manualRecords];

  if (allRecords.length === 0) return `<div class="empty">该学生暂无打卡记录</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>来源类型</th><th>运动类型</th><th>申请小时</th><th>审批小时</th><th>提交时间</th><th>审核状态</th><th>审核人</th><th>凭证</th></tr></thead>
        <tbody>
          ${allRecords.map((r) => `
            <tr>
              <td>${escapeHtml(r.source)}</td>
              <td>${escapeHtml(r.creditType)}</td>
              <td>${r.hours}h</td>
              <td>${r.approvedHours}h</td>
              <td>${escapeHtml(r.submittedAt || '-')}</td>
              <td><span class="status ${r.status === '系统抵扣' ? 'status-offset' : r.status === '待审核' || r.status === '待确认' ? 'status-pending' : r.status === '可通过' || r.status === '已通过' ? 'status-ok' : 'status-risk'}">${escapeHtml(r.status)}</span></td>
              <td>${escapeHtml(r.reviewComment || '-')}</td>
              <td>${renderProofLink(r.proofFiles?.[0], r.proofFiles?.length) || '-'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ── Feature #2: Pending certifications page ──────────────────────
function renderPendingCertifications() {
  // Async fetch: load API data when available
  const pendingCertsLoadKey = `pending-certs:${state.courseId}`;
  if (shouldStartApiLoad(pendingCertsLoadKey)) {
    fetchPendingCertifications(state.courseId)
      .then(data => {
        finishApiLoad(pendingCertsLoadKey, true);
        if (data) state.pendingCerts = data.items || [];
        renderRoute();
      })
      .catch(() => {
        finishApiLoad(pendingCertsLoadKey, false);
        renderRoute();
      });
  }

  // Use API data when available
  const apiPending = (state.pendingCerts || []).filter(m => m.offset_status === '待确认');
  const apiProcessed = (state.pendingCerts || []).filter(m => m.offset_status !== '待确认');

  const pendingMems = apiPending.length > 0 ? apiPending :
    state.memberships.filter(m => m.offset === '待确认' && m.status === '认证有效');
  const processedMems = apiProcessed.length > 0 || state.pendingCerts.length > 0 ? apiProcessed :
    state.memberships.filter(m => m.offset !== '待确认' || m.status !== '认证有效');

  // Use a unified render helper
  const renderRows = (mems, isPending) => mems.map(m => {
    const name = m.student_name || m.studentName || '';
    const sid = m.student_id || m.studentId || '';
    const org = m.organization || '';
    const type = m.type || '';
    const offsetHours = m.offset_hours || m.offsetHours || 10.0;
    const offset = m.offset_status || m.offset || '';
    const offsetStatus = m.offset_status || m.offset || '';

    if (isPending) {
      return `
        <tr>
          <td><strong>${escapeHtml(name)}</strong><br /><small>${escapeHtml(sid)}</small></td>
          <td>${escapeHtml(org)}</td>
          <td>${type === 'team' ? '校队' : '社团'}</td>
          <td><input class="input-cell" id="certHours_${m.id}" type="number" min="0.5" max="20" step="0.5" value="${offsetHours}" style="width:60px" />h</td>
          <td>
            <div class="button-row">
              <button class="ghost-button" data-cert-action="confirm" data-cert-id="${m.id}">确认生效</button>
              <button class="danger-button" data-cert-action="reject" data-cert-id="${m.id}">驳回</button>
            </div>
          </td>
        </tr>`;
    }
    return `
      <tr>
        <td>${escapeHtml(name)}<br /><small>${escapeHtml(sid)}</small></td>
        <td>${escapeHtml(org)}</td>
        <td>${offsetStatus === '可抵扣' ? (offsetHours) + 'h' : '-'}</td>
        <td><span class="status ${offsetStatus === '可抵扣' ? 'status-ok' : 'status-risk'}">${escapeHtml(offsetStatus)}</span></td>
      </tr>`;
  });

  return `
    ${teacherNotice()}
    <div class="two-col">
      <div>
        ${panel("待确认的抵扣记录", "PENDING CERTIFICATIONS", pendingMems.length === 0
          ? `<div class="empty">暂无待确认的校队/社团抵扣记录</div>`
          : `
            <div class="table-wrap">
              <table>
                <thead><tr><th>学生</th><th>组织</th><th>类型</th><th>建议小时</th><th>操作</th></tr></thead>
                <tbody>
                  ${renderRows(pendingMems, true).join('')}
                </tbody>
              </table>
            </div>
          `)}
      </div>
      <div>
        ${panel("已处理抵扣", "PROCESSED", processedMems.length === 0
          ? `<div class="empty">暂无已处理的记录</div>`
          : `
            <div class="table-wrap">
              <table>
                <thead><tr><th>学生</th><th>组织</th><th>抵扣</th><th>状态</th></tr></thead>
                <tbody>
                  ${renderRows(processedMems, false).join('')}
                </tbody>
              </table>
            </div>
          `)}
      </div>
    </div>
  `;
}

// ── Conversion row helpers ──────────────────────────────────────
async function saveSingleConversionRow(gradeGroup, gender, rawSeconds, convertedScore) {
  var mins = Math.floor(rawSeconds / 60);
  var secs = rawSeconds % 60;
  var rawValue = mins + "'" + (secs < 10 ? '0' : '') + secs + '"';
  var itemName = gender === 'male' ? '1000m' : '800m';
  var payload = {
    grade_group: gradeGroup, gender: gender, item_name: itemName,
    raw_value: rawValue, raw_seconds: rawSeconds, converted_score: convertedScore
  };
  return apiFetchJsonSafe('/api/admin/conversion-rules', { method: 'POST', body: JSON.stringify(payload) });
}

async function deleteConversionRow(id) {
  return apiFetchJsonSafe('/api/admin/conversion-rules/' + encodeURIComponent(id), { method: 'DELETE' });
}

async function batchImportConversion(gradeGroup, gender, text) {
  var lines = text.trim().split(/\r?\n/);
  var entries = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.indexOf('#') === 0) continue;
    var parts = line.split(/[,\t\s]+/);
    if (parts.length < 2) continue;
    var rawSeconds = parseInt(parts[0], 10);
    var convertedScore = parseFloat(parts[1]);
    if (isNaN(rawSeconds) || isNaN(convertedScore)) continue;
    entries.push({ raw_seconds: rawSeconds, converted_score: convertedScore });
  }
  if (entries.length === 0) return { ok: false, message: '未找到有效数据行。格式：秒数,分数（每行一个）' };
  return apiFetchJsonSafe('/api/admin/conversion-table/' + gradeGroup + '/' + gender, { method: 'PUT', body: JSON.stringify({ entries: entries }) });
}

// ── Feature #3: Enhanced conversion table detail ─────────────────
function renderConversionDetail() {
  var tab = state.conversionTab || 'freshman_sophomore-male';
  var parts = tab.split('-');
  var gradeGroup = parts[0]; // "freshman_sophomore" or "junior_senior"
  var gender = parts[1];    // "male" or "female"
  var genderLabel = gender === 'male' ? '男' : '女';
  var itemLabel = gender === 'male' ? '1000米' : '800米';
  var gradeLabel = gradeGroup === 'freshman_sophomore' ? '大一/大二' : '大三/大四';

  // Async fetch: load API data when available
  var conversionLoadKey = 'conversion-table:' + gradeGroup + ':' + gender;
  if (shouldStartApiLoad(conversionLoadKey)) {
    fetchConversionTable(gradeGroup, gender)
      .then(function(data) {
        finishApiLoad(conversionLoadKey, true);
        if (data) state.conversionTableData = data;
        renderRoute();
      })
      .catch(function() {
        finishApiLoad(conversionLoadKey, false);
        renderRoute();
      });
  }

  // Use API data when available
  var entries = [];
  var summaryText = '';
  if (state.conversionTableData && state.conversionTableData.gradeGroup === gradeGroup && state.conversionTableData.gender === gender) {
    entries = state.conversionTableData.entries || [];
    summaryText = '共 ' + (state.conversionTableData.count || entries.length) + ' 条分数点' + (state.conversionTableData.hasGaps ? ' (⚠️ 存在空档)' : '');
  } else {
    // Build hardcoded reference from localScoreLookup data for offline display
    var rulesKey = (gender === 'male' ? 'male' : 'female') + '-' + gradeGroup;
    var rulesRef = {
      'male-freshman_sophomore': [[100,197],[95,202],[90,207],[85,214],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,292],[40,312],[30,332],[20,352],[10,372]],
      'male-junior_senior': [[100,195],[95,200],[90,205],[85,212],[80,220],[78,225],[76,230],[74,235],[72,240],[70,245],[68,250],[66,255],[64,260],[62,265],[60,270],[50,290],[40,310],[30,330],[20,350],[10,370]],
      'female-freshman_sophomore': [[100,198],[95,204],[90,210],[85,217],[80,224],[78,229],[76,234],[74,239],[72,244],[70,249],[68,254],[66,259],[64,264],[62,269],[60,274],[50,284],[40,294],[30,304],[20,314],[10,324]],
      'female-junior_senior': [[100,196],[95,202],[90,208],[85,215],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,282],[40,292],[30,302],[20,312],[10,322]],
    };
    var rawTable = rulesRef[rulesKey] || [];
    for (var ri = 0; ri < rawTable.length; ri++) {
      var maxSeconds = rawTable[ri][1];
      var mins = Math.floor(maxSeconds / 60);
      var secs = maxSeconds % 60;
      var rawVal = mins + "'" + (secs < 10 ? '0' : '') + secs + '"';
      entries.push({ raw_seconds: maxSeconds, raw_value: rawVal, converted_score: rawTable[ri][0] });
    }
    summaryText = '共 ' + entries.length + ' 条分数点（本地参考数据）';
  }

  var tabs = [
    { key: 'freshman_sophomore-male', label: '大一/大二 · 男 · 1000m' },
    { key: 'freshman_sophomore-female', label: '大一/大二 · 女 · 800m' },
    { key: 'junior_senior-male', label: '大三/大四 · 男 · 1000m' },
    { key: 'junior_senior-female', label: '大三/大四 · 女 · 800m' },
  ];

  var rowsHtml = '';
  for (var ei = 0; ei < entries.length; ei++) {
    var e = entries[ei];
    var tier = e.converted_score >= 90 ? '优秀' : e.converted_score >= 80 ? '良好' : e.converted_score >= 60 ? '及格' : '不及格';
    rowsHtml += [
      '<tr>',
      '<td>' + escapeHtml(e.raw_value) + '</td>',
      '<td>' + e.raw_seconds + 's</td>',
      '<td><strong>' + e.converted_score + '</strong></td>',
      '<td>' + tier + '</td>',
      '<td><button class="ghost-button" style="font-size:11px;padding:2px 6px" data-action="delete-conversion-row" data-conv-id="' + escapeHtml(e.id || '') + '" data-conv-seconds="' + e.raw_seconds + '">删除</button></td>',
      '</tr>'
    ].join('');
  }

  return adminFrame(
    panel('体测换算表 — 按秒计分', 'P1-07 ENHANCED', [
      adminNotice(),
      '<div class="panel-body conversion-tabs">',
      '<div class="tab-bar" style="display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap">',
      tabs.map(function(t) {
        return '<button class="ghost-button ' + (tab === t.key ? 'primary-button' : '') + '" data-conversion-tab="' + t.key + '" style="font-size:12px;padding:4px 8px">' + t.label + '</button>';
      }).join(''),
      '</div></div>',
      '<div class="table-wrap" style="max-height:460px;overflow-y:auto">',
      '<table><thead><tr><th>成绩</th><th>秒数</th><th>分数</th><th>等级</th><th>操作</th></tr></thead>',
      '<tbody>' + rowsHtml + '</tbody></table></div>',
      '<div class="panel-body">',
      '<p style="color:var(--color-muted);font-size:12px;margin-bottom:12px">' + gradeLabel + ' · ' + genderLabel + ' · ' + itemLabel + ' — ' + summaryText + '</p>',
      '</div>'
    ].join('')),
    // Batch import panel
    panel('批量导入', 'BATCH IMPORT', [
      '<div class="panel-body">',
      '<p style="font-size:12px;color:var(--color-muted);margin-bottom:8px">每行一个分数点，格式：<code>秒数,分数</code>。示例：</p>',
      '<pre style="font-size:11px;background:var(--surface);padding:8px;border:1px solid var(--line);margin-bottom:10px">197,100\n198,99\n199,98</pre>',
      '<textarea id="batchImportText" rows="8" style="width:100%;font-family:monospace;font-size:12px;border:2px solid var(--line);padding:8px" placeholder="197,100&#10;198,99&#10;199,98&#10;..."></textarea>',
      '<button class="primary-button" type="button" data-action="batch-import-conversion" data-grade-group="' + gradeGroup + '" data-gender="' + gender + '" style="margin-top:8px">导入替换当前表</button>',
      '<span style="font-size:11px;color:var(--color-muted);margin-left:8px">⚠️ 导入将覆盖当前所有数据</span>',
      '</div>'
    ].join('')),
    // Single row add panel
    panel('添加单行', 'ADD ROW', [
      '<form class="panel-body form-grid" data-conv-add-form>',
      '<input type="hidden" name="gradeGroup" value="' + gradeGroup + '" />',
      '<input type="hidden" name="gender" value="' + gender + '" />',
      '<div class="field"><label>秒数 (raw_seconds)</label><input name="rawSeconds" type="number" placeholder="197" required /></div>',
      '<div class="field"><label>分数 (converted_score)</label><input name="convertedScore" type="number" step="0.1" placeholder="100" required /></div>',
      '<button class="primary-button" type="submit">添加</button>',
      '</form>'
    ].join(''))
  );
}

// ── Endurance run scoring tool ────────────────────────────────────
function renderScoringTool() {
  return `
    ${teacherNotice()}
    <div class="two-col">
      <div>
        ${panel("耐力跑成绩换算", "ENDURANCE SCORING", `
          <form class="panel-body form-grid" data-scoring-form>
            <div class="field">
              <label for="scoringGender">性别</label>
              <select id="scoringGender">
                <option value="male">男</option>
                <option value="female">女</option>
              </select>
            </div>
            <div class="field">
              <label for="scoringGrade">年级</label>
              <select id="scoringGrade">
                <option value="freshman">大一</option>
                <option value="sophomore">大二</option>
                <option value="junior">大三</option>
                <option value="senior">大四</option>
              </select>
            </div>
            <div class="field">
              <label for="scoringMinutes">分钟 (分′)</label>
              <input id="scoringMinutes" type="number" min="0" max="10" value="3" />
            </div>
            <div class="field">
              <label for="scoringSeconds">秒 (秒″)</label>
              <input id="scoringSeconds" type="number" min="0" max="59" value="30" />
            </div>
            <button type="submit" class="primary-button">开始换算</button>
          </form>
          <div id="scoringResult" class="panel-body" style="display:none"></div>
        `)}
      </div>
      <div>
        ${scoringRulesReference()}
      </div>
    </div>
  `;
}

function scoringRulesReference() {
  return panel("评分表参考", "SCORING TABLE", `
    <div class="panel-body" style="font-size:12px;max-height:500px;overflow-y:auto">
      <p style="margin-bottom:12px"><strong>评分等级：</strong></p>
      <table style="font-size:11px">
        <thead><tr><th>等级</th><th>分数</th><th>大一大二男</th><th>大一大二女</th><th>大三大四男</th><th>大三大四女</th></tr></thead>
        <tbody>
          <tr><td rowspan="3">优秀</td><td>100</td><td>3′17″</td><td>3′18″</td><td>3′15″</td><td>3′16″</td></tr>
          <tr><td>95</td><td>3′22″</td><td>3′24″</td><td>3′20″</td><td>3′22″</td></tr>
          <tr><td>90</td><td>3′27″</td><td>3′30″</td><td>3′25″</td><td>3′28″</td></tr>
          <tr><td rowspan="2">良好</td><td>85</td><td>3′34″</td><td>3′37″</td><td>3′32″</td><td>3′35″</td></tr>
          <tr><td>80</td><td>3′42″</td><td>3′44″</td><td>3′40″</td><td>3′42″</td></tr>
          <tr><td>及格线</td><td>60</td><td>4′32″</td><td>4′34″</td><td>4′30″</td><td>4′32″</td></tr>
          <tr><td rowspan="5">不及格</td><td>50</td><td>4′52″</td><td>4′44″</td><td>4′50″</td><td>4′42″</td></tr>
          <tr><td>40</td><td>5′12″</td><td>4′54″</td><td>5′10″</td><td>4′52″</td></tr>
          <tr><td>30</td><td>5′32″</td><td>5′04″</td><td>5′30″</td><td>5′02″</td></tr>
          <tr><td>20</td><td>5′52″</td><td>5′14″</td><td>5′50″</td><td>5′12″</td></tr>
          <tr><td>10</td><td>6′12″</td><td>5′24″</td><td>6′10″</td><td>5′22″</td></tr>
        </tbody>
      </table>
      <p style="margin-top:12px;color:var(--color-muted)">满分为 100 分。用时越短，分数越高。及格档共10个分值梯度（60-78分，每2分一档）。</p>
    </div>
  `);
}

// ── Exemption review (teacher/admin) ──────────────────────────────
function renderExemptionReview() {
  // Async fetch: load API data when available
  const exemptionsLoadKey = `course-exemptions:${state.courseId}`;
  if (shouldStartApiLoad(exemptionsLoadKey)) {
    fetchCourseExemptions(state.courseId)
      .then(data => {
        finishApiLoad(exemptionsLoadKey, true);
        if (data) {
          state.courseExemptionsData = Array.isArray(data) ? data : [];
          // Merge API data into state.exemptions for unified display
          if (Array.isArray(data)) {
            data.forEach(e => {
              const existing = (state.exemptions || []).find(x => x.id === e.id);
              if (!existing) {
                state.exemptions.push({
                  id: e.id, studentId: e.studentId, studentName: e.studentName || '',
                  type: e.type, reason: e.reason || '', status: e.status,
                  proofFiles: e.proofFiles || [], reviewComment: e.reviewComment || '',
                  createdAt: e.createdAt || '', courseId: e.courseId
                });
              } else {
                existing.status = e.status;
                existing.reviewComment = e.reviewComment || '';
              }
            });
          }
        }
        renderRoute();
      })
      .catch(() => {
        finishApiLoad(exemptionsLoadKey, false);
        renderRoute();
      });
  }

  const allExemptions = (state.exemptions || []);
  // Course-scoped filtering (Feature #4)
  const courseStudents = studentsForCourse().map(s => s.id);
  const scopedExemptions = allExemptions.filter(e => courseStudents.includes(e.studentId));
  const otherExemptions = allExemptions.filter(e => !courseStudents.includes(e.studentId));

  const pendingExemptions = scopedExemptions.filter((e) => e.status === '待审核');
  const processedExemptions = scopedExemptions.filter((e) => e.status !== '待审核');

  return `
    ${teacherNotice()}
    <div class="two-col">
      <div>
        ${panel("待审核免测申请", `PENDING EXEMPTIONS — ${currentCourse().code}`, pendingExemptions.length === 0
          ? `<div class="empty">当前课程暂无待审核的免测申请</div>`
          : `
            <div class="table-wrap">
              <table>
                <thead><tr><th>学号</th><th>姓名</th><th>项目</th><th>理由</th><th>凭证</th><th>操作</th></tr></thead>
                <tbody>
                  ${pendingExemptions.map((e) => `
                    <tr>
                      <td>${escapeHtml(e.studentId)}</td>
                      <td><strong>${escapeHtml(e.studentName || '')}</strong></td>
                      <td>${escapeHtml(e.type)}</td>
                      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(e.reason || '')}</td>
                      <td>${renderProofLink(e.proofFiles?.[0], e.proofFiles?.length) || '无凭证'}</td>
                      <td>
                        <button class="ghost-button" data-exemption-approve="${e.id}">通过</button>
                        <button class="danger-button" data-exemption-reject="${e.id}">驳回</button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `)}
      </div>
      <div>
        ${panel("已处理申请", "PROCESSED", processedExemptions.length === 0
          ? `<div class="empty">暂无已处理的申请</div>`
          : `
            <div class="table-wrap">
              <table>
                <thead><tr><th>学号</th><th>姓名</th><th>项目</th><th>结果</th><th>审核意见</th></tr></thead>
                <tbody>
                  ${processedExemptions.map((e) => `
                    <tr>
                      <td>${escapeHtml(e.studentId)}</td>
                      <td>${escapeHtml(e.studentName || '')}</td>
                      <td>${escapeHtml(e.type)}</td>
                      <td><span class="status ${e.status === '已通过' ? 'status-ok' : 'status-risk'}">${escapeHtml(e.status)}</span></td>
                      <td>${escapeHtml(e.reviewComment || '')}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `)}
        ${otherExemptions.length > 0 ? `
        <div style="margin-top:16px">
          ${panel("其他课程申请", "OTHER COURSES", `
            <div class="table-wrap">
              <table>
                <thead><tr><th>学号</th><th>姓名</th><th>项目</th><th>状态</th></tr></thead>
                <tbody>
                  ${otherExemptions.map((e) => `
                    <tr>
                      <td>${escapeHtml(e.studentId)}</td>
                      <td>${escapeHtml(e.studentName || '')}</td>
                      <td>${escapeHtml(e.type)}</td>
                      <td><span class="status ${statusClass(e.status)}">${escapeHtml(e.status)}</span></td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `)}
        </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Admin: batch student import ──────────────────────────────────
function renderStudentImport() {
  return adminFrame(
    panel("批量导入学生", "IMPORT STUDENTS", `
      ${adminNotice()}
      <div class="panel-body">
        <p style="margin-bottom:14px">通过粘贴 Excel/CSV 数据批量导入学生基本信息（学号、姓名、学院、性别、年级）。</p>
        <form data-student-import-form>
          <textarea id="importData" placeholder="每行一个学生，格式：学号,姓名,学院,性别(male/female),年级(freshman/sophomore/junior/senior)
示例：
22301142,陈雨晴,工商管理学院,female,sophomore
22301087,林子航,数据科学学院,male,freshman" style="width:100%;min-height:200px;font-family:monospace"></textarea>
          <div class="button-row" style="margin-top:12px">
            <button type="submit" class="primary-button">导入学生</button>
          </div>
        </form>
        <div id="importResult" style="margin-top:14px;display:none"></div>
      </div>
    `)
  );
}

function renderManagerPage(title, type) {
  const keyword = state.managerSearch.trim().toLowerCase();
  const rows = state.memberships.filter((membership) => {
    const matchesType = membership.type === type;
    const matchesKeyword =
      !keyword ||
      membership.organization.toLowerCase().includes(keyword) ||
      membership.studentName.toLowerCase().includes(keyword) ||
      membership.studentId.includes(keyword);
    const matchesStatus = state.managerStatusFilter === "all" || membership.status === state.managerStatusFilter;
    return matchesType && matchesKeyword && matchesStatus;
  });
  const options = organizationOptions(type);
  const importPreviewRows = state.managerImportPreview.filter((row) => row.type === type);
  const validImportRows = importPreviewRows.filter((row) => row.valid).length;
  const invalidImportRows = importPreviewRows.length - validImportRows;
  return panel(title, "ORGANIZATION VERIFY", `
    ${managerNotice()}
    <div class="two-col">
      <div>
        <div class="panel-body review-toolbar">
          <div class="form-grid">
            <div class="field"><label for="managerSearch">搜索成员</label><input id="managerSearch" data-manager-search placeholder="组织 / 姓名 / 学号" value="${escapeHtml(state.managerSearch)}" /></div>
            <div class="field">
              <label for="managerStatusFilter">认证状态</label>
              <select id="managerStatusFilter" data-manager-status-filter>
                <option value="all" ${selectedAttr(state.managerStatusFilter, "all")}>全部</option>
                <option value="待确认" ${selectedAttr(state.managerStatusFilter, "待确认")}>待确认</option>
                <option value="认证有效" ${selectedAttr(state.managerStatusFilter, "认证有效")}>认证有效</option>
                <option value="不通过" ${selectedAttr(state.managerStatusFilter, "不通过")}>不通过</option>
                <option value="非体育类" ${selectedAttr(state.managerStatusFilter, "非体育类")}>非体育类</option>
              </select>
            </div>
          </div>
        </div>
        <div class="table-wrap"><table><thead><tr><th>组织</th><th>学生</th><th>身份状态</th><th>抵扣状态</th><th>有效期</th><th>操作</th></tr></thead><tbody>
          ${rows
            .map((row) => {
              const offsetState = membershipOffsetState(row);
              return `
                <tr>
                  <td>${escapeHtml(row.organization)}</td>
                  <td><strong>${escapeHtml(row.studentName)}</strong><br /><small>${escapeHtml(row.studentId)}</small></td>
                  <td><span class="status ${statusClass(row.status)}">${escapeHtml(row.status)}</span></td>
                  <td><span class="status ${statusClass(offsetState)}">${escapeHtml(offsetState)}</span></td>
                  <td>${escapeHtml(row.validUntil)}</td>
                  <td>
                    <div class="button-row">
                      <button class="ghost-button" data-manager-action="approve-member" data-member-id="${row.id}">确认身份</button>
                      <button class="danger-button" data-manager-action="reject-member" data-member-id="${row.id}">不通过</button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join("")}
        </tbody></table></div>
        ${rows.length ? "" : `<div class="empty">没有匹配的成员认证记录。</div>`}
      </div>
      <div>
        <div class="panel-body form-grid manager-form">
          <div class="field" style="grid-column:1/-1">
            <label for="${type}MemberCsv">批量导入成员名单</label>
            <input id="${type}MemberCsv" type="file" accept=".csv,text/csv" data-manager-import-file="${type}" />
          </div>
          <div class="notice" style="grid-column:1/-1">CSV 首行建议使用：组织、学生姓名、学号、有效期、认证状态、备注。导入只会写入通过校验的行。</div>
          <div class="button-row" style="grid-column:1/-1">
            <button class="ghost-button" data-action="download-member-template" data-import-type="${type}">下载模板</button>
            <button class="primary-button" data-action="confirm-manager-import" data-import-type="${type}">确认导入有效成员</button>
          </div>
        </div>
        ${
          importPreviewRows.length
            ? `
              <div class="notice">本次预检：${validImportRows} 行可导入，${invalidImportRows} 行需处理。</div>
              <div class="table-wrap compact-table">
                <table><thead><tr><th>组织</th><th>学生</th><th>状态</th><th>校验</th></tr></thead><tbody>
                  ${importPreviewRows
                    .map(
                      (row) => `
                        <tr>
                          <td>${escapeHtml(row.organization)}</td>
                          <td><strong>${escapeHtml(row.studentName)}</strong><br /><small>${escapeHtml(row.studentId)}</small></td>
                          <td>${escapeHtml(row.status)}</td>
                          <td><span class="status ${row.valid ? "ok" : "bad"}">${escapeHtml(row.checkStatus)}</span></td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody></table>
              </div>
            `
            : ""
        }
        <form class="panel-body form-grid manager-form" data-manager-form="${type}">
          <div class="field">
            <label for="${type}Organization">组织</label>
            <select id="${type}Organization" name="organization">
              ${options.map((name) => `<option>${escapeHtml(name)}</option>`).join("")}
            </select>
          </div>
          <div class="field"><label for="${type}StudentName">学生姓名</label><input id="${type}StudentName" name="studentName" value="${type === "team" ? "梁思远" : "赵书言"}" /></div>
          <div class="field"><label for="${type}StudentId">学号</label><input id="${type}StudentId" name="studentId" value="${type === "team" ? "22301776" : "22301999"}" /></div>
          <div class="field"><label for="${type}ValidUntil">有效期</label><input id="${type}ValidUntil" name="validUntil" value="2026-09-01" /></div>
          <div class="field" style="grid-column:1/-1"><label for="${type}Comment">备注</label><textarea id="${type}Comment" name="comment">负责人新增成员认证，等待确认。</textarea></div>
          <button class="primary-button" type="submit">新增成员认证</button>
        </form>
      </div>
    </div>
  `);
}

function renderRouteUnsafe() {
  if (!state.loggedIn) {
    renderLogin();
    saveState();
    return;
  }

  if (!routeAllowedForRole(state.route, state.role)) {
    state.route = defaultRouteForRole(state.role);
  }

  let content = "";
  if (state.route === "teacher-dashboard") {
    state.dashboardCache = state.dashboardCache || {};
    ensureCourseRosterLoaded(state.courseId);
    loadRouteDataOnce(
      `teacher-dashboard:${state.courseId}`,
      () => Boolean(state.dashboardCache && state.dashboardCache[state.courseId]),
      () => fetchCourseDashboard(state.courseId)
    );
    content = renderDashboard();
  }
  else if (state.route === "teacher-courses") content = renderCourses();
  else if (state.route === "teacher-tasks") content = renderTasks();
  else if (state.route === "teacher-import") content = renderImport();
  else if (state.route === "teacher-students") {
    ensureCourseRosterLoaded(state.courseId);
    content = renderStudents();
  }
  else if (state.route === "teacher-progress") {
    ensureCourseRosterLoaded(state.courseId);
    loadRouteDataOnce(
      `teacher-grades:${state.courseId}`,
      () => Boolean(state.gradeData),
      () => fetchCourseGrades(state.courseId)
    );
    content = panel("打卡进度", "P0-07", renderProgressRows());
  }
  else if (state.route === "teacher-review") {
    loadRouteDataOnce(
      `teacher-reviews:${state.courseId}`,
      () => Boolean(state.reviews && state.reviews.length),
      () => fetchCourseReviews(state.courseId)
    );
    content = renderReviewPage();
  }
  else if (state.route === "teacher-exam") {
    ensureCourseRosterLoaded(state.courseId);
    content = renderExam();
  }
  else if (state.route === "teacher-attendance") {
    ensureCourseRosterLoaded(state.courseId);
    content = renderAttendance();
  }
  else if (state.route === "teacher-physical") {
    ensureCourseRosterLoaded(state.courseId);
    content = renderPhysical();
  }
  else if (state.route === "teacher-grades") {
    ensureCourseRosterLoaded(state.courseId);
    loadRouteDataOnce(
      `teacher-grades:${state.courseId}`,
      () => Boolean(state.gradeData),
      () => fetchCourseGrades(state.courseId)
    );
    content = renderGrades();
  }
  else if (state.route === "teacher-export") {
    ensureCourseRosterLoaded(state.courseId);
    content = renderExport();
  }
  else if (state.route === "admin-dashboard") {
    loadRouteDataOnce(
      "admin-overview",
      () => Boolean(state.adminOverview),
      () => fetchAdminOverview()
    );
    content = renderAdminDashboard();
  }
  else if (state.route === "admin-overview") {
    loadRouteDataOnce(
      "admin-overview",
      () => Boolean(state.adminOverview),
      () => fetchAdminOverview()
    );
    content = renderAdminOverview();
  }
  else if (state.route === "admin-semesters") content = renderAdminSemesters();
  else if (state.route === "admin-courses") content = renderAdminCourses();
  else if (state.route === "admin-users") content = renderAdminUsers();
  else if (state.route === "admin-sport-rules") content = renderSportRules();
  else if (state.route === "admin-grade-rules") content = renderGradeRulesAdmin();
  else if (state.route === "admin-conversion") content = renderConversionRules();
  else if (state.route === "admin-export-template") content = renderExportTemplateAdmin();
  else if (state.route === "admin-teams") content = renderAdminOrganizations("校队管理", "P2-01", "teams");
  else if (state.route === "admin-clubs") content = renderAdminOrganizations("社团管理", "P2-02", "clubs");
  else if (state.route === "admin-organization-audit") content = renderAdminOrganizationAudit();
  else if (state.route === "admin-delivery-audit") content = renderAdminDeliveryAudit();
  else if (state.route === "admin-api-handoff") content = renderAdminApiHandoff();
  else if (state.route === "admin-logs") {
    loadRouteDataOnce(
      "admin-logs",
      () => Boolean(state.logs && state.logs.length),
      () => fetchAdminLogs()
    );
    content = renderAdminLogs();
  }
  else if (state.route === "manager-team") content = renderManagerPage("校队成员认证", "team");
  else if (state.route === "manager-club") content = renderManagerPage("社团成员认证", "club");
  else if (state.route === "teacher-student-detail") content = renderStudentDetail();
  else if (state.route === "teacher-pending-certifications") content = renderPendingCertifications();
  else if (state.route === "teacher-scoring") content = renderScoringTool();
  else if (state.route === "teacher-exemptions") content = renderExemptionReview();
  else if (state.route === "admin-student-detail") content = renderStudentDetail();
  else if (state.route === "admin-pending-certifications") content = renderPendingCertifications();
  else if (state.route === "admin-scoring") content = renderScoringTool();
  else if (state.route === "admin-exemptions") content = renderExemptionReview();
  else if (state.route === "admin-import-students") content = renderStudentImport();
  else if (state.route === "admin-conversion-detail") content = renderConversionDetail();
  else content = `<div class="empty">页面建设中</div>`;

  renderLayout(content);
  saveState();
}

function renderRuntimeError(error) {
  const message = error?.message || "未知错误";
  app.innerHTML = `
    <div class="runtime-error-screen">
      <div class="runtime-error-card">
        <p class="eyebrow">RUNTIME GUARD</p>
        <h1>页面遇到错误</h1>
        <p>当前页面数据异常，系统已阻止整页白屏。可以重置演示状态后继续预览。</p>
        <pre>${escapeHtml(message)}</pre>
        <div class="button-row">
          <button class="primary-button" data-action="reset-demo">重置演示</button>
          <button class="ghost-button" data-action="logout">返回登录</button>
        </div>
      </div>
    </div>
  `;
}

function renderRoute() {
  try {
    renderRouteUnsafe();
  } catch (error) {
    if (!window.__BNBU_SUPPRESS_RENDER_ERRORS) console.error(error);
    renderRuntimeError(error);
  }
}

function setRole(role) {
  if (role === "teacher" && !window.__BNBU_STAY_IN_WEB_APP) {
    redirectToTeacherApp(true);
    return;
  }
  apiLoadState.clear();
  state.role = role;
  state.loggedIn = true;
  state.route = defaultRouteForRole(role);
  state.loginError = null;
  state.loginLoading = false;
  state.token = null;
  state.authUser = null;
  renderRoute();
}

async function handleLogin(account, password) {
  state.loginError = null;
  state.loginLoading = true;
  renderRoute();

  try {
    const base = state.apiBaseUrl || window.location.origin;
    const url = `${base}/api/auth/login`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account, password }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      state.loginError = data.message || "登录失败，请检查网络连接";
      state.loginLoading = false;
      renderRoute();
      return;
    }

    state.token = data.token;
    state.authUser = data.user;
    state.role = data.user.role;
    state.loggedIn = true;
    state.loginError = null;
    state.loginLoading = false;
    state.route = data.defaultRoute || defaultRouteForRole(data.user.role);
    apiLoadState.clear();
    if (state.role === "teacher") {
      saveTeacherAuthSession();
      loadAdminConfig();
      fetchTeacherCourses();
      fetchNotifications();
      redirectToTeacherApp();
      return;
    }
    loadAdminConfig(); // fire-and-forget: populate admin config from backend
    fetchTeacherCourses(); // fire-and-forget: load teacher courses
    fetchNotifications(); // fire-and-forget: load notification list
    renderRoute();
  } catch (e) {
    state.loginError = "无法连接服务器，请检查网络。演示模式仍可用。";
    state.loginLoading = false;
    renderRoute();
  }
}

function downloadTextFile(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([`\ufeff${text}`], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvFromRows(rows) {
  const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function downloadImportTemplate() {
  const rows = [
    ["姓名", "学号", "学院", "班级", "课程代码", "Section", "选课状态"],
    ["张同学", "22300001", "工商管理学院", "2026A", currentCourse().code, sectionDisplay(), "已选"],
    ["李同学", "22300002", "数据科学学院", "2026B", currentCourse().code, sectionDisplay(), "已选"],
  ];
  downloadTextFile(`${currentCourse().code}-Section-${courseSection()}-roster-template.csv`, csvFromRows(rows));
  setTeacherNotice(`${courseOfferingLabel()} 名单导入模板已下载。`);
}

async function handleRosterFile(file) {
  if (!file) return;
  try {
    const csvText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取失败"));
      reader.readAsText(file, "utf-8");
    });
    // Try backend preview first
    const result = await apiFetchJsonSafe(`/api/teacher/courses/${state.courseId}/students/import/preview`, {
      method: 'POST',
      body: JSON.stringify({ csv: csvText }),
    });
    if (result && Array.isArray(result.rows)) {
      state.importPreview = result.rows.map((row) => ({
        ...row,
        valid: row.valid !== false,
        status: row.status || (row.valid !== false ? "通过" : "未通过"),
      }));
      setTeacherNotice(`${file.name} 预检完成（后端校验）：${result.validCount} 行可导入，${result.invalidCount} 行需处理。`);
    } else {
      // Fallback: local parsing
      const rows = importRowsFromCsv(csvText);
      state.importPreview = buildImportPreview(rows);
      const validCount = state.importPreview.filter((row) => row.valid).length;
      setTeacherNotice(`${file.name} 读取完成（本地校验）：${validCount} 行可导入，${rows.length - validCount} 行需处理。`);
    }
  } catch (_e) {
    setTeacherNotice(`${file.name} 读取失败，请确认文件为 UTF-8 CSV。`);
  }
  state.imported = true;
  logAction("体育任课老师", "预检课程名单", `${courseOfferingLabel()} / ${file.name}`);
  renderRoute();
}

function importMembershipRowsFromCsv(text, type) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const indexFor = (...names) => headers.findIndex((header) => names.map(normalizeHeader).includes(header));
  const organizationIndex = indexFor("组织", "组织名称", "organization");
  const nameIndex = indexFor("学生姓名", "姓名", "studentName", "name");
  const idIndex = indexFor("学号", "studentId", "id");
  const validUntilIndex = indexFor("有效期", "validUntil");
  const statusIndex = indexFor("认证状态", "状态", "status");
  const commentIndex = indexFor("备注", "comment");
  const defaultOrganization = organizationOptions(type)[0] || "未配置组织";

  return rows.slice(1).map((row) => ({
    type,
    organization: row[organizationIndex] || defaultOrganization,
    studentName: row[nameIndex] || "",
    studentId: row[idIndex] || "",
    validUntil: row[validUntilIndex] || "2026-09-01",
    status: row[statusIndex] || "待确认",
    comment: row[commentIndex] || "负责人 CSV 导入成员认证",
  }));
}

function buildMembershipImportPreview(rows = [], type = "team") {
  const organizations = new Set(organizationOptions(type));
  const existing = new Set(state.memberships.filter((membership) => membership.type === type).map((membership) => `${membership.organization}-${membership.studentId}`));
  const seen = new Set();
  const allowedStatus = new Set(["待确认", "认证有效", "不通过", "非体育类"]);

  return rows.map((row) => {
    let status = "通过";
    let valid = true;
    const key = `${row.organization}-${row.studentId}`;
    if (!row.organization || !organizations.has(row.organization)) {
      status = "组织不存在";
      valid = false;
    } else if (!row.studentName) {
      status = "缺少学生姓名";
      valid = false;
    } else if (!row.studentId) {
      status = "缺少学号";
      valid = false;
    } else if (!allowedStatus.has(row.status || "待确认")) {
      status = "状态不支持";
      valid = false;
    } else if (existing.has(key)) {
      status = "成员已存在";
      valid = false;
    } else if (seen.has(key)) {
      status = "导入文件内重复";
      valid = false;
    }
    if (row.studentId) seen.add(key);
    return { ...row, type, valid, checkStatus: status };
  });
}

async function handleManagerImportFile(file, type) {
  if (!file) return;
  try {
    const csvText = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("读取失败"));
      reader.readAsText(file, "utf-8");
    });
    const rows = importMembershipRowsFromCsv(csvText, type);
    // Try backend preview first
    const result = await apiFetchJsonSafe('/api/manager/memberships/import/preview', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    });
    if (result && Array.isArray(result.rows)) {
      state.managerImportPreview = state.managerImportPreview.filter((row) => row.type !== type).concat(
        result.rows.map((row) => ({
          ...row,
          valid: row.ok !== false,
          checkStatus: row.ok !== false ? "通过" : (row.issues || []).join("; "),
        }))
      );
      setManagerNotice(`${file.name} 预检完成（后端校验）：${result.okCount} 行可导入，${result.errorCount} 行需处理。`);
    } else {
      // Fallback: local validation
      const nextPreview = buildMembershipImportPreview(rows, type);
      state.managerImportPreview = state.managerImportPreview.filter((row) => row.type !== type).concat(nextPreview);
      const validCount = nextPreview.filter((row) => row.valid).length;
      setManagerNotice(`${file.name} 读取完成（本地校验）：${validCount} 行可导入，${nextPreview.length - validCount} 行需处理。`);
    }
  } catch (_e) {
    setManagerNotice(`${file.name} 读取失败，请确认文件为 UTF-8 CSV。`);
  }
  logAction("组织负责人", "预检成员名单", `${type === "team" ? "校队" : "社团"} / ${file.name}`);
  renderRoute();
}

async function confirmManagerImportPreview(type) {
  const previewRows = state.managerImportPreview.filter((row) => row.type === type);
  if (!previewRows.length) {
    setManagerNotice("请先选择 CSV 成员名单并完成预检。");
    return;
  }
  const imported = previewRows.filter((row) => row.valid);
  const rejected = previewRows.filter((row) => !row.valid);
  const label = type === "team" ? "校队" : "社团";

  // Try backend confirm first
  const result = await apiFetchJsonSafe('/api/manager/memberships/import/confirm', {
    method: 'POST',
    body: JSON.stringify({ rows: imported }),
  });
  if (result) {
    setManagerNotice(`${label}成员后端导入完成：${result.inserted} 行入库。`);
  } else {
    // Fallback: local import
    imported.forEach((row) => {
      const membership = {
        id: `m${Date.now()}${Math.round(Math.random() * 1000)}`,
        type,
        organization: row.organization,
        studentId: row.studentId,
        studentName: row.studentName,
        status: row.status || "待确认",
        validUntil: row.validUntil || "2026-09-01",
        offset: "待确认",
        comment: row.comment || "负责人 CSV 导入成员认证",
        updatedBy: "组织负责人",
        updatedAt: formatDateTime(),
      };
      membership.offset = membership.status === "认证有效" ? (organizationCanOffset(membership) ? "可抵扣" : "不抵扣") : "待确认";
      state.memberships.unshift(membership);
    });
    setManagerNotice(`${label}成员已本地导入 ${imported.length} 行，${rejected.length} 行未通过校验。`);
  }
  state.managerImportPreview = state.managerImportPreview.filter((row) => row.type !== type).concat(buildMembershipImportPreview(rejected, type));
  logAction("组织负责人", "确认导入成员名单", `${label} / ${imported.length} 名`);
}

function downloadMembershipTemplate(type) {
  const label = type === "team" ? "team" : "club";
  const rows = [
    ["组织", "学生姓名", "学号", "有效期", "认证状态", "备注"],
    [organizationOptions(type)[0] || "组织名称", "张同学", "22300001", "2026-09-01", "待确认", "负责人导入成员认证"],
  ];
  downloadTextFile(`BNBU-${label}-members-template.csv`, csvFromRows(rows));
  setManagerNotice(`${type === "team" ? "校队" : "社团"}成员导入模板已下载。`);
}

function downloadIssueList() {
  const issues = exportIssues();
  const rows = [["检查项", "学生/对象", "建议"]];
  issues.missingPhysical.forEach((student) => rows.push(["缺少/低体测", `${student.name} ${student.id}`, "补录体测原始数据"]));
  issues.checkinNotEnough.forEach((student) => rows.push(["打卡未满", `${student.name} ${student.id}`, "提醒学生补齐 A/B 类学时"]));
  issues.unresolvedReviews.forEach((review) => rows.push(["异常未处理", `${review.name} ${review.studentId}`, "进入异常审核页处理"]));
  if (!issues.templateMatched) rows.push(["模板字段", state.admin.exportTemplate.name, "管理员需修正导出模板字段"]);
  if (rows.length === 1) rows.push(["无", courseOfferingLabel(), "所有检查通过"]);
  downloadTextFile(`${currentCourse().code}-Section-${courseSection()}-export-issues.csv`, csvFromRows(rows));
  setTeacherNotice(`${courseOfferingLabel()} 导出问题清单已下载。`);
}

function downloadSchoolIssueList() {
  const rows = [["课程", "检查项", "对象", "建议"]];
  courseHealthRows().forEach(({ course, issues, delivery }) => {
    issues.missingPhysical.forEach((student) => rows.push([courseOfferingLabel(course), "缺少/低体测", `${student.name} ${student.id}`, "补录体测原始数据"]));
    issues.checkinNotEnough.forEach((student) => rows.push([courseOfferingLabel(course), "打卡未满", `${student.name} ${student.id}`, "提醒学生补齐 A/B 类学时"]));
    issues.unresolvedReviews.forEach((review) => rows.push([courseOfferingLabel(course), "异常未处理", `${review.name} ${review.studentId}`, "进入异常审核页处理"]));
    if (!issues.templateMatched) rows.push([courseOfferingLabel(course), "模板字段", state.admin.exportTemplate.name, "管理员需修正导出模板字段"]);
    if (delivery.status === "退回清理") rows.push([courseOfferingLabel(course), "归档退回", delivery.comment, "老师重新提交预检"]);
  });
  if (rows.length === 1) rows.push(["全校", "无", "所有课程", "所有检查通过"]);
  downloadTextFile(`BNBU-school-export-issues.csv`, csvFromRows(rows));
  setAdminNotice("全校问题清单已下载。");
}

async function downloadCsv() {
  const issues = exportIssues();
  if (exportBlocked(issues)) {
    setTeacherNotice("导出被阻止：请先处理体测、打卡、异常审核或模板字段问题。");
    renderRoute();
    return;
  }
  // Try backend export first
  try {
    const base = getApiBase();
    const resp = await fetch(`${base}/api/teacher/courses/${state.courseId}/export`, {
      headers: apiAuthHeaders(),
    });
    if (resp.ok && resp.headers.get('content-type')?.includes('text/csv')) {
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.courseId}-grades.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setTeacherNotice(`${courseOfferingLabel()} 成绩 CSV 已从服务器下载。`);
      return;
    }
  } catch (_e) { /* fall through to local generation */ }
  // Fallback: local CSV generation
  const headers = state.admin.exportTemplate.fields.length ? state.admin.exportTemplate.fields : ["学号", "姓名", "课程代码", "Section", "体育打卡", "专项考试", "平时表现", "体测", "总分"];
  const valueForField = (field, student) => {
    const breakdown = gradeBreakdown(student);
    const sources = gradeSourceSummary(student);
    const map = {
      学号: student.id,
      姓名: student.name,
      学院: student.college,
      课程代码: currentCourse().code,
      Section: sectionDisplay(),
      课程名称: currentCourse().name,
      体育打卡: breakdown.checkinScore,
      专项考试: student.exam,
      平时表现: student.attendance,
      体测: student.physical,
      总分: breakdown.total,
      来源: `名单:${sources.roster}; 打卡:${sources.checkin}; 专项:${sources.exam}; 平时:${sources.attendance}; 体测:${sources.physical}`,
      备注: student.status,
    };
    return map[field] ?? "";
  };
  const rows = studentsForCourse().map((student) => headers.map((field) => valueForField(field, student)));
  downloadTextFile(`${currentCourse().code}-Section-${courseSection()}-grades.csv`, csvFromRows([headers, ...rows]));
  setTeacherNotice(`${courseOfferingLabel()} 成绩 CSV 已下载。`);
  renderRoute();
}

function adminId(prefix) {
  return `${prefix}${Date.now()}${Math.round(Math.random() * 1000)}`;
}

function saveGradeRulesFromForm(form) {
  const data = new FormData(form);
  state.admin.gradeRules.forEach((rule) => {
    rule.weight = Number(data.get(rule.key)) || 0;
    rule.status = "草稿";
  });
  return state.admin.gradeRules.reduce((sum, rule) => sum + Number(rule.weight || 0), 0);
}

async function handleAdminForm(form) {
  const data = new FormData(form);
  const type = form.dataset.adminForm;

  if (type === "semester") {
    const payload = {
      name: data.get("name") || "未命名学期",
      dateRange: data.get("dateRange") || "待设置",
      status: data.get("status") || "草稿",
      locked: data.get("locked") || "否",
    };
    const saved = await apiFetchJsonSafe('/api/admin/semesters', { method: 'POST', body: JSON.stringify(payload) });
    if (saved) {
      state.admin.semesters.unshift({ id: saved.id, name: saved.name, dateRange: saved.date_range || payload.dateRange, status: saved.status, locked: saved.locked || payload.locked });
    } else {
      state.admin.semesters.unshift({ id: adminId("s"), ...payload });
    }
    setAdminNotice(saved ? "学期已保存到服务器。" : "学期已本地保存。");
  }

  if (type === "course") {
    const payload = {
      code: data.get("code") || "NEW",
      section: normalizeSection(data.get("section") || "1004"),
      name: data.get("name") || "未命名课程",
      teacher: data.get("teacher") || "待分配",
      semester: data.get("semester") || "待设置",
      students: Number(data.get("students")) || 0,
      status: data.get("status") || "草稿",
    };
    const saved = await apiFetchJsonSafe('/api/admin/courses', { method: 'POST', body: JSON.stringify(payload) });
    if (saved) {
      state.admin.courses.unshift({ id: saved.id, code: saved.code, section: saved.section, name: saved.name, teacher: saved.teacher || payload.teacher, semester_id: saved.semester_id, semester: payload.semester, students: saved.students, status: saved.status });
    } else {
      state.admin.courses.unshift({ id: adminId("ac"), ...payload });
    }
    setAdminNotice(saved ? "课程已保存到服务器。" : "课程已本地保存。");
  }

  if (type === "user") {
    const payload = {
      name: data.get("name") || "未命名用户",
      email: data.get("email") || "unset@bnbu.edu.cn",
      role: data.get("role") || "体育任课老师",
      scope: data.get("scope") || "待设置",
      status: "待确认",
    };
    const saved = await apiFetchJsonSafe('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    if (saved) {
      state.admin.users.unshift({ id: saved.id, name: saved.name, email: saved.email, role: saved.role, scope: saved.scope || payload.scope, status: saved.status });
    } else {
      state.admin.users.unshift({ id: adminId("u"), ...payload });
    }
    setAdminNotice(saved ? "用户已保存到服务器。" : "用户已本地保存。");
  }

  if (type === "sport-rules") {
    const total = Number(data.get("total")) || 0;
    const courseRequired = Number(data.get("courseRequired")) || 0;
    const generalRequired = Number(data.get("generalRequired")) || 0;
    const payload = {
      version: data.get("version") || "未命名版本",
      total,
      courseRequired,
      generalRequired,
      dailyLimit: Number(data.get("dailyLimit")) || 0,
      stackAllowed: data.get("stackAllowed") || "不允许",
      organizationOffset: data.get("organizationOffset") || "待设置",
      status: courseRequired + generalRequired === total ? data.get("status") || "正常" : "需复核",
    };
    const saved = await apiFetchJsonSafe('/api/admin/sport-rules', { method: 'PUT', body: JSON.stringify(payload) });
    if (saved) { state.admin.sportRules = saved; }
    else { state.admin.sportRules = payload; }
    setAdminNotice(courseRequired + generalRequired === total ? "体育学时规则已保存。" : "体育学时规则已保存，但 A/B 类合计与总学时不一致。");
  }

  if (type === "grade-rules") {
    const total = saveGradeRulesFromForm(form);
    const saved = await apiFetchJsonSafe('/api/admin/grade-rules', { method: 'PUT', body: JSON.stringify(state.admin.gradeRules) });
    if (saved) { state.admin.gradeRules = saved; }
    setAdminNotice(total === 100 ? "成绩权重草稿已保存，合计为 100%。" : `成绩权重草稿已保存，但当前合计为 ${total}%。`);
  }

  if (type === "conversion") {
    // Conversion rules form uses a simplified data model (item/metric/method/status)
    // that differs from the backend conversion_rules_admin table schema.
    // Keep localStorage for now — needs a proper admin page redesign for per-second data.
    state.admin.conversionRules.unshift({
      id: adminId("cv"),
      item: data.get("item") || "未命名项目",
      metric: data.get("metric") || "待设置",
      method: data.get("method") || "待设置",
      version: data.get("version") || "CN-2026-v1",
      status: "草稿",
    });
    setAdminNotice("体测换算项已保存为草稿（本地）。");
  }

  if (type === "export-template") {
    const fields = String(data.get("fields") || "")
      .split(/\n|,/)
      .map((field) => field.trim())
      .filter(Boolean);
    const payload = {
      name: data.get("name") || "未命名模板",
      format: data.get("format") || "CSV",
      fields: fields.length ? fields : ["学号", "姓名", "总分"],
      status: fields.includes("学号") && fields.includes("姓名") && fields.includes("总分") ? "已匹配" : "需复核",
    };
    const saved = await apiFetchJsonSafe('/api/admin/export-template', { method: 'PUT', body: JSON.stringify(payload) });
    if (saved) { state.admin.exportTemplate = saved; }
    else { state.admin.exportTemplate = payload; }
    setAdminNotice("导出模板已保存，并完成字段预检。");
  }

  if (type === "organization") {
    const collection = form.dataset.collection; // "teams" or "clubs"
    const orgType = collection === "teams" ? "team" : "club";
    const payload = {
      name: data.get("name") || "未命名组织",
      type: orgType,
      description: (data.get("type") || "") + " / " + (data.get("offset") || ""),
    };
    const saved = await apiFetchJsonSafe('/api/admin/organizations', { method: 'POST', body: JSON.stringify(payload) });
    if (saved) {
      const item = { id: saved.id, name: saved.name, type: saved.type === 'team' ? '校队' : '社团', members: 0, offset: data.get("offset") || "不抵扣", owner: data.get("owner") || "待设置", status: "草稿" };
      if (Array.isArray(state.admin[collection])) { state.admin[collection].unshift(item); }
    } else {
      if (Array.isArray(state.admin[collection])) {
        state.admin[collection].unshift({
          id: adminId(collection === "teams" ? "tm" : "cl"),
          name: data.get("name") || "未命名组织",
          type: data.get("type") || "待设置",
          members: Number(data.get("members")) || 0,
          offset: data.get("offset") || "不抵扣",
          owner: data.get("owner") || "待设置",
          status: "草稿",
        });
      }
    }
    setAdminNotice(saved ? "组织已保存到服务器。" : "组织已本地保存。");
  }

  renderRoute();
}

function handleManagerForm(form) {
  const data = new FormData(form);
  const type = form.dataset.managerForm;
  const organization = data.get("organization") || organizationOptions(type)[0] || "未配置组织";
  const membership = {
    id: `m${Date.now()}${Math.round(Math.random() * 1000)}`,
    type,
    organization,
    studentId: data.get("studentId") || "未填写",
    studentName: data.get("studentName") || "未填写",
    status: "待确认",
    validUntil: data.get("validUntil") || "待设置",
    offset: "待确认",
    comment: data.get("comment") || "负责人新增成员认证",
    updatedBy: "组织负责人",
    updatedAt: formatDateTime(),
  };
  state.memberships.unshift(membership);
  logAction("组织负责人", "新增成员认证", `${membership.studentName} / ${membership.organization}`);
  setManagerNotice(`${membership.studentName} 已加入 ${membership.organization} 认证列表，确认身份后才会影响老师端抵扣。`);
  renderRoute();
}

async function handleScoreForm(form) {
  const data = new FormData(form);
  const type = form.dataset.scoreForm;
  const students = studentsForCourse();
  const rows = [];

  students.forEach((student, index) => {
    const record = scoreRecordForStudent(student, index);

    if (type === "exam") {
      record.examItems = [0, 1, 2]
        .map((itemIndex) => data.get(`exam_${student.id}_${itemIndex}`))
        .filter((v) => v !== null && v !== "")
        .map((v) => clampScore(v));
      record.exam = average(record.examItems);
      record.examStatus = record.examItems.length ? "已录入" : "未录入";
      rows.push({ studentId: student.id, examItems: record.examItems });
    }

    if (type === "attendance") {
      record.attendanceWeeks = {
        week6: data.get(`att_${student.id}_week6`) || "出勤",
        week7: data.get(`att_${student.id}_week7`) || "出勤",
      };
      record.attendance = clampScore(data.get(`att_${student.id}_score`));
      record.attendanceStatus = "已录入";
      rows.push({ studentId: student.id, score: record.attendance });
    }

    if (type === "physical") {
      record.physicalItems = {
        endurance: data.get(`phys_${student.id}_endurance`) || "",
        sprint: data.get(`phys_${student.id}_sprint`) || "",
        jump: data.get(`phys_${student.id}_jump`) || "",
      };
      record.physical = clampScore(data.get(`phys_${student.id}_score`));
      record.physicalStatus = "已录入";
      rows.push({ studentId: student.id, score: record.physical });
    }
  });

  const label = type === "exam" ? "专项考试" : type === "attendance" ? "签到 / 平时分" : "体测";
  const result = await apiFetchJsonSafe(`/api/teacher/courses/${state.courseId}/scores/${type}`, {
    method: 'PUT',
    body: JSON.stringify({ rows }),
  });
  if (result) {
    setTeacherNotice(`${courseOfferingLabel()} ${label}已保存到服务器（${result.savedCount} 条）。`);
  } else {
    setTeacherNotice(`${courseOfferingLabel()} ${label}已本地保存，成绩汇总和导出数据已同步更新。`);
  }
  renderRoute();
}

function handleScoringForm(form) {
  const gender = form.querySelector('#scoringGender')?.value || 'male';
  const grade = form.querySelector('#scoringGrade')?.value || 'freshman';
  const minutes = parseInt(form.querySelector('#scoringMinutes')?.value || '0', 10);
  const seconds = parseInt(form.querySelector('#scoringSeconds')?.value || '0', 10);
  const totalSeconds = minutes * 60 + seconds;

  if (totalSeconds <= 0) {
    setTeacherNotice('请输入有效的跑步时间');
    return;
  }

  // Build the lookup key for the local scoring table
  const gradeGroup = (grade === 'freshman' || grade === 'sophomore') ? 'freshman_sophomore' : 'junior_senior';
  const resultDiv = document.getElementById('scoringResult');
  if (!resultDiv) return;

  // Try API first, fall back to local scoring lookup
  const base = state.apiBaseUrl || window.location.origin;
  fetch(`${base}/api/scoring/convert-endurance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeSeconds: totalSeconds, gender, gradeLevel: grade }),
  })
    .then(res => res.json())
    .then(data => {
      if (data && data.score) {
        const tierClass = data.tier === 'excellent' ? '优秀' : data.tier === 'good' ? '良好' : data.tier === 'pass' ? '及格' : '不及格';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div class="score-display" style="text-align:center;padding:20px">
            <p class="eyebrow">SCORE RESULT</p>
            <h2 style="font-size:48px;font-weight:900;color:var(--color-blue);margin:0">${data.score}</h2>
            <p style="font-size:18px;margin:8px 0">等级: ${tierClass}</p>
            <p style="color:var(--color-muted)">输入: ${minutes}′${seconds}″ · ${gender === 'male' ? '男' : '女'} · ${grade === 'freshman' ? '大一' : grade === 'sophomore' ? '大二' : grade === 'junior' ? '大三' : '大四'}</p>
          </div>`;
      }
    })
    .catch(() => {
      // Fallback: use hardcoded scoring table
      const score = localScoreLookup(gender, gradeGroup, totalSeconds);
      if (score) {
        const tierClass = score.tier === 'excellent' ? '优秀' : score.tier === 'good' ? '良好' : score.tier === 'pass' ? '及格' : '不及格';
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div class="score-display" style="text-align:center;padding:20px">
            <p class="eyebrow">SCORE RESULT (离线)</p>
            <h2 style="font-size:48px;font-weight:900;color:var(--color-blue);margin:0">${score.score}</h2>
            <p style="font-size:18px;margin:8px 0">等级: ${tierClass}</p>
            <p style="color:var(--color-muted)">输入: ${minutes}′${seconds}″</p>
          </div>`;
      } else {
        setTeacherNotice('未找到匹配的评分规则');
      }
    });
}

// Simplified local lookup for offline fallback
function localScoreLookup(gender, gradeGroup, timeSeconds) {
  // The exact scoring rules — inline fallback when API is unavailable
  const rules = {
    'male-freshman_sophomore': [[100,197],[95,202],[90,207],[85,214],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,292],[40,312],[30,332],[20,352],[10,372]],
    'male-junior_senior': [[100,195],[95,200],[90,205],[85,212],[80,220],[78,225],[76,230],[74,235],[72,240],[70,245],[68,250],[66,255],[64,260],[62,265],[60,270],[50,290],[40,310],[30,330],[20,350],[10,370]],
    'female-freshman_sophomore': [[100,198],[95,204],[90,210],[85,217],[80,224],[78,229],[76,234],[74,239],[72,244],[70,249],[68,254],[66,259],[64,264],[62,269],[60,274],[50,284],[40,294],[30,304],[20,314],[10,324]],
    'female-junior_senior': [[100,196],[95,202],[90,208],[85,215],[80,222],[78,227],[76,232],[74,237],[72,242],[70,247],[68,252],[66,257],[64,262],[62,267],[60,272],[50,282],[40,292],[30,302],[20,312],[10,322]],
  };
  const key = `${gender}-${gradeGroup}`;
  const table = rules[key];
  if (!table) return null;

  // Find the first score where timeSeconds <= max
  for (const [score, max] of table) {
    if (timeSeconds <= max) {
      // Determine tier
      let tier = 'fail';
      if (score >= 90) tier = 'excellent';
      else if (score >= 80) tier = 'good';
      else if (score >= 60) tier = 'pass';
      return { score, tier };
    }
  }
  return { score: 10, tier: 'fail' }; // Slowest
}

// Parse endurance time formats: "3'30\"", "3:30", "3 30", "3.5"
function parseEnduranceTime(input) {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // Try MM'SS" format
  const quoteMatch = trimmed.match(/^(\d+)\s*['′]\s*(\d+)\s*["″]?\s*$/);
  if (quoteMatch) {
    const mins = parseInt(quoteMatch[1]);
    const secs = parseInt(quoteMatch[2]);
    if (secs >= 60) return null;
    return { minutes: mins, seconds: secs, totalSeconds: mins * 60 + secs };
  }

  // Try MM:SS format
  const colonMatch = trimmed.match(/^(\d+)\s*[:：]\s*(\d{1,2})\s*$/);
  if (colonMatch) {
    const mins = parseInt(colonMatch[1]);
    const secs = parseInt(colonMatch[2]);
    if (secs >= 60) return null;
    return { minutes: mins, seconds: secs, totalSeconds: mins * 60 + secs };
  }

  // Try MM SS format (space separated)
  const spaceMatch = trimmed.match(/^(\d+)\s+(\d{1,2})\s*$/);
  if (spaceMatch) {
    const mins = parseInt(spaceMatch[1]);
    const secs = parseInt(spaceMatch[2]);
    if (secs >= 60) return null;
    return { minutes: mins, seconds: secs, totalSeconds: mins * 60 + secs };
  }

  // Try plain seconds
  const num = parseFloat(trimmed);
  if (!isNaN(num) && num > 0 && num < 1000) {
    if (num >= 60) {
      // Interpret as plain seconds
      const mins = Math.floor(num / 60);
      const secs = Math.round(num % 60);
      return { minutes: mins, seconds: secs, totalSeconds: Math.round(num) };
    }
    // Interpret as minutes.decimal
    const mins = Math.floor(num);
    const secs = Math.round((num - mins) * 60);
    return { minutes: mins, seconds: secs, totalSeconds: Math.round(num * 60) };
  }

  return null;
}

function handleStudentImportForm(form) {
  const textarea = form.querySelector('#importData');
  const data = textarea?.value?.trim();
  if (!data) {
    setAdminNotice('请粘贴学生数据');
    return;
  }

  const lines = data.split('\n').filter(line => line.trim());
  const headerKeywords = ['学号', '姓名', 'id', 'student', 'name', '学院', 'college'];
  const students = [];
  for (const line of lines) {
    const parts = line.split(',').map(p => p.trim());
    if (parts.length >= 3) {
      // Skip CSV header row (e.g. 学号,姓名,学院...)
      if (headerKeywords.some(kw => parts[0].toLowerCase() === kw.toLowerCase())) continue;
      students.push({
        id: parts[0],
        name: parts[1],
        college: parts[2],
        gender: parts[3] || null,
        gradeLevel: parts[4] || null
      });
    }
  }

  // Try API first
  const base = state.apiBaseUrl || window.location.origin;
  fetch(`${base}/api/admin/import-students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ students }),
  })
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    })
    .then(data => {
      const resultDiv = document.getElementById('importResult');
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `
          <div class="status-message" style="background:var(--color-blue-soft);border:1.5px solid var(--color-line);padding:14px">
            <strong>导入完成</strong>
            <p>成功: ${data.imported} / 总数: ${data.total} / 跳过: ${data.skipped}</p>
            ${data.errors?.length ? `<p style="color:var(--color-red);margin-top:8px">错误: ${data.errors.join('<br>')}</p>` : ''}
          </div>`;
      }
      setAdminNotice(`学生导入完成: ${data.imported} 人`);
    })
    .catch(() => {
      // Fallback: import locally
      for (const s of students) {
        const existing = baseStudents.find(bs => bs.id === s.id);
        if (!existing) {
          baseStudents.push({
            id: s.id, name: s.name, college: s.college,
            course: 0, general: 0, exam: 0, attendance: 0, physical: 0,
            status: '新导入',
            gender: s.gender,
            gradeLevel: s.gradeLevel
          });
        }
      }
      state.imported = true;
      const resultDiv = document.getElementById('importResult');
      if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.innerHTML = `<div class="status-message" style="background:var(--color-blue-soft);border:1.5px solid var(--color-line);padding:14px"><strong>本地导入完成</strong><p>已导入 ${students.length} 名学生（离线模式）</p></div>`;
      }
      setAdminNotice(`（离线模式）学生导入完成: ${students.length} 人`);
      renderRoute();
    });
}

function adjustStudentHours(student, type, delta) {
  const targets = sportRuleTargets();
  if (type.includes("课程")) {
    student.course = Math.max(0, Math.min(targets.courseRequired, Number(student.course || 0) + delta));
  } else {
    student.general = Math.max(0, Math.min(targets.generalRequired, Number(student.general || 0) + delta));
  }
  student.status = progressStatus(student);
}

function applyReviewDecision(review, action, approvedHours) {
  const courseId = review.courseId || state.courseId;
  const student = courseRoster(courseId).find((item) => item.id === review.studentId);
  const submission = review.submissionId ? state.submissions.find((item) => item.id === review.submissionId) : null;

  if (action === "approve" && student && !review.applied) {
    adjustStudentHours(student, review.type, approvedHours);
    review.applied = true;
    review.appliedAmount = approvedHours;
    review.appliedType = review.type;
  }

  if (submission) {
    submission.status = action === "approve" ? "已通过" : action === "reject" ? "已驳回" : "补材料";
    submission.comment = review.comment || submission.comment;
  }

  if (action !== "approve" && student && review.applied) {
    adjustStudentHours(student, review.appliedType || review.type, -Number(review.appliedAmount || approvedHours || review.hours || 0));
    review.applied = false;
    review.appliedAmount = 0;
  }
}

function batchApproveSafeReviews() {
  const safeReviews = filteredReviewsForCourse().filter((review) => review.status === "可通过");
  safeReviews.forEach((review) => {
    review.approvedHours = Number(review.approvedHours || review.hours);
    review.comment = review.comment || "批量通过：凭证完整，无异常。";
    applyReviewDecision(review, "approve", review.approvedHours);
    review.status = "已通过";
  });
  setTeacherNotice(`${courseOfferingLabel()} 已批量通过 ${safeReviews.length} 条可通过记录。`);
}

async function handleTaskAction(task, action) {
  if (action === "publish") {
    await apiFetchJsonSafe(`/api/teacher/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: "进行中" }) });
    task.status = "进行中";
    task.updatedAt = formatDateTime();
    logAction("体育任课老师", "发布课程任务", `${courseOfferingLabel()} / ${task.title}`);
    setTeacherNotice(`${task.title} 已发布，学生 App 端可看到该任务。`);
  }

  if (action === "close") {
    await apiFetchJsonSafe(`/api/teacher/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status: "已关闭" }) });
    task.status = "已关闭";
    task.updatedAt = formatDateTime();
    logAction("体育任课老师", "关闭课程任务", `${courseOfferingLabel()} / ${task.title}`);
    setTeacherNotice(`${task.title} 已关闭，后续提交将不再计入该任务。`);
  }

  if (action === "delete") {
    await apiFetchJsonSafe(`/api/teacher/tasks/${task.id}`, { method: 'DELETE' });
    state.tasks = state.tasks.filter((item) => item.id !== task.id);
    logAction("体育任课老师", "删除课程任务", `${courseOfferingLabel()} / ${task.title}`);
    setTeacherNotice(`${task.title} 已从当前课程任务列表删除。`);
  }
}

async function handleDeliveryAction(courseId, action) {
  const course = allCourses().find((item) => item.id === courseId) || currentCourse();
  const record = deliveryRecordForCourse(course.id);
  const issues = exportIssues(course.id);
  const count = issueCount(issues);
  const actionMap = { archive: 'approve', 'return': 'reject', remind: 'remind' };
  const apiAction = actionMap[action] || action;

  if (action === "archive") {
    if (count > 0) {
      record.status = "待清理";
      record.issueCount = count;
      record.comment = `仍有 ${count} 项预检问题，暂不能归档。`;
      record.updatedAt = formatDateTime();
      setAdminNotice(`${courseOfferingLabel(course)} 仍有 ${count} 项问题，已标记为待清理。`);
      logAction("体育部管理员", "归档受阻", `${courseOfferingLabel(course)} / ${count} 项问题`);
      return;
    }
    record.status = "已归档";
    record.issueCount = 0;
    record.comment = "体育部管理员已确认归档。";
    record.updatedAt = formatDateTime();
    setAdminNotice(`${courseOfferingLabel(course)} 成绩已确认归档。`);
    logAction("体育部管理员", "确认成绩归档", courseOfferingLabel(course));
  }

  if (action === "return") {
    record.status = "退回清理";
    record.issueCount = count;
    record.comment = count ? `退回老师清理：仍有 ${count} 项问题。` : "退回老师复核后重新提交。";
    record.updatedAt = formatDateTime();
  }

  if (action === "remind") {
    record.comment = count ? `已提醒老师处理 ${count} 项问题。` : "已提醒老师提交最终确认。";
    record.updatedAt = formatDateTime();
  }

  // Call backend
  const result = await apiFetchJsonSafe(`/api/admin/deliveries/${course.id}/decision`, {
    method: 'PUT',
    body: JSON.stringify({ action: apiAction, comment: record.comment }),
  });
  if (result) {
    record.status = result.status || record.status;
    setAdminNotice(`${courseOfferingLabel(course)} 服务器已记录：${record.status}。`);
  } else {
    setAdminNotice(`${courseOfferingLabel(course)} ${action === "archive" ? "已归档" : action === "return" ? "已退回" : "提醒已记录"}。`);
  }
  logAction("体育部管理员", action === "archive" ? "确认成绩归档" : action === "return" ? "退回成绩预检" : "提醒老师处理预检", courseOfferingLabel(course));
}

document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-action='login']");
  const taskForm = event.target.closest("form[data-action='create-task']");
  const adminForm = event.target.closest("form[data-admin-form]");
  const managerForm = event.target.closest("form[data-manager-form]");
  const scoreForm = event.target.closest("form[data-score-form]");
  if (form) {
    event.preventDefault();
    const account = (form.querySelector("#loginAccount")?.value || "").trim();
    const password = form.querySelector("#loginPassword")?.value || "";
    if (!account || !password) {
      state.loginError = "请输入账号和密码";
      renderRoute();
      return;
    }
    handleLogin(account, password);
    return;
  }

  if (taskForm) {
    event.preventDefault();
    const data = new FormData(taskForm);
    const payload = {
      title: data.get("title") || "未命名任务",
      description: data.get("taskDesc") || "",
      creditType: "course",
      hours: Number(data.get("hours")) || 1,
      deadline: data.get("deadline") || "待设置",
      proof: data.get("proof") || "待设置",
      status: data.get("status") || "草稿",
    };
    const saved = await apiFetchJsonSafe(`/api/teacher/courses/${state.courseId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
    if (saved) {
      // Map backend response to frontend shape
      state.tasks.unshift({
        id: saved.id || saved.taskId || `t${Date.now()}`,
        courseId: saved.courseId || saved.course_id || state.courseId,
        title: saved.title || payload.title,
        hours: saved.hours || saved.required_hours || payload.hours,
        deadline: saved.deadline || payload.deadline,
        proof: saved.proof || payload.proof,
        status: saved.status || payload.status,
        updatedAt: saved.updatedAt || saved.updated_at || formatDateTime(),
      });
    } else {
      // Fallback: save locally if API unavailable
      state.tasks.unshift({
        id: `t${Date.now()}`,
        courseId: state.courseId,
        title: payload.title,
        hours: payload.hours,
        deadline: payload.deadline,
        proof: payload.proof,
        status: payload.status,
        updatedAt: formatDateTime(),
      });
    }
    logAction("体育任课老师", "创建课程任务", `${courseOfferingLabel()} / ${payload.title}`);
    setTeacherNotice(`${courseOfferingLabel()} 课程任务已保存。`);
    renderRoute();
    return;
  }

  if (adminForm) {
    event.preventDefault();
    handleAdminForm(adminForm).then(() => renderRoute());
    return;
  }

  if (managerForm) {
    event.preventDefault();
    handleManagerForm(managerForm);
    return;
  }

  var convAddForm = event.target.closest("form[data-conv-add-form]");
  if (convAddForm) {
    event.preventDefault();
    var fd = new FormData(convAddForm);
    var cGradeGroup = fd.get("gradeGroup");
    var cGender = fd.get("gender");
    var rawSeconds = parseInt(fd.get("rawSeconds"), 10);
    var convertedScore = parseFloat(fd.get("convertedScore"));
    if (isNaN(rawSeconds) || isNaN(convertedScore)) {
      setAdminNotice("请输入有效的秒数和分数。");
      renderRoute();
      return;
    }
    var saved = await saveSingleConversionRow(cGradeGroup, cGender, rawSeconds, convertedScore);
    apiLoadState.clear();
    state.conversionTableData = null;
    if (saved) {
      setAdminNotice("已添加分数点：" + rawSeconds + "s → " + convertedScore + " 分。");
    } else {
      setAdminNotice("添加失败：服务器无响应或数据重复。");
    }
    renderRoute();
    return;
  }

  if (scoreForm) {
    event.preventDefault();
    handleScoreForm(scoreForm).then(() => {});
    return;
  }

  // Scoring form
  if (target.dataset.scoringForm || (target.closest && target.closest('form[data-scoring-form]'))) {
    event.preventDefault();
    const form = target.closest('form[data-scoring-form]') || target;
    handleScoringForm(form);
    return;
  }

  // Student import form
  if (target.dataset.studentImportForm || (target.closest && target.closest('form[data-student-import-form]'))) {
    event.preventDefault();
    const form = target.closest('form[data-student-import-form]') || target;
    handleStudentImportForm(form);
    return;
  }

  // Manual credit form (Feature #1)
  if (target.dataset.manualCreditForm !== undefined || (target.closest && target.closest('form[data-manual-credit-form]'))) {
    event.preventDefault();
    const form = target.closest('form[data-manual-credit-form]') || target;
    const studentId = form.dataset.studentId;
    const creditType = form.querySelector('#manualCreditType')?.value || '课程相关';
    const hours = parseFloat(form.querySelector('#manualCreditHours')?.value || '1');
    const reason = (form.querySelector('#manualCreditReason')?.value || '').trim();

    if (!reason) {
      setTeacherNotice('请输入原因说明');
      renderRoute();
      return;
    }
    if (isNaN(hours) || hours <= 0 || hours > 20) {
      setTeacherNotice('小时数须在 0.1–20 之间');
      renderRoute();
      return;
    }

    // Try API first
    if (isApiLive()) {
      state.apiLoading = true;
      renderRoute();
      submitManualCredit(state.courseId, studentId, { creditType, hours, reason, proofFiles: [] })
        .then(data => {
          state.apiLoading = false;
          // Update student hours
          const student = studentsForCourse().find(s => s.id === studentId);
          if (student) {
            if (creditType === '课程相关') student.course += hours;
            else student.general += hours;
          }
          // Refresh detail cache
          return fetchStudentHoursDetail(state.courseId, studentId);
        })
        .then(detailData => {
          if (detailData) state.studentHoursDetail = detailData;
        })
        .catch(e => {
          state.apiLoading = false;
          setTeacherNotice(`API 失败: ${e.message}，已使用本地模式`);
        })
        .finally(() => {
          logAction("体育任课老师", "手动加抵卡", `${studentId} / ${creditType} ${hours}h / ${reason.slice(0, 50)}`);
          setTeacherNotice(`已为 ${studentId} 手动加抵 ${creditType} ${hours}h`);
          renderRoute();
        });
      return;
    }

    // Local mock fallback
    const id = 'mc-' + Date.now();
    if (!state.manualCredits) state.manualCredits = [];
    state.manualCredits.push({
      id, studentId, courseId: state.courseId, creditType, hours, reason,
      operatorId: state.authUser?.id || 'u1',
      createdAt: new Date().toISOString()
    });

    // Update student progress
    const student = studentsForCourse().find(s => s.id === studentId);
    if (student) {
      if (creditType === '课程相关') student.course += hours;
      else student.general += hours;
    }

    logAction("体育任课老师", "手动加抵卡", `${studentId} / ${creditType} ${hours}h / ${reason.slice(0, 50)}`);
    setTeacherNotice(`已为 ${studentId} 手动加抵 ${creditType} ${hours}h`);
    renderRoute();
    return;
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-student-search]")) {
    state.studentSearch = event.target.value;
    const tbody = event.target.closest(".panel-body").querySelector("tbody");
    tbody.innerHTML = studentListRows(filteredStudents());
  }

  if (event.target.matches("[data-review-search]")) {
    state.reviewSearch = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-manager-search]")) {
    state.managerSearch = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-api-base-url]")) {
    state.apiBaseUrl = normalizeApiBase(event.target.value);
    event.target.value = state.apiBaseUrl;
    saveState();
  }

  if (event.target.matches("[data-api-health-path]")) {
    state.apiHealthPath = normalizeApiPath(event.target.value);
    event.target.value = state.apiHealthPath;
    saveState();
  }
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-student-filter]")) {
    state.studentFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-review-status-filter]")) {
    state.reviewStatusFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-task-status-filter]")) {
    state.taskStatusFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-manager-status-filter]")) {
    state.managerStatusFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-admin-organization-filter]")) {
    state.adminOrganizationFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-admin-course-filter]")) {
    state.adminCourseFilter = event.target.value;
    renderRoute();
  }

  if (event.target.matches("[data-roster-file]")) {
    handleRosterFile(event.target.files?.[0]);
  }

  if (event.target.matches("[data-manager-import-file]")) {
    handleManagerImportFile(event.target.files?.[0], event.target.dataset.managerImportFile);
  }
});

document.addEventListener("click", async (event) => {
  console.log("[CLICK]", event.target.tagName, event.target.className, event.target.closest("button, article, tr")?.tagName);
  // Close notification dropdown when clicking outside
  if (state.notificationsOpen) {
    var insideDropdown = event.target.closest('.notification-dropdown');
    var insideBell = event.target.closest('.notification-bell');
    if (!insideDropdown && !insideBell) {
      state.notificationsOpen = false;
      // Don't return — let the click also do its normal action, then re-render
      setTimeout(function() { renderRoute(); }, 0);
    }
  }

  const target = event.target.closest("button, article, tr");
  if (!target) { console.log("[CLICK] no button found, returning"); return; }

  const route = target.dataset.route;

  // Pre-set conversion tab when navigating from overview cards
  if (target.dataset.conversionTabPreset) {
    state.conversionTab = target.dataset.conversionTabPreset;
  }

  if (route) {
    if (!routeAllowedForRole(route, state.role)) return;
    state.route = route;
    renderRoute();
    return;
  }

  if (target.dataset.adminDelete) {
    const collection = target.dataset.adminDelete;
    const id = target.dataset.adminId;

    // Map collection name to API path
    const apiMap = {
      semesters: '/api/admin/semesters',
      courses: '/api/admin/courses',
      users: '/api/admin/users',
      teams: '/api/admin/organizations',
      clubs: '/api/admin/organizations',
      conversionRules: null, // localStorage only — data model mismatch
    };
    const apiPath = apiMap[collection];

    if (apiPath) {
      const deleted = await apiFetchJsonSafe(`${apiPath}/${id}`, { method: 'DELETE' });
      if (deleted !== null) {
        // Successfully deleted from server (204 returns null body)
        if (Array.isArray(state.admin[collection])) {
          state.admin[collection] = state.admin[collection].filter((item) => item.id !== id);
        }
        setAdminNotice("已从服务器删除。");
        renderRoute();
        return;
      }
    }

    // Fallback: localStorage delete
    if (Array.isArray(state.admin[collection])) {
      state.admin[collection] = state.admin[collection].filter((item) => item.id !== id);
      setAdminNotice(apiPath ? "服务器删除失败，已本地移除。" : "配置项已删除（本地）。");
    }
    renderRoute();
    return;
  }

  // Exemption approve/reject
  if (target.dataset.exemptionApprove) {
    const id = target.dataset.exemptionApprove;

    // Try API first
    if (isApiLive()) {
      state.apiLoading = true;
      renderRoute();
      reviewExemption(id, 'approve', '老师已通过免测申请')
        .then(() => {
          state.apiLoading = false;
          setTeacherNotice(`免测申请 ${id} 已通过。`);
          // Refresh exemptions from API
          return fetchCourseExemptions(state.courseId);
        })
        .then(data => {
          if (data && Array.isArray(data)) {
            data.forEach(e => {
              const existing = (state.exemptions || []).find(x => x.id === e.id);
              if (existing) {
                existing.status = e.status;
                existing.reviewComment = e.reviewComment || '';
              }
            });
          }
        })
        .catch(e => {
          state.apiLoading = false;
          setTeacherNotice(`API 失败: ${e.message}`);
        })
        .finally(() => renderRoute());
      return;
    }

    // Local mock fallback
    const exemption = (state.exemptions || []).find((e) => e.id === id);
    if (exemption) {
      exemption.status = '已通过';
      exemption.reviewComment = '老师已通过免测申请';
      setTeacherNotice(`免测申请 ${id} 已通过。`);
      renderRoute();
    }
    return;
  }
  if (target.dataset.exemptionReject) {
    const id = target.dataset.exemptionReject;

    // Try API first
    if (isApiLive()) {
      state.apiLoading = true;
      renderRoute();
      reviewExemption(id, 'reject', '老师已驳回免测申请')
        .then(() => {
          state.apiLoading = false;
          setTeacherNotice(`免测申请 ${id} 已驳回。`);
          return fetchCourseExemptions(state.courseId);
        })
        .then(data => {
          if (data && Array.isArray(data)) {
            data.forEach(e => {
              const existing = (state.exemptions || []).find(x => x.id === e.id);
              if (existing) {
                existing.status = e.status;
                existing.reviewComment = e.reviewComment || '';
              }
            });
          }
        })
        .catch(e => {
          state.apiLoading = false;
          setTeacherNotice(`API 失败: ${e.message}`);
        })
        .finally(() => renderRoute());
      return;
    }

    // Local mock fallback
    const exemption = (state.exemptions || []).find((e) => e.id === id);
    if (exemption) {
      exemption.status = '已驳回';
      exemption.reviewComment = '老师已驳回免测申请';
      setTeacherNotice(`免测申请 ${id} 已驳回。`);
      renderRoute();
    }
    return;
  }

  // Student detail select
  if (target.dataset.studentDetailSelect) {
    state.studentDetailId = target.value;
    renderRoute();
    return;
  }

  // Certification actions (Feature #2)
  if (target.dataset.certAction) {
    const certId = target.dataset.certId;

    // Try API first
    if (isApiLive()) {
      if (target.dataset.certAction === 'confirm') {
        const hoursInput = document.getElementById(`certHours_${certId}`);
        const adjustedHours = hoursInput ? parseFloat(hoursInput.value) : 10.0;
        state.apiLoading = true;
        renderRoute();
        confirmCertification(certId, adjustedHours)
          .then(() => {
            state.apiLoading = false;
            setTeacherNotice(`抵扣已确认生效 (${adjustedHours}h)。`);
            // Refresh pending certs
            return fetchPendingCertifications(state.courseId);
          })
          .then(data => {
            if (data) state.pendingCerts = data.items || [];
          })
          .catch(e => {
            state.apiLoading = false;
            setTeacherNotice(`API 失败: ${e.message}，已使用本地模式`);
          })
          .finally(() => renderRoute());
        return;
      } else if (target.dataset.certAction === 'reject') {
        state.apiLoading = true;
        renderRoute();
        rejectCertification(certId, '任课老师驳回抵扣申请')
          .then(() => {
            state.apiLoading = false;
            setTeacherNotice(`抵扣已驳回。`);
            return fetchPendingCertifications(state.courseId);
          })
          .then(data => {
            if (data) state.pendingCerts = data.items || [];
          })
          .catch(e => {
            state.apiLoading = false;
            setTeacherNotice(`API 失败: ${e.message}，已使用本地模式`);
          })
          .finally(() => renderRoute());
        return;
      }
    }

    // Local mock fallback
    const membership = state.memberships.find(m => m.id === certId);
    if (!membership) return;

    if (target.dataset.certAction === 'confirm') {
      const hoursInput = document.getElementById(`certHours_${certId}`);
      const adjustedHours = hoursInput ? parseFloat(hoursInput.value) : (membership.offsetHours || 10.0);
      membership.offset = '可抵扣';
      membership.offsetHours = adjustedHours;
      membership.status = '认证有效';
      membership.comment = membership.comment ? membership.comment + '\n任课老师已确认抵扣' : '任课老师已确认抵扣';
      membership.confirmedBy = state.authUser?.name || '任课老师';
      membership.confirmedAt = new Date().toISOString();
      setTeacherNotice(`${membership.studentName} 的 ${membership.organization} 抵扣已确认生效 (${adjustedHours}h)。`);
      logAction("体育任课老师", "确认校队/社团抵扣", `${membership.studentName} / ${membership.organization} / ${adjustedHours}h`);
    } else if (target.dataset.certAction === 'reject') {
      membership.offset = '不抵扣';
      membership.rejectionReason = '任课老师驳回抵扣申请';
      membership.comment = membership.comment ? membership.comment + '\n' + membership.rejectionReason : membership.rejectionReason;
      setTeacherNotice(`${membership.studentName} 的 ${membership.organization} 抵扣已驳回。`);
      logAction("体育任课老师", "驳回校队/社团抵扣", `${membership.studentName} / ${membership.organization}`);
    }
    renderRoute();
    return;
  }

  // Organization identity flag actions (Feature #5)
  if (target.dataset.orgFlag) {
    const orgId = target.dataset.orgId;
    const studentId = target.dataset.studentId;

    // Try API first
    if (isApiLive()) {
      const flag = target.dataset.orgFlag;
      const comment = flag === 'confirmed' ? '任课老师已确认身份信息无误' : '任课老师标记存疑，等待管理员核实';
      state.apiLoading = true;
      renderRoute();
      flagOrgIdentity(studentId, orgId, flag, comment)
        .then(() => {
          state.apiLoading = false;
          setTeacherNotice(`${studentId} 的组织身份已标记${flag === 'confirmed' ? '已确认' : '存疑'}。`);
          // Refresh org identity data
          return fetchStudentOrgIdentity(state.courseId, studentId);
        })
        .then(data => {
          if (data) state.studentOrgIdentity = data;
        })
        .catch(e => {
          state.apiLoading = false;
          setTeacherNotice(`API 失败: ${e.message}，已使用本地模式`);
        })
        .finally(() => renderRoute());
      return;
    }

    // Local mock fallback
    const membership = state.memberships.find(m => m.id === orgId);
    if (!membership) return;

    if (target.dataset.orgFlag === 'confirmed') {
      membership.status = '认证有效';
      membership.comment = '任课老师已确认身份信息无误';
      setTeacherNotice(`${studentId} 的 ${membership.organization} 身份已标记确认。`);
      logAction("体育任课老师", "确认组织身份", `${membership.studentName || studentId} / ${membership.organization}`);
    } else if (target.dataset.orgFlag === 'questionable') {
      membership.status = '待确认';
      membership.comment = '任课老师标记存疑，等待管理员核实';
      setTeacherNotice(`${studentId} 的 ${membership.organization} 身份已标记存疑。`);
      logAction("体育任课老师", "标记组织身份存疑", `${membership.studentName || studentId} / ${membership.organization}`);
    }
    renderRoute();
    return;
  }

  // Conversion tab switch (Feature #3)
  if (target.dataset.conversionTab) {
    state.conversionTab = target.dataset.conversionTab;
    renderRoute();
    return;
  }

  // Auto-convert endurance time (Feature #3D)
  if (target.dataset.autoConvert) {
    const studentId = target.dataset.studentId;
    const input = document.querySelector(`[data-phys-endurance][data-student-id="${studentId}"]`);
    if (!input) return;
    const rawTime = (input.value || '').trim();
    const parsed = parseEnduranceTime(rawTime);
    if (!parsed) {
      const resultEl = document.getElementById(`convertResult_${studentId}`);
      if (resultEl) { resultEl.textContent = '格式错误'; resultEl.className = 'status status-risk'; }
      return;
    }

    const { totalSeconds } = parsed;

    // Try API first for per-second precision
    if (isApiLive()) {
      calculateEnduranceScore(studentId, totalSeconds)
        .then(data => {
          if (data && data.convertedScore != null) {
            const scoreInput = document.getElementById(`phys_score_${studentId}`);
            if (scoreInput) scoreInput.value = data.convertedScore;
            const resultEl = document.getElementById(`convertResult_${studentId}`);
            if (resultEl) {
              const tierLabel = data.tier === 'excellent' ? '优秀' : data.tier === 'good' ? '良好' : data.tier === 'pass' ? '及格' : '不及格';
              resultEl.textContent = `${data.convertedScore}分 (${tierLabel})`;
              resultEl.className = `status ${data.tier === 'excellent' || data.tier === 'good' ? 'status-ok' : data.tier === 'pass' ? 'status-pending' : 'status-risk'}`;
            }
          }
        })
        .catch(() => {
          // Fallback to local lookup
          const gender = input.dataset.gender || 'male';
          const grade = input.dataset.grade || 'freshman';
          const gradeGroup = (grade === 'freshman' || grade === 'sophomore') ? 'freshman_sophomore' : 'junior_senior';
          const result = localScoreLookup(gender, gradeGroup, totalSeconds);
          if (result) {
            const scoreInput = document.getElementById(`phys_score_${studentId}`);
            if (scoreInput) scoreInput.value = result.score;
            const resultEl = document.getElementById(`convertResult_${studentId}`);
            if (resultEl) {
              const tierLabel = result.tier === 'excellent' ? '优秀' : result.tier === 'good' ? '良好' : result.tier === 'pass' ? '及格' : '不及格';
              resultEl.textContent = `${result.score}分 (${tierLabel})`;
              resultEl.className = `status ${result.tier === 'excellent' || result.tier === 'good' ? 'status-ok' : result.tier === 'pass' ? 'status-pending' : 'status-risk'}`;
            }
          }
        });
      return;
    }

    // Local mock fallback
    const gender = input.dataset.gender || 'male';
    const grade = input.dataset.grade || 'freshman';
    const gradeGroup = (grade === 'freshman' || grade === 'sophomore') ? 'freshman_sophomore' : 'junior_senior';
    const result = localScoreLookup(gender, gradeGroup, totalSeconds);

    if (result) {
      const scoreInput = document.getElementById(`phys_score_${studentId}`);
      if (scoreInput) scoreInput.value = result.score;
      const resultEl = document.getElementById(`convertResult_${studentId}`);
      if (resultEl) {
        const tierLabel = result.tier === 'excellent' ? '优秀' : result.tier === 'good' ? '良好' : result.tier === 'pass' ? '及格' : '不及格';
        resultEl.textContent = `${result.score}分 (${tierLabel})`;
        resultEl.className = `status ${result.tier === 'excellent' || result.tier === 'good' ? 'status-ok' : result.tier === 'pass' ? 'status-pending' : 'status-risk'}`;
      }
    }
    return;
  }

  // Convert all endurance times (Feature #3D)
  if (target.dataset.convertAll !== undefined) {
    const students = studentsForCourse();
    let converted = 0;
    let remaining = 0;

    // Use API for per-second precision when available
    if (isApiLive()) {
      const promises = [];
      for (const student of students) {
        const input = document.querySelector(`[data-phys-endurance][data-student-id="${student.id}"]`);
        if (!input) continue;
        const rawTime = (input.value || '').trim();
        if (!rawTime) continue;
        const parsed = parseEnduranceTime(rawTime);
        if (!parsed) continue;
        remaining++;
        promises.push(
          calculateEnduranceScore(student.id, parsed.totalSeconds)
            .then(data => {
              if (data && data.convertedScore != null) {
                const scoreInput = document.getElementById(`phys_score_${student.id}`);
                if (scoreInput) scoreInput.value = data.convertedScore;
                const resultEl = document.getElementById(`convertResult_${student.id}`);
                if (resultEl) {
                  const tierLabel = data.tier === 'excellent' ? '优秀' : data.tier === 'good' ? '良好' : data.tier === 'pass' ? '及格' : '不及格';
                  resultEl.textContent = `${data.convertedScore}分 (${tierLabel})`;
                  resultEl.className = `status ${data.tier === 'excellent' || data.tier === 'good' ? 'status-ok' : data.tier === 'pass' ? 'status-pending' : 'status-risk'}`;
                }
                converted++;
              }
            })
            .catch(() => null)
        );
      }
      Promise.all(promises).then(() => {
        setTeacherNotice(`已通过API自动换算 ${converted}/${remaining} 名学生的耐力跑成绩。`);
      });
      if (remaining > 0) {
        setTeacherNotice(`正在换算 ${remaining} 名学生...`);
      }
      return;
    }

    // Local mock fallback
    for (const student of students) {
      const input = document.querySelector(`[data-phys-endurance][data-student-id="${student.id}"]`);
      if (!input) continue;
      const rawTime = (input.value || '').trim();
      if (!rawTime) continue;
      const parsed = parseEnduranceTime(rawTime);
      if (!parsed) continue;
      const gender = input.dataset.gender || 'male';
      const grade = input.dataset.grade || 'freshman';
      const gradeGroup = (grade === 'freshman' || grade === 'sophomore') ? 'freshman_sophomore' : 'junior_senior';
      const result = localScoreLookup(gender, gradeGroup, parsed.totalSeconds);
      if (!result) continue;
      const scoreInput = document.getElementById(`phys_score_${student.id}`);
      if (scoreInput) scoreInput.value = result.score;
      const resultEl = document.getElementById(`convertResult_${student.id}`);
      if (resultEl) {
        const tierLabel = result.tier === 'excellent' ? '优秀' : result.tier === 'good' ? '良好' : result.tier === 'pass' ? '及格' : '不及格';
        resultEl.textContent = `${result.score}分 (${tierLabel})`;
        resultEl.className = `status ${result.tier === 'excellent' || result.tier === 'good' ? 'status-ok' : result.tier === 'pass' ? 'status-pending' : 'status-risk'}`;
      }
      converted++;
    }
    setTeacherNotice(`已自动换算 ${converted} 名学生的耐力跑成绩。`);
    return;
  }

  if (target.dataset.managerAction) {
    const membership = state.memberships.find((item) => item.id === target.dataset.memberId);
    if (membership) {
      var decision, statusText, offsetText, commentText, noticeText;
      if (target.dataset.managerAction === "approve-member") {
        const canOffset = organizationCanOffset(membership);
        decision = 'approved';
        statusText = '认证有效';
        offsetText = canOffset ? '可抵扣' : '不抵扣';
        commentText = canOffset ? '负责人已确认身份，其他运动自动抵扣' : '负责人已确认身份，但组织类型不产生体育抵扣';
        noticeText = membership.studentName + ' 的 ' + membership.organization + ' 身份已确认，' + (offsetText === '可抵扣' ? '其他运动已自动抵扣' : '不产生体育抵扣') + '。';
      } else {
        decision = 'rejected';
        statusText = '不通过';
        offsetText = '不抵扣';
        commentText = '负责人驳回认证';
        noticeText = membership.studentName + ' 的 ' + membership.organization + ' 认证已驳回。';
      }

      // Call API first, then update local state
      var apiResult = await apiFetchJsonSafe('/api/manager/memberships/' + encodeURIComponent(membership.id) + '/decision', {
        method: 'PUT',
        body: JSON.stringify({ decision: decision, comment: commentText })
      });

      if (apiResult || !state.token) {
        // API success or offline mode — update local state
        membership.status = statusText;
        membership.offset = offsetText;
        membership.comment = commentText;
        membership.updatedBy = '组织负责人';
        membership.updatedAt = formatDateTime();
        logAction('组织负责人', decision === 'approved' ? '确认成员身份' : '驳回成员认证', membership.studentName + ' / ' + membership.organization);
        setManagerNotice(apiResult ? noticeText + ' (已同步)' : noticeText + ' (本地)');
      } else {
        setManagerNotice('操作失败：服务器无响应。');
      }
      renderRoute();
    }
    return;
  }

  if (target.dataset.taskAction) {
    const task = state.tasks.find((item) => item.id === target.dataset.taskId);
    if (!task) return;
    handleTaskAction(task, target.dataset.taskAction).then(() => renderRoute());
    return;
  }

  if (target.dataset.deliveryAction) {
    handleDeliveryAction(target.dataset.courseId, target.dataset.deliveryAction).then(() => renderRoute());
    return;
  }

  if (target.dataset.adminCourseAction) {
    const course = allCourses().find((item) => item.id === target.dataset.courseId);
    if (!course) return;

    if (target.dataset.adminCourseAction === "remind-course") {
      const issues = exportIssues(course.id);
      const count = issueCount(issues);
      const record = deliveryRecordForCourse(course.id);
      record.comment = count ? `管理员已提醒老师处理 ${count} 项问题。` : "管理员已提醒老师提交最终预检。";
      record.updatedAt = formatDateTime();
      logAction("体育部管理员", "提醒课程跟进", `${courseOfferingLabel(course)} / ${record.comment}`);
      setAdminNotice(`${courseOfferingLabel(course)} 跟进提醒已记录。`);
    }

    if (target.dataset.adminCourseAction === "open-delivery") {
      state.route = "admin-delivery-audit";
    }

    renderRoute();
    return;
  }

  if (target.dataset.adminMemberAction) {
    const membership = state.memberships.find((item) => item.id === target.dataset.memberId);
    if (!membership) return;
    const action = target.dataset.adminMemberAction;

    if (action === "confirm-member") {
      membership.status = "认证有效";
      membership.offset = organizationCanOffset(membership) ? "可抵扣" : "不抵扣";
      membership.comment = membership.offset === "可抵扣" ? "管理员确认身份，抵扣生效" : "管理员确认身份，但规则不允许抵扣";
      setAdminNotice(`${membership.studentName} 的组织身份已确认。`);
      logAction("体育部管理员", "确认组织身份", `${membership.studentName} / ${membership.organization}`);
    }

    if (action === "force-offset") {
      if (membership.status !== "认证有效") {
        membership.status = "认证有效";
      }
      if (organizationCanOffset(membership)) {
        membership.offset = "可抵扣";
        membership.comment = "管理员认可抵扣";
        setAdminNotice(`${membership.studentName} 的 ${membership.organization} 抵扣已认可。`);
        logAction("体育部管理员", "认可组织抵扣", `${membership.studentName} / ${membership.organization}`);
      } else {
        membership.offset = "不抵扣";
        membership.comment = "当前组织规则不允许抵扣";
        setAdminNotice(`${membership.organization} 当前规则不允许抵扣，请先在校队/社团管理中调整。`);
        logAction("体育部管理员", "抵扣受规则阻止", `${membership.studentName} / ${membership.organization}`);
      }
    }

    if (action === "revoke-offset") {
      membership.offset = "不抵扣";
      membership.comment = "管理员取消抵扣";
      setAdminNotice(`${membership.studentName} 的组织抵扣已取消。`);
      logAction("体育部管理员", "取消组织抵扣", `${membership.studentName} / ${membership.organization}`);
    }

    membership.updatedBy = "体育部管理员";
    membership.updatedAt = formatDateTime();
    renderRoute();
    return;
  }

  if (target.dataset.action === "quick-teacher") {
    redirectToTeacherApp(true);
    return;
  }

  if (target.dataset.action === "quick-admin") {
    setRole("admin");
    return;
  }

  if (target.dataset.action === "quick-manager") {
    setRole("manager");
    return;
  }

  if (target.dataset.action === "logout") {
    state.loggedIn = false;
    state.token = null;
    state.authUser = null;
    state.loginError = null;
    state.loginLoading = false;
    try {
      window.sessionStorage.removeItem("bnbuAuthSession");
    } catch {
      // ignore
    }
    renderRoute();
    return;
  }

  // ── Notification actions ──────────────────────────────────────
  if (target.dataset.action === "toggle-notifications") {
    state.notificationsOpen = !state.notificationsOpen;
    renderRoute();
    return;
  }

  if (target.dataset.action === "mark-read") {
    var notifId = target.dataset.notifId;
    if (notifId) {
      await markNotificationRead(notifId);
      renderRoute();
    }
    return;
  }

  if (target.dataset.action === "mark-all-read") {
    await markAllNotificationsRead();
    renderRoute();
    return;
  }

  // ── Conversion table actions ──────────────────────────────────
  if (target.dataset.action === "delete-conversion-row") {
    var convId = target.dataset.convId;
    var convSeconds = target.dataset.convSeconds;
    if (convId) {
      await deleteConversionRow(convId);
    }
    // Clear cache to force re-fetch
    apiLoadState.clear();
    state.conversionTableData = null;
    setAdminNotice('已删除 ' + (convSeconds || '') + 's 的分数点。');
    renderRoute();
    return;
  }

  if (target.dataset.action === "batch-import-conversion") {
    var gradeGroup = target.dataset.gradeGroup;
    var gender = target.dataset.gender;
    var textarea = document.getElementById('batchImportText');
    var text = textarea ? textarea.value : '';
    if (!text.trim()) {
      setAdminNotice('请在文本框中粘贴换算数据。');
      renderRoute();
      return;
    }
    var result = await batchImportConversion(gradeGroup, gender, text);
    apiLoadState.clear();
    state.conversionTableData = null;
    if (result && result.count !== undefined) {
      setAdminNotice('批量导入成功：已替换为 ' + result.count + ' 条分数点。');
    } else if (result && result.ok === false) {
      setAdminNotice('导入失败：' + (result.message || '未知错误'));
    } else if (result) {
      setAdminNotice('批量导入成功。');
    } else {
      setAdminNotice('导入失败：服务器无响应。');
    }
    renderRoute();
    return;
  }

  if (target.dataset.action === "reset-demo") {
    window.localStorage.removeItem(storageKey);
    window.location.reload();
    return;
  }

  if (target.dataset.action === "simulate-import") {
    state.importPreview = buildImportPreview();
    state.imported = true;
    setTeacherNotice(`${courseOfferingLabel()} 名单预检完成：${state.importPreview.filter((row) => row.valid).length} 行可导入。`);
    renderRoute();
    return;
  }

  if (target.dataset.action === "confirm-import") {
    confirmImportPreview().then(() => renderRoute());
    return;
  }

  if (target.dataset.action === "download-import-template") {
    downloadImportTemplate();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-member-template") {
    downloadMembershipTemplate(target.dataset.importType || "team");
    renderRoute();
    return;
  }

  if (target.dataset.action === "confirm-manager-import") {
    confirmManagerImportPreview(target.dataset.importType || "team").then(() => renderRoute());
    return;
  }

  if (target.dataset.action === "activate-semester") {
    state.admin.semesters.forEach((semester) => {
      if (semester.id === target.dataset.adminId) {
        semester.status = "进行中";
        semester.locked = "否";
      } else if (semester.status === "进行中") {
        semester.status = "已归档";
        semester.locked = "是";
      }
    });
    setAdminNotice("当前学期已切换。");
    renderRoute();
    return;
  }

  if (target.dataset.action === "publish-grade") {
    const form = target.closest("form[data-admin-form='grade-rules']");
    const total = form ? saveGradeRulesFromForm(form) : state.admin.gradeRules.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    if (total === 100) {
      state.admin.gradeRules.forEach((rule) => { rule.status = "正常"; });
      apiFetchJsonSafe('/api/admin/grade-rules', { method: 'PUT', body: JSON.stringify(state.admin.gradeRules) });
      setAdminNotice("成绩规则已发布。");
    } else {
      setAdminNotice(`成绩规则未发布：当前权重合计为 ${total}%，需要等于 100%。`);
    }
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-csv") {
    downloadCsv().then(() => {});
    return;
  }

  if (target.dataset.action === "download-issue-list") {
    downloadIssueList();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-school-issue-list") {
    downloadSchoolIssueList();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-handoff-snapshot") {
    downloadJsonSnapshot();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-route-matrix") {
    downloadRouteMatrix();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-endpoint-map") {
    downloadEndpointMap();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-handoff-manifest") {
    downloadHandoffManifest();
    renderRoute();
    return;
  }

  if (target.dataset.action === "download-quality-checklist") {
    downloadQualityChecklist();
    renderRoute();
    return;
  }

  if (target.dataset.action === "check-api-health") {
    checkApiHealth();
    return;
  }

  if (target.dataset.action === "remind-all-risk-courses") {
    const riskRows = courseHealthRows().filter((row) => row.health === "需跟进");
    riskRows.forEach((row) => {
      const record = deliveryRecordForCourse(row.course.id);
      record.comment = `管理员已批量提醒：仍有 ${row.issueCount} 项问题。`;
      record.updatedAt = formatDateTime();
      logAction("体育部管理员", "批量提醒课程跟进", `${courseOfferingLabel(row.course)} / ${row.issueCount} 项问题`);
    });
    setAdminNotice(`已提醒 ${riskRows.length} 门需跟进课程。`);
    renderRoute();
    return;
  }

  if (target.dataset.action === "submit-delivery") {
    submitDeliveryForCurrentCourse().then(() => renderRoute());
    return;
  }

  if (target.dataset.action === "batch-approve-safe") {
    batchApproveSafeReviews();
    renderRoute();
    return;
  }

  if (target.dataset.action === "clear-review-filter") {
    state.reviewSearch = "";
    state.reviewStatusFilter = "open";
    renderRoute();
    return;
  }

  if (target.dataset.courseCard) {
    state.courseId = target.dataset.courseCard;
    state.route = "teacher-dashboard";
    state.imported = false;
    state.importPreview = [];
    renderRoute();
    return;
  }

  if (target.classList.contains("course-switch-button")) {
    target.closest(".course-switcher").classList.toggle("is-open");
    return;
  }

  if (target.dataset.course) {
    state.courseId = target.dataset.course;
    state.imported = false;
    state.importPreview = [];
    renderRoute();
    return;
  }

  if (target.dataset.review) {
    state.activeReviewId = target.dataset.review;
    renderRoute();
    return;
  }

  if (target.dataset.reviewAction) {
    const active = activeReview();
    if (!active) return;
    const approvedInput = document.querySelector("[data-approved-hours]");
    const commentInput = document.querySelector("[data-review-comment]");
    active.approvedHours = Number(approvedInput?.value) || active.hours;
    active.comment = commentInput?.value || "";
    const action = target.dataset.reviewAction;
    if (isApiLive()) {
      try {
        const result = await submitReviewDecision(active.id, action, active.approvedHours, active.comment);
        applyReviewDecision(active, action, active.approvedHours);
        if (result?.review) {
          active.status = result.review.status || active.status;
          active.approvedHours = Number(result.review.approved_hours ?? active.approvedHours);
          active.comment = result.review.comment || active.comment;
          active.applied = Boolean(result.review.applied);
        }
        setTeacherNotice(`${active.name} 的异常记录已同步到后端。`);
      } catch (error) {
        setTeacherNotice(error?.message || "审核提交失败，请稍后重试。");
        renderRoute();
        return;
      }
      renderRoute();
      return;
    }
    applyReviewDecision(active, action, active.approvedHours);
    active.status = action === "approve" ? "已通过" : action === "reject" ? "已驳回" : "补材料";
    setTeacherNotice(`${active.name} 的异常记录已处理，当前课程学时和导出检查已同步。`);
    renderRoute();
    return;
  }
});

hydrateState();
if (shouldUseTeacherShell()) {
  redirectToTeacherApp();
} else if (!state.token) {
  renderRoute();
}
