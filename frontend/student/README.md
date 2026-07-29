# BNBU Sports 学生端（Android 界面 1:1 复刻）

本目录是对 Android 学生端（`BNBU-Sports-Android`，基准 `0.1.0-mvp` / commit `780326a`）前端界面的 Web 复刻。
不重新设计页面，不调整业务逻辑、功能流程、字段内容和页面顺序；Android 当前实现是视觉、
信息结构和交互结果的唯一基准（详见安卓仓库中的《Android_前端界面跨端复刻交接文档》）。

## 运行

```bash
npm run preview
# 打开 http://127.0.0.1:4174/student/
```

纯静态 SPA（无构建步骤、无外部依赖）。验证：`npm run test:student`。

## 复刻范围（37 个页面 / 11 类弹层）

- 启动恢复、隐私同意、隐私政策（本地 Markdown 资产）、登录前加课引导（2 页 pager）
- 登录方式（邮箱/手机/扫码/Mock/恢复申请）、邮箱与手机验证码登录（60s 倒计时、成功仅回选择器 —— 与 Android 当前实现一致）
- 扫码加课（getUserMedia + BarcodeDetector、权限拒绝态、手输 Dialog）、手输邀请码、加课确认、申请状态（PENDING/NEEDS_CORRECTION/REJECTED/请求缺失/邀请失效）
- 联系方式激活绑定（RequiredActivation / ManageContacts）与激活帮助、入课后引导（4 页）
- 首页（今日打卡时间窗、加课/申请入口、进行中运动恢复、总进度、分项进度含组织抵扣）
- 通知 Bottom Sheet（82% 高、All/Unread/Deadline/Application 筛选、详情、全标已读、Review 通知直达免测）
- 课程列表/详情（历史课程折叠、最终成绩）、打卡流程（准备/运动中/暂停/2 小时上限/不足 1 小时放弃/完成提交/提交成功/记录列表/记录详情）
- 运动进度、个人中心、账户详情、设置（外观 3 段 / 语言 2 段、退出确认）、帮助中心、问题反馈、关于、更新日志、耐力换算、免测申请、系统维护（`?sysmode=maintenance|readonly|planned` 预览）

## 数据与行为

- 会话使用 Android 的 Mock 用户数据（`MockStudentWorkspace.kt` 1:1 迁移）；Mock 会话无 API
  repository，帮助/反馈/免测提交等页面复刻 Android 演示分支的加载失败与禁提交文案。
- 设计 token（颜色/字体/间距/圆角/动效）来自 `core/designsystem/`，见 `css/tokens.css`；
  `SwissPanel`、`SegmentedControl`、浮动底栏等通用组件见 `css/components.css` 与 `js/ui.js`。
- 中英双语：`strings.xml` + `interfaceText(中文, English)` 均已迁移（`js/i18n.js` 的 `t()` / `tx()`），
  新装默认中文，切换即时生效并持久化；深浅色与跟随系统同 Android。
- 浏览器返回、Escape 遵循 Android 返回链（引导 pager、扫码查询中禁返、免测提交中禁返等）。
- 验证码演示：发送后输入 `123456` 视为验证成功（其余码复刻错误提示文案）。
- 演示邀请码：`BNBU-7K3P9Q`、`BNBU-4M8X2T`；`BNBU-EXPIRED` 触发邀请失效状态。

## 目录

```
index.html            入口（含校徽 <defs>）
css/tokens.css        设计 token（Light/Dark）
css/components.css    通用组件
css/screens.css       各页面样式
js/app.js             根状态机（AppRootScreen 对应）
js/i18n.js            双语文案
js/session.js         运动会话与打卡时间窗策略
js/data.js            Mock 工作区数据
js/screens/*.js       各功能页面
assets/               校徽 SVG 与两份隐私政策 Markdown
```
