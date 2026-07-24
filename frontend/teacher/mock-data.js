/** 模拟数据 — 对接后端时替换 api.js 中的 fetch 实现 */
window.MOCK = {
  currentUser: {
    id: "t001",
    name: "张老师",
    role: "sports_teacher",
    roles: ["sports_teacher"],
  },

  courses: [
    { id: "c1", name: "体育（一）", semester: "2025-2026-1", isSpecialty: false },
    { id: "c2", name: "体育（二）", semester: "2025-2026-1", isSpecialty: false },
    { id: "c3", name: "篮球专项", semester: "2025-2026-1", isSpecialty: true },
    { id: "c4", name: "健美操", semester: "2025-2026-1", isSpecialty: true },
  ],

  classes: [
    { id: "cl1", courseId: "c1", classNo: "2401", total: 42 },
    { id: "cl2", courseId: "c1", classNo: "2402", total: 38 },
    { id: "cl3", courseId: "c1", classNo: "2403", total: 40 },
    { id: "cl4", courseId: "c2", classNo: "2401", total: 45 },
    { id: "cl5", courseId: "c2", classNo: "2402", total: 43 },
    { id: "cl6", courseId: "c3", classNo: "A组", total: 24 },
    { id: "cl7", courseId: "c3", classNo: "B组", total: 22 },
    { id: "cl8", courseId: "c4", classNo: "2401", total: 36 },
  ],

  heatmap: {
    default: [
      0.6, 0.7, 0.8, 0.75, 0.9, 0.85, 0.4,
      0.65, 0.72, 0.88, 0.91, 0.78, 0.82, 0.55,
      0.7, 0.83, 0.86, 0.92, 0.88, 0.79, 0.68,
      0.74, 0.81, 0.87, 0.9, 0.84, 0.76, 0.71,
    ],
    cl1: [
      0.72, 0.78, 0.85, 0.8, 0.92, 0.88, 0.55,
      0.68, 0.75, 0.9, 0.93, 0.82, 0.86, 0.6,
      0.74, 0.88, 0.9, 0.95, 0.91, 0.83, 0.7,
      0.78, 0.84, 0.89, 0.92, 0.87, 0.8, 0.73,
    ],
    cl2: [
      0.55, 0.62, 0.7, 0.68, 0.82, 0.75, 0.38,
      0.58, 0.65, 0.78, 0.85, 0.72, 0.76, 0.48,
      0.62, 0.74, 0.8, 0.86, 0.82, 0.7, 0.58,
      0.66, 0.72, 0.79, 0.84, 0.78, 0.68, 0.62,
    ],
    cl3: [
      0.68, 0.74, 0.82, 0.78, 0.88, 0.84, 0.52,
      0.7, 0.76, 0.86, 0.9, 0.8, 0.84, 0.58,
      0.72, 0.85, 0.88, 0.93, 0.89, 0.81, 0.68,
      0.76, 0.82, 0.87, 0.9, 0.85, 0.78, 0.7,
    ],
    cl4: [
      0.75, 0.8, 0.88, 0.85, 0.94, 0.9, 0.6,
      0.78, 0.84, 0.92, 0.95, 0.86, 0.9, 0.65,
      0.8, 0.9, 0.93, 0.96, 0.92, 0.86, 0.74,
      0.82, 0.88, 0.93, 0.95, 0.9, 0.84, 0.78,
    ],
    cl5: [
      0.7, 0.76, 0.84, 0.8, 0.9, 0.86, 0.5,
      0.72, 0.78, 0.88, 0.91, 0.82, 0.86, 0.55,
      0.74, 0.86, 0.89, 0.94, 0.9, 0.82, 0.7,
      0.78, 0.84, 0.89, 0.92, 0.87, 0.8, 0.72,
    ],
    cl6: [
      0.82, 0.86, 0.92, 0.9, 0.96, 0.94, 0.72,
      0.84, 0.88, 0.94, 0.97, 0.92, 0.94, 0.78,
      0.86, 0.92, 0.95, 0.98, 0.96, 0.9, 0.82,
      0.88, 0.92, 0.95, 0.97, 0.94, 0.88, 0.84,
    ],
    cl7: [
      0.78, 0.82, 0.88, 0.85, 0.92, 0.9, 0.65,
      0.8, 0.84, 0.9, 0.93, 0.88, 0.9, 0.7,
      0.82, 0.88, 0.91, 0.94, 0.92, 0.86, 0.78,
      0.84, 0.88, 0.92, 0.94, 0.9, 0.84, 0.8,
    ],
    cl8: [
      0.62, 0.68, 0.76, 0.72, 0.84, 0.78, 0.42,
      0.64, 0.7, 0.82, 0.86, 0.76, 0.8, 0.5,
      0.68, 0.78, 0.82, 0.88, 0.84, 0.74, 0.62,
      0.7, 0.76, 0.82, 0.86, 0.8, 0.72, 0.66,
    ],
  },

  students: {
    cl1: [
      { id: "s1", no: "20240001", name: "张三" },
      { id: "s2", no: "20240002", name: "李四" },
      { id: "s3", no: "20240003", name: "王五" },
      { id: "s4", no: "20240004", name: "赵六" },
      { id: "s5", no: "20240005", name: "钱七" },
      { id: "s10", no: "20240008", name: "孙八" },
      { id: "s11", no: "20240009", name: "周九" },
      { id: "s12", no: "20240010", name: "吴十" },
      { id: "s13", no: "20240011", name: "郑十一" },
      { id: "s14", no: "20240012", name: "冯十二" },
    ],
    cl2: [
      { id: "s6", no: "20240020", name: "陈明" },
      { id: "s7", no: "20240021", name: "刘洋" },
      { id: "s15", no: "20240022", name: "黄蓉" },
      { id: "s16", no: "20240023", name: "林峰" },
      { id: "s17", no: "20240024", name: "何静" },
      { id: "s18", no: "20240025", name: "马超" },
      { id: "s19", no: "20240026", name: "朱婷" },
      { id: "s20", no: "20240027", name: "韩梅" },
    ],
    cl3: [
      { id: "s21", no: "20240030", name: "宋佳" },
      { id: "s22", no: "20240031", name: "唐磊" },
      { id: "s23", no: "20240032", name: "许晴" },
      { id: "s24", no: "20240033", name: "邓超" },
      { id: "s25", no: "20240034", name: "曹原" },
      { id: "s26", no: "20240035", name: "袁野" },
    ],
    cl4: [
      { id: "s8", no: "20240040", name: "周杰" },
      { id: "s27", no: "20240041", name: "吴倩" },
      { id: "s28", no: "20240042", name: "徐亮" },
      { id: "s29", no: "20240043", name: "孙莉" },
      { id: "s30", no: "20240044", name: "胡军" },
      { id: "s31", no: "20240045", name: "高洁" },
    ],
    cl5: [
      { id: "s32", no: "20240050", name: "梁博" },
      { id: "s33", no: "20240051", name: "谢娜" },
      { id: "s34", no: "20240052", name: "罗平" },
      { id: "s35", no: "20240053", name: "蔡琳" },
      { id: "s36", no: "20240054", name: "潘越" },
    ],
    cl6: [
      { id: "s9", no: "20240060", name: "吴磊" },
      { id: "s37", no: "20240061", name: "易建联" },
      { id: "s38", no: "20240062", name: "郭艾伦" },
      { id: "s39", no: "20240063", name: "赵继伟" },
    ],
    cl7: [
      { id: "s40", no: "20240070", name: "王哲林" },
      { id: "s41", no: "20240071", name: "胡明轩" },
      { id: "s42", no: "20240072", name: "徐杰" },
    ],
    cl8: [
      { id: "s43", no: "20240080", name: "刘雯" },
      { id: "s44", no: "20240081", name: "张萌" },
      { id: "s45", no: "20240082", name: "李思" },
      { id: "s46", no: "20240083", name: "王悦" },
      { id: "s47", no: "20240084", name: "陈雪" },
    ],
  },

  evidence: {
    s1: [
      { id: "e1-1", date: "2026-07-06", time: "07:32", durationHours: 1, type: "photo", desc: "晨跑 3km", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e1-2", date: "2026-07-05", time: "07:28", durationHours: 1, type: "photo", desc: "晨跑 3km", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e1-3", date: "2026-07-04", time: "19:10", durationHours: 1, type: "photo", desc: "健身房力量训练", thumb: "健身", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e1-4", date: "2026-07-03", time: "06:50", durationHours: 1, type: "video", desc: "跳绳 15 分钟", thumb: "跳绳", reviewStatus: "rejected", recordStatus: "invalid", invalidReason: "时长不符", notifiedStudent: true },
    ],
    s2: [
      { id: "e2-1", date: "2026-07-06", time: "20:10", durationHours: 1, type: "photo", desc: "游泳练习", thumb: "游泳", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e2-2", date: "2026-07-04", time: "18:00", durationHours: 1, type: "photo", desc: "游泳 800m", thumb: "游泳", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s5: [
      { id: "e5-1", date: "2026-07-06", time: "18:15", durationHours: 2, type: "photo", desc: "篮球训练", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e5-2", date: "2026-07-04", time: "18:00", durationHours: 1, type: "photo", desc: "篮球训练", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s6: [
      { id: "e6-1", date: "2026-07-06", time: "06:45", durationHours: 1, type: "photo", desc: "游泳 1km", thumb: "游泳", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e6-2", date: "2026-07-03", time: "07:00", durationHours: 1, type: "photo", desc: "游泳 800m", thumb: "游泳", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s8: [
      { id: "e8-1", date: "2026-07-06", time: "17:30", durationHours: 1, type: "photo", desc: "羽毛球训练", thumb: "羽毛球", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e8-2", date: "2026-07-05", time: "17:45", durationHours: 2, type: "video", desc: "单打对抗", thumb: "羽毛球", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s9: [{ id: "e9-1", date: "2026-07-06", time: "16:00", durationHours: 2, type: "photo", desc: "队内训练", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true }],
    s11: [{ id: "e11-1", date: "2026-07-06", time: "06:58", durationHours: 1, type: "photo", desc: "校园骑行 5km", thumb: "骑行", reviewStatus: "approved", recordStatus: "valid" }],
    s12: [{ id: "e12-1", date: "2026-07-06", time: "19:20", durationHours: 1, type: "video", desc: "器械训练 45min", thumb: "健身", reviewStatus: "approved", recordStatus: "valid" }],
    s13: [{ id: "e13-1", date: "2026-07-06", time: "19:45", durationHours: 1, type: "photo", desc: "羽毛球练习", thumb: "羽毛球", reviewStatus: "approved", recordStatus: "valid" }],
    s14: [{ id: "e14-1", date: "2026-07-06", time: "07:05", durationHours: 1, type: "photo", desc: "操场慢跑", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" }],
    s15: [{ id: "e15-1", date: "2026-07-06", time: "17:40", durationHours: 1, type: "photo", desc: "瑜伽练习", thumb: "瑜伽", reviewStatus: "approved", recordStatus: "valid" }],
    s19: [{ id: "e19-1", date: "2026-07-06", time: "18:50", durationHours: 2, type: "photo", desc: "排球训练", thumb: "排球", reviewStatus: "approved", recordStatus: "valid" }],
    s21: [{ id: "e21-1", date: "2026-07-06", time: "07:22", durationHours: 1, type: "photo", desc: "晨跑 2km", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" }],
    s26: [{ id: "e26-1", date: "2026-07-06", time: "19:30", durationHours: 1, type: "photo", desc: "投篮练习", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid" }],
    s37: [
      { id: "e37-1", date: "2026-07-06", time: "15:30", durationHours: 2, type: "video", desc: "战术演练", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true },
      { id: "e37-2", date: "2026-07-05", time: "16:00", durationHours: 2, type: "photo", desc: "分组对抗", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true },
    ],
    s43: [{ id: "e43-1", date: "2026-07-06", time: "07:15", durationHours: 1, type: "photo", desc: "早操排练", thumb: "健美操", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true }],
    s16: [
      { id: "e16-1", date: "2026-07-06", time: "07:18", durationHours: 1, type: "photo", desc: "晨跑", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e16-2", date: "2026-07-04", time: "07:25", durationHours: 1, type: "photo", desc: "晨跑 2.5km", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s24: [{ id: "e24-1", date: "2026-07-06", time: "06:40", durationHours: 1, type: "video", desc: "跳绳 20min", thumb: "跳绳", reviewStatus: "approved", recordStatus: "valid" }],
    s31: [
      { id: "e31-1", date: "2026-07-06", time: "06:55", durationHours: 1, type: "photo", desc: "骑行打卡", thumb: "骑行", reviewStatus: "approved", recordStatus: "valid" },
      { id: "e31-2", date: "2026-07-05", time: "18:10", durationHours: 2, type: "photo", desc: "夜骑 8km", thumb: "骑行", reviewStatus: "approved", recordStatus: "valid" },
    ],
    s35: [{ id: "e35-1", date: "2026-07-06", time: "19:00", durationHours: 1, type: "photo", desc: "游泳 800m", thumb: "游泳", reviewStatus: "approved", recordStatus: "valid" }],
    s40: [{ id: "e40-1", date: "2026-07-06", time: "16:10", durationHours: 2, type: "video", desc: "内线训练", thumb: "篮球", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true }],
    s44: [
      { id: "e44-1", date: "2026-07-06", time: "18:30", durationHours: 1, type: "photo", desc: "套路练习", thumb: "健美操", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true },
      { id: "e44-2", date: "2026-07-03", time: "18:45", durationHours: 2, type: "video", desc: "完整套路录制", thumb: "健美操", reviewStatus: "approved", recordStatus: "valid", isSpecialty: true },
    ],
    s7: [{ id: "e7-1", date: "2026-07-06", time: "21:00", durationHours: 1, type: "photo", desc: "夜跑 3km", thumb: "跑步", reviewStatus: "approved", recordStatus: "valid" }],
    s10: [],
  },

  checkinSettings: {
    semesterHoursRequired: 20,
    courseHoursRequired: 10,
    generalHoursRequired: 10,
    specialtyHoursRequired: 0,
    requireTeacherReview: false,
    startsAt: "2026-03-01T00:00:00+08:00",
    endsAt: "2026-06-30T23:59:00+08:00",
    windowStart: "06:00",
    windowEnd: "22:00",
    dailyWindowStart: "06:00",
    dailyWindowEnd: "22:00",
    recordCount: 48,
    gpsEnabled: false,
    gpsRadius: 500,
  },

  courseCheckinSettings: {},

  settingsHistory: [
    { at: "2026-07-06 10:20", by: "张老师", change: "体育（一）课程运动 8h → 10h，自主运动 10h（合计 20h）" },
    { at: "2026-07-01 14:30", by: "张老师", change: "篮球专项 打卡截止日调整为 2026-06-30" },
    { at: "2026-06-28 09:15", by: "张老师", change: "篮球专项 开启 GPS 验证（500m）" },
    { at: "2026-06-25 16:40", by: "张老师", change: "体育（二）关闭 GPS 验证" },
    { at: "2026-06-20 11:00", by: "李主任", change: "体育（一）每日时段 06:30 → 06:00–22:00" },
  ],

  applications: {
    exempt_test: [
      { id: "a1", student: "王五", no: "20240003", type: "伤病", status: "pending", date: "2026-07-04", expire: "2026-09-30", attachments: [{ type: "photo", name: "医院诊断证明", thumb: "诊断书" }, { type: "photo", name: "病历摘要", thumb: "病历" }] },
      { id: "a2", student: "孙八", no: "20240008", type: "校队", status: "reviewing", date: "2026-07-03", expire: "长期", attachments: [{ type: "photo", name: "校队队员证明", thumb: "校队证" }, { type: "photo", name: "训练赛程表", thumb: "赛程" }] },
      { id: "a3", student: "何静", no: "20240023", type: "伤病", status: "pending", date: "2026-07-05", expire: "2026-08-31", attachments: [{ type: "photo", name: "康复科诊断", thumb: "诊断书" }] },
      { id: "a4", student: "胡军", no: "20240044", type: "伤病", status: "approved", date: "2026-06-28", expire: "2026-07-31", attachments: [{ type: "photo", name: "诊断证明", thumb: "诊断书" }] },
      { id: "a5", student: "吴磊", no: "20240060", type: "校队", status: "approved", date: "2026-06-01", expire: "长期", attachments: [{ type: "photo", name: "校队名单", thumb: "名单" }] },
      { id: "a6", student: "陈雪", no: "20240084", type: "伤病", status: "rejected", date: "2026-07-02", expire: "—", attachments: [{ type: "photo", name: "提交材料", thumb: "材料" }] },
    ],
    exempt_exam: [
      { id: "c1", student: "赵六", no: "20240004", type: "伤病", reason: "膝伤，医嘱建议期末免参加剧烈运动类考核", date: "2026-07-04", status: "pending", attachments: [{ type: "photo", name: "医嘱单", thumb: "医嘱" }, { type: "photo", name: "MRI 报告", thumb: "MRI" }] },
      { id: "c2", student: "周杰", no: "20240040", type: "校队", reason: "全国大学生锦标赛与期末考试时间冲突", date: "2026-06-20", status: "approved", attachments: [{ type: "photo", name: "赛事邀请函", thumb: "邀请函" }] },
      { id: "c3", student: "马超", no: "20240025", type: "伤病", reason: "脚踝扭伤恢复期", date: "2026-07-05", status: "pending", attachments: [{ type: "photo", name: "门诊记录", thumb: "门诊" }] },
      { id: "c4", student: "曹原", no: "20240034", type: "其他", reason: "已修读同类课程，申请期末免考", date: "2026-07-02", status: "reviewing", attachments: [{ type: "photo", name: "成绩单", thumb: "成绩单" }, { type: "photo", name: "课程修读证明", thumb: "证明" }] },
      { id: "c5", student: "潘越", no: "20240054", type: "校队", reason: "游泳锦标赛与期末冲突", date: "2026-06-15", status: "approved", attachments: [{ type: "photo", name: "比赛通知", thumb: "通知" }] },
      { id: "c6", student: "徐杰", no: "20240072", type: "伤病", reason: "证明材料不完整", date: "2026-07-01", status: "rejected", attachments: [{ type: "photo", name: "不完整材料", thumb: "材料" }] },
    ],
  },

  semesters: ["2025-2026-1", "2024-2025-2", "2024-2025-1"],

  /** 当前教师授课范围（演示：张老师） */
  teacherAssignments: {
    t001: { courseIds: ["c1", "c3"] },
  },

  /** 体测项目 — 固定国标，不可自定义 */
  physicalTestConfig: {
    semester: "2025-2026-1",
    items: [
      { key: "height", label: "身高", unit: "cm", type: "body" },
      { key: "weight", label: "体重", unit: "kg", type: "body" },
      { key: "vitalCapacity", label: "肺活量", unit: "ml", type: "score" },
      { key: "run50m", label: "50米跑", unit: "秒", type: "score", lowerBetter: true },
      { key: "sitReach", label: "坐位体前屈", unit: "cm", type: "score" },
      { key: "longJump", label: "立定跳远", unit: "cm", type: "score" },
      { key: "pullUps", label: "引体向上", unit: "次", type: "score", gender: "男" },
      { key: "sitUps", label: "仰卧起坐", unit: "次/分钟", type: "score", gender: "女" },
      { key: "run1000m", label: "1000米跑", unit: "分:秒", type: "score", gender: "男", lowerBetter: true, entryMode: "minsec" },
      { key: "run800m", label: "800米跑", unit: "分:秒", type: "score", gender: "女", lowerBetter: true, entryMode: "minsec" },
    ],
  },

  /** 总评权重 — 按课程分别配置 */
  gradeWeights: {
    courses: {
      default: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c1: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c2: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c3: {
        normal: { regular: 0.5, physical: 0.3, final: 0.2 },
        exemptTest: { regular: 0.65, final: 0.35 },
        exemptExam: { regular: 0.55, physical: 0.45 },
      },
      c4: {
        normal: { regular: 0.45, physical: 0.35, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
    },
  },

  gradeWeightsDefault: {
    courses: {
      default: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c1: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c2: {
        normal: { regular: 0.4, physical: 0.4, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
      c3: {
        normal: { regular: 0.5, physical: 0.3, final: 0.2 },
        exemptTest: { regular: 0.65, final: 0.35 },
        exemptExam: { regular: 0.55, physical: 0.45 },
      },
      c4: {
        normal: { regular: 0.45, physical: 0.35, final: 0.2 },
        exemptTest: { regular: 0.6, final: 0.4 },
        exemptExam: { regular: 0.5, physical: 0.5 },
      },
    },
  },

  /** 期末考核项目 — 按课程自定义 */
  finalExamConfig: {
    semester: "2025-2026-1",
    courses: {
      default: {
        items: [
          { key: "run100m", label: "100米跑", unit: "秒", lowerBetter: true },
          { key: "longJump", label: "立定跳远", unit: "cm" },
          { key: "ballThrow", label: "实心球", unit: "m" },
        ],
      },
      c1: {
        items: [
          { key: "run100m", label: "100米跑", unit: "秒", lowerBetter: true },
          { key: "longJump", label: "立定跳远", unit: "cm" },
          { key: "ballThrow", label: "实心球", unit: "m" },
        ],
      },
      c3: {
        items: [
          { key: "shooting", label: "1分钟投篮", unit: "次" },
          { key: "dribbleLayup", label: "运球上篮", unit: "秒", lowerBetter: true },
          { key: "scrimmage", label: "实战评估", unit: "分" },
        ],
      },
      c4: {
        items: [
          { key: "routine", label: "规定套路", unit: "分" },
          { key: "flexibility", label: "柔韧展示", unit: "分" },
          { key: "teamForm", label: "队形编排", unit: "分" },
        ],
      },
    },
  },

  finalExamConfigDefault: {
    semester: "2025-2026-1",
    courses: {
      default: {
        items: [
          { key: "run100m", label: "100米跑", unit: "秒", lowerBetter: true },
          { key: "longJump", label: "立定跳远", unit: "cm" },
          { key: "ballThrow", label: "实心球", unit: "m" },
        ],
      },
      c3: {
        items: [
          { key: "shooting", label: "1分钟投篮", unit: "次" },
          { key: "dribbleLayup", label: "运球上篮", unit: "秒", lowerBetter: true },
          { key: "scrimmage", label: "实战评估", unit: "分" },
        ],
      },
      c4: {
        items: [
          { key: "routine", label: "规定套路", unit: "分" },
          { key: "flexibility", label: "柔韧展示", unit: "分" },
          { key: "teamForm", label: "队形编排", unit: "分" },
        ],
      },
    },
  },

  finalExams: [
    { studentId: "s1", classId: "cl1", scores: { run100m: 14.2, longJump: 240, ballThrow: 8.5 }, totalScore: 80, entryStatus: "submitted" },
    { studentId: "s2", classId: "cl1", scores: { run100m: 15.8, longJump: 185, ballThrow: 7.2 }, totalScore: 72, entryStatus: "submitted" },
    { studentId: "s5", classId: "cl1", scores: { run100m: 13.8, longJump: 255, ballThrow: 9.0 }, totalScore: 85, entryStatus: "submitted" },
    { studentId: "s6", classId: "cl2", scores: { run100m: 14.0, longJump: 250, ballThrow: 8.8 }, totalScore: 88, entryStatus: "submitted" },
    { studentId: "s21", classId: "cl3", scores: { run100m: 15.2, longJump: 195, ballThrow: 7.8 }, totalScore: 90, entryStatus: "submitted" },
    { studentId: "s8", classId: "cl4", entryStatus: "exempt", exemptReason: "免考（已通过）" },
    { studentId: "s32", classId: "cl5", scores: { run100m: 14.5, longJump: 235, ballThrow: 8.0 }, totalScore: 78, entryStatus: "submitted" },
    { studentId: "s37", classId: "cl6", scores: { shooting: 18, dribbleLayup: 12.5, scrimmage: 85 }, totalScore: 88, entryStatus: "submitted" },
    { studentId: "s43", classId: "cl8", scores: { routine: 88, flexibility: 90, teamForm: 86 }, totalScore: 92, entryStatus: "submitted" },
    { studentId: "s15", classId: "cl2", scores: { run100m: 16.0, longJump: 180 }, totalScore: null, entryStatus: "draft" },
  ],

  physicalTests: [
    { studentId: "s1", no: "20240001", name: "张三", classId: "cl1", age: 20, gender: "男", height: 175, weight: 68, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 4200, run50m: 7.2, sitReach: 18, longJump: 250, pullUps: 12, run1000m: 245 }, convertedScores: { run1000m: 78 }, totalScore: 78 },
    { studentId: "s2", no: "20240002", name: "李四", classId: "cl1", age: 19, gender: "女", height: 162, weight: 52, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 2800, run50m: 8.5, sitReach: 22, longJump: 185, sitUps: 42, run800m: 215 }, convertedScores: { run800m: 76 }, totalScore: 76 },
    { studentId: "s3", no: "20240003", name: "王五", classId: "cl1", age: 20, gender: "男", height: 178, weight: 72, matched: false, note: "年龄字段待核对", entryStatus: "exempt", exemptReason: "伤病免测（审核中）" },
    { studentId: "s5", no: "20240005", name: "钱七", classId: "cl1", age: 21, gender: "男", height: 180, weight: 75, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 4500, run50m: 6.9, sitReach: 20, longJump: 265, pullUps: 15, run1000m: 230 }, convertedScores: { run1000m: 85 }, totalScore: 82 },
    { studentId: "s10", no: "20240008", name: "孙八", classId: "cl1", age: 20, gender: "男", height: 172, weight: 65, matched: true, entryStatus: "exempt", exemptReason: "校队免测（审核中）" },
    { studentId: "s6", no: "20240020", name: "陈明", classId: "cl2", age: 20, gender: "男", height: 176, weight: 70, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 4100, run50m: 7.0, sitReach: 19, longJump: 255, pullUps: 14, run1000m: 238 }, convertedScores: { run1000m: 82 }, totalScore: 85 },
    { studentId: "s15", no: "20240022", name: "黄蓉", classId: "cl2", age: 19, gender: "女", height: 165, weight: 54, matched: true, entryStatus: "draft", scores: { vitalCapacity: 2900, run50m: 8.8, sitReach: 24, longJump: 190 }, totalScore: null },
    { studentId: "s17", no: "20240024", name: "何静", classId: "cl2", age: 18, gender: "女", height: 160, weight: 50, matched: false, note: "性别与标准表不一致", entryStatus: "pending", scores: null, totalScore: null },
    { studentId: "s21", no: "20240030", name: "宋佳", classId: "cl3", age: 20, gender: "女", height: 168, weight: 55, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 3100, run50m: 8.2, sitReach: 26, longJump: 200, sitUps: 48, run800m: 205 }, convertedScores: { run800m: 88 }, totalScore: 88 },
    { studentId: "s8", no: "20240040", name: "周杰", classId: "cl4", age: 21, gender: "男", height: 177, weight: 71, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 4000, run50m: 7.1, sitReach: 17, longJump: 248, pullUps: 11, run1000m: 250 }, convertedScores: { run1000m: 75 }, totalScore: 80 },
    { studentId: "s30", no: "20240044", name: "胡军", classId: "cl4", age: 20, gender: "男", height: 174, weight: 69, matched: true, entryStatus: "exempt", exemptReason: "伤病免测（已通过）" },
    { studentId: "s32", no: "20240050", name: "梁博", classId: "cl5", age: 20, gender: "男", height: 174, weight: 67, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 3900, run50m: 7.3, sitReach: 16, longJump: 240, pullUps: 10, run1000m: 255 }, convertedScores: { run1000m: 72 }, totalScore: 77 },
    { studentId: "s9", no: "20240060", name: "吴磊", classId: "cl6", age: 22, gender: "男", height: 185, weight: 82, matched: true, entryStatus: "exempt", exemptReason: "校队免测（已通过）" },
    { studentId: "s43", no: "20240080", name: "刘雯", classId: "cl8", age: 19, gender: "女", height: 170, weight: 56, matched: true, entryStatus: "submitted", scores: { vitalCapacity: 3200, run50m: 8.0, sitReach: 28, longJump: 210, sitUps: 50, run800m: 198 }, convertedScores: { run800m: 90 }, totalScore: 88 },
    { studentId: "s47", no: "20240084", name: "陈雪", classId: "cl8", age: 20, gender: "女", height: 163, weight: 53, matched: true, entryStatus: "pending", scores: null, totalScore: null },
  ],
};

(function enrichMockMedia(MOCK) {
  function svgDataUri(label, bg) {
    const text = String(label || "证").slice(0, 4);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120">` +
      `<rect width="160" height="120" fill="${bg}"/>` +
      `<text x="80" y="66" text-anchor="middle" fill="#fff" font-size="18" font-family="sans-serif">${text}</text>` +
      `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  const palette = {
    跑步: "#165DFF",
    健身: "#0FC6C2",
    跳绳: "#F77234",
    游泳: "#3491FA",
    篮球: "#F5319D",
    羽毛球: "#00B42A",
    骑行: "#722ED1",
    瑜伽: "#F7BA1E",
    排球: "#D91AD9",
    健美操: "#F53F3F",
    诊断书: "#86909C",
    病历: "#86909C",
    校队证: "#165DFF",
    赛程: "#0FC6C2",
    名单: "#165DFF",
    材料: "#86909C",
    医嘱: "#F77234",
    MRI: "#3491FA",
    邀请函: "#00B42A",
    门诊: "#F77234",
    成绩单: "#165DFF",
    证明: "#00B42A",
    通知: "#3491FA",
  };

  function attachForEvidence(ev, i) {
    const label = ev.thumb || ev.desc || "证据";
    const bg = palette[ev.thumb] || "#4E5969";
    const thumbUrl = svgDataUri(label, bg);
    const originalUrl =
      ev.id === "e2-1"
        ? "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>') + "#forbidden=1"
        : svgDataUri(label + "·原图", bg);
    const kind = ev.type === "video" ? "video" : "image";
    const attachments = [
      {
        id: `${ev.id}-a0`,
        kind,
        thumbUrl,
        originalUrl,
        name: ev.desc || label,
        mime: kind === "video" ? "video/mp4" : "image/svg+xml",
        ...(ev.id === "e2-1" ? { forbidden: true } : {}),
      },
    ];
    if (i === 0 && kind === "image") {
      attachments.push({
        id: `${ev.id}-a1`,
        kind: "image",
        thumbUrl: svgDataUri("附2", "#1D2129"),
        originalUrl: svgDataUri("附2·原图", "#1D2129"),
        name: (ev.desc || label) + "（附）",
        mime: "image/svg+xml",
      });
    }
    return {
      ...ev,
      kind,
      thumbUrl,
      originalUrl,
      evidenceCount: attachments.length,
      attachments,
      thumb: thumbUrl,
    };
  }

  for (const sid of Object.keys(MOCK.evidence || {})) {
    MOCK.evidence[sid] = (MOCK.evidence[sid] || []).map(attachForEvidence);
  }

  function enrichAtt(att) {
    const label = att.thumb || att.name || "材料";
    const bg = palette[att.thumb] || "#86909C";
    const thumbUrl = svgDataUri(label, bg);
    return {
      ...att,
      kind: att.type === "video" ? "video" : "image",
      thumbUrl,
      originalUrl: svgDataUri(label + "·原图", bg),
      thumb: thumbUrl,
      mediaType: att.type,
    };
  }

  for (const key of ["exempt_test", "exempt_exam"]) {
    (MOCK.applications[key] || []).forEach((app) => {
      if (app.attachments) app.attachments = app.attachments.map(enrichAtt);
    });
  }

  let importCounter = 0;
  for (const classId of Object.keys(MOCK.students || {})) {
    MOCK.students[classId] = (MOCK.students[classId] || []).map((s) => ({
      ...s,
      importIndex: s.importIndex != null ? s.importIndex : importCounter++,
    }));
  }
})(window.MOCK);
