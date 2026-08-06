# 管理员端前端业务审计与实现对照

> 基准：`业务流程_管理员端.md` v1.0。范围仅限管理端 Web 前端；本轮没有新增、修改或调用真实业务后端。审计中的“原实现”指本轮重构前的现有页面。

## 1. 业务文件解析结果

管理员端是全局配置、账号、运行状态和审计治理入口，不承担教师日常教学操作或学生业务操作。业务文件定义了八个主域：认证与会话、学期、用户与账号、全局学时及打卡配置、耐力跑换算、系统维护、帮助中心、审计日志；反馈工单属于规划功能。跨边界流程只有管理员审批/治理、教师执行，例如成绩修正由管理员开窗，教师修正后再由管理员关闭。

稳定状态模型如下：

- 学期：`upcoming → current → archived`，全局最多一个 `current`，Web 不提供删除。
- 用户：`ACTIVE | DISABLED | RECOVERY_REQUIRED`；验证码锁定是独立锁定信息，不混入用户状态。
- 系统：`NORMAL | READ_ONLY | MAINTENANCE`。
- 帮助文章：`draft → published → archived`，归档后可重新发布。
- 成绩修正：`pending → approved → corrected → closed`，或 `pending → rejected`。
- 工单（规划模拟）：`pending | in_progress | technical | resolved | closed`。
- 权限按操作拆分为 `admin.<domain>.read/write/delete/review`，页面权限与写操作权限分别校验。

## 2. 重构前审计结论

### 可保留

- 教师/管理员统一登录壳、管理员侧栏和顶部工作区布局。
- 侧栏拖拽、折叠及本地保存，主题与中英文切换。
- 基础管理导航、系统模式视觉提示和原有工单弹窗样式方向。
- 现有教师端边界保持不变。

### 完全缺失

- 学期完整生命周期、当前学期唯一性、归档影响和成绩修正审批。
- 用户单建/编辑、CSV 原子导入、恢复审核、验证码解锁、强退、教师课程交接、不可逆删除。
- 学时规则、四套耐力跑换算表。
- 系统三模式闭环、双语维护通知、计划维护公告。
- 学生向双语帮助文章生命周期和只读审计详情。
- 统一 Mock service/store、持久化、操作权限、异常与并发版本检查。

### 实现不完整

- 原管理员列表、统计和工单主要是硬编码展示；搜索、筛选、分页、详情和按钮没有形成数据闭环。
- 原系统模式只改变局部视觉状态，没有持久化、原因、二次确认、通知和审计。
- 仪表盘数字不是从同一状态源派生；刷新后无法恢复管理上下文。
- 缺少加载、空、筛选无结果、失败、无权限等完整页面状态。

### 实现错误

- 用户状态混用中文显示值和业务枚举；现已统一稳定枚举，界面再做中英文映射。
- 帮助中心原文案包含教师，但业务文件明确为学生侧帮助；现已改为学生向。
- 审计导出没有业务定义；现不伪造导出能力，审计保持只读查询与详情。
- 原页面存在推测性的管理员能力和静态成功反馈；现只保留业务文件明确能力，规划功能显式标记。

### 无效交互

原管理端多处筛选、分页、详情、编辑、状态按钮和统计卡片点击没有真实状态变化。现有管理端可见按钮均绑定操作、导航、弹窗/抽屉或明确禁用原因；危险操作包含二次确认，异步操作包含忙碌、成功和失败反馈。

## 3. 业务—实现对照表（字段 1–10）

| ID | 业务模块 | 业务目标 | 使用角色 | 使用入口 | 对应页面/文件 | 展示数据 | 可执行操作 | 前置条件 | 操作后状态变化 | 权限 |
|---|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | 认证/会话 | 管理员按账号权限进入管理空间并恢复会话 | 管理员 | 统一登录页 | `portal-app.tsx` | 登录状态、过期时间 | 登录演示、刷新恢复、退出 | 演示环境或有效管理员会话 | 写入/清除 30 天前端演示会话 | 登录边界；真实鉴权待后端 |
| AUTH-02 | 路由/权限 | 防止越权进入页面或执行操作 | 管理员 | `#admin/<route>`、侧栏 | `admin-workspace.tsx`, `admin-domain.ts` | 路由、操作权限集 | 导航、无效路由回退 | 具有对应 read/write 权限 | 页面切换或显示无权限态 | `admin.*.read/write/delete/review` |
| DASH-01 | 系统概览 | 从唯一状态源展示可行动统计 | 管理员 | 系统概览 | `admin-overview.tsx` | 当前学期、用户、恢复、工单、系统健康、规则快照 | 进入待办模块、刷新健康状态 | 状态加载成功 | 健康数据刷新；其余只导航 | `admin.dashboard.read` |
| SEM-01 | 学期 | 查询、创建、编辑和查看学期 | 管理员 | 学期管理→学期记录 | `admin-semesters.tsx` | 名称、学年、学期类型、日期、状态、课程/学生数 | 筛选、分页、详情、新建、编辑待开始学期 | 学年格式正确、日期有序、学年+类型唯一 | 新增 `upcoming` 或更新记录 | `admin.semesters.read/write` |
| SEM-02 | 学期流转 | 唯一切换当前学期 | 管理员 | 学期行操作 | `admin-semesters.tsx`, `admin-service.ts` | 目标与现任当前学期 | 二次确认设为当前 | 目标为 `upcoming` 且已到开始日 | 原 current 自动 archived；目标变 current；通知+审计 | `admin.semesters.write` |
| SEM-03 | 学期归档 | 到期后冻结历史学期 | 管理员 | 当前学期卡片 | 同上 | 截止日、影响提示 | 二次确认归档；查看历史 | 当前学期且已到结束日 | current → archived；通知+审计 | `admin.semesters.write` |
| SEM-04 | 成绩修正 | 管理员开/关教师修正窗口 | 管理员（审批）、教师（后续执行） | 学期管理→成绩修正 | `admin-semesters.tsx` | 课程、教师、学生、原因、提交时间、状态 | 批准、驳回、关闭窗口 | 只允许定义的状态转移且填写审核意见 | pending→approved/rejected；corrected→closed；审计 | `admin.semesters.write` |
| USR-01 | 用户 | 统一管理学生、教师、管理员账号 | 管理员 | 用户与账号→用户列表 | `admin-users.tsx` | 账号、姓名、邮箱、学院、角色字段、状态、锁定、token 版本 | 搜索、角色/状态筛选、分页、详情、新建、编辑 | 必填、邮箱/账号唯一、密码复杂度、学生字段完整 | 用户新增/更新；重大变更要求原因；审计 | `admin.users.read/write` |
| USR-02 | 批量导入 | CSV 预检后原子创建学生/教师 | 管理员 | 用户列表→批量导入 | `admin-users.tsx`, `admin-domain.ts` | 文件、逐行解析结果、有效/错误数 | 下载模板、选角色、上传、预览、整批导入、下载初始密码 | 表头完整、全行无错误、账号/邮箱不重复；不支持管理员 CSV | 全部成功才写入；生成密码清单、通知和审计 | `admin.users.write` |
| USR-03 | 账号状态 | 受控变更账号状态并失效会话 | 管理员 | 用户编辑/详情 | `admin-users.tsx`, `admin-service.ts` | 当前状态、更新版本、token 版本 | ACTIVE/DISABLED/RECOVERY_REQUIRED 间受控切换、强制退出 | 状态转移合法；重大操作有原因 | 停用或强退增加 tokenVersion；通知+审计 | `admin.users.write` |
| USR-04 | 账号恢复 | 人工核验联系方式恢复申请 | 管理员 | 用户与账号→恢复申请 | `admin-users.tsx` | 申请人、目标联系方式、时间、审核状态 | 批准/驳回 | 待处理；填写核验方式和原因；新邮箱合法且唯一 | 更新联系方式和用户状态；申请结案；token 失效；审计 | `admin.recovery.review` |
| USR-05 | 验证码解锁 | 解除学生验证码限流锁 | 管理员 | 锁定筛选/用户详情 | `admin-users.tsx` | 锁定次数、锁定时间 | 填原因后解锁 | 学生且当前存在锁定 | 清除锁定信息；审计 | `admin.users.write` |
| USR-06 | 交接与删除 | 安全处理教师依赖和不可逆删除 | 管理员 | 用户详情→课程交接/删除 | `admin-users.tsx` | 负责课程数、候选在职教师、级联影响 | 交接课程、输入目标账号+管理员密码+原因后删除 | 不能删自己；教师须先无负责课程；确认匹配 | 课程计数转移；或删除用户/恢复申请并保留匿名审计 | `admin.users.write/delete` |
| CFG-01 | 学时规则 | 配置总目标、分类最低和每日限制 | 管理员 | 全局规则→学时规则 | `admin-rules.tsx` | 20/10/10 基准、每日 2h/1 次、更新人和时间 | 修改并保存 | 数值范围合法；每日提交次数固定为 1 | 整体配置更新；通知+审计 | `admin.config.read/write` |
| RUN-01 | 耐力换算 | 维护四套连续且不重叠的计分表 | 管理员 | 全局规则→耐力跑换算 | `admin-rules.tsx` | 性别、年级组、项目、秒区间、分数、等级、说明 | 切换四表、新增、编辑、确认删除 | 男 1000m/女 800m；区间/分数有效；保存后无间隙、重叠、重复 | 单条 CRUD；无效整体结果被阻止；审计 | `admin.config.read/write` |
| SYS-01 | 系统模式 | 安全切换正常、只读、维护模式 | 管理员 | 系统运行 | `admin-system.tsx` | 当前/目标模式、影响、变更人时间 | 选模式、填原因、二次确认 | 目标不同；维护模式必须有双语文案和预计恢复时间 | 模式更新；维护公告/通知；审计 | `admin.system.read/write` |
| SYS-02 | 维护通知 | 发布计划、紧急、恢复公告 | 管理员 | 系统运行→发布公告 | `admin-system.tsx` | 双语标题/正文、开始/预计恢复时间、历史公告 | 新建并发布 | 计划维护至少提前 48h；字段完整 | 公告加入队列；审计 | `admin.system.write` |
| HELP-01 | 帮助中心 | 管理学生侧中英双语帮助内容 | 管理员 | 帮助中心 | `admin-help.tsx` | 双语标题/正文、关键词、分类、排序、状态、更新时间 | 搜索、状态/分类筛选、分页、新建、编辑、预览、发布、下线、重发 | 双语字段、关键词、分类完整；状态转移合法 | 文章保存或 draft/published/archived 流转；审计 | `admin.help.read/write` |
| TKT-01 | 支持请求（规划） | 演示移交技术团队、回复和状态闭环 | 管理员 | 技术支持请求 | `admin-support.tsx` | 请求、来源、分类、会话、状态 | 搜索、筛选、分页、详情、回复、更新状态 | 明确显示“规划中”；回复非空 | 前端 Mock 请求/回复持久化；审计 | `admin.support.read/write`（暂定） |
| AUD-01 | 审计日志 | 只读查询治理操作 | 管理员 | 审计日志 | `admin-audit.tsx` | 操作者、动作、资源、requestId、metadata、时间 | 多条件筛选、分页、详情 JSON | 仅只读权限 | 不修改业务数据 | `admin.audit.read` |
| STATE-01 | 数据联动 | 所有页面共享同一管理状态 | 管理员 | 全管理空间 | `admin-store.tsx`, `admin-service.ts`, `admin-mock-data.ts` | revision 和全部领域数据 | 刷新、跨标签同步、统一 mutation | schemaVersion=2；localStorage 可用 | mutation 原子持久化并广播，统计即时重算 | 每个 service 操作内再校验权限 |
| UX-01 | 页面状态 | 形成可验收的管理交互 | 管理员 | 全管理空间 | `admin-components.tsx`, `admin-workspace.css` | loading/error/empty/no-result/forbidden/busy | 重试、取消、防重复、键盘关闭、分页 | 对应页面状态 | 可恢复反馈，不伪造成功 | 页面/操作权限共同控制 |

## 4. 业务—实现对照表（字段 11–19）

| ID | 表单字段 | 弹窗/抽屉 | 页面跳转 | 异常状态 | 原代码已实现 | 原实现正确 | 原缺失 | 本轮方案 | 未来接口 |
|---|---|---|---|---|---|---|---|---|---|
| AUTH-01 | 账号、密码 | 登录错误/忙碌状态 | 登录→上次管理员 hash；退出→登录 | 过期、存储不可用 | 部分 | 统一入口正确，会话不完整 | 刷新恢复、过期处理 | 增加前端演示会话；不伪装真实 Token | `POST /auth/login`, `POST /auth/logout`, `POST /auth/refresh` |
| AUTH-02 | 无 | 无权限页、toast | 侧栏/hash/概览快捷入口 | 无效 hash、permission denied | 部分 | 只有页面级视觉入口 | 操作级权限 | route-permission 映射 + service 再校验 | 所有 API 返回 401/403 |
| DASH-01 | 无 | 健康刷新反馈 | 待办卡→对应模块 | 加载失败、无当前学期、健康 degraded | 静态 | 否 | 数据源与联动 | 全部统计从 store 派生 | `GET /admin/dashboard`, `/admin/health` |
| SEM-01 | 名称、学年、term、起止日 | 新建/编辑 Dialog、详情 Drawer、离开确认 | 无 | 格式、日期、重复、并发冲突 | 否 | — | 全流程 | 领域校验+Mock mutation | `/admin/semesters` CRUD（无 DELETE） |
| SEM-02 | 无 | 二次确认 | 保持列表 | 未开始、状态非法、并发变化 | 否 | — | 唯一 current | 原子归档旧 current 并切换 | `POST /admin/semesters/{id}/set-current` |
| SEM-03 | 无 | 危险确认、影响说明 | 保持列表 | 未到结束日、非 current | 否 | — | 归档与删除限制 | 到期才可归档；不渲染删除按钮 | `POST /admin/semesters/{id}/archive` |
| SEM-04 | 审核意见 | 审批 Dialog | 学期页内 Tab | 非法转移、请求不存在 | 否 | — | 跨边界治理 | 状态机模拟并审计 | `/admin/grade-corrections/{id}/approve|reject|close`（待确认） |
| USR-01 | 公共字段+学生字段+初始密码+状态+原因 | 新建/编辑 Dialog、详情 Drawer | 页内视图 | 必填、重复、密码、并发冲突 | 静态列表 | 否 | 全部 CRUD 与校验 | role-aware 表单和稳定枚举 | `GET/POST/PATCH /admin/users` |
| USR-02 | 角色、CSV、教师统一密码 | 导入 Dialog、逐行预览 | 无 | 表头缺失、逐行错误、重复、CSV 空 | 否 | — | 模板/预检/原子性 | RFC 风格引号解析；0 错误才提交 | `POST /admin/users/import` |
| USR-03 | 状态、原因 | 编辑/强退确认 | 无 | 非法转移、版本冲突 | 否 | — | token 失效 | 状态机+tokenVersion | `PATCH /admin/users/{id}/status`, `/force-logout` |
| USR-04 | 核验方式、新邮箱/电话、原因 | 批准/驳回 Dialog | 恢复申请 Tab | 已审核、邮箱无效/重复 | 否 | — | 审核闭环 | 审核 mutation 更新用户和申请 | `/admin/recovery-requests/{id}/review` |
| USR-05 | 原因 | 解锁 Dialog | 锁定筛选→详情 | 非学生/未锁定 | 否 | — | 限流治理 | 独立 verificationLock 模型 | `POST /admin/users/{id}/unlock-verification-code` |
| USR-06 | 接收教师、原因；目标账号、管理员密码、原因 | 交接/不可逆删除 Dialog | 无 | 自删、仍有课程、密码错误、确认不符 | 否 | — | 依赖分析与级联确认 | 先交接；删除输入双重凭据并保留审计 | `/handover-courses`, `DELETE /admin/users/{id}` |
| CFG-01 | total/course/other/daily hours；daily submissions 只读 | 无 | 规则 Tab | 越界、每日次数不为 1 | 否 | — | 配置页 | 整体保存与更新时间 | `GET/PUT /admin/config/hour-rules` |
| RUN-01 | 秒区间、分数、tier、note | 新增/编辑 Dialog、删除确认 | 四表 AppSelect | gap/overlap/range/score/combination | 否 | — | 四表和约束 | 每次保存/删除验证完整目标表 | `/admin/endurance-rules` CRUD |
| SYS-01 | 模式、原因、维护双语文案、预计恢复 | 二次确认 | 无 | 模式不变、维护字段缺失 | 仅视觉 | 否 | 原因、保护、通知、审计 | 有影响说明的状态机 | `GET/PUT /admin/system/mode` |
| SYS-02 | kind、双语标题/正文、开始/恢复时间 | 发布 Dialog | 无 | 计划公告不足 48h、字段空 | 否 | — | 公告管理 | 明确时间规则并入通知队列 | `POST /admin/maintenance-announcements` |
| HELP-01 | 双语标题/正文、关键词、分类、排序 | 编辑 Dialog+实时预览、转移确认 | 无 | 缺字段、版本冲突、非法状态 | 静态文案 | 否 | 生命周期/列表能力 | 学生向内容 CRUD 与状态机 | `/admin/help-articles` CRUD+publish/archive |
| TKT-01 | 状态、回复 | 详情/回复 Dialog | 无 | 回复为空、工单不存在 | 部分静态 | 规划功能可展示，但无闭环 | 持久化和状态 | 仅 Mock，显式规划标识 | 工单 API 由产品确认后定义 |
| AUD-01 | actor/action/resource/id/requestId/date range | 只读 Drawer | 无 | 无数据、筛选无结果 | 静态 | 否 | 完整过滤、详情 | 不提供未定义导出；metadata 只读 | `GET /admin/audit-logs` |
| STATE-01 | 无 | 全局 toast/error | 跨页面自动一致 | schema 不兼容、storage 失败、revision 冲突 | 否 | — | service/store/persistence | localStorage v2、revision、CustomEvent/storage 同步 | 将 service 适配为 HTTP adapter |
| UX-01 | 各模块字段级错误 | Dialog/Confirm/Drawer | 可恢复导航 | loading/error/empty/filtered/forbidden | 不完整 | 否 | 状态、反馈、响应式 | 共享组件和统一 CSS | API 标准错误结构 |

## 5. 待确认业务

以下事项在业务文件中没有足够约束，本轮只采用保守 Mock 或明确标记规划，不外推真实规则：

1. 管理员真实登录账号格式、密码复杂度最终规则、MFA/SSO、Token 时长与刷新策略。
2. 普通管理员是否可以创建/编辑/删除其他管理员，以及是否需要超级管理员角色。
3. 已开始/当前学期具体允许编辑哪些字段；本轮只允许编辑 `upcoming`。
4. 成绩修正申请的完整字段、开放时长、教师完成回调和自动超时策略。
5. 教师课程交接是整批还是可按课程选择；本轮按整批计数模拟。
6. 支持请求 API、SLA、分派人、状态机和管理端与技术团队的处理边界；因此页面标记为“规划中”。
7. 健康检查统计口径、通知实际受众与投递渠道。
8. 学生 CSV 是否由本系统直接创建密码；本轮按业务文件仅对教师/管理员密码作强规则，学生使用账号激活语义。
9. 审计日志保留期、脱敏字段与是否允许导出；本轮不提供导出。

## 6. 前端架构结果

- 类型与稳定枚举：`app/admin-types.ts`。
- 业务校验、状态机、CSV 解析、权限和分页：`app/admin-domain.ts`。
- 一致的种子数据：`app/admin-mock-data.ts`。
- 异步 Mock service、审计、通知和持久化：`app/admin-service.ts`。
- React store、统一反馈、跨标签同步：`app/admin-store.tsx`。
- 双语文案与状态标签：`app/admin-i18n.ts`。
- 页面共享加载/错误/空态/分页/Dialog/Drawer/Confirm：`app/admin-components.tsx`。
- 数据保存在 `localStorage[bnbu-admin-console-v2]`，带 `schemaVersion: 2` 与递增 `revision`；未来替换 service adapter 即可接 API，页面不需要整体重写。
