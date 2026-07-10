# BNBU Sports V1 — 独立部署指南（与队友 V2 共存）

## 服务器端口分配（记住这张表）

| 端口           | 谁在用            | Nginx 前端根目录                  | Node.js API    | PM2 进程名      |
| -------------- | ----------------- | --------------------------------- | -------------- | --------------- |
| **96**   | **你 (V1)** | `/www/wwwroot/123.207.5.70_96/` | **3001** | `bnbu-api-v1` |
| ? (80 或 其他) | 队友 (V2)         | 队友的前端目录                    | 3000           | `bnbu-api`    |

> **核心原则：端口不同 = 完全隔离。`/api/` prefix 可以相同，因为跑在不同端口上。**

---

## 服务器目录结构

```
/www/wwwroot/
├── 123.207.5.70_96/      ← 你的 V1 前端（端口 96）
├── bnbu-api-v1/          ← 你的 V1 API（端口 3001）★ 新建
├── bnbu-api/             ← 队友的 V2 API（端口 3000）
├── 123.123.376.23/       ← 队友的
└── default/              ← 系统默认
```

---

## 第一步：初始化数据库（如尚未执行）

宝塔 → **数据库** → 找到 `123_207_5_70_96` → **管理** (phpMyAdmin) → **SQL** 标签 → 粘贴 `schema.sql` 全部内容 → **执行**。

执行成功后应有 **9 张表**：

- `semesters` — 学期配置
- `users` — 用户账号
- `courses` — 课程信息
- `student_progress` — 学生进度
- `reviews` — 打卡审核
- `audit_logs` — 操作日志
- `sport_records` — 运动/打卡记录
- `notifications` — 通知消息
- `memberships` — 组织成员（校队/社团）

---

## 第二步：上传文件

### 2.1 前端文件 → `/www/wwwroot/123.207.5.70_96/`

```
index.html
app.js
styles-campus-blue.css
styles.css
```

### 2.2 后端文件 → `/www/wwwroot/bnbu-api-v1/`

```
package.json
server.js
```

然后在宝塔终端执行：

```bash
cd /www/wwwroot/bnbu-api-v1
npm install
```

### 2.3 创建上传目录

```bash
mkdir -p /www/wwwroot/bnbu-api-v1/uploads
chmod 755 /www/wwwroot/bnbu-api-v1/uploads
```

---

## 第三步：配置 Nginx

宝塔 → **网站** → `123.207.5.70:96` → **配置文件**：

```nginx
server {
    listen 96;
    server_name 123.207.5.70;
    root /www/wwwroot/123.207.5.70_96;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
        client_max_body_size 10m;
    }

    location /uploads/ {
        alias /www/wwwroot/bnbu-api-v1/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

保存 → **重载 Nginx**。

---

## 第四步：启动 V1 API

```bash
cd /www/wwwroot/bnbu-api-v1
pm2 start server.js --name bnbu-api-v1
pm2 save
```

验证：

```bash
curl http://127.0.0.1:3001/api/health
# → {"ok":true,"service":"BNBU Sports API","db":true}
```

---

## 第五步：验证全链路

```bash
curl http://123.207.5.70:96/api/health
```

浏览器打开 `http://123.207.5.70:96/`，登录 → **后端交付** → **检查后端连接**。

---

## 第六步：Android APK

已配置 `DefaultBaseUrl = "http://123.207.5.70:96/api"`，重新编译 APK。

放到 `/www/wwwroot/123.207.5.70_96/bnbu-student.apk`，学生通过 `http://123.207.5.70:96/bnbu-student.apk` 下载。

---

## 数据库

你和队友共享 MySQL `123_207_5_70_96`（9 张表）。V1 和 V2 共用同一套表结构。

> ⚠️ 如果有人改了表结构，记得通知对方。

---

## PM2

```bash
pm2 list
# bnbu-api      │ 3000 │ 队友 V2
# bnbu-api-v1   │ 3001 │ 你的 V1
```

---

## 第七步：数据库变更（2026-06-17 更新）

### 7.1 执行 Schema 变更

宝塔 → 数据库 → phpMyAdmin → 选择 `123_207_5_70_96` → SQL 标签页。

将 `database/schema.sql` **最新完整内容**粘贴执行（末尾新增代码段约 200 行）。

由于使用 `CREATE TABLE IF NOT EXISTS` 和条件存储过程，重复执行安全。

### 7.2 新增内容摘要

| 变更                                                                       | 说明               |
| -------------------------------------------------------------------------- | ------------------ |
| `users` + `gender` ENUM('male','female')                               | 学生性别           |
| `users` + `grade_level` ENUM('freshman','sophomore','junior','senior') | 学生年级           |
| `sport_records` + `record_source` ENUM('student','team','club')        | 打卡来源区分       |
| NEW TABLE `endurance_scoring_rules` (80 rows)                            | 耐力跑国标评分表   |
| NEW TABLE `exemptions`                                                   | 800/1000m 免测申请 |
| NEW TABLE `tasks`                                                        | 课程任务           |
| Seed tasks (4 rows)                                                        | 示例任务数据       |
| Seed user gender/grade updates (6 rows)                                    | 示例学生性别年级   |

### 7.3 验证

```sql
-- 验证新增字段
SELECT id, name, gender, grade_level FROM users WHERE role = 'student';

-- 验证评分表
SELECT COUNT(*) AS rule_count FROM endurance_scoring_rules;
-- 应返回 80

-- 验证新表
SHOW TABLES LIKE 'exemptions';
SHOW TABLES LIKE 'tasks';
```

---

## 第八步：API 服务更新（新增 12 个端点）

### 8.1 上传新 server.js

覆盖 `/www/wwwroot/bnbu-api-v1/server.js`

### 8.2 重启 PM2

```bash
pm2 restart bnbu-api-v1
pm2 save
```

### 8.3 验证新端点

```bash
# 测试耐力跑换算
curl -X POST http://127.0.0.1:3001/api/scoring/convert-endurance \
  -H "Content-Type: application/json" \
  -d '{"timeSeconds":210,"gender":"male","gradeLevel":"sophomore"}'
# 应返回: {"score":90,"tier":"excellent",...}

# 测试学生档案
curl http://127.0.0.1:3001/api/student/profile \
  -H "Authorization: Bearer demo-token-22301142"
# 应返回包含 gender, gradeLevel 的学生档案

# 测试全量打卡查询（需要 teacher token）
curl http://127.0.0.1:3001/api/teacher/students/22301142/records \
  -H "Authorization: Bearer demo-token-u1"
```

### 8.4 新增端点清单

| #  | 端点                                         | 功能               | 权限           |
| -- | -------------------------------------------- | ------------------ | -------------- |
| 1  | `GET /api/teacher/students/:id/records`    | 跨类型统一打卡查询 | teacher, admin |
| 2  | `PUT /api/admin/memberships/:id/decision`  | 审批校队/社团抵卡  | admin          |
| 3  | `PUT /api/teacher/team-offset/:id/confirm` | 老师最终确认抵卡   | teacher, admin |
| 4  | `POST /api/scoring/convert-endurance`      | 耐力跑时间→分数   | authenticated  |
| 5  | `GET /api/student/exemptions`              | 学生免测列表       | authenticated  |
| 6  | `POST /api/student/exemptions`             | 提交免测申请       | authenticated  |
| 7  | `GET /api/teacher/exemptions`              | 老师查看免测       | teacher, admin |
| 8  | `PUT /api/teacher/exemptions/:id/decision` | 免测审批           | teacher, admin |
| 9  | `GET /api/student/tasks`                   | 学生任务列表       | authenticated  |
| 10 | `GET /api/student/profile`                 | 学生档案           | authenticated  |
| 11 | `PUT /api/student/profile`                 | 更新学生信息       | authenticated  |
| 12 | `POST /api/admin/import-students`          | Excel/CSV 批量导入 | admin          |

---

## 第九步：前端文件更新

### 9.1 上传新前端文件

覆盖 `/www/wwwroot/123.207.5.70_96/` 下的：

- `index.html`
- `app.js`
- `styles-campus-blue.css`

### 9.2 验证新页面

浏览器访问 `http://123.207.5.70:96/`，登录后确认：

- 左侧导航新增：学生详情、耐力跑换算、免测审核（teacher 导航）
- 左侧导航新增：学生导入（admin 导航）
- 耐力跑换算可输入时间并显示分数
- 学生详情可查看跨类型打卡记录

---

## 故障排查

### API 返回 404

```bash
pm2 logs bnbu-api-v1 --lines 30
netstat -tlnp | grep 3001
```

### 数据库查询失败

确认 schema 已执行：

```sql
SHOW COLUMNS FROM users LIKE 'gender';
SHOW COLUMNS FROM sport_records LIKE 'record_source';
```

### Nginx 502 Bad Gateway

```bash
pm2 status
pm2 restart bnbu-api-v1
```

---

## 常见问题

| 问题                | 检查                                                       |
| ------------------- | ---------------------------------------------------------- |
| `/api/health` 502 | `pm2 status`, `netstat -tlnp \| grep 3001`              |
| Nginx 没代理 api    | 确认 96 端口站点的配置里有 `location /api/` → `:3001` |
| Android 连不上      | 手机浏览器打开 `http://123.207.5.70:96/api/health` 试试  |
