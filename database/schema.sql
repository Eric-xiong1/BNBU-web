# BNBU Sports Web — Database & API Deployment Script

# ═══════════════════════════════════════════════════════════════════
# Run this SQL in 宝塔 → 数据库 → phpMyAdmin (or MySQL terminal)
# ═══════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS `123_207_5_70_96`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `123_207_5_70_96`;

# Connect to your database `123_207_5_70_96` in phpMyAdmin, then run this SQL


CREATE TABLE IF NOT EXISTS semesters (
  id         VARCHAR(32) PRIMARY KEY,
  name       VARCHAR(128) NOT NULL,
  date_range VARCHAR(128),
  status     VARCHAR(32) DEFAULT '进行中'
);

CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(32) PRIMARY KEY,
  name        VARCHAR(64) NOT NULL,
  email       VARCHAR(128) NOT NULL UNIQUE,
  password    VARCHAR(256) NOT NULL,
  role        VARCHAR(32) NOT NULL,
  college     VARCHAR(128),
  status      VARCHAR(32) DEFAULT '正常',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id          VARCHAR(32) PRIMARY KEY,
  code        VARCHAR(32) NOT NULL,
  section     VARCHAR(8) NOT NULL,
  name        VARCHAR(128) NOT NULL,
  teacher_id  VARCHAR(32),
  semester_id VARCHAR(32),
  students    INT DEFAULT 0,
  status      VARCHAR(32) DEFAULT '正常',
  FOREIGN KEY (teacher_id)  REFERENCES users(id),
  FOREIGN KEY (semester_id) REFERENCES semesters(id)
);

CREATE TABLE IF NOT EXISTS student_progress (
  student_id       VARCHAR(32) NOT NULL,
  course_id        VARCHAR(32) NOT NULL,
  course_hours     DECIMAL(4,1) DEFAULT 0,
  general_hours    DECIMAL(4,1) DEFAULT 0,
  exam_score       INT DEFAULT 0,
  attendance_score INT DEFAULT 0,
  physical_score   INT DEFAULT 0,
  status           VARCHAR(32),
  import_batch     VARCHAR(36) DEFAULT NULL,
  import_order     INT DEFAULT NULL,
  PRIMARY KEY (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id             VARCHAR(32) PRIMARY KEY,
  course_id      VARCHAR(32) DEFAULT NULL,
  student_id     VARCHAR(32) NOT NULL,
  type           VARCHAR(32),
  hours          DECIMAL(4,1),
  approved_hours DECIMAL(4,1) DEFAULT 0,
  risk           VARCHAR(64),
  status         VARCHAR(32),
  task           VARCHAR(256),
  reason         VARCHAR(256),
  comment        TEXT,
  applied        TINYINT(1) DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id)  REFERENCES courses(id),
  FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id      VARCHAR(32) PRIMARY KEY,
  actor   VARCHAR(64),
  action  VARCHAR(256),
  target  VARCHAR(256),
  time    VARCHAR(64)
);

-- ── Seed demo data ─────────────────────────────────────────────

INSERT IGNORE INTO semesters (id, name, date_range, status) VALUES ('s1', '2026 Spring', '2026.02.24 - 2026.06.28', '进行中');

INSERT IGNORE INTO users (id, name, email, password, role, college, status, created_at, updated_at) VALUES
  ('u1', '王老师', 'teacher@bnbu.edu.cn', 'password123', 'teacher', NULL, '正常', NOW(), NOW()),
  ('u2', '体育部管理员', 'admin@bnbu.edu.cn', 'password123', 'admin', NULL, '正常', NOW(), NOW()),
  ('22301142', '陈雨晴', 's1@bnbu.edu.cn', 'password123', 'student', '工商管理学院', '正常', NOW(), NOW()),
  ('22301087', '林子航', 's2@bnbu.edu.cn', 'password123', 'student', '数据科学学院', '正常', NOW(), NOW()),
  ('22301205', '黄嘉仪', 's3@bnbu.edu.cn', 'password123', 'student', '人文社科学院', '正常', NOW(), NOW()),
  ('22301318', '宋亦然', 's4@bnbu.edu.cn', 'password123', 'student', '理工科技学院', '正常', NOW(), NOW()),
  ('22301776', '梁思远', 's5@bnbu.edu.cn', 'password123', 'student', '文化创意学院', '正常', NOW(), NOW()),
  ('22301904', '邓悦宁', 's6@bnbu.edu.cn', 'password123', 'student', '金融数学学院', '正常', NOW(), NOW());

INSERT IGNORE INTO courses (id, code, section, name, teacher_id, semester_id, students, status) VALUES
  ('gepe', 'GEPE101', '1004', '全人教育体育模块', 'u1', 's1', 82, '正常'),
  ('basketball', 'PEB203', '2003', '篮球基础与训练', 'u1', 's1', 46, '正常'),
  ('fitness', 'PEF112', '1008', '体适能训练', 'u1', 's1', 58, '正常');

INSERT IGNORE INTO student_progress (student_id, course_id, course_hours, general_hours, exam_score, attendance_score, physical_score, status) VALUES
  ('22301142', 'gepe', 6, 10, 86, 90, 78, '差课程 4h'),
  ('22301087', 'gepe', 10, 7, 79, 84, 82, '差其他 3h'),
  ('22301205', 'gepe', 10, 10, 91, 96, 88, '已完成'),
  ('22301318', 'gepe', 4, 5, 72, 76, 69, '风险较高'),
  ('22301776', 'gepe', 10, 10, 88, 92, 84, '已完成'),
  ('22301904', 'gepe', 8, 10, 83, 80, 80, '差课程 2h');

INSERT IGNORE INTO reviews (id, course_id, student_id, type, hours, approved_hours, risk, status, task, reason, comment, applied, created_at) VALUES
  ('r1', 'gepe', '22301142', '课程相关', 2, 0, '同图复用', '待确认', '课外跑步训练 Week 06', '图片哈希命中历史记录', '', 0, NOW()),
  ('r2', 'gepe', '22301087', '其他运动', 1.5, 0, '时长偏高', '需复核', '自主篮球训练', '单次时长接近上限', '', 0, NOW()),
  ('r3', 'gepe', '22301205', '课程相关', 1, 0, '无异常', '可通过', '体能训练签到', '凭证完整', '', 0, NOW()),
  ('r4', 'gepe', '22301318', '其他运动', 1, 0, '缺少场地照', '补材料', '自主运动打卡', '缺少现场图片', '', 0, NOW());

INSERT IGNORE INTO audit_logs (id, actor, action, target, time) VALUES
  ('log1', '体育部管理员', '发布体育学时规则', 'BNBU-SPORT-2026-v1', '2026.06.01 09:00'),
  ('log2', '王老师', '处理异常打卡', 'GEPE101 / 黄嘉仪', '2026.06.10 17:42');

-- ── v2: Student-facing tables (Android app backend) ─────────────

CREATE TABLE IF NOT EXISTS sport_records (
  id             VARCHAR(36) PRIMARY KEY,
  student_id     VARCHAR(32) NOT NULL,
  course_id      VARCHAR(32),
  task_id        VARCHAR(32),
  credit_type    VARCHAR(32) NOT NULL,
  hours          DECIMAL(4,1) NOT NULL,
  approved_hours DECIMAL(4,1) DEFAULT 0,
  description    TEXT,
  proof_files    JSON,
  status         VARCHAR(32) DEFAULT '待审核',
  review_comment TEXT,
  submitted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at    DATETIME,
  sport_type     VARCHAR(64),
  location       VARCHAR(256),
  start_time     DATETIME,
  end_time       DATETIME,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          VARCHAR(36) PRIMARY KEY,
  student_id  VARCHAR(32) NOT NULL,
  title       VARCHAR(256) NOT NULL,
  message     TEXT NOT NULL,
  category    VARCHAR(32) NOT NULL,
  is_read     TINYINT(1) DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS memberships (
  id            VARCHAR(36) PRIMARY KEY,
  student_id    VARCHAR(32) NOT NULL,
  type          VARCHAR(32) NOT NULL,
  organization  VARCHAR(128) NOT NULL,
  status        VARCHAR(32) DEFAULT '待确认',
  valid_until   DATE,
  offset_status VARCHAR(32) DEFAULT '待确认',
  comment       TEXT,
  updated_by    VARCHAR(64),
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id)
);

-- Conditionally add record_id column (MySQL-compatible)
DROP PROCEDURE IF EXISTS add_record_id_column;
DELIMITER //
CREATE PROCEDURE add_record_id_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'reviews'
      AND COLUMN_NAME = 'record_id'
  ) THEN
    ALTER TABLE reviews ADD COLUMN record_id VARCHAR(36);
  END IF;
END //
DELIMITER ;
CALL add_record_id_column();
DROP PROCEDURE IF EXISTS add_record_id_column;

-- ── Seed data for student-facing features ──────────────────────

INSERT IGNORE INTO sport_records (id, student_id, course_id, task_id, credit_type, hours, approved_hours, description, proof_files, status, review_comment, submitted_at, reviewed_at, sport_type, location, start_time, end_time) VALUES
  ('sr1', '22301142', 'gepe', 't1', '课程相关', 2.0, 0, 'Week 08 课外跑步训练', '["proof1.jpg","proof2.jpg","proof3.mov"]', '补材料', '视频时长不足，请补充全程录屏', '2026-06-08 20:10:00', NULL, NULL, NULL, NULL, NULL),
  ('sr2', '22301142', 'gepe', 't1', '课程相关', 2.0, 2.0, 'Week 06 课外跑步训练', '["proof4.jpg","proof5.jpg"]', '已通过', '凭证通过', '2026-06-01 19:40:00', '2026-06-02 10:00:00', NULL, NULL, NULL, NULL),
  ('sr3', '22301142', NULL, 't3', '系统抵扣', 10.0, 10.0, '羽毛球队抵扣', '[]', '系统抵扣', '系统已自动计入', '2026-06-01 10:30:00', '2026-06-01 10:30:00', NULL, NULL, NULL, NULL),
  ('sr4', '22301142', 'gepe', 't2', '课程相关', 2.0, 0, 'Week 05 体能练习', '["proof6.jpg"]', '已驳回', '图片哈希命中历史记录', '2026-05-25 20:20:00', '2026-05-26 14:00:00', NULL, NULL, NULL, NULL);

-- Link existing reviews to sport_records
UPDATE reviews SET record_id = 'sr1' WHERE id = 'r1';
UPDATE reviews SET record_id = 'sr4' WHERE id = 'r4';

INSERT IGNORE INTO notifications (id, student_id, title, message, category, is_read, created_at) VALUES
  ('n1', '22301142', 'Week 08 任务即将截止', '课外跑步训练 Week 08 将于本周日 23:59 截止，请尽快完成打卡。', '截止提醒', 0, '2026-06-14 20:00:00'),
  ('n2', '22301142', '补材料通知', '你的 Week 06 打卡记录需要补充材料：视频时长不足，请上传全程录屏。', '审核反馈', 0, '2026-06-09 10:00:00'),
  ('n3', '22301142', '组织抵扣已确认', '你的羽毛球队成员身份已通过认证，其他运动 10 小时已自动完成。', '组织认证', 1, '2026-06-01 10:30:00');

INSERT IGNORE INTO memberships (id, student_id, type, organization, status, valid_until, offset_status, comment, updated_by, updated_at) VALUES
  ('m1', '22301142', 'team', '羽毛球队', '认证有效', '2026-09-01', '可抵扣', '校队名册已确认，可抵扣其他运动 10 小时', '体育部管理员', '2026-06-01 10:30:00'),
  ('m2', '22301142', 'club', '跑步社', '待确认', '2026-09-01', '待确认', '社团负责人尚未提交认证申请', NULL, '2026-05-15 16:00:00');

-- ── v3: Extended user profiles, record source, scoring, & task tables ──

-- Add gender and grade_level to users table
DROP PROCEDURE IF EXISTS add_user_profile_columns;
DELIMITER //
CREATE PROCEDURE add_user_profile_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'gender'
  ) THEN
    ALTER TABLE users ADD COLUMN gender ENUM('male','female') AFTER college;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'grade_level'
  ) THEN
    ALTER TABLE users ADD COLUMN grade_level ENUM('freshman','sophomore','junior','senior') AFTER gender;
  END IF;
END //
DELIMITER ;
CALL add_user_profile_columns();
DROP PROCEDURE IF EXISTS add_user_profile_columns;

-- Add record_source to sport_records
DROP PROCEDURE IF EXISTS add_record_source_column;
DELIMITER //
CREATE PROCEDURE add_record_source_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'sport_records'
      AND COLUMN_NAME = 'record_source'
  ) THEN
    ALTER TABLE sport_records ADD COLUMN record_source ENUM('student','team','club') DEFAULT 'student' AFTER credit_type;
  END IF;
END //
DELIMITER ;
CALL add_record_source_column();
DROP PROCEDURE IF EXISTS add_record_source_column;

-- ── Endurance scoring rules (Chinese national standard) ───────────

CREATE TABLE IF NOT EXISTS endurance_scoring_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  gender ENUM('male','female') NOT NULL,
  grade_group ENUM('freshman_sophomore','junior_senior') NOT NULL,
  score INT NOT NULL,
  time_seconds_min INT NOT NULL,
  time_seconds_max INT NOT NULL,
  tier VARCHAR(16) NOT NULL COMMENT 'excellent/good/pass/fail',
  INDEX idx_gender_grade (gender, grade_group)
);

INSERT IGNORE INTO endurance_scoring_rules (id, gender, grade_group, score, time_seconds_min, time_seconds_max, tier) VALUES
-- Male / Freshman-Sophomore
(1,'male','freshman_sophomore',100,0,197,'excellent'),
(2,'male','freshman_sophomore',95,198,202,'excellent'),
(3,'male','freshman_sophomore',90,203,207,'excellent'),
(4,'male','freshman_sophomore',85,208,214,'good'),
(5,'male','freshman_sophomore',80,215,222,'good'),
(6,'male','freshman_sophomore',78,223,227,'good'),
(7,'male','freshman_sophomore',76,228,232,'good'),
(8,'male','freshman_sophomore',74,233,237,'good'),
(9,'male','freshman_sophomore',72,238,242,'good'),
(10,'male','freshman_sophomore',70,243,247,'good'),
(11,'male','freshman_sophomore',68,248,252,'pass'),
(12,'male','freshman_sophomore',66,253,257,'pass'),
(13,'male','freshman_sophomore',64,258,262,'pass'),
(14,'male','freshman_sophomore',62,263,267,'pass'),
(15,'male','freshman_sophomore',60,268,272,'pass'),
(16,'male','freshman_sophomore',50,273,292,'fail'),
(17,'male','freshman_sophomore',40,293,312,'fail'),
(18,'male','freshman_sophomore',30,313,332,'fail'),
(19,'male','freshman_sophomore',20,333,352,'fail'),
(20,'male','freshman_sophomore',10,353,372,'fail'),
-- Male / Junior-Senior
(21,'male','junior_senior',100,0,195,'excellent'),
(22,'male','junior_senior',95,196,200,'excellent'),
(23,'male','junior_senior',90,201,205,'excellent'),
(24,'male','junior_senior',85,206,212,'good'),
(25,'male','junior_senior',80,213,220,'good'),
(26,'male','junior_senior',78,221,225,'good'),
(27,'male','junior_senior',76,226,230,'good'),
(28,'male','junior_senior',74,231,235,'good'),
(29,'male','junior_senior',72,236,240,'good'),
(30,'male','junior_senior',70,241,245,'good'),
(31,'male','junior_senior',68,246,250,'pass'),
(32,'male','junior_senior',66,251,255,'pass'),
(33,'male','junior_senior',64,256,260,'pass'),
(34,'male','junior_senior',62,261,265,'pass'),
(35,'male','junior_senior',60,266,270,'pass'),
(36,'male','junior_senior',50,271,290,'fail'),
(37,'male','junior_senior',40,291,310,'fail'),
(38,'male','junior_senior',30,311,330,'fail'),
(39,'male','junior_senior',20,331,350,'fail'),
(40,'male','junior_senior',10,351,370,'fail'),
-- Female / Freshman-Sophomore
(41,'female','freshman_sophomore',100,0,198,'excellent'),
(42,'female','freshman_sophomore',95,199,204,'excellent'),
(43,'female','freshman_sophomore',90,205,210,'excellent'),
(44,'female','freshman_sophomore',85,211,217,'good'),
(45,'female','freshman_sophomore',80,218,224,'good'),
(46,'female','freshman_sophomore',78,225,229,'good'),
(47,'female','freshman_sophomore',76,230,234,'good'),
(48,'female','freshman_sophomore',74,235,239,'good'),
(49,'female','freshman_sophomore',72,240,244,'good'),
(50,'female','freshman_sophomore',70,245,249,'good'),
(51,'female','freshman_sophomore',68,250,254,'pass'),
(52,'female','freshman_sophomore',66,255,259,'pass'),
(53,'female','freshman_sophomore',64,260,264,'pass'),
(54,'female','freshman_sophomore',62,265,269,'pass'),
(55,'female','freshman_sophomore',60,270,274,'pass'),
(56,'female','freshman_sophomore',50,275,284,'fail'),
(57,'female','freshman_sophomore',40,285,294,'fail'),
(58,'female','freshman_sophomore',30,295,304,'fail'),
(59,'female','freshman_sophomore',20,305,314,'fail'),
(60,'female','freshman_sophomore',10,315,324,'fail'),
-- Female / Junior-Senior
(61,'female','junior_senior',100,0,196,'excellent'),
(62,'female','junior_senior',95,197,202,'excellent'),
(63,'female','junior_senior',90,203,208,'excellent'),
(64,'female','junior_senior',85,209,215,'good'),
(65,'female','junior_senior',80,216,222,'good'),
(66,'female','junior_senior',78,223,227,'good'),
(67,'female','junior_senior',76,228,232,'good'),
(68,'female','junior_senior',74,233,237,'good'),
(69,'female','junior_senior',72,238,242,'good'),
(70,'female','junior_senior',70,243,247,'good'),
(71,'female','junior_senior',68,248,252,'pass'),
(72,'female','junior_senior',66,253,257,'pass'),
(73,'female','junior_senior',64,258,262,'pass'),
(74,'female','junior_senior',62,263,267,'pass'),
(75,'female','junior_senior',60,268,272,'pass'),
(76,'female','junior_senior',50,273,282,'fail'),
(77,'female','junior_senior',40,283,292,'fail'),
(78,'female','junior_senior',30,293,302,'fail'),
(79,'female','junior_senior',20,303,312,'fail'),
(80,'female','junior_senior',10,313,322,'fail');

-- ── Exemptions table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exemptions (
  id VARCHAR(36) PRIMARY KEY,
  student_id VARCHAR(32) NOT NULL,
  type VARCHAR(32) NOT NULL COMMENT '800m or 1000m',
  reason TEXT,
  proof_files JSON,
  status VARCHAR(32) DEFAULT '待审核',
  reviewer_id VARCHAR(32),
  review_comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- ── Tasks table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  course_id VARCHAR(32) NOT NULL,
  title VARCHAR(256) NOT NULL,
  description TEXT,
  credit_type VARCHAR(32) NOT NULL,
  required_hours DECIMAL(4,1) DEFAULT 1.0,
  deadline VARCHAR(128),
  start_at DATETIME NULL COMMENT 'UTC task availability start',
  end_at DATETIME NULL COMMENT 'UTC task availability end',
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
  status VARCHAR(32) DEFAULT '进行中',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

INSERT IGNORE INTO tasks (id, course_id, title, description, credit_type, required_hours, deadline, status, created_at, updated_at) VALUES
('tk1','gepe','课外跑步训练 Week 06','完成2小时课外跑步训练','课程相关',2.0,'第 6 周周日','进行中',NOW(),NOW()),
('tk2','gepe','体能训练签到','课堂体能训练签到','课程相关',1.0,'第 7 周周五','进行中',NOW(),NOW()),
('tk3','basketball','篮球投篮练习','完成投篮技术训练','课程相关',1.5,'第 8 周周五','进行中',NOW(),NOW()),
('tk4','fitness','核心力量训练','核心力量及体能训练','课程相关',2.0,'第 7 周周日','草稿',NOW(),NOW());

-- ── Update seed users with gender and grade_level ──────────────────

UPDATE users SET gender = 'female', grade_level = 'sophomore' WHERE id = '22301142';
UPDATE users SET gender = 'male', grade_level = 'freshman' WHERE id = '22301087';
UPDATE users SET gender = 'female', grade_level = 'junior' WHERE id = '22301205';
UPDATE users SET gender = 'male', grade_level = 'sophomore' WHERE id = '22301318';
UPDATE users SET gender = 'male', grade_level = 'senior' WHERE id = '22301776';
UPDATE users SET gender = 'female', grade_level = 'junior' WHERE id = '22301904';

-- ═══════════════════════════════════════════════════════════════════
-- v4: Supplemental features — manual credits, per-second conversion
--     table, membership extended fields, course-scoped exemptions
-- ═══════════════════════════════════════════════════════════════════

-- ── Manual credits (teacher-granted hours) ──────────────────────────

CREATE TABLE IF NOT EXISTS manual_credits (
  id          VARCHAR(36) PRIMARY KEY,
  student_id  VARCHAR(32) NOT NULL,
  course_id   VARCHAR(32) NOT NULL,
  credit_type VARCHAR(32) NOT NULL COMMENT '课程相关 / 其他运动',
  hours       DECIMAL(4,1) NOT NULL,
  reason      TEXT NOT NULL,
  proof_files JSON,
  operator_id VARCHAR(32) NOT NULL,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id)
);

-- ── Per-second conversion rules (admin-maintained, 每1秒一个分数) ───

CREATE TABLE IF NOT EXISTS conversion_rules_admin (
  id              VARCHAR(36) PRIMARY KEY,
  grade_group     ENUM('freshman_sophomore','junior_senior') NOT NULL,
  gender          ENUM('male','female') NOT NULL,
  item_name       VARCHAR(32) NOT NULL COMMENT '800m / 1000m',
  raw_value       VARCHAR(16) NOT NULL COMMENT 'display format e.g. 3''17"',
  raw_seconds     INT NOT NULL COMMENT 'total seconds for comparison',
  converted_score DECIMAL(5,1) NOT NULL,
  version         INT DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_grade_gender_item_raw (grade_group, gender, item_name, raw_seconds)
);

-- ── Extend memberships with teacher confirmation fields ─────────────

DROP PROCEDURE IF EXISTS add_membership_columns;
DELIMITER //
CREATE PROCEDURE add_membership_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'memberships'
      AND COLUMN_NAME = 'offset_hours'
  ) THEN
    ALTER TABLE memberships ADD COLUMN offset_hours DECIMAL(4,1) DEFAULT 10.0 AFTER offset_status;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'memberships'
      AND COLUMN_NAME = 'confirmed_by'
  ) THEN
    ALTER TABLE memberships ADD COLUMN confirmed_by VARCHAR(32) AFTER updated_by;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'memberships'
      AND COLUMN_NAME = 'confirmed_at'
  ) THEN
    ALTER TABLE memberships ADD COLUMN confirmed_at DATETIME AFTER updated_at;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'memberships'
      AND COLUMN_NAME = 'rejection_reason'
  ) THEN
    ALTER TABLE memberships ADD COLUMN rejection_reason TEXT AFTER comment;
  END IF;
END //
DELIMITER ;
CALL add_membership_columns();
DROP PROCEDURE IF EXISTS add_membership_columns;

-- ── Add course_id to exemptions for course-scoped teacher view ───────

DROP PROCEDURE IF EXISTS add_exemption_course_column;
DELIMITER //
CREATE PROCEDURE add_exemption_course_column()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = '123_207_5_70_96'
      AND TABLE_NAME = 'exemptions'
      AND COLUMN_NAME = 'course_id'
  ) THEN
    ALTER TABLE exemptions ADD COLUMN course_id VARCHAR(32) AFTER student_id;
  END IF;
END //
DELIMITER ;
CALL add_exemption_course_column();
DROP PROCEDURE IF EXISTS add_exemption_course_column;

-- ── Seed: per-second conversion table (大一/大二 · 男 · 1000m) ──────

INSERT IGNORE INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version, created_at, updated_at) VALUES
-- 大一/大二 · 男 · 1000m
('cv-m-fs-001','freshman_sophomore','male','1000m','3''17"',197,100.0,1,NOW(),NOW()),
('cv-m-fs-002','freshman_sophomore','male','1000m','3''18"',198,99.0,1,NOW(),NOW()),
('cv-m-fs-003','freshman_sophomore','male','1000m','3''19"',199,98.0,1,NOW(),NOW()),
('cv-m-fs-004','freshman_sophomore','male','1000m','3''20"',200,97.0,1,NOW(),NOW()),
('cv-m-fs-005','freshman_sophomore','male','1000m','3''21"',201,96.0,1,NOW(),NOW()),
('cv-m-fs-006','freshman_sophomore','male','1000m','3''22"',202,95.0,1,NOW(),NOW()),
('cv-m-fs-007','freshman_sophomore','male','1000m','3''23"',203,94.0,1,NOW(),NOW()),
('cv-m-fs-008','freshman_sophomore','male','1000m','3''24"',204,93.0,1,NOW(),NOW()),
('cv-m-fs-009','freshman_sophomore','male','1000m','3''25"',205,92.0,1,NOW(),NOW()),
('cv-m-fs-010','freshman_sophomore','male','1000m','3''26"',206,91.0,1,NOW(),NOW()),
('cv-m-fs-011','freshman_sophomore','male','1000m','3''27"',207,90.0,1,NOW(),NOW()),
('cv-m-fs-012','freshman_sophomore','male','1000m','3''28"',208,89.0,1,NOW(),NOW()),
('cv-m-fs-013','freshman_sophomore','male','1000m','3''29"',209,88.0,1,NOW(),NOW()),
('cv-m-fs-014','freshman_sophomore','male','1000m','3''30"',210,87.0,1,NOW(),NOW()),
('cv-m-fs-015','freshman_sophomore','male','1000m','3''31"',211,86.0,1,NOW(),NOW()),
('cv-m-fs-016','freshman_sophomore','male','1000m','3''32"',212,85.0,1,NOW(),NOW()),
('cv-m-fs-017','freshman_sophomore','male','1000m','3''33"',213,84.0,1,NOW(),NOW()),
('cv-m-fs-018','freshman_sophomore','male','1000m','3''34"',214,83.0,1,NOW(),NOW()),
('cv-m-fs-019','freshman_sophomore','male','1000m','3''35"',215,82.0,1,NOW(),NOW()),
('cv-m-fs-020','freshman_sophomore','male','1000m','3''36"',216,81.0,1,NOW(),NOW()),
('cv-m-fs-021','freshman_sophomore','male','1000m','3''37"',217,80.0,1,NOW(),NOW()),
('cv-m-fs-022','freshman_sophomore','male','1000m','3''38"',218,79.0,1,NOW(),NOW()),
('cv-m-fs-023','freshman_sophomore','male','1000m','3''39"',219,78.0,1,NOW(),NOW()),
('cv-m-fs-024','freshman_sophomore','male','1000m','3''40"',220,77.0,1,NOW(),NOW()),
('cv-m-fs-025','freshman_sophomore','male','1000m','3''41"',221,76.0,1,NOW(),NOW()),
('cv-m-fs-026','freshman_sophomore','male','1000m','3''42"',222,75.0,1,NOW(),NOW()),
('cv-m-fs-027','freshman_sophomore','male','1000m','3''43"',223,74.0,1,NOW(),NOW()),
('cv-m-fs-028','freshman_sophomore','male','1000m','3''44"',224,73.0,1,NOW(),NOW()),
('cv-m-fs-029','freshman_sophomore','male','1000m','3''45"',225,72.0,1,NOW(),NOW()),
('cv-m-fs-030','freshman_sophomore','male','1000m','3''46"',226,71.0,1,NOW(),NOW()),
('cv-m-fs-031','freshman_sophomore','male','1000m','3''47"',227,70.0,1,NOW(),NOW()),
('cv-m-fs-032','freshman_sophomore','male','1000m','3''48"',228,69.0,1,NOW(),NOW()),
('cv-m-fs-033','freshman_sophomore','male','1000m','3''49"',229,68.0,1,NOW(),NOW()),
('cv-m-fs-034','freshman_sophomore','male','1000m','3''50"',230,67.0,1,NOW(),NOW()),
('cv-m-fs-035','freshman_sophomore','male','1000m','3''51"',231,66.0,1,NOW(),NOW()),
('cv-m-fs-036','freshman_sophomore','male','1000m','3''52"',232,65.0,1,NOW(),NOW()),
('cv-m-fs-037','freshman_sophomore','male','1000m','3''53"',233,64.0,1,NOW(),NOW()),
('cv-m-fs-038','freshman_sophomore','male','1000m','3''54"',234,63.0,1,NOW(),NOW()),
('cv-m-fs-039','freshman_sophomore','male','1000m','3''55"',235,62.0,1,NOW(),NOW()),
('cv-m-fs-040','freshman_sophomore','male','1000m','3''56"',236,61.0,1,NOW(),NOW()),
('cv-m-fs-041','freshman_sophomore','male','1000m','3''57"',237,60.0,1,NOW(),NOW()),
('cv-m-fs-042','freshman_sophomore','male','1000m','3''58"',238,59.0,1,NOW(),NOW()),
('cv-m-fs-043','freshman_sophomore','male','1000m','3''59"',239,58.0,1,NOW(),NOW()),
('cv-m-fs-044','freshman_sophomore','male','1000m','4''00"',240,57.0,1,NOW(),NOW()),
('cv-m-fs-045','freshman_sophomore','male','1000m','4''01"',241,56.0,1,NOW(),NOW()),
('cv-m-fs-046','freshman_sophomore','male','1000m','4''02"',242,55.0,1,NOW(),NOW()),
('cv-m-fs-047','freshman_sophomore','male','1000m','4''03"',243,54.0,1,NOW(),NOW()),
('cv-m-fs-048','freshman_sophomore','male','1000m','4''04"',244,53.0,1,NOW(),NOW()),
('cv-m-fs-049','freshman_sophomore','male','1000m','4''05"',245,52.0,1,NOW(),NOW()),
('cv-m-fs-050','freshman_sophomore','male','1000m','4''06"',246,51.0,1,NOW(),NOW()),
('cv-m-fs-051','freshman_sophomore','male','1000m','4''07"',247,50.0,1,NOW(),NOW()),
('cv-m-fs-052','freshman_sophomore','male','1000m','4''08"',248,49.0,1,NOW(),NOW()),
('cv-m-fs-053','freshman_sophomore','male','1000m','4''09"',249,48.0,1,NOW(),NOW()),
('cv-m-fs-054','freshman_sophomore','male','1000m','4''10"',250,47.0,1,NOW(),NOW()),
('cv-m-fs-055','freshman_sophomore','male','1000m','4''11"',251,46.0,1,NOW(),NOW()),
('cv-m-fs-056','freshman_sophomore','male','1000m','4''12"',252,45.0,1,NOW(),NOW()),
('cv-m-fs-057','freshman_sophomore','male','1000m','4''13"',253,44.0,1,NOW(),NOW()),
('cv-m-fs-058','freshman_sophomore','male','1000m','4''14"',254,43.0,1,NOW(),NOW()),
('cv-m-fs-059','freshman_sophomore','male','1000m','4''15"',255,42.0,1,NOW(),NOW()),
('cv-m-fs-060','freshman_sophomore','male','1000m','4''16"',256,41.0,1,NOW(),NOW()),
('cv-m-fs-061','freshman_sophomore','male','1000m','4''17"',257,40.0,1,NOW(),NOW()),
('cv-m-fs-062','freshman_sophomore','male','1000m','4''18"',258,39.0,1,NOW(),NOW()),
('cv-m-fs-063','freshman_sophomore','male','1000m','4''19"',259,38.0,1,NOW(),NOW()),
('cv-m-fs-064','freshman_sophomore','male','1000m','4''20"',260,37.0,1,NOW(),NOW()),
('cv-m-fs-065','freshman_sophomore','male','1000m','4''21"',261,36.0,1,NOW(),NOW()),
('cv-m-fs-066','freshman_sophomore','male','1000m','4''22"',262,35.0,1,NOW(),NOW()),
('cv-m-fs-067','freshman_sophomore','male','1000m','4''23"',263,34.0,1,NOW(),NOW()),
('cv-m-fs-068','freshman_sophomore','male','1000m','4''24"',264,33.0,1,NOW(),NOW()),
('cv-m-fs-069','freshman_sophomore','male','1000m','4''25"',265,32.0,1,NOW(),NOW()),
('cv-m-fs-070','freshman_sophomore','male','1000m','4''26"',266,31.0,1,NOW(),NOW()),
('cv-m-fs-071','freshman_sophomore','male','1000m','4''27"',267,30.0,1,NOW(),NOW()),
('cv-m-fs-072','freshman_sophomore','male','1000m','4''28"',268,29.0,1,NOW(),NOW()),
('cv-m-fs-073','freshman_sophomore','male','1000m','4''29"',269,28.0,1,NOW(),NOW()),
('cv-m-fs-074','freshman_sophomore','male','1000m','4''30"',270,27.0,1,NOW(),NOW()),
('cv-m-fs-075','freshman_sophomore','male','1000m','4''31"',271,26.0,1,NOW(),NOW()),
('cv-m-fs-076','freshman_sophomore','male','1000m','4''32"',272,25.0,1,NOW(),NOW()),
('cv-m-fs-077','freshman_sophomore','male','1000m','4''33"',273,24.0,1,NOW(),NOW()),
('cv-m-fs-078','freshman_sophomore','male','1000m','4''34"',274,23.0,1,NOW(),NOW()),
('cv-m-fs-079','freshman_sophomore','male','1000m','4''35"',275,22.0,1,NOW(),NOW()),
('cv-m-fs-080','freshman_sophomore','male','1000m','4''36"',276,21.0,1,NOW(),NOW()),
('cv-m-fs-081','freshman_sophomore','male','1000m','4''37"',277,20.0,1,NOW(),NOW()),
('cv-m-fs-082','freshman_sophomore','male','1000m','4''38"',278,19.0,1,NOW(),NOW()),
('cv-m-fs-083','freshman_sophomore','male','1000m','4''39"',279,18.0,1,NOW(),NOW()),
('cv-m-fs-084','freshman_sophomore','male','1000m','4''40"',280,17.0,1,NOW(),NOW()),
('cv-m-fs-085','freshman_sophomore','male','1000m','4''41"',281,16.0,1,NOW(),NOW()),
('cv-m-fs-086','freshman_sophomore','male','1000m','4''42"',282,15.0,1,NOW(),NOW()),
('cv-m-fs-087','freshman_sophomore','male','1000m','4''43"',283,14.0,1,NOW(),NOW()),
('cv-m-fs-088','freshman_sophomore','male','1000m','4''44"',284,13.0,1,NOW(),NOW()),
('cv-m-fs-089','freshman_sophomore','male','1000m','4''45"',285,12.0,1,NOW(),NOW()),
('cv-m-fs-090','freshman_sophomore','male','1000m','4''46"',286,11.0,1,NOW(),NOW()),
('cv-m-fs-091','freshman_sophomore','male','1000m','4''47"',287,10.0,1,NOW(),NOW()),
('cv-m-fs-092','freshman_sophomore','male','1000m','4''48"',288,9.0,1,NOW(),NOW()),
('cv-m-fs-093','freshman_sophomore','male','1000m','4''49"',289,8.0,1,NOW(),NOW()),
('cv-m-fs-094','freshman_sophomore','male','1000m','4''50"',290,7.0,1,NOW(),NOW()),
('cv-m-fs-095','freshman_sophomore','male','1000m','4''51"',291,6.0,1,NOW(),NOW()),
('cv-m-fs-096','freshman_sophomore','male','1000m','4''52"',292,5.0,1,NOW(),NOW()),
('cv-m-fs-097','freshman_sophomore','male','1000m','4''53"',293,4.0,1,NOW(),NOW()),
('cv-m-fs-098','freshman_sophomore','male','1000m','4''54"',294,3.0,1,NOW(),NOW()),
('cv-m-fs-099','freshman_sophomore','male','1000m','4''55"',295,2.0,1,NOW(),NOW()),
('cv-m-fs-100','freshman_sophomore','male','1000m','4''56"',296,1.0,1,NOW(),NOW()),
('cv-m-fs-101','freshman_sophomore','male','1000m','4''57"',297,0.0,1,NOW(),NOW());

-- Also seed: 大一/大二 · 女 · 800m
INSERT IGNORE INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version, created_at, updated_at) VALUES
('cv-f-fs-001','freshman_sophomore','female','800m','3''18"',198,100.0,1,NOW(),NOW()),
('cv-f-fs-002','freshman_sophomore','female','800m','3''19"',199,99.0,1,NOW(),NOW()),
('cv-f-fs-003','freshman_sophomore','female','800m','3''20"',200,98.0,1,NOW(),NOW()),
('cv-f-fs-004','freshman_sophomore','female','800m','3''21"',201,97.0,1,NOW(),NOW()),
('cv-f-fs-005','freshman_sophomore','female','800m','3''22"',202,96.0,1,NOW(),NOW()),
('cv-f-fs-006','freshman_sophomore','female','800m','3''23"',203,95.0,1,NOW(),NOW()),
('cv-f-fs-007','freshman_sophomore','female','800m','3''24"',204,94.0,1,NOW(),NOW()),
('cv-f-fs-008','freshman_sophomore','female','800m','3''25"',205,93.0,1,NOW(),NOW()),
('cv-f-fs-009','freshman_sophomore','female','800m','3''26"',206,92.0,1,NOW(),NOW()),
('cv-f-fs-010','freshman_sophomore','female','800m','3''27"',207,91.0,1,NOW(),NOW()),
('cv-f-fs-011','freshman_sophomore','female','800m','3''28"',208,90.0,1,NOW(),NOW()),
('cv-f-fs-012','freshman_sophomore','female','800m','3''29"',209,89.0,1,NOW(),NOW()),
('cv-f-fs-013','freshman_sophomore','female','800m','3''30"',210,88.0,1,NOW(),NOW()),
('cv-f-fs-014','freshman_sophomore','female','800m','3''31"',211,87.0,1,NOW(),NOW()),
('cv-f-fs-015','freshman_sophomore','female','800m','3''32"',212,86.0,1,NOW(),NOW()),
('cv-f-fs-016','freshman_sophomore','female','800m','3''33"',213,85.0,1,NOW(),NOW()),
('cv-f-fs-017','freshman_sophomore','female','800m','3''34"',214,84.0,1,NOW(),NOW()),
('cv-f-fs-018','freshman_sophomore','female','800m','3''35"',215,83.0,1,NOW(),NOW()),
('cv-f-fs-019','freshman_sophomore','female','800m','3''36"',216,82.0,1,NOW(),NOW()),
('cv-f-fs-020','freshman_sophomore','female','800m','3''37"',217,81.0,1,NOW(),NOW()),
('cv-f-fs-021','freshman_sophomore','female','800m','3''38"',218,80.0,1,NOW(),NOW()),
('cv-f-fs-022','freshman_sophomore','female','800m','3''39"',219,79.0,1,NOW(),NOW()),
('cv-f-fs-023','freshman_sophomore','female','800m','3''40"',220,78.0,1,NOW(),NOW()),
('cv-f-fs-024','freshman_sophomore','female','800m','3''41"',221,77.0,1,NOW(),NOW()),
('cv-f-fs-025','freshman_sophomore','female','800m','3''42"',222,76.0,1,NOW(),NOW()),
('cv-f-fs-026','freshman_sophomore','female','800m','3''43"',223,75.0,1,NOW(),NOW()),
('cv-f-fs-027','freshman_sophomore','female','800m','3''44"',224,74.0,1,NOW(),NOW()),
('cv-f-fs-028','freshman_sophomore','female','800m','3''45"',225,73.0,1,NOW(),NOW()),
('cv-f-fs-029','freshman_sophomore','female','800m','3''46"',226,72.0,1,NOW(),NOW()),
('cv-f-fs-030','freshman_sophomore','female','800m','3''47"',227,71.0,1,NOW(),NOW()),
('cv-f-fs-031','freshman_sophomore','female','800m','3''48"',228,70.0,1,NOW(),NOW()),
('cv-f-fs-032','freshman_sophomore','female','800m','3''49"',229,69.0,1,NOW(),NOW()),
('cv-f-fs-033','freshman_sophomore','female','800m','3''50"',230,68.0,1,NOW(),NOW()),
('cv-f-fs-034','freshman_sophomore','female','800m','3''51"',231,67.0,1,NOW(),NOW()),
('cv-f-fs-035','freshman_sophomore','female','800m','3''52"',232,66.0,1,NOW(),NOW()),
('cv-f-fs-036','freshman_sophomore','female','800m','3''53"',233,65.0,1,NOW(),NOW()),
('cv-f-fs-037','freshman_sophomore','female','800m','3''54"',234,64.0,1,NOW(),NOW()),
('cv-f-fs-038','freshman_sophomore','female','800m','3''55"',235,63.0,1,NOW(),NOW()),
('cv-f-fs-039','freshman_sophomore','female','800m','3''56"',236,62.0,1,NOW(),NOW()),
('cv-f-fs-040','freshman_sophomore','female','800m','3''57"',237,61.0,1,NOW(),NOW()),
('cv-f-fs-041','freshman_sophomore','female','800m','3''58"',238,60.0,1,NOW(),NOW()),
('cv-f-fs-042','freshman_sophomore','female','800m','3''59"',239,59.0,1,NOW(),NOW()),
('cv-f-fs-043','freshman_sophomore','female','800m','4''00"',240,58.0,1,NOW(),NOW()),
('cv-f-fs-044','freshman_sophomore','female','800m','4''01"',241,57.0,1,NOW(),NOW()),
('cv-f-fs-045','freshman_sophomore','female','800m','4''02"',242,56.0,1,NOW(),NOW()),
('cv-f-fs-046','freshman_sophomore','female','800m','4''03"',243,55.0,1,NOW(),NOW()),
('cv-f-fs-047','freshman_sophomore','female','800m','4''04"',244,54.0,1,NOW(),NOW()),
('cv-f-fs-048','freshman_sophomore','female','800m','4''05"',245,53.0,1,NOW(),NOW()),
('cv-f-fs-049','freshman_sophomore','female','800m','4''06"',246,52.0,1,NOW(),NOW()),
('cv-f-fs-050','freshman_sophomore','female','800m','4''07"',247,51.0,1,NOW(),NOW()),
('cv-f-fs-051','freshman_sophomore','female','800m','4''08"',248,50.0,1,NOW(),NOW()),
('cv-f-fs-052','freshman_sophomore','female','800m','4''09"',249,49.0,1,NOW(),NOW()),
('cv-f-fs-053','freshman_sophomore','female','800m','4''10"',250,48.0,1,NOW(),NOW()),
('cv-f-fs-054','freshman_sophomore','female','800m','4''11"',251,47.0,1,NOW(),NOW()),
('cv-f-fs-055','freshman_sophomore','female','800m','4''12"',252,46.0,1,NOW(),NOW()),
('cv-f-fs-056','freshman_sophomore','female','800m','4''13"',253,45.0,1,NOW(),NOW()),
('cv-f-fs-057','freshman_sophomore','female','800m','4''14"',254,44.0,1,NOW(),NOW()),
('cv-f-fs-058','freshman_sophomore','female','800m','4''15"',255,43.0,1,NOW(),NOW()),
('cv-f-fs-059','freshman_sophomore','female','800m','4''16"',256,42.0,1,NOW(),NOW()),
('cv-f-fs-060','freshman_sophomore','female','800m','4''17"',257,41.0,1,NOW(),NOW()),
('cv-f-fs-061','freshman_sophomore','female','800m','4''18"',258,40.0,1,NOW(),NOW()),
('cv-f-fs-062','freshman_sophomore','female','800m','4''19"',259,39.0,1,NOW(),NOW()),
('cv-f-fs-063','freshman_sophomore','female','800m','4''20"',260,38.0,1,NOW(),NOW()),
('cv-f-fs-064','freshman_sophomore','female','800m','4''21"',261,37.0,1,NOW(),NOW()),
('cv-f-fs-065','freshman_sophomore','female','800m','4''22"',262,36.0,1,NOW(),NOW()),
('cv-f-fs-066','freshman_sophomore','female','800m','4''23"',263,35.0,1,NOW(),NOW()),
('cv-f-fs-067','freshman_sophomore','female','800m','4''24"',264,34.0,1,NOW(),NOW()),
('cv-f-fs-068','freshman_sophomore','female','800m','4''25"',265,33.0,1,NOW(),NOW()),
('cv-f-fs-069','freshman_sophomore','female','800m','4''26"',266,32.0,1,NOW(),NOW()),
('cv-f-fs-070','freshman_sophomore','female','800m','4''27"',267,31.0,1,NOW(),NOW()),
('cv-f-fs-071','freshman_sophomore','female','800m','4''28"',268,30.0,1,NOW(),NOW()),
('cv-f-fs-072','freshman_sophomore','female','800m','4''29"',269,29.0,1,NOW(),NOW()),
('cv-f-fs-073','freshman_sophomore','female','800m','4''30"',270,28.0,1,NOW(),NOW()),
('cv-f-fs-074','freshman_sophomore','female','800m','4''31"',271,27.0,1,NOW(),NOW()),
('cv-f-fs-075','freshman_sophomore','female','800m','4''32"',272,26.0,1,NOW(),NOW()),
('cv-f-fs-076','freshman_sophomore','female','800m','4''33"',273,25.0,1,NOW(),NOW()),
('cv-f-fs-077','freshman_sophomore','female','800m','4''34"',274,24.0,1,NOW(),NOW()),
('cv-f-fs-078','freshman_sophomore','female','800m','4''35"',275,23.0,1,NOW(),NOW()),
('cv-f-fs-079','freshman_sophomore','female','800m','4''36"',276,22.0,1,NOW(),NOW()),
('cv-f-fs-080','freshman_sophomore','female','800m','4''37"',277,21.0,1,NOW(),NOW()),
('cv-f-fs-081','freshman_sophomore','female','800m','4''38"',278,20.0,1,NOW(),NOW()),
('cv-f-fs-082','freshman_sophomore','female','800m','4''39"',279,19.0,1,NOW(),NOW()),
('cv-f-fs-083','freshman_sophomore','female','800m','4''40"',280,18.0,1,NOW(),NOW()),
('cv-f-fs-084','freshman_sophomore','female','800m','4''41"',281,17.0,1,NOW(),NOW()),
('cv-f-fs-085','freshman_sophomore','female','800m','4''42"',282,16.0,1,NOW(),NOW()),
('cv-f-fs-086','freshman_sophomore','female','800m','4''43"',283,15.0,1,NOW(),NOW()),
('cv-f-fs-087','freshman_sophomore','female','800m','4''44"',284,14.0,1,NOW(),NOW()),
('cv-f-fs-088','freshman_sophomore','female','800m','4''45"',285,13.0,1,NOW(),NOW()),
('cv-f-fs-089','freshman_sophomore','female','800m','4''46"',286,12.0,1,NOW(),NOW()),
('cv-f-fs-090','freshman_sophomore','female','800m','4''47"',287,11.0,1,NOW(),NOW()),
('cv-f-fs-091','freshman_sophomore','female','800m','4''48"',288,10.0,1,NOW(),NOW()),
('cv-f-fs-092','freshman_sophomore','female','800m','4''49"',289,9.0,1,NOW(),NOW()),
('cv-f-fs-093','freshman_sophomore','female','800m','4''50"',290,8.0,1,NOW(),NOW()),
('cv-f-fs-094','freshman_sophomore','female','800m','4''51"',291,7.0,1,NOW(),NOW()),
('cv-f-fs-095','freshman_sophomore','female','800m','4''52"',292,6.0,1,NOW(),NOW()),
('cv-f-fs-096','freshman_sophomore','female','800m','4''53"',293,5.0,1,NOW(),NOW()),
('cv-f-fs-097','freshman_sophomore','female','800m','4''54"',294,4.0,1,NOW(),NOW()),
('cv-f-fs-098','freshman_sophomore','female','800m','4''55"',295,3.0,1,NOW(),NOW()),
('cv-f-fs-099','freshman_sophomore','female','800m','4''56"',296,2.0,1,NOW(),NOW()),
('cv-f-fs-100','freshman_sophomore','female','800m','4''57"',297,1.0,1,NOW(),NOW()),
('cv-f-fs-101','freshman_sophomore','female','800m','4''58"',298,0.0,1,NOW(),NOW());

-- Also seed: 大三/大四 · 男 · 1000m
INSERT IGNORE INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version, created_at, updated_at) VALUES
('cv-m-js-001','junior_senior','male','1000m','3''15"',195,100.0,1,NOW(),NOW()),
('cv-m-js-002','junior_senior','male','1000m','3''16"',196,99.0,1,NOW(),NOW()),
('cv-m-js-003','junior_senior','male','1000m','3''17"',197,98.0,1,NOW(),NOW()),
('cv-m-js-004','junior_senior','male','1000m','3''18"',198,97.0,1,NOW(),NOW()),
('cv-m-js-005','junior_senior','male','1000m','3''19"',199,96.0,1,NOW(),NOW()),
('cv-m-js-006','junior_senior','male','1000m','3''20"',200,95.0,1,NOW(),NOW()),
('cv-m-js-007','junior_senior','male','1000m','3''21"',201,94.0,1,NOW(),NOW()),
('cv-m-js-008','junior_senior','male','1000m','3''22"',202,93.0,1,NOW(),NOW()),
('cv-m-js-009','junior_senior','male','1000m','3''23"',203,92.0,1,NOW(),NOW()),
('cv-m-js-010','junior_senior','male','1000m','3''24"',204,91.0,1,NOW(),NOW()),
('cv-m-js-011','junior_senior','male','1000m','3''25"',205,90.0,1,NOW(),NOW()),
('cv-m-js-012','junior_senior','male','1000m','3''26"',206,89.0,1,NOW(),NOW()),
('cv-m-js-013','junior_senior','male','1000m','3''27"',207,88.0,1,NOW(),NOW()),
('cv-m-js-014','junior_senior','male','1000m','3''28"',208,87.0,1,NOW(),NOW()),
('cv-m-js-015','junior_senior','male','1000m','3''29"',209,86.0,1,NOW(),NOW()),
('cv-m-js-016','junior_senior','male','1000m','3''30"',210,85.0,1,NOW(),NOW()),
('cv-m-js-017','junior_senior','male','1000m','3''31"',211,84.0,1,NOW(),NOW()),
('cv-m-js-018','junior_senior','male','1000m','3''32"',212,83.0,1,NOW(),NOW()),
('cv-m-js-019','junior_senior','male','1000m','3''33"',213,82.0,1,NOW(),NOW()),
('cv-m-js-020','junior_senior','male','1000m','3''34"',214,81.0,1,NOW(),NOW()),
('cv-m-js-021','junior_senior','male','1000m','3''35"',215,80.0,1,NOW(),NOW()),
('cv-m-js-022','junior_senior','male','1000m','3''36"',216,79.0,1,NOW(),NOW()),
('cv-m-js-023','junior_senior','male','1000m','3''37"',217,78.0,1,NOW(),NOW()),
('cv-m-js-024','junior_senior','male','1000m','3''38"',218,77.0,1,NOW(),NOW()),
('cv-m-js-025','junior_senior','male','1000m','3''39"',219,76.0,1,NOW(),NOW()),
('cv-m-js-026','junior_senior','male','1000m','3''40"',220,75.0,1,NOW(),NOW()),
('cv-m-js-027','junior_senior','male','1000m','3''41"',221,74.0,1,NOW(),NOW()),
('cv-m-js-028','junior_senior','male','1000m','3''42"',222,73.0,1,NOW(),NOW()),
('cv-m-js-029','junior_senior','male','1000m','3''43"',223,72.0,1,NOW(),NOW()),
('cv-m-js-030','junior_senior','male','1000m','3''44"',224,71.0,1,NOW(),NOW()),
('cv-m-js-031','junior_senior','male','1000m','3''45"',225,70.0,1,NOW(),NOW()),
('cv-m-js-032','junior_senior','male','1000m','3''46"',226,69.0,1,NOW(),NOW()),
('cv-m-js-033','junior_senior','male','1000m','3''47"',227,68.0,1,NOW(),NOW()),
('cv-m-js-034','junior_senior','male','1000m','3''48"',228,67.0,1,NOW(),NOW()),
('cv-m-js-035','junior_senior','male','1000m','3''49"',229,66.0,1,NOW(),NOW()),
('cv-m-js-036','junior_senior','male','1000m','3''50"',230,65.0,1,NOW(),NOW()),
('cv-m-js-037','junior_senior','male','1000m','3''51"',231,64.0,1,NOW(),NOW()),
('cv-m-js-038','junior_senior','male','1000m','3''52"',232,63.0,1,NOW(),NOW()),
('cv-m-js-039','junior_senior','male','1000m','3''53"',233,62.0,1,NOW(),NOW()),
('cv-m-js-040','junior_senior','male','1000m','3''54"',234,61.0,1,NOW(),NOW()),
('cv-m-js-041','junior_senior','male','1000m','3''55"',235,60.0,1,NOW(),NOW()),
('cv-m-js-042','junior_senior','male','1000m','3''56"',236,59.0,1,NOW(),NOW()),
('cv-m-js-043','junior_senior','male','1000m','3''57"',237,58.0,1,NOW(),NOW()),
('cv-m-js-044','junior_senior','male','1000m','3''58"',238,57.0,1,NOW(),NOW()),
('cv-m-js-045','junior_senior','male','1000m','3''59"',239,56.0,1,NOW(),NOW()),
('cv-m-js-046','junior_senior','male','1000m','4''00"',240,55.0,1,NOW(),NOW()),
('cv-m-js-047','junior_senior','male','1000m','4''01"',241,54.0,1,NOW(),NOW()),
('cv-m-js-048','junior_senior','male','1000m','4''02"',242,53.0,1,NOW(),NOW()),
('cv-m-js-049','junior_senior','male','1000m','4''03"',243,52.0,1,NOW(),NOW()),
('cv-m-js-050','junior_senior','male','1000m','4''04"',244,51.0,1,NOW(),NOW()),
('cv-m-js-051','junior_senior','male','1000m','4''05"',245,50.0,1,NOW(),NOW()),
('cv-m-js-052','junior_senior','male','1000m','4''06"',246,49.0,1,NOW(),NOW()),
('cv-m-js-053','junior_senior','male','1000m','4''07"',247,48.0,1,NOW(),NOW()),
('cv-m-js-054','junior_senior','male','1000m','4''08"',248,47.0,1,NOW(),NOW()),
('cv-m-js-055','junior_senior','male','1000m','4''09"',249,46.0,1,NOW(),NOW()),
('cv-m-js-056','junior_senior','male','1000m','4''10"',250,45.0,1,NOW(),NOW()),
('cv-m-js-057','junior_senior','male','1000m','4''11"',251,44.0,1,NOW(),NOW()),
('cv-m-js-058','junior_senior','male','1000m','4''12"',252,43.0,1,NOW(),NOW()),
('cv-m-js-059','junior_senior','male','1000m','4''13"',253,42.0,1,NOW(),NOW()),
('cv-m-js-060','junior_senior','male','1000m','4''14"',254,41.0,1,NOW(),NOW()),
('cv-m-js-061','junior_senior','male','1000m','4''15"',255,40.0,1,NOW(),NOW()),
('cv-m-js-062','junior_senior','male','1000m','4''16"',256,39.0,1,NOW(),NOW()),
('cv-m-js-063','junior_senior','male','1000m','4''17"',257,38.0,1,NOW(),NOW()),
('cv-m-js-064','junior_senior','male','1000m','4''18"',258,37.0,1,NOW(),NOW()),
('cv-m-js-065','junior_senior','male','1000m','4''19"',259,36.0,1,NOW(),NOW()),
('cv-m-js-066','junior_senior','male','1000m','4''20"',260,35.0,1,NOW(),NOW()),
('cv-m-js-067','junior_senior','male','1000m','4''21"',261,34.0,1,NOW(),NOW()),
('cv-m-js-068','junior_senior','male','1000m','4''22"',262,33.0,1,NOW(),NOW()),
('cv-m-js-069','junior_senior','male','1000m','4''23"',263,32.0,1,NOW(),NOW()),
('cv-m-js-070','junior_senior','male','1000m','4''24"',264,31.0,1,NOW(),NOW()),
('cv-m-js-071','junior_senior','male','1000m','4''25"',265,30.0,1,NOW(),NOW()),
('cv-m-js-072','junior_senior','male','1000m','4''26"',266,29.0,1,NOW(),NOW()),
('cv-m-js-073','junior_senior','male','1000m','4''27"',267,28.0,1,NOW(),NOW()),
('cv-m-js-074','junior_senior','male','1000m','4''28"',268,27.0,1,NOW(),NOW()),
('cv-m-js-075','junior_senior','male','1000m','4''29"',269,26.0,1,NOW(),NOW()),
('cv-m-js-076','junior_senior','male','1000m','4''30"',270,25.0,1,NOW(),NOW()),
('cv-m-js-077','junior_senior','male','1000m','4''31"',271,24.0,1,NOW(),NOW()),
('cv-m-js-078','junior_senior','male','1000m','4''32"',272,23.0,1,NOW(),NOW()),
('cv-m-js-079','junior_senior','male','1000m','4''33"',273,22.0,1,NOW(),NOW()),
('cv-m-js-080','junior_senior','male','1000m','4''34"',274,21.0,1,NOW(),NOW()),
('cv-m-js-081','junior_senior','male','1000m','4''35"',275,20.0,1,NOW(),NOW()),
('cv-m-js-082','junior_senior','male','1000m','4''36"',276,19.0,1,NOW(),NOW()),
('cv-m-js-083','junior_senior','male','1000m','4''37"',277,18.0,1,NOW(),NOW()),
('cv-m-js-084','junior_senior','male','1000m','4''38"',278,17.0,1,NOW(),NOW()),
('cv-m-js-085','junior_senior','male','1000m','4''39"',279,16.0,1,NOW(),NOW()),
('cv-m-js-086','junior_senior','male','1000m','4''40"',280,15.0,1,NOW(),NOW()),
('cv-m-js-087','junior_senior','male','1000m','4''41"',281,14.0,1,NOW(),NOW()),
('cv-m-js-088','junior_senior','male','1000m','4''42"',282,13.0,1,NOW(),NOW()),
('cv-m-js-089','junior_senior','male','1000m','4''43"',283,12.0,1,NOW(),NOW()),
('cv-m-js-090','junior_senior','male','1000m','4''44"',284,11.0,1,NOW(),NOW()),
('cv-m-js-091','junior_senior','male','1000m','4''45"',285,10.0,1,NOW(),NOW()),
('cv-m-js-092','junior_senior','male','1000m','4''46"',286,9.0,1,NOW(),NOW()),
('cv-m-js-093','junior_senior','male','1000m','4''47"',287,8.0,1,NOW(),NOW()),
('cv-m-js-094','junior_senior','male','1000m','4''48"',288,7.0,1,NOW(),NOW()),
('cv-m-js-095','junior_senior','male','1000m','4''49"',289,6.0,1,NOW(),NOW()),
('cv-m-js-096','junior_senior','male','1000m','4''50"',290,5.0,1,NOW(),NOW()),
('cv-m-js-097','junior_senior','male','1000m','4''51"',291,4.0,1,NOW(),NOW()),
('cv-m-js-098','junior_senior','male','1000m','4''52"',292,3.0,1,NOW(),NOW()),
('cv-m-js-099','junior_senior','male','1000m','4''53"',293,2.0,1,NOW(),NOW()),
('cv-m-js-100','junior_senior','male','1000m','4''54"',294,1.0,1,NOW(),NOW()),
('cv-m-js-101','junior_senior','male','1000m','4''55"',295,0.0,1,NOW(),NOW());

-- Also seed: 大三/大四 · 女 · 800m
INSERT IGNORE INTO conversion_rules_admin (id, grade_group, gender, item_name, raw_value, raw_seconds, converted_score, version, created_at, updated_at) VALUES
('cv-f-js-001','junior_senior','female','800m','3''16"',196,100.0,1,NOW(),NOW()),
('cv-f-js-002','junior_senior','female','800m','3''17"',197,99.0,1,NOW(),NOW()),
('cv-f-js-003','junior_senior','female','800m','3''18"',198,98.0,1,NOW(),NOW()),
('cv-f-js-004','junior_senior','female','800m','3''19"',199,97.0,1,NOW(),NOW()),
('cv-f-js-005','junior_senior','female','800m','3''20"',200,96.0,1,NOW(),NOW()),
('cv-f-js-006','junior_senior','female','800m','3''21"',201,95.0,1,NOW(),NOW()),
('cv-f-js-007','junior_senior','female','800m','3''22"',202,94.0,1,NOW(),NOW()),
('cv-f-js-008','junior_senior','female','800m','3''23"',203,93.0,1,NOW(),NOW()),
('cv-f-js-009','junior_senior','female','800m','3''24"',204,92.0,1,NOW(),NOW()),
('cv-f-js-010','junior_senior','female','800m','3''25"',205,91.0,1,NOW(),NOW()),
('cv-f-js-011','junior_senior','female','800m','3''26"',206,90.0,1,NOW(),NOW()),
('cv-f-js-012','junior_senior','female','800m','3''27"',207,89.0,1,NOW(),NOW()),
('cv-f-js-013','junior_senior','female','800m','3''28"',208,88.0,1,NOW(),NOW()),
('cv-f-js-014','junior_senior','female','800m','3''29"',209,87.0,1,NOW(),NOW()),
('cv-f-js-015','junior_senior','female','800m','3''30"',210,86.0,1,NOW(),NOW()),
('cv-f-js-016','junior_senior','female','800m','3''31"',211,85.0,1,NOW(),NOW()),
('cv-f-js-017','junior_senior','female','800m','3''32"',212,84.0,1,NOW(),NOW()),
('cv-f-js-018','junior_senior','female','800m','3''33"',213,83.0,1,NOW(),NOW()),
('cv-f-js-019','junior_senior','female','800m','3''34"',214,82.0,1,NOW(),NOW()),
('cv-f-js-020','junior_senior','female','800m','3''35"',215,81.0,1,NOW(),NOW()),
('cv-f-js-021','junior_senior','female','800m','3''36"',216,80.0,1,NOW(),NOW()),
('cv-f-js-022','junior_senior','female','800m','3''37"',217,79.0,1,NOW(),NOW()),
('cv-f-js-023','junior_senior','female','800m','3''38"',218,78.0,1,NOW(),NOW()),
('cv-f-js-024','junior_senior','female','800m','3''39"',219,77.0,1,NOW(),NOW()),
('cv-f-js-025','junior_senior','female','800m','3''40"',220,76.0,1,NOW(),NOW()),
('cv-f-js-026','junior_senior','female','800m','3''41"',221,75.0,1,NOW(),NOW()),
('cv-f-js-027','junior_senior','female','800m','3''42"',222,74.0,1,NOW(),NOW()),
('cv-f-js-028','junior_senior','female','800m','3''43"',223,73.0,1,NOW(),NOW()),
('cv-f-js-029','junior_senior','female','800m','3''44"',224,72.0,1,NOW(),NOW()),
('cv-f-js-030','junior_senior','female','800m','3''45"',225,71.0,1,NOW(),NOW()),
('cv-f-js-031','junior_senior','female','800m','3''46"',226,70.0,1,NOW(),NOW()),
('cv-f-js-032','junior_senior','female','800m','3''47"',227,69.0,1,NOW(),NOW()),
('cv-f-js-033','junior_senior','female','800m','3''48"',228,68.0,1,NOW(),NOW()),
('cv-f-js-034','junior_senior','female','800m','3''49"',229,67.0,1,NOW(),NOW()),
('cv-f-js-035','junior_senior','female','800m','3''50"',230,66.0,1,NOW(),NOW()),
('cv-f-js-036','junior_senior','female','800m','3''51"',231,65.0,1,NOW(),NOW()),
('cv-f-js-037','junior_senior','female','800m','3''52"',232,64.0,1,NOW(),NOW()),
('cv-f-js-038','junior_senior','female','800m','3''53"',233,63.0,1,NOW(),NOW()),
('cv-f-js-039','junior_senior','female','800m','3''54"',234,62.0,1,NOW(),NOW()),
('cv-f-js-040','junior_senior','female','800m','3''55"',235,61.0,1,NOW(),NOW()),
('cv-f-js-041','junior_senior','female','800m','3''56"',236,60.0,1,NOW(),NOW()),
('cv-f-js-042','junior_senior','female','800m','3''57"',237,59.0,1,NOW(),NOW()),
('cv-f-js-043','junior_senior','female','800m','3''58"',238,58.0,1,NOW(),NOW()),
('cv-f-js-044','junior_senior','female','800m','3''59"',239,57.0,1,NOW(),NOW()),
('cv-f-js-045','junior_senior','female','800m','4''00"',240,56.0,1,NOW(),NOW()),
('cv-f-js-046','junior_senior','female','800m','4''01"',241,55.0,1,NOW(),NOW()),
('cv-f-js-047','junior_senior','female','800m','4''02"',242,54.0,1,NOW(),NOW()),
('cv-f-js-048','junior_senior','female','800m','4''03"',243,53.0,1,NOW(),NOW()),
('cv-f-js-049','junior_senior','female','800m','4''04"',244,52.0,1,NOW(),NOW()),
('cv-f-js-050','junior_senior','female','800m','4''05"',245,51.0,1,NOW(),NOW()),
('cv-f-js-051','junior_senior','female','800m','4''06"',246,50.0,1,NOW(),NOW()),
('cv-f-js-052','junior_senior','female','800m','4''07"',247,49.0,1,NOW(),NOW()),
('cv-f-js-053','junior_senior','female','800m','4''08"',248,48.0,1,NOW(),NOW()),
('cv-f-js-054','junior_senior','female','800m','4''09"',249,47.0,1,NOW(),NOW()),
('cv-f-js-055','junior_senior','female','800m','4''10"',250,46.0,1,NOW(),NOW()),
('cv-f-js-056','junior_senior','female','800m','4''11"',251,45.0,1,NOW(),NOW()),
('cv-f-js-057','junior_senior','female','800m','4''12"',252,44.0,1,NOW(),NOW()),
('cv-f-js-058','junior_senior','female','800m','4''13"',253,43.0,1,NOW(),NOW()),
('cv-f-js-059','junior_senior','female','800m','4''14"',254,42.0,1,NOW(),NOW()),
('cv-f-js-060','junior_senior','female','800m','4''15"',255,41.0,1,NOW(),NOW()),
('cv-f-js-061','junior_senior','female','800m','4''16"',256,40.0,1,NOW(),NOW()),
('cv-f-js-062','junior_senior','female','800m','4''17"',257,39.0,1,NOW(),NOW()),
('cv-f-js-063','junior_senior','female','800m','4''18"',258,38.0,1,NOW(),NOW()),
('cv-f-js-064','junior_senior','female','800m','4''19"',259,37.0,1,NOW(),NOW()),
('cv-f-js-065','junior_senior','female','800m','4''20"',260,36.0,1,NOW(),NOW()),
('cv-f-js-066','junior_senior','female','800m','4''21"',261,35.0,1,NOW(),NOW()),
('cv-f-js-067','junior_senior','female','800m','4''22"',262,34.0,1,NOW(),NOW()),
('cv-f-js-068','junior_senior','female','800m','4''23"',263,33.0,1,NOW(),NOW()),
('cv-f-js-069','junior_senior','female','800m','4''24"',264,32.0,1,NOW(),NOW()),
('cv-f-js-070','junior_senior','female','800m','4''25"',265,31.0,1,NOW(),NOW()),
('cv-f-js-071','junior_senior','female','800m','4''26"',266,30.0,1,NOW(),NOW()),
('cv-f-js-072','junior_senior','female','800m','4''27"',267,29.0,1,NOW(),NOW()),
('cv-f-js-073','junior_senior','female','800m','4''28"',268,28.0,1,NOW(),NOW()),
('cv-f-js-074','junior_senior','female','800m','4''29"',269,27.0,1,NOW(),NOW()),
('cv-f-js-075','junior_senior','female','800m','4''30"',270,26.0,1,NOW(),NOW()),
('cv-f-js-076','junior_senior','female','800m','4''31"',271,25.0,1,NOW(),NOW()),
('cv-f-js-077','junior_senior','female','800m','4''32"',272,24.0,1,NOW(),NOW()),
('cv-f-js-078','junior_senior','female','800m','4''33"',273,23.0,1,NOW(),NOW()),
('cv-f-js-079','junior_senior','female','800m','4''34"',274,22.0,1,NOW(),NOW()),
('cv-f-js-080','junior_senior','female','800m','4''35"',275,21.0,1,NOW(),NOW()),
('cv-f-js-081','junior_senior','female','800m','4''36"',276,20.0,1,NOW(),NOW()),
('cv-f-js-082','junior_senior','female','800m','4''37"',277,19.0,1,NOW(),NOW()),
('cv-f-js-083','junior_senior','female','800m','4''38"',278,18.0,1,NOW(),NOW()),
('cv-f-js-084','junior_senior','female','800m','4''39"',279,17.0,1,NOW(),NOW()),
('cv-f-js-085','junior_senior','female','800m','4''40"',280,16.0,1,NOW(),NOW()),
('cv-f-js-086','junior_senior','female','800m','4''41"',281,15.0,1,NOW(),NOW()),
('cv-f-js-087','junior_senior','female','800m','4''42"',282,14.0,1,NOW(),NOW()),
('cv-f-js-088','junior_senior','female','800m','4''43"',283,13.0,1,NOW(),NOW()),
('cv-f-js-089','junior_senior','female','800m','4''44"',284,12.0,1,NOW(),NOW()),
('cv-f-js-090','junior_senior','female','800m','4''45"',285,11.0,1,NOW(),NOW()),
('cv-f-js-091','junior_senior','female','800m','4''46"',286,10.0,1,NOW(),NOW()),
('cv-f-js-092','junior_senior','female','800m','4''47"',287,9.0,1,NOW(),NOW()),
('cv-f-js-093','junior_senior','female','800m','4''48"',288,8.0,1,NOW(),NOW()),
('cv-f-js-094','junior_senior','female','800m','4''49"',289,7.0,1,NOW(),NOW()),
('cv-f-js-095','junior_senior','female','800m','4''50"',290,6.0,1,NOW(),NOW()),
('cv-f-js-096','junior_senior','female','800m','4''51"',291,5.0,1,NOW(),NOW()),
('cv-f-js-097','junior_senior','female','800m','4''52"',292,4.0,1,NOW(),NOW()),
('cv-f-js-098','junior_senior','female','800m','4''53"',293,3.0,1,NOW(),NOW()),
('cv-f-js-099','junior_senior','female','800m','4''54"',294,2.0,1,NOW(),NOW()),
('cv-f-js-100','junior_senior','female','800m','4''55"',295,1.0,1,NOW(),NOW()),
('cv-f-js-101','junior_senior','female','800m','4''56"',296,0.0,1,NOW(),NOW());

-- ── Seed: more membership data for pending certifications testing ──

INSERT IGNORE INTO memberships (id, student_id, type, organization, status, valid_until, offset_status, offset_hours, comment) VALUES
('m3','22301318','team','篮球队','待确认','2026-09-01','待确认',10.0,'等待任课老师审核'),
('m4','22301776','club','跑步社','认证有效','2026-09-01','待确认',8.0,'社团活动记录待确认');

-- ═══════════════════════════════════════════════════════════════════
-- Phase 1 P0: New tables — deliveries, organizations
-- ═══════════════════════════════════════════════════════════════════

-- ── Deliveries: teacher grade archive submissions ──────────────────

CREATE TABLE IF NOT EXISTS deliveries (
  id             VARCHAR(64) PRIMARY KEY,
  course_id      VARCHAR(32) NOT NULL,
  submitted_by   VARCHAR(32),
  submitted_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  status         VARCHAR(32) DEFAULT '待管理员确认',
  issue_count    INT DEFAULT 0,
  comment        TEXT,
  reviewer_id    VARCHAR(32),
  reviewed_at    DATETIME,
  review_comment TEXT,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id)
);

-- ── Organizations: teams and clubs ──────────────────────────────────

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(64) PRIMARY KEY,
  setting_value JSON NOT NULL,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organizations (
  id          VARCHAR(64) PRIMARY KEY,
  name        VARCHAR(128) NOT NULL,
  type        VARCHAR(32) NOT NULL COMMENT 'team or club',
  manager_id  VARCHAR(32) COMMENT 'user ID who manages this org',
  description TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (manager_id) REFERENCES users(id)
);

-- Seed: sample organizations
INSERT IGNORE INTO organizations (id, name, type, manager_id, description, created_at) VALUES
('org-team-basketball', '篮球队', 'team', NULL, '校篮球队', NOW()),
('org-team-swim', '游泳队', 'team', NULL, '校游泳队', NOW()),
('org-club-running', '跑步社', 'club', NULL, '跑步爱好者社团', NOW()),
('org-club-yoga', '瑜伽社', 'club', NULL, '瑜伽练习社团', NOW());
