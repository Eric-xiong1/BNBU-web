# BNBU 体育成绩管理系统

项目按三层架构组织：

```text
bnbuSystem/
├── frontend/     前端展示层 — 登录、管理员 SPA、老师 Material UI
├── backend/      业务逻辑层 — Express API、OpenAPI、联调文档
├── database/     数据存储层 — MySQL DDL、种子脚本
└── docs/         交付与部署文档
```

## 快速启动

在仓库根目录：

```bash
npm run preview
```

浏览器打开：`http://127.0.0.1:4174/index.html`

| 角色 | 入口 |
|------|------|
| 体育任课老师 | 登录后自动进入 `frontend/teacher/` |
| 体育部管理员 / 负责人 | 登录后留在 `frontend/` 主 SPA |

## 常用命令

首次使用请先安装后端依赖（根目录 `npm install` 会自动安装）：

```bash
npm install              # 安装 backend 依赖
npm run preview          # 前端静态预览 :4174
npm run mock-api         # Mock API :8080（无需 MySQL）
npm run api              # 完整后端（需 MySQL + 环境变量）
npm run test:web         # 前端自测
npm run test:api         # 后端 API 测试
```

### 启动完整后端 `npm run api`

需要 MySQL，并设置环境变量（PowerShell 示例）：

```powershell
$env:ALLOW_DEMO_TOKENS="true"   # 本地开发可用演示库配置
$env:DB_HOST="127.0.0.1"
$env:DB_PASSWORD="你的密码"
npm run api
```

若暂无 MySQL，可先用 `npm run mock-api` 做前端联调。

## 各层说明

### frontend/ — 前端展示层

- `index.html` + `app.js`：管理员 / 负责人 Web SPA
- `teacher/`：体育老师 Material UI（打卡、审核、成绩）
- `preview-server.cjs`：本地预览服务

### backend/ — 业务逻辑层

- `server.js`：生产 API 服务
- `mock-api.cjs`：联调 Mock
- `openapi.yaml`：接口契约

### database/ — 数据存储层

- `schema.sql`：建表与演示种子数据
- `run-seed.cjs`：可选的外部测试库灌数脚本

详细交付说明见 `docs/DELIVERY_README.md`。
