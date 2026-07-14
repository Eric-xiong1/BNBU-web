import { uid } from "./utils.js";
import { localEnduranceScore } from "./endurance.js";

function messageFrom(payload, status) {
  return payload?.message || payload?.error || `请求失败 (${status})`;
}

export function createStudentApi({ baseUrl = "/api", fetchImpl = globalThis.fetch, getToken = () => null } = {}) {
  async function request(path, { method = "GET", body, timeout = 20000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const headers = { Accept: "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers,
        body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = typeof response.json === "function" ? await response.json() : {};
      if (!response.ok) {
        const error = new Error(messageFrom(payload, response.status));
        error.status = response.status;
        error.code = payload?.code;
        throw error;
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("请求超时，请检查网络后重试");
      throw error;
    } finally { clearTimeout(timer); }
  }

  return {
    health: () => request("/health"),
    async login(account, password) {
      const result = await request("/auth/login", { method: "POST", body: { account, password, role: "student", clientType: "web" } });
      if (result.user?.role !== "student") throw new Error("仅限学生账号登录");
      return result;
    },
    me: () => request("/auth/me"),
    logout: () => request("/auth/logout", { method: "POST" }),
    summary: () => request("/sport/summary"),
    tasks: () => request("/student/tasks"),
    courseDetail: (id) => request(`/student/courses/${encodeURIComponent(id)}`),
    grades: () => request("/student/grades"),
    identity: () => request("/sport/identity"),
    notifications: () => request("/common/notifications"),
    markNotificationRead: (id) => request(`/common/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" }),
    async uploadProofs(files) {
      const form = new FormData();
      files.forEach((file) => form.append("files", file, file.name || "proof"));
      const result = await request("/upload/proof", { method: "POST", body: form, timeout: 5 * 60 * 1000 });
      if (Array.isArray(result.files)) return result.files;
      return (result.urls || []).map((url, index) => ({
        url,
        mediaType: files[index]?.type?.startsWith("video/") ? "video" : "image",
        mimeType: files[index]?.type || "",
        size: files[index]?.size || 0,
      }));
    },
    submitRecord: (payload) => request("/sport/records", { method: "POST", body: payload }),
    records: () => request("/sport/records"),
    recordDetail: (id) => request(`/sport/records/${encodeURIComponent(id)}`),
    supplementRecord: (id, payload) => request(`/sport/records/${encodeURIComponent(id)}/supplements`, { method: "POST", body: payload }),
    convertEndurance: (payload) => request("/scoring/convert-endurance", { method: "POST", body: payload }),
    listExemptions: () => request("/student/exemptions"),
    submitExemption: (payload) => request("/student/exemptions", { method: "POST", body: payload }),
    supplementExemption: (id, payload) => request(`/student/exemptions/${encodeURIComponent(id)}/supplement`, { method: "PUT", body: payload }),
    profile: () => request("/student/profile"),
  };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createDemoApi({ store }) {
  return {
    async health() { return { ok: false, demo: true }; },
    async login() { await wait(180); return { token: "demo-token-student", user: store.getState().student }; },
    async me() { return { user: store.getState().student }; },
    async logout() { return { ok: true }; },
    async summary() { return store.getState().summary; },
    async tasks() {
      const tasks = store.getState().tasks;
      return { pending: tasks.filter((item) => item.status !== "已完成"), completed: tasks.filter((item) => item.status === "已完成") };
    },
    async courseDetail(id) {
      const state = store.getState();
      const course = state.courses.find((item) => item.id === id);
      if (!course) throw new Error("课程不存在");
      return { ...course, tasks: state.tasks.filter((item) => item.courseId === id), records: state.records.filter((item) => item.courseId === id) };
    },
    async grades() { return store.getState().grades; },
    async identity() { return { memberships: store.getState().memberships }; },
    async notifications() { return store.getState().notifications; },
    async markNotificationRead(id) {
      store.patch((state) => ({ notifications: state.notifications.map((item) => item.id === id ? { ...item, isUnread: false } : item) }));
      return { ok: true };
    },
    async uploadProofs(files) {
      await wait(350);
      return files.map((file) => ({ url: `/uploads/demo-${uid("proof")}.${file.type.startsWith("video/") ? "mp4" : "jpg"}`, mediaType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, size: file.size }));
    },
    async submitRecord(payload) {
      await wait(250);
      const record = { id: uid("sr"), ...payload, status: "待审核", reviewComment: "", submittedAt: new Date().toISOString() };
      store.patch((state) => ({ records: [record, ...state.records] }));
      return record;
    },
    async records() { return store.getState().records; },
    async recordDetail(id) { return store.getState().records.find((item) => item.id === id) || null; },
    async supplementRecord(id, payload) {
      store.patch((state) => ({ records: state.records.map((item) => item.id === id ? { ...item, ...payload, status: "待审核", reviewComment: "补充材料已提交，等待复审" } : item) }));
      return { id, status: "待审核" };
    },
    async convertEndurance({ timeSeconds, gender, gradeLevel }) {
      return localEnduranceScore({ timeSeconds, gender, gradeLevel });
    },
    async listExemptions() { return store.getState().exemptions; },
    async submitExemption(payload) {
      const item = { id: uid("ex"), ...payload, status: "待审核", reviewComment: "", createdAt: new Date().toISOString() };
      store.patch((state) => ({ exemptions: [item, ...state.exemptions] }));
      return item;
    },
    async supplementExemption(id, payload) {
      store.patch((state) => ({ exemptions: state.exemptions.map((item) => item.id === id ? { ...item, ...payload, status: "待审核", reviewComment: "补充材料已提交，等待复审" } : item) }));
      return { id, status: "待审核" };
    },
    async profile() { return store.getState().student; },
  };
}
