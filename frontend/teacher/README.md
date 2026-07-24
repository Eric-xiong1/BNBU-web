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
| `legacy-pages.js` | 名单导入、签到平时分、成绩导出（预检 + CSV）、学时明细、抵扣确认、耐力跑试算 |
| `core/time-window.js` | 统一 `startsAt` / `endsAt` 校验、生命周期徽章、编辑器 HTML |
| `core/sort-students.js` | `import` / `studentId` / `name`；页面、复制、CSV 同序 |
| `media-viewer.js` | 证据全屏预览状态机 |
| `backend-sync.js` | 登录后把 `/api/teacher/*` 映射进 MOCK 结构 |
| `auth-bridge.js` | 共享 `bnbuAuthSession`、`apiFetch` |

## 导航分组

- **常用**：工作台、打卡全览、审核工作台、成绩汇总（侧栏首屏突出）
- **更多**（可折叠，默认收起）：多班级 / 打卡设置 / 历史、体测期末、教务六页、基础管理、权限
- 首页仅 KPI + 三核心快捷 + 今日打卡

## 约束（业务流程 v3）

- 无课程任务；校队/社团由授课老师直接审，无组织负责人角色
- 打卡提交后默认有效并即时计入学时；教师可标无效（必通知）/ 恢复 / 修正学时（仅 0/1/2h，同日有效合计 ≤2h）
- 打卡设置按**课程**保存时间窗；学时口径为课程运动 + 自主运动（默认各 10h）
- 抵扣可拆课程运动/自主运动，合计 ≤20h；免测通过后教师录入自定义分数
- 归档由管理员发起；教师端成绩导出仅为自定义 Excel/CSV + 预检参考
- 前端不维护独立耐力跑评分表；「耐力跑换算」页仅为试算
- 非 demo 下新审查操作若后端无对应接口，本地预览并提示「接口待对接」

## 本地验证

```bash
# 仓库根目录
npm run preview
# 浏览器打开 teacher/index.html?demo=1
node --check frontend/teacher/app.js
npm run test:web
```
