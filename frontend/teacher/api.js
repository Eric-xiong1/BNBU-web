/**
 * BNBU Sports Web API 接口层
 * 当前返回 mock 数据；对接后端时将 fetch 指向真实 endpoint
 *
 * 打卡规则（v3）：提交后默认有效并即时计入学时；教师可标无效 / 恢复 / 修正学时（0/1/2h）；
 * 学期目标 = 课程运动 + 自主其他运动（默认各 10h，合计 20h）。无「审核通过才计入」。
 */
(function (global) {
  const BASE = "/api/v1";

  function delay(data, ms = 120) {
    return new Promise((resolve) => setTimeout(() => resolve(data), ms));
  }

  /** 计入学时仅允许 0 / 1 / 2 */
  function clampCreditHours(h) {
    const n = Number(h);
    if (!Number.isFinite(n) || n < 1) return 0;
    if (n < 2) return 1;
    return 2;
  }

  function isRecordValid(e) {
    if (e.recordStatus === "invalid" || e.reviewStatus === "rejected") return false;
    return true;
  }

  function migrateRecordStatus(e) {
    if (e.recordStatus === "valid" || e.recordStatus === "invalid") return e.recordStatus;
    if (e.reviewStatus === "rejected") return "invalid";
    return "valid";
  }

  function getCourse(courseId) {
    return MOCK.courses.find((c) => c.id === courseId);
  }

  function getClass(classId) {
    return MOCK.classes.find((c) => c.id === classId);
  }

  function getCourseForClass(classId) {
    const cls = getClass(classId);
    return cls ? getCourse(cls.courseId) : null;
  }

  /** 班级展示：课程名 + 班级号，如「体育（一）2401」 */
  function formatClassLabel(cls) {
    const course = getCourse(cls.courseId);
    return `${course ? course.name : ""}${cls.classNo}`;
  }

  function enrichClass(cls) {
    const course = getCourse(cls.courseId);
    return { ...cls, name: formatClassLabel(cls), isSpecialty: !!course?.isSpecialty };
  }

  function normalizeAttachment(raw, fallbackId) {
    if (!raw) return null;
    if (typeof raw === "string") {
      return {
        id: fallbackId,
        kind: "image",
        thumbUrl: raw,
        originalUrl: raw,
        name: "",
      };
    }
    const kind =
      raw.kind ||
      (raw.type === "video" || raw.mediaType === "video" ? "video" : "image");
    const thumbUrl = raw.thumbUrl || raw.thumb || raw.url || "";
    const originalUrl = raw.originalUrl || raw.url || thumbUrl;
    return {
      id: raw.id || fallbackId,
      kind,
      thumbUrl,
      originalUrl,
      name: raw.name || raw.desc || "",
      mime: raw.mime,
      forbidden: raw.forbidden,
    };
  }

  function normalizeEvidence(raw, studentId, classId) {
    const course = getCourseForClass(classId);
    const defaultSpecialty = !!course?.isSpecialty;
    return (raw || []).map((e, i) => {
      const id = e.id || `${studentId}-e${i}`;
      let attachments = Array.isArray(e.attachments)
        ? e.attachments.map((a, j) => normalizeAttachment(a, `${id}-a${j}`)).filter(Boolean)
        : [];
      if (!attachments.length && (e.thumbUrl || e.thumb || e.originalUrl)) {
        attachments = [
          normalizeAttachment(
            {
              kind: e.kind || e.type,
              thumbUrl: e.thumbUrl || e.thumb,
              originalUrl: e.originalUrl || e.url,
              name: e.desc,
              type: e.type,
            },
            `${id}-a0`
          ),
        ].filter(Boolean);
      }
      const kind = e.kind || (e.type === "video" ? "video" : "image");
      const recordStatus = migrateRecordStatus(e);
      const durationHours = clampCreditHours(e.durationHours ?? 1);
      return {
        ...e,
        id,
        kind,
        type: e.type || (kind === "video" ? "video" : "photo"),
        durationHours,
        recordStatus,
        reviewStatus: recordStatus === "invalid" ? "rejected" : "approved",
        isSpecialty: e.isSpecialty ?? defaultSpecialty,
        creditType: e.creditType || (e.isSpecialty ? "course" : e.creditType) || "general",
        attachments,
        evidenceCount: e.evidenceCount ?? attachments.length,
        thumbUrl: e.thumbUrl || attachments[0]?.thumbUrl || e.thumb || "",
        originalUrl: e.originalUrl || attachments[0]?.originalUrl || "",
        thumb: e.thumbUrl || attachments[0]?.thumbUrl || e.thumb || "",
        invalidReason: e.invalidReason || "",
        notifiedStudent: e.notifiedStudent !== false,
      };
    });
  }

  function getStudentEvidenceList(studentId, classId) {
    const cls = classId || findClassIdByStudent(studentId);
    return normalizeEvidence(MOCK.evidence[studentId] || [], studentId, cls);
  }

  function findClassIdByStudent(studentId) {
    for (const [classId, list] of Object.entries(MOCK.students)) {
      if (list.some((s) => s.id === studentId)) return classId;
    }
    return null;
  }

  function computeHours(studentId, classId) {
    const items = getStudentEvidenceList(studentId, classId);
    const valid = items.filter(isRecordValid);
    const invalid = items.filter((e) => !isRecordValid(e));
    const courseHours = valid
      .filter((e) => e.creditType === "course" || e.isSpecialty)
      .reduce((s, e) => s + e.durationHours, 0);
    const generalHours = valid
      .filter((e) => e.creditType !== "course" && !e.isSpecialty)
      .reduce((s, e) => s + e.durationHours, 0);
    return {
      approvedHours: valid.reduce((s, e) => s + e.durationHours, 0),
      pendingHours: 0,
      invalidCount: invalid.length,
      courseHours,
      generalHours,
      specialtyHours: courseHours,
    };
  }

  function enrichStudent(s, classId, date) {
    const cls = getClass(classId);
    const course = cls ? getCourse(cls.courseId) : null;
    const classLabel = cls ? formatClassLabel(cls) : "";
    const settings = getSettingsForCourse(cls?.courseId);
    const hours = computeHours(s.id, classId);
    const items = getStudentEvidenceList(s.id, classId);
    const todayItems = date ? items.filter((e) => e.date === date) : [];
    const todayItem = todayItems[todayItems.length - 1];
    const todayValid = todayItem ? isRecordValid(todayItem) : null;

    return {
      ...s,
      classLabel,
      ...hours,
      semesterRequired: settings.semesterHoursRequired,
      courseHoursRequired: settings.courseHoursRequired,
      generalHoursRequired: settings.generalHoursRequired,
      specialtyRequired: null,
      isSpecialtyCourse: !!course?.isSpecialty,
      todayReview: todayItem ? (todayValid ? "approved" : "rejected") : null,
      todayRecordStatus: todayItem ? todayItem.recordStatus : null,
      todayDuration: todayItem?.durationHours ?? null,
      todaySubmitted: !!todayItem,
      todayEvidenceId: todayItem?.id || null,
      time: todayItem?.time || "-",
      importIndex: s.importIndex,
      photo: todayItem
        ? {
            thumb: todayItem.thumbUrl || todayItem.thumb,
            thumbUrl: todayItem.thumbUrl || todayItem.thumb,
            originalUrl: todayItem.originalUrl,
            desc: todayItem.desc,
            url: null,
            type: todayItem.type,
            attachments: todayItem.attachments,
            evidenceCount: todayItem.evidenceCount,
          }
        : null,
    };
  }

  function getSettingsForCourse(courseId) {
    const base = MOCK.checkinSettings || {};
    const perCourse = (courseId && MOCK.courseCheckinSettings?.[courseId]) || {};
    const courseHoursRequired = Number(perCourse.courseHoursRequired ?? base.courseHoursRequired ?? 10);
    const generalHoursRequired = Number(perCourse.generalHoursRequired ?? base.generalHoursRequired ?? 10);
    return {
      ...base,
      ...perCourse,
      courseHoursRequired,
      generalHoursRequired,
      semesterHoursRequired: courseHoursRequired + generalHoursRequired,
      requireTeacherReview: false,
    };
  }

  /** 同日有效学时合计（不含指定记录时可传入 excludeId） */
  function dayValidHours(studentId, date, excludeId) {
    return getStudentEvidenceList(studentId)
      .filter((e) => e.date === date && e.id !== excludeId && isRecordValid(e))
      .reduce((s, e) => s + e.durationHours, 0);
  }

  function formatMinSec(totalSeconds) {
    if (totalSeconds == null || totalSeconds === "") return "";
    const sec = Number(totalSeconds);
    if (!Number.isFinite(sec) || sec < 0) return "";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}′${String(s).padStart(2, "0")}″`;
  }

  /** MOCK 模拟服务端换算：非正式规则，仅演示 convertedScore 回包 */
  function mockConvertEndurance(rawSeconds) {
    const sec = Number(rawSeconds);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    const score = Math.max(0, Math.min(100, Math.round(100 - (sec - 180) * 0.2)));
    return score;
  }

  function enduranceFieldsFromPhysical(record) {
    if (!record?.scores) {
      return { enduranceRawDisplay: null, endurancePercent: null, enduranceRawSeconds: null };
    }
    const key = record.scores.run1000m != null ? "run1000m" : record.scores.run800m != null ? "run800m" : null;
    if (!key) return { enduranceRawDisplay: null, endurancePercent: null, enduranceRawSeconds: null };
    const raw = record.scores[key];
    const converted =
      record.convertedScores?.[key] ??
      record.convertedScore ??
      null;
    return {
      enduranceRawSeconds: raw,
      enduranceRawDisplay: formatMinSec(raw),
      endurancePercent: converted,
    };
  }

  function computeClassStats(classId, date) {
    const settings = getSettingsForCourse(getClass(classId)?.courseId);
    const required = settings.semesterHoursRequired;
    const students = MOCK.students[classId] || [];
    let invalidCount = 0;
    let onTrack = 0;
    let behind = 0;
    let progressSum = 0;

    for (const s of students) {
      const enriched = enrichStudent(s, classId, date);
      invalidCount += enriched.invalidCount || 0;
      const progress = required ? enriched.approvedHours / required : 0;
      progressSum += progress;
      if (progress >= 0.7) onTrack++;
      else if (progress < 0.5) behind++;
    }

    return {
      pendingReview: 0,
      invalidCount,
      onTrack,
      behind,
      avgProgress: students.length ? progressSum / students.length : 0,
    };
  }

  /** 打卡审查列表：展示近期记录（默认有效 + 已标无效），不再只列「待审核」 */
  function collectReviewCheckins() {
    const rows = [];
    for (const [classId, students] of Object.entries(MOCK.students)) {
      const classLabel = formatClassLabel(getClass(classId));
      for (const s of students) {
        const items = getStudentEvidenceList(s.id, classId);
        for (const ev of items) {
          rows.push({
            ...ev,
            studentId: s.id,
            studentName: s.name,
            no: s.no,
            classId,
            classLabel,
          });
        }
      }
    }
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.time).localeCompare(String(a.time)));
    return rows;
  }

  function collectPendingCheckins() {
    return collectReviewCheckins();
  }

  function countPendingApplications(type) {
    return (MOCK.applications[type] || []).filter((a) => a.status === "pending" || a.status === "reviewing").length;
  }

  function getTeacherCourseIds() {
    const role = MOCK.currentUser.role;
    if (role === "dept_head" || role === "super_admin") {
      return MOCK.courses.map((c) => c.id);
    }
    const userId = MOCK.currentUser.id;
    return MOCK.teacherAssignments[userId]?.courseIds || MOCK.courses.map((c) => c.id);
  }

  function getExemptApplication(no, type) {
    return (MOCK.applications[type] || []).find((a) => a.no === no);
  }

  function isApplicationPending(status) {
    return status === "pending" || status === "reviewing";
  }

  function sumWeightGroup(group) {
    return Object.values(group).reduce((s, v) => s + v, 0);
  }

  function normalizeGradeWeights(weights) {
    const normalized = JSON.parse(JSON.stringify(weights));
    for (const key of ["normal", "exemptTest", "exemptExam"]) {
      const group = normalized[key];
      const sum = sumWeightGroup(group);
      if (sum > 0 && Math.abs(sum - 1) > 0.001) {
        for (const k of Object.keys(group)) group[k] = group[k] / sum;
      }
    }
    return normalized;
  }

  function computeRegularScore(studentId, classId) {
    const students = MOCK.students[classId] || [];
    const s = students.find((st) => st.id === studentId);
    if (!s) return 0;
    const enriched = enrichStudent(s, classId, "");
    const ratio = enriched.semesterRequired ? enriched.approvedHours / enriched.semesterRequired : 0;
    return Math.min(100, Math.round(ratio * 100));
  }

  function getGradeWeightsForCourse(courseId) {
    const courses = MOCK.gradeWeights.courses;
    return courses[courseId] || courses.default;
  }

  function formatGradeFormula(weights, exemptTestStatus, exemptExamStatus) {
    if (exemptTestStatus === "approved") {
      return `免测：平时×${Math.round(weights.exemptTest.regular * 100)}% + 期末×${Math.round(weights.exemptTest.final * 100)}%`;
    }
    if (exemptExamStatus === "approved") {
      return `免考：平时×${Math.round(weights.exemptExam.regular * 100)}% + 体测×${Math.round(weights.exemptExam.physical * 100)}%`;
    }
    return `平时×${Math.round(weights.normal.regular * 100)}% + 体测×${Math.round(weights.normal.physical * 100)}% + 期末×${Math.round(weights.normal.final * 100)}%`;
  }

  function computeTotalGrade(regular, physical, final, exemptTestStatus, exemptExamStatus, courseId) {
    const w = getGradeWeightsForCourse(courseId);
    if (exemptTestStatus === "approved") {
      return Math.round(regular * w.exemptTest.regular + (final || 0) * w.exemptTest.final);
    }
    if (exemptExamStatus === "approved") {
      return Math.round(regular * w.exemptExam.regular + (physical || 0) * w.exemptExam.physical);
    }
    return Math.round(regular * w.normal.regular + (physical || 0) * w.normal.physical + (final || 0) * w.normal.final);
  }

  function getFinalExamItems(courseId) {
    const courses = MOCK.finalExamConfig.courses;
    return (courses[courseId] || courses.default).items;
  }

  function getFinalExamRecord(studentId) {
    return MOCK.finalExams.find((r) => r.studentId === studentId);
  }

  function getFinalExamScore(studentId, classId) {
    const record = getFinalExamRecord(studentId);
    if (!record) return null;
    if (record.entryStatus === "exempt") return "免考";
    return record.totalScore;
  }

  function enrichFinalExamRecord(record, student, classId) {
    const cls = getClass(classId);
    const course = cls ? getCourse(cls.courseId) : null;
    const classLabel = cls ? formatClassLabel(cls) : "";
    const courseId = cls?.courseId;
    const items = getFinalExamItems(courseId);
    const exemptExam = getExemptApplication(student.no, "exempt_exam");
    const enteredCount = record.scores ? items.filter((item) => record.scores[item.key] != null).length : 0;

    let entryStatus = record.entryStatus || "pending";
    if (exemptExam?.status === "approved") {
      entryStatus = "exempt";
    }

    return {
      ...record,
      studentId: student.id,
      no: student.no,
      name: student.name,
      classId,
      classLabel,
      courseId,
      courseName: course?.name || "",
      itemsTotal: items.length,
      itemsEntered: enteredCount,
      exemptExamStatus: exemptExam?.status || null,
      entryStatus,
      exemptReason: record.exemptReason || (exemptExam?.status === "approved" ? "免考（已通过）" : null),
    };
  }

  function listFinalExamRows(params = {}) {
    const { classId, courseId, status, q } = params;
    let courseIds = courseId ? [courseId] : getTeacherCourseIds();
    let classIds = MOCK.classes.filter((c) => courseIds.includes(c.courseId)).map((c) => c.id);
    if (classId) classIds = classIds.filter((id) => id === classId);

    const recordMap = new Map(MOCK.finalExams.map((r) => [r.studentId, r]));
    const rows = [];

    for (const cid of classIds) {
      for (const s of MOCK.students[cid] || []) {
        const base = recordMap.get(s.id) || { studentId: s.id, classId: cid, entryStatus: "pending", scores: {}, totalScore: null };
        rows.push(enrichFinalExamRecord(base, s, cid));
      }
    }

    let filtered = rows;
    if (status && status !== "all") {
      filtered = filtered.filter((r) => {
        if (status === "submitted") return r.entryStatus === "submitted";
        if (status === "draft") return r.entryStatus === "draft";
        if (status === "pending") return r.entryStatus === "pending";
        if (status === "exempt") return r.entryStatus === "exempt";
        return true;
      });
    }
    if (q) {
      const kw = q.toLowerCase();
      filtered = filtered.filter((r) => r.name.includes(kw) || r.no.includes(kw));
    }
    return filtered;
  }

  function enrichPhysicalRecord(record) {
    const cls = getClass(record.classId);
    const course = cls ? getCourse(cls.courseId) : null;
    const classLabel = cls ? formatClassLabel(cls) : "";
    const bmi =
      record.height && record.weight ? (record.weight / Math.pow(record.height / 100, 2)).toFixed(1) : null;
    const exemptTest = getExemptApplication(record.no, "exempt_test");
    const exemptExam = getExemptApplication(record.no, "exempt_exam");
    const scoreItems = (MOCK.physicalTestConfig.items || []).filter(
      (item) => item.type === "score" && (!item.gender || item.gender === record.gender)
    );
    const enteredCount = record.scores
      ? scoreItems.filter((item) => record.scores[item.key] != null).length
      : 0;
    return {
      ...record,
      classLabel,
      courseId: cls?.courseId || null,
      courseName: course?.name || "",
      bmi,
      itemsTotal: scoreItems.length,
      itemsEntered: enteredCount,
      exemptTestStatus: exemptTest?.status || null,
      exemptExamStatus: exemptExam?.status || null,
      convertedScores: record.convertedScores || {},
      ...enduranceFieldsFromPhysical(record),
    };
  }

  function listPhysicalTestRows(params = {}) {
    const { classId, courseId, status, q } = params;
    let courseIds = courseId ? [courseId] : getTeacherCourseIds();
    let classIds = MOCK.classes.filter((c) => courseIds.includes(c.courseId)).map((c) => c.id);
    if (classId) classIds = classIds.filter((id) => id === classId);

    const recordMap = new Map(MOCK.physicalTests.map((r) => [r.studentId, r]));
    const rows = [];

    for (const cid of classIds) {
      for (const s of MOCK.students[cid] || []) {
        const base = recordMap.get(s.id) || {
          studentId: s.id,
          no: s.no,
          name: s.name,
          classId: cid,
          age: null,
          gender: null,
          height: null,
          weight: null,
          matched: null,
          entryStatus: "pending",
          scores: null,
          totalScore: null,
          finalExamScore: null,
        };
        rows.push(enrichPhysicalRecord(base));
      }
    }

    let filtered = rows;
    if (status && status !== "all") {
      filtered = filtered.filter((r) => {
        if (status === "submitted") return r.entryStatus === "submitted";
        if (status === "draft") return r.entryStatus === "draft";
        if (status === "pending") return r.entryStatus === "pending" || r.entryStatus == null;
        if (status === "exempt") return r.entryStatus === "exempt";
        if (status === "unmatched") return r.matched === false;
        return true;
      });
    }
    if (q) {
      const kw = q.toLowerCase();
      filtered = filtered.filter((r) => r.name.includes(kw) || r.no.includes(kw));
    }
    return filtered;
  }

  function buildGradeSummary(params = {}) {
    const { classId, courseId } = params;
    const physicalRows = listPhysicalTestRows({ classId, courseId });
    const records = physicalRows.map((r) => {
      const courseIdForStudent = r.courseId || "default";
      const weights = getGradeWeightsForCourse(courseIdForStudent);
      const exemptTestPending = isApplicationPending(r.exemptTestStatus);
      const exemptExamPending = isApplicationPending(r.exemptExamStatus);

      if (exemptTestPending || exemptExamPending) {
        const importIndex = (MOCK.students[r.classId] || []).find((s) => s.id === r.studentId)?.importIndex;
        return {
          studentId: r.studentId,
          no: r.no,
          name: r.name,
          importIndex,
          classId: r.classId,
          classLabel: r.classLabel,
          courseId: courseIdForStudent,
          courseName: r.courseName,
          gradePending: true,
          pendingReason: exemptTestPending ? "免测审核中" : "免考审核中",
          checkinHoursApproved: null,
          checkinHoursRequired: null,
          checkinPercent: null,
          regularScore: null,
          enduranceRawDisplay: null,
          endurancePercent: null,
          physicalScore: null,
          finalScore: null,
          totalScore: null,
          formula: null,
          exemptTest: false,
          exemptExam: false,
        };
      }

      const enriched = enrichStudent(
        { id: r.studentId, no: r.no, name: r.name, importIndex: (MOCK.students[r.classId] || []).find((s) => s.id === r.studentId)?.importIndex },
        r.classId,
        ""
      );
      const regular =
        r.checkinScore ??
        r.regularScore ??
        r.checkinPercent ??
        computeRegularScore(r.studentId, r.classId);
      const physical = r.totalScore;
      const finalRecord = getFinalExamRecord(r.studentId);
      const final =
        r.exemptExamStatus === "approved"
          ? null
          : finalRecord?.entryStatus === "exempt"
            ? null
            : finalRecord?.totalScore ?? null;
      const total = computeTotalGrade(regular, physical, final, r.exemptTestStatus, r.exemptExamStatus, courseIdForStudent);
      const formula = formatGradeFormula(weights, r.exemptTestStatus, r.exemptExamStatus);
      const endurance = enduranceFieldsFromPhysical(r);
      return {
        studentId: r.studentId,
        no: r.no,
        name: r.name,
        importIndex: enriched.importIndex,
        classId: r.classId,
        classLabel: r.classLabel,
        courseId: courseIdForStudent,
        courseName: r.courseName,
        gradePending: false,
        checkinHoursApproved: enriched.approvedHours,
        checkinHoursRequired: enriched.semesterRequired,
        checkinPercent: regular,
        regularScore: regular,
        enduranceRawDisplay: endurance.enduranceRawDisplay,
        endurancePercent: endurance.endurancePercent,
        physicalScore: r.exemptTestStatus === "approved" ? "免测" : physical,
        finalScore: r.exemptExamStatus === "approved" ? "免考" : final,
        totalScore: total,
        formula,
        exemptTest: r.exemptTestStatus === "approved",
        exemptExam: r.exemptExamStatus === "approved",
      };
    });

    const numericTotals = records.filter((r) => !r.gradePending && typeof r.totalScore === "number");
    const avgTotal = numericTotals.length
      ? Math.round(numericTotals.reduce((s, r) => s + r.totalScore, 0) / numericTotals.length)
      : 0;

    const activeCourseId = courseId || null;
    const displayWeights = activeCourseId ? getGradeWeightsForCourse(activeCourseId) : null;

    return {
      semester: MOCK.physicalTestConfig.semester,
      activeCourseId,
      weights: displayWeights,
      courseWeightSummaries: [...new Set(records.map((r) => r.courseId).filter(Boolean))].map((cid) => {
        const course = getCourse(cid);
        const w = getGradeWeightsForCourse(cid);
        return {
          courseId: cid,
          courseName: course?.name || cid,
          normal: w.normal,
          exemptTest: w.exemptTest,
          exemptExam: w.exemptExam,
        };
      }),
      stats: {
        total: records.length,
        avgTotal,
        graded: numericTotals.length,
        pendingExempt: records.filter((r) => r.gradePending).length,
        exemptTest: records.filter((r) => r.exemptTest).length,
        exemptExam: records.filter((r) => r.exemptExam).length,
        pendingPhysical: records.filter(
          (r) => !r.gradePending && r.physicalScore !== "免测" && r.physicalScore == null
        ).length,
      },
      records,
    };
  }

  function findEvidenceById(evidenceId) {
    for (const [studentId, list] of Object.entries(MOCK.evidence)) {
      const idx = list.findIndex((e) => e.id === evidenceId);
      if (idx >= 0) {
        const classId = findClassIdByStudent(studentId);
        return { studentId, classId, index: idx, item: list[idx] };
      }
    }
    return null;
  }

  const API = {
    BASE,

    /** GET /auth/me */
    getCurrentUser() {
      return delay({ ...MOCK.currentUser });
    },

    /** GET /checkin/overview?date=&courseId= */
    getCheckinOverview(params = {}) {
      const { courseId, date = "" } = params;
      let classes = MOCK.classes;
      if (courseId) classes = classes.filter((c) => c.courseId === courseId);
      return delay(
        classes.map((c) => ({
          ...enrichClass(c),
          stats: computeClassStats(c.id, date),
        }))
      );
    },

    /** GET /checkin/heatmap?classId=&month= */
    getCheckinHeatmap(classId, month) {
      const values = MOCK.heatmap[classId] || MOCK.heatmap.default;
      return delay({ classId, month, values });
    },

    /** GET /checkin/students?classId=&date= */
    getClassStudents(classId, date) {
      return delay((MOCK.students[classId] || []).map((s) => enrichStudent(s, classId, date)));
    },

    /** GET /checkin/evidence?studentId= */
    getStudentEvidence(studentId) {
      const classId = findClassIdByStudent(studentId);
      return delay(getStudentEvidenceList(studentId, classId));
    },

    /** GET /checkin/pending — 打卡审查列表（含有效与无效） */
    getPendingCheckins() {
      return delay(collectReviewCheckins());
    },

    /** GET /audit/pending-summary — 首页待办汇总 */
    getAuditPendingSummary() {
      const all = collectReviewCheckins();
      return delay({
        checkin: all.filter((e) => !isRecordValid(e)).length,
        invalidCount: all.filter((e) => !isRecordValid(e)).length,
        exemptTest: countPendingApplications("exempt_test"),
        exemptExam: 0,
      });
    },

    /** POST /checkin/evidence/:id/review — 兼容旧接口；approve=恢复有效，reject=标无效 */
    reviewCheckin(evidenceId, action, opts = {}) {
      const found = findEvidenceById(evidenceId);
      if (!found) return delay({ success: false });
      if (action === "approve" || action === "restore") {
        found.item.recordStatus = "valid";
        found.item.reviewStatus = "approved";
        found.item.invalidReason = "";
      } else {
        const reason = opts.reason || "其他";
        found.item.recordStatus = "invalid";
        found.item.reviewStatus = "rejected";
        found.item.invalidReason = reason;
        found.item.notifiedStudent = true;
      }
      return delay({ id: evidenceId, action, success: true, notifiedStudent: true });
    },

    /** 标无效（必通知学生） */
    invalidateCheckin(evidenceId, reason) {
      if (!reason) return delay({ success: false, message: "请选择无效原因" });
      return API.reviewCheckin(evidenceId, "reject", { reason });
    },

    /** 恢复有效 */
    restoreCheckin(evidenceId) {
      return API.reviewCheckin(evidenceId, "restore");
    },

    /** 修正学时：仅 0/1/2，且同日有效合计 ≤2 */
    adjustCheckinHours(evidenceId, hours) {
      const found = findEvidenceById(evidenceId);
      if (!found) return delay({ success: false, message: "记录不存在" });
      const next = clampCreditHours(hours);
      const others = dayValidHours(found.studentId, found.item.date, evidenceId);
      if (isRecordValid(found.item) || found.item.recordStatus !== "invalid") {
        if (others + next > 2) {
          return delay({ success: false, message: `同日有效学时合计不可超过 2h（已有 ${others}h）` });
        }
      }
      found.item.durationHours = next;
      found.item.recordStatus = found.item.recordStatus === "invalid" ? "invalid" : "valid";
      found.item.reviewStatus = found.item.recordStatus === "invalid" ? "rejected" : "approved";
      return delay({ success: true, id: evidenceId, durationHours: next });
    },

    /** GET /checkin/settings?courseId= — 课程级时间窗 */
    getCheckinSettings(courseId, classId) {
      const s = getSettingsForCourse(courseId);
      const startsAt = s.startsAt;
      const endsAt = s.endsAt;
      const lifecycleStatus =
        s.lifecycleStatus ||
        (global.TimeWindow ? TimeWindow.deriveLifecycle(startsAt, endsAt) : "进行中");
      return delay({
        ...s,
        windowStart: s.dailyWindowStart || s.windowStart,
        windowEnd: s.dailyWindowEnd || s.windowEnd,
        dailyWindowStart: s.dailyWindowStart || s.windowStart,
        dailyWindowEnd: s.dailyWindowEnd || s.windowEnd,
        lifecycleStatus,
        courseId,
        classId,
        isSpecialtyCourse: false,
        specialtyHoursRequired: 0,
      });
    },

    /** PUT /checkin/settings — 按课程保存时间窗与学时目标 */
    updateCheckinSettings(payload) {
      if (payload.startsAt && payload.endsAt) {
        const s = new Date(payload.startsAt);
        const e = new Date(payload.endsAt);
        if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
          return delay({
            success: false,
            code: "WINDOW_INVALID_RANGE",
            message: "结束时间必须晚于或等于开始时间",
          });
        }
      }
      const courseId = payload.courseId;
      const next = { ...payload };
      delete next.classId;
      if (next.dailyWindowStart) next.windowStart = next.dailyWindowStart;
      if (next.dailyWindowEnd) next.windowEnd = next.dailyWindowEnd;
      if (next.windowStart && !next.dailyWindowStart) next.dailyWindowStart = next.windowStart;
      if (next.windowEnd && !next.dailyWindowEnd) next.dailyWindowEnd = next.windowEnd;
      const courseH = Number(next.courseHoursRequired ?? 10);
      const generalH = Number(next.generalHoursRequired ?? 10);
      next.courseHoursRequired = courseH;
      next.generalHoursRequired = generalH;
      next.semesterHoursRequired = courseH + generalH;
      next.requireTeacherReview = false;
      next.specialtyHoursRequired = 0;
      if (next.startsAt && next.endsAt && global.TimeWindow) {
        next.lifecycleStatus = TimeWindow.deriveLifecycle(next.startsAt, next.endsAt);
      }
      if (!MOCK.courseCheckinSettings) MOCK.courseCheckinSettings = {};
      if (courseId) {
        MOCK.courseCheckinSettings[courseId] = {
          ...(MOCK.courseCheckinSettings[courseId] || {}),
          ...next,
        };
      }
      Object.assign(MOCK.checkinSettings, next);
      MOCK.settingsHistory.unshift({
        at: new Date().toISOString().slice(0, 16).replace("T", " "),
        by: MOCK.currentUser.name,
        change: next.startsAt
          ? `课程 ${courseId || "全部"} 时间窗 ${String(next.startsAt).slice(0, 16)} → ${String(next.endsAt).slice(0, 16)}`
          : `更新课程打卡设置 ${courseId || ""}`,
      });
      return delay({
        success: true,
        settings: getSettingsForCourse(courseId),
      });
    },

    /** GET /checkin/settings/history */
    getSettingsHistory() {
      return delay([...MOCK.settingsHistory]);
    },

    /** GET /checkin/history?semester=&courseId=&classId= */
    getCheckinHistory(params = {}) {
      const classId = params.classId || "cl1";
      const cls = getClass(classId);
      const classLabel = cls ? formatClassLabel(cls) : "";
      const settings = getSettingsForCourse(cls?.courseId);
      const required = settings.semesterHoursRequired;
      const list = MOCK.students[classId] || MOCK.students.cl1 || [];

      return delay({
        semester: params.semester || "2025-2026-1",
        classLabel,
        required,
        specialtyRequired: null,
        records: list.map((s) => {
          const enriched = enrichStudent(s, classId, "");
          const progress = required ? enriched.approvedHours / required : 0;
          return {
            ...enriched,
            classLabel,
            progress,
            scoreHint: progress >= 1 ? "满分" : `${Math.round(progress * 100)}%`,
          };
        }),
      });
    },

    /** GET /applications?type=exempt_test|exempt_exam */
    getApplications(type) {
      return delay(MOCK.applications[type] || []);
    },

    /** GET /applications/:type/:id */
    getApplicationDetail(type, id) {
      const app = (MOCK.applications[type] || []).find((a) => a.id === id);
      return delay(app ? { ...app, applicationType: type } : null);
    },

    /** GET /checkin/review/:evidenceId */
    getCheckinReviewDetail(evidenceId) {
      const found = findEvidenceById(evidenceId);
      if (!found) return delay(null);
      const { studentId, classId, item } = found;
      const students = MOCK.students[classId] || [];
      const student = students.find((s) => s.id === studentId);
      const classLabel = classId ? formatClassLabel(getClass(classId)) : "";
      const attachments = (item.attachments && item.attachments.length
        ? item.attachments
        : [
            {
              type: item.type,
              kind: item.kind || item.type,
              name: item.desc,
              thumb: item.thumb,
              thumbUrl: item.thumbUrl || item.thumb,
              originalUrl: item.originalUrl,
              mediaType: item.type,
            },
          ]
      ).map((a, j) => normalizeAttachment(a, `${evidenceId}-a${j}`));
      return delay({
        id: evidenceId,
        kind: "checkin_review",
        no: student?.no || "",
        studentName: student?.name || "",
        classLabel,
        durationHours: clampCreditHours(item.durationHours),
        desc: item.desc,
        date: item.date,
        time: item.time,
        status: migrateRecordStatus(item),
        recordStatus: migrateRecordStatus(item),
        invalidReason: item.invalidReason || "",
        evidenceCount: attachments.length,
        attachments,
      });
    },

    /** POST /applications/:id/review — 免测通过时可带自定义分数 */
    reviewApplication(id, action, type, opts = {}) {
      for (const key of ["exempt_test", "exempt_exam"]) {
        if (type && type !== key) continue;
        const list = MOCK.applications[key] || [];
        const app = list.find((a) => a.id === id);
        if (app) {
          if (action === "approve") {
            if (key === "exempt_test") {
              const score = Number(opts.exemptScore);
              if (!Number.isFinite(score) || score < 0 || score > 100) {
                return delay({ success: false, message: "请填写 0–100 的免测自定义分数" });
              }
              app.exemptScore = score;
              app.disableEnduranceEntry = true;
            }
            app.status = "approved";
          } else {
            app.status = "rejected";
          }
          return delay({ id, action, success: true, exemptScore: app.exemptScore });
        }
      }
      return delay({ id, action, success: false });
    },

    /** GET /courses */
    getCourses() {
      return delay([...MOCK.courses]);
    },

    /** GET /classes?courseId= */
    getClasses(courseId) {
      const list = courseId ? MOCK.classes.filter((c) => c.courseId === courseId) : MOCK.classes;
      return delay(list.map(enrichClass));
    },

    /** GET /physical-tests?classId=&courseId=&status=&q= */
    getPhysicalTests(params = {}) {
      const rows = listPhysicalTestRows(params);
      const stats = {
        total: rows.length,
        submitted: rows.filter((r) => r.entryStatus === "submitted").length,
        draft: rows.filter((r) => r.entryStatus === "draft").length,
        pending: rows.filter((r) => r.entryStatus === "pending").length,
        exempt: rows.filter((r) => r.entryStatus === "exempt").length,
        unmatched: rows.filter((r) => r.matched === false).length,
      };
      return delay({ stats, records: rows, config: MOCK.physicalTestConfig });
    },

    /** GET /physical-tests/:studentId */
    getPhysicalTestDetail(studentId) {
      let record = MOCK.physicalTests.find((r) => r.studentId === studentId);
      if (!record) {
        const classId = findClassIdByStudent(studentId);
        const s = (MOCK.students[classId] || []).find((st) => st.id === studentId);
        if (!s) return delay(null);
        record = {
          studentId,
          no: s.no,
          name: s.name,
          classId,
          entryStatus: "pending",
          scores: {},
        };
      }
      return delay(enrichPhysicalRecord(record));
    },

    /** PUT /physical-tests/:studentId */
    savePhysicalTest(studentId, payload) {
      let record = MOCK.physicalTests.find((r) => r.studentId === studentId);
      if (!record) {
        const classId = findClassIdByStudent(studentId);
        const s = (MOCK.students[classId] || []).find((st) => st.id === studentId);
        if (!s) return delay({ success: false });
        record = { studentId, no: s.no, name: s.name, classId, entryStatus: "draft", scores: {} };
        MOCK.physicalTests.push(record);
      }
      Object.assign(record, payload);
      if (payload.scores) {
        record.scores = { ...record.scores, ...payload.scores };
        record.convertedScores = { ...(record.convertedScores || {}), ...(payload.convertedScores || {}) };
        for (const key of ["run800m", "run1000m"]) {
          if (record.scores[key] != null && record.convertedScores[key] == null) {
            // MOCK 模拟服务端回包 convertedScore（非正式评分表）
            record.convertedScores[key] = mockConvertEndurance(record.scores[key]);
          }
        }
        const filled = Object.values(record.scores).filter((v) => v != null).length;
        record.entryStatus = payload.entryStatus || (filled >= 4 ? "submitted" : "draft");
        record.totalScore = payload.totalScore ?? record.totalScore ?? Math.min(100, 60 + filled * 3);
        record.matched = record.matched !== false;
      }
      return delay({ success: true, record: enrichPhysicalRecord(record) });
    },

    formatMinSec,
    mockConvertEndurance,

    /** GET /grades/summary?classId=&courseId= */
    getGradeSummary(params = {}) {
      return delay(buildGradeSummary(params));
    },

    /** GET /grades/weights?courseId= */
    getGradeWeights(courseId = "c1") {
      const key = courseId || "default";
      return delay({ courseId: key, ...JSON.parse(JSON.stringify(getGradeWeightsForCourse(key))) });
    },

    /** PUT /grades/weights?courseId= */
    updateGradeWeights(courseId, payload) {
      const key = courseId || "default";
      if (!MOCK.gradeWeights.courses[key]) MOCK.gradeWeights.courses[key] = {};
      MOCK.gradeWeights.courses[key] = normalizeGradeWeights(payload);
      return delay({ success: true, courseId: key, weights: MOCK.gradeWeights.courses[key] });
    },

    /** POST /grades/weights/reset?courseId= */
    resetGradeWeights(courseId) {
      const key = courseId || "default";
      const defaults = MOCK.gradeWeightsDefault.courses;
      if (defaults[key]) {
        MOCK.gradeWeights.courses[key] = JSON.parse(JSON.stringify(defaults[key]));
      } else {
        MOCK.gradeWeights.courses[key] = JSON.parse(JSON.stringify(defaults.default));
      }
      return delay({ success: true, courseId: key, weights: MOCK.gradeWeights.courses[key] });
    },

    /** GET /physical-tests/config — 固定国标，只读 */
    getPhysicalTestConfig() {
      return delay(JSON.parse(JSON.stringify(MOCK.physicalTestConfig)));
    },

    /** GET /final-exams?classId=&courseId=&status=&q= */
    getFinalExams(params = {}) {
      const rows = listFinalExamRows(params);
      const stats = {
        total: rows.length,
        submitted: rows.filter((r) => r.entryStatus === "submitted").length,
        draft: rows.filter((r) => r.entryStatus === "draft").length,
        pending: rows.filter((r) => r.entryStatus === "pending").length,
        exempt: rows.filter((r) => r.entryStatus === "exempt").length,
      };
      return delay({ stats, records: rows });
    },

    /** GET /final-exams/:studentId */
    getFinalExamDetail(studentId) {
      const classId = findClassIdByStudent(studentId);
      const s = (MOCK.students[classId] || []).find((st) => st.id === studentId);
      if (!s) return delay(null);
      const record = getFinalExamRecord(studentId) || { studentId, classId, entryStatus: "pending", scores: {} };
      return delay(enrichFinalExamRecord(record, s, classId));
    },

    /** PUT /final-exams/:studentId */
    saveFinalExam(studentId, payload) {
      let record = getFinalExamRecord(studentId);
      const classId = findClassIdByStudent(studentId);
      const s = (MOCK.students[classId] || []).find((st) => st.id === studentId);
      if (!s) return delay({ success: false });
      if (!record) {
        record = { studentId, classId, entryStatus: "draft", scores: {} };
        MOCK.finalExams.push(record);
      }
      Object.assign(record, payload);
      if (payload.scores) {
        record.scores = { ...record.scores, ...payload.scores };
        const cls = getClass(classId);
        const items = getFinalExamItems(cls?.courseId);
        const filled = items.filter((item) => record.scores[item.key] != null).length;
        record.entryStatus = payload.entryStatus || (filled >= items.length ? "submitted" : "draft");
        record.totalScore = payload.totalScore ?? record.totalScore ?? Math.min(100, 55 + filled * 12);
      }
      return delay({ success: true, record: enrichFinalExamRecord(record, s, classId) });
    },

    /** GET /final-exams/config?courseId= */
    getFinalExamConfig(courseId = "default") {
      const items = getFinalExamItems(courseId === "default" ? "default" : courseId);
      return delay({ semester: MOCK.finalExamConfig.semester, courseId, items: JSON.parse(JSON.stringify(items)) });
    },

    /** PUT /final-exams/config?courseId= */
    updateFinalExamConfig(courseId, payload) {
      const key = courseId || "default";
      if (!MOCK.finalExamConfig.courses[key]) MOCK.finalExamConfig.courses[key] = { items: [] };
      if (payload.items) {
        MOCK.finalExamConfig.courses[key].items = payload.items.map((item, i) => ({
          key: item.key || `final_${i}`,
          label: item.label || "未命名",
          unit: item.unit || "",
          ...(item.lowerBetter ? { lowerBetter: true } : {}),
        }));
      }
      return delay({ success: true, courseId: key, items: MOCK.finalExamConfig.courses[key].items });
    },

    /** POST /final-exams/config/reset?courseId= */
    resetFinalExamConfig(courseId) {
      const key = courseId || "default";
      const defaults = MOCK.finalExamConfigDefault.courses;
      if (defaults[key]) {
        MOCK.finalExamConfig.courses[key] = JSON.parse(JSON.stringify(defaults[key]));
      } else {
        delete MOCK.finalExamConfig.courses[key];
      }
      return delay({ success: true, courseId: key, items: getFinalExamItems(key) });
    },

    /** GET /teacher/courses — 我的课程（含班级与学生数） */
    getTeacherCourseOverview() {
      const courseIds = getTeacherCourseIds();
      const courses = MOCK.courses.filter((c) => courseIds.includes(c.id));
      return delay(
        courses.map((c) => {
          const classes = MOCK.classes
            .filter((cls) => cls.courseId === c.id)
            .map((cls) => ({
              ...enrichClass(cls),
              studentCount: (MOCK.students[cls.id] || []).length,
            }));
          return {
            ...c,
            classCount: classes.length,
            studentCount: classes.reduce((s, cls) => s + cls.studentCount, 0),
            classes,
          };
        })
      );
    },

    /** GET /students/roster?courseId=&classId=&q= */
    getStudentRoster(params = {}) {
      const { courseId, classId, q } = params;
      let courseIds = courseId ? [courseId] : getTeacherCourseIds();
      let classList = MOCK.classes.filter((c) => courseIds.includes(c.courseId)).map(enrichClass);
      if (classId) classList = classList.filter((c) => c.id === classId);

      const physicalMap = new Map(MOCK.physicalTests.map((r) => [r.studentId, r]));
      let rows = [];
      for (const cls of classList) {
        for (const s of MOCK.students[cls.id] || []) {
          const pt = physicalMap.get(s.id);
          rows.push({
            ...s,
            classId: cls.id,
            classLabel: cls.name,
            gender: pt?.gender || null,
            age: pt?.age || null,
          });
        }
      }
      if (q) {
        const kw = q.toLowerCase();
        rows = rows.filter((r) => r.name.includes(kw) || r.no.includes(kw));
      }
      return delay({ total: rows.length, records: rows });
    },

    /** GET /admin/roles — 超级管理员 */
    getRoleConfig() {
      return delay([
        { id: "u1", name: "张老师", roles: ["sports_teacher"] },
        { id: "u2", name: "李主任", roles: ["dept_head"] },
        { id: "u3", name: "王教练", roles: ["sports_teacher"] },
      ]);
    },

    /** POST /admin/roles */
    updateUserRoles(userId, roles) {
      return delay({ userId, roles, success: true });
    },

    /** GET /checkin/export?format=csv|xlsx */
    exportCheckin(params) {
      return delay({ url: `${BASE}/checkin/export?${new URLSearchParams(params)}`, success: true });
    },
  };

  global.API = API;
})(window);
