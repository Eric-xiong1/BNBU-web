# BNBU 体育成绩管理系统

仓库：[Eric-xiong1/BNBU-web](https://github.com/Eric-xiong1/BNBU-web)

项目按三层架构组织：

```text
bnbuSystem/
├── frontend/             前端展示层 — 学生端（✅ 已接统一后端，Contract 1.5）；根 SPA 与 teacher/ 为旧版，已弃用
├── portal-teacher-admin/ 教师端 + 管理员端门户（✅ 已接统一后端真实 API，Contract 1.5）
├── handoff/              联调交接包 — 一键装环境脚本、造测试数据脚本、api-base 补丁、任务分工文档
├── backend/              旧业务逻辑层（Express Mock，已被 BNBU-Sports-Backend 统一后端取代）
├── database/             旧数据存储层 — MySQL DDL、种子脚本（已弃用）
└── docs/                 交付、验收与设计文档
```

> 当前权威后端是独立仓库 [chchaiai/BNBU-Sports-Backend](https://github.com/chchaiai/BNBU-Sports-Backend)（NestJS + PostgreSQL，`/api/v1`，Contract 1.5）。
> 旧的 `backend/`（Express Mock）与 `database/`（MySQL）目录仅作历史参考，日常开发不再使用。

## 快速启动

在仓库根目录：

```bash
npm install
npm run preview
```

浏览器打开：

| 角色 | 入口 | 说明 |
|------|------|------|
| 学生 | `http://127.0.0.1:4174/student/` | 已接真实后端（预览服务器把 `/api/*` 转发到 `127.0.0.1:3000`） |
| 教师 / 管理员 | `http://localhost:4300/`（见下） | `portal-teacher-admin/` 门户，真实 API |

教师/管理员门户单独启动：

```bash
cd portal-teacher-admin
npm install
npm run dev -- --port 4300
```

完整本地环境（PostgreSQL + MinIO + 统一后端 + 前端）一键启动：`D:\github_D\BNBU_web\local-infra\start-all.ps1`（本机专用；团队成员用 `handoff/` 里的 teammate-setup.ps1）。

## 常用命令

```bash
npm run preview          # 学生端静态预览 :4174（同源转发 /api → :3000、/minio → :9000）
npm run test:web         # 整站自检
npm run test:student     # 学生端单元 + smoke（12 项）
cd portal-teacher-admin && npm run typecheck   # 含 OpenAPI 合同一致性检查
cd portal-teacher-admin && npm run lint
cd portal-teacher-admin && npm test            # 29 项，含生产构建
```

本地测试账号（全部为合成数据）：教师 `teacher.a.local.synthetic@bnbu.invalid`、管理员 `admin.local.synthetic@bnbu.invalid`（密码见 `联调环境与任务分工.md`）。

**学生端本地登录**：本机没有邮件服务时邮箱验证码发不出（后端会报 `SYSTEM_SERVICE_UNAVAILABLE`，这是环境限制不是 bug）。改用体验账号：

```bash
npm run demo:setup
```

之后打开学生端 → 直接登录 → 「体验账号登录」即可进入（账号走真实入班流程创建、本地激活并绑定合成邮箱，数据全部来自真实后端；重建用 `npm run demo:setup -- --force`）。

造一条「待教师审核」的真实打卡记录（含照片凭证）用 [handoff/make-test-record-15.cjs](handoff/make-test-record-15.cjs)：

```bash
node handoff/make-test-record-15.cjs "http://127.0.0.1:3000/api/v1" "<psql.exe 路径>" 5433 "<pg_migrator 密码>"
```

（旧版 `make-test-record.ps1` 是 Contract 1.4 时代的，媒体上传缺 `declaredContentSha256`、新学生未激活会失败，已被 1.5 版取代。）

---

## 2026-08-14 本地联调纪要（Web 负责人验收版）

本轮把四位成员的成果集中审查、合并、并在本机全栈实测后推入 `main`：

**合并内容**

| 来源 | 内容 | 处理 |
|------|------|------|
| PR #3 `agent/ios-contract-followup-web-d67e66b` | 教师/管理门户接真实 API + Contract 1.5 对齐（openapi.generated.ts、api-client 等） | ✅ 已合入 |
| PR #2 `codex/web-contract-1.5` | 学生端 Contract 1.5 对齐（SHA-256 指纹、设备号、错误码、隐私文案） | ✅ 已合入（其头提交已包含 PR #3） |
| `fix/web-contract-followup-20260815` | 运动枚举中文映射、英文翻译修正、单复数、.gitattributes LF 规范、回归测试 | ✅ 已合入；`rendered-html.test.mjs` 冲突采纳此分支版本（测试不再断言文档文字） |
| 两份检测报告（无代码） | Docker 环境、Backend 311 项测试、E2E 结论 | 作为验收依据 |

**本机验证结果（全绿）**

- 自动化：根目录 `test:student` 12 项、`test:web` 全过；门户 `typecheck`（含合同检查）、`lint`、`test` 29/29（含生产构建）全过。此前遗留的 2 个 React lint error 已在 PR #3 中消除。
- 浏览器实测（后端 main `b18f5e5`，migration 0001–0017，本地合成数据）：
  - 教师登录 → 2 教学班 / 38 在班学生 → 打卡审核队列正确显示；
  - 运动项目中英文均为业务名称（跑步/Running、羽毛球/Badminton、健身/Fitness），不再出现 RUNNING 等原始枚举；
  - **审核闭环走通**：查看记录 → 打开照片凭证（后端签名 URL 返回 200）→ 标记有效 → 后端 201，记录变为 REVIEWED/VALID，刷新后状态保持；
  - 学生端隐私声明/入课引导正常加载，控制台零报错；管理员登录后系统健康面板显示真实后端各项「正常」。

**联调中发现并已修复的问题（提交 `fd4e3a2`）**

1. **列表不翻页导致教师工作台整页拒显**：门户所有列表接口只取了后端默认第一页（20 条），名册超过 20 人时「打卡记录 × 学生名册」交叉校验必然失败，整个工作台报「无法关联学生身份资料」。已改为按合同游标（`cursor`/`limit≤100`）自动翻页取全量。成员机器上每班少于 20 人所以未暴露 —— 这是典型的「测试数据太小掩盖分页 bug」。
2. **不可审核的记录混入待审队列**：后端会向教师返回 DRAFT（学生未提交）、CANCELLED（已取消）与 seed 造的「REVIEWED 但无审核行」探针记录；门户此前把它们全判为「待审核」，教师点击必然收到 409 版本冲突且无法解脱。已改为：队列只收 SUBMITTED/REVIEWED，无审核行的 REVIEWED 记录归入已处理。
3. **英文句子被拆碎拼接**：JSX 把一句话分成多个文本片段逐段翻译，出现 "Showing 5 recordsPendingrecords"、"Total 1 records"（单数用复数）等。已把相关句子合并为单一文本节点并补齐整句翻译规则。**给后续开发的规矩：界面上完整的一句中文要写成一个模板字符串，不要在 JSX 里拆开插值，否则翻译器接不住。**

**2026-08-15 负责人验收轮补充修复**

4. **成绩管理表格右侧三列互相叠字**：旧版 4 列成绩表的列宽百分比（前四列合计 86%）被新版 8 列服务端成绩表继承，「总有效时长/最终分数/成绩状态」被压到没有宽度。已把百分比规则限定给旧表专用，新表自动布局并加宽最小宽度，1280 与 1920 宽度下实测零重叠。
5. **学生端本地登录打通**：`npm run demo:setup` 修好并适配 Contract 1.5（新学生本地激活 + 绑定已验证合成邮箱 + 媒体申报 SHA-256），体验账号登录 → 学生主页学时进度实测可用。邮箱验证码登录仍需邮件服务（见已知限制）。

**已知限制与技术债（不阻塞本版，按优先级）**

- P1 后端/合同：教师首次审核必须传 `expectedReviewVersion: 1`（学生提交时后端自动建 reviewVersion=1 的 PENDING 行），但记录投影的 `currentReview` 不含 reviewVersion —— 门户靠审核历史接口取到，链路能通，但建议后端在投影中补该字段以消除额外请求。
- P1 环境：学生邮箱验证码登录本机仍不可用（需 Mailpit 收信；后端 .env 已补 SMTP 配置指向 :1025，装上 Mailpit 即可）。新入班学生未验证邮箱前不是 ACTIVE，无法开运动会话。
- P2 性能：审核页对每条记录发 3 个详情请求（详情/凭证上下文/最新审核），57 条记录 ≈ 170+ 请求，首屏加载约 15–20 秒。建议后端提供批量投影或列表内嵌字段。
- P2 稳定性：`vinext dev` 开发服务器在多次热更新后不稳定（本轮出现 3 次）：可能直接退出，也可能自行「内部重启」后**丢失 API 代理** —— 症状是页面能打开但登录报「HTTP 404，requestId 未提供」（请求根本没到后端）。解决办法：结束 4300 端口的 node 进程后重新 `npm run dev -- --port 4300`；生产构建不受影响。
- P2 遗留：学生端预览 CSP 仍放行旧 Mock 端口 :8080；仓库根仍带旧 `backend/`、`database/`、`frontend/teacher/` 弃用代码，建议另开清理 PR。
- 待人工/待环境：真机浏览器（iOS Safari / Android Chrome）拍摄与权限矩阵、Staging 部署与 HTTPS、GitHub CI 门禁 —— 与两份检测报告结论一致。

**回滚方式**：三个修复集中在单一提交 `fd4e3a2`，可独立 revert；合并本身可用 `git revert -m 1` 处理对应 merge 提交，不影响 Android 与 Backend。

---

## 各层说明

### frontend/ — 前端展示层

- `student/`：学生体育 Web（移动优先：打卡、课程、成绩、个人中心）——**唯一在维护的学生端**
- `preview-server.cjs`：本地预览服务（同源转发 + 安全响应头）
- `index.html` + `app.js`、`teacher/`：旧版 SPA，已弃用，仅存档

### portal-teacher-admin/ — 教师端 + 管理员端门户

- Next.js/vinext 门户，`app/api-client.ts` 为统一 API 底座（同源 `/api/v1`，开发代理到 `127.0.0.1:3000`）
- `openapi/openapi.snapshot.yaml` + `app/openapi.generated.ts`：合同快照与生成类型，`npm run typecheck` 会校验两者一致（注意保持 LF 换行，`.gitattributes` 已固定）

### docs/ — 文档

| 文档 | 说明 |
|------|------|
| [docs/LOCAL_DOCKER_INTEGRATION.md](docs/LOCAL_DOCKER_INTEGRATION.md) | Web + Backend 1.5 本地 Docker 联调 |
| [docs/STUDENT_WEB_ACCEPTANCE.md](docs/STUDENT_WEB_ACCEPTANCE.md) | 学生端验收 |
| [docs/DELIVERY_README.md](docs/DELIVERY_README.md) | 交付包说明 |
| [handoff/联调环境与任务分工.md](handoff/联调环境与任务分工.md) | 环境搭建与任务分工（含测试账号） |
