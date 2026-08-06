# ============================================================================
# BNBU Sports 联调环境自动安装脚本（发给队友，单文件即可）
#
# 用法（在 PowerShell 中）：
#   .\teammate-setup.ps1                # 安装到脚本所在目录下的 bnbu-dev\
#   .\teammate-setup.ps1 -Root D:\bnbu  # 或指定安装目录
#
# 前置要求：已安装 Node.js 22+（含 npm）和 Git。
# 安装内容：后端仓库 + 教师/管理门户仓库 + 免安装版 PostgreSQL 18 + MinIO，
#           自动生成密钥、建库、建测试账号（教师/管理员），最后生成 start-dev.ps1。
# 全程只写入 -Root 目录，不动系统；删除该目录即完全卸载。
# ============================================================================
param(
  [string]$Root = (Join-Path $PSScriptRoot "bnbu-dev"),
  [int]$PgPort = 5433,
  [int]$MinioPort = 9000,
  [int]$ApiPort = 3000
)

$ErrorActionPreference = "Stop"
function Step($msg) { Write-Host "`n==== $msg ====" -ForegroundColor Cyan }

# ---------------------------------------------------------------- 0. 前置检查
Step "0/8 检查前置工具"
try { $nodeVersion = (node --version) } catch { throw "未找到 Node.js，请先安装 Node.js 22 或更高版本：https://nodejs.org" }
$nodeMajor = [int]($nodeVersion -replace '^v(\d+)\..*', '$1')
if ($nodeMajor -lt 22) { throw "Node.js 版本过低（$nodeVersion），需要 22 或更高版本" }
try { git --version | Out-Null } catch { throw "未找到 Git，请先安装：https://git-scm.com" }
Write-Host "Node $nodeVersion / Git 就绪"

New-Item -ItemType Directory -Force $Root | Out-Null
$infra = Join-Path $Root "infra"
foreach ($d in @("$infra", "$infra\downloads", "$infra\secrets", "$infra\minio\data")) {
  New-Item -ItemType Directory -Force $d | Out-Null
}

# ---------------------------------------------------------------- 1. 克隆仓库
Step "1/8 克隆代码仓库"
$backendDir = Join-Path $Root "BNBU-Sports-Backend"
$portalDir = Join-Path $Root "BNBU-Sports-Web-Teacher-and-Admin"
if (-not (Test-Path "$backendDir\.git")) {
  git clone https://github.com/chchaiai/BNBU-Sports-Backend.git $backendDir
  if ($LASTEXITCODE -ne 0) { throw "后端仓库克隆失败" }
} else { Write-Host "后端仓库已存在，跳过" }
if (-not (Test-Path "$portalDir\.git")) {
  git clone https://github.com/chchaiai/BNBU-Sports-Web-Teacher-and-Admin.git $portalDir
  if ($LASTEXITCODE -ne 0) { throw "门户仓库克隆失败" }
} else { Write-Host "门户仓库已存在，跳过" }

# ---------------------------------------------------------------- 2. 下载组件
Step "2/8 下载 PostgreSQL / MinIO（约 450MB，已存在则跳过）"
$pgZip = Join-Path $infra "downloads\postgresql-18-binaries.zip"
if (-not (Test-Path $pgZip)) {
  Write-Host "下载 PostgreSQL 18（约 340MB）..."
  curl.exe -SL --retry 3 -o $pgZip "https://get.enterprisedb.com/postgresql/postgresql-18.4-1-windows-x64-binaries.zip"
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL 下载失败" }
}
$minioExe = Join-Path $infra "minio\minio.exe"
if (-not (Test-Path $minioExe)) {
  Write-Host "下载 MinIO（约 110MB）..."
  curl.exe -SL --retry 3 -o $minioExe "https://dl.min.io/server/minio/release/windows-amd64/minio.exe"
  if ($LASTEXITCODE -ne 0) { throw "MinIO 下载失败" }
}
$mcExe = Join-Path $infra "minio\mc.exe"
if (-not (Test-Path $mcExe)) {
  Write-Host "下载 MinIO 客户端（约 40MB）..."
  curl.exe -SL --retry 3 -o $mcExe "https://dl.min.io/client/mc/release/windows-amd64/mc.exe"
  if ($LASTEXITCODE -ne 0) { throw "MinIO 客户端下载失败" }
}

Step "3/8 解压 PostgreSQL（只取需要的部分）"
$pgsql = Join-Path $infra "pgsql"
if (-not (Test-Path "$pgsql\bin\initdb.exe")) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($pgZip)
  foreach ($entry in $zip.Entries) {
    if ($entry.Name -eq "") { continue }
    if ($entry.FullName -match '^pgsql/(bin|lib|share)/') {
      $target = Join-Path $infra ($entry.FullName -replace '/', '\')
      $dir = Split-Path $target -Parent
      if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force $dir | Out-Null }
      if (-not (Test-Path $target)) { [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false) }
    }
  }
  $zip.Dispose()
}
Write-Host "PostgreSQL 就绪"

# ---------------------------------------------------------------- 4. 生成密钥
Step "4/8 生成本机密钥与后端配置"
$secretsDir = Join-Path $infra "secrets"
$genScript = Join-Path $secretsDir "gen-secrets.cjs"
@'
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dir = process.argv[2];
const write = (name, value) => {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, value);
};
const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
write("token-private.pem", privateKey.export({ type: "pkcs8", format: "pem" }));
write("token-public.pem", publicKey.export({ type: "spki", format: "pem" }));
for (const name of ["idem", "qrhash", "qrenc"]) write(name + ".key", crypto.randomBytes(32).toString("base64"));
for (const name of ["pg_app", "pg_migrator", "minio_root", "roster_secret", "media_secret", "sechash"]) {
  write(name + ".pwd", crypto.randomBytes(24).toString("hex"));
}
console.log("secrets ready");
'@ | Out-File -Encoding utf8 $genScript
node $genScript $secretsDir
if ($LASTEXITCODE -ne 0) { throw "密钥生成失败" }
Copy-Item (Join-Path $secretsDir "pg_migrator.pwd") (Join-Path $secretsDir "pg_pwfile.txt") -Force

$envScript = Join-Path $secretsDir "write-env.cjs"
@'
const fs = require("fs");
const path = require("path");
const [secretsDir, backendDir, pgPort, minioPort, apiPort] = process.argv.slice(2);
const read = (name) => fs.readFileSync(path.join(secretsDir, name), "utf8").trim();
const pem = (name) => read(name).split(/\r?\n/).join("\\n");
const env = `APP_ENV=local
APP_VERSION=local-dev
PORT=${apiPort}
LOG_LEVEL=debug
DATABASE_URL=postgresql://bnbu_app:${read("pg_app.pwd")}@127.0.0.1:${pgPort}/bnbu_sports?schema=public
MIGRATION_DATABASE_URL=postgresql://bnbu_migrator:${read("pg_migrator.pwd")}@127.0.0.1:${pgPort}/bnbu_sports?schema=public
POSTGRES_DB=bnbu_sports
POSTGRES_APP_USER=bnbu_app
POSTGRES_APP_PASSWORD=${read("pg_app.pwd")}
POSTGRES_MIGRATOR_USER=bnbu_migrator
POSTGRES_MIGRATOR_PASSWORD=${read("pg_migrator.pwd")}
TOKEN_ISSUER=bnbu-sports-local
TOKEN_AUDIENCE=bnbu-sports-local-clients
TOKEN_SIGNING_KEY=${pem("token-private.pem")}
TOKEN_VERIFYING_KEY=${pem("token-public.pem")}
ACCESS_TOKEN_TTL=900
REFRESH_TOKEN_ABSOLUTE_TTL=2592000
REFRESH_TOKEN_IDLE_TTL=604800
IDEMPOTENCY_RETENTION=86400
IDEMPOTENCY_LEASE=300
IDEMPOTENCY_ENCRYPTION_KEY=${read("idem.key")}
SECURITY_HASH_KEY=${read("sechash.pwd")}
AUTH_RATE_LIMIT_WINDOW_SECONDS=60
AUTH_RATE_LIMIT_MAX_ATTEMPTS=20
CORS_ALLOWLIST=http://127.0.0.1:4174,http://localhost:4174,http://127.0.0.1:4300,http://localhost:4300
TRUST_PROXY=false
SYSTEM_MODE_SOURCE=database
REQUEST_BODY_LIMIT_BYTES=1048576
REQUEST_TIMEOUT_MS=10000
COURSE_INVITE_TTL_SECONDS=604800
JOIN_CAPABILITY_TTL_SECONDS=600
QR_JOIN_TOKEN_HASH_KEY=${read("qrhash.key")}
QR_JOIN_SECRET_ENCRYPTION_KEY=${read("qrenc.key")}
QR_JOIN_SECRET_REPLAY_SECONDS=86400
QR_JOIN_PUBLIC_RATE_LIMIT_WINDOW_SECONDS=60
QR_JOIN_PUBLIC_RATE_LIMIT_MAX_REQUESTS=60
OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:${minioPort}
OBJECT_STORAGE_REGION=local
OBJECT_STORAGE_BUCKET=bnbu-sports-local-private
OBJECT_STORAGE_ACCESS_KEY=bnbu-roster-app
OBJECT_STORAGE_SECRET_KEY=${read("roster_secret.pwd")}
OBJECT_STORAGE_FORCE_PATH_STYLE=true
OBJECT_STORAGE_REQUIRED=false

MEDIA_STORAGE_REQUIRED=true
MEDIA_STORAGE_ENDPOINT=http://127.0.0.1:${minioPort}
MEDIA_STORAGE_REGION=local
MEDIA_STORAGE_BUCKET=bnbu-sports-local-media-private
MEDIA_STORAGE_ACCESS_KEY=bnbu-media-app
MEDIA_STORAGE_SECRET_KEY=${read("media_secret.pwd")}
MEDIA_STORAGE_FORCE_PATH_STYLE=true
MEDIA_UPLOAD_URL_TTL_SECONDS=300
MEDIA_ACCESS_URL_TTL_SECONDS=300
MEDIA_MAX_IMAGE_BYTES=10485760
MEDIA_MAX_VIDEO_BYTES=52428800
MEDIA_MAX_VIDEO_DURATION_SECONDS=300
MEDIA_MAX_IMAGE_PIXELS=40000000
MEDIA_SCANNER_MODE=TEST_SIGNATURE
MEDIA_WORKER_ENABLED=true
MEDIA_WORKER_POLL_MS=500
MINIO_ROOT_USER=bnbu-minio-root
MINIO_ROOT_PASSWORD=${read("minio_root.pwd")}
MINIO_BUCKET=bnbu-sports-local-private
LOCAL_SEED_TEACHER_PASSWORD=BNBU-Teacher-Local-2026
LOCAL_SEED_ADMIN_PASSWORD=BNBU-Admin-Local-2026
`;
fs.writeFileSync(path.join(backendDir, "backend", ".env"), env);
console.log("env written");
'@ | Out-File -Encoding utf8 $envScript
node $envScript $secretsDir $backendDir $PgPort $MinioPort $ApiPort
if ($LASTEXITCODE -ne 0) { throw "配置文件生成失败" }

# ---------------------------------------------------------------- 5. 初始化并启动数据库
Step "5/8 初始化并启动 PostgreSQL"
$pgdata = Join-Path $infra "pgdata"
$pwfile = Join-Path $secretsDir "pg_pwfile.txt"
if (-not (Test-Path "$pgdata\PG_VERSION")) {
  & "$pgsql\bin\initdb.exe" -D $pgdata -U bnbu_migrator --pwfile=$pwfile -E UTF8 -A scram-sha-256 --locale=C | Out-Null
}
$pgReady = $false
try { & "$pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $PgPort | Out-Null; if ($LASTEXITCODE -eq 0) { $pgReady = $true } } catch {}
if (-not $pgReady) {
  Start-Process -FilePath "$pgsql\bin\postgres.exe" -ArgumentList "-D", $pgdata, "-p", $PgPort, "-c", "listen_addresses=127.0.0.1" -WindowStyle Minimized
  $tries = 0
  while ($tries -lt 30) {
    Start-Sleep -Seconds 1
    try { & "$pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p $PgPort | Out-Null; if ($LASTEXITCODE -eq 0) { break } } catch {}
    $tries++
  }
  if ($tries -ge 30) { throw "PostgreSQL 启动超时" }
}
$env:PGPASSWORD = (Get-Content (Join-Path $secretsDir "pg_migrator.pwd") -Raw).Trim()
$dbExists = & "$pgsql\bin\psql.exe" -h 127.0.0.1 -p $PgPort -U bnbu_migrator -d postgres -t -A -c "SELECT 1 FROM pg_database WHERE datname='bnbu_sports';"
if ($dbExists -ne "1") {
  & "$pgsql\bin\psql.exe" -h 127.0.0.1 -p $PgPort -U bnbu_migrator -d postgres -c "CREATE DATABASE bnbu_sports OWNER bnbu_migrator;" | Out-Null
}
$appPwd = (Get-Content (Join-Path $secretsDir "pg_app.pwd") -Raw).Trim()
$roleSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'bnbu_app') THEN
    CREATE ROLE bnbu_app LOGIN PASSWORD '$appPwd';
  END IF;
END `$`$;
GRANT CONNECT ON DATABASE bnbu_sports TO bnbu_app;
GRANT USAGE ON SCHEMA public TO bnbu_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO bnbu_app;
"@
$roleSql | & "$pgsql\bin\psql.exe" -h 127.0.0.1 -p $PgPort -U bnbu_migrator -d bnbu_sports -f - | Out-Null
Write-Host "数据库就绪 (端口 $PgPort)"

# ---------------------------------------------------------------- 6. 启动并配置 MinIO
Step "6/8 启动并配置 MinIO 照片存储"
$minioRootPwd = (Get-Content (Join-Path $secretsDir "minio_root.pwd") -Raw).Trim()
$minioUp = $false
try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$MinioPort/minio/health/live" -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { $minioUp = $true } } catch {}
if (-not $minioUp) {
  $env:MINIO_ROOT_USER = "bnbu-minio-root"
  $env:MINIO_ROOT_PASSWORD = $minioRootPwd
  Start-Process -FilePath $minioExe -ArgumentList "server", (Join-Path $infra "minio\data"), "--address", "127.0.0.1:$MinioPort" -WindowStyle Minimized
  Start-Sleep -Seconds 4
}
$env:MC_HOST_local = "http://bnbu-minio-root:$minioRootPwd@127.0.0.1:$MinioPort"
& $mcExe mb --ignore-existing local/bnbu-sports-local-private local/bnbu-sports-local-media-private | Out-Null
& $mcExe anonymous set none local/bnbu-sports-local-private | Out-Null
& $mcExe anonymous set none local/bnbu-sports-local-media-private | Out-Null
$rosterPolicy = Join-Path $secretsDir "roster-policy.json"
$mediaPolicy = Join-Path $secretsDir "media-policy.json"
'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation"],"Resource":["arn:aws:s3:::bnbu-sports-local-private"]},{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::bnbu-sports-local-private"],"Condition":{"StringLike":{"s3:prefix":["roster-sources/*"]}}},{"Effect":"Allow","Action":["s3:PutObject","s3:GetObject","s3:DeleteObject"],"Resource":["arn:aws:s3:::bnbu-sports-local-private/roster-sources/*"]}]}' | Out-File -Encoding ascii $rosterPolicy
'{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetBucketLocation"],"Resource":["arn:aws:s3:::bnbu-sports-local-media-private"]},{"Effect":"Allow","Action":["s3:ListBucket"],"Resource":["arn:aws:s3:::bnbu-sports-local-media-private"],"Condition":{"StringLike":{"s3:prefix":["media/*"]}}},{"Effect":"Allow","Action":["s3:PutObject","s3:GetObject"],"Resource":["arn:aws:s3:::bnbu-sports-local-media-private/media/*"]}]}' | Out-File -Encoding ascii $mediaPolicy
try { & $mcExe admin user add local bnbu-roster-app (Get-Content (Join-Path $secretsDir "roster_secret.pwd") -Raw).Trim() 2>$null | Out-Null } catch {}
try { & $mcExe admin user add local bnbu-media-app (Get-Content (Join-Path $secretsDir "media_secret.pwd") -Raw).Trim() 2>$null | Out-Null } catch {}
try { & $mcExe admin policy create local bnbu-roster-app $rosterPolicy 2>$null | Out-Null } catch {}
try { & $mcExe admin policy create local bnbu-media-app $mediaPolicy 2>$null | Out-Null } catch {}
try { & $mcExe admin policy attach local bnbu-roster-app --user bnbu-roster-app 2>$null | Out-Null } catch {}
try { & $mcExe admin policy attach local bnbu-media-app --user bnbu-media-app 2>$null | Out-Null } catch {}
Write-Host "MinIO 就绪 (端口 $MinioPort)"

# ---------------------------------------------------------------- 7. 后端建表+测试数据
Step "7/8 安装后端依赖、建表、灌测试数据（约 3-5 分钟）"
Push-Location (Join-Path $backendDir "backend")
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "后端依赖安装失败" }
npm run db:generate
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Prisma 客户端生成失败" }
npm run db:migrate:deploy
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "数据库建表失败" }
npm run db:seed:local
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "测试数据灌入失败" }
Pop-Location

Step "8/8 安装门户依赖（约 2-3 分钟）"
Push-Location $portalDir
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "门户依赖安装失败" }
Pop-Location

# ---------------------------------------------------------------- 生成日常启动脚本
$startScript = Join-Path $Root "start-dev.ps1"
@"
# BNBU Sports 日常启动脚本（安装完成后每次开发用这个）
`$infra = "$infra"
& "`$infra\pgsql\bin\pg_ctl.exe" -D "`$infra\pgdata" -o "-p $PgPort -c listen_addresses=127.0.0.1" -l "`$infra\pgdata\server.log" start
`$env:MINIO_ROOT_USER = "bnbu-minio-root"
`$env:MINIO_ROOT_PASSWORD = (Get-Content "`$infra\secrets\minio_root.pwd" -Raw).Trim()
Start-Process -FilePath "`$infra\minio\minio.exe" -ArgumentList 'server', "`$infra\minio\data", '--address', '127.0.0.1:$MinioPort' -WindowStyle Minimized
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backendDir\backend'; npm run start:dev" -WindowStyle Minimized
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$portalDir'; npm run dev -- --port 4300" -WindowStyle Minimized
Write-Host ""
Write-Host "启动完成（后端首次编译约 30 秒）："
Write-Host "  门户       http://localhost:4300/"
Write-Host "  后端自检   http://127.0.0.1:$ApiPort/api/v1/health/ready"
Write-Host "测试账号：教师 teacher.a.local.synthetic@bnbu.invalid / BNBU-Teacher-Local-2026"
Write-Host "          管理员 admin.local.synthetic@bnbu.invalid / BNBU-Admin-Local-2026"
"@ | Out-File -Encoding utf8 $startScript

Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " 安装完成！" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host " 以后每次开发，运行：$startScript"
Write-Host " 门户地址：http://localhost:4300/"
Write-Host " 后端自检：http://127.0.0.1:$ApiPort/api/v1/health/ready"
Write-Host " 教师账号：teacher.a.local.synthetic@bnbu.invalid / BNBU-Teacher-Local-2026"
Write-Host " 管理账号：admin.local.synthetic@bnbu.invalid / BNBU-Admin-Local-2026"
