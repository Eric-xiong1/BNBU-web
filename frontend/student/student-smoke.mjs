// Smoke test for the Contract 1.5 Web student client.
// Exercises the framework-free logic modules (i18n, session policy, synthetic
// fixtures, API projection mapping, proof rules, local store) without a DOM.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// localStorage shim so store.js is testable in Node. Safe with hoisted static
// imports: store.js only touches localStorage inside function bodies.
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem(key) {
    return memoryStorage.has(key) ? memoryStorage.get(key) : null;
  },
  setItem(key, value) {
    memoryStorage.set(key, String(value));
  },
  removeItem(key) {
    memoryStorage.delete(key);
  },
};

import { t, tx, setLanguage } from "./js/i18n.js";
import {
  canStartExercise,
  hasSubmittedCheckInToday,
  startSession,
  pauseSession,
  resumeSession,
  sessionDurationMs,
  creditedHours,
  formatTimer,
  SESSION_MAX_MILLIS,
} from "./js/session.js";
import { createMockWorkspace, MOCK_INVITES, hourText } from "./js/data.js";
import {
  canNormalizeCapturedImage,
  mimeEssence,
  validateProofFile,
} from "./js/proofs.js";
import {
  apiBaseUrl,
  mapServerStudent,
  resolveStudentApiState,
} from "./js/api.js";
import { localStore } from "./js/store.js";
import { consumeInviteDeepLink, inviteCodeFromQr } from "./js/screens/join.js";

const failures = [];
const check = (name, fn) => {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL - ${name}: ${error.message}`);
  }
};

const checkAsync = async (name, fn) => {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL - ${name}: ${error.message}`);
  }
};

check("i18n resolves zh by default and en after switch", () => {
  setLanguage("zh");
  assert.equal(t("navigation_dashboard"), "首页");
  assert.equal(tx("你好", "Hello"), "你好");
  setLanguage("en");
  assert.equal(t("navigation_dashboard"), "Home");
  assert.equal(t("notification_unread_count", 3), "3 unread");
  setLanguage("zh");
});

check("mock workspace matches MockStudentWorkspace.kt", () => {
  const workspace = createMockWorkspace();
  assert.equal(workspace.student.id, "2024010836");
  assert.equal(workspace.student.name, "林若晴");
  assert.equal(workspace.courses.length, 2);
  assert.equal(workspace.records.length, 8);
  assert.equal(workspace.progress.course, 8.0);
  assert.equal(workspace.progress.rawCourse, 6.0);
  assert.equal(workspace.notices.length, 3);
  assert.equal(workspace.exemptions.length, 1);
  assert.equal(workspace.checkInTimeWindow.windowMode, "semester_wide");
});

check("invite lookup table exposes shared demo codes", () => {
  assert.ok(MOCK_INVITES["BNBU-7K3P9Q"]);
  assert.equal(MOCK_INVITES["BNBU-EXPIRED"], null);
});

check("time window evaluator blocks unavailable policy", () => {
  const reason = canStartExercise({
    windowMode: "unavailable",
    dailyStartTime: "",
    dailyEndTime: "",
    excludedDates: [],
  });
  assert.ok(reason && reason.length > 0);
  const open = canStartExercise({
    windowMode: "semester_wide",
    dailyStartTime: "00:00",
    dailyEndTime: "23:59",
    excludedDates: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    semesterDeadline: null,
  });
  assert.equal(open, null);
});

check("session timing: pause/resume, 2h cap, credited hours", () => {
  const t0 = 1_000_000;
  let session = startSession(
    { creditType: "general", sportType: "running" },
    t0,
  );
  assert.equal(session.phase, "active");
  session = pauseSession(session, t0 + 10 * 60_000);
  assert.equal(sessionDurationMs(session, t0 + 60 * 60_000), 10 * 60_000);
  session = resumeSession(session, t0 + 20 * 60_000);
  const at3h = sessionDurationMs(session, t0 + 200 * 60_000);
  assert.equal(at3h, SESSION_MAX_MILLIS);
  assert.equal(creditedHours(59 * 60_000), 1);
  assert.equal(creditedHours(2 * 60 * 60_000), 2);
  assert.equal(formatTimer(3_723_000), "01:02:03");
});

check("daily submission guard follows the Beijing business day", () => {
  // The backend keys one check-in per enrollment per business date, so the
  // guard must use Beijing's day rather than the device's — otherwise a
  // student abroad is told they may check in and the submit is then rejected.
  // This instant is still 2026-07-29 in the Americas, already 07-30 in Beijing.
  const now = new Date("2026-07-29T16:00:00Z");
  const workspace = {
    records: [{ creditType: "general", businessDate: "2026-07-30" }],
  };
  assert.equal(hasSubmittedCheckInToday(workspace, now), true);
  workspace.records[0].businessDate = "2026-07-29";
  assert.equal(hasSubmittedCheckInToday(workspace, now), false);
});

check("hourText matches Kotlin Double.hourText()", () => {
  assert.equal(hourText(2), "2h");
  assert.equal(hourText(1.5), "1.5h");
});

check("time window blocks excluded dates and passed deadlines", () => {
  // 2026-07-29 04:00 UTC = 2026-07-29 12:00 Asia/Shanghai.
  const now = new Date(Date.UTC(2026, 6, 29, 4, 0, 0));
  const base = {
    windowMode: "semester_wide",
    dailyStartTime: "00:00",
    dailyEndTime: "23:59",
    excludedDates: [],
    dateRangeStart: null,
    dateRangeEnd: null,
    semesterDeadline: null,
  };
  assert.equal(canStartExercise(base, now), null);
  const excluded = canStartExercise(
    { ...base, excludedDates: ["2026-07-29"] },
    now,
  );
  assert.ok(excluded && excluded.length > 0);
  const pastDeadline = canStartExercise(
    { ...base, semesterDeadline: "2026-07-28" },
    now,
  );
  assert.ok(pastDeadline && pastDeadline.includes("2026-07-28"));
});

check("proof rules follow the exact Contract 1.5 media allowlist", () => {
  assert.equal(mimeEssence("video/webm;codecs=vp8,opus"), "video/webm");
  assert.deepEqual(
    validateProofFile({ type: "image/jpeg", size: 100 }, "image"),
    {
      ok: true,
      extension: "jpg",
      mimeType: "image/jpeg",
      durationSeconds: null,
    },
  );
  assert.deepEqual(
    validateProofFile({ type: "image/png", size: 100 }, "image"),
    {
      ok: true,
      extension: "png",
      mimeType: "image/png",
      durationSeconds: null,
    },
  );
  assert.equal(
    canNormalizeCapturedImage({ name: "capture.HEIC", type: "" }),
    true,
  );
  assert.equal(
    canNormalizeCapturedImage({ name: "capture.webp", type: "image/webp" }),
    true,
  );
  assert.deepEqual(
    validateProofFile({ type: "image/webp", size: 100 }, "image"),
    { ok: false, error: "format" },
  );
  assert.deepEqual(
    validateProofFile({ type: "image/jpeg", size: 10_485_761 }, "image"),
    { ok: false, error: "size" },
  );

  const webm = validateProofFile(
    { type: "video/webm;codecs=vp8,opus", size: 100 },
    "video",
    { durationSeconds: 14.1 },
  );
  assert.deepEqual(webm, {
    ok: true,
    extension: "webm",
    mimeType: "video/webm",
    durationSeconds: 15,
  });
  for (const type of [
    "video/mp4",
    "video/quicktime",
    "video/3gpp",
    "video/webm",
  ]) {
    assert.equal(
      validateProofFile({ type, size: 100 }, "video", { durationSeconds: 15 })
        .ok,
      true,
    );
  }
  assert.deepEqual(
    validateProofFile({ type: "video/x-matroska", size: 100 }, "video", {
      durationSeconds: 10,
    }),
    { ok: false, error: "format" },
  );
  assert.deepEqual(
    validateProofFile({ name: "capture.mov", type: "", size: 100 }, "video", {
      durationSeconds: 10,
    }),
    { ok: false, error: "format" },
  );
  assert.deepEqual(
    validateProofFile({ type: "video/mp4", size: 100 }, "video", {
      durationSeconds: 15.4,
    }),
    { ok: false, error: "duration" },
  );
  assert.deepEqual(
    validateProofFile({ type: "video/mp4", size: 100 }, "video", {
      durationSeconds: null,
    }),
    { ok: false, error: "duration" },
  );
  assert.deepEqual(
    validateProofFile({ type: "video/mp4", size: 0 }, "video", {
      durationSeconds: 10,
    }),
    { ok: false, error: "empty" },
  );
  assert.deepEqual(
    validateProofFile({ type: "video/mp4", size: 536_870_913 }, "video", {
      durationSeconds: 10,
    }),
    { ok: false, error: "size" },
  );
});

check(
  "/me mapping uses Contract 1.5 masked email and verification fields",
  () => {
    const student = mapServerStudent(
      {
        user: {
          primaryEmailMasked: "s***@example.edu",
          emailVerified: true,
          version: 4,
          status: "ACTIVE",
        },
      },
      {
        studentNumber: "00001234",
        fullName: "Synthetic Student",
        gender: "FEMALE",
        gradeYear: 2026,
        collegeName: null,
        administrativeClassName: null,
      },
      { academicYear: "2026-2027" },
    );
    assert.equal(student.id, "00001234");
    assert.equal(student.email, "s***@example.edu");
    assert.equal(student.emailVerified, true);
    assert.equal(student.userVersion, 4);
  },
);

check(
  "canonical teacher QR payload is accepted and non-canonical URL origins are rejected",
  () => {
    const token = "InviteAbC_0123456789.secret-XyZ~";
    assert.equal(
      inviteCodeFromQr(
        `https://www.verityai.cn/join/${encodeURIComponent(token)}`,
      ),
      token,
    );
    assert.equal(inviteCodeFromQr(token), token);
    assert.equal(inviteCodeFromQr(`http://127.0.0.1:4174/join/${token}`), null);
    assert.equal(
      inviteCodeFromQr(`https://sports.example.com/join/${token}`),
      null,
    );
    assert.equal(
      inviteCodeFromQr(`http://www.verityai.cn/join/${token}`),
      null,
    );
  },
);

check(
  "staging invite deep link is removed from the address bar before use",
  () => {
    const token = "InviteAbC_0123456789.secret-XyZ~";
    const calls = [];
    const history = {
      state: { synthetic: true },
      replaceState(...args) {
        calls.push(args);
      },
    };
    assert.equal(
      consumeInviteDeepLink(
        { href: `https://www.verityai.cn/join/${encodeURIComponent(token)}` },
        history,
      ),
      token,
    );
    assert.deepEqual(calls, [[history.state, "", "/"]]);
  },
);

check(
  "staging invite deep link fails closed when browser history cannot be scrubbed",
  () => {
    const token = "InviteAbC_0123456789.secret-XyZ~";
    let replacement = null;
    assert.equal(
      consumeInviteDeepLink(
        {
          href: `https://www.verityai.cn/join/${encodeURIComponent(token)}`,
          replace(value) {
            replacement = value;
          },
        },
        {
          replaceState() {
            throw new Error("synthetic history rejection");
          },
        },
      ),
      null,
    );
    assert.equal(replacement, "/");
  },
);

check("local preview consumes only loopback invite deep links", () => {
  const token = "InviteAbC_0123456789.secret-XyZ~";
  const replacements = [];
  const history = {
    replaceState(_state, _title, path) {
      replacements.push(path);
    },
  };
  assert.equal(
    consumeInviteDeepLink(
      { href: `http://127.0.0.1:4174/join/${encodeURIComponent(token)}` },
      history,
    ),
    token,
  );
  assert.equal(
    consumeInviteDeepLink(
      { href: `http://localhost:4174/join/${encodeURIComponent(token)}` },
      history,
    ),
    token,
  );
  assert.equal(
    consumeInviteDeepLink(
      { href: `https://attacker.invalid/join/${encodeURIComponent(token)}` },
      history,
    ),
    null,
  );
  assert.deepEqual(replacements, ["/student/", "/student/"]);
});

await checkAsync(
  "Student Web deep-link HTML keeps root assets compatible with staging and local preview",
  async () => {
    const [html, previewServer] = await Promise.all([
      readFile(new URL("./index.html", import.meta.url), "utf8"),
      readFile(new URL("../preview-server.cjs", import.meta.url), "utf8"),
    ]);
    const referrerMeta = '<meta name="referrer" content="no-referrer" />';
    assert.ok(html.includes(referrerMeta));
    assert.ok(
      html.indexOf(referrerMeta) < html.indexOf('<link rel="stylesheet"'),
    );
    for (const asset of [
      "/css/tokens.css",
      "/css/components.css",
      "/css/screens.css",
      "/js/emblem.js",
      "/js/app.js",
    ]) {
      assert.match(html, new RegExp(`["']${asset.replaceAll("/", "\\/")}["']`));
    }
    assert.match(previewServer, /\^\\\/join\\\/\[\^\/\]\+\$/);
    assert.match(previewServer, /\["\/css\/", "\/js\/", "\/assets\/"\]/);
  },
);

const studentProfile = {
  studentNumber: "R01-WEB-01",
  fullName: "R01 Web Student",
  gender: "FEMALE",
  gradeYear: 2026,
  collegeName: null,
  administrativeClassName: null,
};
const currentUser = (status, emailVerified) => ({
  user: {
    id: "user-r01-web",
    role: "STUDENT",
    status,
    primaryEmailMasked: emailVerified ? "r***@example.edu" : null,
    emailVerified,
    version: emailVerified ? 2 : 1,
  },
  studentProfile,
  teacherProfile: null,
  adminProfile: null,
});

await checkAsync(
  "invite join keeps a new PENDING student in binding-only mode",
  async () => {
    let currentUserLoads = 0;
    let workspaceLoads = 0;
    const joinedProjection = currentUser("PENDING_CONTACT_BINDING", false);
    const resolved = await resolveStudentApiState({
      currentUser: joinedProjection,
      loadCurrentUser: async () => {
        currentUserLoads += 1;
        return joinedProjection;
      },
      loadWorkspace: async () => {
        workspaceLoads += 1;
        throw new Error("protected workspace must not load");
      },
    });
    assert.equal(resolved.mode, "binding");
    assert.equal(resolved.student.id, "R01-WEB-01");
    assert.equal(currentUserLoads, 0);
    assert.equal(workspaceLoads, 0);
  },
);

await checkAsync(
  "session restore reads only /me for a PENDING student",
  async () => {
    let currentUserLoads = 0;
    let workspaceLoads = 0;
    const pending = currentUser("PENDING_CONTACT_BINDING", false);
    const resolved = await resolveStudentApiState({
      loadCurrentUser: async () => {
        currentUserLoads += 1;
        return pending;
      },
      loadWorkspace: async () => {
        workspaceLoads += 1;
        throw new Error("protected workspace must not load");
      },
    });
    assert.equal(resolved.mode, "binding");
    assert.equal(currentUserLoads, 1);
    assert.equal(workspaceLoads, 0);
  },
);

await checkAsync(
  "successful email verification transitions to one full workspace load",
  async () => {
    let currentUserLoads = 0;
    let workspaceLoads = 0;
    const active = currentUser("ACTIVE", true);
    const workspace = { student: { id: "R01-WEB-01", emailVerified: true } };
    const resolved = await resolveStudentApiState({
      currentUser: active,
      loadCurrentUser: async () => {
        currentUserLoads += 1;
        return active;
      },
      loadWorkspace: async (me) => {
        workspaceLoads += 1;
        assert.equal(me, active);
        return { workspace };
      },
    });
    assert.equal(resolved.mode, "active");
    assert.equal(resolved.workspace, workspace);
    assert.equal(currentUserLoads, 0);
    assert.equal(workspaceLoads, 1);
  },
);

await checkAsync(
  "ACTIVE session restore loads /me and the protected workspace once",
  async () => {
    let currentUserLoads = 0;
    let workspaceLoads = 0;
    const active = currentUser("ACTIVE", true);
    const resolved = await resolveStudentApiState({
      loadCurrentUser: async () => {
        currentUserLoads += 1;
        return active;
      },
      loadWorkspace: async () => {
        workspaceLoads += 1;
        return {
          workspace: { student: { id: "R01-WEB-01", emailVerified: true } },
        };
      },
    });
    assert.equal(resolved.mode, "active");
    assert.equal(currentUserLoads, 1);
    assert.equal(workspaceLoads, 1);
  },
);

check("store self-heals corrupted keys and merges overlay defaults", () => {
  // Corrupted JSON → defaults returned and the bad key removed.
  memoryStorage.set("bnbu.student.web.workspaceOverlay", "{not json");
  let overlay = localStore.getOverlay();
  assert.deepEqual(overlay.readNoticeIds, []);
  assert.equal(overlay.healthReminderAck, false);
  assert.equal(memoryStorage.has("bnbu.student.web.workspaceOverlay"), false);
  // Partial legacy overlay → missing fields filled, wrong shapes coerced.
  memoryStorage.set(
    "bnbu.student.web.workspaceOverlay",
    JSON.stringify({ readNoticeIds: "oops", healthReminderAck: true }),
  );
  overlay = localStore.getOverlay();
  assert.deepEqual(overlay.readNoticeIds, []);
  assert.equal(overlay.healthReminderAck, true);
  assert.deepEqual(overlay.newRecords, []);
  assert.equal(overlay.joinRequest, null);
  memoryStorage.delete("bnbu.student.web.workspaceOverlay");
});

check(
  "public API base rejects query-string token exfiltration overrides",
  () => {
    const originalLocation = globalThis.location;
    try {
      memoryStorage.set(
        "bnbu.student.web.apiBase",
        "https://attacker.invalid/api/v1",
      );
      globalThis.location = {
        protocol: "https:",
        hostname: "www.verityai.cn",
        origin: "https://www.verityai.cn",
        search: "?api=https%3A%2F%2Fattacker.invalid%2Fcollect",
      };
      assert.equal(apiBaseUrl(), "/api/v1");
      assert.equal(memoryStorage.has("bnbu.student.web.apiBase"), false);

      globalThis.location = {
        protocol: "http:",
        hostname: "localhost",
        origin: "http://localhost:8080",
        search: "?api=http%3A%2F%2F127.0.0.1%3A3000%2Fapi%2Fv1",
      };
      assert.equal(apiBaseUrl(), "http://127.0.0.1:3000/api/v1");
    } finally {
      memoryStorage.delete("bnbu.student.web.apiBase");
      if (originalLocation === undefined) delete globalThis.location;
      else globalThis.location = originalLocation;
    }
  },
);

check("exercise session round-trips through the store per account", () => {
  const session = startSession(
    { creditType: "course", sportType: "badminton" },
    5_000,
  );
  localStore.setExerciseSession("acct-1", session);
  assert.deepEqual(localStore.getExerciseSession("acct-1"), session);
  assert.equal(localStore.getExerciseSession("acct-2"), null);
  localStore.clearExerciseSession("acct-1");
  assert.equal(localStore.getExerciseSession("acct-1"), null);
});

if (failures.length) {
  console.error(`\n${failures.length} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nstudent smoke checks passed");
