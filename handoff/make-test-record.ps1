# ============================================================================
# BNBU Sports 造测试数据脚本：一键生成一条"学生已提交、待教师审核"的打卡记录
#
# 用途：教师端开发时需要待审核记录来测试审核页面；每运行一次生成一个新学生
#       和一条带照片凭证的 SUBMITTED 记录。
# 用法：放在 teammate-setup.ps1 同一目录，环境启动后（start-dev.ps1）直接运行：
#   .\make-test-record.ps1
# 说明：脚本会临时修改数据库把运动时长补到 65 分钟（后端要求真实运动满 1 小时
#       才计学时，开发时等不了）。仅限本地合成数据使用。
# ============================================================================
param(
  [string]$Root = (Join-Path $PSScriptRoot "bnbu-dev"),
  [string]$InfraDir = "",
  [int]$ApiPort = 3000,
  [int]$PgPort = 5433
)

$ErrorActionPreference = "Stop"
if ($InfraDir -eq "") { $InfraDir = Join-Path $Root "infra" }
$psqlPath = Join-Path $InfraDir "pgsql\bin\psql.exe"
$pgPwdFile = Join-Path $InfraDir "secrets\pg_migrator.pwd"
if (-not (Test-Path $psqlPath)) { throw "找不到 $psqlPath —— 请先运行 teammate-setup.ps1 安装环境" }
if (-not (Test-Path $pgPwdFile)) { throw "找不到数据库密码文件 $pgPwdFile" }

$helper = Join-Path $InfraDir "secrets\make-record.cjs"
@'
const { execFileSync } = require("child_process");
const [apiBase, psqlPath, pgPort, pgPassword] = process.argv.slice(2);
const uuid = () => require("crypto").randomUUID();
const NAMES = ["李思远", "王雨桐", "张一鸣", "刘子涵", "陈嘉懿", "杨若彤", "周锐", "吴梦洁"];
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

async function api(path, { method = "GET", token, body, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h["Content-Type"] = "application/json";
  if (method !== "GET") h["Idempotency-Key"] = uuid();
  if (token) h["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${apiBase}${path}`, {
    method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const parsed = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`${method} ${path} -> ${res.status} ${parsed ? parsed.code + " " + parsed.message : ""}`);
  }
  return parsed.data;
}

function psql(sql) {
  execFileSync(psqlPath, ["-h", "127.0.0.1", "-p", pgPort, "-U", "bnbu_migrator", "-d", "bnbu_sports", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env: { ...process.env, PGPASSWORD: pgPassword },
    stdio: "pipe",
  });
}

(async () => {
  // 1. 教师登录，找一个开放入班的教学班
  const teacher = await api("/auth/password-login", {
    method: "POST",
    body: { account: "teacher.a.local.synthetic@bnbu.invalid", password: "BNBU-Teacher-Local-2026" },
  });
  const tToken = teacher.accessToken;
  const sections = await api("/class-sections", { token: tToken });
  const section = sections.find((s) => s.status === "ACTIVE" && s.isEnrollmentOpen);
  if (!section) throw new Error("没有开放入班的教学班");

  // 2. 生成邀请码，创建一个随机新学生并入班（同时获得学生登录态）
  const invite = await api(`/class-sections/${section.id}/course-invites`, { method: "POST", token: tToken, body: {} });
  const fullName = NAMES[Math.floor(Math.random() * NAMES.length)];
  const studentNumber = "2025" + String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  const capability = await api(`/course-invites/${encodeURIComponent(invite.inviteToken)}/join-capabilities`, {
    method: "POST",
    body: { fullName, studentNumber, gender: Math.random() < 0.5 ? "FEMALE" : "MALE", gradeYear: 2025 },
  });
  const joined = await api(`/course-invites/${encodeURIComponent(invite.inviteToken)}/join`, {
    method: "POST",
    headers: { "X-Join-Capability": capability.joinCapability },
  });
  const sToken = joined.authSession.accessToken;
  const enrollmentId = joined.enrollment.id;

  // 3. 开始并结束一次运动会话
  const session = await api("/exercise-sessions", {
    method: "POST", token: sToken,
    body: { enrollmentId, clientObservedAt: new Date().toISOString() },
  });
  const finished = await api(`/exercise-sessions/${session.id}/finish`, {
    method: "POST", token: sToken,
    body: { expectedVersion: session.version, clientObservedAt: new Date().toISOString() },
  });

  // 4. 创建打卡记录草稿
  const sports = [["RUNNING", "跑步"], ["SWIMMING", "游泳"], ["FITNESS", "健身"], ["CYCLING", "骑行"]];
  const [sportType, sportZh] = sports[Math.floor(Math.random() * sports.length)];
  const record = await api("/exercise-records", {
    method: "POST", token: sToken,
    body: {
      sessionId: session.id, creditType: "GENERAL", sportType, sportName: null,
      description: `${sportZh}训练打卡（测试数据）`, studentRemark: null, clientRequestId: uuid(),
    },
  });

  // 5. 数据库把时长补到 65 分钟（仅本地合成数据）
  psql(`BEGIN; SET LOCAL session_replication_role = replica;
UPDATE exercise_sessions SET actual_duration_seconds = 3900, version = version + 1 WHERE id = '${finished.id}';
UPDATE exercise_records SET actual_duration_seconds = 3900, credited_duration_seconds = 3600, version = version + 1 WHERE id = '${record.id}';
COMMIT;`);

  // 6. 上传一张照片凭证并绑定
  const upload = await api("/media-uploads", {
    method: "POST", token: sToken,
    body: {
      sessionId: session.id, businessPurpose: "EXERCISE_RECORD", mediaType: "IMAGE",
      mimeType: "image/png", fileSizeBytes: PNG_1PX.length, captureSource: "IN_APP_CAMERA", durationSeconds: null,
    },
  });
  const put = await fetch(upload.uploadUrl, { method: upload.uploadMethod || "PUT", headers: upload.requiredHeaders || {}, body: PNG_1PX });
  if (!put.ok) throw new Error(`照片上传失败 ${put.status}`);
  const etag = (put.headers.get("etag") || "unknown").replace(/"/g, "");
  await api(`/media-uploads/${upload.uploadSessionId}/confirm`, { method: "POST", token: sToken, body: { etag } });
  let media = await api(`/media/${upload.mediaId}`, { token: sToken });
  await api(`/media/${upload.mediaId}/bind`, { method: "POST", token: sToken, body: { sessionId: session.id, expectedVersion: media.version } });
  for (let i = 0; i < 20; i++) {
    media = await api(`/media/${upload.mediaId}`, { token: sToken });
    if (media.uploadStatus === "AVAILABLE") break;
    if (["REJECTED", "FAILED"].includes(media.uploadStatus)) throw new Error("照片校验被拒绝");
    await new Promise((r) => setTimeout(r, 750));
  }

  // 7. 提交打卡（用数据库修正后的最新版本号）
  const current = await api(`/exercise-records/${record.id}`, { token: sToken });
  const submitted = await api(`/exercise-records/${record.id}/submit`, {
    method: "POST", token: sToken,
    body: { mediaIds: [upload.mediaId], expectedVersion: current.version },
  });

  console.log("========================================");
  console.log("待审核记录已生成！");
  console.log(`  学生：${fullName}（学号 ${studentNumber}）`);
  console.log(`  项目：${sportZh} · 计入 ${submitted.creditedDurationSeconds / 3600} 小时 · 1 张照片`);
  console.log(`  记录状态：${submitted.status}（去教师端"打卡审核"页刷新即可看到）`);
  console.log("========================================");
})().catch((error) => { console.error("失败：" + error.message); process.exit(1); });
'@ | Out-File -Encoding utf8 $helper

$pgPassword = (Get-Content $pgPwdFile -Raw).Trim()
node $helper "http://127.0.0.1:$ApiPort/api/v1" $psqlPath $PgPort $pgPassword
if ($LASTEXITCODE -ne 0) { throw "生成失败，请确认环境已启动（start-dev.ps1）且后端自检 READY" }
