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
  page.on("dialog", (dialog) => dialog.accept()); // confirm end-session / <1h alert
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

async function assertHomeEmblems(page, viewportName) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".brand-mark-image")];
    return images.length >= 2 && images.every((image) => image.complete && image.naturalWidth > 0);
  });
  const result = await page.evaluate(() => {
    const dashboard = document.querySelector(".dashboard-emblem");
    const nav = document.querySelector('.nav-button[aria-current="page"] .nav-brand-mark');
    const images = [dashboard, nav].map((mark) => mark?.querySelector(".brand-mark-image"));
    return {
      dashboardWidth: dashboard?.getBoundingClientRect().width || 0,
      dashboardHeight: dashboard?.getBoundingClientRect().height || 0,
      navWidth: nav?.getBoundingClientRect().width || 0,
      navHeight: nav?.getBoundingClientRect().height || 0,
      loaded: images.every((image) => image?.complete && image.naturalWidth > 0),
    };
  });
  assert.ok(result.dashboardWidth >= 56 && result.dashboardHeight >= 56, `${viewportName} dashboard emblem must be visible`);
  assert.ok(result.navWidth >= 44 && result.navHeight >= 28, `${viewportName} Home emblem must retain its navigation target`);
  assert.equal(result.loaded, true, `${viewportName} BNBU emblem asset must load`);
}

async function assertSolidNavIcon(page, route) {
  const result = await page.locator(`[data-route="${route}"] .nav-icon`).evaluate((svg) => {
    const iconRect = svg.getBoundingClientRect();
    const targetRect = svg.closest(".nav-button").getBoundingClientRect();
    return {
      style: svg.getAttribute("data-icon-style"),
      fill: svg.getAttribute("fill"),
      stroke: svg.getAttribute("stroke"),
      iconWidth: iconRect.width,
      iconHeight: iconRect.height,
      targetWidth: targetRect.width,
      targetHeight: targetRect.height,
    };
  });
  assert.equal(result.style, "solid", `${route} must use the solid icon family`);
  assert.equal(result.fill, "currentColor", `${route} must inherit the navigation color`);
  assert.equal(result.stroke, "none", `${route} must not mix outline strokes into the solid icon`);
  assert.ok(result.iconWidth >= 44 && result.iconHeight >= 28, `${route} must retain its icon geometry`);
  assert.ok(result.targetWidth >= 44 && result.targetHeight >= 44, `${route} must retain its navigation target`);
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
    await assertHomeEmblems(mobile.page, "mobile");
    await capture(mobile.page, "mobile-home.png");
    await visit(mobile.page, "checkin", "运动服务");
    await assertSolidNavIcon(mobile.page, "checkin");
    // Acknowledge the first-visit health-safety prompt.
    const ack = mobile.page.getByRole("button", { name: "我知道了" });
    if (await ack.count()) await ack.click();
    // Setup → start the exercise session.
    await mobile.page.locator('[data-setup-sport="running"]').click();
    assert.equal(await mobile.page.locator('[name="sportType"]').inputValue(), "running");
    await mobile.page.getByRole("button", { name: "开始运动" }).click();
    await mobile.page.getByText("运动进行中", { exact: true }).waitFor();
    assert.ok(await mobile.page.locator('[data-action="end-session"]').count() >= 1, "running session must show an end control");
    // Capture a proof draft while the timer runs.
    await mobile.page.locator("#session-proof-picker").setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: Buffer.from("proof") });
    assert.equal(await mobile.page.locator(".proof-item").count(), 1);
    // Pause / resume.
    await mobile.page.locator('[data-action="pause-session"]').click();
    await mobile.page.getByText("已暂停", { exact: true }).waitFor();
    await mobile.page.locator('[data-action="resume-session"]').click();
    await mobile.page.getByText("运动进行中", { exact: true }).waitFor();
    await capture(mobile.page, "mobile-checkin.png");
    // End early (<1h → not counted, dialog auto-dismissed, returns to setup).
    await mobile.page.locator('[data-action="end-session"]').click();
    await mobile.page.getByRole("button", { name: "开始运动" }).waitFor();
    await mobile.page.getByRole("tab", { name: "记录" }).click();
    await mobile.page.locator('[data-record-filter="all"]').first().waitFor();
    await capture(mobile.page, "mobile-records-refined.png");
    for (const [route, text] of [["grades","成绩"],["course/gepe","大学体育 II"],["endurance","耐力跑成绩换算"],["exemptions","体育免测与免打卡申请"],["privacy","隐私政策"],["profile","我的"]]) {
      await visit(mobile.page, route, text);
      if (["grades", "profile"].includes(route)) await assertSolidNavIcon(mobile.page, route);
    }
    await mobile.page.getByRole("button", { name: /通知/ }).last().click();
    await mobile.page.getByRole("dialog").waitFor();
    await mobile.page.getByRole("dialog").getByRole("button", { name: "关闭通知" }).click();
    await mobile.page.locator('[data-setting="themeMode"]').selectOption("dark");
    await mobile.page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    await capture(mobile.page, "mobile-profile-dark.png");
    await mobile.context.close();

    const tablet = await openDemo(browser, { width: 768, height: 1024 });
    await visit(tablet.page, "courses", "课程");
    await assertSolidNavIcon(tablet.page, "courses");
    await capture(tablet.page, "tablet-courses.png");
    await tablet.context.close();

    const desktop = await openDemo(browser, { width: 1440, height: 900 });
    await visit(desktop.page, "home", "学时进度");
    await assertHomeEmblems(desktop.page, "desktop");
    await capture(desktop.page, "desktop-home.png");
    await visit(desktop.page, "checkin", "运动服务");
    await capture(desktop.page, "desktop-checkin.png");
    await desktop.context.close();
  } finally { await browser.close(); }
  assert.deepEqual(browserErrors, [], browserErrors.join("\n"));
  console.log("student browser acceptance passed: 390x844, 768x1024, 1440x900");
})().catch((error) => { console.error(error); process.exitCode = 1; });
