# BNBU Sports Web — 开发环境部署文档

## 环境架构

```
浏览器 :3335  →  Nginx → /          → /www/wwwroot/123.207.5.70_3335/ (静态文件)
                        → /api/*     → proxy_pass http://127.0.0.1:3004
                        → /uploads/* → alias /www/wwwroot/bnbu-api-dev/uploads/

浏览器 :3336  →  Nginx → /api/*     → proxy_pass http://127.0.0.1:3004 (纯 API)

PM2 进程: bnbu-api-dev (端口 3004)
数据库:    bnbu_dev_v1 (MySQL, 独立于生产库 bnbu_123_207_5_70_96)
```

## 部署清单

### 需要上传的文件

| 本地路径                           | 服务器路径                                                | 说明              |
| ---------------------------------- | --------------------------------------------------------- | ----------------- |
| `backend/server.js`              | `/www/wwwroot/bnbu-api-dev/server.js`                   | API 服务 |
| `database/schema.sql`            | 仅执行 SQL 新增部分                                       | 建表 DDL |
| `frontend/index.html`            | `/www/wwwroot/123.207.5.70_3335/index.html`             | 前端入口 |
| `frontend/app.js`                  | `/www/wwwroot/123.207.5.70_3335/app.js`                 | 管理员 SPA |
| `frontend/styles-campus-blue.css` | `/www/wwwroot/123.207.5.70_3335/styles-campus-blue.css` | 管理员样式 |
| `frontend/teacher/*`             | 同上目录 `teacher/` 子路径                               | 老师端 UI |

### 部署步骤

**1. 上传后端**

```bash
# 宝塔面板 → 文件 → /www/wwwroot/bnbu-api-dev/
# 上传覆盖 server.js
```

**2. 执行 SQL（仅首次，新增 2 张表）**

```sql
-- 在宝塔 → 数据库 → bnbu_dev_v1 → SQL 框中执行：
CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(128) PRIMARY KEY,
  `value` JSON NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deliveries (
  id VARCHAR(64) PRIMARY KEY,
  course_id VARCHAR(32) NOT NULL,
  submitted_by VARCHAR(32),
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(32) DEFAULT '待管理员确认',
  issue_count INT DEFAULT 0,
  comment TEXT,
  reviewer_id VARCHAR(32),
  reviewed_at DATETIME,
  review_comment TEXT
);

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL COMMENT 'team or club',
  manager_id VARCHAR(32),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO organizations (id, name, type, description, created_at) VALUES
('org-team-basketball', '篮球队', 'team', '校篮球队', NOW()),
('org-team-swim', '游泳队', 'team', '校游泳队', NOW()),
('org-club-running', '跑步社', 'club', '跑步爱好者社团', NOW()),
('org-club-yoga', '瑜伽社', 'club', '瑜伽练习社团', NOW());
```

**3. 重启后端**

```bash
# 宝塔终端
pm2 restart bnbu-api-dev
pm2 status  # 确认 online
```

**4. 上传前端**

```bash
# 宝塔面板 → 文件 → /www/wwwroot/123.207.5.70_3335/
# 上传覆盖 index.html, app.js, styles-campus-blue.css
```

**5. 验证**

```bash
# 健康检查
curl http://localhost:3004/api/health

# P0 端点
curl http://localhost:3004/api/teacher/courses \
  -H "Authorization: Bearer demo-token-u1"

curl http://localhost:3004/api/admin/deliveries \
  -H "Authorization: Bearer demo-token-u2"

curl http://localhost:3004/api/manager/memberships \
  -H "Authorization: Bearer demo-token-u2"

curl http://localhost:3004/api/admin/organizations \
  -H "Authorization: Bearer demo-token-u2"

# 浏览器验证
# 打开 http://123.207.5.70:3335/
# 老师登录: teacher@bnbu.edu.cn / password123
# 管理员登录: admin@bnbu.edu.cn / password123
```

## 环境变量 (PM2)

当前 `bnbu-api-dev` 建议配置的环境变量：

```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=bnbu_dev_v1
DB_PASSWORD=26fK6mRHEHGh3re2
DB_NAME=bnbu_dev_v1
ALLOW_DEMO_TOKENS=true
CORS_ORIGINS=http://123.207.5.70:3335,http://127.0.0.1:3335
```

## 端口说明

| 端口 | 用途            | Nginx 配置                                          |
| ---- | --------------- | --------------------------------------------------- |
| 3335 | 前端 + API 代理 | 静态文件`/` + `/api/*` → 3004 + `/uploads/*` |
| 3336 | 纯 API 代理     | `/api/*` → 3004                                  |
| 3004 | Node.js 后端    | PM2: bnbu-api-dev                                   |

## API 端点总览

### 认证

- `POST /api/auth/login` — 登录 (body: {account, password})
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 当前用户信息

### 教师端 (role: teacher)

- `GET /api/teacher/courses` — 我的课程列表
- `GET /api/teacher/courses/:id/dashboard` — 课程仪表盘
- `GET /api/teacher/courses/:id/students` — 学生名单
- `GET /api/teacher/courses/:id/students/:sid/hours-detail` — 学生学时明细
- `POST /api/teacher/courses/:id/students/:sid/manual-credit` — 手动加学时
- `GET /api/teacher/courses/:id/reviews` — 审核列表
- `PUT /api/teacher/reviews/:id/decision` — 审核通过/驳回
- `GET /api/teacher/courses/:id/grades` — 成绩汇总
- `PUT /api/teacher/courses/:id/grades/exam` — 批量保存考试成绩
- `PUT /api/teacher/courses/:id/grades/attendance` — 批量保存平时分
- `PUT /api/teacher/courses/:id/grades/physical` — 批量保存体测分
- `GET /api/teacher/courses/:id/export` — 导出成绩
- `GET /api/teacher/courses/:id/export/precheck` — 导出预检
- `POST /api/teacher/courses/:id/delivery` — 提交成绩归档
- `POST /api/teacher/courses/:id/students/import/preview` — CSV 导入预览
- `POST /api/teacher/courses/:id/students/import/confirm` — CSV 导入确认
- `GET /api/teacher/courses/:id/tasks` — 课程任务列表
- `POST /api/teacher/courses/:id/tasks` — 创建任务
- `PATCH /api/teacher/courses/:id/tasks/:tid` — 更新任务
- `DELETE /api/teacher/courses/:id/tasks/:tid` — 删除任务
- `GET /api/teacher/courses/:id/exemptions` — 课程免测列表
- `GET /api/teacher/courses/:id/pending-certifications` — 待确认抵扣
- `PUT /api/teacher/certifications/:certId/confirm` — 确认抵扣
- `PUT /api/teacher/certifications/:certId/reject` — 驳回抵扣
- `GET /api/teacher/conversion/calculate` — 耐力跑换算
- `GET /api/teacher/students/:id/records` — 学生跨来源记录
- `PUT /api/teacher/team-offset/:id/confirm` — 确认校队抵扣
- `PUT /api/teacher/students/:sid/organization-identity/:iid/flag` — 标记组织身份

### 管理员端 (role: admin)

- `GET /api/admin/overview` — 全校数据看板
- `GET /api/admin/semesters` — 学期列表
- `GET /api/admin/courses` — 全部课程
- `GET /api/admin/users` — 全部用户
- `GET /api/admin/logs` — 操作日志
- `GET/PUT /api/admin/sport-rules` — 体育学时标准
- `GET/PUT /api/admin/grade-rules` — 成绩权重规则
- `GET/PUT /api/admin/export-template` — 导出模板
- `POST /api/admin/import-students` — 批量导入学生
- `GET /api/admin/conversion-table/:grade/:gender` — 体测换算表
- `PUT /api/admin/conversion-table/:grade/:gender` — 更新换算表
- `POST /api/admin/conversion-table/validate` — 验证换算表
- `GET /api/admin/deliveries` — 归档审核列表
- `PUT /api/admin/deliveries/:courseId/decision` — 归档审核决策
- `GET/POST /api/admin/organizations` — 组织管理
- `PUT /api/admin/memberships/:id/decision` — 管理员复核抵扣

### 负责人端 (role: manager)

- `GET /api/manager/memberships` — 组织成员列表
- `POST /api/manager/memberships` — 新增成员认证
- `POST /api/manager/memberships/import/preview` — CSV 预览
- `POST /api/manager/memberships/import/confirm` — CSV 确认导入
- `PUT /api/manager/memberships/:id/decision` — 批准/驳回认证

### 学生端 (role: student)

- `GET /api/sport/summary` — 体育学时摘要
- `GET/POST /api/sport/records` — 打卡记录
- `POST /api/sport/records/:id/supplements` — 补交材料
- `GET /api/sport/identity` — 组织身份
- `POST /api/scoring/convert-endurance` — 耐力跑换算
- `GET/POST /api/student/exemptions` — 免测申请
- `GET /api/student/tasks` — 学生任务
- `GET/PUT /api/student/profile` — 个人信息

### 通用

- `GET /api/health` — 服务健康检查
- `GET /api/common/notifications` — 通知列表
- `PUT /api/common/notifications/:id/read` — 标记已读
- `POST /api/upload/proof` — 上传证明文件 (multipart, field: files)

## 安全配置 (Phase 2 已实施)

- **Demo Token**: 仅当 `ALLOW_DEMO_TOKENS=true` 时可用（开发环境开启）
- **密码**: 采用 pbkdf2 (SHA-512, 100000次迭代, 128位salt) 哈希存储
- **安全响应头**: X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- **CORS**: 从 `CORS_ORIGINS` 环境变量读取白名单
- **速率限制**: 登录接口 60秒内最多5次
- **上传权限**: 仅 student 角色可调用 `/api/upload/proof`
