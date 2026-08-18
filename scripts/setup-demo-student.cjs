#!/usr/bin/env node
/**
 * Provisions the student portal's demo account against the REAL backend.
 *
 * Unlike the removed mock sign-in, this account is an ordinary student created
 * through the normal invite-join flow: everything the portal shows for it comes
 * from the backend. The preview server later refreshes its session so the demo
 * button can sign in repeatedly (a student cannot re-join once enrolled).
 *
 * Usage (backend must be running):
 *   npm run demo:setup            reuse the existing account, or create one
 *   npm run demo:setup -- --force always create a fresh account
 *
 * Local development only. Credentials are written to frontend/.demo-student.json,
 * which is git-ignored.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const API = process.env.DEMO_API_BASE || "http://127.0.0.1:3000/api/v1";
const CREDENTIALS_FILE = path.join(__dirname, "..", "frontend", ".demo-student.json");
const TEACHER_ACCOUNT = process.env.DEMO_TEACHER_ACCOUNT || "teacher.a.local.synthetic@bnbu.invalid";
const TEACHER_PASSWORD = process.env.DEMO_TEACHER_PASSWORD || "BNBU-Teacher-Local-2026";
// Optional: lets the script top up a session's duration so credited hours are
// realistic without waiting an hour. Skipped when psql is unavailable.
const PSQL = process.env.DEMO_PSQL_PATH || "D:/github_D/BNBU_web/local-infra/pgsql/bin/psql.exe";
const PGPASSWORD_FILE = process.env.DEMO_PG_PASSWORD_FILE || "D:/github_D/BNBU_web/local-infra/secrets/pg_migrator.pwd";
const PGPORT = process.env.DEMO_PG_PORT || "5433";

const force = process.argv.includes("--force");
const uuid = () => require("crypto").randomUUID();

async function api(pathname, { method = "GET", token, body, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";
  if (method !== "GET") requestHeaders["Idempotency-Key"] = uuid();
  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(`${method} ${pathname} → ${response.status} ${parsed?.code ?? ""} ${parsed?.message ?? ""}`);
    error.code = parsed?.code;
    throw error;
  }
  return parsed.data;
}

function psqlAvailable() {
  return fs.existsSync(PSQL) && fs.existsSync(PGPASSWORD_FILE);
}

function psql(sql) {
  execFileSync(PSQL, ["-h", "127.0.0.1", "-p", PGPORT, "-U", "bnbu_migrator", "-d", "bnbu_sports", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: fs.readFileSync(PGPASSWORD_FILE, "utf8").trim() },
    stdio: "pipe",
  });
}

function readCredentials() {
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
  } catch {
    return null;
  }
}

/** A still-valid refresh token means the existing demo account is reusable. */
async function refreshStillWorks(credentials) {
  if (!credentials?.refreshToken) return false;
  try {
    const session = await api("/auth/refresh", { method: "POST", body: { refreshToken: credentials.refreshToken } });
    credentials.refreshToken = session.refreshToken;
    credentials.accessToken = session.accessToken;
    credentials.accessTokenExpiresAt = session.accessTokenExpiresAt;
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
    return true;
  } catch {
    return false;
  }
}

async function seedRecord(studentToken, enrollmentId, { sportType, description, invalid }, teacherToken) {
  const session = await api("/exercise-sessions", {
    method: "POST", token: studentToken,
    body: { enrollmentId, clientObservedAt: new Date().toISOString() },
  });
  const finished = await api(`/exercise-sessions/${session.id}/finish`, {
    method: "POST", token: studentToken,
    body: { expectedVersion: session.version, clientObservedAt: new Date().toISOString() },
  });
  const record = await api("/exercise-records", {
    method: "POST", token: studentToken,
    body: { sessionId: session.id, creditType: "GENERAL", sportType, sportName: null, description, clientRequestId: uuid() },
  });
  if (psqlAvailable()) {
    psql(`BEGIN; SET LOCAL session_replication_role = replica;
UPDATE exercise_sessions SET actual_duration_seconds = 3900, version = version + 1 WHERE id = '${finished.id}';
UPDATE exercise_records SET actual_duration_seconds = 3900, credited_duration_seconds = 3600, version = version + 1 WHERE id = '${record.id}';
COMMIT;`);
  }
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );
  const upload = await api("/media-uploads", {
    method: "POST", token: studentToken,
    body: {
      sessionId: session.id, businessPurpose: "EXERCISE_RECORD", mediaType: "IMAGE",
      mimeType: "image/png", fileSizeBytes: png.length,
      // Contract 2.0.2（自 1.5 起）必须申报文件 SHA-256，后端会与实际上传内容比对。
      declaredContentSha256: require("crypto").createHash("sha256").update(png).digest("hex"),
      captureSource: "IN_APP_CAMERA", durationSeconds: null,
    },
  });
  const put = await fetch(upload.uploadUrl, { method: upload.uploadMethod || "PUT", headers: upload.requiredHeaders || {}, body: png });
  if (!put.ok) throw new Error(`凭证上传失败（${put.status}）`);
  await api(`/media-uploads/${upload.uploadSessionId}/confirm`, {
    method: "POST", token: studentToken, body: { etag: (put.headers.get("etag") || "x").replace(/"/g, "") },
  });
  let media = await api(`/media/${upload.mediaId}`, { token: studentToken });
  await api(`/media/${upload.mediaId}/bind`, { method: "POST", token: studentToken, body: { sessionId: session.id, expectedVersion: media.version } });
  for (let attempt = 0; attempt < 20; attempt++) {
    media = await api(`/media/${upload.mediaId}`, { token: studentToken });
    if (media.uploadStatus === "AVAILABLE") break;
    await new Promise((resolve) => setTimeout(resolve, 700));
  }
  const current = await api(`/exercise-records/${record.id}`, { token: studentToken });
  let submitted;
  try {
    submitted = await api(`/exercise-records/${record.id}/submit`, {
      method: "POST", token: studentToken, body: { mediaIds: [upload.mediaId], expectedVersion: current.version },
    });
  } catch (error) {
    // Never leave an unsubmitted draft behind: it would occupy the day's
    // check-in slot and show up as a phantom record on the student portal.
    const latest = await api(`/exercise-records/${record.id}`, { token: studentToken }).catch(() => null);
    if (latest?.status === "DRAFT") {
      await api(`/exercise-records/${record.id}/discard`, {
        method: "POST", token: studentToken,
        body: { expectedVersion: latest.version, reason: "demo setup rollback" },
      }).catch(() => { /* leave it to the operator if discard is refused */ });
    }
    throw error;
  }
  // Contract 2.0.2：提交本身就原子写入了 result=VALID、teacherId=null 的系统审核行
  // （reviewVersion=1），记录直接进入 REVIEWED/VALID。教师端唯一的审核动作是事后追加
  // INVALID，所以这里只在需要「被判定无效」的样例数据时才调审核接口。
  if (invalid) {
    await api(`/exercise-records/${record.id}/reviews`, {
      method: "POST", token: teacherToken,
      body: {
        result: "INVALID",
        reasonCode: "INSUFFICIENT_EVIDENCE",
        reason: "演示数据：凭证无法证明运动过程",
        publicComment: "凭证无法证明运动过程，请重新打卡。",
        expectedReviewVersion: 1, expectedVersion: submitted.version,
      },
    });
  }
  return record.id;
}

(async () => {
  const existing = readCredentials();
  if (!force && existing && (await refreshStillWorks(existing))) {
    console.log(`演示账号仍然可用：${existing.fullName} / ${existing.studentNumber}`);
    console.log("（如需重建，运行 npm run demo:setup -- --force）");
    return;
  }

  console.log("正在通过真实入班流程创建演示账号…");
  const teacher = await api("/auth/password-login", { method: "POST", body: { account: TEACHER_ACCOUNT, password: TEACHER_PASSWORD } });
  const sections = await api("/class-sections", { token: teacher.accessToken });
  const section = sections.find((s) => s.status === "ACTIVE" && s.isEnrollmentOpen);
  if (!section) throw new Error("没有开放入班的教学班，请先在教师端创建或开启一个。");

  const invite = await api(`/class-sections/${section.id}/course-invites`, { method: "POST", token: teacher.accessToken, body: {} });
  const studentNumber = `2025${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
  const identity = { fullName: "体验同学", studentNumber, gender: "FEMALE", gradeYear: 2025 };
  const capability = await api(`/course-invites/${encodeURIComponent(invite.inviteToken)}/join-capabilities`, { method: "POST", body: identity });
  const joined = await api(`/course-invites/${encodeURIComponent(invite.inviteToken)}/join`, {
    method: "POST", headers: { "X-Join-Capability": capability.joinCapability },
  });
  const studentToken = joined.authSession.accessToken;
  console.log(`  已建号并入班：${identity.fullName} / ${studentNumber}`);

  // Contract 2.0.2：新学生在完成邮箱验证前不是 ACTIVE，无法开始运动会话，
  // 学生端也会把未绑邮箱的账号拦在「完成邮箱验证」页。本地没有邮件服务
  // （Mailpit），这里直接激活并绑定已验证的合成邮箱——仅限本地演示数据。
  if (psqlAvailable()) {
    const demoEmail = `demo.student.${studentNumber}@bnbu.invalid`;
    psql(`BEGIN; SET LOCAL session_replication_role = replica;
UPDATE users SET status = 'ACTIVE',
  primary_email = '${demoEmail}',
  primary_email_normalized = '${demoEmail}',
  email_verified_at = NOW()
WHERE id = '${joined.authSession.user.id}';
COMMIT;`);
    console.log("  已本地激活并绑定合成邮箱（替代 Contract 2.0.2 的邮箱验证，仅本地）");
  } else {
    console.log("  警告：未找到本机 psql，无法激活演示账号；登录可用但打卡会被 USER_STATUS_NOT_ACTIVE 拒绝。");
  }
  await seedRecord(studentToken, joined.enrollment.id, { sportType: "RUNNING", description: "晨跑 5 公里" }, teacher.accessToken);
  console.log("  已生成 1 条有效打卡记录（提交即有效，系统审核行 VALID）");
  await seedRecord(studentToken, joined.enrollment.id, { sportType: "BADMINTON", description: "羽毛球专项练习", invalid: true }, teacher.accessToken)
    .then(() => console.log("  已生成 1 条被教师判定无效的打卡记录"))
    .catch((error) => {
      // One record per day per enrollment is the backend rule; not fatal.
      if (error.code === "EXERCISE_RECORD_DAILY_LIMIT_REACHED" || error.code === "EXERCISE_RECORD_ALREADY_EXISTS_FOR_SESSION") {
        console.log("  （每日仅可打卡一次，跳过第二条记录）");
      } else throw error;
    });

  const credentials = {
    fullName: identity.fullName,
    studentNumber,
    userId: joined.authSession.user.id,
    accessToken: joined.authSession.accessToken,
    refreshToken: joined.authSession.refreshToken,
    accessTokenExpiresAt: joined.authSession.accessTokenExpiresAt,
    createdAt: new Date().toISOString(),
    note: "本地演示账号；数据全部来自真实后端。由 npm run demo:setup 生成。",
  };
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  console.log(`\n✅ 演示账号就绪：${identity.fullName} / ${studentNumber}`);
  console.log("   打开学生端点「体验账号登录」即可进入，数据全部来自后端。");
})().catch((error) => {
  console.error("❌ 创建失败：", error.message);
  console.error("   请确认后端已启动（start-dev.ps1）且自检为 READY。");
  process.exit(1);
});
