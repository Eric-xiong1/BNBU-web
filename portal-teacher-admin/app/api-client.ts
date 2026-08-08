// Shared API client for the unified BNBU Sports backend (Contract 1.4, /api/v1).
// Teacher and admin workspaces both build on this module; keep it UI-free.
//
// Contract rules baked in here so pages never re-implement them:
//   - success envelope {data, meta}; error envelope {code, message, details, requestId, timestamp}
//   - Authorization: Bearer <accessToken>; automatic refresh once on 401
//   - every write carries an Idempotency-Key header
//   - SYSTEM_MODE_UNSUPPORTED means "feature not yet opened", never a bug

const STORAGE_KEY = "bnbu-portal-tokens-v1";
const BASE_KEY = "bnbu-portal-api-base";
const DEFAULT_BASE = "http://127.0.0.1:3000/api/v1";

export type ApiRole = "STUDENT" | "TEACHER" | "ADMIN";

export interface ApiUser {
  id: string;
  role: ApiRole;
  status: string;
  primaryEmail?: string | null;
  [key: string]: unknown;
}

export interface AuthSessionData {
  sessionId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  user: ApiUser;
}

export interface CurrentUserData {
  user: ApiUser;
  studentProfile: Record<string, unknown> | null;
  teacherProfile: Record<string, unknown> | null;
  adminProfile: Record<string, unknown> | null;
}

export type ApiPaginationMeta = {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
};

export type ApiSuccessMeta = {
  requestId?: string;
  pagination?: ApiPaginationMeta;
  [key: string]: unknown;
};

export type ApiSuccessEnvelope<T> = {
  data: T;
  meta: ApiSuccessMeta;
};

type StoredTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  userId: string | null;
  role: ApiRole | null;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown>;
  requestId: string | null;

  constructor(status: number, body: { code?: string; message?: string; details?: Record<string, unknown>; requestId?: string } | null) {
    super(body?.message || `HTTP ${status}`);
    this.status = status;
    this.code = body?.code || "UNKNOWN";
    this.details = body?.details || {};
    this.requestId = body?.requestId || null;
  }
}

export const isUnsupported = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "SYSTEM_MODE_UNSUPPORTED";

/** Human-readable Chinese message for any thrown error. */
export function apiErrorText(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "网络连接失败，请确认本机后端已启动（start-dev.ps1）。";
  }
  if (isUnsupported(error)) return "该功能后端暂未开放。";
  const known: Record<string, string> = {
    VALIDATION_FAILED: "提交的内容格式不正确，请检查后重试。",
    AUTH_CREDENTIAL_INVALID: "账号或密码不正确。",
    AUTH_REQUIRED: "请先登录后再继续操作。",
    AUTH_TOKEN_INVALID: "登录凭证无效，请重新登录。",
    AUTH_TOKEN_EXPIRED: "登录状态已过期，请重新登录。",
    AUTH_SESSION_REVOKED: "当前登录会话已失效，请重新登录。",
    AUTH_RATE_LIMITED: "操作过于频繁，请稍后再试。",
    PERMISSION_DENIED: "没有权限执行该操作。",
    PERMISSION_RESOURCE_NOT_FOUND: "资源不存在或无权访问。",
    USER_NOT_FOUND: "用户不存在或已被移除。",
    COURSE_NOT_FOUND: "课程不存在或已被移除。",
    CONFLICT_VERSION_MISMATCH: "数据已在别处更新，请刷新后重试。",
    // Contract 1.4 documents the full 503 SystemMode family.
    SYSTEM_READ_ONLY: "系统当前为只读模式，暂时无法保存修改。",
    SYSTEM_MAINTENANCE: "系统正在维护中，请稍后再试。",
    SYSTEM_SERVICE_UNAVAILABLE: "依赖服务暂时不可用，请稍后再试。",
    SYSTEM_DEPENDENCY_TIMEOUT: "依赖服务响应超时，请稍后再试。",
  };
  return known[error.code] || error.message;
}

function readTokens(): StoredTokens | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens | null) {
  try {
    if (tokens) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable — session-only */
  }
}

export function apiBaseUrl(): string {
  try {
    return (window.localStorage.getItem(BASE_KEY) || DEFAULT_BASE).replace(/\/$/, "");
  } catch {
    return DEFAULT_BASE;
  }
}

export const hasApiSession = (): boolean => readTokens() !== null;
export const apiSessionRole = (): ApiRole | null => readTokens()?.role ?? null;
export function clearApiSession() {
  writeTokens(null);
}

export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

function storeAuthSession(session: AuthSessionData) {
  writeTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    accessTokenExpiresAt: session.accessTokenExpiresAt,
    userId: session.user?.id ?? null,
    role: session.user?.role ?? null,
  });
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
};

async function rawEnvelopeRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccessEnvelope<T>> {
  const { method = "GET", body, auth = true, headers = {} } = options;
  const requestHeaders: Record<string, string> = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (method !== "GET" && !requestHeaders["Idempotency-Key"]) requestHeaders["Idempotency-Key"] = uuid();
  const tokens = readTokens();
  if (auth && tokens?.accessToken) requestHeaders["Authorization"] = `Bearer ${tokens.accessToken}`;
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let parsed: { data?: T; meta?: ApiSuccessMeta; code?: string; message?: string; details?: Record<string, unknown>; requestId?: string } | null = null;
  try {
    parsed = await response.json();
  } catch {
    /* empty body */
  }
  if (!response.ok) throw new ApiError(response.status, parsed);
  return { data: parsed?.data as T, meta: parsed?.meta ?? {} };
}

async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return (await rawEnvelopeRequest<T>(path, options)).data;
}

let refreshInFlight: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  const tokens = readTokens();
  if (!tokens?.refreshToken) throw new ApiError(401, { code: "AUTH_REQUIRED", message: "no refresh token" });
  const session = await rawRequest<AuthSessionData>("/auth/refresh", {
    method: "POST",
    auth: false,
    body: { refreshToken: tokens.refreshToken },
  });
  storeAuthSession(session);
}

/**
 * The one entry point pages should use.
 *   request<Course[]>("/courses")
 *   request<ClassSection>("/class-sections", { method: "POST", body: {...} })
 * Handles the envelope, bearer token, idempotency key, and a single automatic
 * refresh-and-retry when the access token expired.
 */
async function requestWithRefresh<T>(operation: () => Promise<T>, options: RequestOptions): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const canRefresh = options.auth !== false && readTokens() !== null;
    if (error instanceof ApiError && error.status === 401 && canRefresh) {
      if (!refreshInFlight) {
        refreshInFlight = refreshSession().finally(() => {
          refreshInFlight = null;
        });
      }
      try {
        await refreshInFlight;
      } catch (refreshError) {
        clearApiSession();
        throw refreshError;
      }
      return operation();
    }
    throw error;
  }
}

export function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return requestWithRefresh(() => rawRequest<T>(path, options), options);
}

/** Use for cursor-paginated endpoints that need success-envelope metadata. */
export function requestWithMeta<T>(path: string, options: RequestOptions = {}): Promise<ApiSuccessEnvelope<T>> {
  return requestWithRefresh(() => rawEnvelopeRequest<T>(path, options), options);
}

// ── Auth ─────────────────────────────────────────────────────────
export async function passwordLogin(account: string, password: string): Promise<AuthSessionData> {
  const session = await rawRequest<AuthSessionData>("/auth/password-login", {
    method: "POST",
    auth: false,
    body: { account, password },
  });
  storeAuthSession(session);
  return session;
}

export async function logoutApi(): Promise<void> {
  const refreshToken = readTokens()?.refreshToken;
  try {
    if (refreshToken) {
      await request<null>("/auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    }
  } catch {
    /* best effort */
  }
  clearApiSession();
}

export const getMe = () => request<CurrentUserData>("/me");
