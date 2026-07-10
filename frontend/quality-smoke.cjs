const http = require("http");
const https = require("https");

const webUrl = process.env.WEB_URL || "http://127.0.0.1:4174";
const apiUrl = process.env.API_URL || "http://127.0.0.1:8080/api/health";
const concurrency = Number(process.env.CONCURRENCY || 200);
const timeoutMs = Number(process.env.TIMEOUT_MS || 5000);

function request(url, options = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      parsed,
      {
        method: options.method || "GET",
        timeout: timeoutMs,
        headers: options.headers || {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "TIMEOUT", headers: {}, body: "" });
    });
    req.on("error", (error) => resolve({ status: error.code || "ERROR", headers: {}, body: error.message }));
    req.end();
  });
}

async function concurrent(url, total) {
  const startedAt = Date.now();
  const results = await Promise.all(Array.from({ length: total }, (_, index) => request(`${url}${url.includes("?") ? "&" : "?"}load=${index}`)));
  const counts = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});
  return {
    total,
    counts,
    elapsedMs: Date.now() - startedAt,
  };
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

(async () => {
  const failures = [];
  const indexUrl = `${webUrl.replace(/\/+$/, "")}/index.html?fresh=quality-smoke`;
  const traversalUrl = `${webUrl.replace(/\/+$/, "")}/../backend/README.md`;

  const index = await request(indexUrl, { method: "HEAD" });
  assert(index.status === 200, `Web preview HEAD expected 200, got ${index.status}`, failures);
  assert(Boolean(index.headers["content-security-policy"]), "Web preview missing Content-Security-Policy", failures);
  assert(index.headers["x-frame-options"] === "DENY", "Web preview missing X-Frame-Options: DENY", failures);
  assert(index.headers["x-content-type-options"] === "nosniff", "Web preview missing X-Content-Type-Options: nosniff", failures);

  const post = await request(indexUrl, { method: "POST" });
  assert(post.status === 405, `Web preview POST expected 405, got ${post.status}`, failures);

  const traversal = await request(traversalUrl, { method: "HEAD" });
  assert([403, 404].includes(traversal.status), `Traversal probe expected 403/404, got ${traversal.status}`, failures);

  const api = await request(apiUrl, { headers: { Origin: webUrl.replace(/\/+$/, "") } });
  assert(api.status === 200, `API health expected 200, got ${api.status}`, failures);
  assert(api.headers["access-control-allow-origin"] === webUrl.replace(/\/+$/, ""), "API CORS origin did not match Web URL", failures);
  assert(api.headers["x-content-type-options"] === "nosniff", "API missing X-Content-Type-Options: nosniff", failures);
  assert(api.body.includes("rateLimit"), "API health missing rateLimit metadata", failures);

  const webConcurrent = await concurrent(indexUrl, concurrency);
  const apiConcurrent = await concurrent(apiUrl, concurrency);
  assert(webConcurrent.counts[200] === concurrency, `Web concurrency expected ${concurrency}x200, got ${JSON.stringify(webConcurrent.counts)}`, failures);
  assert(apiConcurrent.counts[200] === concurrency, `API concurrency expected ${concurrency}x200, got ${JSON.stringify(apiConcurrent.counts)}`, failures);

  const result = {
    webUrl: indexUrl,
    apiUrl,
    concurrency,
    webConcurrent,
    apiConcurrent,
    checkedAt: new Date().toISOString(),
  };

  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures, result }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, result }, null, 2));
})();
