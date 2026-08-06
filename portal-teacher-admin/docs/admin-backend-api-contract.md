# 管理员端未来后端接口契约建议

> 本文件只整理前端已实现流程所需的未来接口。本轮没有实现或修改真实后端。路径以 `/api/v1` 为建议前缀，最终以服务端规范为准。

## 1. 通用约定

- 管理员访问令牌放入 `Authorization: Bearer <token>`；写操作服务端必须再次做操作级权限校验。
- 所有实体返回 `id`, `createdAt`, `updatedAt`；更新请求携带 `expectedUpdatedAt` 或 `If-Match`，冲突返回 `409 DATA_CHANGED`。
- 列表统一接受 `page`, `pageSize`, `search`, `status`, `sort`，返回 `{ items, page, pageSize, total, totalPages }`。
- 写操作统一接受 `reason`；危险操作还接受显式确认字段。建议支持 `Idempotency-Key`。
- 推荐错误结构：`{ code, message, fieldErrors?: Record<string,string>, requestId }`。
- 通用错误：`400 VALIDATION`、`401 UNAUTHENTICATED`、`403 PERMISSION_DENIED`、`404 NOT_FOUND`、`409 DATA_CHANGED/INVALID_TRANSITION/DEPENDENCY_EXISTS`、`429 RATE_LIMITED`、`500 INTERNAL_ERROR`。

## 2. 认证与会话

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 登录 | `POST /api/v1/auth/login` | `{ account, password, mfaCode? }` | `{ accessToken, refreshToken?, expiresAt, user, permissions }` | 账号/密码错误、停用、需要恢复、MFA 错误 |
| 刷新 | `POST /api/v1/auth/refresh` | `{ refreshToken }` 或安全 Cookie | 新 token 与过期时间 | token 过期/撤销 |
| 当前会话 | `GET /api/v1/auth/me` | — | 管理员资料、角色、权限、tokenVersion | 401/403 |
| 退出 | `POST /api/v1/auth/logout` | `{ allSessions?: boolean }` | `204` | 401 |

## 3. 仪表盘与健康检查

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 概览聚合 | `GET /api/v1/admin/dashboard` | — | 当前学期、用户/待恢复/锁定/工单数、规则摘要、待办 | `admin.dashboard.read` |
| 健康检查 | `GET /api/v1/admin/health` | — | `{ status, database, storage, notificationQueue, checkedAt }` | `admin.dashboard.read`; degraded 不应伪装 500 |

## 4. 学期与成绩修正

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 学期列表/详情 | `GET /api/v1/admin/semesters`, `GET .../{id}` | 筛选/分页 | 学期字段、课程/学生数 | `admin.semesters.read` |
| 创建学期 | `POST /api/v1/admin/semesters` | `{ name, academicYear, term, startDate, endDate }` | 新 `upcoming` 学期 | `admin.semesters.write`; duplicate/date errors |
| 编辑学期 | `PATCH /api/v1/admin/semesters/{id}` | 可编辑字段、`expectedUpdatedAt` | 更新后学期 | `admin.semesters.write`; 409；当前/归档编辑限制 |
| 设为当前 | `POST /api/v1/admin/semesters/{id}/set-current` | `{ reason?, expectedUpdatedAt }` | `{ current, archivedPrevious? }` | `admin.semesters.write`; not started/invalid transition |
| 归档 | `POST /api/v1/admin/semesters/{id}/archive` | `{ reason?, expectedUpdatedAt }` | 归档学期 | `admin.semesters.write`; not ended/dependencies |
| 修正申请列表 | `GET /api/v1/admin/grade-corrections` | 状态/分页 | 申请、课程、教师、学生、窗口 | `admin.semesters.read`；具体归属待确认 |
| 批准/驳回 | `POST .../grade-corrections/{id}/approve|reject` | `{ reason, windowEndsAt? }` | 新状态与权限窗口 | `admin.semesters.write`; invalid transition |
| 关闭窗口 | `POST .../grade-corrections/{id}/close` | `{ reason }` | `closed` 申请 | `admin.semesters.write`; teacher not corrected |

学期不提供 Web `DELETE`。如未来确需删除，只应由受控运维流程处理。

## 5. 用户、恢复、锁定与导入

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 用户列表/详情 | `GET /api/v1/admin/users`, `GET .../{id}` | search/role/status/locked/page | 用户公共及角色字段、tokenVersion、依赖计数 | `admin.users.read` |
| 单建用户 | `POST /api/v1/admin/users` | `{ account,name,email,college,role,status,initialPassword?,className?,gender?,gradeLevel?,admissionYear? }` | 用户；必要时一次性初始密码 | `admin.users.write`; duplicate/password/field errors |
| 编辑用户 | `PATCH /api/v1/admin/users/{id}` | 上述可编辑字段、`reason`, `expectedUpdatedAt` | 更新用户 | `admin.users.write`; transition/409 |
| 修改状态 | `PATCH /api/v1/admin/users/{id}/status` | `{ status, reason, expectedUpdatedAt }` | 状态、tokenVersion | `admin.users.write`; invalid transition |
| 强制下线 | `POST /api/v1/admin/users/{id}/force-logout` | `{ reason }` | 新 tokenVersion | `admin.users.write` |
| CSV 预检 | `POST /api/v1/admin/users/import/preview` | multipart CSV + role + fallbackPassword? | 行号、规范化记录、字段错误 | `admin.users.write`; headers/duplicate |
| CSV 原子导入 | `POST /api/v1/admin/users/import` | 上传标识或 CSV、role、幂等键 | created count、一次性密码清单/安全下载令牌 | `admin.users.write`; 任一行错误则 0 写入 |
| 恢复申请列表 | `GET /api/v1/admin/recovery-requests` | status/page | 申请与用户摘要 | `admin.users.read` 或独立 read 权限待定 |
| 审核恢复 | `POST .../recovery-requests/{id}/review` | `{ decision, verificationMethod, reason, newEmail?, newPhone? }` | 申请、更新用户、tokenVersion | `admin.recovery.review`; already reviewed/email duplicate |
| 解锁验证码 | `POST /api/v1/admin/users/{id}/unlock-verification-code` | `{ reason }` | 清除后的锁定状态 | `admin.users.write`; not locked/not student |
| 课程交接 | `POST /api/v1/admin/users/{id}/handover-courses` | `{ replacementTeacherId, courseIds?: string[], reason }` | 交接课程与双方计数 | `admin.users.write`; replacement invalid |
| 删除影响 | `GET /api/v1/admin/users/{id}/deletion-impact` | — | 各关联表计数、可否删除、阻塞原因 | `admin.users.delete` |
| 不可逆删除 | `DELETE /api/v1/admin/users/{id}` | `{ confirmAccount, adminPassword, reason }` | `{ deletedId, cascadeCounts }` | `admin.users.delete`; self/course/password/confirm errors |

## 6. 全局学时规则与耐力跑换算

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 学时规则 | `GET/PUT /api/v1/admin/config/hour-rules` | PUT 完整规则+reason/version | 规则、updatedBy/At | `admin.config.read/write`; range/fixed-limit |
| 换算表列表 | `GET /api/v1/admin/endurance-rules` | gender/gradeGroup/runType | 四表规则、完整性结果 | `admin.config.read` |
| 新增规则 | `POST /api/v1/admin/endurance-rules` | `{ gender,gradeGroup,runType,minSeconds,maxSeconds,score,tier,note }` | 新规则、整表验证结果 | `admin.config.write`; gap/overlap/combination |
| 修改规则 | `PATCH /api/v1/admin/endurance-rules/{id}` | 字段+version | 更新规则、整表结果 | 同上；409 |
| 删除规则 | `DELETE /api/v1/admin/endurance-rules/{id}` | `{ reason, expectedUpdatedAt }` | `204` 或整表结果 | 同上；删除导致不连续则 409 |

服务端必须在事务内验证“操作后的整张目标表”，不能只验证单条记录。

## 7. 系统模式、维护公告与通知

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 当前模式 | `GET /api/v1/admin/system/mode` | — | mode、reason、changedBy/At | `admin.system.read` |
| 切换模式 | `PUT /api/v1/admin/system/mode` | `{ mode, reason, announcement? }` | 新模式、生成公告/通知 | `admin.system.write`; unchanged/notice required |
| 公告列表 | `GET /api/v1/admin/maintenance-announcements` | kind/page | 双语公告与时间 | `admin.system.read` |
| 发布公告 | `POST /api/v1/admin/maintenance-announcements` | `{ kind,titleZh,titleEn,messageZh,messageEn,startsAt,expectedRecoveryAt? }` | 公告、投递任务 | `admin.system.write`; planned <48h |
| 管理通知列表 | `GET /api/v1/admin/notifications` | audience/kind/page | 只读队列与投递状态 | 建议 `admin.system.read` |
| 发布治理通知 | `POST /api/v1/admin/notifications` | `{ audience,titleZh,titleEn,messageZh,messageEn,scheduledAt? }` | 通知与投递状态 | 权限/受众范围待确认 |

## 8. 帮助中心、工单与审计

| 用途 | 方法与路径 | 请求 | 关键返回 | 权限/错误 |
|---|---|---|---|---|
| 帮助文章列表/详情 | `GET /api/v1/admin/help-articles`, `GET .../{id}` | search/status/category/page | 双语文章、关键词、排序、版本 | `admin.help.read` |
| 新建文章 | `POST /api/v1/admin/help-articles` | 完整双语字段、status | 新文章 | `admin.help.write`; required fields |
| 编辑文章 | `PATCH /api/v1/admin/help-articles/{id}` | 完整字段、expectedUpdatedAt | 更新文章 | `admin.help.write`; 409 |
| 发布/归档 | `POST .../help-articles/{id}/publish|archive` | `{ reason? }` | 新状态 | `admin.help.write`; invalid transition |
| 工单列表/详情 | `GET /api/v1/admin/support-tickets`, `GET .../{id}` | search/status/page | 工单和会话 | 权限、SLA、状态机待产品确认 |
| 回复/状态 | `POST .../support-tickets/{id}/replies`, `PATCH .../{id}/status` | message 或 status+reason | 更新工单 | 同上；当前仅前端规划模拟 |
| 审计查询 | `GET /api/v1/admin/audit-logs` | actor/action/resourceType/resourceId/requestId/dateFrom/dateTo/page | 不可变日志、metadata | `admin.audit.read` |
| 审计详情 | `GET /api/v1/admin/audit-logs/{id}` | — | 完整日志和 requestId | `admin.audit.read` |

审计接口不应提供修改/删除能力。导出、保留期和脱敏规则尚未定义，因此本轮前端没有臆造导出接口。

## 9. 服务端必须保证的原子性

1. 设为当前学期：归档旧 current 与切换新 current 在同一事务完成，并有唯一约束兜底。
2. CSV 导入：预校验与最终写入都检查重复；正式导入任何一行失败则整批回滚。
3. 用户停用/恢复/强退：用户状态、tokenVersion、恢复申请、通知和审计一致提交。
4. 教师交接/删除：课程归属完成后才能删除，不允许中间态遗留无教师课程。
5. 配置和换算表：新版本、完整性校验、通知与审计同事务提交。
6. 系统模式：模式、维护公告、受众通知和审计同一业务事务或可靠 outbox 完成。
7. 全量业务数据清理：`POST /api/v1/admin/system/business-data-purge` 接收 `{ adminPassword, confirmation: "ERASE", reason }`，必须使用独立权限 `admin.system.purge`、幂等键和单一事务。事务内删除全部学期及其级联课程/选课/打卡/成绩/凭证对象，删除除当前管理员外的账号与关联申请、公告、帮助内容、工单、修正申请和通知；当前管理员、全局规则、系统模式与审计日志保留。旧审计记录中的已删账号标识必须匿名化，并新增一条仅含清理计数与原因的审计记录。
