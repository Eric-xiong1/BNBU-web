# 前端展示层

本目录包含全部 Web 静态资源与本地预览服务。

## 结构

```text
frontend/
├── index.html                 统一登录 + 管理员/负责人 SPA 入口
├── app.js                     管理员 / 负责人 SPA 逻辑
├── login.css                  登录页 Material 样式
├── app-material.css           管理端 Material 覆盖样式
├── styles-campus-blue.css     管理端基础样式
├── teacher/                   体育老师 Material UI
│   ├── index.html
│   ├── app.js                 打卡、审核、体测、成绩汇总等
│   ├── api.js / mock-data.js / backend-sync.js / auth-bridge.js
│   ├── legacy-pages.js        课程任务、名单导入、导出、换算等补齐页
│   ├── media-viewer.js        证据全屏预览（缩放 / 翻页 / 失败态）
│   ├── core/
│   │   ├── time-window.js     统一起止时间模型与编辑器
│   │   └── sort-students.js   导入序 / 学号 / 姓名排序
│   └── styles.css
├── student/                   学生体育 Web（移动优先 SPA）
├── preview-server.cjs         本地预览 :4174
├── self-test.cjs
└── quality-smoke.cjs
```

## 启动

在仓库根目录：

```bash
npm run preview
```

| 入口 | URL |
|------|-----|
| 统一登录 | `http://127.0.0.1:4174/index.html` |
| 教师端演示 | `http://127.0.0.1:4174/teacher/index.html?demo=1` |
| 学生端 | `http://127.0.0.1:4174/student/` |

老师真实登录后由主 SPA 跳转至 `teacher/`；学生端可演示登录或走同源 `/api/*`。

```bash
npm run test:web
npm run test:student
```

## 教师端能力摘要（P0）

- **统一时间窗**：打卡设置（学期活动起止 + 每日时段）与课程任务共用起止时间；展示未开始 / 进行中 / 已结束；改期提示不删除已有记录；保存后回读（演示模式为 MOCK）
- **证据预览**：列表缩略图（`thumbUrl`）；全屏按需加载原图，支持缩放、翻页、加载失败 / 无权限 / 重试；关闭后恢复筛选与滚动
- **成绩**：800/1000 米分:秒录入；展示服务端 `convertedScore`（不内置正式评分表）；成绩汇总含打卡小时 + 百分制、三一键复制（TSV）与统一排序
- **正式算分 / 导出算法**：由后端负责；前端字段约定见 [docs/plans/2026-07-15-teacher-p0-frontend.md](../docs/plans/2026-07-15-teacher-p0-frontend.md)

更细的模块说明见 [teacher/README.md](teacher/README.md)。

## 学生端

默认进入「打卡」，支持演示模式与真实接口。演示可在登录页进入演示模式；真实模式使用学生账号并通过同源 `/api/*` 调用后端。

图片 / 视频凭证限制：最多 6 张图片（每张 8MB）和 1 个视频（100MB）。验收说明见 [docs/STUDENT_WEB_ACCEPTANCE.md](../docs/STUDENT_WEB_ACCEPTANCE.md)。
