/**
 * Build a standalone single-file student demo HTML.
 * Does NOT modify student runtime sources — only reads them and writes dist/.
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const root = __dirname;
const assetsDir = path.join(root, "assets");
const outDir = path.join(root, "dist");
const outFile = path.join(outDir, "bnbu-student-demo.html");

function loadAssetDataUris() {
  const map = new Map();
  for (const name of fs.readdirSync(assetsDir)) {
    if (!name.toLowerCase().endsWith(".svg")) continue;
    const bytes = fs.readFileSync(path.join(assetsDir, name));
    const uri = `data:image/svg+xml;base64,${bytes.toString("base64")}`;
    map.set(`./assets/${name}`, uri);
    map.set(`assets/${name}`, uri);
  }
  return map;
}

function rewriteAssets(js, assetMap) {
  let out = js;
  // Longer keys first to avoid partial overlaps
  const entries = [...assetMap.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    out = out.split(from).join(to);
  }
  return out;
}

/**
 * Patch safeProofUrl in the bundled output only (source stays unchanged).
 * Inserts a data:image/ allow-check right after the blob: check.
 */
function patchSafeProofUrl(js) {
  const needle = "if (/^blob:/i.test(url)) return url;";
  const patch = `${needle}\n  if (/^data:image\\//i.test(url)) return url;`;
  if (!js.includes(needle)) {
    throw new Error("safeProofUrl blob check not found in bundle; cannot patch data:image allowlist");
  }
  if (js.includes("if (/^data:image\\//i.test(url)) return url;")) {
    return js;
  }
  return js.replace(needle, patch);
}

function wrapHtml({ css, js }) {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1A73E8" />
    <meta name="color-scheme" content="light dark" />
    <title>BNBU Sports · 学生端（本地演示）</title>
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="student-app"></div>
    <script>
${js}
    </script>
  </body>
</html>
`;
}

async function main() {
  const assetMap = loadAssetDataUris();
  const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

  const result = await esbuild.build({
    entryPoints: [path.join(root, "app.js")],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    write: false,
    logLevel: "info",
  });

  let js = result.outputFiles[0].text;
  js = rewriteAssets(js, assetMap);
  js = patchSafeProofUrl(js);

  // Escape </script> in string literals so the HTML parser does not break out
  js = js.replace(/<\/script/gi, "<\\/script");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, wrapHtml({ css, js }), "utf8");

  const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
  console.log(`Wrote ${outFile} (${sizeKb} KB)`);
  console.log(`Inlined ${assetMap.size / 2} SVG assets as data URIs`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
