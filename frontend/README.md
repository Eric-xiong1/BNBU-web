# 前端展示层

本目录包含全部 Web 静态资源与本地预览服务。

## 结构

```text
frontend/
├── index.html              统一登录 + 管理员/负责人 SPA 入口
├── app.js                  管理员 SPA 逻辑
├── styles-campus-blue.css  管理员样式
├── teacher/                体育老师 Material UI
├── preview-server.cjs      本地预览 :4174
├── self-test.cjs
└── quality-smoke.cjs
```

## 启动

在仓库根目录：

```bash
npm run preview
```

访问 `http://127.0.0.1:4174/index.html` — 老师登录后自动进入 `teacher/`。
