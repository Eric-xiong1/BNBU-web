/**
 * Build a standalone single-file admin (web-app) demo HTML.
 * Does NOT modify admin runtime sources — only reads them and writes dist/.
 */
const fs = require("fs");
const path = require("path");

const root = __dirname;
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "bnbu-admin-demo.html");

const CSS_FILES = [
  "styles-campus-blue.css",
  "login.css",
  "app-material.css",
];

function escapeScript(js) {
  return js.replace(/<\/script/gi, "<\\/script");
}

/**
 * Block cross-app navigation that would break under file:// single-file demos.
 * Covers redirectToTeacherApp() and all callers (including quick-teacher).
 */
function patchTeacherRedirects(js) {
  const re = /function redirectToTeacherApp\(demo\s*=\s*false\)\s*\{[\s\S]*?return true;\r?\n\}/;
  const replacement = `function redirectToTeacherApp(demo = false) {
  window.alert("本地演示：请打开 bnbu-teacher-demo.html 查看教师端。");
  return false;
}`;
  if (!re.test(js)) {
    throw new Error("redirectToTeacherApp body not found in app.js; cannot patch");
  }
  return js.replace(re, replacement);
}

function wrapHtml({ css, js }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
    <meta name="theme-color" content="#165DFF" />
    <title>BNBU Sports · 体育成绩管理（本地演示）</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
${js}
    </script>
  </body>
</html>
`;
}

function main() {
  const css = CSS_FILES.map((name) => {
    const text = fs.readFileSync(path.join(root, name), "utf8");
    return `/* ===== ${name} ===== */\n${text}`;
  }).join("\n\n");

  let js = fs.readFileSync(path.join(root, "app.js"), "utf8");
  js = patchTeacherRedirects(js);
  js = escapeScript(js);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, wrapHtml({ css, js }), "utf8");

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Wrote ${outFile} (${sizeKb} KB)`);
  console.log(`Inlined ${CSS_FILES.length} CSS files + app.js`);
}

main();
