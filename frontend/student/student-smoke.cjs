const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

assert.match(html, /<div id="student-app"><\/div>/);
assert.match(html, /type="module" src="\.\/app\.js"/);
assert.match(css, /--primary:\s*#165DFF/i);
assert.match(css, /--page:\s*#F5F7FA/i);
assert.match(css, /safe-area-inset-bottom/);
console.log("student static entry smoke passed");
