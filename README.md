# BNBU 体育成绩管理系统

仓库：[Eric-xiong1/BNBU-web](https://github.com/Eric-xiong1/BNBU-web)

项目按三层架构组织：

```text
bnbuSystem/
├── frontend/     前端展示层 — 登录、管理员/负责人、教师端、学生端
├── backend/      业务逻辑层 — Express API、OpenAPI、联调文档
├── database/     数据存储层 — MySQL DDL、种子脚本
└── docs/         交付、验收与设计文档
```

## 快速启动

在仓库根目录：

```bash
npm install
npm run preview
```

浏览器打开：`http://127.0.0.1:4174/index.html`

| 角色 | 入口 |
|------|------|
| 体育任课老师 | 登录后进入 `frontend/teacher/`；演示 `teacher/index.html?demo=1` |
| 体育部管理员 / 负责人 | 留在 `frontend/` 主 SPA（Material 覆盖样式） |
| 学生 | `http://127.0.0.1:4174/student/` |

## 常用命令

```bash
npm install              # 安装依赖（含 backend）
npm run preview          # 前端静态预览 :4174
npm run mock-api         # Mock API :8080（无需 MySQL）
npm run api              # 完整后端（需 MySQL + 环境变量）
npm run test:web         # 管理端 / 联调自测
npm run test:student     # 学生端单元 + smoke
npm run test:api         # 后端 API 测试
```

### 启动完整后端 `npm run api`

需要 MySQL，并设置环境变量（PowerShell 示例）：

```powershell
$env:ALLOW_DEMO_TOKENS="true"
$env:DB_HOST="127.0.0.1"
$env:DB_PASSWORD="你的密码"
npm run api
```

若暂无 MySQL，可先用 `npm run mock-api` 做前端联调。

## 各层说明

### frontend/ — 前端展示层

- `index.html` + `app.js`：统一登录 + 管理员 / 负责人 SPA
- `login.css` / `app-material.css`：登录与管理端 Material 蓝白主题
- `teacher/`：体育老师 Material UI（打卡、审核、体测、成绩汇总与复制、课程教务等）
- `student/`：学生体育 Web（移动优先：打卡、课程、成绩、个人中心）
- `preview-server.cjs`：本地预览服务

教师端 P0 说明见 [frontend/README.md](frontend/README.md) 与 [docs/plans/2026-07-15-teacher-p0-frontend.md](docs/plans/2026-07-15-teacher-p0-frontend.md)。

### backend/ — 业务逻辑层

- `server.js`：生产 API 服务
- `mock-api.cjs`：联调 Mock
- `openapi.yaml`：接口契约

### database/ — 数据存储层

- `schema.sql`：建表与演示种子数据
- `run-seed.cjs`：可选的外部测试库灌数脚本（含硬编码凭据时请改用环境变量）

## 文档索引

| 文档 | 说明 |
|------|------|
| [docs/DELIVERY_README.md](docs/DELIVERY_README.md) | 交付包说明 |
| [docs/DEPLOY_DEV.md](docs/DEPLOY_DEV.md) | 开发环境部署 |
| [docs/STUDENT_WEB_ACCEPTANCE.md](docs/STUDENT_WEB_ACCEPTANCE.md) | 学生端验收 |
| [docs/plans/2026-07-15-teacher-p0-frontend.md](docs/plans/2026-07-15-teacher-p0-frontend.md) | 教师端 P0 前端设计与对接清单 |
| [docs/工作日志-2026-07-11.md](docs/工作日志-2026-07-11.md) | 2026-07-11 工作日志 |
