const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const url = process.env.STUDENT_WEB_URL || "http://127.0.0.1:4174/student/index.html";
const updateScreenshots = process.env.UPDATE_ACCEPTANCE === "1";
const screenshotDir = path.resolve(__dirname, "../../docs/acceptance/student-web");
const browserErrors = [];

async function openDemo(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.goto(url, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "进入演示学生端" }).click();
  await page.waitForURL(/#\/home$/);
  return { context, page };
}

async function visit(page, route, text) {
  await page.evaluate((value) => { location.hash = `#/${value}`; }, route);
  await page.getByText(text, { exact: true }).first().waitFor();
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    undefinedText: document.body.innerText.includes("undefined"),
    navCount: document.querySelectorAll(".nav-button").length,
  }));
  assert.ok(result.overflow <= 1, `${route} horizontal overflow: ${result.overflow}px`);
  assert.equal(result.undefinedText, false, `${route} contains undefined text`);
  assert.equal(result.navCount, 5, `${route} must retain five Android tabs`);
}

async function capture(page, name) {
  if (updateScreenshots) await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || "chrome" });
  try {
    const loginContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const loginPage = await loginContext.newPage();
    await loginPage.goto(url, { waitUntil: "networkidle" });
    assert.equal(await loginPage.getByRole("heading", { name: "学生登录" }).isVisible(), true);
    await capture(loginPage, "desktop-login.png");
    await loginContext.close();

    const mobile = await openDemo(browser, { width: 390, height: 844 });
    await visit(mobile.page, "home", "学时进度");
    await capture(mobile.page, "mobile-home.png");
    await visit(mobile.page, "checkin", "运动打卡");
    const description = mobile.page.locator('[name="description"]');
    await description.fill("保留这段尚未保存的运动说明");
    await mobile.page.locator('[data-sport-type="running"]').click();
    await mobile.page.getByRole("button", { name: "查看更多运动项目" }).click();
    assert.equal(await description.inputValue(), "保留这段尚未保存的运动说明");
    assert.equal(await mobile.page.locator('[name="sportType"]').inputValue(), "running");
    await mobile.page.locator("#proof-picker").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.from("proof") });
    assert.equal(await description.inputValue(), "保留这段尚未保存的运动说明");
    assert.equal(await mobile.page.locator(".proof-item").count(), 1);
    await capture(mobile.page, "mobile-checkin.png");
    await mobile.page.getByRole("tab", { name: "记录" }).click();
    await capture(mobile.page, "mobile-records-refined.png");
    for (const [route, text] of [["grades","成绩"],["course/gepe","大学体育 II"],["endurance","耐力跑成绩换算"],["exemptions","体育免测与免打卡申请"],["privacy","隐私政策"],["profile","我的"]]) await visit(mobile.page, route, text);
    await mobile.page.getByRole("button", { name: /通知/ }).last().click();
    await mobile.page.getByRole("dialog").waitFor();
    await mobile.page.getByRole("dialog").getByRole("button", { name: "关闭通知" }).click();
    await mobile.page.locator('[data-setting="themeMode"]').selectOption("dark");
    await mobile.page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await capture(mobile.page, "mobile-profile-dark.png");
    await mobile.context.close();

    const tablet = await openDemo(browser, { width: 768, height: 1024 });
    await visit(tablet.page, "courses", "课程");
    await capture(tablet.page, "tablet-courses.png");
    await tablet.context.close();

    const desktop = await openDemo(browser, { width: 1440, height: 900 });
    await visit(desktop.page, "home", "学时进度");
    await capture(desktop.page, "desktop-home.png");
    await visit(desktop.page, "checkin", "运动打卡");
    await capture(desktop.page, "desktop-checkin.png");
    await desktop.context.close();
  } finally { await browser.close(); }
  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log("student browser acceptance passed: 390x844, 768x1024, 1440x900");
})().catch((error) => { console.error(error); process.exitCode = 1; });
