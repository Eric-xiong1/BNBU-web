import { createStore } from "./core/store.js";
import { createDemoApi, createStudentApi } from "./core/api.js";
import { demoWorkspace } from "./data/demo-data.js";
import { renderLogin } from "./views/login.js";
import { renderPlaceholder, renderShell } from "./views/shell.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { createUploadItems, releaseUpload, validateCheckin, validateProofSelection } from "./core/upload.js";
import { renderCourseDetail, renderCourses } from "./views/courses.js";
import { renderGrades } from "./views/grades.js";
import { renderNotifications, renderProfile, renderSettings } from "./views/profile.js";
import { renderEndurance, renderExemptionDetail, renderExemptionForm, renderExemptions, validateExemption, validateRunTime } from "./views/tools.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderNotificationDrawer } from "./views/notifications.js";
import { renderPrivacyPolicy } from "./views/privacy.js";
import { applyTheme, normalizeTheme } from "./core/theme.js";
import { localEnduranceScore } from "./core/endurance.js";

const ROUTES = new Set(["home", "checkin", "courses", "grades", "profile", "notifications", "endurance", "exemptions", "exemption-new", "settings", "privacy"]);

export function routeFromHash(hash = "") {
  const raw = String(hash).replace(/^#\/?/, "");
  const [name, id] = raw.split("/");
  if (name === "course" && id) return { name: "course-detail", id };
  if (name === "record" && id) return { name: "record-detail", id };
  if (name === "exemption" && id) return { name: "exemption-detail", id };
  return ROUTES.has(name) ? { name } : { name: "home" };
}

const titles = {
  home: "首页", checkin: "运动打卡", courses: "课程", "course-detail": "课程详情", grades: "成绩",
  profile: "我的", notifications: "通知", endurance: "耐力跑换算", exemptions: "免测申请",
  "exemption-new": "提交免测申请", "exemption-detail": "申请详情", settings: "设置", privacy: "隐私政策", "record-detail": "打卡详情",
};

function activeForRoute(name) {
  if (["course-detail"].includes(name)) return "courses";
  if (["notifications", "endurance", "exemptions", "exemption-new", "exemption-detail", "settings", "privacy"].includes(name)) return "profile";
  if (name === "record-detail") return "checkin";
  return name;
}

export function createInitialState() {
  const state = demoWorkspace();
  state.session = null;
  state.mode = "real";
  state.student = {};
  state.teacher = {};
  state.summary = { courseHours: 0, generalHours: 0, totalCompleted: 0, pendingCount: 0, rule: { total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2 } };
  state.courses = [];
  state.tasks = [];
  state.records = [];
  state.grades = { components: {}, sources: [] };
  state.memberships = [];
  state.notifications = [];
  state.exemptions = [];
  return state;
}

const gradeMeta = {
  freshman: ["FS", "大一"], sophomore: ["FS", "大二"], junior: ["JS", "大三"], senior: ["JS", "大四"],
  FS: ["FS", "大一/大二"], JS: ["JS", "大三/大四"],
};

export function normalizeHydration({ summary = {}, taskGroups = {}, grades = {}, identity = [], notifications = [], profile = {}, records = [], exemptions = [] } = {}) {
  const rawProfile = profile.profile || profile || {};
  const [gradeLevel, gradeLabel] = gradeMeta[rawProfile.gradeLevel] || [rawProfile.gradeLevel || "", rawProfile.gradeLabel || ""];
  const rawMemberships = identity.memberships || identity || [];
  const rawNotifications = notifications.items || notifications || [];
  const teacherInfo = summary.teachers?.[0] || {};
  return {
    summary,
    courses: (summary.courses || []).map((course) => ({
      id: course.courseId, courseCode: course.courseCode, section: course.courseSection,
      name: course.courseName, teacher: course.teacherName, semester: "当前学期", semesterStatus: "current",
      enrollmentStatus: "enrolled", requiredHours: 10, completedHours: Number(course.courseHours || 0),
    })),
    tasks: [
      ...(taskGroups.pending || []).map((item) => ({ ...item, hours: Number(item.hours || item.requiredHours || 0), status: item.status === "已完成" ? "已完成" : "待完成" })),
      ...(taskGroups.completed || []).map((item) => ({ ...item, hours: Number(item.hours || item.requiredHours || 0), status: "已完成" })),
    ],
    grades,
    memberships: rawMemberships.map((item) => ({ ...item, expiresAt: item.expiresAt || item.validUntil || "", offsetStatus: item.offsetStatus || item.offset || "待确认" })),
    notifications: rawNotifications.map((item) => ({ ...item, createdAt: item.createdAt || item.time || "" })),
    student: { ...rawProfile, gradeLevel, gradeLabel, genderLabel: rawProfile.genderLabel || (rawProfile.gender === "male" ? "男" : rawProfile.gender === "female" ? "女" : "") },
    teacher: { name: teacherInfo.teacherName || summary.courses?.[0]?.teacherName || "待公布", title: "大学体育任课教师", email: "pe@bnbu.edu.cn" },
    records: Array.isArray(records) ? records : [],
    exemptions: Array.isArray(exemptions) ? exemptions : [],
  };
}

export function mergeCheckinDraft(saved = {}, transient = {}) {
  return { ...(saved || {}), ...(transient || {}) };
}

export function createStudentApp({ root, storage = globalThis.localStorage } = {}) {
  const store = createStore({ storage, initial: createInitialState() });
  const realApi = createStudentApi({ getToken: () => store.getState().session?.token });
  const demoApi = createDemoApi({ store });
  let loginError = "";
  let loginBusy = false;
  const ui = {
    checkinTab: "submit", uploads: [], selectedTaskId: null, supplementRecordId: null, checkinError: "", checkinBusy: false,
    taskFilter: "all", recordFilter: "all", showAllSports: false,
    noticeFilter: "all", enduranceResult: null, enduranceError: "", enduranceBusy: false,
    notificationOpen: false, selectedNoticeId: null,
    exemptionUploads: [], exemptionError: "", exemptionBusy: false, supplementExemptionId: null,
    syncMessage: "", syncBusy: false, checkinDraft: null,
  };

  const api = () => store.getState().mode === "demo" ? demoApi : realApi;
  const go = (route) => { globalThis.location.hash = `#/${route}`; };

  function render() {
    if (!root) return;
    const state = store.getState();
    applyTheme(state.settings?.themeMode || "light");
    if (globalThis.document?.documentElement) globalThis.document.documentElement.dataset.reducedMotion = state.settings?.reducedMotion ? "true" : "false";
    if (!state.session) {
      root.innerHTML = renderLogin({ error: loginError, busy: loginBusy });
      return;
    }
    const route = routeFromHash(globalThis.location?.hash);
    let content;
    if (route.name === "home") {
      content = renderDashboard(state);
    } else if (route.name === "checkin") {
      const selectedTask = state.tasks.find((item) => item.id === ui.selectedTaskId) || null;
      content = renderCheckin({
        activeTab: ui.checkinTab, tasks: state.tasks, records: state.records, draft: mergeCheckinDraft(state.draft, ui.checkinDraft),
        uploads: ui.uploads, selectedTask, error: ui.checkinError, busy: ui.checkinBusy,
        dailyRemaining: state.summary?.rule?.dailyLimit || 2, taskFilter: ui.taskFilter,
        recordFilter: ui.recordFilter, showAllSports: ui.showAllSports,
      });
    } else if (route.name === "record-detail") {
      content = renderRecordDetail(state.records.find((item) => item.id === route.id));
    } else if (route.name === "courses") content = renderCourses(state.courses, state.tasks, state.records);
    else if (route.name === "course-detail") {
      const course = state.courses.find((item) => item.id === route.id);
      content = renderCourseDetail(course, state.tasks.filter((item) => item.courseId === route.id), state.records.filter((item) => item.courseId === route.id));
    } else if (route.name === "grades") content = renderGrades(state.grades);
    else if (route.name === "profile" || route.name === "notifications") content = renderProfile(state);
    else if (route.name === "endurance") content = renderEndurance({ student: state.student, result: ui.enduranceResult, error: ui.enduranceError, busy: ui.enduranceBusy });
    else if (route.name === "exemptions") content = renderExemptions(state.exemptions);
    else if (route.name === "exemption-detail") content = renderExemptionDetail(state.exemptions.find((item) => item.id === route.id));
    else if (route.name === "exemption-new") content = renderExemptionForm({ student: state.student, proofs: ui.exemptionUploads, error: ui.exemptionError, busy: ui.exemptionBusy, supplementTarget: state.exemptions.find((item) => item.id === ui.supplementExemptionId) || null });
    else if (route.name === "settings") content = renderSettings(state.settings);
    else if (route.name === "privacy") content = renderPrivacyPolicy();
    else content = renderPlaceholder(titles[route.name] || "学生端", "BNBU 学生体育服务");
    const notificationOpen = ui.notificationOpen || route.name === "notifications";
    const overlay = notificationOpen ? renderNotificationDrawer({ notices: state.notifications, filter: ui.noticeFilter, selectedId: ui.selectedNoticeId }) : "";
    root.innerHTML = renderShell({
      active: activeForRoute(route.name), title: titles[route.name], content, mode: state.mode,
      unread: state.notifications.filter((item) => item.isUnread).length, overlay,
      syncMessage: ui.syncMessage, syncBusy: ui.syncBusy,
    });
  }

  async function handleLogin(form) {
    loginBusy = true; loginError = ""; render();
    const data = new FormData(form);
    try {
      const result = await realApi.login(String(data.get("account") || ""), String(data.get("password") || ""));
      store.persistSession({ token: result.token, user: result.user }, "real");
      await hydrateReal();
      go("home");
    } catch (error) { loginError = error.message; }
    finally { loginBusy = false; render(); }
  }

  async function hydrateReal() {
    ui.syncBusy = true;
    try {
      const [summary, taskGroups, grades, identity, notifications, profile, records, exemptions] = await Promise.all([
        realApi.summary(), realApi.tasks(), realApi.grades(), realApi.identity(), realApi.notifications(), realApi.profile(), realApi.records(), realApi.listExemptions(),
      ]);
      store.patch(normalizeHydration({ summary, taskGroups, grades, identity, notifications, profile, records, exemptions }));
      ui.syncMessage = "";
    } catch (error) {
      if (error.status === 401) {
        loginError = "登录已过期，请重新登录";
        ui.syncMessage = "";
        store.clearSession();
        return;
      }
      loginError = `登录成功，但部分数据加载失败：${error.message}`;
      ui.syncMessage = `同步失败，当前展示本地可用数据：${error.message}`;
    } finally { ui.syncBusy = false; }
  }

  function checkinPayload(form) {
    const data = new FormData(form);
    const task = store.getState().tasks.find((item) => item.id === ui.selectedTaskId);
    return {
      creditType: task ? "课程相关" : "其他运动",
      courseId: task?.courseId || null,
      taskId: task?.id || null,
      hours: Number(data.get("hours")),
      sportType: String(data.get("sportType") || ""),
      customSport: String(data.get("customSport") || "").trim(),
      description: String(data.get("description") || "").trim(),
    };
  }

  function captureCheckinForm() {
    const form = root?.querySelector("#checkin-form");
    if (form) ui.checkinDraft = checkinPayload(form);
    return ui.checkinDraft;
  }

  async function submitCheckin(form) {
    const payload = checkinPayload(form);
    ui.checkinDraft = payload;
    const errors = validateCheckin({ ...payload, files: ui.uploads, dailyRemaining: store.getState().summary?.rule?.dailyLimit || 2 });
    if (errors.length) { ui.checkinError = errors.join("；"); return render(); }
    const confirmed = globalThis.confirm?.(`${payload.creditType} · ${payload.hours} 小时 · ${ui.uploads.length} 个凭证。确认提交？`) ?? true;
    if (!confirmed) return;
    ui.checkinBusy = true; ui.checkinError = "";
    ui.uploads = ui.uploads.map((item) => ({ ...item, status: "uploading", progress: 20 })); render();
    try {
      const uploaded = await api().uploadProofs(ui.uploads.map((item) => item.file));
      ui.uploads = ui.uploads.map((item, index) => ({ ...item, ...uploaded[index], status: "success", progress: 100 })); render();
      const recordPayload = { ...payload, proofFiles: uploaded.map((item) => item.url) };
      delete recordPayload.customSport;
      if (payload.sportType === "other") recordPayload.description = `${payload.customSport}：${payload.description}`;
      let result;
      if (ui.supplementRecordId) result = await api().supplementRecord(ui.supplementRecordId, recordPayload);
      else result = await api().submitRecord(recordPayload);
      if (store.getState().mode === "real") store.patch((state) => ({ records: [{ ...recordPayload, ...result }, ...state.records.filter((item) => item.id !== result.id)] }));
      ui.uploads.forEach((item) => releaseUpload(item));
      ui.uploads = []; ui.selectedTaskId = null; ui.supplementRecordId = null; ui.checkinDraft = null; ui.checkinTab = "records";
      store.clearDraft();
    } catch (error) {
      ui.checkinError = error.message;
      ui.uploads = ui.uploads.map((item) => item.status === "success" ? item : { ...item, status: "failed", progress: 0 });
    } finally { ui.checkinBusy = false; render(); }
  }

  async function submitEndurance(form) {
    const data = new FormData(form); const minutes = String(data.get("minutes") || ""), seconds = String(data.get("seconds") || "");
    const errors = validateRunTime(minutes, seconds);
    if (errors.length) { ui.enduranceError = errors.join("；"); return render(); }
    const student = store.getState().student;
    if (!student.gender || !student.gradeLevel) { ui.enduranceError = "请先在个人资料中设置性别和年级"; return render(); }
    ui.enduranceBusy = true; ui.enduranceError = ""; render();
    const input = { timeSeconds: Number(minutes) * 60 + Number(seconds), gender: student.gender, gradeLevel: student.gradeLevel };
    try { ui.enduranceResult = await api().convertEndurance(input); }
    catch (error) {
      ui.enduranceResult = localEnduranceScore(input);
      ui.enduranceError = ui.enduranceResult ? "接口暂不可用，已使用完整本地规则换算" : error.message;
    }
    finally { ui.enduranceBusy = false; render(); }
  }

  async function submitExemption(form) {
    const data = new FormData(form);
    const payload = { type: String(data.get("type") || ""), reason: String(data.get("reason") || "").trim(), proofs: ui.exemptionUploads };
    const supplementTarget = store.getState().exemptions.find((item) => item.id === ui.supplementExemptionId);
    const errors = supplementTarget ? (ui.exemptionUploads.length ? [] : ["请至少上传 1 个补充证明"]) : validateExemption(payload);
    if (!supplementTarget && store.getState().exemptions.some((item) => item.type === payload.type && item.status === "待审核")) errors.push(`已有待审核的 ${payload.type} 免测申请`);
    if (errors.length) { ui.exemptionError = errors.join("；"); return render(); }
    if (!(globalThis.confirm?.(`确认提交 ${payload.type} 免测申请？`) ?? true)) return;
    ui.exemptionBusy = true; ui.exemptionError = ""; render();
    try {
      const uploaded = ui.exemptionUploads.length ? await api().uploadProofs(ui.exemptionUploads.map((item) => item.file)) : [];
      const proofFiles = uploaded.map((item) => item.url);
      if (supplementTarget) {
        await api().supplementExemption(supplementTarget.id, { proofFiles: [...(supplementTarget.proofFiles || []), ...proofFiles] });
        if (store.getState().mode === "real") store.patch((state) => ({ exemptions: state.exemptions.map((item) => item.id === supplementTarget.id ? { ...item, proofFiles: [...(item.proofFiles || []), ...proofFiles], status: "待审核", reviewComment: "补充材料已提交，等待复审" } : item) }));
      } else {
        const result = await api().submitExemption({ type: payload.type, reason: payload.reason, proofFiles });
        if (store.getState().mode === "real") store.patch((state) => ({ exemptions: [{ ...payload, ...result, proofFiles }, ...state.exemptions] }));
      }
      ui.exemptionUploads.forEach((item) => releaseUpload(item)); ui.exemptionUploads = []; ui.supplementExemptionId = null; go("exemptions");
    } catch (error) { ui.exemptionError = error.message; }
    finally { ui.exemptionBusy = false; render(); }
  }

  root?.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) {
      captureCheckinForm();
      if (routeButton.dataset.route === "exemption-new") {
        ui.supplementExemptionId = null;
        ui.exemptionUploads.forEach((item) => releaseUpload(item));
        ui.exemptionUploads = [];
        ui.exemptionError = "";
      }
      return go(routeButton.dataset.route);
    }
    if (event.target.closest('[data-action="demo-login"]')) {
      const demo = demoWorkspace();
      store.patch(demo);
      store.persistSession(demo.session, "demo");
      go("home");
      render();
    }
    const passwordToggle = event.target.closest('[data-action="toggle-password"]');
    if (passwordToggle) {
      const input = root.querySelector('[name="password"]');
      if (!input) return;
      const revealing = input.type === "password";
      input.type = revealing ? "text" : "password";
      passwordToggle.textContent = revealing ? "隐藏" : "显示";
      passwordToggle.setAttribute("aria-label", revealing ? "隐藏密码" : "显示密码");
      passwordToggle.setAttribute("aria-pressed", String(revealing));
      return;
    }
    if (event.target.closest('[data-action="retry-sync"]')) {
      ui.syncBusy = true; render();
      await hydrateReal(); return render();
    }
    const tab = event.target.closest("[data-checkin-tab]");
    if (tab) { captureCheckinForm(); ui.checkinTab = tab.dataset.checkinTab; ui.checkinError = ""; return render(); }
    const taskFilter = event.target.closest("[data-task-filter]");
    if (taskFilter) { ui.taskFilter = taskFilter.dataset.taskFilter; return render(); }
    const recordFilter = event.target.closest("[data-record-filter]");
    if (recordFilter) { ui.recordFilter = recordFilter.dataset.recordFilter; return render(); }
    if (event.target.closest('[data-action="restore-draft"]')) { ui.checkinTab = "submit"; return render(); }
    if (event.target.closest('[data-action="toggle-sports"]')) { captureCheckinForm(); ui.showAllSports = !ui.showAllSports; return render(); }
    const sportButton = event.target.closest("[data-sport-type]");
    if (sportButton) {
      const form = root.querySelector("#checkin-form");
      const value = sportButton.dataset.sportType;
      const input = form?.querySelector('[name="sportType"]');
      if (input) input.value = value;
      form?.querySelectorAll("[data-sport-type]").forEach((button) => {
        const selected = button.dataset.sportType === value;
        button.classList.toggle("is-selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      const custom = form?.querySelector("[data-custom-sport]");
      if (custom) custom.hidden = value !== "other";
      return;
    }
    const hourButton = event.target.closest("[data-hour-step]");
    if (hourButton) {
      const form = root.querySelector("#checkin-form");
      const input = form?.querySelector('[name="hours"]');
      if (!input) return;
      const max = Number(store.getState().summary?.rule?.dailyLimit || 2);
      const next = Math.min(max, Math.max(0.5, Number(input.value || 1) + Number(hourButton.dataset.hourStep || 0)));
      input.value = String(next);
      const output = form.querySelector("[data-hour-value]");
      if (output) output.textContent = `${next} 小时`;
      return;
    }
    const taskButton = event.target.closest('[data-action="use-task"]');
    if (taskButton) { ui.selectedTaskId = taskButton.dataset.taskId; ui.checkinDraft = null; ui.checkinTab = "submit"; go("checkin"); return render(); }
    const removeButton = event.target.closest('[data-action="remove-upload"]');
    if (removeButton) {
      captureCheckinForm();
      const item = ui.uploads.find((upload) => upload.id === removeButton.dataset.uploadId);
      releaseUpload(item); ui.uploads = ui.uploads.filter((upload) => upload.id !== removeButton.dataset.uploadId); return render();
    }
    if (event.target.closest('[data-action="save-draft"]')) {
      const form = root.querySelector("#checkin-form"); if (form) { ui.checkinDraft = checkinPayload(form); store.saveDraft(ui.checkinDraft); } return;
    }
    if (event.target.closest('[data-action="clear-draft"]')) {
      ui.uploads.forEach((item) => releaseUpload(item)); ui.uploads = []; ui.selectedTaskId = null; ui.checkinDraft = null; store.clearDraft(); return;
    }
    const supplement = event.target.closest('[data-action="supplement-record"]');
    if (supplement) {
      const record = store.getState().records.find((item) => item.id === supplement.dataset.recordId);
      ui.supplementRecordId = record?.id || null; ui.checkinTab = "submit";
      store.saveDraft({ hours: record?.hours || 1, sportType: record?.sportType || "", description: record?.description || "" });
      return go("checkin");
    }
    const noticeFilter = event.target.closest("[data-notice-filter]");
    if (noticeFilter) { ui.noticeFilter = noticeFilter.dataset.noticeFilter; return render(); }
    if (event.target.closest('[data-action="open-notifications"]')) { ui.notificationOpen = true; ui.selectedNoticeId = null; return render(); }
    if (event.target.closest('[data-action="close-notifications"]')) {
      ui.notificationOpen = false; ui.selectedNoticeId = null;
      if (routeFromHash(globalThis.location?.hash).name === "notifications") return go("profile");
      return render();
    }
    const supplementExemption = event.target.closest('[data-action="supplement-exemption"]');
    if (supplementExemption) { ui.supplementExemptionId = supplementExemption.dataset.exemptionId; ui.exemptionError = ""; return go("exemption-new"); }
    const removeExemptionUpload = event.target.closest('[data-action="remove-exemption-upload"]');
    if (removeExemptionUpload) {
      const item = ui.exemptionUploads.find((upload) => upload.id === removeExemptionUpload.dataset.uploadId);
      releaseUpload(item); ui.exemptionUploads = ui.exemptionUploads.filter((upload) => upload.id !== removeExemptionUpload.dataset.uploadId); return render();
    }
    if (event.target.closest('[data-action="back-notices"]')) { ui.selectedNoticeId = null; return render(); }
    const openNotice = event.target.closest('[data-action="open-notice"]');
    if (openNotice) {
      ui.selectedNoticeId = openNotice.dataset.noticeId;
      const notice = store.getState().notifications.find((item) => item.id === ui.selectedNoticeId);
      if (notice?.isUnread) {
        await api().markNotificationRead(notice.id);
        if (store.getState().mode === "real") store.patch((state) => ({ notifications: state.notifications.map((item) => item.id === notice.id ? { ...item, isUnread: false } : item) }));
      }
      return render();
    }
    const readNotice = event.target.closest('[data-action="read-notice"]');
    if (readNotice) {
      await api().markNotificationRead(readNotice.dataset.noticeId);
      if (store.getState().mode === "real") {
        store.patch((state) => ({ notifications: state.notifications.map((item) => item.id === readNotice.dataset.noticeId ? { ...item, isUnread: false } : item) }));
      }
      return render();
    }
    if (event.target.closest('[data-action="mark-all-read"]')) {
      const unread = store.getState().notifications.filter((item) => item.isUnread);
      await Promise.all(unread.map((item) => api().markNotificationRead(item.id)));
      if (store.getState().mode === "real") store.patch((state) => ({ notifications: state.notifications.map((item) => ({ ...item, isUnread: false })) }));
      return render();
    }
    if (event.target.closest('[data-action="logout"]')) {
      try { await api().logout(); } catch { /* local logout still applies */ }
      store.clearSession(); globalThis.location.hash = ""; return render();
    }
    if (event.target.closest('[data-action="reset-demo"]')) {
      if (globalThis.confirm?.("确认重置演示数据？") ?? true) { const next = demoWorkspace(); store.reset(next); store.persistSession(next.session, "demo"); go("home"); }
    }
  });
  root?.addEventListener("submit", (event) => {
    if (event.target.id === "student-login-form") { event.preventDefault(); handleLogin(event.target); }
    if (event.target.id === "checkin-form") { event.preventDefault(); submitCheckin(event.target); }
    if (event.target.id === "endurance-form") { event.preventDefault(); submitEndurance(event.target); }
    if (event.target.id === "exemption-form") { event.preventDefault(); submitExemption(event.target); }
  });
  root?.addEventListener("change", (event) => {
    if (event.target.id !== "proof-picker") return;
    captureCheckinForm();
    const combined = [...ui.uploads.map((item) => item.file), ...event.target.files];
    const result = validateProofSelection(combined);
    if (!result.valid) { ui.checkinError = result.errors.join("；"); return render(); }
    ui.uploads = [...ui.uploads, ...createUploadItems(event.target.files)]; ui.checkinError = ""; render();
  });
  root?.addEventListener("change", (event) => {
    if (event.target.id === "exemption-proof-picker") {
      const combined = [...ui.exemptionUploads.map((item) => item.file), ...event.target.files];
      const result = validateProofSelection(combined);
      if (!result.valid) { ui.exemptionError = result.errors.join("；"); return render(); }
      ui.exemptionUploads = [...ui.exemptionUploads, ...createUploadItems(event.target.files)]; ui.exemptionError = ""; render();
    }
    if (event.target.matches('[data-setting="reducedMotion"]')) store.patch((state) => ({ settings: { ...state.settings, reducedMotion: event.target.checked } }));
    if (event.target.matches('[data-setting="themeMode"]')) {
      const themeMode = normalizeTheme(event.target.value);
      store.patch((state) => ({ settings: { ...state.settings, themeMode } }));
      applyTheme(themeMode);
    }
  });
  globalThis.addEventListener?.("keydown", (event) => {
    if (event.key === "Escape" && ui.notificationOpen) { ui.notificationOpen = false; ui.selectedNoticeId = null; render(); }
  });
  globalThis.matchMedia?.("(prefers-color-scheme: dark)")?.addEventListener?.("change", () => {
    if (store.getState().settings?.themeMode === "system") applyTheme("system");
  });
  globalThis.addEventListener?.("hashchange", render);
  store.subscribe(render);
  render();
  if (store.getState().session && store.getState().mode === "real") hydrateReal().finally(render);
  return { store, api, render, go };
}

if (typeof document !== "undefined") createStudentApp({ root: document.querySelector("#student-app") });
