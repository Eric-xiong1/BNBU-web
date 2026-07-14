const sections = [
  ["我们收集的信息", ["账号信息：学号、姓名、学院、年级、班级和校内身份。", "体育数据：打卡记录、运动凭证（图片/视频）、体测成绩、免测申请材料。", "设备与日志：为保障服务稳定和账号安全所需的浏览器、网络与错误日志。"]],
  ["使用目的", ["计算和展示体育学时、成绩进度与风险提示。", "处理运动打卡、课程任务、免测申请和材料补交。", "发送申请结果、任务截止和审核反馈等系统通知。"]],
  ["保存与安全", ["体育数据仅在完成教学管理、成绩核验和学校规定留档所需期间保存。", "正式环境通过校内权限控制、HTTPS 和访问审计保护数据；浏览器端不保存数据库口令。"]],
  ["共享范围", ["仅向完成教学、审核和系统运维职责所必需的校内教师、管理员及授权服务提供方开放。", "未经授权不会向无关第三方出售或公开学生体育数据。"]],
  ["你的权利", ["你可以查看自己的账号、打卡、成绩、通知和申请状态。", "如发现信息错误，可联系任课教师或学校管理部门申请更正；在规则允许范围内可申请删除非必要材料。"]],
  ["联系我们", ["如对隐私政策或体育数据处理有疑问，请联系任课教师或发送邮件至 pe@bnbu.edu.cn。", "本政策发生重大变更时，将通过学生端通知或学校公告说明。"]],
];

export function renderPrivacyPolicy() {
  return `<section class="page-stack privacy-page"><button class="button button-secondary back-button" type="button" data-route="profile">← 返回我的</button><header><span class="eyebrow">PRIVACY</span><h1 class="page-heading">隐私政策</h1><p class="page-caption">更新日期：2026 年 7 月 14 日</p></header><section class="card"><div class="card-body privacy-intro">BNBU 学生体育 Web 端仅为完成校内体育教学与学时管理所需处理数据。以下内容说明我们如何采集、使用和保护这些信息。</div></section>${sections.map(([title, paragraphs], index) => `<section class="card privacy-section"><div class="card-head"><span class="eyebrow">0${index + 1}</span><h2 class="card-title">${title}</h2></div><div class="card-body">${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}</div></section>`).join("")}</section>`;
}
