# Contract 1.4 Web 端联调问题报告

> 提交方：Web 端（学生端 / 教师端 / 管理端）
> 验证环境：本机 PostgreSQL 18.4 + MinIO + `main` commit `c2aab4d`（含 20 小时达标、北京时间打卡窗、15 秒有声视频三项更新）
> 首次提交：2026-08-08 ｜ 复核：2026-08-10
> 结论：合同对齐无问题（三端 59 个调用点全部合规，新规则均已实测生效），但**问题一至今未修复**，问题二仍未决策。

> ⚠️ **2026-08-10 复核结论：问题一（媒体上传 100% 失败）在 `c2aab4d` 上依旧存在。**
> `s3-media-storage.adapter.ts` 的存储键正则自 1.1 起一行未改，而 `media.service.ts`
> 已多加一段 businessPurpose。Web 端只能在本地打补丁才能继续联调，**请后端合入
> 同目录下的 `fix-media-storage-key-pattern.patch`**（一行改动，已验证含安全用例）。

---

## 问题一（阻断级 · 已定位并附补丁）媒体上传 100% 失败

### 现象

任何 `POST /api/v1/media-uploads` 都返回 **500 `SYSTEM_DATA_INTEGRITY_ERROR`**（`invariant: MEDIA_STORAGE_KEY_INVALID`）。
学生端因此**无法提交任何打卡凭证**，"学生提交 → 教师审核"闭环完全断裂。

全新组织、全新学生、全新会话、全新幂等键下稳定复现，与脏数据无关。

### 根因

`media.service.ts` 在 1.4 给存储键新增了 businessPurpose 段，但 S3 适配器的校验正则**没有同步**（1.1→1.4 该文件 diff 为空）：

| | 存储键生成（media.service.ts） |
|---|---|
| 1.1 | `media/{orgId}/{mediaId}/image` |
| 1.4 | `media/{orgId}/`**`exercise_record/`**`{mediaId}/image` |

而 `s3-media-storage.adapter.ts` 的校验仍是三段式：

```
/^media\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/(image|video)$/
```

四段的新键与之不匹配 → `assertStorageKey` 抛 `SYSTEM_DATA_INTEGRITY_ERROR`。

失败发生在数据库事务**之后**、预签名 URL 生成时，因此会留下 `IN_PROGRESS` 的幂等记录和孤儿 `PENDING_UPLOAD` 媒体行。

### 建议修复

见同目录 `fix-media-storage-key-pattern.patch`（一行正则）。用途段设为**可选**，保证 1.4 之前写入的对象仍可读取：

```ts
const STORAGE_KEY_PATTERN =
  /^media\/[0-9a-f-]{36}\/(?:(?:exercise_record|exemption_application)\/)?[0-9a-f-]{36}\/(image|video)$/;
```

已验证该正则：接受 1.4 打卡凭证 / 1.4 免测视频 / 1.1 旧数据；拒绝路径穿越（`..`）、伪造用途段、非法媒体类型。
打补丁后媒体四步链路（initiate → PUT → confirm → bind）恢复正常，媒体状态可达 `AVAILABLE`。

### 建议补充回归测试

现有测试未覆盖此路径，建议加一条**真实调用 `initiateMediaUpload` 并断言返回 uploadUrl** 的用例（当前测试可能对存储端口做了 mock，因而 200% 通过却漏掉了真实适配器的校验）。

---

## 问题二（能力缺口 · 需合同决策）教师无法获取待审记录的凭证

### 现象

教师端打开待审核记录后显示"无凭证"，学生端换设备后也看不到自己已上传的照片。
教师只能**盲审**，与《打卡审核需看凭证》的业务前提冲突。

### 根因

合同层面缺少"由记录反查媒体"的能力：

- `ExerciseRecord` 投影（合同与运行时实测均为 24 个字段）**不含任何 media 字段**；
- 全部 5 个 media operation 都要求**调用方已知 `mediaId`**：
  `initiateMediaUpload` / `confirmMediaUpload` / `getMediaEvidence` / `bindMediaEvidence` / `createMediaAccessUrl`；
- 合同中**不存在**任何按 record / session 列出媒体的接口。

`submitExerciseRecord` 请求体里的 `mediaIds` 是**只进不出**：提交后无法再读回。
客户端唯一能拿到 `mediaId` 的时机是自己上传的那一刻，因此换设备、换角色（教师）后一律拿不到。

### 建议方案（二选一，由后端按治理流程决定）

1. **在 `ExerciseRecord` 投影增加 `mediaIds: OpaqueId[]`**（对学生本人与授权教师可见）——改动最小，前端零改动即可生效；
2. **新增 `GET /exercise-records/{recordId}/media`**，返回该记录的 `MediaEvidence` 列表（沿用现有权限模型：学生本人 + 该班教师）。

在此之前，教师端只能依赖本地联调桥接文件读取 `mediaId`，不是真实链路。

---

## 附：三端合同符合性核对结果（无需后端处理）

对三端源码做了静态提取，把每个 API 调用与 `openapi.yaml` 的 122 个 operation 逐条比对：

- 调用点 **59 个**（学生端 30 / 教师端+管理端 29），路径、方法、查询参数**全部合规**；
- 未使用任何 1.4 标记为 `deprecated` / `x-runtime-unsupported` 的字段（三个 Score `sort` 参数均未使用）；
- `listExerciseRecords` 使用的 `sort=-businessDate` 在 1.4 新增的 `x-runtime-enum: [businessDate, -businessDate]` 白名单内；
- 教学班本地时间字段的两种格式（`HH:MM` 与 RFC3339 time）在三端均能正确解析（统一取前 5 位）；
- 1.4 新增的 503 SystemMode 家族错误码已在三端补齐中文提示。

## 附：已验证通过的闭环

同一条打卡记录跑通四步（Contract 1.4 + 上述补丁）：

1. 学生扫邀请码入班（自动建号并登录）
2. 运动计时：开始 → 暂停 → 继续 → 结束
3. 上传照片凭证（四步上传，状态 `AVAILABLE`）→ 提交打卡（`SUBMITTED`）
4. 教师看到待审 → 审核通过 → 记录变为 `REVIEWED`，计入 1 小时
5. 学生端刷新看到"1h/20h"学时进度与审核结果
6. 管理员审计日志按资源 ID 查到完整轨迹：
   `EXERCISE_RECORD_DRAFT_CREATED`(STUDENT) → `EXERCISE_RECORD_SUBMITTED`(STUDENT) → `REVIEW_RESULT_CHANGED`(TEACHER)

---

## 2026-08-10 复核：三项新规则的实测结果（均已生效，Web 端已对齐）

| 规则 | 实测 | Web 端处理 |
|---|---|---|
| 打卡视频最长 15 秒 | 15 秒 → 201 接受；16 秒 → 422 `MEDIA_VIDEO_DURATION_EXCEEDED`；缺 `durationSeconds` → 422 `VALIDATION_FAILED` | 录制后读取元数据先行校验，超时长即提示重录，不再浪费一次上传；两个新错误码已中文化 |
| 打卡窗口北京时间 06:00–22:00 | 北京 23:14 开始运动 → 409 `SESSION_OUTSIDE_TIME_WINDOW`；教学班配置为 00:00–23:59 仍被拒，证明班级配置只能收窄 | 提示语标注「北京时间 06:00–22:00」；"今日是否已打卡"改用北京业务日判断 |
| 累计 20 小时后停止打卡 | 植入 10 天 × 7200 秒有效记录后开始运动 → 409 `SESSION_ALREADY_COMPLETED` | 在"开始运动"接口上识别该码并提示「已达到合格打卡时长，无需继续打卡」 |

### 一个接口设计上的建议（非阻断）

达标拒绝复用了 `SESSION_ALREADY_COMPLETED`，且 `details` 为空对象，与
"会话已完成"共用同一个码。客户端目前只能依据**发生在哪个接口**来区分：
在 `startExerciseSession` 上收到该码即判定为达标。

这可行但脆弱。建议二选一，便于各端稳定区分：

1. 在 `details` 中给出判别字段，例如 `{ reason: "QUALIFICATION_REACHED", qualifiedSeconds: 72000 }`；
2. 或为达标启用独立错误码（如 `ENROLLMENT_QUALIFICATION_REACHED`）。

### 另一处便利性建议

学生端目前无法展示"还差多少小时达标"，因为 `listStudentScores` 在成绩规则
未发布时为空，没有可读的累计有效时长。若能在学生投影中给出该累计值，
客户端就能在达标前给出进度提示，而不是等到开始运动被拒才知道。
