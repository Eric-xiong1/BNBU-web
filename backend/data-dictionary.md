# BNBU 体育成绩管理 Web 数据字典

日期：2026-06-12
适用范围：老师端 Web、体育部管理端 Web、校队/社团负责人 Web

## 命名约定

- 后端 API 推荐使用 `camelCase`。
- 导入/导出 CSV 字段使用中文表头。
- 时间字段 MVP 可先使用字符串，正式版建议统一 ISO 8601 并在展示层格式化。
- 金额、小时、分数均使用数字类型；展示层自行拼接 `h`、`%` 等单位。

## 用户与权限

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 用户 ID |
| `name` | string | 是 | 用户姓名 |
| `email` | string | 是 | 学校邮箱 |
| `role` | string | 是 | 中文角色名，例如 `体育任课老师`、`体育部管理员`、`组织负责人` |
| `scope` | string | 是 | 权限范围，例如课程代码 + Section、组织名称、全校 |
| `status` | string | 是 | `正常`、`待确认`、`停用` |

Web 登录角色枚举：

```text
teacher, admin, manager
```

## 课程 Course

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 前端路由与 API 使用的课程 ID，例如 `gepe` |
| `code` | string | 是 | 课程代码，例如 `GEPE101` |
| `section` | string | 是 | 教学班，例如 `1004`；展示层可显示为 `Section 1004`；同一课程代码可有多个 Section |
| `name` | string | 是 | 课程名称 |
| `semester` | string | 是 | 学期，例如 `2026 SPRING` |
| `students` | number | 否 | 学生数量 |
| `pending` | number | 否 | 待审核记录数量 |
| `completion` | number | 否 | 完成率，0-100 |
| `missing` | number | 否 | 未完成学生数量 |
| `deadline` | string | 否 | 下一截止时间 |

## 学生进度 StudentProgress

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 学号 |
| `name` | string | 是 | 学生姓名 |
| `college` | string | 是 | 学院 |
| `className` | string | 否 | 班级 |
| `course` | number | 是 | A 类课程相关小时 |
| `general` | number | 是 | B 类其他运动有效小时，可能已包含组织抵扣 |
| `rawGeneral` | number | 否 | 抵扣前 B 类小时 |
| `exam` | number | 是 | 专项考试折算分 |
| `attendance` | number | 是 | 平时/签到分 |
| `physical` | number | 是 | 体测折算分 |
| `status` | string | 是 | `已完成`、`差课程 Xh`、`差其他 Xh`、`风险较高` 等 |
| `source` | string | 是 | `seed` 或 `import`，正式版可扩展为 `school-roster` |
| `organizationCredit` | object/null | 否 | 组织抵扣来源 |

## 课程名单导入 RosterImportRow

CSV 推荐表头：

```text
姓名,学号,学院,班级,课程代码,Section,选课状态
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `name` | string | 是 | 学生姓名 |
| `id` | string | 是 | 学号 |
| `college` | string | 是 | 学院 |
| `className` | string | 否 | 班级 |
| `courseCode` | string | 是 | 必须等于当前教学班的课程代码 |
| `section` | string | 是 | 必须等于当前教学班 Section；可接受 `1004`、`Section 1004`、`section 1004` 等输入，服务端应标准化为 `1004` |
| `enrollmentStatus` | string | 是 | MVP 仅 `已选` 可导入 |
| `valid` | boolean | 是 | 服务端预检结果 |
| `status` | string | 是 | 校验说明，如 `通过`、`重复学号` |

## 课程任务 CourseTask

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 任务 ID |
| `courseId` | string | 是 | 课程 ID |
| `title` | string | 是 | 任务标题 |
| `hours` | number | 是 | 可获得小时 |
| `deadline` | string | 是 | 截止时间展示文本 |
| `proof` | string | 是 | 证明要求 |
| `status` | string | 是 | `草稿`、`进行中`、`已关闭` |
| `updatedAt` | string | 否 | 更新时间 |

## 异常审核 ReviewRecord

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 审核记录 ID |
| `courseId` | string | 是 | 所属课程 |
| `studentId` | string | 是 | 学号 |
| `name` | string | 是 | 学生姓名 |
| `type` | string | 是 | `课程相关` 或 `其他运动` |
| `hours` | number | 是 | 学生申请小时 |
| `approvedHours` | number | 否 | 老师认可小时 |
| `risk` | string | 是 | 风险标签，如 `同图复用` |
| `status` | string | 是 | `待确认`、`需复核`、`可通过`、`补材料`、`已通过`、`已驳回` |
| `task` | string | 是 | 提交任务 |
| `reason` | string | 是 | 异常原因 |
| `comment` | string | 否 | 审核备注 |
| `applied` | boolean | 是 | 是否已写入学生学时，防重复累计 |

## 成绩 Score

### 专项考试

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `studentId` | string | 是 | 学号 |
| `examItems` | number[] | 是 | 各专项项目分数 |
| `exam` | number | 是 | 折算或平均后的专项分 |
| `examStatus` | string | 是 | `草稿`、`已录入` |

### 签到/平时分

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `studentId` | string | 是 | 学号 |
| `attendanceWeeks.week6` | string | 是 | `出勤`、`迟到`、`请假`、`缺勤` |
| `attendanceWeeks.week7` | string | 是 | 同上 |
| `attendance` | number | 是 | 平时表现分 |
| `attendanceStatus` | string | 是 | `已保存`、`已录入` |

### 体测

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `studentId` | string | 是 | 学号 |
| `physicalItems.endurance` | string | 是 | 1000m/800m 原始成绩 |
| `physicalItems.sprint` | string | 是 | 50m 原始成绩 |
| `physicalItems.jump` | string | 是 | 立定跳远原始成绩 |
| `physical` | number | 是 | 体测折算分 |
| `physicalStatus` | string | 是 | `已保存`、`已录入` |

## 成绩规则

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `key` | string | 是 | `checkin`、`exam`、`attendance`、`physical` |
| `name` | string | 是 | 中文名称 |
| `weight` | number | 是 | 权重，四项合计必须为 100 |
| `source` | string | 是 | 数据来源说明 |
| `status` | string | 是 | `草稿`、`正常`、`需复核` |

## 组织 Membership

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 认证记录 ID |
| `type` | string | 是 | `team` 或 `club` |
| `organization` | string | 是 | 校队/社团名称 |
| `studentId` | string | 是 | 学号 |
| `studentName` | string | 是 | 学生姓名 |
| `status` | string | 是 | `待确认`、`认证有效`、`不通过`、`非体育类` |
| `validUntil` | string | 是 | 有效期 |
| `offset` | string | 是 | `可抵扣`、`不抵扣`、`待确认` |
| `comment` | string | 否 | 备注 |
| `updatedBy` | string | 是 | 最近操作人 |
| `updatedAt` | string | 是 | 最近更新时间 |

## 成绩归档 DeliveryRecord

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `courseId` | string | 是 | 课程 ID |
| `status` | string | 是 | `未提交`、`待清理`、`待管理员确认`、`已归档`、`退回清理` |
| `submittedAt` | string | 是 | 老师提交时间 |
| `submittedBy` | string | 是 | 提交人 |
| `issueCount` | number | 是 | 预检问题数量 |
| `comment` | string | 是 | 交付说明 |
| `updatedAt` | string | 否 | 最近更新时间 |

## 操作日志 AuditLog

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `id` | string | 是 | 日志 ID |
| `actor` | string | 是 | 操作人 |
| `action` | string | 是 | 操作动作 |
| `target` | string | 是 | 操作对象 |
| `time` | string | 是 | 操作时间 |
