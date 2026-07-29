/**
 * Build a standalone single-file teacher demo HTML.
 * Does NOT modify teacher runtime sources — only reads them and writes dist/.
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "bnbu-teacher-demo.html");

const SCRIPT_FILES = [
  "auth-bridge.js",
  "mock-data.js",
  "core/time-window.js",
  "core/sort-students.js",
  "api.js",
  "backend-sync.js",
  "media-viewer.js",
  "legacy-pages.js",
  "core-loop.js",
  "app.js",
];

function escapeScript(js) {
  return js.replace(/<\/script/gi, "<\\/script");
}

function patchIsDemo(js) {
  const re =
    /function isDemo\(\)\s*\{\s*return new URLSearchParams\(global\.location\.search\)\.get\("demo"\) === "1";\s*\}/;
  if (!re.test(js)) {
    throw new Error("isDemo() definition not found in auth-bridge.js; cannot force demo mode");
  }
  return js.replace(re, "function isDemo() {\n    return true;\n  }");
}

/** Keep file:// demos from navigating to a missing ../index.html */
function patchLogoutRedirects(js) {
  return js
    .replace(
      /global\.location\.href\s*=\s*"\.\.\/index\.html";/g,
      'global.alert("本地演示：已退出。刷新页面可重新进入。");'
    )
    .replace(
      /window\.location\.href\s*=\s*"\.\.\/index\.html";/g,
      'window.alert("本地演示：已退出。刷新页面可重新进入。");'
    );
}

function extractBodyInner(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (!match) throw new Error("Could not find <body> in teacher/index.html");
  // Drop external <script src="..."> tags; demos inline scripts at the end
  return match[1].replace(/<script\b[^>]*src=["'][^"']+["'][^>]*>\s*<\/script>/gi, "").trim();
}

function wrapHtml({ css, bodyInner, js }) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#165DFF" />
  <title>BNBU Sports · 教师管理端（本地演示）</title>
  <style>
${css}
  </style>
</head>
<body>
${bodyInner}
  <script>
${js}
  </script>
</body>
</html>
`;
}

function main() {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
  const bodyInner = extractBodyInner(html);

  const parts = SCRIPT_FILES.map((rel) => {
    let text = fs.readFileSync(path.join(root, rel), "utf8");
    if (rel === "auth-bridge.js") {
      text = patchIsDemo(text);
    }
    text = patchLogoutRedirects(text);
    return `/* ===== ${rel} ===== */\n${text}`;
  });

  let js = parts.join("\n\n");
  js = escapeScript(js);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, wrapHtml({ css, bodyInner, js }), "utf8");

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Wrote ${outFile} (${sizeKb} KB)`);
  console.log(`Inlined ${SCRIPT_FILES.length} scripts + styles.css`);
}

main();
