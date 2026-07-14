# BNBU Emblem Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the official BNBU emblem to the student dashboard greeting and the bottom Home destination.

**Architecture:** Convert the existing Android vector drawable into one static web SVG under the student assets directory. Render it through a small shared brand-mark helper that layers the emblem over the existing Home icon, so the same markup and fallback behavior are used by both placements.

**Tech Stack:** Vanilla JavaScript ES modules, semantic HTML, CSS, Node.js test runner, Playwright.

---

### Task 1: Specify the shared brand mark

**Files:**
- Create: `frontend/student/assets/bnbu-emblem.svg`
- Create: `frontend/student/core/brand.js`
- Modify: `frontend/student/student-test.mjs`

- [x] **Step 1: Write the failing rendering tests**

Add imports for `brandMark` and assertions that `brandMark({ decorative: false })` includes `assets/bnbu-emblem.svg`, `alt="BNBU 校徽"`, and a Home SVG fallback, while the decorative variant uses an empty `alt` and `aria-hidden="true"`.

- [x] **Step 2: Run the test to verify RED**

Run: `node --test frontend/student/student-test.mjs`

Expected: FAIL because `frontend/student/core/brand.js` does not exist.

- [x] **Step 3: Add the official vector and minimal helper**

Convert the Android drawable at `C:/Users/Eric-/AppData/Local/Temp/BNBU-Sports-Android-reference-20260714/app/src/main/res/drawable/bnbu_emblem.xml` into a standard SVG with `viewBox="0 0 83 83"`, `fill="#0166A4"`, `fill-rule="evenodd"`, and the Android `pathData` preserved exactly. Implement:

```js
import { icon } from "./icons.js";

export function brandMark({ className = "", decorative = false } = {}) {
  const label = decorative ? 'alt="" aria-hidden="true"' : 'alt="BNBU 校徽"';
  return `<span class="brand-mark ${className}">${icon("home", "brand-mark-fallback")}<img class="brand-mark-image" src="./assets/bnbu-emblem.svg" ${label}></span>`;
}
```

- [x] **Step 4: Run the test to verify GREEN**

Run: `node --test frontend/student/student-test.mjs`

Expected: all tests pass.

### Task 2: Place and style the emblem

**Files:**
- Modify: `frontend/student/views/dashboard.js`
- Modify: `frontend/student/views/shell.js`
- Modify: `frontend/student/styles.css`
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/student-browser.cjs`

- [x] **Step 1: Write failing placement tests**

Assert that dashboard markup contains `dashboard-identity` and `dashboard-emblem`, that the Home dock contains `nav-brand-mark`, and that browser acceptance sees both `.dashboard-emblem .brand-mark-image` and `.nav-button[aria-current="page"] .nav-brand-mark` with non-zero dimensions.

- [x] **Step 2: Run the tests to verify RED**

Run: `node --test frontend/student/student-test.mjs`

Expected: FAIL because the two placements do not exist.

- [x] **Step 3: Render and style the two placements**

Import `brandMark` into both views. Wrap the dashboard emblem and greeting copy in `.dashboard-identity`; render `brandMark({ className: "dashboard-emblem" })`. In `renderBottomNav`, render `brandMark({ className: "nav-brand-mark", decorative: true })` for `item.id === "home"`, leaving the other icon calls unchanged. Add shared overlay/fallback styling plus 56px dashboard and 24px navigation size rules.

- [x] **Step 4: Run automated verification**

Run:

```text
npm run test:student
npm run test:student:browser
```

Expected: unit/static checks pass and Playwright reports acceptance passed for 390×844, 768×1024, and 1440×900.

- [x] **Step 5: Inspect acceptance screenshots and commit**

Run the browser suite with `UPDATE_ACCEPTANCE=1`, inspect `docs/acceptance/student-web/mobile-home.png` and `docs/acceptance/student-web/desktop-home.png`, then commit only the brand asset, view/CSS/test changes, updated screenshots, and these design/plan documents.
