# Student Web Navigation Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant home module, promote check-in above a three-item dock, and render proof thumbnails in check-in records.

**Architecture:** Keep the existing vanilla JavaScript render-function architecture. Split the shell into a floating check-in action plus a three-item dock, map all removed `home` hashes back to check-in, and centralize proof media rendering in `views/checkin.js` so list and detail states share URL safety rules.

**Tech Stack:** Vanilla JavaScript ES modules, CSS, Node.js built-in test runner.

---

### Task 1: Lock navigation behavior with tests

**Files:**
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/core/constants.js`
- Modify: `frontend/student/app.js`
- Modify: `frontend/student/views/shell.js`

- [ ] Add assertions that `NAV_ITEMS` contains only `courses`, `grades`, and `profile`; `#/home` falls back to check-in; the shell renders a separate `checkin-action` before the three-item dock.
- [ ] Run `node --test frontend/student/student-test.mjs` and confirm the navigation assertions fail because the old five-item navigation still exists.
- [ ] Remove `home` from route/title/render handling, implement the separate check-in action, and keep `checkin` as the default route.
- [ ] Run `node --test frontend/student/student-test.mjs` and confirm the navigation assertions pass.

### Task 2: Add proof thumbnail rendering

**Files:**
- Modify: `frontend/student/student-test.mjs`
- Modify: `frontend/student/views/checkin.js`
- Modify: `frontend/student/data/demo-data.js`

- [ ] Add assertions for first-proof image thumbnails, `+N` count badges, video play markers, missing-proof fallback, and real media elements in record detail.
- [ ] Run `node --test frontend/student/student-test.mjs` and confirm the new thumbnail assertions fail against the text-only records.
- [ ] Add a proof media helper using `safeProofUrl()`, render the first media in list cards, and render all image/video media in detail. Keep URL acceptance limited to trusted `/uploads/*` paths plus an exact bundled `/student/assets/demo-*.svg` allow-list, with a code-rendered fallback when media is absent.
- [ ] Run `node --test frontend/student/student-test.mjs` and confirm the thumbnail assertions pass.

### Task 3: Match the approved responsive layout

**Files:**
- Modify: `frontend/student/styles.css`
- Modify: `frontend/student/student-smoke.cjs`

- [ ] Add smoke assertions for a centered floating check-in pill, three-column dock, and sufficient shell/main bottom clearance.
- [ ] Run `node frontend/student/student-smoke.cjs` and confirm the layout assertions fail before CSS changes.
- [ ] Implement the approved two-level bottom layout with safe-area support, responsive desktop width, thumbnail sizing, and focus-visible states.
- [ ] Run `npm run test:student`, `npm run test:web`, and `npm run test:api`; all suites must pass.
- [ ] Inspect `390×844`, `768×1024`, and `1440×900` in the running preview and confirm no horizontal overflow or obscured content.
