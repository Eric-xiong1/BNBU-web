# 后端修改报告（2026-07-17）

## 范围与原则

本轮只修改后端、数据库迁移、Nginx 上传配置和 OpenAPI 契约；未修改前端、未执行生产部署、未操作生产数据库。改动遵循“先读后改、一个业务切片一组最小补丁、兼容旧数据、可回滚”的 Vibe Coding 要求。

## 已修改内容与前后对比

| 范围 | 修改前 | 修改后 | 预期效果 |
|---|---|---|---|
| 任务时间 | `tasks` 只有自由文本 `deadline`；服务端无法裁决是否可提交 | 增加 UTC `start_at`、`end_at` 和 `timezone`；提供可重复执行的迁移 | 教师可保存确定的时间窗口，结束时间早于开始时间会被拒绝 |
| 服务端时间 | 只有健康检查中的非契约 `time` 字段 | 新增 `GET /api/server-time`，返回 UTC、时区和 Unix 毫秒 | 学生端可显示与后端同源的时间，避免客户端改时钟绕过规则 |
| 学生提交 | `taskId` 仅作为关联字段保存，没有核验任务存在、课程一致或时间范围 | 提交时验证任务存在、课程匹配，并返回 `TASK_NOT_STARTED` 或 `TASK_ENDED` | 前端绕过按钮限制时，后端仍能拒绝窗口外打卡 |
| 图片上传 | 接受最多 6 张图片和 1 个视频，单请求可能受 Nginx 10MB 限制 | 仅接受 JPEG/PNG/WebP/HEIC/HEIF，最多 6 张、单张 8MB；失败清理已落盘文件 | 上传规则与本周任务书一致，避免失败请求遗留孤儿文件 |
| Nginx | `client_max_body_size 10m`，不足以承载多图表单 | 调整为 50MB，为 6×8MB 图片和 multipart 边界预留空间 | Node 与 Nginx 的限制一致，不会在代理层提前失败 |
| 打卡百分制 | 成绩接口从 `student_progress` 汇总学时计算加权分，待审核/驳回记录可能间接影响口径 | 统计 `sport_records.status = 已通过` 的 `approved_hours`，生成 `validHours`、`checkinPercent`、规则版本和计算时间 | 20h=100，超过 20h 封顶；待审核、驳回和无效记录不计入有效小时 |
| 耐力跑换算 | 仅接受 `timeSeconds`，响应缺少原始输入与规则版本 | 支持 `timeSeconds` 或 `minutes + seconds`，拒绝秒数大于 59 和非法值 | 前端无需自行维护换算逻辑，响应可追溯 |
| 学生导入顺序 | 导入后没有批次和行号，查询顺序不稳定 | `student_progress` 保存 `import_batch`、`import_order`；教师列表支持 `import`、`studentId`、`name` 排序 | 前导零学号按字符串保留，默认展示原始导入顺序 |
| 导出模式 | CSV 只有单一展示形式，JSON/CSV 不提供统一的模式与排序参数 | `grades` 与 `export` 支持 `raw`、`converted`、`percent` 和 `import`、`studentId`、`name` | JSON 和 CSV 使用同一排序后的成绩行；无参数调用保持兼容 |
| 孤儿上传治理 | 只清理当前失败请求产生的落盘文件 | 新增默认 dry-run 的 `npm run cleanup:uploads` 脚本，扫描未被三类业务记录引用且超过最小保留期的文件 | 运维可先审查候选文件，再以显式环境变量执行删除 |
| 任务操作审计 | 任务创建、时间窗口修改没有统一的审计记录 | 创建与更新课程任务写入 `audit_logs` | 可追溯操作者、时间、课程和任务目标 |
| 接口契约 | OpenAPI 未声明服务器时间、证明图片上传、时间窗口和有效小时百分制字段 | 已补充对应路径、图片约束与字段 | 前后端联调可按同一字段语义开发 |
| 本地启动 | 仓库只提供从外部环境变量读取配置的 `start` 命令 | 新增 `npm run start:local --prefix backend`，用 Node 的 `--env-file` 加载被忽略的本地 `.env` | 便于隔离本地库联调，不改变已有部署环境变量方式 |

## 数据库迁移与回滚

- 升级脚本：[20260717_task_time_windows.sql](../../database/migrations/20260717_task_time_windows.sql)
- 导入顺序升级脚本：[20260717_roster_import_order.sql](../../database/migrations/20260717_roster_import_order.sql)
- 升级方式：脚本通过 `INFORMATION_SCHEMA` 和 `DATABASE()` 检查列是否存在，可重复运行。
- 回滚方式：脚本末尾提供删除 `timezone`、`end_at`、`start_at` 的 SQL；回滚前必须确认不存在依赖窗口的任务数据。
- 兼容策略：历史任务的窗口字段为空时仍可提交，避免上线后旧任务立即不可用；新建或更新窗口的任务由后端强制执行。

## 接口影响

### 新增

`GET /api/server-time`

```json
{
  "time": "2026-07-17T12:00:00.000Z",
  "timezone": "Asia/Shanghai",
  "unixMs": 1784289600000
}
```

### 扩展的任务字段

```json
{
  "startAt": "2026-07-20T00:00:00.000Z",
  "endAt": "2026-07-26T15:59:59.000Z",
  "timezone": "Asia/Shanghai"
}
```

### 成绩行新增字段

```json
{
  "validHours": 20,
  "checkinPercent": 100,
  "ruleVersion": "BNBU-CHECKIN-2026-v1",
  "calculatedAt": "2026-07-17T12:00:00.000Z"
}
```

## 验证结果与限制

- `node --check backend/server.js`：通过。
- `git diff --check`：通过。
- `npm ci --prefix backend`：成功安装 99 个包，审计结果为 0 个已知漏洞。
- `npm test --prefix backend`：13/13 通过。
- npm 提示 Multer 1.x 已弃用；本轮未做跨大版本依赖升级，建议后续独立升级到 Multer 2.x 并完成上传回归。
- 上传孤儿清理默认不会删除文件；仅在开发/预发布环境审查 dry-run 输出后，才允许设置 `DELETE_ORPHANS=true`。
- 未执行生产/远程开发数据库迁移、未启动生产服务、未变更远端 GitHub 分支；隔离本地库的完整建表和迁移验证见下文。

### 开发库连接验收状态

已依据获授权的开发库配置发起只读连接验证。连接 `123.207.5.70:3306` 返回 `ETIMEDOUT`，说明当前 Codex 工作环境无法访问该数据库端口；因此没有执行任何迁移或写操作。新增 `npm run migrate:dev --prefix backend` 可在能访问开发服务器的环境中按顺序执行两份迁移，并输出目标库、已验证字段和索引作为证据。

### 隔离本地开发库迁移证据（2026-07-19）

为完成可重复的迁移验收，已在工作区 `.local` 目录配置 MariaDB 11.4.4，并仅监听 `127.0.0.1:3307`。本地环境文件位于被 Git 忽略的 `backend/.env`。

| 验收项 | 结果 |
|---|---|
| 两份迁移首次执行 | 成功 |
| 幂等性 | 两份迁移重复执行成功，无重复列或索引错误 |
| 回滚 | 已在隔离库删除 5 个字段和 1 个索引，成功 |
| 回滚后重新迁移 | 成功，最终数据库保持迁移后状态 |
| 最终字段核验 | `required_columns = 5` |
| 最终索引核验 | `required_indexes = 1` |
| 完整基线建表 | 以原始 UTF-8 字节导入成功，基线库共 17 张表 |
| 完整建表后的迁移 | 两份迁移在 17 张表的基线上连续执行两次，均成功 |

最终已验证字段：`tasks.start_at`、`tasks.end_at`、`tasks.timezone`、`student_progress.import_batch`、`student_progress.import_order`；最终已验证索引：`idx_student_progress_course_import_order`。

说明：`database/schema.sql` 顶部包含 `USE \`123_207_5_70_96\``，因此即使客户端传入其他默认数据库，完整基线也会切换至该名称。本次以原始 UTF-8 字节导入后，已在该隔离本地同名库验证到 17 张表；两份迁移又在此完整基线上连续执行两次，新增字段与索引均正确。PowerShell 将文本管道重编码时仍可能损坏该基线中的中文内容，所以 Windows 环境应保留原始字节导入方式，或在部署前先消除 schema 中的硬编码 `USE` 语句。

`backend/.env` 已仅为该隔离库配置，且被 `.gitignore` 排除；本地联调使用 `npm run start:local --prefix backend`。生产/开发服务器仍应通过其自身环境变量或密钥管理注入连接信息，不能提交本地 `.env`。

## 验证证据（保留成功反馈）

验证时间：2026-07-17（Asia/Shanghai）。以下结果来自本地工作区，命令可重复运行。

| 修改范围 | 验证方式 | 保留的成功反馈 |
|---|---|---|
| 图片上传规则 | `student web backend contracts are present` 静态契约测试 | 确认 HEIF 图片 MIME、`MAX_PROOF_IMAGES = 6`，并确认不再接受 MP4 |
| 时间窗口 | `new backend rule helpers enforce the documented boundaries` | 创建合法窗口成功；结束早于开始被拒绝；窗口前返回 `TASK_NOT_STARTED`；窗口后返回 `TASK_ENDED` |
| 有效小时百分制 | 同一边界测试 | 24 个有效小时输出 `validHours: 24`、`checkinPercent: 100`、`checkinScore: 25`，证明超过 20h 已封顶 |
| 耐力跑换算输入 | 同一边界测试 | `3 分 58 秒` 归一化为 `238` 秒；`60` 秒输入被拒绝 |
| 导入批次与顺序 | `roster import preview validates rows and confirm enrolls valid students` | 成功响应包含 `importBatch`，导入学生保存同一批次和 `import_order: 1` |
| 既有后端能力 | 其余 API 测试 | 管理配置、任务 CRUD、导出、课程/用户/组织/规则 CRUD、日志接口全部通过 |
| 代码完整性 | `node --check backend/server.js`、`git diff --check` | 两项命令均以退出码 0 成功完成 |
| 真实驱动连通性 | 使用项目的 `mysql2` 对隔离库执行只读查询 | 成功连接至完整基线库，并读取到 `tasks` 的 4 条记录 |
| 本地 API 冒烟 | 临时执行 `node --env-file=.env server.js`，请求后立即停止 | `/api/health` 返回服务名和数据库可用状态；`/api/server-time` 返回 ISO 时间、`Asia/Shanghai` 与数值型 Unix 毫秒 |

### 原始测试成功摘要

```text
tests 13
pass 13
fail 0
duration_ms 508.3371
```

本轮为纯后端与数据契约变更，没有新增可供人工验收的页面，因此保留了可重复执行的自动化成功反馈，而非无关的界面截图。若在开发库执行迁移后需要补充截图，应截取迁移执行结果、`/api/server-time` 响应、窗口外提交的 409 响应、六图上传成功响应和教师名单导入排序结果。

## 待完成验证清单

1. 在远程开发数据库执行两份升级 SQL，并按其备份/变更流程复核；本地隔离库的升级、重复执行与回滚验证已完成。
2. 用教师和学生真实令牌验证课程范围、窗口前一分钟、窗口内、窗口后一分钟。
3. 对 0h、10h、20h、超过 20h，以及待审核/驳回记录验证 JSON 与 CSV 输出一致。
