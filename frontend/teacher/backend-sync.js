/**
 * 将 backend API 数据同步到 teacher UI 使用的 MOCK 结构。
 * 后端课程模型为 courseCode + section；UI 中每门课映射为一个 class。
 */
(function (global) {
  const Auth = global.AuthBridge;
  const API = global.API;
  if (!Auth || !API || !global.MOCK) return;

  function reviewStatusToEvidence(status) {
    if (status === "已通过" || status === "可通过") return "approved";
    if (status === "已驳回") return "rejected";
    return "pending";
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
            global.MOCK.evidence[sid].push({
              id: r.id,
              date: String(r.created_at || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
              time: String(r.created_at || "").slice(11, 16) || "-",
              durationHours: Number(r.hours || 1),
              reviewStatus: reviewStatusToEvidence(r.status),
              isSpecialty: String(r.type || "").includes("课程"),
              type: "image",
              thumb: "📷",
              desc: r.task || r.reason || "打卡凭证",
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
          global.MOCK.checkinSettings.semesterHoursRequired = Number(rules.total || courseRequired + generalRequired);
          global.MOCK.checkinSettings.specialtyHoursRequired = courseRequired;
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
  API.reviewCheckin = async function reviewCheckin(evidenceId, action) {
    if (!Auth.isDemo() && Auth.readAuth()?.token) {
      const decision = action === "approve" ? "approve" : action === "reject" ? "reject" : "supplement";
      let approvedHours = 1;
      for (const list of Object.values(global.MOCK.evidence)) {
        const hit = list.find((e) => e.id === evidenceId);
        if (hit) {
          approvedHours = Number(hit.durationHours || 1);
          break;
        }
      }
      await Auth.apiFetch(`/api/teacher/reviews/${encodeURIComponent(evidenceId)}/decision`, {
        method: "PUT",
        body: JSON.stringify({ decision, approvedHours, comment: "" }),
      });
      await syncFromBackend();
      return { id: evidenceId, action, success: true };
    }
    return origReviewCheckin(evidenceId, action);
  };

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
