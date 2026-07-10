const express = require('express');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
app.use(express.json({ limit: '1mb' }));

// ── Dev mode flag (set ALLOW_DEMO_TOKENS=true for development) ──
const DEV_MODE = process.env.ALLOW_DEMO_TOKENS === 'true';

// ── File upload setup (proof images) ─────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safeName = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(file.originalname).toLowerCase();
    cb(null, safeName);
  },
});

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`不支持的文件类型: ${file.mimetype}。仅支持 JPG、PNG、WebP、HEIC`));
  },
});

const rosterImportUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1 },
});

function isAllowedProofFile(value) {
  return typeof value === 'string' && /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(jpe?g|png|webp|heic|heif)$/i.test(value);
}

function normalizeProofFiles(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isAllowedProofFile))].slice(0, 5);
}

// Serve uploaded files statically (also served by nginx in production)
app.use('/uploads', express.static(UPLOADS_DIR));

// ── CORS (Android app makes cross-origin requests) ──────────────
const configuredCorsOrigins = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);
const corsOriginSet = new Set(configuredCorsOrigins);
app.use((req, res, next) => {
  const requestOrigin = req.headers.origin || '';
  let allowedOrigin = '';
  if (DEV_MODE || corsOriginSet.has('*')) {
    allowedOrigin = '*';
  } else if (requestOrigin && corsOriginSet.has(requestOrigin)) {
    allowedOrigin = requestOrigin;
  }
  if (allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Security headers ───────────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ── Simple in-memory token store (survives until server restart) ──
const tokenStore = new Map(); // token -> { userId, role, createdAt }

function createToken(userId, role) {
  const token = 'bnbu-' + crypto.randomUUID();
  tokenStore.set(token, { userId, role, createdAt: Date.now() });
  return token;
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const iterations = 100000;
  const hash = crypto.pbkdf2Sync(plain, salt, iterations, 64, 'sha512').toString('hex');
  return `${hash}:${salt}:${iterations}`;
}

function verifyPassword(plain, stored) {
  // stored format: "hash:salt:iterations"
  // For legacy plaintext passwords (seed data), compare directly
  if (!stored || !stored.includes(':')) {
    return plain === stored;
  }
  const [hash, salt, iterations] = stored.split(':');
  const derived = crypto.pbkdf2Sync(plain, salt, parseInt(iterations), 64, 'sha512').toString('hex');
  return derived === hash;
}

// ── Auth middleware (token-based — supports both legacy demo-token and new tokens) ──
function requireAuth(req, res, next) {
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  if (!auth) return res.status(401).json({ code: 'AUTH_REQUIRED', message: '未登录' });

  // Legacy demo-token-{userId} — only allowed in dev mode (ALLOW_DEMO_TOKENS=true)
  const legacyMatch = auth.match(/^demo-token-(.+)$/);
  if (legacyMatch) {
    if (!DEV_MODE) return res.status(401).json({ code: 'DEMO_DISABLED', message: 'Demo tokens disabled in production' });
    req.userId = legacyMatch[1];
    req.userRole = null;
    return next();
  }

  // New token format
  const stored = tokenStore.get(auth);
  if (!stored) return res.status(401).json({ code: 'TOKEN_EXPIRED', message: 'Token 无效或已过期' });
  req.userId = stored.userId;
  req.userRole = stored.role;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    requireAuth(req, res, () => {
      // Demo tokens (dev mode only): role is null, allow all
      if (!req.userRole) {
        if (DEV_MODE) return next();
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Demo tokens lack role assignment' });
      }
      if (roles.includes(req.userRole)) return next();
      return res.status(403).json({ code: 'FORBIDDEN', message: '无权访问此资源' });
    });
  };
}

// ── MySQL pool ──────────────────────────────────────────────────
// DB_PASSWORD is required in production; fallback to dev default only in DEV_MODE
if (!process.env.DB_PASSWORD && !DEV_MODE) {
  console.error('[FATAL] DB_PASSWORD environment variable is required. Set DB_PASSWORD or ALLOW_DEMO_TOKENS=true for development.');
  process.exit(1);
}

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || '123_207_5_70_96',
  password: process.env.DB_PASSWORD || (DEV_MODE ? 'Bd84EKfpw3XSmheB' : ''),
  database: process.env.DB_NAME || '123_207_5_70_96',
  waitForConnections: true,
  connectionLimit: 10,
});

const DEFAULT_SPORT_RULE = {
  version: 'BNBU-SPORT-2026-v1',
  total: 20,
  courseRequired: 10,
  generalRequired: 10,
  dailyLimit: 2,
  stackAllowed: '不允许',
  organizationOffset: '允许体育类组织抵扣 10h',
  status: '正常',
};

const DEFAULT_GRADE_RULES = [
  { id: 'g1', key: 'checkin', name: '体育打卡', weight: 25, source: '课程相关 + 其他运动', status: '草稿' },
  { id: 'g2', key: 'exam', name: '专项考试', weight: 30, source: '任课老师录入', status: '草稿' },
  { id: 'g3', key: 'attendance', name: '平时表现', weight: 20, source: '签到 / 课堂表现', status: '草稿' },
  { id: 'g4', key: 'physical', name: '体测', weight: 25, source: '体测换算表', status: '草稿' },
];

const DEFAULT_EXPORT_TEMPLATE = {
  name: 'BNBU-final-v1',
  format: 'CSV',
  fields: ['学号', '姓名', '课程代码', 'Section', '体育打卡', '专项考试', '平时表现', '体测', '总分', '备注'],
  status: '已匹配',
};

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

async function ensureSettingsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS app_settings (
      setting_key VARCHAR(64) PRIMARY KEY,
      setting_value JSON NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
}

async function readSetting(key, fallback) {
  await ensureSettingsTable();
  const [rows] = await pool.query('SELECT setting_value AS value FROM app_settings WHERE setting_key = ?', [key]);
  if (!rows.length) return cloneJson(fallback);
  const stored = rows[0].value;
  if (stored == null) return cloneJson(fallback);
  if (typeof stored === 'string') {
    try { return JSON.parse(stored); } catch (_e) { return cloneJson(fallback); }
  }
  return cloneJson(stored);
}

async function writeSetting(key, value) {
  await ensureSettingsTable();
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
    [key, JSON.stringify(value)]
  );
  return value;
}

function normalizeSportRule(input = {}) {
  const total = toFiniteNumber(input.total, DEFAULT_SPORT_RULE.total);
  const courseRequired = toFiniteNumber(input.courseRequired, DEFAULT_SPORT_RULE.courseRequired);
  const generalRequired = toFiniteNumber(input.generalRequired, DEFAULT_SPORT_RULE.generalRequired);
  const dailyLimit = toFiniteNumber(input.dailyLimit, DEFAULT_SPORT_RULE.dailyLimit);
  return {
    version: String(input.version || DEFAULT_SPORT_RULE.version).trim(),
    total,
    courseRequired,
    generalRequired,
    dailyLimit,
    stackAllowed: String(input.stackAllowed || DEFAULT_SPORT_RULE.stackAllowed).trim(),
    organizationOffset: String(input.organizationOffset || DEFAULT_SPORT_RULE.organizationOffset).trim(),
    status: String(input.status || (courseRequired + generalRequired === total ? '正常' : '需复核')).trim(),
  };
}

function normalizeGradeRules(input) {
  const rows = Array.isArray(input) ? input : input?.rules;
  if (!Array.isArray(rows)) return null;
  const defaultsByKey = new Map(DEFAULT_GRADE_RULES.map((item) => [item.key, item]));
  const normalized = rows.map((row, index) => {
    const key = String(row.key || '').trim();
    const fallback = defaultsByKey.get(key) || DEFAULT_GRADE_RULES[index] || {};
    return {
      id: String(row.id || fallback.id || `g${index + 1}`),
      key,
      name: String(row.name || fallback.name || key),
      weight: toFiniteNumber(row.weight, fallback.weight || 0),
      source: String(row.source || fallback.source || ''),
      status: String(row.status || fallback.status || '草稿'),
    };
  });
  const requiredKeys = ['checkin', 'exam', 'attendance', 'physical'];
  if (normalized.length !== requiredKeys.length) return null;
  if (!requiredKeys.every((key) => normalized.some((row) => row.key === key))) return null;
  return normalized.sort((a, b) => requiredKeys.indexOf(a.key) - requiredKeys.indexOf(b.key))
    .map((row, index) => ({ ...row, id: `g${index + 1}` }));
}

function normalizeExportTemplate(input = {}) {
  const fields = Array.isArray(input.fields)
    ? input.fields.map((field) => String(field).trim()).filter(Boolean)
    : String(input.fields || '').split(/\r?\n|,/).map((field) => field.trim()).filter(Boolean);
  return {
    name: String(input.name || DEFAULT_EXPORT_TEMPLATE.name).trim(),
    format: String(input.format || DEFAULT_EXPORT_TEMPLATE.format).trim(),
    fields: fields.length ? fields : cloneJson(DEFAULT_EXPORT_TEMPLATE.fields),
    status: String(input.status || (fields.length ? '已匹配' : '需复核')).trim(),
  };
}

function weightFor(gradeRules, key) {
  return toFiniteNumber((gradeRules.find((rule) => rule.key === key) || {}).weight, 0);
}

function buildGradeRows(rows, gradeRules) {
  const checkinWeight = weightFor(gradeRules, 'checkin');
  const examWeight = weightFor(gradeRules, 'exam');
  const attendanceWeight = weightFor(gradeRules, 'attendance');
  const physicalWeight = weightFor(gradeRules, 'physical');
  return rows.map((r) => {
    const courseHours = toFiniteNumber(r.course_hours);
    const generalHours = toFiniteNumber(r.general_hours);
    const checkinScore = Math.min(checkinWeight, Math.round(((courseHours + generalHours) / 20) * checkinWeight));
    const exam = toFiniteNumber(r.exam);
    const attendance = toFiniteNumber(r.attendance);
    const physical = toFiniteNumber(r.physical);
    const total = Math.round(
      checkinScore +
      exam * (examWeight / 100) +
      attendance * (attendanceWeight / 100) +
      physical * (physicalWeight / 100)
    );
    const missingItems = [];
    if (!physical) missingItems.push('physical');
    return { ...r, checkinScore, exam, attendance, physical, total, missingItems };
  });
}

function mapTaskRow(r, overrides = {}) {
  return {
    id: r.id,
    courseId: r.course_id || overrides.courseId,
    title: r.title,
    hours: toFiniteNumber(r.required_hours ?? r.hours),
    deadline: r.deadline || '',
    proof: r.proof_requirement || overrides.proof || '',
    status: r.status || '草稿',
    description: r.description || '',
    creditType: r.credit_type || overrides.creditType || '',
    updatedAt: r.updated_at || r.created_at || new Date().toISOString(),
    courseCode: r.course_code,
    courseSection: r.course_section,
  };
}

function collectTaskUpdate(body = {}) {
  const fields = [];
  const params = [];
  if (body.title != null) { fields.push('title = ?'); params.push(String(body.title).trim()); }
  if (body.description != null) { fields.push('description = ?'); params.push(String(body.description)); }
  if (body.creditType != null) { fields.push('credit_type = ?'); params.push(String(body.creditType)); }
  if (body.requiredHours != null || body.hours != null) {
    const nextHours = toFiniteNumber(body.requiredHours ?? body.hours, 0);
    if (nextHours <= 0) return { error: 'hours must be positive' };
    fields.push('required_hours = ?');
    params.push(nextHours);
  }
  if (body.deadline != null) { fields.push('deadline = ?'); params.push(String(body.deadline)); }
  if (body.status != null) { fields.push('status = ?'); params.push(String(body.status)); }
  return { fields, params };
}

function canAccessTask(req, task) {
  if (!task) return false;
  if (!req.userRole || req.userRole === 'admin') return true;
  return req.userRole === 'teacher' && task.teacher_id === req.userId;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const source = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i++;
      row.push(cell.trim());
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value !== '')) rows.push(row);
  if (rows.length === 0) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => {
    const item = {};
    headers.forEach((header, index) => { item[header] = values[index] || ''; });
    return item;
  });
}

function pickValue(row, aliases) {
  for (const key of aliases) {
    if (row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
  }
  return '';
}

function normalizeRosterRow(row, course, index) {
  const normalized = {
    id: pickValue(row, ['id', 'studentId', 'student_id', '学号']),
    name: pickValue(row, ['name', 'studentName', 'student_name', '姓名']),
    college: pickValue(row, ['college', '学院']),
    className: pickValue(row, ['className', 'class_name', '班级']),
    courseCode: pickValue(row, ['courseCode', 'course_code', '课程代码']) || course.code,
    section: pickValue(row, ['section', 'Section', '教学班']) || course.section,
    enrollmentStatus: pickValue(row, ['enrollmentStatus', 'enrollment_status', '选课状态']) || 'selected',
    rowNumber: index + 2,
  };
  const issues = [];
  if (!normalized.id) issues.push('missing id');
  if (!normalized.name) issues.push('missing name');
  if (normalized.courseCode !== course.code || String(normalized.section) !== String(course.section)) issues.push('course mismatch');
  if (/drop|退课/i.test(normalized.enrollmentStatus)) issues.push('not enrolled');
  return {
    ...normalized,
    valid: issues.length === 0,
    status: issues.length === 0 ? 'valid' : issues.join('; '),
  };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function exportValue(field, row, course) {
  const key = String(field).trim().toLowerCase();
  const values = {
    studentid: row.studentId,
    '学号': row.studentId,
    studentname: row.studentName,
    '姓名': row.studentName,
    coursecode: course.code,
    '课程代码': course.code,
    section: course.section,
    checkinscore: row.checkinScore,
    '体育打卡': row.checkinScore,
    exam: row.exam,
    '专项考试': row.exam,
    attendance: row.attendance,
    '平时表现': row.attendance,
    physical: row.physical,
    '体测': row.physical,
    total: row.total,
    '总分': row.total,
    remark: row.missingItems.length ? row.missingItems.join('; ') : '',
    '备注': row.missingItems.length ? row.missingItems.join('; ') : '',
  };
  return values[key] ?? '';
}

function requireCourseAccess(paramName = 'courseId') {
  return async (req, res, next) => {
    if (req.userRole === 'admin') return next();
    const courseId = req.params[paramName];
    if (!courseId) return next();
    try {
      const [rows] = await pool.query('SELECT teacher_id FROM courses WHERE id = ?', [courseId]);
      if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Course not found' });
      if (rows[0].teacher_id === req.userId) return next();
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Course access denied' });
    } catch (e) {
      return res.status(500).json({ code: 'DB_ERROR', message: e.message });
    }
  };
}

// ── Health ───────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    res.json({ ok: true, service: 'BNBU Sports API', db: rows.length > 0, time: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Upload proof image ──────────────────────────────────────────────
app.post('/api/upload/proof', requireRole('student'), (req, res) => {
  upload.array('files', 5)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ code: 'FILE_TOO_LARGE', message: '文件过大，单张图片不超过 10MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(413).json({ code: 'TOO_MANY_FILES', message: '一次最多上传 5 张图片' });
      }
      return res.status(400).json({ code: 'UPLOAD_FAILED', message: err.message });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ code: 'NO_FILE', message: '请选择要上传的图片' });
    }
    const urls = req.files.map((f) => '/uploads/' + f.filename);
    res.json({ urls, count: urls.length });
  });
});

// ── Rate limiter (in-memory, per-IP) ──────────────────────────
const rateLimitStore = new Map(); // ip -> { count, resetAt }
const RATE_WINDOW_MS = 60_000;    // 1 minute
const RATE_MAX_ATTEMPTS = 5;      // max attempts per window

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, remaining: RATE_MAX_ATTEMPTS - 1 };
  }
  entry.count++;
  if (entry.count > RATE_MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { allowed: true, remaining: RATE_MAX_ATTEMPTS - entry.count };
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(ip);
  }
}, 300_000).unref();

// ── Auth (real password verification, proper tokens) ──────────────
app.post('/api/auth/login', async (req, res) => {
  // Rate limiting by IP
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    res.setHeader('Retry-After', limit.retryAfter);
    return res.status(429).json({ code: 'RATE_LIMITED', message: `登录尝试过于频繁，请 ${limit.retryAfter} 秒后再试` });
  }
  try {
    const { account, password } = req.body || {};
    if (!account || !password) return res.status(400).json({ code: 'VALIDATION', message: '请输入账号和密码' });

    const [rows] = await pool.query(
      'SELECT id, name, email, role, college, gender, grade_level, status, password FROM users WHERE email = ? OR id = ?',
      [account, account]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ code: 'AUTH_FAILED', message: '账号或密码错误' });

    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({ code: 'AUTH_FAILED', message: '账号或密码错误' });
    }

    // Auto-upgrade legacy plaintext passwords to pbkdf2 hash
    if (!user.password || !user.password.includes(':')) {
      const hashed = hashPassword(password);
      pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id])
        .catch(err => console.error('[auth] password upgrade failed:', err.message));
    }

    const token = createToken(user.id, user.role);
    const routeMap = { teacher: 'teacher-dashboard', admin: 'admin-dashboard', manager: 'manager-dashboard', student: 'student-dashboard' };
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, college: user.college || '', gender: user.gender || '', gradeLevel: user.grade_level || '', scope: user.role === 'student' ? user.college : '全校', status: user.status || '正常' },
      defaultRoute: routeMap[user.role] || 'student-dashboard'
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, role, college, gender, grade_level, status FROM users WHERE id = ?', [req.userId]);
    const user = rows[0];
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' });
    const routeMap = { teacher: ['teacher-dashboard', 'teacher-courses'], admin: ['admin-dashboard'], manager: ['manager-memberships'], student: ['student-dashboard'] };
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role, college: user.college || '', gender: user.gender || '', gradeLevel: user.grade_level || '', scope: user.college || '全校', status: user.status }, routes: routeMap[user.role] || [] });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const auth = (req.headers.authorization || '').replace('Bearer ', '');
  tokenStore.delete(auth);
  res.json({ ok: true });
});

// ── Teacher: courses ────────────────────────────────────────────
app.get('/api/teacher/courses', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const teacherId = req.userId;
    let sql, params;
    if (req.userRole === 'admin') {
      // Admin sees all courses with teacher names
      sql = `SELECT c.*, u.name AS teacher, COUNT(sp.student_id) AS actualStudents
             FROM courses c
             LEFT JOIN users u ON c.teacher_id = u.id
             LEFT JOIN student_progress sp ON c.id = sp.course_id
             GROUP BY c.id`;
      params = [];
    } else {
      // Teacher sees only their own courses
      sql = `SELECT c.*, u.name AS teacher, COUNT(sp.student_id) AS actualStudents
             FROM courses c
             LEFT JOIN users u ON c.teacher_id = u.id
             LEFT JOIN student_progress sp ON c.id = sp.course_id
             WHERE c.teacher_id = ?
             GROUP BY c.id`;
      params = [teacherId];
    }
    const [rows] = await pool.query(sql, params);
    const result = rows.map((r) => ({ ...r, students: Number(r.actualStudents ?? r.students ?? 0), pending: 0, completion: 63, missing: 0 }));
    res.json(result);
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.get('/api/teacher/courses/:courseId/dashboard', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
    const course = courses && courses.length ? courses[0] : null;
    if (!course) return res.status(404).json({ code: 'NOT_FOUND', message: '课程不存在' });

    // Compute real metrics from student_progress instead of hardcoded values
    const [progressRows] = await pool.query(
      'SELECT COUNT(*) AS total, SUM(CASE WHEN course_hours >= 10 AND general_hours >= 10 THEN 1 ELSE 0 END) AS completeCount, SUM(CASE WHEN course_hours = 0 AND general_hours = 0 THEN 1 ELSE 0 END) AS missingCount FROM student_progress WHERE course_id = ?',
      [req.params.courseId]
    );
    const stats = progressRows && progressRows.length ? progressRows[0] : { total: 0, completeCount: 0, missingCount: 0 };
    const totalStudents = stats.total == null ? Number(course.students || 0) : Number(stats.total);
    const completeCount = Number(stats.completeCount || 0);
    const missingCount = Number(stats.missingCount || 0);
    const pendingCount = Math.max(0, totalStudents - completeCount - missingCount);
    const completion = totalStudents > 0 ? Math.round((completeCount / totalStudents) * 100) : 0;

    // Compute average hours
    const [avgRows] = await pool.query(
      'SELECT AVG(course_hours) AS avgCourse, AVG(general_hours) AS avgGeneral FROM student_progress WHERE course_id = ?',
      [req.params.courseId]
    );
    const avgs = avgRows && avgRows.length ? avgRows[0] : { avgCourse: 0, avgGeneral: 0 };

    res.json({
      ...course,
      students: totalStudents,
      pending: pendingCount,
      completion,
      missing: missingCount,
      courseHours: Number(avgs.avgCourse || 0).toFixed(1),
      generalHours: Number(avgs.avgGeneral || 0).toFixed(1),
      exportState: completeCount === totalStudents && totalStudents > 0 ? '可归档' : '待清理'
    });
  } catch (e) {
    console.error('[teacher/courses/dashboard]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Teacher: students ───────────────────────────────────────────
app.get('/api/teacher/courses/:courseId/students', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { keyword, status } = req.query;
    let sql = `SELECT u.id, u.name, u.college, sp.course_hours AS course, sp.general_hours AS general, sp.exam_score AS exam, sp.attendance_score AS attendance, sp.physical_score AS physical, sp.status FROM student_progress sp JOIN users u ON sp.student_id = u.id WHERE sp.course_id = ?`;
    const params = [req.params.courseId];
    if (keyword) { sql += ' AND (u.name LIKE ? OR u.id LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (status && status !== 'all') {
      const map = { complete: '已完成', incomplete: '未完成', risk: '风险较高' };
      if (map[status]) { sql += ' AND sp.status = ?'; params.push(map[status]); }
    }
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({ ...r, rawGeneral: r.general, className: '', organizationCredit: null, source: 'seed' })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Teacher: tasks ──────────────────────────────────────────────
app.post('/api/teacher/courses/:courseId/students/import/preview', requireRole('teacher', 'admin'), requireCourseAccess(), (req, res) => {
  rosterImportUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ code: 'IMPORT_FILE_ERROR', message: err.message });
    try {
      const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
      if (!courses.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Course not found' });
      const csvText = req.file?.buffer?.toString('utf8') || req.body?.csv || req.body?.content || '';
      if (!csvText.trim()) return res.status(400).json({ code: 'VALIDATION', message: 'CSV content is required' });
      const rows = parseCsv(csvText).map((row, index) => normalizeRosterRow(row, courses[0], index));
      const validCount = rows.filter((row) => row.valid).length;
      res.json({ rows, validCount, invalidCount: rows.length - validCount });
    } catch (e) {
      res.status(500).json({ code: 'DB_ERROR', message: e.message });
    }
  });
});

app.post('/api/teacher/courses/:courseId/students/import/confirm', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
    if (!courses.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Course not found' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ code: 'VALIDATION', message: 'rows are required' });
    const normalizedRows = rows.map((row, index) => normalizeRosterRow(row, courses[0], index));
    const validRows = normalizedRows.filter((row) => row.valid);
    const rejectedRows = normalizedRows.filter((row) => !row.valid);
    for (const row of validRows) {
      await pool.query(
        `INSERT INTO users (id, name, email, role, college, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE name = VALUES(name), college = VALUES(college), updated_at = NOW()`,
        [row.id, row.name, `${row.id}@bnbu.edu.cn`, 'student', row.college || '', '正常']
      );
      await pool.query(
        `INSERT INTO student_progress (student_id, course_id, course_hours, general_hours, exam_score, attendance_score, physical_score, status)
         VALUES (?, ?, 0, 0, 0, 0, 0, '未完成')
         ON DUPLICATE KEY UPDATE status = VALUES(status)`,
        [row.id, req.params.courseId]
      );
    }
    res.json({ importedCount: validRows.length, rejectedCount: rejectedRows.length, rejectedRows });
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.get('/api/teacher/courses/:courseId/tasks', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { status } = req.query;
    const [rows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.course_id = ? ORDER BY t.created_at DESC',
      [req.params.courseId]
    );
    const tasks = rows.map((r) => mapTaskRow(r));
    res.json(status && status !== 'all' ? tasks.filter((task) => task.status === status) : tasks);
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.post('/api/teacher/courses/:courseId/tasks', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { title, description, creditType, requiredHours, hours, deadline, status, proof } = req.body || {};
    const taskTitle = String(title || '').trim();
    const taskHours = toFiniteNumber(requiredHours ?? hours, 0);
    if (!taskTitle || taskHours <= 0) {
      return res.status(400).json({ code: 'VALIDATION', message: 'title and positive hours are required' });
    }
    const taskId = 'task-' + crypto.randomUUID();
    const taskStatus = String(status || '草稿').trim();
    const taskCreditType = String(creditType || '课程相关').trim();
    await pool.query(
      `INSERT INTO tasks (id, course_id, title, description, credit_type, required_hours, deadline, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [taskId, req.params.courseId, taskTitle, description || '', taskCreditType, taskHours, deadline || '', taskStatus]
    );
    const [rows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.id = ?',
      [taskId]
    );
    res.status(201).json(mapTaskRow(rows[0] || {
      id: taskId,
      course_id: req.params.courseId,
      title: taskTitle,
      description: description || '',
      credit_type: taskCreditType,
      required_hours: taskHours,
      deadline: deadline || '',
      status: taskStatus,
    }, { proof, creditType: taskCreditType }));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.patch('/api/teacher/courses/:courseId/tasks/:taskId', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { fields, params, error } = collectTaskUpdate(req.body || {});
    if (error) return res.status(400).json({ code: 'VALIDATION', message: error });
    if (!fields.length) return res.status(400).json({ code: 'VALIDATION', message: 'No task fields to update' });
    params.push(req.params.taskId, req.params.courseId);
    const [result] = await pool.query(`UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ? AND course_id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    const [rows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.id = ?',
      [req.params.taskId]
    );
    res.json(mapTaskRow(rows[0]));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/teacher/courses/:courseId/tasks/:taskId', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ? AND course_id = ?', [req.params.taskId, req.params.courseId]);
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.patch('/api/teacher/tasks/:taskId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [existingRows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name, c.teacher_id FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.id = ?',
      [req.params.taskId]
    );
    if (!existingRows.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    if (!canAccessTask(req, existingRows[0])) return res.status(403).json({ code: 'FORBIDDEN', message: 'Task access denied' });
    const { fields, params, error } = collectTaskUpdate(req.body || {});
    if (error) return res.status(400).json({ code: 'VALIDATION', message: error });
    if (!fields.length) return res.status(400).json({ code: 'VALIDATION', message: 'No task fields to update' });
    params.push(req.params.taskId);
    const [result] = await pool.query(`UPDATE tasks SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    const [rows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name, c.teacher_id FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.id = ?',
      [req.params.taskId]
    );
    res.json(mapTaskRow(rows[0]));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/teacher/tasks/:taskId', requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const [existingRows] = await pool.query(
      'SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name, c.teacher_id FROM tasks t JOIN courses c ON t.course_id = c.id WHERE t.id = ?',
      [req.params.taskId]
    );
    if (!existingRows.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    if (!canAccessTask(req, existingRows[0])) return res.status(403).json({ code: 'FORBIDDEN', message: 'Task access denied' });
    const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.taskId]);
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: 'Task not found' });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Teacher: reviews ────────────────────────────────────────────
app.get('/api/teacher/courses/:courseId/reviews', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { status, keyword } = req.query;
    let sql = `SELECT r.*, sr.proof_files
      FROM reviews r
      LEFT JOIN sport_records sr ON r.record_id = sr.id
      WHERE r.course_id = ?`;
    const params = [req.params.courseId];
    if (status && status !== 'all') {
      const map = { open: '待确认', safe: '可通过', risk: '需复核', closed: '已通过' };
      if (map[status]) { sql += ' AND r.status = ?'; params.push(map[status]); }
    }
    if (keyword) { sql += ' AND (r.name LIKE ? OR r.student_id LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      ...r, applied: Boolean(r.applied),
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/teacher/reviews/:reviewId/decision', requireRole('teacher', 'admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { decision, approvedHours, comment } = req.body || {};
    const statusMap = { approve: '已通过', reject: '已驳回', supplement: '补材料' };
    if (!statusMap[decision]) return res.status(400).json({ code: 'VALIDATION', message: 'Invalid decision' });

    const nextApprovedHours = decision === 'approve' ? Number(approvedHours || 0) : 0;
    if (decision === 'approve' && (nextApprovedHours <= 0 || nextApprovedHours > 2)) {
      return res.status(400).json({ code: 'VALIDATION', message: 'approvedHours must be between 0 and 2' });
    }

    await conn.beginTransaction();
    const [existingRows] = await conn.query('SELECT * FROM reviews WHERE id = ? FOR UPDATE', [req.params.reviewId]);
    const review = existingRows[0];
    if (!review) {
      await conn.rollback();
      return res.status(404).json({ code: 'NOT_FOUND', message: 'Review not found' });
    }

    if (req.userRole === 'teacher' && review.course_id) {
      const [courses] = await conn.query('SELECT teacher_id FROM courses WHERE id = ?', [review.course_id]);
      if (!courses.length || courses[0].teacher_id !== req.userId) {
        await conn.rollback();
        return res.status(403).json({ code: 'FORBIDDEN', message: 'Course access denied' });
      }
    } else if (req.userRole === 'teacher' && !review.course_id) {
      await conn.rollback();
      return res.status(403).json({ code: 'FORBIDDEN', message: 'Course access denied' });
    }

    const oldAppliedHours = review.applied ? Number(review.approved_hours || 0) : 0;
    const nextAppliedHours = decision === 'approve' ? nextApprovedHours : 0;
    const delta = nextAppliedHours - oldAppliedHours;
    const newStatus = statusMap[decision];

    await conn.query(
      'UPDATE reviews SET status = ?, approved_hours = ?, comment = ?, applied = ? WHERE id = ?',
      [newStatus, nextAppliedHours, comment || '', decision === 'approve' ? 1 : 0, req.params.reviewId]
    );

    if (review.record_id) {
      await conn.query(
        'UPDATE sport_records SET status = ?, approved_hours = ?, review_comment = ?, reviewed_at = NOW() WHERE id = ?',
        [newStatus, nextAppliedHours, comment || '', review.record_id]
      );
    }

    if (delta !== 0 && review.course_id) {
      const hourColumn = String(review.type || '').includes('课程') || String(review.type || '').toLowerCase().includes('course')
        ? 'course_hours'
        : 'general_hours';
      await conn.query(
        `UPDATE student_progress SET ${hourColumn} = GREATEST(0, ${hourColumn} + ?) WHERE student_id = ? AND course_id = ?`,
        [delta, review.student_id, review.course_id]
      );
    }

    const [rows] = await conn.query('SELECT * FROM reviews WHERE id = ?', [req.params.reviewId]);
    await conn.commit();
    res.json({ review: { ...rows[0], applied: Boolean(rows[0].applied) }, student: { id: rows[0].student_id, name: rows[0].name } });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  } finally {
    conn.release();
  }
});

// ── Teacher: scores ─────────────────────────────────────────────
app.put('/api/teacher/courses/:courseId/scores/exam', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!rows) return res.status(400).json({ code: 'VALIDATION', message: '缺少 rows' });
    for (const r of rows) {
      const items = Array.isArray(r.examItems) ? r.examItems : [0];
      const avg = items.length ? Math.round(items.reduce((a, b) => a + b, 0) / items.length) : 0;
      await pool.query('UPDATE student_progress SET exam_score = ? WHERE student_id = ? AND course_id = ?', [avg, r.studentId, req.params.courseId]);
    }
    res.json({ savedCount: rows.length, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/teacher/courses/:courseId/scores/attendance', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!rows) return res.status(400).json({ code: 'VALIDATION', message: '缺少 rows' });
    for (const r of rows) {
      await pool.query('UPDATE student_progress SET attendance_score = ? WHERE student_id = ? AND course_id = ?', [r.score || 0, r.studentId, req.params.courseId]);
    }
    res.json({ savedCount: rows.length, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/teacher/courses/:courseId/scores/physical', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!rows) return res.status(400).json({ code: 'VALIDATION', message: '缺少 rows' });
    for (const r of rows) {
      await pool.query('UPDATE student_progress SET physical_score = ? WHERE student_id = ? AND course_id = ?', [r.score || 0, r.studentId, req.params.courseId]);
    }
    res.json({ savedCount: rows.length, updatedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Teacher: grades ─────────────────────────────────────────────
app.get('/api/teacher/courses/:courseId/grades', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT sp.student_id AS studentId, u.name AS studentName, sp.course_hours, sp.general_hours, sp.exam_score AS exam, sp.attendance_score AS attendance, sp.physical_score AS physical
       FROM student_progress sp JOIN users u ON sp.student_id = u.id WHERE sp.course_id = ?`, [req.params.courseId]
    );
    const gradeRules = await readSetting('grade-rules', DEFAULT_GRADE_RULES);
    res.json(buildGradeRows(rows, gradeRules));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Teacher: export ─────────────────────────────────────────────
app.get('/api/teacher/courses/:courseId/export/precheck', requireRole('teacher', 'admin'), requireCourseAccess(), async (_req, res) => {
  const [students] = await pool.query('SELECT * FROM student_progress WHERE course_id = ?', [_req.params.courseId]);
  const checkinNotEnough = students.filter((s) => s.course_hours < 10 || s.general_hours < 10);
  const missingPhysical = students.filter((s) => !s.physical_score);
  res.json({ missingPhysical, checkinNotEnough: checkinNotEnough.map((s) => ({ id: s.student_id, name: '', college: '', course: s.course_hours, general: s.general_hours, exam: s.exam_score, attendance: s.attendance_score, physical: s.physical_score, status: s.status })), unresolvedReviews: [], templateMatched: true });
});

app.get('/api/teacher/courses/:courseId/export', requireRole('teacher', 'admin'), requireCourseAccess(), async (req, res) => {
  try {
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [req.params.courseId]);
    if (!courses.length) return res.status(404).json({ code: 'NOT_FOUND', message: 'Course not found' });
    const course = courses[0];
    const [rows] = await pool.query(
      `SELECT sp.student_id AS studentId, u.name AS studentName, sp.course_hours, sp.general_hours, sp.exam_score AS exam, sp.attendance_score AS attendance, sp.physical_score AS physical
       FROM student_progress sp JOIN users u ON sp.student_id = u.id WHERE sp.course_id = ?`,
      [req.params.courseId]
    );
    const gradeRules = await readSetting('grade-rules', DEFAULT_GRADE_RULES);
    const template = await readSetting('export-template', DEFAULT_EXPORT_TEMPLATE);
    const gradeRows = buildGradeRows(rows, gradeRules);
    const fields = template.fields && template.fields.length ? template.fields : DEFAULT_EXPORT_TEMPLATE.fields;
    const lines = [
      fields.map(csvEscape).join(','),
      ...gradeRows.map((row) => fields.map((field) => csvEscape(exportValue(field, row, course))).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.courseId}-grades.csv"`);
    res.send('\uFEFF' + lines.join('\r\n'));
  } catch (e) {
    console.error('[teacher/export]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: overview ─────────────────────────────────────────────
app.get('/api/admin/overview', requireRole('admin'), async (_req, res) => {
  try {
    const [courses] = await pool.query('SELECT * FROM courses');
    const result = await Promise.all(courses.map(async (c) => {
      const [stats] = await pool.query(
        'SELECT COUNT(*) AS total, SUM(CASE WHEN course_hours >= 10 AND general_hours >= 10 THEN 1 ELSE 0 END) AS completeCount, SUM(CASE WHEN course_hours = 0 AND general_hours = 0 THEN 1 ELSE 0 END) AS missingCount FROM student_progress WHERE course_id = ?',
        [c.id]
      );
      const s = stats && stats.length ? stats[0] : { total: 0, completeCount: 0, missingCount: 0 };
      const total = s.total == null ? Number(c.students || 0) : Number(s.total);
      const complete = s.completeCount || 0;
      const pending = total - complete - (s.missingCount || 0);
      const completion = total > 0 ? Math.round((complete / total) * 100) : 0;

      const [avgs] = await pool.query(
        'SELECT AVG(course_hours) AS avgCourse, AVG(general_hours) AS avgGeneral FROM student_progress WHERE course_id = ?',
        [c.id]
      );
      const a = avgs && avgs.length ? avgs[0] : { avgCourse: 0, avgGeneral: 0 };

      return {
        course: c,
        metrics: {
          students: total,
          pending,
          completion,
          missing: s.missingCount || 0,
          courseHours: Number(a.avgCourse || 0).toFixed(1),
          generalHours: Number(a.avgGeneral || 0).toFixed(1),
          exportState: complete === total && total > 0 ? '可归档' : '待清理'
        },
        issueCount: (s.missingCount || 0),
        health: completion >= 80 ? '正常' : completion > 0 ? '需关注' : '待清理'
      };
    }));
    res.json(result);
  } catch (e) {
    console.error('[admin/overview]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: sport rules ──────────────────────────────────────────
// Phase 3: Admin persisted system rules
app.get('/api/admin/sport-rules', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await readSetting('sport-rules', DEFAULT_SPORT_RULE));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/sport-rules', requireRole('admin'), async (req, res) => {
  try {
    const rule = normalizeSportRule(req.body || {});
    if (rule.total <= 0 || rule.courseRequired < 0 || rule.generalRequired < 0 || rule.dailyLimit <= 0) {
      return res.status(422).json({ code: 'VALIDATION', message: 'Invalid sport rule numbers' });
    }
    res.json(await writeSetting('sport-rules', rule));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.get('/api/admin/grade-rules', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await readSetting('grade-rules', DEFAULT_GRADE_RULES));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/grade-rules', requireRole('admin'), async (req, res) => {
  try {
    const rules = normalizeGradeRules(req.body);
    if (!rules) return res.status(422).json({ code: 'VALIDATION', message: 'Grade rules must include checkin, exam, attendance, and physical' });
    const total = rules.reduce((sum, rule) => sum + rule.weight, 0);
    if (total !== 100) return res.status(422).json({ code: 'VALIDATION', message: 'Grade rule weights must total 100' });
    res.json(await writeSetting('grade-rules', rules));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.get('/api/admin/export-template', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await readSetting('export-template', DEFAULT_EXPORT_TEMPLATE));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/export-template', requireRole('admin'), async (req, res) => {
  try {
    const template = normalizeExportTemplate(req.body || {});
    if (!template.name || !template.fields.length) {
      return res.status(422).json({ code: 'VALIDATION', message: 'Export template needs a name and at least one field' });
    }
    res.json(await writeSetting('export-template', template));
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

if (false) app.get('/api/admin/sport-rules-legacy-static', requireRole('admin'), (_req, res) => {
  res.json({ version: 'BNBU-SPORT-2026-v1', total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2, stackAllowed: '否', organizationOffset: '抵扣其他运动 10h', status: '已发布' });
});

if (false) app.put('/api/admin/sport-rules-legacy-echo', requireRole('admin'), (req, res) => { res.json(req.body); });

// ── Admin: semesters ────────────────────────────────────────────
app.get('/api/admin/semesters', requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM semesters');
    // Normalize locked field (may be missing if migration hasn't run)
    res.json(rows.map((r) => ({ ...r, locked: r.locked || '否' })));
  } catch (_e) {
    // Fallback: locked column may not exist yet
    try {
      const [rows] = await pool.query('SELECT id, name, date_range, status FROM semesters');
      res.json(rows.map((r) => ({ ...r, locked: '否' })));
    } catch (e2) {
      res.status(500).json({ code: 'DB_ERROR', message: e2.message });
    }
  }
});

// ── Admin: courses ──────────────────────────────────────────────
app.get('/api/admin/courses', requireRole('admin'), async (_req, res) => {
  const [rows] = await pool.query('SELECT c.*, u.name AS teacher FROM courses c LEFT JOIN users u ON c.teacher_id = u.id');
  res.json(rows);
});

// ── Admin: users ────────────────────────────────────────────────
app.get('/api/admin/users', requireRole('admin'), async (_req, res) => {
  const [rows] = await pool.query('SELECT id, name, email, role, college, status FROM users');
  res.json(rows);
});

// ── Admin: logs ─────────────────────────────────────────────────
app.get('/api/admin/logs', requireRole('admin'), async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY time DESC LIMIT 50');
  res.json({ items: rows });
});

// ── Ensure semesters.locked column exists ────────────────────────
let semestersLockedReady = false;
async function ensureSemestersLockedColumn() {
  try {
    const dbName = process.env.DB_NAME || '123_207_5_70_96';
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'semesters' AND COLUMN_NAME = 'locked'`,
      [dbName]
    );
    if (!cols.length) {
      await pool.query("ALTER TABLE semesters ADD COLUMN locked VARCHAR(8) DEFAULT '否' AFTER status");
    }
    semestersLockedReady = true;
  } catch (_e) {
    // Column may already exist or ALTER not supported — safe to ignore
    semestersLockedReady = true;
  }
}
ensureSemestersLockedColumn();

// ── Admin: semesters CRUD ───────────────────────────────────────
app.post('/api/admin/semesters', requireRole('admin'), async (req, res) => {
  try {
    const { name, dateRange, status, locked } = req.body || {};
    if (!name) return res.status(422).json({ code: 'VALIDATION', message: '学期名称不能为空' });
    const id = 's' + Date.now().toString(36);
    await pool.query(
      'INSERT INTO semesters (id, name, date_range, status, locked) VALUES (?, ?, ?, ?, ?)',
      [id, name, dateRange || '', status || '草稿', locked || '否']
    );
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + id, req.userId, '创建学期', name]
    );
    res.status(201).json({ id, name, date_range: dateRange || '', status: status || '草稿', locked: locked || '否' });
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/semesters/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, dateRange, status, locked } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM semesters WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '学期不存在' });
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (dateRange !== undefined) { updates.push('date_range = ?'); params.push(dateRange); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (locked !== undefined) { updates.push('locked = ?'); params.push(locked); }
    if (!updates.length) return res.status(422).json({ code: 'VALIDATION', message: '无更新字段' });
    params.push(id);
    await pool.query(`UPDATE semesters SET ${updates.join(', ')} WHERE id = ?`, params);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '更新学期', existing[0].name]
    );
    const [rows] = await pool.query('SELECT * FROM semesters WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/admin/semesters/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM semesters WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '学期不存在' });
    await pool.query('DELETE FROM semesters WHERE id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '删除学期', existing[0].name]
    );
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: courses CRUD ─────────────────────────────────────────
app.post('/api/admin/courses', requireRole('admin'), async (req, res) => {
  try {
    const { code, section, name, teacher, teacherId, semester, semesterId, students, status } = req.body || {};
    if (!code || !name) return res.status(422).json({ code: 'VALIDATION', message: '课程代码和名称不能为空' });
    const id = 'c' + Date.now().toString(36);
    // Resolve teacher_id
    let resolvedTeacherId = teacherId || null;
    if (!resolvedTeacherId && teacher) {
      const [uRows] = await pool.query('SELECT id FROM users WHERE name = ? AND role = ? LIMIT 1', [teacher, 'teacher']);
      if (uRows.length) resolvedTeacherId = uRows[0].id;
    }
    // Resolve semester_id
    let resolvedSemesterId = semesterId || null;
    if (!resolvedSemesterId && semester) {
      const [sRows] = await pool.query('SELECT id FROM semesters WHERE name = ? LIMIT 1', [semester]);
      if (sRows.length) resolvedSemesterId = sRows[0].id;
    }
    await pool.query(
      'INSERT INTO courses (id, code, section, name, teacher_id, semester_id, students, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, code, String(section || '1004'), name, resolvedTeacherId, resolvedSemesterId, Number(students) || 0, status || '正常']
    );
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + id, req.userId, '创建课程', `${code} / ${name}`]
    );
    res.status(201).json({ id, code, section: String(section || '1004'), name, teacher_id: resolvedTeacherId, semester_id: resolvedSemesterId, students: Number(students) || 0, status: status || '正常' });
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/courses/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { code, section, name, teacher, teacherId, semester, semesterId, students, status } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '课程不存在' });
    const updates = [];
    const params = [];
    if (code !== undefined) { updates.push('code = ?'); params.push(code); }
    if (section !== undefined) { updates.push('section = ?'); params.push(String(section)); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (teacherId !== undefined) { updates.push('teacher_id = ?'); params.push(teacherId); }
    else if (teacher !== undefined) {
      const [uRows] = await pool.query('SELECT id FROM users WHERE name = ? AND role = ? LIMIT 1', [teacher, 'teacher']);
      if (uRows.length) { updates.push('teacher_id = ?'); params.push(uRows[0].id); }
    }
    if (semesterId !== undefined) { updates.push('semester_id = ?'); params.push(semesterId); }
    else if (semester !== undefined) {
      const [sRows] = await pool.query('SELECT id FROM semesters WHERE name = ? LIMIT 1', [semester]);
      if (sRows.length) { updates.push('semester_id = ?'); params.push(sRows[0].id); }
    }
    if (students !== undefined) { updates.push('students = ?'); params.push(Number(students)); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (!updates.length) return res.status(422).json({ code: 'VALIDATION', message: '无更新字段' });
    params.push(id);
    await pool.query(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, params);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '更新课程', existing[0].code || id]
    );
    const [rows] = await pool.query('SELECT c.*, u.name AS teacher FROM courses c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/admin/courses/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM courses WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '课程不存在' });
    await pool.query('DELETE FROM courses WHERE id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '删除课程', existing[0].code || id]
    );
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: users CRUD ───────────────────────────────────────────
app.post('/api/admin/users', requireRole('admin'), async (req, res) => {
  try {
    const { name, email, role, scope, college, status } = req.body || {};
    if (!name || !email) return res.status(422).json({ code: 'VALIDATION', message: '姓名和邮箱不能为空' });
    const id = 'u' + Date.now().toString(36);
    await pool.query(
      'INSERT INTO users (id, name, email, password, role, college, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, email, 'password123', role || 'teacher', college || '', status || '待确认']
    );
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + id, req.userId, '创建用户', `${name} (${role || 'teacher'})`]
    );
    res.status(201).json({ id, name, email, role: role || 'teacher', college: college || '', scope: scope || '', status: status || '待确认' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ code: 'DUPLICATE', message: '邮箱已存在' });
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, scope, college, status } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' });
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (email !== undefined) { updates.push('email = ?'); params.push(email); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (college !== undefined) { updates.push('college = ?'); params.push(college); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (!updates.length) return res.status(422).json({ code: 'VALIDATION', message: '无更新字段' });
    params.push(id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '更新用户', existing[0].name]
    );
    const [rows] = await pool.query('SELECT id, name, email, role, college, status FROM users WHERE id = ?', [id]);
    // Merge scope for response (not a DB column)
    const user = rows[0];
    user.scope = scope || '';
    res.json(user);
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ code: 'DUPLICATE', message: '邮箱已存在' });
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/admin/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' });
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '删除用户', existing[0].name]
    );
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: organizations CRUD ────────────────────────────────────
// (also used by manager role for membership verification — manager can list orgs)
app.get('/api/admin/organizations', requireRole('admin','manager'), async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT o.*, u.name AS manager_name FROM organizations o LEFT JOIN users u ON o.manager_id = u.id');
    res.json(rows);
  } catch (e) {
    if (e.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    console.error('[admin/organizations]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.post('/api/admin/organizations', requireRole('admin'), async (req, res) => {
  try {
    const { name, type, managerId, description } = req.body || {};
    if (!name || !type) return res.status(422).json({ code: 'VALIDATION', message: '组织名称和类型不能为空' });
    if (!['team', 'club'].includes(type)) return res.status(422).json({ code: 'VALIDATION', message: '类型必须是 team 或 club' });
    const id = 'org-' + Date.now().toString(36);
    await pool.query(
      'INSERT INTO organizations (id, name, type, manager_id, description) VALUES (?, ?, ?, ?, ?)',
      [id, name, type, managerId || null, description || '']
    );
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + id, req.userId, '创建组织', `${name} (${type})`]
    );
    res.status(201).json({ id, name, type, manager_id: managerId || null, description: description || '', created_at: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/organizations/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, managerId, description } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM organizations WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '组织不存在' });
    const updates = [];
    const params = [];
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (type !== undefined) {
      if (!['team', 'club'].includes(type)) return res.status(422).json({ code: 'VALIDATION', message: '类型必须是 team 或 club' });
      updates.push('type = ?'); params.push(type);
    }
    if (managerId !== undefined) { updates.push('manager_id = ?'); params.push(managerId); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (!updates.length) return res.status(422).json({ code: 'VALIDATION', message: '无更新字段' });
    params.push(id);
    await pool.query(`UPDATE organizations SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '更新组织', existing[0].name]
    );
    const [rows] = await pool.query('SELECT o.*, u.name AS manager_name FROM organizations o LEFT JOIN users u ON o.manager_id = u.id WHERE o.id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/admin/organizations/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM organizations WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '组织不存在' });
    await pool.query('DELETE FROM organizations WHERE id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '删除组织', existing[0].name]
    );
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Admin: conversion rules CRUD ─────────────────────────────────
app.get('/api/admin/conversion-rules', requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version FROM conversion_rules_admin ORDER BY grade_group, gender, raw_seconds'
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.post('/api/admin/conversion-rules', requireRole('admin'), async (req, res) => {
  try {
    const { grade_group, gender, item_name, raw_value, raw_seconds, converted_score } = req.body || {};
    if (!grade_group || !gender || !item_name || raw_seconds === undefined) {
      return res.status(422).json({ code: 'VALIDATION', message: '年级组、性别、项目和秒数为必填' });
    }
    const id = 'cv-' + Date.now().toString(36);
    await pool.query(
      `INSERT INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE converted_score = VALUES(converted_score), updated_at = NOW()`,
      [id, grade_group, gender, item_name, raw_value || '', Number(raw_seconds), Number(converted_score) || 0]
    );
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + id, req.userId, '创建体测换算规则', `${grade_group} / ${gender} / ${item_name} / ${raw_seconds}s = ${converted_score}分`]
    );
    res.status(201).json({ id, grade_group, gender, item_name, raw_value: raw_value || '', raw_seconds: Number(raw_seconds), converted_score: Number(converted_score) || 0, version: 1 });
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.put('/api/admin/conversion-rules/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM conversion_rules_admin WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '规则不存在' });
    const updates = [];
    const params = [];
    if (grade_group !== undefined) { updates.push('grade_group = ?'); params.push(grade_group); }
    if (gender !== undefined) { updates.push('gender = ?'); params.push(gender); }
    if (item_name !== undefined) { updates.push('item_name = ?'); params.push(item_name); }
    if (raw_value !== undefined) { updates.push('raw_value = ?'); params.push(raw_value); }
    if (raw_seconds !== undefined) { updates.push('raw_seconds = ?'); params.push(Number(raw_seconds)); }
    if (converted_score !== undefined) { updates.push('converted_score = ?'); params.push(Number(converted_score)); }
    if (version !== undefined) { updates.push('version = ?'); params.push(Number(version)); }
    if (!updates.length) return res.status(422).json({ code: 'VALIDATION', message: '无更新字段' });
    params.push(id);
    await pool.query(`UPDATE conversion_rules_admin SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, params);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '更新体测换算规则', id]
    );
    const [rows] = await pool.query('SELECT * FROM conversion_rules_admin WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

app.delete('/api/admin/conversion-rules/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const [existing] = await pool.query('SELECT * FROM conversion_rules_admin WHERE id = ?', [id]);
    if (!existing.length) return res.status(404).json({ code: 'NOT_FOUND', message: '规则不存在' });
    await pool.query('DELETE FROM conversion_rules_admin WHERE id = ?', [id]);
    await pool.query(
      'INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())',
      ['log-' + Date.now().toString(36), req.userId, '删除体测换算规则', id]
    );
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── Student: sport summary ───────────────────────────────────────
app.get('/api/sport/summary', requireAuth, async (req, res) => {
  try {
    const studentId = req.userId;
    const [progress] = await pool.query(
      `SELECT sp.student_id, sp.course_id, sp.course_hours, sp.general_hours,
              c.code AS course_code, c.section AS course_section, c.name AS course_name,
              c.teacher_id, u.name AS teacher_name
       FROM student_progress sp
       JOIN courses c ON sp.course_id = c.id
       LEFT JOIN users u ON c.teacher_id = u.id
       WHERE sp.student_id = ?`, [studentId]
    );
    const course = progress.reduce((s, r) => s + Number(r.course_hours || 0), 0);
    const general = progress.reduce((s, r) => s + Number(r.general_hours || 0), 0);
    const [pending] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM sport_records WHERE student_id = ? AND status = '待审核'`, [studentId]
    );
    const rule = { total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2 };
    const totalCompleted = Math.min(course, rule.courseRequired) + Math.min(general, rule.generalRequired);

    // Build teacher list from progress rows (deduplicated by teacher_id)
    const teachers = [];
    const seenTeacherIds = new Set();
    for (const r of progress) {
      if (r.teacher_id && !seenTeacherIds.has(r.teacher_id)) {
        seenTeacherIds.add(r.teacher_id);
        teachers.push({ teacherId: r.teacher_id, teacherName: r.teacher_name || '' });
      }
    }

    // Build course list for the student app
    const courses = progress.map((r) => ({
      courseId: r.course_id,
      courseCode: r.course_code,
      courseSection: r.course_section,
      courseName: r.course_name,
      teacherId: r.teacher_id || '',
      teacherName: r.teacher_name || '',
      courseHours: Number(r.course_hours || 0),
      generalHours: Number(r.general_hours || 0)
    }));

    res.json({
      courseHours: course, generalHours: general,
      totalCompleted, totalRequired: rule.total,
      totalRemaining: Math.max(0, rule.total - totalCompleted),
      courseRemaining: Math.max(0, rule.courseRequired - course),
      generalRemaining: Math.max(0, rule.generalRequired - general),
      completed: totalCompleted >= rule.total,
      pendingCount: pending[0]?.cnt || 0, rule,
      teachers, courses
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: submit sport record ─────────────────────────────────
app.post('/api/sport/records', requireAuth, async (req, res) => {
  try {
    const studentId = req.userId;
    const { creditType, courseId, taskId, hours, description, proofFiles } = req.body || {};
    if (!creditType || hours == null) {
      return res.status(400).json({ code: 'VALIDATION', message: '缺少必填字段' });
    }
    if (hours < 0.5 || hours > 2) {
      return res.status(400).json({ code: 'VALIDATION', message: '小时数须在 0.5–2 之间' });
    }

    // Daily limit check (use local date: UTC+8 for BNBU campus)
    const now = new Date();
    const localDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const [todayRows] = await pool.query(
      `SELECT COALESCE(SUM(hours), 0) AS todayHours FROM sport_records
       WHERE student_id = ? AND DATE(submitted_at) = ?`, [studentId, localDate]
    );
    if (Number(todayRows[0].todayHours) + hours > 2) {
      return res.status(400).json({ code: 'DAILY_LIMIT', message: '当日学时已达上限 (2h)' });
    }

    const id = 'sr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      await conn.query(
        `INSERT INTO sport_records (id, student_id, course_id, task_id, credit_type, hours, description, proof_files, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, '待审核')`,
        [id, studentId, courseId || null, taskId || null, creditType, hours, description || '', JSON.stringify(normalizeProofFiles(proofFiles))]
      );

      // Create linked review row for teacher visibility
      // For general submissions (no courseId), course_id is NULL
      const reviewId = 'r-' + id;
      await conn.query(
        `INSERT INTO reviews (id, course_id, student_id, type, hours, status, task, reason, record_id)
         VALUES (?, ?, ?, ?, ?, '待确认', ?, ?, ?)`,
        [reviewId, courseId || null, studentId, creditType, hours, taskId || '自主打卡', '学生提交', id]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // Auto-notification
    const notifId = 'n-' + id;
    await pool.query(
      `INSERT INTO notifications (id, student_id, title, message, category) VALUES (?, ?, ?, ?, '审核反馈')`,
      [notifId, studentId, '打卡已提交', `${creditType} ${hours}h 已提交，等待老师审核`]
    );

    res.json({ id, status: '待审核', submittedAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: list sport records ──────────────────────────────────
app.get('/api/sport/records', requireAuth, async (req, res) => {
  try {
    const studentId = req.userId;
    const { status, creditType } = req.query;
    let sql = 'SELECT * FROM sport_records WHERE student_id = ?';
    const params = [studentId];

    if (status && status !== 'all') {
      const map = { pending: '待审核', approved: '已通过', rejected: '已驳回', supplement: '补材料', offset: '系统抵扣' };
      if (map[status]) { sql += ' AND status = ?'; params.push(map[status]); }
    }
    if (creditType && creditType !== 'all') {
      const map = { course_related: '课程相关', general_sport: '其他运动' };
      if (map[creditType]) { sql += ' AND credit_type = ?'; params.push(map[creditType]); }
    }
    sql += ' ORDER BY submitted_at DESC LIMIT 100';

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      id: r.id, courseId: r.course_id, taskId: r.task_id, creditType: r.credit_type,
      hours: r.hours, approvedHours: r.approved_hours, description: r.description,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      status: r.status, reviewComment: r.review_comment, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: single sport record detail ──────────────────────────
app.get('/api/sport/records/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM sport_records WHERE id = ? AND student_id = ?', [req.params.id, req.userId]);
    if (rows.length === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在' });
    const r = rows[0];
    res.json({
      id: r.id, courseId: r.course_id, taskId: r.task_id, creditType: r.credit_type,
      hours: r.hours, approvedHours: r.approved_hours, description: r.description,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      status: r.status, reviewComment: r.review_comment, submittedAt: r.submitted_at, reviewedAt: r.reviewed_at
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: supplement a rejected record ────────────────────────
app.post('/api/sport/records/:id/supplements', requireAuth, async (req, res) => {
  try {
    const { hours, description, proofFiles } = req.body || {};
    const [existing] = await pool.query('SELECT * FROM sport_records WHERE id = ? AND student_id = ?', [req.params.id, req.userId]);
    if (existing.length === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在' });
    const record = existing[0];
    if (record.status !== '已驳回' && record.status !== '补材料') {
      return res.status(400).json({ code: 'INVALID_STATUS', message: '只有被驳回或需补材料的记录才能补充' });
    }

    const oldFiles = typeof record.proof_files === 'string' ? JSON.parse(record.proof_files) : (record.proof_files || []);
    const mergedFiles = [...new Set([...oldFiles, ...normalizeProofFiles(proofFiles)])];

    await pool.query(
      `UPDATE sport_records SET hours = ?, description = ?, proof_files = ?, status = '待审核', review_comment = '补充材料已提交，等待复审' WHERE id = ?`,
      [hours || record.hours, description || record.description, JSON.stringify(mergedFiles), req.params.id]
    );

    res.json({ id: req.params.id, status: '待审核', message: '补充材料已提交' });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: sport identity (memberships) ────────────────────────
app.get('/api/sport/identity', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m
       JOIN users u ON m.student_id = u.id
       WHERE m.student_id = ? ORDER BY m.updated_at DESC`, [req.userId]
    );
    res.json(rows.map((r) => ({
      id: r.id, type: r.type, organization: r.organization, studentId: r.student_id,
      studentName: r.student_name || '', status: r.status, validUntil: r.valid_until, offset: r.offset_status,
      comment: r.comment, updatedBy: r.updated_by, updatedAt: r.updated_at
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: notifications ───────────────────────────────────────
app.get('/api/common/notifications', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE student_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(rows.map((r) => ({
      id: r.id, title: r.title, message: r.message, time: r.created_at,
      category: r.category, isUnread: r.is_read !== 1
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/common/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND student_id = ?',
      [req.params.id, req.userId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '通知不存在' });
    res.json({ id: req.params.id, read: true });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Teacher: all check-in records for a specific student ──────────
app.get('/api/teacher/students/:id/records', requireRole('teacher','admin'), async (req, res) => {
  try {
    const studentId = req.params.id;

    // Regular sport records
    const [records] = await pool.query(
      `SELECT sr.*, 'student' AS record_source FROM sport_records sr WHERE sr.student_id = ?`,
      [studentId]
    );

    // Membership-based offsets (team/club)
    const [memberships] = await pool.query(
      `SELECT m.*, 'membership' AS record_source FROM memberships m WHERE m.student_id = ?`,
      [studentId]
    );

    // Build unified record list
    const unifiedRecords = records.map((r) => ({
      id: r.id,
      source: r.record_source || 'student',
      creditType: r.credit_type,
      hours: r.hours,
      approvedHours: r.approved_hours,
      description: r.description,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      status: r.status,
      reviewComment: r.review_comment,
      submittedAt: r.submitted_at,
      reviewedAt: r.reviewed_at,
      courseId: r.course_id,
      taskId: r.task_id
    }));

    // Add membership offset records
    for (const m of memberships) {
      if (m.offset_status === '可抵扣' && m.status === '认证有效') {
        unifiedRecords.push({
          id: 'offset-' + m.id,
          source: m.type === 'team' ? 'team' : 'club',
          creditType: '其他运动',
          hours: 10.0,
          approvedHours: 10.0,
          description: `${m.organization} 抵扣`,
          proofFiles: [],
          status: '系统抵扣',
          reviewComment: m.comment || '',
          submittedAt: m.updated_at,
          reviewedAt: m.updated_at,
          courseId: null,
          taskId: null
        });
      }
    }

    // Also fetch basic student info
    const [users] = await pool.query(
      'SELECT id, name, gender, grade_level, college FROM users WHERE id = ?',
      [studentId]
    );
    const student = users[0] || null;

    res.json({ student, records: unifiedRecords });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Admin: membership decision ────────────────────────────────────
app.put('/api/admin/memberships/:id/decision', requireRole('admin'), async (req, res) => {
  try {
    const { status, offset, comment } = req.body || {};
    if (!status) return res.status(400).json({ code: 'VALIDATION', message: '缺少审核决定' });

    const [result] = await pool.query(
      'UPDATE memberships SET status = ?, offset_status = ?, comment = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [status, offset || '待确认', comment || '', req.userId, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '成员记录不存在' });

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m JOIN users u ON m.student_id = u.id WHERE m.id = ?`,
      [req.params.id]
    );
    res.json({ membership: rows[0] });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Teacher: confirm team/club offset (final say) ─────────────────
app.put('/api/teacher/team-offset/:id/confirm', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { confirmed } = req.body || {};
    const newStatus = confirmed ? '可抵扣' : '不抵扣';

    const [result] = await pool.query(
      'UPDATE memberships SET offset_status = ?, updated_by = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, req.userId, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '记录不存在' });

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m JOIN users u ON m.student_id = u.id WHERE m.id = ?`,
      [req.params.id]
    );
    res.json({ membership: rows[0], confirmedBy: req.userId });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Scoring: endurance run time-to-score conversion ───────────────
app.post('/api/scoring/convert-endurance', requireAuth, async (req, res) => {
  try {
    const { timeSeconds, gender, gradeLevel } = req.body || {};
    if (timeSeconds == null || !gender || !gradeLevel) {
      return res.status(400).json({ code: 'VALIDATION', message: '缺少 timeSeconds, gender, gradeLevel' });
    }

    const gradeGroup = ['freshman','sophomore'].includes(gradeLevel)
      ? 'freshman_sophomore' : 'junior_senior';

    const [rows] = await pool.query(
      `SELECT score, tier, time_seconds_min, time_seconds_max
       FROM endurance_scoring_rules
       WHERE gender = ? AND grade_group = ? AND ? >= time_seconds_min AND ? <= time_seconds_max
       ORDER BY score DESC LIMIT 1`,
      [gender, gradeGroup, timeSeconds, timeSeconds]
    );

    if (rows.length === 0) {
      // Time faster than 100-point standard
      const [best] = await pool.query(
        `SELECT score, tier FROM endurance_scoring_rules
         WHERE gender = ? AND grade_group = ? ORDER BY score DESC LIMIT 1`,
        [gender, gradeGroup]
      );
      if (best.length > 0) {
        return res.json({ score: best[0].score, tier: best[0].tier, timeSeconds, gender, gradeLevel, gradeGroup, note: '成绩优于满分标准' });
      }
      return res.status(404).json({ code: 'NOT_FOUND', message: '未找到匹配的评分规则' });
    }

    const rule = rows[0];
    res.json({
      score: rule.score,
      tier: rule.tier,
      timeSeconds,
      gender,
      gradeLevel,
      gradeGroup,
      range: { min: rule.time_seconds_min, max: rule.time_seconds_max }
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: list my exemptions ────────────────────────────────────
app.get('/api/student/exemptions', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, u.name AS reviewer_name FROM exemptions e
       LEFT JOIN users u ON e.reviewer_id = u.id
       WHERE e.student_id = ? ORDER BY e.created_at DESC`,
      [req.userId]
    );
    res.json(rows.map((r) => ({
      id: r.id, studentId: r.student_id, type: r.type,
      reason: r.reason, status: r.status,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      reviewComment: r.review_comment, reviewerId: r.reviewer_id,
      reviewerName: r.reviewer_name || '',
      createdAt: r.created_at, updatedAt: r.updated_at
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.post('/api/student/exemptions', requireAuth, async (req, res) => {
  try {
    const { type, reason, proofFiles } = req.body || {};
    if (!type) return res.status(400).json({ code: 'VALIDATION', message: '请选择免测类型 (800m / 1000m)' });

    // Check for existing pending application
    const [existing] = await pool.query(
      `SELECT id FROM exemptions WHERE student_id = ? AND type = ? AND status = '待审核'`,
      [req.userId, type]
    );
    if (existing.length > 0) {
      return res.status(409).json({ code: 'DUPLICATE', message: '你已有一份待审核的同类型免测申请，请勿重复提交' });
    }

    const id = 'ex-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    await pool.query(
      `INSERT INTO exemptions (id, student_id, type, reason, proof_files, status)
       VALUES (?, ?, ?, ?, ?, '待审核')`,
      [id, req.userId, type, reason || '', JSON.stringify(normalizeProofFiles(proofFiles))]
    );

    res.json({ id, status: '待审核', createdAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Teacher: list exemptions for my students ───────────────────────
app.get('/api/teacher/exemptions', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { status } = req.query;
    let sql, params;

    if (req.userRole === 'admin') {
      sql = `SELECT e.*, u.name AS student_name, u.gender, u.grade_level, u.college
             FROM exemptions e JOIN users u ON e.student_id = u.id`;
      params = [];
    } else {
      // Teacher can only see exemptions for students in their courses
      sql = `SELECT DISTINCT e.*, u.name AS student_name, u.gender, u.grade_level, u.college
             FROM exemptions e
             JOIN users u ON e.student_id = u.id
             JOIN student_progress sp ON u.id = sp.student_id
             JOIN courses c ON sp.course_id = c.id
             WHERE c.teacher_id = ?`;
      params = [req.userId];
    }

    if (status && status !== 'all') {
      const statusMap = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
      if (statusMap[status]) { sql += ' AND e.status = ?'; params.push(statusMap[status]); }
    }
    sql += ' ORDER BY e.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      gender: r.gender, gradeLevel: r.grade_level, college: r.college,
      type: r.type, reason: r.reason, status: r.status,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      reviewComment: r.review_comment, reviewerId: r.reviewer_id,
      createdAt: r.created_at, updatedAt: r.updated_at
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/teacher/exemptions/:id/decision', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { status, comment } = req.body || {};
    if (!status || !['已通过','已驳回'].includes(status)) {
      return res.status(400).json({ code: 'VALIDATION', message: '审核结果只能为 已通过 或 已驳回' });
    }

    const [result] = await pool.query(
      'UPDATE exemptions SET status = ?, review_comment = ?, reviewer_id = ?, updated_at = NOW() WHERE id = ?',
      [status, comment || '', req.userId, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '免测申请不存在' });

    const [rows] = await pool.query(
      `SELECT e.*, u.name AS student_name FROM exemptions e
       JOIN users u ON e.student_id = u.id WHERE e.id = ?`,
      [req.params.id]
    );
    res.json({ exemption: rows[0] });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: my tasks (pending / completed) ────────────────────────
app.get('/api/student/tasks', requireAuth, async (req, res) => {
  try {
    const studentId = req.userId;

    // Get all courses the student is enrolled in
    const [enrollments] = await pool.query(
      'SELECT course_id FROM student_progress WHERE student_id = ?',
      [studentId]
    );
    if (enrollments.length === 0) return res.json({ pending: [], completed: [] });

    const courseIds = enrollments.map((e) => e.course_id);

    // Get tasks for enrolled courses
    const [tasks] = await pool.query(
      `SELECT t.*, c.code AS course_code, c.section AS course_section, c.name AS course_name
       FROM tasks t JOIN courses c ON t.course_id = c.id
       WHERE t.course_id IN (?) AND t.status != '草稿'
       ORDER BY t.deadline ASC`,
      [courseIds]
    );

    // Check completion status: a task is "completed" if the student has an approved sport_record for it
    const [completedRecords] = await pool.query(
      `SELECT task_id FROM sport_records
       WHERE student_id = ? AND task_id IS NOT NULL AND status = '已通过'`,
      [studentId]
    );
    const completedTaskIds = new Set(completedRecords.map((r) => r.task_id));

    const pending = [];
    const completed = [];
    for (const t of tasks) {
      const taskObj = {
        id: t.id, courseId: t.course_id,
        courseCode: t.course_code, courseSection: t.course_section,
        courseName: t.course_name,
        title: t.title, description: t.description,
        creditType: t.credit_type, requiredHours: t.required_hours,
        deadline: t.deadline, status: t.status
      };
      if (completedTaskIds.has(t.id)) {
        completed.push({ ...taskObj, completedAt: null });
      } else {
        pending.push(taskObj);
      }
    }

    res.json({ pending, completed });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Student: profile read ──────────────────────────────────────────
app.get('/api/student/profile', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, role, college, gender, grade_level, status FROM users WHERE id = ?',
      [req.userId]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: '用户不存在' });

    // Get enrolled course count
    const [enrollments] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM student_progress WHERE student_id = ?',
      [req.userId]
    );

    res.json({
      id: user.id, name: user.name, email: user.email,
      role: user.role, college: user.college || '',
      gender: user.gender, gradeLevel: user.grade_level,
      status: user.status,
      enrolledCourses: enrollments[0]?.cnt || 0
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

app.put('/api/student/profile', requireAuth, async (req, res) => {
  try {
    const { gender, gradeLevel } = req.body || {};
    const updates = [];
    const params = [];

    if (gender) {
      if (!['male','female'].includes(gender)) return res.status(400).json({ code: 'VALIDATION', message: '性别只能为 male 或 female' });
      updates.push('gender = ?');
      params.push(gender);
    }
    if (gradeLevel) {
      if (!['freshman','sophomore','junior','senior'].includes(gradeLevel)) return res.status(400).json({ code: 'VALIDATION', message: '无效的年级' });
      updates.push('grade_level = ?');
      params.push(gradeLevel);
    }

    if (updates.length === 0) return res.status(400).json({ code: 'VALIDATION', message: '无有效更新字段' });

    params.push(req.userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    // Return updated profile
    const [rows] = await pool.query(
      'SELECT id, name, email, role, college, gender, grade_level, status FROM users WHERE id = ?',
      [req.userId]
    );
    res.json({ profile: rows[0] });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Admin: batch import students ────────────────────────────────────
app.post('/api/admin/import-students', requireRole('admin'), async (req, res) => {
  try {
    const { students } = req.body || {};
    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ code: 'VALIDATION', message: '请提供学生数据数组' });
    }

    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (const s of students) {
      if (!s.id || !s.name) {
        skipped++;
        errors.push(`缺少学号或姓名: ${JSON.stringify(s)}`);
        continue;
      }
      try {
        await pool.query(
          `INSERT INTO users (id, name, email, password, role, college, gender, grade_level, status)
           VALUES (?, ?, ?, 'password123', 'student', ?, ?, ?, '正常')
           ON DUPLICATE KEY UPDATE
             name = VALUES(name), college = VALUES(college),
             gender = VALUES(gender), grade_level = VALUES(grade_level)`,
          [s.id, s.name, `${s.id}@bnbu.edu.cn`, s.college || '', s.gender || null, s.gradeLevel || null]
        );
        imported++;
      } catch (err) {
        skipped++;
        errors.push(`${s.id}: ${err.message}`);
      }
    }

    res.json({ imported, skipped, total: students.length, errors: errors.slice(0, 20) });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ──────────────────────────────────────────────────────────────────
// v4: Supplemental features — hours detail, pending certs, per-second
//     conversion table, course-scoped exemptions, org identity
// ──────────────────────────────────────────────────────────────────

// ── Feature #1A: Student hours detail (aggregated by source type) ──
app.get('/api/teacher/courses/:courseId/students/:studentId/hours-detail', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;

    // Student-submitted sport records for this course
    const [records] = await pool.query(
      `SELECT sr.*, 'student' AS source_type FROM sport_records sr
       WHERE sr.student_id = ? AND (sr.course_id = ? OR sr.course_id IS NULL)
       ORDER BY sr.submitted_at DESC`,
      [studentId, courseId]
    );

    // Teacher-assigned tasks completed by this student
    const [completedTasks] = await pool.query(
      `SELECT t.*, sr.status AS record_status, sr.approved_hours, sr.submitted_at, sr.reviewed_at
       FROM tasks t
       JOIN sport_records sr ON sr.task_id = t.id AND sr.student_id = ?
       WHERE t.course_id = ?`,
      [studentId, courseId]
    );

    // Team/club membership offsets
    const [memberships] = await pool.query(
      `SELECT m.* FROM memberships m WHERE m.student_id = ?`,
      [studentId]
    );

    // Manual credits from teacher
    const [manualCredits] = await pool.query(
      `SELECT mc.*, u.name AS operator_name FROM manual_credits mc
       LEFT JOIN users u ON mc.operator_id = u.id
       WHERE mc.student_id = ? AND mc.course_id = ?
       ORDER BY mc.created_at DESC`,
      [studentId, courseId]
    );

    // Build unified record list
    const items = [];

    // Source 1: Student self-submitted check-ins
    for (const r of records) {
      items.push({
        sourceType: '学生自提交（课程相关）',
        sourceCategory: 'student_course',
        sportType: r.credit_type || '',
        appliedHours: Number(r.hours || 0),
        approvedHours: Number(r.approved_hours || 0),
        submittedAt: r.submitted_at,
        status: r.status,
        reviewer: r.review_comment || '',
        description: r.description || '',
        proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
        recordId: r.id
      });
    }

    // Source 2: Teacher-assigned task completions
    for (const t of completedTasks) {
      items.push({
        sourceType: '老师任务完成',
        sourceCategory: 'teacher_task',
        sportType: t.credit_type || '',
        appliedHours: Number(t.required_hours || 0),
        approvedHours: Number(t.approved_hours || 0),
        submittedAt: t.submitted_at,
        status: t.record_status || '进行中',
        reviewer: '',
        description: t.title || '',
        proofFiles: [],
        recordId: t.id
      });
    }

    // Source 3: Team/club offsets
    for (const m of memberships) {
      if (m.offset_status === '可抵扣' && m.status === '认证有效') {
        items.push({
          sourceType: m.type === 'team' ? '校队抵扣' : '社团抵扣',
          sourceCategory: m.type === 'team' ? 'team' : 'club',
          sportType: '其他运动',
          appliedHours: Number(m.offset_hours || 10.0),
          approvedHours: Number(m.offset_hours || 10.0),
          submittedAt: m.updated_at,
          status: '系统抵扣',
          reviewer: m.updated_by || '',
          description: `${m.organization} 抵扣`,
          proofFiles: [],
          recordId: 'offset-' + m.id
        });
      }
    }

    // Source 4: Manual credits from teacher
    for (const mc of manualCredits) {
      items.push({
        sourceType: '老师手动加抵',
        sourceCategory: 'manual',
        sportType: mc.credit_type || '',
        appliedHours: Number(mc.hours || 0),
        approvedHours: Number(mc.hours || 0),
        submittedAt: mc.created_at,
        status: '已通过',
        reviewer: mc.operator_name || mc.operator_id || '',
        description: mc.reason || '',
        proofFiles: typeof mc.proof_files === 'string' ? JSON.parse(mc.proof_files) : (mc.proof_files || []),
        recordId: 'manual-' + mc.id
      });
    }

    // Sort by time descending
    items.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

    // Aggregate summary
    const summary = {
      studentSubmitted: items.filter(i => i.sourceCategory === 'student_course').reduce((s, i) => s + i.approvedHours, 0),
      teacherTask: items.filter(i => i.sourceCategory === 'teacher_task').reduce((s, i) => s + i.approvedHours, 0),
      teamOffset: items.filter(i => i.sourceCategory === 'team').reduce((s, i) => s + i.approvedHours, 0),
      clubOffset: items.filter(i => i.sourceCategory === 'club').reduce((s, i) => s + i.approvedHours, 0),
      manualCredit: items.filter(i => i.sourceCategory === 'manual').reduce((s, i) => s + i.approvedHours, 0),
      totalApplied: items.reduce((s, i) => s + i.appliedHours, 0),
      totalApproved: items.reduce((s, i) => s + i.approvedHours, 0)
    };

    res.json({ studentId, courseId, items, summary });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #1B: Teacher manual credit entry ─────────────────────
app.post('/api/teacher/courses/:courseId/students/:studentId/manual-credit', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { courseId, studentId } = req.params;
    const { creditType, hours, reason, proofFiles } = req.body || {};

    if (!creditType || !['课程相关','其他运动'].includes(creditType)) {
      return res.status(400).json({ code: 'VALIDATION', message: '抵扣类型只能为 课程相关 或 其他运动' });
    }
    if (!hours || Number(hours) <= 0 || Number(hours) > 20) {
      return res.status(400).json({ code: 'VALIDATION', message: '抵扣小时数须在 0.1–20 之间' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ code: 'VALIDATION', message: '原因说明为必填项' });
    }

    const id = 'mc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    await pool.query(
      `INSERT INTO manual_credits (id, student_id, course_id, credit_type, hours, reason, proof_files, operator_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, studentId, courseId, creditType, Number(hours), reason.trim(), JSON.stringify(normalizeProofFiles(proofFiles)), req.userId]
    );

    // Write audit log
    const logId = 'log-' + id;
    const [student] = await pool.query('SELECT name FROM users WHERE id = ?', [studentId]);
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, '手动加抵卡', `${student[0]?.name || studentId} / ${creditType} ${hours}h / ${reason.trim().slice(0, 50)}`]
    );

    // Update student_progress hours
    if (creditType === '课程相关') {
      await pool.query('UPDATE student_progress SET course_hours = course_hours + ? WHERE student_id = ? AND course_id = ?', [Number(hours), studentId, courseId]);
    } else {
      await pool.query('UPDATE student_progress SET general_hours = general_hours + ? WHERE student_id = ? AND course_id = ?', [Number(hours), studentId, courseId]);
    }

    res.json({ id, status: '已通过', createdAt: new Date().toISOString() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #2A: Pending certifications list for teacher ─────────
app.get('/api/teacher/courses/:courseId/pending-certifications', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { courseId } = req.params;

    // Find all students enrolled in this course
    const [enrollments] = await pool.query(
      'SELECT student_id FROM student_progress WHERE course_id = ?', [courseId]
    );
    const studentIds = enrollments.map(e => e.student_id);
    if (studentIds.length === 0) return res.json({ items: [], count: 0 });

    // Query memberships where offset is pending teacher confirmation
    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name, u.gender, u.grade_level, u.college
       FROM memberships m
       JOIN users u ON m.student_id = u.id
       WHERE m.student_id IN (?)
         AND m.offset_status = '待确认'
         AND m.status = '认证有效'
       ORDER BY m.updated_at DESC`,
      [studentIds]
    );

    res.json({ items: rows, count: rows.length });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #2B: Confirm certification with optional hour adjustment ─
app.put('/api/teacher/certifications/:certId/confirm', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { certId } = req.params;
    const { adjustedHours } = req.body || {};

    const hours = adjustedHours != null ? Number(adjustedHours) : null;
    if (hours !== null && (hours <= 0 || hours > 20)) {
      return res.status(400).json({ code: 'VALIDATION', message: '调整后小时数须在 0.1–20 之间' });
    }

    const updates = ['offset_status = ?', 'confirmed_by = ?', 'confirmed_at = NOW()'];
    const params = ['可抵扣', req.userId];
    if (hours !== null) {
      updates.push('offset_hours = ?');
      params.push(hours);
    }

    params.push(certId);
    const [result] = await pool.query(
      `UPDATE memberships SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '抵扣记录不存在' });

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m
       JOIN users u ON m.student_id = u.id WHERE m.id = ?`,
      [certId]
    );

    // Update student_progress for the student's course
    const m = rows[0];
    const [enrollments] = await pool.query(
      'SELECT course_id FROM student_progress WHERE student_id = ?', [m.student_id]
    );
    for (const enroll of enrollments) {
      await pool.query(
        'UPDATE student_progress SET general_hours = GREATEST(general_hours, ?) WHERE student_id = ? AND course_id = ?',
        [Number(m.offset_hours || 10.0), m.student_id, enroll.course_id]
      );
    }

    // Audit log
    const logId = 'log-cert-' + Date.now();
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, '确认校队/社团抵扣', `${m.student_name} / ${m.organization} / ${m.offset_hours || 10.0}h`]
    );

    res.json({ membership: rows[0], confirmedBy: req.userId, adjustedHours: hours });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #2C: Reject certification ────────────────────────────
app.put('/api/teacher/certifications/:certId/reject', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { certId } = req.params;
    const { reason } = req.body || {};
    if (!reason || !reason.trim()) {
      return res.status(400).json({ code: 'VALIDATION', message: '驳回原因为必填项' });
    }

    const [result] = await pool.query(
      `UPDATE memberships SET offset_status = '不抵扣', rejection_reason = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?`,
      [reason.trim(), req.userId, certId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '抵扣记录不存在' });

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m
       JOIN users u ON m.student_id = u.id WHERE m.id = ?`,
      [certId]
    );

    // Notify student
    const notifId = 'n-rej-' + Date.now();
    await pool.query(
      `INSERT INTO notifications (id, student_id, title, message, category) VALUES (?, ?, ?, ?, '审核反馈')`,
      [notifId, rows[0].student_id, '校队/社团抵扣被驳回', `${rows[0].organization} 抵扣未通过审核。原因：${reason.trim().slice(0, 200)}`]
    );

    res.json({ membership: rows[0], rejectedBy: req.userId, reason: reason.trim() });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #3A: Get per-second conversion table ──────────────────
app.get('/api/admin/conversion-table/:gradeGroup/:gender', requireRole('admin'), async (req, res) => {
  try {
    const { gradeGroup, gender } = req.params;
    if (!['freshman_sophomore','junior_senior'].includes(gradeGroup)) {
      return res.status(400).json({ code: 'VALIDATION', message: '年级组无效' });
    }
    if (!['male','female'].includes(gender)) {
      return res.status(400).json({ code: 'VALIDATION', message: '性别无效' });
    }

    const [rows] = await pool.query(
      `SELECT * FROM conversion_rules_admin
       WHERE grade_group = ? AND gender = ?
       ORDER BY raw_seconds ASC`,
      [gradeGroup, gender]
    );

    // Check for gaps
    const gaps = [];
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].raw_seconds !== rows[i-1].raw_seconds + 1) {
        gaps.push({
          fromSeconds: rows[i-1].raw_seconds,
          toSeconds: rows[i].raw_seconds,
          missingCount: rows[i].raw_seconds - rows[i-1].raw_seconds - 1
        });
      }
    }

    res.json({
      gradeGroup, gender,
      entries: rows,
      count: rows.length,
      scoreRange: rows.length > 0 ? `${rows[rows.length-1].converted_score} – ${rows[0].converted_score}` : '无数据',
      timeRange: rows.length > 0 ? `${rows[0].raw_seconds}s – ${rows[rows.length-1].raw_seconds}s` : '无数据',
      gaps,
      hasGaps: gaps.length > 0
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #3B: Replace per-second conversion table (batch) ─────
app.put('/api/admin/conversion-table/:gradeGroup/:gender', requireRole('admin'), async (req, res) => {
  try {
    const { gradeGroup, gender } = req.params;
    const { entries } = req.body || {};
    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ code: 'VALIDATION', message: '请提供换算表数据数组' });
    }

    // Validate no gaps: entries must be contiguous by raw_seconds
    const sorted = [...entries].sort((a, b) => a.raw_seconds - b.raw_seconds);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].raw_seconds !== sorted[i-1].raw_seconds + 1) {
        return res.status(400).json({
          code: 'VALIDATION',
          message: `存在空档：${sorted[i-1].raw_seconds}s (分数${sorted[i-1].converted_score}) 到 ${sorted[i].raw_seconds}s (分数${sorted[i].converted_score}) 之间有 ${sorted[i].raw_seconds - sorted[i-1].raw_seconds - 1} 秒空缺`
        });
      }
    }

    // Delete old entries and insert new ones in a transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        'DELETE FROM conversion_rules_admin WHERE grade_group = ? AND gender = ?',
        [gradeGroup, gender]
      );
      for (const e of entries) {
        const id = `cv-${gradeGroup}-${gender}-${e.raw_seconds}`;
        const rawValue = e.raw_value || `${Math.floor(e.raw_seconds/60)}'${String(e.raw_seconds%60).padStart(2,'0')}"`;
        await conn.query(
          `INSERT INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE converted_score = VALUES(converted_score), raw_value = VALUES(raw_value)`,
          [id, gradeGroup, gender, gender === 'male' ? '1000m' : '800m', rawValue, e.raw_seconds, e.converted_score]
        );
      }
      await conn.commit();
      res.json({ gradeGroup, gender, savedCount: entries.length, updatedAt: new Date().toISOString() });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #3C: Validate conversion table ────────────────────────
app.post('/api/admin/conversion-table/validate', requireRole('admin'), async (req, res) => {
  try {
    const combinations = [
      { gradeGroup: 'freshman_sophomore', gender: 'male', item: '1000m' },
      { gradeGroup: 'freshman_sophomore', gender: 'female', item: '800m' },
      { gradeGroup: 'junior_senior', gender: 'male', item: '1000m' },
      { gradeGroup: 'junior_senior', gender: 'female', item: '800m' }
    ];

    const results = [];
    for (const { gradeGroup, gender, item } of combinations) {
      const [rows] = await pool.query(
        'SELECT raw_seconds, converted_score FROM conversion_rules_admin WHERE grade_group = ? AND gender = ? ORDER BY raw_seconds ASC',
        [gradeGroup, gender]
      );
      const gaps = [];
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].raw_seconds !== rows[i-1].raw_seconds + 1) {
          gaps.push({ fromSeconds: rows[i-1].raw_seconds, toSeconds: rows[i].raw_seconds, missingCount: rows[i].raw_seconds - rows[i-1].raw_seconds - 1 });
        }
      }
      results.push({
        gradeGroup, gender, item, entryCount: rows.length,
        scoreRange: rows.length > 0 ? `${rows[0].converted_score} – ${rows[rows.length-1].converted_score}` : '无',
        hasGaps: gaps.length > 0, gaps
      });
    }

    res.json({ results, allValid: results.every(r => !r.hasGaps && r.entryCount > 0) });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #3D: Auto-convert for a specific student ──────────────
app.get('/api/teacher/conversion/calculate', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { studentId, rawSeconds } = req.query;
    if (!studentId) return res.status(400).json({ code: 'VALIDATION', message: '缺少 studentId' });
    if (rawSeconds == null || Number(rawSeconds) <= 0) return res.status(400).json({ code: 'VALIDATION', message: '缺少 rawSeconds' });

    const timeSec = Number(rawSeconds);

    // Get student gender + grade
    const [users] = await pool.query('SELECT gender, grade_level FROM users WHERE id = ?', [studentId]);
    if (users.length === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '学生不存在' });
    const { gender, grade_level } = users[0];
    if (!gender || !grade_level) {
      return res.status(400).json({ code: 'VALIDATION', message: '学生缺少性别或年级信息，请先完善学生档案' });
    }

    const gradeGroup = ['freshman','sophomore'].includes(grade_level)
      ? 'freshman_sophomore' : 'junior_senior';

    // Look up per-second conversion table
    const [rows] = await pool.query(
      `SELECT converted_score FROM conversion_rules_admin
       WHERE grade_group = ? AND gender = ? AND raw_seconds = ?
       LIMIT 1`,
      [gradeGroup, gender, timeSec]
    );

    let score;
    if (rows.length > 0) {
      score = Number(rows[0].converted_score);
    } else {
      // Fallback to endurance_scoring_rules (legacy tiered table)
      const [legacy] = await pool.query(
        `SELECT score, tier FROM endurance_scoring_rules
         WHERE gender = ? AND grade_group = ? AND ? >= time_seconds_min AND ? <= time_seconds_max
         ORDER BY score DESC LIMIT 1`,
        [gender, gradeGroup, timeSec, timeSec]
      );
      if (legacy.length > 0) {
        score = Number(legacy[0].score);
      } else {
        // Time faster than best — return max score
        const [best] = await pool.query(
          `SELECT MAX(score) AS max_score FROM endurance_scoring_rules
           WHERE gender = ? AND grade_group = ?`,
          [gender, gradeGroup]
        );
        score = best[0]?.max_score || 100;
      }
    }

    // Also get the tier
    let tier = 'fail';
    if (score >= 90) tier = 'excellent';
    else if (score >= 80) tier = 'good';
    else if (score >= 60) tier = 'pass';

    // Format the raw time for display
    const mins = Math.floor(timeSec / 60);
    const secs = timeSec % 60;
    const rawDisplay = `${mins}'${String(secs).padStart(2,'0')}"`;

    res.json({
      studentId, gender, gradeLevel: grade_level, gradeGroup,
      rawSeconds: timeSec, rawDisplay,
      convertedScore: score, tier,
      itemName: gender === 'male' ? '1000m' : '800m'
    });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #4: Course-scoped exemptions for teacher ──────────────
app.get('/api/teacher/courses/:courseId/exemptions', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { status } = req.query;

    // Get students in this course
    const [enrollments] = await pool.query(
      'SELECT student_id FROM student_progress WHERE course_id = ?', [courseId]
    );
    const studentIds = enrollments.map(e => e.student_id);
    if (studentIds.length === 0) return res.json([]);

    let sql = `SELECT e.*, u.name AS student_name, u.gender, u.grade_level, u.college
               FROM exemptions e
               JOIN users u ON e.student_id = u.id
               WHERE e.student_id IN (?)`;
    const params = [studentIds];

    if (status && status !== 'all') {
      const statusMap = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
      if (statusMap[status]) { sql += ' AND e.status = ?'; params.push(statusMap[status]); }
    }
    sql += ' ORDER BY e.created_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows.map((r) => ({
      id: r.id, studentId: r.student_id, studentName: r.student_name,
      gender: r.gender, gradeLevel: r.grade_level, college: r.college,
      type: r.type, reason: r.reason, status: r.status,
      proofFiles: typeof r.proof_files === 'string' ? JSON.parse(r.proof_files) : (r.proof_files || []),
      reviewComment: r.review_comment, reviewerId: r.reviewer_id,
      courseId: r.course_id,
      createdAt: r.created_at, updatedAt: r.updated_at
    })));
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #5A: Teacher views student organization identity ──────
app.get('/api/teacher/courses/:courseId/students/:studentId/organization-identity', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const { studentId } = req.params;

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m
       JOIN users u ON m.student_id = u.id
       WHERE m.student_id = ?
       ORDER BY m.updated_at DESC`,
      [studentId]
    );

    const identities = rows.map((r) => ({
      id: r.id,
      type: r.type,           // team / club
      typeLabel: r.type === 'team' ? '校队' : '社团',
      organization: r.organization,
      isSport: r.type === 'team' ? true : (r.status !== '非体育类'),
      status: r.status,        // 认证有效 / 待确认 / 不通过 / 非体育类
      statusLabel: r.status,
      validUntil: r.valid_until,
      offsetStatus: r.offset_status,
      offsetStatusLabel: r.offset_status,
      offsetHours: Number(r.offset_hours || 10.0),
      comment: r.comment || '',
      rejectionReason: r.rejection_reason || '',
      confirmedBy: r.confirmed_by || '',
      confirmedAt: r.confirmed_at || '',
      updatedBy: r.updated_by || '',
      updatedAt: r.updated_at || ''
    }));

    res.json({ studentId, identities });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ── Feature #5B: Teacher flags organization identity ───────────────
app.put('/api/teacher/students/:studentId/organization-identity/:identityId/flag', requireRole('teacher','admin'), async (req, res) => {
  try {
    const { studentId, identityId } = req.params;
    const { flag, comment } = req.body || {};

    if (!['confirmed','questionable'].includes(flag)) {
      return res.status(400).json({ code: 'VALIDATION', message: 'flag 只能为 confirmed 或 questionable' });
    }

    const newStatus = flag === 'confirmed' ? '认证有效' : '待确认';
    const newComment = comment || (flag === 'confirmed' ? '任课老师已确认身份信息无误' : '任课老师标记存疑');

    const [result] = await pool.query(
      `UPDATE memberships SET status = ?, comment = CONCAT(COALESCE(comment,''), '\n', ?), updated_by = ?, updated_at = NOW()
       WHERE id = ? AND student_id = ?`,
      [newStatus, newComment, req.userId, identityId, studentId]
    );
    if (result.affectedRows === 0) return res.status(404).json({ code: 'NOT_FOUND', message: '组织身份记录不存在' });

    const [rows] = await pool.query(
      `SELECT m.*, u.name AS student_name FROM memberships m
       JOIN users u ON m.student_id = u.id WHERE m.id = ?`,
      [identityId]
    );

    // Audit log
    const logId = 'log-flag-' + Date.now();
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, flag === 'confirmed' ? '确认组织身份' : '标记组织身份存疑', `${rows[0].student_name} / ${rows[0].organization}`]
    );

    res.json({ identity: rows[0], flag, comment: newComment });
  } catch (e) { res.status(500).json({ code: 'DB_ERROR', message: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// Phase 1 P0: Delivery (成绩归档) — teacher submit + admin audit
// ═══════════════════════════════════════════════════════════════════

// Teacher: submit course grades for admin delivery/archiving
app.post('/api/teacher/courses/:courseId/delivery', requireRole('teacher','admin'), requireCourseAccess(), async (req, res) => {
  try {
    const courseId = req.params.courseId;
    const [courses] = await pool.query('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!courses || !courses.length) return res.status(404).json({ code: 'NOT_FOUND', message: '课程不存在' });

    const { comment } = req.body || {};

    // Count export issues
    const [students] = await pool.query('SELECT * FROM student_progress WHERE course_id = ?', [courseId]);
    const checkinNotEnough = students.filter((s) => (s.course_hours || 0) < 10 || (s.general_hours || 0) < 10);
    const missingPhysical = students.filter((s) => !s.physical_score);
    const issueCount = checkinNotEnough.length + missingPhysical.length;

    const deliveryId = 'dlv-' + Date.now();
    const status = issueCount === 0 ? '预检通过' : '待管理员确认';

    // Use INSERT ... ON DUPLICATE KEY UPDATE for idempotent re-submission
    await pool.query(
      `INSERT INTO deliveries (id, course_id, submitted_by, submitted_at, status, issue_count, comment)
       VALUES (?, ?, ?, NOW(), ?, ?, ?)
       ON DUPLICATE KEY UPDATE submitted_by = VALUES(submitted_by), submitted_at = NOW(),
                               status = VALUES(status), issue_count = VALUES(issue_count),
                               comment = VALUES(comment)`,
      [deliveryId, courseId, req.userId, status, issueCount, comment || '']
    );

    // Audit log
    const logId = 'log-' + Date.now();
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, '提交成绩归档', `${courses[0].code} / Section ${courses[0].section}`]
    );

    res.json({
      deliveryId,
      courseId,
      status,
      issueCount,
      submittedAt: new Date().toISOString()
    });
  } catch (e) {
    console.error('[teacher/delivery]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Admin: list all delivery/archive submissions
app.get('/api/admin/deliveries', requireRole('admin'), async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT d.*, c.code, c.section, c.name AS course_name, c.students,
              u.name AS teacher_name
       FROM deliveries d
       JOIN courses c ON d.course_id = c.id
       LEFT JOIN users u ON d.submitted_by = u.id
       ORDER BY d.submitted_at DESC`
    );
    res.json(rows || []);
  } catch (e) {
    // If deliveries table doesn't exist yet, return empty
    if (e.code === 'ER_NO_SUCH_TABLE') {
      return res.json([]);
    }
    console.error('[admin/deliveries]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Admin: approve / reject / remind a delivery
app.put('/api/admin/deliveries/:courseId/decision', requireRole('admin'), async (req, res) => {
  try {
    const { courseId } = req.params;
    const { action, comment } = req.body || {};

    if (!['approve','reject','remind'].includes(action)) {
      return res.status(400).json({ code: 'VALIDATION', message: 'action 必须是 approve / reject / remind' });
    }

    const statusMap = { approve: '已归档', reject: '已退回', remind: '待管理员确认' };
    const newStatus = statusMap[action];

    const [result] = await pool.query(
      `UPDATE deliveries SET status = ?, review_comment = ?, reviewer_id = ?, reviewed_at = NOW()
       WHERE course_id = ?`,
      [newStatus, comment || '', req.userId, courseId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '未找到该课程的归档记录' });
    }

    // Audit log
    const logId = 'log-' + Date.now();
    const actionLabels = { approve: '确认归档', reject: '退回归档', remind: '提醒老师重新提交' };
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, actionLabels[action], `course:${courseId}`]
    );

    res.json({ courseId, status: newStatus, reviewedAt: new Date().toISOString() });
  } catch (e) {
    console.error('[admin/deliveries/decision]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Phase 1 P0: Manager memberships (组织负责人认证)
// ═══════════════════════════════════════════════════════════════════

// Manager: list memberships for organizations the manager oversees
app.get('/api/manager/memberships', requireRole('manager','admin'), async (req, res) => {
  try {
    const { organization, type, status } = req.query;

    let sql = `SELECT m.*, u.name AS student_name, u.college
               FROM memberships m
               JOIN users u ON m.student_id = u.id
               WHERE 1=1`;
    const params = [];

    if (organization) { sql += ' AND m.organization = ?'; params.push(organization); }
    if (type) { sql += ' AND m.type = ?'; params.push(type); }
    if (status) { sql += ' AND m.status = ?'; params.push(status); }

    sql += ' ORDER BY m.updated_at DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows || []);
  } catch (e) {
    console.error('[manager/memberships]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Manager: create a new membership (single entry)
app.post('/api/manager/memberships', requireRole('manager','admin'), async (req, res) => {
  try {
    const { studentId, type, organization, status, validUntil, comment, offsetHours } = req.body || {};

    if (!studentId || !type || !organization) {
      return res.status(400).json({ code: 'VALIDATION', message: 'studentId, type, organization 为必填字段' });
    }

    // Verify student exists
    const [students] = await pool.query('SELECT id FROM users WHERE id = ? AND role = ?', [studentId, 'student']);
    if (!students || !students.length) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '学生不存在或非学生角色' });
    }

    const membershipId = 'mem-' + Date.now();
    await pool.query(
      `INSERT INTO memberships (id, student_id, type, organization, status, valid_until, offset_hours, comment, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [membershipId, studentId, type, organization, status || '待确认', validUntil || null, offsetHours || 10.0, comment || '', req.userId]
    );

    // Audit log
    const logId = 'log-' + Date.now();
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, '新增组织成员', `${studentId} / ${organization}`]
    );

    res.status(201).json({ membershipId, studentId, type, organization, status: status || '待确认' });
  } catch (e) {
    console.error('[manager/memberships POST]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Manager: CSV import preview (validate rows before confirm)
app.post('/api/manager/memberships/import/preview', requireRole('manager','admin'), async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ code: 'VALIDATION', message: 'rows 必须是非空数组' });
    }

    const preview = [];
    for (const row of rows) {
      const issues = [];
      if (!row.studentId) issues.push('缺少学号');
      if (!row.organization) issues.push('缺少组织名称');
      if (!['team','club'].includes(row.type)) issues.push('type 必须是 team 或 club');

      // Verify student exists
      let studentName = '';
      if (row.studentId) {
        const [students] = await pool.query('SELECT name FROM users WHERE id = ?', [row.studentId]);
        if (students && students.length) {
          studentName = students[0].name;
        } else {
          issues.push(`学生 ${row.studentId} 不存在`);
        }
      }

      preview.push({
        studentId: row.studentId || '',
        studentName,
        type: row.type || '',
        organization: row.organization || '',
        status: row.status || '待确认',
        validUntil: row.validUntil || '',
        comment: row.comment || '',
        offsetHours: row.offsetHours || 10.0,
        issues,
        ok: issues.length === 0
      });
    }

    res.json({
      total: rows.length,
      okCount: preview.filter((r) => r.ok).length,
      errorCount: preview.filter((r) => !r.ok).length,
      rows: preview
    });
  } catch (e) {
    console.error('[manager/memberships/import/preview]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Manager: confirm CSV import (insert validated rows)
app.post('/api/manager/memberships/import/confirm', requireRole('manager','admin'), async (req, res) => {
  try {
    const { rows } = req.body || {};
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ code: 'VALIDATION', message: 'rows 必须是非空数组' });
    }

    let inserted = 0;
    for (const row of rows) {
      if (!row.studentId || !row.organization || !['team','club'].includes(row.type)) continue;
      const membershipId = 'mem-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      await pool.query(
        `INSERT IGNORE INTO memberships (id, student_id, type, organization, status, valid_until, offset_hours, comment, updated_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [membershipId, row.studentId, row.type, row.organization, row.status || '待确认', row.validUntil || null, row.offsetHours || 10.0, row.comment || '', req.userId]
      );
      inserted++;
    }

    // Audit log
    const logId = 'log-' + Date.now();
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, '批量导入组织成员', `${inserted} 条记录`]
    );

    res.json({ inserted, total: rows.length });
  } catch (e) {
    console.error('[manager/memberships/import/confirm]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// Manager: approve / reject a membership
app.put('/api/manager/memberships/:membershipId/decision', requireRole('manager','admin'), async (req, res) => {
  try {
    const { membershipId } = req.params;
    const { action, comment } = req.body || {};

    if (!['approve','reject'].includes(action)) {
      return res.status(400).json({ code: 'VALIDATION', message: 'action 必须是 approve / reject' });
    }

    const newStatus = action === 'approve' ? '认证有效' : '已驳回';
    const newOffsetStatus = action === 'approve' ? '可抵扣' : '待确认';

    const [result] = await pool.query(
      `UPDATE memberships SET status = ?, offset_status = ?, comment = CONCAT(COALESCE(comment,''), '\n', ?), updated_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [newStatus, newOffsetStatus, comment || '', req.userId, membershipId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ code: 'NOT_FOUND', message: '认证记录不存在' });
    }

    // Audit log
    const logId = 'log-' + Date.now();
    const actionLabels = { approve: '确认组织认证', reject: '驳回组织认证' };
    await pool.query(
      `INSERT INTO audit_logs (id, actor, action, target, time) VALUES (?, ?, ?, ?, NOW())`,
      [logId, req.userId, actionLabels[action], `membership:${membershipId}`]
    );

    res.json({ membershipId, status: newStatus, offsetStatus: newOffsetStatus });
  } catch (e) {
    console.error('[manager/memberships/decision]', e);
    res.status(500).json({ code: 'DB_ERROR', message: e.message });
  }
});

// ── 404 catch-all ───────────────────────────────────────────────
app.use('/api/*', (_req, res) => {
  res.status(404).json({ code: 'RESOURCE_NOT_FOUND', message: 'Endpoint not implemented' });
});

// ── Start ───────────────────────────────────────────────────────
const port = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '127.0.0.1', () => {
    console.log(`BNBU Sports API running on http://127.0.0.1:${port}/api/health`);
  });
}

module.exports = { app, pool };
