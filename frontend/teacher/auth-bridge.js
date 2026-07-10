/**
 * 与 web-app 主入口共享登录态；teacher 端独立 SPA 使用 sessionStorage。
 */
(function (global) {
  const AUTH_KEY = "bnbuAuthSession";
  const LEGACY_KEY = "bnbuSportsWebStateV1";

  function readAuth() {
    try {
      const raw = global.sessionStorage.getItem(AUTH_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    try {
      const legacy = global.localStorage.getItem(LEGACY_KEY);
      if (!legacy) return null;
      const saved = JSON.parse(legacy);
      if (saved.token && saved.role === "teacher") {
        return {
          token: saved.token,
          user: saved.authUser,
          role: saved.role,
          apiBaseUrl: saved.apiBaseUrl || "",
        };
      }
    } catch {
      // ignore
    }
    return null;
  }

  function isDemo() {
    return new URLSearchParams(global.location.search).get("demo") === "1";
  }

  function requireTeacher() {
    if (isDemo()) {
      return {
        demo: true,
        role: "teacher",
        user: { id: "demo-teacher", name: "演示老师", email: "teacher@bnbu.edu.cn" },
        token: null,
        apiBaseUrl: "",
      };
    }
    const auth = readAuth();
    if (!auth || auth.role !== "teacher") {
      global.location.href = "../index.html";
      return null;
    }
    return auth;
  }

  function apiBase(auth) {
    const base = (auth?.apiBaseUrl || global.location.origin || "").replace(/\/$/, "");
    return base || global.location.origin;
  }

  async function apiFetch(path, options = {}) {
    const auth = readAuth();
    const headers = { ...(options.headers || {}) };
    if (!headers["Content-Type"] && options.body && typeof options.body === "string") {
      headers["Content-Type"] = "application/json";
    }
    if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
    const resp = await fetch(`${apiBase(auth)}${path}`, { ...options, headers });
    if (!resp.ok) {
      const text = await resp.text();
      let message = text;
      try {
        message = JSON.parse(text).message || text;
      } catch {
        // keep text
      }
      throw new Error(message || `HTTP ${resp.status}`);
    }
    if (resp.status === 204) return null;
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("application/json")) return resp.json();
    return resp.text();
  }

  function logout() {
    try {
      global.sessionStorage.removeItem(AUTH_KEY);
      global.localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    global.location.href = "../index.html";
  }

  global.AuthBridge = {
    AUTH_KEY,
    readAuth,
    isDemo,
    requireTeacher,
    apiFetch,
    logout,
  };
})(window);
