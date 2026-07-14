# BNBU 学生体育 Web 端验收版

## 1. 交付入口

- 本地启动：在 `BNBU-web` 根目录执行 `npm run preview`
- 学生端地址：`http://127.0.0.1:4174/student/index.html`
- 无数据库验收：登录页点击“进入演示学生端”
- 真实接口模式：学生账号登录后按同源 `/api/*` 契约加载数据

本次版本以 Android 学生端为功能和界面基准，将移动端主要能力迁移到响应式 Web；演示模式可独立完成前端验收，同时保留后续数据库和接口联调边界。

## 2. Android 对齐范围

| 模块 | 验收内容 |
|---|---|
| 登录 | BNBU Sports 品牌入口、学生账号登录、密码显隐、演示学生端入口 |
| 首页 | 学时总进度、课程相关/其他运动拆分、风险提示、重点计划、近期任务、通知入口 |
| 课程 | 当前学期与历史课程、课程代码与四位 Section、任课老师、截止时间、学时进度、课程任务与相关记录 |
| 打卡 | 任务/提交/记录三段工作区、任务和记录筛选、学时步进、运动项目、草稿、图片/视频凭证、补交材料 |
| 成绩 | 总分预估、打卡 25% / 专项考试 30% / 平时表现 20% / 体测 25%、缺失项、公式与数据来源 |
| 我的 | 学生身份、任课老师、校队/社团认证与抵扣、通知、设置、退出登录 |
| 学生工具 | 耐力跑换算、适用人群与规则来源、免测/免打卡申请、详情、审核意见与补交证明 |
| 系统体验 | 五项 Android 顺序导航、通知底部抽屉、浅色/深色/跟随系统、减少动态效果、隐私政策、同步失败重试提示 |

## 3. 响应式与视觉验收

真实 Chrome 已检查手机 390×844、平板 768×1024、桌面 1440×900。验收覆盖首页、课程、课程详情、打卡提交/记录、成绩、个人页、通知抽屉、耐力跑、免测申请和隐私政策；结果为：

- 五个主导航在各尺寸均可用；
- 页面级横向溢出为 0；
- 页面无 `undefined` 文本；
- 浅色和深色主题组件颜色均可读；
- 浏览器控制台无页面脚本错误。

验收截图：

- `docs/acceptance/student-web/desktop-login.png`
- `docs/acceptance/student-web/mobile-home.png`
- `docs/acceptance/student-web/mobile-checkin.png`
- `docs/acceptance/student-web/mobile-records-refined.png`
- `docs/acceptance/student-web/mobile-profile-dark.png`
- `docs/acceptance/student-web/tablet-courses.png`
- `docs/acceptance/student-web/desktop-home.png`
- `docs/acceptance/student-web/desktop-checkin.png`

## 4. 自动化验证

```powershell
npm.cmd run test:student
npm.cmd run test:web
npm.cmd run test:api
$env:STUDENT_WEB_URL='http://127.0.0.1:4174/student/index.html'; npm.cmd run smoke:student
```

学生端现有 40 项单元/渲染测试，覆盖导航、主题、首页风险判断、登录角色限制、课程、成绩、打卡校验、草稿、混合媒体凭证、通知、隐私、耐力跑和免测申请等关键行为。

## 5. 重点验收路径

1. 点击“进入演示学生端”，默认进入首页并看到 13.5/20h 学时进度。
2. 从底部进入“打卡”，切换任务/提交/记录，检查记录缩略图、状态筛选和补交入口。
3. 从“课程”打开 `GEPE101 / Section 1004`，检查课程任务和相关打卡记录。
4. 从“成绩”检查四项权重、总分预估、缺失项及计算公式。
5. 从“我的”打开通知、耐力跑换算、免测申请与隐私政策。
6. 在“我的 → 设置”切换深色/浅色/跟随系统，并检查减少动态效果。

## 6. 联调边界

本验收版不要求数据库即可运行。真实模式已保留学生登录、汇总、任务、课程、成绩、打卡、凭证上传、通知已读、耐力跑换算和免测申请的 API 调用边界；正式联调时只需配置可用的 `/api/*` 与 `/uploads/*` 服务，不需要重做页面结构。
