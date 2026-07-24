/**
 * 将 backend API 数据同步到 teacher UI 使用的 MOCK 结构。
 * 后端课程模型为 courseCode + section；UI 中每门课映射为一个 class。
 */
(function (global) {
  const Auth = global.AuthBridge;
  const API = global.API;
  if (!Auth || !API || !global.MOCK) return;

  function reviewStatusToEvidence(status) {
    // v3：提交即默认有效；旧「已通过/可通过」→有效，「已驳回」→无效
    if (status === "已通过" || status === "可通过" || status === "approved") return "approved";
    if (status === "已驳回" || status === "rejected") return "rejected";
    // 旧 pending / 未知状态按有效展示（兼容后端尚未切换字段）
    return "approved";
  }

  function recordStatusFromReview(reviewStatus) {
    return reviewStatus === "rejected" ? "invalid" : "valid";
  }

  /** 计入学时仅允许 0 / 1 / 2（与教师端 MOCK 规则一致） */
  function clampCreditHours(h) {
    const n = Number(h);
    if (!Number.isFinite(n) || n < 1) return 0;
    if (n < 2) return 1;
    return 2;
  }

  /** 将后端 proofFiles（字符串 URL 或对象数组）规范为教师端附件结构 */
  function normalizeProofFiles(raw) {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
    return list
      .map((item, i) => {
        if (typeof item === "string") {
          return {
            id: `pf-${i}`,
            kind: "image",
            thumbUrl: item,
            originalUrl: item,
            name: `证明${i + 1}`,
          };
        }
        if (!item || typeof item !== "object") return null;
        const kind =
          item.kind ||
          (item.type === "video" || String(item.mime || "").startsWith("video/") ? "video" : "image");
        const thumbUrl = item.thumbUrl || item.thumb_url || item.thumbnail || item.url || "";
        const originalUrl = item.originalUrl || item.original_url || item.url || thumbUrl;
        return {
          id: item.id || `pf-${i}`,
          kind,
          thumbUrl,
          originalUrl,
          name: item.name || item.filename || item.desc || `证明${i + 1}`,
          mime: item.mime,
        };
      })
      .filter(Boolean);
  }

  function exemptionStatus(raw) {
    if (raw === "已通过" || raw === "approved") return "approved";
    if (raw === "已驳回" || raw === "rejected") return "rejected";
    if (raw === "审核中" || raw === "reviewing") return "reviewing";
    return "pending";
  }

  async function syncFromBackend() {
    if (Auth.isDemo() || !Auth.readAuth()?.token) return false;
    try {
      const me = await Auth.apiFetch("/api/auth/me");
      if (me?.user) {
        global.MOCK.currentUser = {
          id: me.user.id,
          name: me.user.name,
          role: "sports_teacher",
          roles: ["sports_teacher"],
        };
      }

      const courses = await Auth.apiFetch("/api/teacher/courses");
      if (!Array.isArray(courses) || !courses.length) return false;

      global.MOCK.courses = courses.map((c) => ({
        id: c.id,
        name: c.name,
        semester: c.semester || c.semester_id || "2026 SPRING",
        isSpecialty: false,
      }));

      global.MOCK.classes = courses.map((c) => ({
        id: c.id,
        courseId: c.id,
        classNo: c.section ? ` Section ${c.section}` : "",
        total: Number(c.students || 0),
      }));

      global.MOCK.teacherAssignments = {
        [global.MOCK.currentUser.id]: { courseIds: courses.map((c) => c.id) },
      };

      global.MOCK.students = {};
      global.MOCK.evidence = {};
      global.MOCK.physicalTests = [];
      global.MOCK.finalExams = [];
      global.MOCK.applications = { exempt_test: [], exempt_exam: [] };

      for (const course of courses) {
        const cid = course.id;
        const students = await Auth.apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/students`);
        if (Array.isArray(students)) {
          global.MOCK.students[cid] = students.map((s) => ({
            id: s.id,
            no: s.id,
            name: s.name,
          }));
          for (const s of students) {
            global.MOCK.physicalTests.push({
              studentId: s.id,
              no: s.id,
              name: s.name,
              classId: cid,
              gender: null,
              age: null,
              height: null,
              weight: null,
              matched: s.physical != null,
              entryStatus: s.physical != null ? "submitted" : "pending",
              scores: null,
              totalScore: s.physical != null ? Number(s.physical) : null,
              finalExamScore: s.exam != null ? Number(s.exam) : null,
            });
            global.MOCK.finalExams.push({
              studentId: s.id,
              classId: cid,
              entryStatus: s.exam != null ? "submitted" : "pending",
              scores: {},
              totalScore: s.exam != null ? Number(s.exam) : null,
            });
          }
        }

        const reviews = await Auth.apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/reviews`);
        if (Array.isArray(reviews)) {
          for (const r of reviews) {
            const sid = r.student_id || r.studentId;
            if (!sid) continue;
            if (!global.MOCK.evidence[sid]) global.MOCK.evidence[sid] = [];
            const reviewStatus = reviewStatusToEvidence(r.status);
            global.MOCK.evidence[sid].push({
              id: r.id,
              date: String(r.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              time: String(r.created_at || "").slice(11, 16) || "-",
              durationHours: clampCreditHours(r.hours ?? r.durationHours ?? 1),
              reviewStatus,
              recordStatus: recordStatusFromReview(reviewStatus),
              isSpecialty: String(r.type || "").includes("课程"),
              type: "image",
              kind: "image",
              thumb: "📷",
              desc: r.task || r.reason || "打卡凭证",
              attachments: normalizeProofFiles(r.proofFiles || r.proof_files || r.attachments),
              evidenceCount: Array.isArray(r.proofFiles || r.proof_files)
                ? (r.proofFiles || r.proof_files).length
                : undefined,
            });
          }
        }

        try {
          const exemptions = await Auth.apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/exemptions`);
          if (Array.isArray(exemptions)) {
            for (const ex of exemptions) {
              const bucket = ex.type === "1000m" || ex.type === "800m" ? "exempt_test" : "exempt_test";
              global.MOCK.applications[bucket].push({
                id: ex.id,
                no: ex.studentId || ex.student_id,
                name: ex.studentName || ex.student_name || ex.studentId,
                type: ex.type,
                reason: ex.reason || "",
                status: exemptionStatus(ex.status),
                submittedAt: ex.createdAt || ex.created_at || "",
              });
            }
          }
        } catch {
          // optional
        }
      }

      try {
        const rules = await Auth.apiFetch("/api/admin/sport-rules");
        if (rules) {
          const courseRequired = Number(rules.courseRequired || 10);
          const generalRequired = Number(rules.generalRequired || 10);
          global.MOCK.checkinSettings.courseHoursRequired = courseRequired;
          global.MOCK.checkinSettings.generalHoursRequired = generalRequired;
          global.MOCK.checkinSettings.semesterHoursRequired = Number(
            rules.total || courseRequired + generalRequired
          );
          global.MOCK.checkinSettings.specialtyHoursRequired = 0;
          global.MOCK.checkinSettings.requireTeacherReview = false;
        }
      } catch {
        // teacher may not access admin rules
      }

      try {
        const gradeRules = await Auth.apiFetch("/api/admin/grade-rules");
        if (gradeRules?.weights) {
          const w = gradeRules.weights;
          const normal = {
            regular: Number(w.attendance || 25) / 100,
            physical: Number(w.physical || 25) / 100,
            final: Number(w.exam || 30) / 100,
          };
          global.MOCK.gradeWeights.courses.default = {
            normal,
            exemptTest: { regular: 0.6, final: 0.4 },
            exemptExam: { regular: 0.5, physical: 0.5 },
          };
        }
      } catch {
        // optional
      }

      return true;
    } catch (error) {
      console.warn("[teacher] backend sync failed, fallback to bundled mock:", error);
      return false;
    }
  }

  const origReviewCheckin = API.reviewCheckin.bind(API);
  API.reviewCheckin = async function reviewCheckin(evidenceId, action, opts) {
    if (!Auth.isDemo() && Auth.readAuth()?.token) {
      const local = await origReviewCheckin(evidenceId, action, opts);
      if (!local || local.success === false) return local;
      return {
        ...local,
        apiPending: true,
        message: "演示逻辑已更新（打卡审查），接口待对接；本次仅写入本地预览",
      };
    }
    return origReviewCheckin(evidenceId, action, opts);
  };

  function wrapLocalPreview(fnName, label) {
    const orig = API[fnName]?.bind(API);
    if (!orig) return;
    API[fnName] = async function patched(...args) {
      if (!Auth.isDemo() && Auth.readAuth()?.token) {
        const local = await orig(...args);
        if (!local || local.success === false) return local;
        return {
          ...local,
          apiPending: true,
          message: `演示逻辑已更新（${label}），接口待对接；本次仅写入本地预览`,
        };
      }
      return orig(...args);
    };
  }

  wrapLocalPreview("invalidateCheckin", "标无效");
  wrapLocalPreview("restoreCheckin", "恢复有效");
  wrapLocalPreview("adjustCheckinHours", "修正学时");

  const origUpdateSettings = API.updateCheckinSettings?.bind(API);
  if (origUpdateSettings) {
    API.updateCheckinSettings = async function updateCheckinSettings(payload) {
      if (!Auth.isDemo() && Auth.readAuth()?.token) {
        const local = await origUpdateSettings(payload);
        if (!local || local.success === false) return local;
        return {
          ...local,
          apiPending: true,
          message: "演示逻辑已更新（课程级时间窗），接口待对接；本次仅写入本地预览",
        };
      }
      return origUpdateSettings(payload);
    };
  }

  const origGetCurrentUser = API.getCurrentUser.bind(API);
  API.getCurrentUser = async function getCurrentUser() {
    if (!Auth.isDemo() && Auth.readAuth()?.token) {
      const me = await Auth.apiFetch("/api/auth/me");
      return {
        id: me.user.id,
        name: me.user.name,
        role: "sports_teacher",
        roles: ["sports_teacher"],
      };
    }
    return origGetCurrentUser();
  };

  API.syncFromBackend = syncFromBackend;
})(window);
