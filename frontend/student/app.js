import { createStore } from "./core/store.js";
import { createDemoApi, createStudentApi } from "./core/api.js";
import { demoWorkspace } from "./data/demo-data.js";
import { renderLogin } from "./views/login.js";
import { renderPlaceholder, renderShell } from "./views/shell.js";
import { renderCheckin, renderRecordDetail } from "./views/checkin.js";
import { createUploadItems, releaseUpload, validateCheckin, validateProofSelection } from "./core/upload.js";

const ROUTES = new Set(["checkin", "home", "courses", "grades", "profile", "notifications", "endurance", "exemptions", "exemption-new", "settings"]);

export function routeFromHash(hash = "") {
  const raw = String(hash).replace(/^#\/?/, "");
  const [name, id] = raw.split("/");
  if (name === "course" && id) return { name: "course-detail", id };
  if (name === "record" && id) return { name: "record-detail", id };
  return ROUTES.has(name) ? { name } : { name: "checkin" };
}

const titles = {
  checkin: "运动打卡", home: "首页", courses: "课程", "course-detail": "课程详情", grades: "成绩",
  profile: "我的", notifications: "通知", endurance: "耐力跑换算", exemptions: "免测申请",
  "exemption-new": "提交免测申请", settings: "设置", "record-detail": "打卡详情",
};

function activeForRoute(name) {
  if (["course-detail"].includes(name)) return "courses";
  if (["notifications", "endurance", "exemptions", "exemption-new", "settings"].includes(name)) return "profile";
  if (name === "record-detail") return "checkin";
  return name;
}

function initialState() {
  const state = demoWorkspace();
  state.session = null;
  state.mode = "real";
  return state;
}

export function createStudentApp({ root, storage = globalThis.localStorage } = {}) {
  const store = createStore({ storage, initial: initialState() });
  const realApi = createStudentApi({ getToken: () => store.getState().session?.token });
  const demoApi = createDemoApi({ store });
  let loginError = "";
  let loginBusy = false;
  const ui = { checkinTab: "submit", uploads: [], selectedTaskId: null, supplementRecordId: null, checkinError: "", checkinBusy: false };

  const api = () => store.getState().mode === "demo" ? demoApi : realApi;
  const go = (route) => { globalThis.location.hash = `#/${route}`; };

  function render() {
    if (!root) return;
    const state = store.getState();
    if (!state.session) {
      root.innerHTML = renderLogin({ error: loginError, busy: loginBusy });
      return;
    }
    const route = routeFromHash(globalThis.location?.hash);
    let content;
    if (route.name === "checkin") {
      const selectedTask = state.tasks.find((item) => item.id === ui.selectedTaskId) || null;
      content = renderCheckin({
        activeTab: ui.checkinTab, tasks: state.tasks, records: state.records, draft: state.draft || {},
        uploads: ui.uploads, selectedTask, error: ui.checkinError, busy: ui.checkinBusy,
        dailyRemaining: state.summary?.rule?.dailyLimit || 2,
      });
    } else if (route.name === "record-detail") {
      content = renderRecordDetail(state.records.find((item) => item.id === route.id));
    } else content = renderPlaceholder(titles[route.name] || "学生端", "BNBU 学生体育服务");
    root.innerHTML = renderShell({
      active: activeForRoute(route.name), title: titles[route.name], content, mode: state.mode,
      unread: state.notifications.filter((item) => item.isUnread).length,
    });
  }

  async function handleLogin(form) {
    loginBusy = true; loginError = ""; render();
    const data = new FormData(form);
    try {
      const result = await realApi.login(String(data.get("account") || ""), String(data.get("password") || ""));
      store.persistSession({ token: result.token, user: result.user }, "real");
      go("checkin");
    } catch (error) { loginError = error.message; }
    finally { loginBusy = false; render(); }
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

  async function submitCheckin(form) {
    const payload = checkinPayload(form);
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
      ui.uploads = []; ui.selectedTaskId = null; ui.supplementRecordId = null; ui.checkinTab = "records";
      store.clearDraft();
    } catch (error) {
      ui.checkinError = error.message;
      ui.uploads = ui.uploads.map((item) => item.status === "success" ? item : { ...item, status: "failed", progress: 0 });
    } finally { ui.checkinBusy = false; render(); }
  }

  root?.addEventListener("click", async (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton) return go(routeButton.dataset.route);
    if (event.target.closest('[data-action="demo-login"]')) {
      const demo = demoWorkspace();
      store.patch(demo);
      store.persistSession(demo.session, "demo");
      go("checkin");
      render();
    }
    const tab = event.target.closest("[data-checkin-tab]");
    if (tab) { ui.checkinTab = tab.dataset.checkinTab; ui.checkinError = ""; return render(); }
    const taskButton = event.target.closest('[data-action="use-task"]');
    if (taskButton) { ui.selectedTaskId = taskButton.dataset.taskId; ui.checkinTab = "submit"; return render(); }
    const removeButton = event.target.closest('[data-action="remove-upload"]');
    if (removeButton) {
      const item = ui.uploads.find((upload) => upload.id === removeButton.dataset.uploadId);
      releaseUpload(item); ui.uploads = ui.uploads.filter((upload) => upload.id !== removeButton.dataset.uploadId); return render();
    }
    if (event.target.closest('[data-action="save-draft"]')) {
      const form = root.querySelector("#checkin-form"); if (form) store.saveDraft(checkinPayload(form)); return;
    }
    if (event.target.closest('[data-action="clear-draft"]')) {
      ui.uploads.forEach((item) => releaseUpload(item)); ui.uploads = []; ui.selectedTaskId = null; store.clearDraft(); return;
    }
    const supplement = event.target.closest('[data-action="supplement-record"]');
    if (supplement) {
      const record = store.getState().records.find((item) => item.id === supplement.dataset.recordId);
      ui.supplementRecordId = record?.id || null; ui.checkinTab = "submit";
      store.saveDraft({ hours: record?.hours || 1, sportType: record?.sportType || "", description: record?.description || "" });
      return go("checkin");
    }
  });
  root?.addEventListener("submit", (event) => {
    if (event.target.id === "student-login-form") { event.preventDefault(); handleLogin(event.target); }
    if (event.target.id === "checkin-form") { event.preventDefault(); submitCheckin(event.target); }
  });
  root?.addEventListener("change", (event) => {
    if (event.target.id !== "proof-picker") return;
    const combined = [...ui.uploads.map((item) => item.file), ...event.target.files];
    const result = validateProofSelection(combined);
    if (!result.valid) { ui.checkinError = result.errors.join("；"); return render(); }
    ui.uploads = [...ui.uploads, ...createUploadItems(event.target.files)]; ui.checkinError = ""; render();
  });
  globalThis.addEventListener?.("hashchange", render);
  store.subscribe(render);
  render();
  return { store, api, render, go };
}

if (typeof document !== "undefined") createStudentApp({ root: document.querySelector("#student-app") });
