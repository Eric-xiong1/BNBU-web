# BNBU 体育成绩管理系统

仓库：[Eric-xiong1/BNBU-web](https://github.com/Eric-xiong1/BNBU-web)

项目按三层架构组织：

```text
bnbuSystem/
├── frontend/             前端展示层 — 学生端（✅ 已接统一后端，Contract 2.0.2）；根 SPA 与 teacher/ 为旧版，已弃用
├── portal-teacher-admin/ 教师端 + 管理员端门户（✅ 已接统一后端真实 API，Contract 2.0.2）
├── handoff/              联调交接包 — 一键装环境脚本、造测试数据脚本、api-base 补丁、任务分工文档
├── backend/              旧业务逻辑层（Express Mock，已被 BNBU-Sports-Backend 统一后端取代）
├── database/             旧数据存储层 — MySQL DDL、种子脚本（已弃用）
└── docs/                 交付、验收与设计文档
```

> 当前权威后端是独立仓库 [chchaiai/BNBU-Sports-Backend](https://github.com/chchaiai/BNBU-Sports-Backend)（NestJS + PostgreSQL，`/api/v1`，Contract 2.0.2）。
> 旧的 `backend/`（Express Mock）与 `database/`（MySQL）目录仅作历史参考，日常开发不再使用。

## 合同基线（Contract Baseline）

| 项 | 值 |
|----|----|
| 版本 | `2.0.2-contract` |
| 快照 | [portal-teacher-admin/openapi/openapi.snapshot.yaml](portal-teacher-admin/openapi/openapi.snapshot.yaml)（323,046 字节，`.gitattributes` 锁 LF） |
| SHA-256 | `853e7f5efadb10dcbbe0f446c4c60962ce2fd864360a156343b5740d0c1761a4` |
| 来源 | [Backend Release 2.0.2-contract](https://github.com/chchaiai/BNBU-Sports-Backend/releases/tag/2.0.2-contract)，源提交 `bec7aac06f53e71cef5e969359a032a8f054be79` |
| 规模 | 109 路径 / 126 操作 / 288 schema |

仓库里的快照与 Release 附件逐字节一致。校验命令：

```bash
cd portal-teacher-admin && npm run contract:verify
```

该命令会重新计算 SHA-256、比对 `openapi/contract.json` 声明的版本与规模；`npm run contract:check` 在它之后再跑一次
`openapi-typescript --check`，确保 `app/openapi.generated.ts` 就是这份快照生成的类型。两者都进了
`npm run typecheck` 和 `npm test`（`tests/contract-binding.test.mjs`）。

### 2.0.2 的关键业务变化：打卡记录默认有效

- 学生提交打卡后，**后端原子追加一条 `result=VALID`、`teacherId=null` 的系统审核行（reviewVersion=1）**，记录直接进入
  `REVIEWED`/`VALID`，学时立即入账。
- 教师端默认看到的就是「有效」；教师只在发现问题时追加 `INVALID`（`POST /exercise-records/{id}/reviews`，
  `result` 枚举只有 `VALID`/`INVALID`）。
- **不再需要教师逐条确认**记录才生效。`PENDING` 只可能出现在历史遗留记录，或调用
  `POST /exercise-records/{id}/reviews/reopen` 之后。
- 三端（Web / Android / iOS）一律直接使用后端返回的 `currentReview.result`，**客户端不得再推导第二套审核状态**。

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
npm run test:student     # 学生端单元 + smoke（15 项）
cd portal-teacher-admin && npm run contract:verify  # 校验快照 SHA-256 与规模
cd portal-teacher-admin && npm run typecheck   # 含 contract:verify + OpenAPI 类型一致性检查
cd portal-teacher-admin && npm run lint
cd portal-teacher-admin && npm test            # 32 项，含生产构建
```

本地测试账号（全部为合成数据）：教师 `teacher.a.local.synthetic@bnbu.invalid`、管理员 `admin.local.synthetic@bnbu.invalid`（密码见 `联调环境与任务分工.md`）。

**学生端本地登录（两种方式都可用）**：

1. **邮箱验证码登录**：需要本地邮件服务 Mailpit 在跑（`start-all.ps1` 已包含；单独启动：`local-infra\mailpit\mailpit.exe --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025`）。输入学生邮箱 → 获取验证码 → 打开 <http://127.0.0.1:8025> 收件箱查看验证码 → 填入登录。没有 Mailpit 时后端会报 `SYSTEM_SERVICE_UNAVAILABLE`（环境限制，不是 bug）。
2. **体验账号登录**（免邮箱）：

```bash
npm run demo:setup
```

之后打开学生端 → 直接登录 → 「体验账号登录」即可进入（账号走真实入班流程创建、本地激活并绑定合成邮箱，数据全部来自真实后端；重建用 `npm run demo:setup -- --force`）。体验账号的合成邮箱（`demo.student.<学号>@bnbu.invalid`）也可以用于方式 1。

造一条真实打卡记录（含照片凭证；2.0.2 下提交即为有效）用 [handoff/make-test-record-15.cjs](handoff/make-test-record-15.cjs)：

```bash
node handoff/make-test-record-15.cjs "http://127.0.0.1:3000/api/v1" "<psql.exe 路径>" 5433 "<pg_migrator 密码>"
```

（旧版 `make-test-record.ps1` 是 Contract 1.4 时代的，媒体上传缺 `declaredContentSha256`、新学生未激活会失败，已被本脚本取代。）
需要一条「被教师判定无效」的样例记录时，用 `npm run demo:setup`：它的第二条记录会由教师追加 `INVALID`。

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
5. **学生端本地登录打通**：`npm run demo:setup` 修好并适配 Contract 1.5（2.0.2 下已随合同同步更新）（新学生本地激活 + 绑定已验证合成邮箱 + 媒体申报 SHA-256），体验账号登录 → 学生主页学时进度实测可用。邮箱验证码登录仍需邮件服务（见已知限制）。

**已知限制与技术债（不阻塞本版，按优先级）**

- P1 后端/合同：教师首次审核必须传 `expectedReviewVersion: 1`（学生提交时后端自动建 reviewVersion=1 的审核行 —— 2.0.2 起该行是系统 `VALID`，此前是 `PENDING`），但记录投影的 `currentReview` 不含 reviewVersion —— 门户靠审核历史接口取到，链路能通，但建议后端在投影中补该字段以消除额外请求。
- ~~P1 环境：学生邮箱验证码登录本机不可用~~ **已解决（2026-08-15）**：Mailpit v1.30.7 已装到 `local-infra\mailpit\`，`start-all.ps1` 会自动启动；邮箱验证码登录全链路（请求码 → Mailpit 收信 → 验证 → 学生主页）已实测通过。新入班学生仍需完成邮箱验证才是 ACTIVE（真实流程），本地演示账号由 `demo:setup` 直接激活。
- P2 性能：审核页对每条记录发 3 个详情请求（详情/凭证上下文/最新审核），57 条记录 ≈ 170+ 请求，首屏加载约 15–20 秒。建议后端提供批量投影或列表内嵌字段。
- P2 稳定性：`vinext dev` 开发服务器在多次热更新后不稳定（本轮出现 3 次）：可能直接退出，也可能自行「内部重启」后**丢失 API 代理** —— 症状是页面能打开但登录报「HTTP 404，requestId 未提供」（请求根本没到后端）。解决办法：结束 4300 端口的 node 进程后重新 `npm run dev -- --port 4300`；生产构建不受影响。
- P2 遗留：学生端预览 CSP 仍放行旧 Mock 端口 :8080；仓库根仍带旧 `backend/`、`database/`、`frontend/teacher/` 弃用代码，建议另开清理 PR。
- 待人工/待环境：真机浏览器（iOS Safari / Android Chrome）拍摄与权限矩阵、Staging 部署与 HTTPS、GitHub CI 门禁 —— 与两份检测报告结论一致。

**回滚方式**：三个修复集中在单一提交 `fd4e3a2`，可独立 revert；合并本身可用 `git revert -m 1` 处理对应 merge 提交，不影响 Android 与 Backend。

---

## 2026-08-18 Contract 2.0.2 同步（PR #4）

对应 Backend Release [`2.0.2-contract`](https://github.com/chchaiai/BNBU-Sports-Backend/releases/tag/2.0.2-contract)，PR：[#4](https://github.com/Eric-xiong1/BNBU-web/pull/4)（分支 `codex/sync-contract-2.0.2`）。基线与校验方式见上文「合同基线」。

**合同核对结论**

- Release 附件 `openapi.snapshot.yaml` 的 SHA-256 与公告一致，且与仓库内快照 **逐字节相同**（`cmp` 通过，323,046 字节）。
- 规模 109 路径 / 126 操作 / 288 schema，与 `release-manifest.json` 一致；`openapi-typescript --check` 无差异。
- 新增 `npm run contract:verify`（[scripts/verify-contract.mjs](portal-teacher-admin/scripts/verify-contract.mjs)）与 `tests/contract-binding.test.mjs`：此前仓库只校验「类型是否与本地快照匹配」，**无法发现本地快照本身被改过**。
- 顺带发现：Backend 的 Release 只有 1.4.0 → 2.0.0 → 2.0.1 → 2.0.2，**没有 1.5.0-contract**。本仓库此前声称的 `1.5.0-contract` 基线来自 monorepo 工作副本，从未作为 Release 发布——那 55 项破坏性变化其实是 1.4.0→2.0.0 的，Web 端在「1.5」那轮已提前吸收了大部分。指纹校验就是为了让这类漂移不再无声发生。

**默认有效语义落地**

- 教师端审核选择器只提供「有效/无效」（`CreateReviewRequest.result` 枚举只有这两个），原来的「待审核」选项点击后被静默丢弃。
- 无效记录上的「有效」置灰并给出说明：2.0.2 的 `INVALID → VALID` 只能走 `reviews/reopen`，直接追加只会返回 `REVIEW_CHANGE_NOT_ALLOWED`。
- 删掉「没有审核意见即视为待审」的第二套状态推导，队列与统计一律读 `currentReview.result`。
- 首页统计改为「打卡记录 / 涉及学生 / 已标记无效」，仅在存在历史遗留 `PENDING` 时置顶显示待审计数；「完成审核」按钮同理只在有历史遗留待审时出现。
- 学生端记录卡片与详情展示后端返回的审核状态与教师意见——**此前教师判定 `INVALID` 对学生完全不可见**，学时会无声减少。

**同轮修掉的既有缺陷**

1. 学生端学时改为一律取 `creditedDurationSeconds`，不再用实际运动时长兜底；文案相应改为「计入学时」，被判定无效的记录则显示「未计入学时」——2.0.2 没有把无效记录的 `creditedDurationSeconds` 清零的手段（`creditedDurationOverrideSeconds` 在 ADR-047 前被禁），它是通过计分账本停止计入的，所以数字仍在但不能叫「已计入」。
2. 成绩总分改读合同定义的 `finalScore`/`baseScore`（合同没有 `totalScore`/`score`，原逻辑对已发布成绩恒为 0）。
3. `EnrollmentStatus` 补 `WITHDRAWN`（原写成 `ENDED`，真实值会落到「成员关系已停用」）；`ClassSectionStatus` 补 `UPCOMING`/`ARCHIVED`，且 `UPCOMING` 教学班不再被当成已结束。
4. 教师端凭证 tab 不再把未知类型一律标成「图片」——真实凭证只有 mediaId，此前所有视频都被标成图片。
5. `npm run demo:setup` 不再在提交后追加 `VALID` 审核（2.0.2 会拒绝），改为第二条记录由教师追加 `INVALID`，两种状态都能造。

**审核轮（何天一，`c2af546`）**

补齐了默认有效改动后的文案与映射残留：空态/表头仍指向「历史记录」、学时文案、未知凭证图标、`UPCOMING` 运行时映射、置灰说明，并抽出 `mapPublishedScore` 加冒烟。其中置灰说明最初用 `aria-description` 承载，触发 `jsx-a11y/role-supports-aria-props` 告警且禁用按钮不可聚焦（tooltip 与该属性都到不了键盘/读屏用户），已改为可见提示文字，lint 恢复零告警。

随后又跑了一轮对抗式复核（多视角 + 逐条反驳 + 变异测试），确认 3 项并修掉：① `assert.match(workspace, /暂无打卡记录/)` 是空断言——该子串本来就命中 `暂无打卡记录需要审核。` 这条 toast，把空态文案改回旧值它照样通过，已改为锚定整个三元表达式并补上表头断言；② `mapPublishedScore` 的冒烟没覆盖 `baseScore` 兜底和「已发布 0 分」，删掉兜底或把 `??` 换成 `||` 都不会失败，已补两条用例；③ 无效记录的卡片把学时标成「计入学时」，与上方汇总（明确排除无效记录）自相矛盾，已按记录状态分支。其余 9 项（`UPCOMING` 的显示归属、`aria-description` 等）经复核为不成立或已修。

**验证**：`contract:verify` / `typecheck` / `lint`（0 告警）/ 门户 32 项（含生产构建）/ 学生端 15 项冒烟 / `test:web` 全部通过。

**明确未做**

- **`POST /exercise-records/{id}/reviews/reopen`**：教师误标无效后无法在页面内撤回。2.0.2 提供了该操作，但 Release 文档未要求客户端实现，且 `reason` 必填需要新弹窗——当前只把不可用的转换置灰并说明。是否实现待定。
- 几个视图类型仍声明闭合 schema 没有的字段（`StudentProfile.primaryEmail`、`Semester.code/name`、`ExerciseRecord.studentRemark`），属既有历史债。
- 独立仓库 `BNBU-Sports-Web-Teacher-and-Admin` 没有 openapi 目录、本地还有未推送提交，已被本仓库 `portal-teacher-admin/` 取代，建议归档，不要带进联调。

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
