const fs = require("node:fs");
const path = require("node:path");

const output = path.join(__dirname, "student", "runtime-config.js");
const raw = String(process.env.BNBU_API_BASE_URL || "").trim().replace(/\/$/, "");

if (!raw) {
  console.error("BNBU_API_BASE_URL is required for deployment and must end with /api/v1.");
  process.exit(1);
}

let url;
try { url = new URL(raw); } catch { /* handled below */ }
if (!url || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !url.pathname.endsWith("/api/v1")) {
  console.error("BNBU_API_BASE_URL must be an HTTPS URL without credentials/query/fragment and must end with /api/v1.");
  process.exit(1);
}

fs.writeFileSync(output, `globalThis.BNBU_STUDENT_CONFIG = Object.freeze(${JSON.stringify({ apiBaseUrl: raw })});\n`, "utf8");
console.log(`Student runtime API configured for ${url.origin}/api/v1`);
