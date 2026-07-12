const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

assert.match(html, /<div id="student-app"><\/div>/);
assert.match(html, /type="module" src="\.\/app\.js"/);
assert.match(css, /--primary:\s*#165DFF/i);
assert.match(css, /--page:\s*#F5F7FA/i);
assert.match(css, /safe-area-inset-bottom/);
assert.match(css, /\.week-grid\s*\{[^}]*max-width:\s*100%/s);
assert.match(css, /\.page-stack\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
assert.match(app, /item\.id\s*===\s*readNotice\.dataset\.noticeId[\s\S]*isUnread:\s*false/);

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
