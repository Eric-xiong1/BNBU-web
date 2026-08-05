// Mock workspace data replicated 1:1 from core/mock/MockStudentWorkspace.kt.
// Server-owned copy (course titles, notices, feedback…) stays in its original
// language exactly as the Android mock supplies it.

export const MOCK_STUDENT_ID = "2024010836";

function record(id, courseId, title, creditType, hours, submittedAt, sportType, note, feedback, ...files) {
  const proofs = files.map((name, index) => {
    const isVideo = name.toLowerCase().endsWith(".mp4");
    return {
      id: `${id}-proof-${index}`,
      type: isVideo ? "video" : "image",
      fileName: name,
      byteCount: isVideo ? 8_600_000 : 1_240_000,
      durationSeconds: isVideo ? 76 : null,
      source: `mock://proof/${name}`,
    };
  });
  const photoCount = proofs.filter((p) => p.type === "image").length;
  const videoCount = proofs.filter((p) => p.type === "video").length;
  return {
    id, courseId, taskTitle: title, creditType, hours, submittedAt,
    proofSummary: `${photoCount} 张图片${videoCount ? "，1 个短视频" : ""}`,
    proofPhotoCount: photoCount, proofVideoCount: videoCount, proofFiles: proofs,
    teacherPublicFeedback: feedback, teacherInternalNote: null, note, remark: "",
    sportType, startTime: null, endTime: null, actualDurationSeconds: null,
  };
}

export function createMockWorkspace() {
  const student = {
    id: MOCK_STUDENT_ID,
    name: "林若晴",
    email: "ruoqing.lin@bnbu.edu.cn",
    college: "工商与管理学院",
    className: "2024级工商管理1班",
    status: "正常",
    gender: "female",
    gradeLevel: "sophomore",
    admissionYear: 2024,
    currentAcademicYear: "2025-2026 学年",
    gradeCalculatedAt: "2026-07-26 18:00",
    accountStatus: "ACTIVE",
  };
  const badminton = {
    id: "course-badminton-2026-spring", code: "PE2026B12", section: "02",
    name: "大学体育（羽毛球）", semester: "2025-2026 学年第二学期",
    students: 32, pending: 1, completion: 88, missing: 4,
    deadline: "2026-08-02 23:59", teacher: "陈宇航", teacherId: "teacher-chen-yuhang",
    semesterId: "2025-2026-2", academicYear: "2025-2026", term: "第二学期",
    semesterStatus: "current", status: "active", enrollmentStatus: "enrolled",
    isCurrent: true, finalGrade: null, gradeStatus: null,
  };
  const yoga = {
    id: "course-yoga-2026-summer", code: "PE2026S08", section: "01",
    name: "暑期体能与瑜伽", semester: "2025-2026 学年夏季学期",
    students: 28, pending: 0, completion: 64, missing: 10,
    deadline: "2026-08-16 23:59", teacher: "周思敏", teacherId: "teacher-zhou-simin",
    semesterId: "2025-2026-summer", academicYear: "2025-2026", term: "夏季学期",
    semesterStatus: "current", status: "active", enrollmentStatus: "enrolled",
    isCurrent: true, finalGrade: null, gradeStatus: null,
  };
  const records = [
    record("record-20260725-yoga", yoga.id, "柔韧与核心训练记录", "course", 2.0, "2026-07-25 19:42", "瑜伽", "完成 40 分钟核心与拉伸训练。", "已收到，等待教师审核。", "yoga_core_01.jpg", "yoga_core_02.jpg"),
    record("record-20260722-run", null, "自主运动打卡", "general", 2.0, "2026-07-22 07:18", "跑步", "晨跑 5 公里，配速 6 分 12 秒。", "记录有效，已计入其他运动时长。", "run_track.jpg", "run_5km.mp4"),
    record("record-20260718-badminton", badminton.id, "羽毛球专项练习打卡", "course", 2.0, "2026-07-18 20:05", "羽毛球", "完成高远球、吊球及步法练习。", "动作练习和场地信息完整，已通过。", "badminton_01.jpg", "badminton_02.jpg"),
    record("record-20260712-cycle", null, "自主运动打卡", "general", 2.0, "2026-07-12 17:36", "骑行", "骑行 18 公里。", "已计入其他运动时长。", "cycling_route.jpg"),
    record("record-20260708-strength", null, "自主运动打卡", "general", 2.0, "2026-07-08 18:15", "力量训练", "完成器械力量训练与拉伸。", "已通过。", "strength_01.jpg", "strength_02.jpg"),
    record("record-20260703-badminton", badminton.id, "羽毛球专项练习打卡", "course", 2.0, "2026-07-03 19:30", "羽毛球", "双打配合与发接发练习。", "已通过。", "badminton_03.jpg"),
    record("record-20260629-swim", null, "自主运动打卡", "general", 2.0, "2026-06-29 15:50", "游泳", "游泳 1,200 米。", "已通过。", "swimming_01.jpg"),
    record("record-20260626-badminton", badminton.id, "羽毛球专项练习打卡", "course", 2.0, "2026-06-26 19:15", "羽毛球", "完成杀球与防守转换练习。", "已通过。", "badminton_04.jpg", "badminton_05.jpg"),
  ];
  const membership = {
    id: "membership-school-badminton-team", type: "team", organization: "北师港浸大羽毛球队",
    studentId: MOCK_STUDENT_ID, studentName: student.name, status: "有效", validUntil: "2026-08-31",
    offset: "课程相关时长抵扣 2 小时", comment: "2026 春季学期校队训练证明已核验。",
    updatedBy: "体育部管理员", updatedAt: "2026-07-10 09:20",
  };
  return {
    student,
    courses: [badminton, yoga],
    progress: {
      id: MOCK_STUDENT_ID, name: student.name, college: student.college, className: student.className,
      course: 8.0, general: 8.0, rawCourse: 6.0, rawGeneral: 8.0,
      exam: 24, attendance: 18, physical: 8, status: "进行中",
      source: "Mock 用户数据 · 2026-07-26 汇总", organizationCredit: membership,
    },
    hourRule: { total: 20.0, courseRequired: 10.0, generalRequired: 10.0, dailyLimit: 2.0 },
    records,
    grades: {
      studentId: MOCK_STUDENT_ID,
      studentName: student.name,
      visibleBlocks: [
        {
          id: "physical", name: "1000米/800米 跑步", weight: 0.5, score: 86, scoreDisplay: "86",
          isVisible: true, displayOrder: 10, blockType: "physical_test",
          description: "本学期耐力跑测试成绩。", subItems: null,
        },
        {
          id: "checkin", name: "打卡成绩", weight: 0.5, score: 88, scoreDisplay: "88",
          isVisible: true, displayOrder: 20, blockType: "checkin",
          description: "有效打卡与组织认证学时。",
          subItems: [
            { name: "课程相关运动", score: 90, scoreDisplay: "90" },
            { name: "组织认证", score: 80, scoreDisplay: "80" },
          ],
        },
      ],
      totalScore: 86, totalDisplay: "86", isPassed: true,
      courseGradeStatus: "in_progress", displayConfigVersion: 1,
      sourceTrace: "打卡 16/20 小时；理论测验、课堂出勤及体测成绩已同步。",
      enduranceRunTimeSeconds: 252, enduranceRunStatus: "recorded", enduranceRunScore: null,
    },
    memberships: [membership],
    notices: [
      { id: "notice-course-deadline", title: "羽毛球课程打卡截止提醒", message: "课程相关运动时长还差 2 小时，请在 8 月 2 日 23:59 前完成并提交凭证。", time: "今天 09:00", category: "deadline", isUnread: true, targetType: null, targetId: null },
      { id: "notice-yoga-review", title: "柔韧与核心训练记录已提交", message: "你于 7 月 25 日提交的 2 小时课程打卡已保存，可在打卡记录中查看状态。", time: "7 月 25 日 19:44", category: "review", isUnread: true, targetType: null, targetId: null },
      { id: "notice-team-credit", title: "校队训练时长已抵扣", message: "北师港浸大羽毛球队训练证明已核验，已抵扣课程相关运动时长 2 小时。", time: "7 月 10 日 09:20", category: "organization", isUnread: false, targetType: null, targetId: null },
    ],
    teachers: [
      { teacherId: badminton.teacherId, teacherName: badminton.teacher },
      { teacherId: yoga.teacherId, teacherName: yoga.teacher },
    ],
    exemptions: [
      {
        id: "exemption-800m-2026", studentId: MOCK_STUDENT_ID, studentName: student.name,
        type: "800m", category: "physical_test", organization: "",
        reason: "因踝关节扭伤申请本学期 800 米测试缓测。", status: "审核中",
        proofFiles: ["mock://proof/medical_note.pdf"],
        reviewComment: "已收到校医院证明，正在审核。", reviewerId: "", reviewerName: "体育部教务组",
        createdAt: "2026-07-21 11:05", updatedAt: "2026-07-21 11:20",
      },
    ],
    // Mock sessions do not have a backend policy endpoint; keep check-in usable.
    checkInTimeWindow: {
      windowMode: "semester_wide", dateRangeStart: null, dateRangeEnd: null,
      dailyStartTime: "00:00", dailyEndTime: "23:59", excludedDates: [], semesterDeadline: null,
    },
    courseJoinRequest: null,
  };
}

export function emptyWorkspace() {
  return {
    student: { id: "", name: "", email: "", college: "", className: "", status: "未登录", gender: "", gradeLevel: "", admissionYear: null, currentAcademicYear: "", gradeCalculatedAt: "", accountStatus: "ACTIVE" },
    courses: [],
    progress: { id: "", name: "", college: "", className: "", course: 0, general: 0, rawCourse: 0, rawGeneral: 0, exam: 0, attendance: 0, physical: 0, status: "请先登录", source: "empty", organizationCredit: null },
    hourRule: { total: 20.0, courseRequired: 10.0, generalRequired: 10.0, dailyLimit: 2.0 },
    records: [],
    grades: { studentId: "", studentName: "", visibleBlocks: [], totalScore: null, totalDisplay: "未开放", isPassed: null, courseGradeStatus: "rules_not_published", displayConfigVersion: 0, sourceTrace: "", enduranceRunTimeSeconds: null, enduranceRunStatus: "not_recorded", enduranceRunScore: null },
    memberships: [],
    notices: [],
    teachers: [],
    exemptions: [],
    checkInTimeWindow: { windowMode: "unavailable", dateRangeStart: null, dateRangeEnd: null, dailyStartTime: "", dailyEndTime: "", excludedDates: [], semesterDeadline: null },
    courseJoinRequest: null,
  };
}

/** Course invite lookup shared by QR scan and manual code entry (§7.2). */
export const MOCK_INVITES = {
  "BNBU-7K3P9Q": {
    name: "大学体育（羽毛球）", courseNumber: "PE2026B12", section: "02",
    teacher: "陈宇航", semester: "2025-2026 学年第二学期",
  },
  "BNBU-4M8X2T": {
    name: "暑期体能与瑜伽", courseNumber: "PE2026S08", section: "01",
    teacher: "周思敏", semester: "2025-2026 学年夏季学期",
  },
  // Revoked/expired invite → JoinRequestStatus inviteUnavailable branch.
  "BNBU-EXPIRED": null,
};

export function hourText(value) {
  const n = Number(value) || 0;
  return n % 1 === 0 ? `${n}h` : `${n.toFixed(1)}h`;
}
