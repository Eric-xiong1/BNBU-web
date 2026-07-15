# Bottom Navigation Solid Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four non-Home student bottom-navigation icons with precise solid SVGs matching the supplied Android reference while leaving the BNBU Home emblem unchanged.

**Architecture:** Keep the existing `icon(name, className)` API and local inline-SVG approach. Add a small solid-icon classification inside `core/icons.js`; solid navigation icons receive fill-based SVG attributes, while every existing utility icon retains its current outline attributes.

**Tech Stack:** Vanilla JavaScript ES modules, inline SVG, CSS, Node.js test runner, Playwright.

---

### Task 1: Specify solid and outline icon behavior

**Files:**
- Modify: `frontend/student/student-test.mjs`
- Test: `frontend/student/student-test.mjs`

- [x] **Step 1: Add the failing icon-style test**

Add this test after the existing navigation icon accessibility test:

```js
test("bottom navigation icons use solid SVGs without changing utility icons", () => {
  for (const name of ["courses", "checkin", "grades", "profile"]) {
    const svg = icon(name, "nav-icon");
    assert.match(svg, /data-icon-style="solid"/);
    assert.match(svg, /fill="currentColor"/);
    assert.match(svg, /stroke="none"/);
  }

  for (const name of ["notifications", "back", "close", "refresh", "moon", "shield"]) {
    const svg = icon(name);
    assert.match(svg, /data-icon-style="outline"/);
    assert.match(svg, /fill="none"/);
    assert.match(svg, /stroke="currentColor"/);
  }
});
```

- [x] **Step 2: Run the unit test to verify RED**

Run:

```text
node --test frontend/student/student-test.mjs
```

Expected: one new test fails because current SVG markup has no `data-icon-style="solid"` marker and all icons use outline attributes.

- [x] **Step 3: Commit the failing test**

```text
git add frontend/student/student-test.mjs
git commit -m "test(student-web): specify solid bottom nav icons"
```

### Task 2: Implement the four calibrated solid SVGs

**Files:**
- Modify: `frontend/student/core/icons.js`
- Test: `frontend/student/student-test.mjs`

- [x] **Step 1: Replace the four navigation path definitions**

Use these fill-oriented 24px paths while preserving every other path:

```js
courses: '<path d="M3 4h7c1.1 0 2 .9 2 2v15c0-.55-.45-1-1-1H3V4Zm18 0h-7c-1.1 0-2 .9-2 2v15c0-.55.45-1 1-1h8V4Z"/>',
checkin: '<path fill-rule="evenodd" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm8 4h-2v4H7v2h4v4h2v-4h4v-2h-4V7Z"/>',
grades: '<path d="M4 10h4v10H4V10Zm6-6h4v16h-4V4Zm6 9h4v7h-4v-7Z"/>',
profile: '<path fill-rule="evenodd" d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13.2a7.16 7.16 0 0 1-5.96-3.18C6.18 14.05 10.02 13 12 13s5.82 1.05 5.96 3.02A7.16 7.16 0 0 1 12 19.2Z"/>',
```

- [x] **Step 2: Add style-aware SVG attributes**

Add the classification and replace the `icon()` return markup with:

```js
const solidIcons = new Set(["courses", "checkin", "grades", "profile"]);

export function icon(name, className = "") {
  const body = paths[name];
  if (!body) return "";
  const classAttribute = className ? ` class="${className}"` : "";
  const solid = solidIcons.has(name);
  const paint = solid
    ? 'data-icon-style="solid" fill="currentColor" stroke="none"'
    : 'data-icon-style="outline" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg${classAttribute} aria-hidden="true" viewBox="0 0 24 24" ${paint}>${body}</svg>`;
}
```

- [x] **Step 3: Run unit and static tests to verify GREEN**

Run:

```text
npm.cmd run test:student
```

Expected: all student unit tests and `student static entry smoke` pass.

- [x] **Step 4: Commit the implementation**

```text
git add frontend/student/core/icons.js
git commit -m "feat(student-web): refine bottom nav icons"
```

### Task 3: Verify active states and visual geometry in the browser

**Files:**
- Modify: `frontend/student/student-browser.cjs`
- Modify: `docs/acceptance/student-web/mobile-home.png`
- Modify: `docs/acceptance/student-web/mobile-checkin.png`
- Modify: `docs/acceptance/student-web/mobile-profile-dark.png`
- Modify: `docs/acceptance/student-web/tablet-courses.png`

- [x] **Step 1: Add a browser assertion for each non-Home destination**

Add this helper below `assertHomeEmblems()`:

```js
async function assertSolidNavIcon(page, route) {
  const result = await page.locator(`[data-route="${route}"] .nav-icon`).evaluate((svg) => {
    const rect = svg.getBoundingClientRect();
    return {
      style: svg.getAttribute("data-icon-style"),
      fill: svg.getAttribute("fill"),
      stroke: svg.getAttribute("stroke"),
      width: rect.width,
      height: rect.height,
    };
  });
  assert.equal(result.style, "solid", `${route} must use the solid icon family`);
  assert.equal(result.fill, "currentColor", `${route} must inherit the navigation color`);
  assert.equal(result.stroke, "none", `${route} must not mix outline strokes into the solid icon`);
  assert.ok(result.width >= 44 && result.height >= 28, `${route} must retain its navigation target`);
}
```

Call it after visiting `checkin`, `grades`, `courses`, and `profile`. Keep the existing Home emblem assertion unchanged.

- [x] **Step 2: Run Playwright acceptance and refresh screenshots**

Start `node frontend/preview-server.cjs`, then run:

```text
$env:UPDATE_ACCEPTANCE='1'; npm.cmd run test:student:browser
```

Expected: `student browser acceptance passed: 390x844, 768x1024, 1440x900`.

- [x] **Step 3: Inspect the relevant screenshots**

Inspect the four listed screenshots and verify:

- Home still uses the BNBU emblem.
- All four inactive icons on `mobile-home.png` have equal visual weight.
- Check-in, Courses, and Profile retain the existing active pill and display a solid blue icon.
- Dark mode preserves visible inactive icons and a clear active Profile icon.

Revert any unrelated screenshot updates caused only by dynamic demo dates.

- [x] **Step 4: Commit browser coverage and acceptance artifacts**

```text
git add frontend/student/student-browser.cjs docs/acceptance/student-web/mobile-home.png docs/acceptance/student-web/mobile-checkin.png docs/acceptance/student-web/mobile-profile-dark.png docs/acceptance/student-web/tablet-courses.png
git commit -m "test(student-web): verify solid nav icon states"
```

### Task 4: Final verification and review

**Files:**
- Review: `frontend/student/core/icons.js`
- Review: `frontend/student/student-test.mjs`
- Review: `frontend/student/student-browser.cjs`
- Review: `frontend/student/styles.css`

- [x] **Step 1: Run the full verification suite**

Run:

```text
npm.cmd run test:student
npm.cmd run test:student:browser
npm.cmd run test:web
git diff --check main...HEAD
```

Expected: every command exits 0; student tests report zero failures; browser acceptance passes all three viewports; Web self-test reports healthy route and endpoint counts; diff check prints no errors.

- [x] **Step 2: Request an independent code review**

Ask the reviewer to verify that Home remains unchanged, only the four non-Home icons use solid paint, utility icons remain outline, navigation target geometry is unchanged, and no external assets or dependencies were introduced. Fix every Critical or Important finding and rerun Step 1.

- [x] **Step 3: Confirm the branch is clean**

```text
git status --short
git log -4 --oneline
```

Expected: no uncommitted implementation files remain; the branch contains the test, implementation, and browser-verification commits.

