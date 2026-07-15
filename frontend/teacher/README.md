# 教师端（Material UI）

路径：`frontend/teacher/`  
演示：`index.html?demo=1`  
设计说明与后端对接清单：[docs/plans/2026-07-15-teacher-p0-frontend.md](../../docs/plans/2026-07-15-teacher-p0-frontend.md)

## 角色入口

- 统一登录选择「体育任课老师」并登录成功后跳转本目录
- 无 token 时加 `?demo=1` 使用本地 MOCK，不请求正式 API

## 主要模块

| 文件 | 职责 |
|------|------|
| `app.js` | 路由、打卡下钻、审核、体测、成绩汇总 / 复制 |
| `legacy-pages.js` | 课程任务、名单导入、签到平时分、成绩导出、学时明细、抵扣、耐力跑试算 |
| `core/time-window.js` | 统一 `startsAt` / `endsAt` 校验、生命周期徽章、编辑器 HTML |
| `core/sort-students.js` | `import` / `studentId` / `name`；页面、复制、CSV 同序 |
| `media-viewer.js` | 证据全屏预览状态机 |
| `backend-sync.js` | 登录后把 `/api/teacher/*` 映射进 MOCK 结构 |
| `auth-bridge.js` | 共享 `bnbuAuthSession`、`apiFetch` |

## 导航分组

- **打卡管理**：全览、多班级、打卡设置（时间窗）、历史
- **申请审核**：审核工作台（含证据缩略图）
- **考核管理**：体测（分秒）、期末、项目、成绩汇总（排序 + 复制）
- **课程教务**：任务（时间窗）、名单导入、平时分、导出、学时明细、抵扣、试算换算
- **基础管理**：我的课程、学生名单

## 约束

- 前端不维护独立耐力跑评分表，不推算与服务端不一致的正式百分制
- 「耐力跑换算」页仅为试算；体测正式分展示服务端 `convertedScore`
- 待接入接口：`checkin-window`、tasks 扩字段、证据 `thumbUrl`/`originalUrl`、成绩行百分制字段等（见设计文档第 4 节）

## 本地验证

```bash
# 仓库根目录
npm run preview
# 浏览器打开 teacher/index.html?demo=1
node --check frontend/teacher/app.js
npm run test:web
```
