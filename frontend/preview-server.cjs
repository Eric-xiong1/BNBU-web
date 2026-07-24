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

const server = http.createServer((request, response) => {
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
