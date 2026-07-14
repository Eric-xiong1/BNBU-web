const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const pagesWorkflowPath = path.resolve(root, "..", "..", ".github", "workflows", "pages.yml");

assert.match(html, /<div id="student-app"><\/div>/);
assert.match(html, /type="module" src="\.\/app\.js"/);
assert.match(css, /--primary:\s*#1A73E8/i);
assert.match(css, /--page:\s*#F8F9FA/i);
assert.match(css, /:root\[data-theme="dark"\]/);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /\.page-stack\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
assert.match(css, /\.bottom-nav\s*\{[^}]*grid-template-columns:\s*repeat\(5,/s);
assert.doesNotMatch(css, /\.checkin-action-wrap\s*\{/s);
assert.match(css, /\.student-shell\s*\{[^}]*--dock-height:/s);
assert.match(css, /\.record-card-media\s*\{[^}]*grid-template-columns:/s);
assert.match(app, /item\.id\s*===\s*readNotice\.dataset\.noticeId[\s\S]*isUnread:\s*false/);
assert.ok(fs.existsSync(pagesWorkflowPath), "GitHub Pages workflow must exist");
const pagesWorkflow = fs.readFileSync(pagesWorkflowPath, "utf8");
assert.match(pagesWorkflow, /actions\/configure-pages@v5/);
assert.match(pagesWorkflow, /actions\/upload-pages-artifact@v4/);
assert.match(pagesWorkflow, /path:\s*frontend/);
assert.match(pagesWorkflow, /actions\/deploy-pages@v4/);

const previewUrl = process.env.STUDENT_WEB_URL;
if (previewUrl) {
  fetch(previewUrl).then(async (response) => {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /text\/html/);
    assert.match(await response.text(), /BNBU Sports · 学生端/);
    console.log(`student preview smoke passed: ${previewUrl}`);
  }).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
console.log("student static entry smoke passed");
