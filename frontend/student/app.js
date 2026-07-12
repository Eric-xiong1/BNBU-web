import { createStore } from "./core/store.js";
import { createDemoApi, createStudentApi } from "./core/api.js";
import { demoWorkspace } from "./data/demo-data.js";
import { renderLogin } from "./views/login.js";
import { renderPlaceholder, renderShell } from "./views/shell.js";

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
    const content = renderPlaceholder(titles[route.name] || "学生端", route.name === "checkin" ? "任务、提交和记录" : "BNBU 学生体育服务");
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
  });
  root?.addEventListener("submit", (event) => {
    if (event.target.id === "student-login-form") { event.preventDefault(); handleLogin(event.target); }
  });
  globalThis.addEventListener?.("hashchange", render);
  store.subscribe(render);
  render();
  return { store, api, render, go };
}

if (typeof document !== "undefined") createStudentApp({ root: document.querySelector("#student-app") });
