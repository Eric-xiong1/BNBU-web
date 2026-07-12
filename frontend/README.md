# 前端展示层

本目录包含全部 Web 静态资源与本地预览服务。

## 结构

```text
frontend/
├── index.html              统一登录 + 管理员/负责人 SPA 入口
├── app.js                  管理员 SPA 逻辑
├── styles-campus-blue.css  管理员样式
├── teacher/                体育老师 Material UI
├── student/                学生体育 Web 端（移动优先 SPA）
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

学生端入口：`http://127.0.0.1:4174/student/index.html`。

学生端默认进入“打卡”，支持演示模式和真实接口模式。演示登录可直接点击登录页的“进入演示模式”；真实模式使用统一学生账号登录，并通过同源 `/api/*` 调用后端。

```bash
npm run test:student
```

图片/视频凭证限制：最多 6 张图片（每张 8MB）和 1 个视频（100MB）。
