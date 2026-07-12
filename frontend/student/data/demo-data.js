const iso = (days = 0, hours = 0) => new Date(Date.now() + days * 86400000 + hours * 3600000).toISOString();

export function demoWorkspace() {
  return {
    mode: "demo",
    route: { name: "checkin" },
    session: { token: "demo-token-student", user: { id: "22301142", name: "何同学", role: "student" } },
    student: {
      id: "22301142", name: "何同学", college: "数据科学学院", gradeLevel: "FS", gradeLabel: "大二",
      gender: "male", genderLabel: "男", className: "2024 数据科学 2 班", status: "正常",
    },
    summary: {
      courseHours: 7.5, generalHours: 6, totalCompleted: 13.5, totalRequired: 20,
      totalRemaining: 6.5, courseRemaining: 2.5, generalRemaining: 4, pendingCount: 2,
      rule: { total: 20, courseRequired: 10, generalRequired: 10, dailyLimit: 2 },
    },
    courses: [
      { id: "gepe", courseCode: "GEPE101", section: "1004", name: "大学体育 II", teacher: "陈老师", semester: "2025–2026 夏季", requiredHours: 10, completedHours: 7.5 },
      { id: "basketball", courseCode: "SPT204", section: "2001", name: "篮球专项", teacher: "李老师", semester: "2025–2026 夏季", requiredHours: 5, completedHours: 3 },
    ],
    tasks: [
      { id: "task-run", courseId: "gepe", title: "校园耐力跑", description: "完成一次不少于 30 分钟的户外跑步", status: "待完成", deadline: iso(3), hours: 1 },
      { id: "task-basket", courseId: "basketball", title: "篮球专项练习", description: "完成投篮与脚步训练并上传现场凭证", status: "待完成", deadline: iso(6), hours: 1 },
      { id: "task-done", courseId: "gepe", title: "体能恢复训练", description: "拉伸与核心训练", status: "已完成", deadline: iso(-4), hours: 0.5 },
    ],
    records: [
      { id: "sr-1", courseId: null, taskId: null, creditType: "其他运动", sportType: "running", hours: 1, description: "南区操场完成五公里慢跑", proofFiles: ["/uploads/demo-run.jpg"], status: "待审核", submittedAt: iso(0, -2), reviewComment: "" },
      { id: "sr-2", courseId: "gepe", taskId: "task-done", creditType: "课程相关", sportType: "fitness", hours: 0.5, description: "完成核心与拉伸训练", proofFiles: ["/uploads/demo-fitness.jpg"], status: "已通过", submittedAt: iso(-2), reviewComment: "材料完整" },
      { id: "sr-3", courseId: null, taskId: null, creditType: "其他运动", sportType: "cycling", hours: 1, description: "情侣路骑行训练", proofFiles: ["/uploads/demo-bike.jpg"], status: "补材料", submittedAt: iso(-5), reviewComment: "请补充可识别日期的运动轨迹" },
      { id: "sr-4", courseId: "basketball", taskId: "task-basket", creditType: "课程相关", sportType: "basketball", hours: 1, description: "篮球投篮练习", proofFiles: [], status: "已驳回", submittedAt: iso(-8), reviewComment: "缺少现场凭证" },
      { id: "sr-5", courseId: null, taskId: null, creditType: "其他运动", sportType: "badminton", hours: 1.5, description: "体育馆羽毛球双打", proofFiles: ["/uploads/demo-badminton.jpg"], status: "已通过", submittedAt: iso(-11), reviewComment: "已计入其他运动学时" },
    ],
    grades: {
      components: { checkin: 82, exam: 88, performance: 90, physical: 76 },
      sources: ["打卡审核记录 · 2026-07-12", "专项考试录入 · 陈老师", "平时表现 · 教学记录", "体测成绩 · 教务同步"],
      updatedAt: iso(0, -1),
    },
    memberships: [
      { id: "m1", type: "club", organization: "校园跑步社", status: "认证有效", offsetStatus: "可抵扣", expiresAt: "2026-12-31" },
      { id: "m2", type: "team", organization: "学院篮球队", status: "待确认", offsetStatus: "不可抵扣", expiresAt: "2026-09-30" },
    ],
    notifications: [
      { id: "n1", title: "打卡已提交", message: "跑步 1 小时已提交，等待老师审核", category: "审核反馈", isUnread: true, createdAt: iso(0, -2) },
      { id: "n2", title: "需要补充材料", message: "骑行记录需要补充带日期的轨迹截图", category: "审核反馈", isUnread: true, createdAt: iso(-1) },
      { id: "n3", title: "课程任务提醒", message: "校园耐力跑将在 3 天后截止", category: "任务提醒", isUnread: false, createdAt: iso(-2) },
      { id: "n4", title: "免测申请结果", message: "上一学期 1000m 免测申请已通过", category: "免测申请", isUnread: false, createdAt: iso(-10) },
    ],
    exemptions: [
      { id: "ex-1", type: "1000m", reason: "脚踝韧带损伤，医生建议暂停耐力跑", proofFiles: ["/uploads/demo-medical.jpg"], status: "待审核", reviewComment: "", createdAt: iso(-2) },
      { id: "ex-2", type: "1000m", reason: "术后恢复期", proofFiles: ["/uploads/demo-proof.jpg"], status: "已通过", reviewComment: "材料核验通过", createdAt: iso(-160) },
    ],
    weeklyPlan: [
      { day: "周一", label: "慢跑", done: true }, { day: "周二", label: "休息", done: true },
      { day: "周三", label: "篮球", done: false }, { day: "周四", label: "核心", done: false },
      { day: "周五", label: "慢跑", done: false }, { day: "周六", label: "自由运动", done: false },
      { day: "周日", label: "恢复", done: false },
    ],
    draft: null,
    uploads: [],
    settings: { reducedMotion: false },
  };
}
