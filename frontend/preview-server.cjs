const fs = require("fs");
const http = require("http");
const path = require("path");

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4174);
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mjs": "text/javascript; charset=utf-8",
  ".ico": "image/x-icon",
};

const securityHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' http://127.0.0.1:8080 http://localhost:8080 https:; form-action 'self'; worker-src 'none'",
};

function send(response, status, body, headers = {}) {
  response.writeHead(status, { ...securityHeaders, ...headers });
  response.end(body);
}

function resolveFile(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${port}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (pathname.includes("\0")) return null;
  const relativePath = pathname === "/" ? "index.html" : `.${pathname}`;
  const filePath = path.resolve(root, relativePath);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) return null;
  return filePath;
}

// Same-origin proxies so the preview page can reach the local unified backend
// (`/api/*` → NestJS :3000) and its private object storage (`/minio/*` →
// MinIO :9000, keeping the presigned-URL Host intact). This sidesteps
// browser sandboxes/CORS: the page only ever talks to its own origin.
const proxyTargets = [
  { prefix: "/api/", host: "127.0.0.1", port: Number(process.env.API_PORT || 3000), strip: "" },
  { prefix: "/minio/", host: "127.0.0.1", port: Number(process.env.MINIO_PORT || 9000), strip: "/minio" },
];

// Local-only demo sign-in support. The demo student is an ordinary backend
// account, but an enrolled student cannot re-join, so its session is renewed
// through the refresh token instead. Rotation means the new token must be
// persisted on every use — hence a server endpoint rather than page code.
const demoCredentialsFile = path.join(root, ".demo-student.json");

function readDemoCredentials() {
  try {
    return JSON.parse(fs.readFileSync(demoCredentialsFile, "utf8"));
  } catch {
    return null;
  }
}

function handleDemoSession(request, response) {
  if (request.url !== "/dev/demo-session") return false;
  const credentials = readDemoCredentials();
  const fail = (status, code, message) =>
    send(response, status, JSON.stringify({ code, message }), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
  if (!credentials?.refreshToken) {
    fail(404, "DEMO_ACCOUNT_NOT_CONFIGURED", "尚未创建演示账号，请先运行 npm run demo:setup。");
    return true;
  }
  // GET only reports availability so the page can hide the entry point; it
  // must not rotate the refresh token.
  if (request.method === "GET" || request.method === "HEAD") {
    send(response, 200, JSON.stringify({ data: { configured: true, student: { fullName: credentials.fullName, studentNumber: credentials.studentNumber } } }), {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    return true;
  }
  if (request.method !== "POST") {
    fail(405, "METHOD_NOT_ALLOWED", "仅支持 GET 与 POST。");
    return true;
  }
  const payload = JSON.stringify({ refreshToken: credentials.refreshToken });
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: Number(process.env.API_PORT || 3000),
      method: "POST",
      path: "/api/v1/auth/refresh",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Idempotency-Key": `demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      },
    },
    (upstreamResponse) => {
      let raw = "";
      upstreamResponse.on("data", (chunk) => { raw += chunk; });
      upstreamResponse.on("end", () => {
        if (upstreamResponse.statusCode !== 200) {
          fail(409, "DEMO_ACCOUNT_EXPIRED", "演示账号登录状态已过期，请重新运行 npm run demo:setup。");
          return;
        }
        let session;
        try {
          session = JSON.parse(raw).data;
        } catch {
          fail(502, "DEMO_REFRESH_INVALID", "刷新演示账号会话失败。");
          return;
        }
        // Persist the rotated token so the next sign-in still works.
        try {
          fs.writeFileSync(
            demoCredentialsFile,
            JSON.stringify({ ...credentials, accessToken: session.accessToken, refreshToken: session.refreshToken, accessTokenExpiresAt: session.accessTokenExpiresAt }, null, 2)
          );
        } catch { /* read-only checkout: the session below still works once */ }
        send(response, 200, JSON.stringify({
          data: {
            authSession: session,
            student: { fullName: credentials.fullName, studentNumber: credentials.studentNumber },
          },
        }), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      });
    }
  );
  upstream.on("error", () => fail(502, "UPSTREAM_UNAVAILABLE", "后端服务不可达，请先启动后端。"));
  upstream.end(payload);
  return true;
}

function tryProxy(request, response) {
  const target = proxyTargets.find((t) => request.url.startsWith(t.prefix));
  if (!target) return false;
  const upstreamPath = target.strip ? request.url.slice(target.strip.length) : request.url;
  const headers = { ...request.headers, host: `${target.host}:${target.port}` };
  const upstream = http.request(
    { host: target.host, port: target.port, method: request.method, path: upstreamPath, headers },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    }
  );
  upstream.on("error", () => {
    send(response, 502, JSON.stringify({ code: "UPSTREAM_UNAVAILABLE", message: "Backend service is not reachable.", details: {}, requestId: "proxy", timestamp: new Date().toISOString() }), {
      "Content-Type": "application/json; charset=utf-8",
    });
  });
  request.pipe(upstream);
  return true;
}

const server = http.createServer((request, response) => {
  if (tryProxy(request, response)) return;
  // Handled before the read-only guard: POST here rotates the demo refresh token.
  if (handleDemoSession(request, response)) return;

  if (!["GET", "HEAD"].includes(request.method)) {
    send(response, 405, "Method Not Allowed", {
      Allow: "GET, HEAD",
      "Content-Type": "text/plain; charset=utf-8",
    });
    return;
  }

  const filePath = resolveFile(request.url);
  if (!filePath) {
    send(response, 403, "Forbidden", { "Content-Type": "text/plain; charset=utf-8" });
    return;
  }

  function serveFile(targetPath) {
    fs.stat(targetPath, (statError, stat) => {
      if (statError) {
        send(response, 404, "Not Found", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }

      // Directory requests like /student/ → serve index.html
      if (stat.isDirectory()) {
        serveFile(path.join(targetPath, "index.html"));
        return;
      }

      if (!stat.isFile()) {
        send(response, 404, "Not Found", { "Content-Type": "text/plain; charset=utf-8" });
        return;
      }

      const type = contentTypes[path.extname(targetPath).toLowerCase()] || "application/octet-stream";
      response.writeHead(200, {
        ...securityHeaders,
        "Content-Type": type,
        "Content-Length": stat.size,
      });

      if (request.method === "HEAD") {
        response.end();
        return;
      }

      fs.createReadStream(targetPath)
        .on("error", () => send(response, 500, "Internal Server Error", { "Content-Type": "text/plain; charset=utf-8" }))
        .pipe(response);
    });
  }

  serveFile(filePath);
});

server.requestTimeout = 10000;
server.headersTimeout = 12000;
server.keepAliveTimeout = 5000;
server.maxHeadersCount = 64;

server.listen(port, host, () => {
  console.log(`BNBU Web preview listening at http://${host}:${port}/index.html?fresh=quality-v1`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`端口 ${port} 已被占用。请先关闭旧预览服务，或换端口启动：`);
    console.error(`  Windows: netstat -ano | findstr :${port}`);
    console.error(`  然后: taskkill /PID <pid> /F`);
    console.error(`  或: set PORT=4175 && npm run preview`);
    process.exit(1);
  }
  console.error(error);
  process.exit(1);
});
