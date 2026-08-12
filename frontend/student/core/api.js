import { uid } from "./utils.js";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const uuid = () => globalThis.crypto?.randomUUID?.() || uid("request");

function messageFrom(payload, status) {
  const nested = payload?.error;
  return payload?.message
    || (typeof nested === "string" ? nested : nested?.message || nested?.code)
    || `请求失败 (${status})`;
}

function mutationHeaders(idempotencyKey = uuid()) {
  return { "X-Request-ID": uuid(), "Idempotency-Key": idempotencyKey };
}

function unwrap(payload) {
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

async function sha256(file) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function uploadObject(session, file, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(session.uploadMethod || "PUT", session.uploadUrl, true);
    Object.entries(session.requiredHeaders || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress({ loaded: event.loaded, total: event.total, percent: Math.round(event.loaded / event.total * 100) });
    };
    xhr.onerror = () => reject(new Error("凭证上传失败，请检查网络后重试"));
    xhr.onabort = () => reject(new Error("凭证上传已取消"));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(`对象存储上传失败 (${xhr.status})`));
      const etag = xhr.getResponseHeader("ETag") || xhr.getResponseHeader("etag");
      if (!etag) return reject(new Error("上传响应缺少 ETag，无法安全确认凭证"));
      resolve(etag);
    };
    xhr.send(file);
  });
}

export function createStudentApi({ baseUrl = "/api/v1", fetchImpl = globalThis.fetch, getToken = () => null } = {}) {
  async function request(path, { method = "GET", body, headers: extraHeaders = {}, timeout = 20000, raw = false } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const headers = { Accept: "application/json", "X-Request-ID": uuid(), ...extraHeaders };
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
      const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(messageFrom(payload, response.status));
        error.status = response.status;
        error.code = payload?.code || payload?.error?.code;
        error.details = payload?.details || payload?.error?.details;
        error.requestId = payload?.requestId || payload?.meta?.requestId || response.headers?.get?.("X-Request-ID") || "";
        throw error;
      }
      return raw ? payload : unwrap(payload);
    } catch (error) {
      if (error?.name === "AbortError") throw new Error("请求超时，请检查网络后重试");
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function listAll(path, query = {}) {
    const items = [];
    let cursor = null;
    do {
      const params = new URLSearchParams();
      params.set("limit", "100");
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
      });
      if (cursor) params.set("cursor", cursor);
      const payload = await request(`${path}?${params}`, { raw: true });
      items.push(...(Array.isArray(payload.data) ? payload.data : []));
      cursor = payload.meta?.hasMore ? payload.meta?.nextCursor : null;
    } while (cursor);
    return items;
  }

  async function workspace() {
    const currentUser = await request("/me");
    const studentId = currentUser?.studentProfile?.id;
    const enrollments = await listAll("/enrollments", { studentId });
    const classSectionIds = [...new Set(enrollments.map((item) => item.classSectionId).filter(Boolean))];
    const sections = await Promise.all(classSectionIds.map((id) => request(`/class-sections/${encodeURIComponent(id)}`)));
    const courseIds = [...new Set(sections.map((item) => item.courseId).filter(Boolean))];
    const courses = await Promise.all(courseIds.map((id) => request(`/courses/${encodeURIComponent(id)}`)));
    const [records, scores, notifications, exemptions, preferences, helpArticles, feedback] = await Promise.all([
      listAll("/exercise-records", { sort: "-businessDate" }),
      listAll("/student-scores"),
      listAll("/notifications"),
      listAll("/exemption-applications"),
      request("/me/preferences"),
      request("/help-articles?locale=zh-CN"),
      listAll("/feedback"),
    ]);
    const releasePolicy = await request("/app-release-policy?platform=WEB").catch(() => null);
    return { currentUser, enrollments, sections, courses, records, scores, notifications, exemptions, preferences, helpArticles, feedback, releasePolicy };
  }

  const api = {
    health: () => request("/health"),
    requestSignInCode: (organizationCode, account, locale = "zh-CN") => request("/auth/student-sign-in-codes", {
      method: "POST", headers: mutationHeaders(), body: { organizationCode, account, channel: "EMAIL", locale },
    }),
    verifySignInCode: (challengeId, code, deviceId) => request("/auth/student-sign-in-codes/verify", {
      method: "POST", headers: mutationHeaders(), body: { challengeId, code, deviceId },
    }),
    me: () => request("/me"),
    workspace,
    logout: (refreshToken) => request("/auth/logout", { method: "POST", headers: mutationHeaders(), body: { refreshToken } }),
    requestEmailChallenge: (email, expectedVersion, locale = "zh-CN") => request("/me/email-verification-challenges", {
      method: "POST", headers: mutationHeaders(), body: { email, locale, expectedVersion },
    }),
    verifyEmailChallenge: (challengeId, newEmailCode, currentEmailCode) => request(`/me/email-verification-challenges/${encodeURIComponent(challengeId)}/verify`, {
      method: "POST", headers: mutationHeaders(), body: { newEmailCode, ...(currentEmailCode ? { currentEmailCode } : {}) },
    }),
    previewInvite: (token) => request(`/course-invites/${encodeURIComponent(token)}/preview`),
    issueJoinCapability: (token, profile) => request(`/course-invites/${encodeURIComponent(token)}/join-capabilities`, {
      method: "POST", headers: mutationHeaders(), body: profile,
    }),
    joinCourse: (token, capability) => request(`/course-invites/${encodeURIComponent(token)}/join`, {
      method: "POST", headers: { ...mutationHeaders(), "X-Join-Capability": capability },
    }),
    markNotificationRead: (id) => request(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: mutationHeaders() }),
    preferences: () => request("/me/preferences"),
    updatePreferences: (payload) => request("/me/preferences", { method: "PATCH", headers: mutationHeaders(), body: payload }),
    helpArticles: (locale = "zh-CN") => request(`/help-articles?locale=${encodeURIComponent(locale)}`),
    feedback: () => listAll("/feedback"),
    createFeedback: (category, content) => request("/feedback", { method: "POST", headers: mutationHeaders(), body: { category, content, clientContext: { platform: "WEB", appVersion: "student-web", osVersion: navigator.userAgent?.slice(0, 64) || "Web" } } }),
    releasePolicy: () => request("/app-release-policy?platform=WEB"),
    startExerciseSession: (enrollmentId, retryKey) => request("/exercise-sessions", {
      method: "POST", headers: mutationHeaders(retryKey), body: { enrollmentId, clientObservedAt: new Date().toISOString() },
    }),
    activeExerciseSession: (enrollmentId) => request(`/exercise-sessions/active${enrollmentId ? `?enrollmentId=${encodeURIComponent(enrollmentId)}` : ""}`),
    getExerciseSession: (id) => request(`/exercise-sessions/${encodeURIComponent(id)}`),
    controlExerciseSession: (id, action, expectedVersion) => request(`/exercise-sessions/${encodeURIComponent(id)}/${action}`, {
      method: "POST", headers: mutationHeaders(), body: { expectedVersion, clientObservedAt: new Date().toISOString() },
    }),
    cancelExerciseSession: (id, expectedVersion, reason) => request(`/exercise-sessions/${encodeURIComponent(id)}/cancel`, {
      method: "POST", headers: mutationHeaders(), body: { expectedVersion, reason },
    }),
    createExerciseRecord: (payload, retryKey) => request("/exercise-records", { method: "POST", headers: mutationHeaders(retryKey), body: payload }),
    updateExerciseRecord: (id, payload) => request(`/exercise-records/${encodeURIComponent(id)}`, { method: "PATCH", headers: mutationHeaders(), body: payload }),
    submitExerciseRecord: (id, mediaIds, expectedVersion, retryKey) => request(`/exercise-records/${encodeURIComponent(id)}/submit`, {
      method: "POST", headers: mutationHeaders(retryKey), body: { mediaIds: [...mediaIds], expectedVersion },
    }),
    records: () => listAll("/exercise-records", { sort: "-businessDate" }),
    recordDetail: (id) => request(`/exercise-records/${encodeURIComponent(id)}`),
    getMedia: (id) => request(`/media/${encodeURIComponent(id)}`),
    async uploadExerciseMedia(sessionId, item, onProgress = () => {}) {
      const file = item.file || item;
      const mediaType = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      const declaration = {
        sessionId,
        businessPurpose: "EXERCISE_RECORD",
        mediaType,
        mimeType: file.type,
        fileSizeBytes: file.size,
        captureSource: "IN_APP_CAMERA",
        declaredContentSha256: await sha256(file),
        durationSeconds: mediaType === "VIDEO" ? Math.max(1, Math.ceil(item.durationSeconds || 0)) : null,
      };
      let lastError;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const session = await request("/media-uploads", { method: "POST", headers: mutationHeaders(), body: declaration });
          if (Date.parse(session.expiresAt) <= Date.now()) throw new Error("上传会话已过期，正在安全重试");
          const etag = await uploadObject(session, file, onProgress);
          let evidence = await request(`/media-uploads/${encodeURIComponent(session.uploadSessionId)}/confirm`, {
            method: "POST", headers: mutationHeaders(), body: { etag },
          });
          evidence = await request(`/media/${encodeURIComponent(evidence.id)}/bind`, {
            method: "POST", headers: mutationHeaders(), body: { sessionId, expectedVersion: evidence.version },
          });
          for (let poll = 0; poll < 20 && evidence.uploadStatus !== "AVAILABLE"; poll += 1) {
            if (["FAILED", "DELETED"].includes(evidence.uploadStatus)) throw new Error("Backend 未通过凭证真实性校验");
            await wait(1000);
            evidence = await request(`/media/${encodeURIComponent(evidence.id)}`);
          }
          if (evidence.uploadStatus !== "AVAILABLE") throw new Error("凭证仍在处理中，请稍后重试提交");
          return evidence;
        } catch (error) {
          lastError = error;
          if (attempt > 0 || ![409, 410].includes(error?.status) && !/过期/.test(error?.message || "")) throw error;
        }
      }
      throw lastError;
    },
    async uploadExemptionMedia(enrollmentId, item, onProgress = () => {}) {
      const file = item.file || item;
      const session = await request("/media-uploads", { method: "POST", headers: mutationHeaders(), body: {
        enrollmentId, businessPurpose: "EXEMPTION_APPLICATION", mediaType: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
        mimeType: file.type, fileSizeBytes: file.size, captureSource: "FILE_PICKER",
        ...(file.type.startsWith("video/") ? { durationSeconds: Math.max(1, Math.ceil(item.durationSeconds || 0)) } : {}),
      } });
      if (Date.parse(session.expiresAt) <= Date.now()) throw new Error("上传会话已过期，请重试");
      const etag = await uploadObject(session, file, onProgress);
      return request(`/media-uploads/${encodeURIComponent(session.uploadSessionId)}/confirm`, { method: "POST", headers: mutationHeaders(), body: { etag } });
    },
    createExemption: (payload) => request("/exemption-applications", { method: "POST", headers: mutationHeaders(), body: payload }),
    updateExemption: (id, payload) => request(`/exemption-applications/${encodeURIComponent(id)}`, { method: "PATCH", headers: mutationHeaders(), body: payload }),
    submitExemption: (id, expectedVersion) => request(`/exemption-applications/${encodeURIComponent(id)}/submit`, { method: "POST", headers: mutationHeaders(), body: { expectedVersion } }),
    listExemptions: () => listAll("/exemption-applications"),
    profile: () => request("/me"),
  };
  return api;
}

export function createDemoApi({ store }) {
  return {
    async health() { return { ok: false, demo: true }; },
    async requestSignInCode() { return { challengeId: "demo-challenge", expiresAt: new Date(Date.now() + 300000).toISOString() }; },
    async verifySignInCode() { return { accessToken: "demo-token-student", refreshToken: "demo-refresh", user: store.getState().student }; },
    async me() { return { user: store.getState().student, studentProfile: store.getState().student }; },
    async logout() { return { ok: true }; },
    async summary() { return store.getState().summary; },
    async tasks() { return { pending: store.getState().tasks.filter((item) => item.status !== "已完成"), completed: store.getState().tasks.filter((item) => item.status === "已完成") }; },
    async courseDetail(id) { return store.getState().courses.find((item) => item.id === id); },
    async grades() { return store.getState().grades; },
    async identity() { return { memberships: store.getState().memberships }; },
    async notifications() { return store.getState().notifications; },
    async markNotificationRead(id) {
      store.patch((state) => ({ notifications: state.notifications.map((item) => item.id === id ? { ...item, isUnread: false } : item) }));
      return { ok: true };
    },
    async uploadProofs(files) { return files.map((file) => ({ url: URL.createObjectURL(file), mediaType: file.type.startsWith("video/") ? "video" : "image", mimeType: file.type, size: file.size })); },
    async submitRecord(payload) {
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
