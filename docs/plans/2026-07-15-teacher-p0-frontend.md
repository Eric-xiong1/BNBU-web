# 教师端 P0 前端设计（2026-07-15）

范围仅限 `frontend/teacher/`。正式百分制与耐力跑换算只消费服务端字段；MOCK 可模拟返回，前端不维护独立评分表。

演示入口：`frontend/teacher/index.html?demo=1`

---

## 1. 统一时间窗交互

### 共享模型

| 字段 | 说明 |
|------|------|
| `startsAt` / `endsAt` | ISO；UI 用 `datetime-local` 编辑 |
| `dailyWindowStart` / `dailyWindowEnd` | 仅打卡设置（每日允许打卡时段）；兼容旧字段 `windowStart` / `windowEnd` |
| `lifecycleStatus` | 服务端可选；前端本地 `deriveLifecycle` 仅作展示兜底 |

派生（本地时区）：`未开始` | `进行中` | `已结束`。与发布态 `草稿 / 进行中 / 已关闭` **分列展示**，不混用。

### 落点

- **打卡设置**：学期活动起止 + 现有每日时段 + 生命周期徽章 + 常驻提示「修改起止时间不会删除已有打卡记录」
- **课程任务**：创建/编辑用起止时间；列表 `开始 → 结束 · [生命周期]`；原「状态」列保留发布态

### 校验与改期

1. 本地：`endsAt >= startsAt`，否则就地错误，禁止提交
2. 改期：`confirm` —「已有打卡记录不会被删除」（若已知 `recordCount > 0`，文案含条数）
3. 保存：`PUT` → 成功则 **再 GET 回读** 重渲染；失败展示服务端 `message`（`auth-error` / 页内错误条）

模块：`frontend/teacher/core/time-window.js`

---

## 2. 证据字段与预览器状态机

### 前端字段

```js
{
  recordId, studentId, studentName, submittedAt, evidenceCount,
  attachments: [
    { id, kind: "image"|"video", thumbUrl, originalUrl, name?, mime? }
  ]
}
```

列表 / 审核网格只用 `thumbUrl`（`loading="lazy"`），禁止预取原图。`backend-sync.js` 将 reviews / `proofFiles` 规范为上述结构。

### 状态机（`media-viewer.js`）

```
closed → open(attachments, index)
  → loading → ready | error | forbidden
ready: zoom ± · prev/next · Esc/←/→ · close
error/forbidden: 重试（403 文案「无权限查看」）
close → 恢复 filters + scrollY + 打卡下钻 level
```

---

## 3. 成绩复制 TSV 与排序

### 分秒录入（800/1000 米）

- UI：`分` + `秒`（秒 0–59，非法就地红字）
- 提交：`rawSeconds`（合计秒）
- 展示：原始 `m′ss″` + 服务端 `convertedScore`（无则空，不本地推算正式分）
- 「耐力跑换算」页结果标注「试算，非正式成绩」

### 成绩汇总平时分

同时展示：`approvedHours / requiredHours` + 百分制（优先 `checkinScore` / `regularScore` / `checkinPercent`）

### 复制区（挂成绩汇总页）

复制前摘要：人数、当前排序、缺失打卡分人数、缺失耐力跑分人数。

| 按钮 | TSV 列 |
|------|--------|
| 复制打卡分 | 学号 `\t` 姓名 `\t` 打卡百分制 |
| 复制耐力跑分 | 学号 `\t` 姓名 `\t` 耐力跑百分制 |
| 复制两列成绩 | 学号 `\t` 姓名 `\t` 打卡 `\t` 耐力跑 |

缺失值为**空单元格**（行位保留）。多行 `\n`。

样例（两列，按 import）：

```
20240001	张三	85	78
20240002	李四	70	
20240003	王五		82
```

### 排序（`core/sort-students.js`）

| 模式 | 规则 |
|------|------|
| `import`（默认） | `importIndex` 升序；无则保持原序 |
| `studentId` | 字符串比较，保留前导零 |
| `name` | `localeCompare('zh-CN')` |

页面表、复制 TSV、CSV 共用 `TeacherUiState.rosterSort`。

---

## 4. 给童禹璇的接口 / 错误清单

| 用途 | 方法 | 字段 |
|------|------|------|
| 打卡活动窗 | `GET/PUT /api/teacher/courses/:id/checkin-window` | `startsAt, endsAt, dailyWindowStart, dailyWindowEnd, lifecycleStatus?, recordCount?` |
| 任务 CRUD | 现有 tasks + | `startsAt, endsAt`（并行或替代 `deadline`）、`lifecycleStatus`、发布态 `status` |
| 改期拒绝 | 任意 4xx | `{ code, message }` — 前端原样展示 `message` |
| 证据附件 | reviews / sport_records | `proofFiles[]` → `{ id, kind, thumbUrl, originalUrl, name, mime }` |
| 体测耐力跑 | PUT physical | 提交 `rawSeconds`；回包 `convertedScore` |
| 成绩汇总行 | GET grades | `checkinHoursApproved, checkinHoursRequired, checkinPercent, enduranceRawDisplay, endurancePercent`（空=缺失） |
| CSV 排序 | export `?sort=import\|studentId\|name` | 未支持前由前端排序后再下 blob |

建议错误码（前端按 `message` 展示，code 可选）：

| code | 场景 |
|------|------|
| `WINDOW_INVALID_RANGE` | endsAt < startsAt |
| `WINDOW_FORBIDDEN` | 无权限改窗 |
| `MEDIA_FORBIDDEN` | 原图 403 |
| `MEDIA_NOT_FOUND` | 原图缺失 |

---

## 5. P0 失败路径（烟测备忘）

1. 起止颠倒 → 本地错误，不发请求
2. 改期确认取消 → 不保存
3. MOCK/API 返回 `{ message }` 4xx → 设置页错误条可见
4. 秒 ≥ 60 → 体测录入就地红字，禁止提交
5. 原图 403 → 预览器「无权限查看」+ 重试
6. 复制剪贴板失败 → textarea + `execCommand('copy')` 回退
7. 关闭预览器 → 筛选 chip / 搜索框 / 滚动位置 / 打卡 level 恢复
