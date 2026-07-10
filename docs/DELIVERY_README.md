# BNBU 体育成绩管理 Web 交付包说明

交付日期：2026-06-12

## 项目结构（三层架构）

```text
frontend/     前端展示层
backend/      业务逻辑层
database/     数据存储层
docs/         交付与部署文档
```

## 交付范围

- `frontend/`：Web 前端（管理员 SPA + 老师 Material UI）、预览服务、自测与烟测脚本
- `backend/`：API 服务、OpenAPI 草案、数据字典、联调清单、Mock API
- `database/`：`schema.sql` 建表与种子数据
- `docs/`：产品文档、部署说明、验证记录

## 快速启动

在仓库根目录运行：

```bash
npm run preview
```

打开：

```text
http://127.0.0.1:4174/index.html
```

如需 mock API：

```bash
npm run mock-api
```

健康检查地址：

```text
http://127.0.0.1:8080/api/health
```

## 验证命令

```bash
npm run test:web
node frontend/quality-smoke.cjs
```

## 当前结论

Web 前端已达到后端联调交付状态。真实上线前仍需接入正式后端、真实登录鉴权、真实文件上传/导出服务，并完成 Chrome、Edge、Safari、Firefox 的人工主流程验收。
