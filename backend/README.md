# 业务逻辑层

Express API 服务、OpenAPI 契约与联调材料。

## 结构

```text
backend/
├── server.js           生产 API（MySQL）
├── mock-api.cjs        联调 Mock
├── openapi.yaml        接口草案
├── test/               API 测试
└── …                   数据字典、联调清单等
```

## 启动

```bash
npm install --prefix backend   # 首次
npm run mock-api               # Mock :8080
npm run api                    # 完整后端
npm run test:api               # 运行测试
```

数据库 DDL 见 `../database/schema.sql`。

## 教师端联调备注

教师端前端已按 MOCK 对接下列能力，正式接口待后端补齐（字段约定见 `docs/plans/2026-07-15-teacher-p0-frontend.md`）：

| 能力 | 建议接口 |
|------|----------|
| 课程打卡活动窗 | `GET/PUT /api/teacher/courses/:id/checkin-window` |
| 任务起止时间 | tasks CRUD 增加 `startsAt` / `endsAt` / `lifecycleStatus` |
| 证据缩略/原图 | `proofFiles` → `thumbUrl` / `originalUrl` |
| 体测耐力跑 | 提交 `rawSeconds`，回包 `convertedScore` |
| 成绩导出排序 | `GET .../export?sort=import\|studentId\|name` |

正式百分制与耐力跑评分表由服务端维护，前端不得内置独立换算表。
