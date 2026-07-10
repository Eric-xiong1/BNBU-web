const http = require("http");

const port = Number(process.env.PORT || 8080);
const host = "127.0.0.1";
const allowedOrigins = new Set((process.env.CORS_ORIGINS || "http://127.0.0.1:4174,http://localhost:4174").split(",").map((item) => item.trim()).filter(Boolean));
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 6000);
const rateBuckets = new Map();

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
    deadline: "第 8 周周五 18:00",
  },
];

const students = [
  {
    id: "22301142",
    name: "陈雨晴",
    college: "工商管理学院",
    className: "2026A",
    course: 6,
    general: 10,
    rawGeneral: 10,
    exam: 86,
    attendance: 90,
    physical: 78,
    status: "差课程 4h",
    source: "seed",
    organizationCredit: null,
  },
  {
    id: "22301205",
    name: "黄嘉仪",
    college: "人文社科学院",
    className: "2026C",
    course: 10,
    general: 10,
    rawGeneral: 10,
    exam: 91,
    attendance: 96,
    physical: 88,
    status: "已完成",
    source: "seed",
    organizationCredit: null,
  },
];

function corsOrigin(request) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) return origin;
  return "http://127.0.0.1:4174";
}

function securityHeaders(request) {
  return {
    "Access-Control-Allow-Origin": corsOrigin(request),
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-BNBU-Web-Client",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": "no-store",
  };
}

function sendJson(request, response, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data, null, 2);
  response.writeHead(status, {
    ...securityHeaders(request),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  response.end(body);
}

function rateLimitExceeded(request, response) {
  const key = request.socket.remoteAddress || "local";
  const now = Date.now();
  const current = rateBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + rateLimitWindowMs };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count <= rateLimitMax) return false;

  sendJson(
    request,
    response,
    429,
    {
      code: "RATE_LIMITED",
      message: "Too many requests",
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    },
    {
      "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)),
    },
  );
  return true;
}

function notFound(request, response) {
  sendJson(request, response, 404, {
    code: "RESOURCE_NOT_FOUND",
    message: "Mock endpoint not implemented",
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "OPTIONS") {
    sendJson(request, response, 200, { ok: true });
    return;
  }

  if (rateLimitExceeded(request, response)) return;

  if (url.pathname === "/api/health") {
    sendJson(request, response, 200, {
      ok: true,
      service: "BNBU Sports Grade Mock API",
      time: new Date().toISOString(),
      security: {
        cors: Array.from(allowedOrigins),
        rateLimit: `${rateLimitMax}/${Math.round(rateLimitWindowMs / 1000)}s`,
      },
    });
    return;
  }

  if (url.pathname === "/api/auth/me") {
    sendJson(request, response, 200, {
      user: {
        id: "u1",
        name: "王老师",
        email: "teacher@bnbu.edu.cn",
        role: "体育任课老师",
        scope: "GEPE101 / Section 1004",
        status: "正常",
      },
      routes: ["teacher-dashboard", "teacher-courses", "teacher-import", "teacher-grades"],
    });
    return;
  }

  if (url.pathname === "/api/teacher/courses") {
    sendJson(request, response, 200, courses);
    return;
  }

  if (url.pathname === "/api/teacher/courses/gepe/students") {
    sendJson(request, response, 200, students);
    return;
  }

  if (url.pathname === "/api/teacher/courses/gepe/export/precheck") {
    sendJson(request, response, 200, {
      missingPhysical: [],
      checkinNotEnough: [students[0]],
      unresolvedReviews: [],
      templateMatched: true,
    });
    return;
  }

  notFound(request, response);
});

server.requestTimeout = 10000;
server.headersTimeout = 12000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 64;

server.listen(port, host, () => {
  console.log(`BNBU mock API listening at http://${host}:${port}/api/health`);
});
