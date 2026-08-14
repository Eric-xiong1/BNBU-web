# BNBU Sports Web 学生端

本目录是 BNBU Sports 的 Web 学生端。业务、网络请求和字段约束以 Backend `/api/v1` 的正式 Contract 1.5 为基线。

## Contract 1.5 行为

- 学生账号只使用邮箱验证码登录；手机号和短信验证码入口已下线。
- 首次邮箱绑定和已验证邮箱换绑均调用 Backend challenge 接口，验证码、频率和失败次数由 Backend 裁决。
- 自主运动（`GENERAL`）说明必填且不能只含空格；课程运动（`COURSE_RELATED`）说明可选；填写时最多 200 字。
- 必须先由 Backend 确认运动会话结束，且有效时长不少于 1 小时，才能提交打卡记录。
- 结束运动后仍可补拍照片或最长 15 秒的有声视频；提交时上传并绑定当前保留的全部凭证，不提供手动勾选。
- 最终图片只上传 JPEG/PNG。浏览器能够解码的 WebP/HEIC/HEIF 会先重编码为不含原始 EXIF/GPS 的 JPEG；不能解码时要求重新拍摄。
- 最终视频只允许 MP4、MOV、3GP、WebM。空 MIME、未知容器和 MKV 会在客户端失败关闭；Backend 最终校验容器、轨道、真实时长、文件大小、SHA-256 和位置元数据。
- Web 不申请定位权限，也不主动采集经纬度。Backend 返回 `MEDIA_LOCATION_METADATA_NOT_ALLOWED` 时要求用户重新拍摄。
- 邀请预览、扫码/手输邀请码、加入课程、工作区、运动、媒体和记录请求全部走真实 `/api/v1`；请求失败不会回退到 Mock 数据。

## 运行

```bash
npm run preview
# 打开 http://127.0.0.1:4174/student/
```

学生端是无外部运行时依赖的静态 SPA。手机浏览器通过 `<input capture>` 调起系统相机；桌面浏览器可能显示文件选择器，因此 Web 不能独立证明采集来源，Backend 仍是媒体真实性的最终裁决者。相机和麦克风需要 HTTPS 或 localhost。

## 验证

```bash
npm run test:student
```

冒烟测试覆盖双语、时间窗、运动计时、Contract 1.5 媒体格式与时长边界，以及本地状态容错。`js/data.js` 中的 synthetic 数据只供单元测试和静态展示逻辑使用，不作为真实模式请求失败时的回退数据。

## 主要功能

- 系统 Splash 后的状态恢复、隐私同意和中英文界面
- 邮箱验证码登录、首次邮箱绑定和换绑
- 扫码/手输 Backend 邀请 token 并直接加入教学班
- 课程、运动进度、通知、偏好、帮助、反馈和免修申请
- 现场照片/有声短视频、草稿恢复、上传进度、安全重试和失败提示
- 自主运动与课程运动的动态说明校验及最终打卡提交
- 只展示 Backend 返回的耐力跑成绩，不提供学生端成绩录入

## 目录

```text
index.html            入口
css/                  设计 token、通用组件和页面样式
js/app.js             根状态机
js/api.js             `/api/v1` 客户端与数据映射
js/proofs.js          Contract 1.5 媒体规则
js/session.js         运动会话与时间窗策略
js/screens/           学生端页面
assets/               校徽与隐私政策
student-smoke.mjs     学生端冒烟测试
```
