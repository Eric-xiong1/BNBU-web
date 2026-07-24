/**
 * 原 web-app 教师端缺失功能的 Material UI 实现。
 * 对接 AuthBridge.apiFetch；演示模式使用本地 MOCK 数据。
 */
(function (global) {
  const Auth = global.AuthBridge;
  const API = global.API;

  const LEGACY_PAGES = new Set([
    "roster-import",
    "attendance-scores",
    "grade-export",
    "student-detail",
    "pending-certifications",
    "endurance-scoring",
  ]);

  const state = {
    courseId: "",
    importPreview: [],
    importMeta: null,
    exportPrecheck: null,
    studentDetailId: "",
    studentHoursDetail: null,
    pendingCerts: [],
    attendanceRows: [],
    scoringResult: null,
    notice: "",
    noticeTone: "",
  };

  let showPageRef = null;
  let eventsBound = false;

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function statusCls(status) {
    if (["已通过", "有效", "进行中", "可抵扣", "预检通过"].includes(status)) return "status-ok";
    if (["待审核", "待确认", "草稿"].includes(status)) return "status-pending";
    if (["已驳回", "已关闭", "风险较高"].includes(status)) return "status-warn";
    return "";
  }

  function hasApi() {
    return Auth && !Auth.isDemo() && Auth.readAuth()?.token;
  }

  async function apiFetch(path, options = {}) {
    if (!hasApi()) throw new Error("演示模式未连接后端");
    return Auth.apiFetch(path, options);
  }

  async function getCourses() {
    const courses = await API.getCourses();
    return courses || [];
  }

  async function ensureCourseId(preferred) {
    const courses = await getCourses();
    if (preferred && courses.some((c) => c.id === preferred)) {
      state.courseId = preferred;
    } else if (!state.courseId || !courses.some((c) => c.id === state.courseId)) {
      state.courseId = courses[0]?.id || "";
    }
    return state.courseId;
  }

  function courseLabel(courses, courseId) {
    const c = courses.find((x) => x.id === courseId);
    return c ? `${c.name}${c.semester ? " · " + c.semester : ""}` : "未选择课程";
  }

  function rootId(pageId) {
    return `legacy-${pageId}-root`;
  }

  function setNotice(msg, tone = "") {
    state.notice = msg || "";
    state.noticeTone = msg ? tone : "";
  }

  function renderNotice() {
    if (!state.notice) return "";
    const danger = state.noticeTone === "danger" ? " rules-banner-danger" : "";
    return `<div class="rules-banner${danger}"><strong>提示</strong><span>${esc(state.notice)}</span></div>`;
  }

  function formatNameList(items) {
    const names = (items || []).map((i) => i.name || i.id).filter(Boolean);
    if (!names.length) return "无";
    return `<div class="precheck-names">${names
      .map((n) => `<span class="chip-name" title="${esc(n)}">${esc(n)}</span>`)
      .join("")}</div>`;
  }

  async function renderCourseSelect(selectId, courseId) {
    const courses = await getCourses();
    const sel = document.getElementById(selectId);
    if (!sel) return courses;
    sel.innerHTML = courses.map((c) => `<option value="${esc(c.id)}"${c.id === courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("");
    return courses;
  }

  // ── Demo data ───────────────────────────────────────────────────

  function demoImportRows() {
    return [
      { name: "吴嘉琪", id: "22301888", college: "工商管理学院", className: "2026A", courseCode: "PE101", section: "001", enrollmentStatus: "已选", valid: true, status: "可导入" },
      { name: "周明熙", id: "22301889", college: "理工科技学院", className: "2026B", courseCode: "PE101", section: "001", enrollmentStatus: "已选", valid: true, status: "可导入" },
      { name: "何安然", id: "", college: "数据科学学院", className: "2026C", courseCode: "PE101", section: "001", enrollmentStatus: "已选", valid: false, status: "学号缺失" },
    ];
  }

  function demoPendingCerts() {
    return [
      { id: "mc1", student_name: "张三", student_id: "20240001", organization: "校篮球队", type: "team", offset_hours: 10, offset_status: "待确认" },
      { id: "mc2", student_name: "李四", student_id: "20240002", organization: "跑步社", type: "club", offset_hours: 8, offset_status: "待确认" },
    ];
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];
      if (char === '"' && inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        row.push(cell.trim());
        cell = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        row.push(cell.trim());
        if (row.some((v) => v !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += char;
      }
    }
    row.push(cell.trim());
    if (row.some((v) => v !== "")) rows.push(row);
    return rows;
  }

  // ── Roster import ───────────────────────────────────────────────

  async function renderRosterImport() {
    const courses = await getCourses();
    await ensureCourseId();
    const root = document.getElementById(rootId("roster-import"));
    if (!root) return;

    const rows = state.importPreview;
    const validCount = rows.filter((r) => r.valid).length;
    const invalidCount = rows.length - validCount;

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="rules-banner"><strong>导入说明</strong><span>支持 CSV 导入，须校验姓名、学号、学院、班级、课程代码、Section、选课状态。当前教学班：${esc(courseLabel(courses, state.courseId))}</span></div>
      <div class="toolbar-inline">
        <select class="field-input" id="legacy-import-course">${courses.map((c) => `<option value="${esc(c.id)}"${c.id === state.courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <input type="file" class="field-input" id="legacy-import-file" accept=".csv,text/csv" />
        <button class="btn btn-primary" type="button" data-legacy-action="import-preview">预检名单</button>
        <button class="btn btn-secondary" type="button" data-legacy-action="import-template">下载模板</button>
        <button class="btn btn-secondary" type="button" data-legacy-action="import-confirm"${rows.length ? "" : " disabled"}>确认导入</button>
      </div>
      ${rows.length ? `<p class="box-hint">预检结果：${validCount} 行可导入，${invalidCount} 行需处理。</p>` : `<p class="box-hint">选择 CSV 后点击「预检名单」，或演示模式下直接预检示例数据。</p>`}
      <div class="box">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>姓名</th><th>学号</th><th>学院</th><th>班级</th><th>课程</th><th>Section</th><th>选课</th><th>校验</th></tr></thead>
            <tbody>
              ${rows.length
                ? rows
                    .map(
                      (r) => `<tr>
                    <td>${esc(r.name)}</td><td>${esc(r.id)}</td><td>${esc(r.college)}</td>
                    <td>${esc(r.className || "—")}</td><td>${esc(r.courseCode || "—")}</td>
                    <td>${esc(r.section || "—")}</td><td>${esc(r.enrollmentStatus || "—")}</td>
                    <td><span class="badge ${r.valid ? "status-ok" : "status-warn"}">${esc(r.status)}</span></td>
                  </tr>`
                    )
                    .join("")
                : `<tr><td colspan="8" class="table-empty">暂无数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      </div>`;
  }

  async function previewImport(file) {
    const cid = await ensureCourseId();
    if (!cid) return;
    if (hasApi() && file) {
      const fd = new FormData();
      fd.append("file", file);
      const auth = Auth.readAuth();
      const base = (auth?.apiBaseUrl || global.location.origin).replace(/\/$/, "");
      const resp = await fetch(`${base}/api/teacher/courses/${encodeURIComponent(cid)}/students/import/preview`, {
        method: "POST",
        headers: auth?.token ? { Authorization: `Bearer ${auth.token}` } : {},
        body: fd,
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      state.importPreview = data.rows || [];
      state.importMeta = { validCount: data.validCount, invalidCount: data.invalidCount };
      return;
    }
    if (file) {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        state.importPreview = [];
        throw new Error("CSV 格式无效");
      }
      const headers = parsed[0].map((h) => h.replace(/\s/g, "").toLowerCase());
      state.importPreview = parsed.slice(1).map((cells, idx) => {
        const get = (keys) => {
          for (const k of keys) {
            const i = headers.indexOf(k);
            if (i >= 0) return cells[i] || "";
          }
          return "";
        };
        const id = get(["学号", "studentid", "id"]);
        const valid = Boolean(get(["姓名", "name"]) && id);
        return {
          name: get(["姓名", "name"]),
          id,
          college: get(["学院", "college"]),
          className: get(["班级", "classname"]),
          courseCode: get(["课程代码", "coursecode"]),
          section: get(["section"]),
          enrollmentStatus: get(["选课状态", "enrollmentstatus"]) || "已选",
          valid,
          status: valid ? "可导入" : "字段缺失",
          rowIndex: idx,
        };
      });
      return;
    }
    state.importPreview = demoImportRows();
  }

  async function confirmImport() {
    const cid = await ensureCourseId();
    const validRows = state.importPreview.filter((r) => r.valid);
    if (!validRows.length) throw new Error("没有可导入的行");
    if (hasApi()) {
      const data = await apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/students/import/confirm`, {
        method: "POST",
        body: JSON.stringify({ rows: validRows }),
      });
      setNotice(`导入完成：成功 ${data.importedCount} 人，拒绝 ${data.rejectedCount} 人`);
    } else {
      setNotice(`演示模式：已模拟导入 ${validRows.length} 名学生`);
    }
    state.importPreview = [];
    if (typeof API.syncFromBackend === "function") await API.syncFromBackend();
  }

  function downloadImportTemplate() {
    const csv = "姓名,学号,学院,班级,课程代码,Section,选课状态\n吴嘉琪,22301888,工商管理学院,2026A,PE101,001,已选\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "roster-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Attendance scores ───────────────────────────────────────────

  async function loadAttendanceRows() {
    const cid = await ensureCourseId();
    if (!cid) {
      state.attendanceRows = [];
      return;
    }
    if (hasApi()) {
      state.attendanceRows = await apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/students`);
      return;
    }
    const roster = await API.getStudentRoster({ courseId: cid });
    state.attendanceRows = (roster.records || []).map((s, i) => ({
      id: s.no,
      name: s.name,
      attendance: 80 + (i % 5) * 2,
      week6: "出勤",
      week7: i % 3 === 0 ? "迟到" : "出勤",
    }));
  }

  async function renderAttendanceScores() {
    await loadAttendanceRows();
    const courses = await getCourses();
    const root = document.getElementById(rootId("attendance-scores"));
    if (!root) return;

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="toolbar-inline">
        <select class="field-input" id="legacy-attendance-course">${courses.map((c) => `<option value="${esc(c.id)}"${c.id === state.courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <button class="btn btn-primary" type="button" data-legacy-action="attendance-save">批量保存</button>
      </div>
      <div class="box">
        <form id="legacy-attendance-form">
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>学生</th><th>第 6 周</th><th>第 7 周</th><th>表现分</th></tr></thead>
              <tbody>
                ${state.attendanceRows.length
                  ? state.attendanceRows
                      .map(
                        (s) => `<tr>
                      <td><strong>${esc(s.name)}</strong><br><small>${esc(s.id)}</small></td>
                      <td><select class="field-input field-input-sm" name="week6_${esc(s.id)}">
                        ${["出勤", "迟到", "请假", "缺勤"].map((v) => `<option${(s.week6 || "出勤") === v ? " selected" : ""}>${v}</option>`).join("")}
                      </select></td>
                      <td><select class="field-input field-input-sm" name="week7_${esc(s.id)}">
                        ${["出勤", "迟到", "请假", "缺勤"].map((v) => `<option${(s.week7 || "出勤") === v ? " selected" : ""}>${v}</option>`).join("")}
                      </select></td>
                      <td><input class="field-input field-input-sm" type="number" min="0" max="100" name="score_${esc(s.id)}" value="${esc(s.attendance ?? 0)}" /></td>
                    </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="4" class="table-empty">暂无数据</td></tr>`}
              </tbody>
            </table>
          </div>
        </form>
      </div>
      </div>`;
  }

  async function saveAttendanceScores() {
    const cid = await ensureCourseId();
    const form = document.getElementById("legacy-attendance-form");
    if (!form) return;
    const rows = state.attendanceRows.map((s) => ({
      studentId: s.id,
      score: Number(form.querySelector(`[name="score_${s.id}"]`)?.value || 0),
    }));
    if (hasApi()) {
      await apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/scores/attendance`, {
        method: "PUT",
        body: JSON.stringify({ rows }),
      });
      setNotice("签到平时分已保存");
    } else {
      setNotice(`演示模式：已保存 ${rows.length} 名学生的平时分`);
    }
    await renderAttendanceScores();
  }

  // ── Grade export ────────────────────────────────────────────────

  async function loadExportPrecheck() {
    const cid = await ensureCourseId();
    if (!cid) {
      state.exportPrecheck = null;
      return;
    }
    if (hasApi()) {
      state.exportPrecheck = await apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/export/precheck`);
      return;
    }
    state.exportPrecheck = {
      missingPhysical: [{ name: "王五" }],
      checkinNotEnough: [{ name: "赵六" }],
      unresolvedReviews: [],
      templateMatched: true,
    };
  }

  function exportBlocked(issues) {
    if (!issues) return true;
    return (
      (issues.missingPhysical?.length || 0) +
        (issues.checkinNotEnough?.length || 0) +
        (issues.unresolvedReviews?.length || 0) +
        (issues.templateMatched === false ? 1 : 0) >
      0
    );
  }

  async function renderGradeExport() {
    await loadExportPrecheck();
    const courses = await getCourses();
    const issues = state.exportPrecheck || {};
    const blocked = exportBlocked(issues);
    const root = document.getElementById(rootId("grade-export"));
    if (!root) return;

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="rules-banner">
        <strong>成绩导出说明</strong>
        <span>归档由管理员发起；本页仅自定义导出 Excel/CSV，可查看预检结果供参考。</span>
      </div>
      <div class="toolbar-inline">
        <select class="field-input" id="legacy-export-course">${courses.map((c) => `<option value="${esc(c.id)}"${c.id === state.courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <button class="btn btn-secondary" type="button" data-legacy-action="export-view-precheck">查看预检结果</button>
        <button class="btn ${blocked ? "btn-secondary" : "btn-primary"}" type="button" data-legacy-action="export-download"${blocked ? " disabled" : ""}>下载成绩 CSV</button>
      </div>
      <div class="rules-banner${blocked ? " rules-banner-danger" : ""}">
        <strong>${blocked ? "预检未通过" : "预检已通过"}</strong>
        <span>${blocked ? "下列问题供参考；如需正式归档请联系管理员。" : "预检检查已通过，可以下载自定义成绩 CSV。"}</span>
      </div>
      <div class="box">
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>检查项</th><th>详情</th><th>建议</th></tr></thead>
            <tbody>
              <tr><td>缺少 / 低体测</td><td>${formatNameList(issues.missingPhysical)}</td><td>补录体测原始数据</td></tr>
              <tr><td>打卡未满</td><td>${formatNameList(issues.checkinNotEnough)}</td><td>提醒学生补齐学时</td></tr>
              <tr><td>异常未处理</td><td>${formatNameList(issues.unresolvedReviews)}</td><td>进入审核工作台处理</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      </div>`;
  }

  async function downloadGradeCsv() {
    const cid = await ensureCourseId();
    const sort = global.SortStudents?.getRosterSort?.() || "import";
    if (hasApi()) {
      const auth = Auth.readAuth();
      const base = (auth?.apiBaseUrl || global.location.origin).replace(/\/$/, "");
      const resp = await fetch(
        `${base}/api/teacher/courses/${encodeURIComponent(cid)}/export?sort=${encodeURIComponent(sort)}`,
        {
          headers: auth?.token ? { Authorization: `Bearer ${auth.token}` } : {},
        }
      );
      if (!resp.ok) throw new Error(await resp.text());
      const blob = await resp.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${cid}-grades.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      setNotice("成绩 CSV 已下载");
      return;
    }
    const summary = await API.getGradeSummary({ courseId: cid });
    let rows = summary.records || [];
    if (global.SortStudents) rows = SortStudents.sortStudents(rows, sort);
    const header = "studentId,studentName,checkinPercent,endurancePercent,physical,final,total\n";
    const body = rows
      .map((r) => {
        const checkin = r.checkinPercent ?? r.regularScore ?? "";
        const endurance = r.endurancePercent ?? "";
        const physical = r.physicalScore ?? "";
        const fin = r.finalScore ?? "";
        const total = r.totalScore ?? "";
        return `${r.no || r.studentId},${r.name},${checkin},${endurance},${physical},${fin},${total}`;
      })
      .join("\n");
    const csv = header + body + "\n";
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "demo-grades.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    setNotice(`演示模式：已按「${global.SortStudents?.sortLabel?.(sort) || sort}」下载 CSV`);
  }

  async function viewExportPrecheck() {
    await loadExportPrecheck();
    const issues = state.exportPrecheck || {};
    const blocked = exportBlocked(issues);
    setNotice(blocked ? "预检未通过，下列问题供参考" : "预检已通过，可以下载 CSV");
    await renderGradeExport();
  }

  // ── Student detail ──────────────────────────────────────────────

  async function loadStudentList() {
    const cid = await ensureCourseId();
    if (!cid) return [];
    if (hasApi()) {
      return apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/students`);
    }
    const roster = await API.getStudentRoster({ courseId: cid });
    return (roster.records || []).map((s) => ({ id: s.no, name: s.name, course: 8, general: 6, exam: 85, attendance: 90, physical: 88, status: "进行中" }));
  }

  async function loadHoursDetail(studentId) {
    const cid = await ensureCourseId();
    if (!cid || !studentId) {
      state.studentHoursDetail = null;
      return;
    }
    if (hasApi()) {
      state.studentHoursDetail = await apiFetch(
        `/api/teacher/courses/${encodeURIComponent(cid)}/students/${encodeURIComponent(studentId)}/hours-detail`
      );
      return;
    }
    state.studentHoursDetail = {
      studentId,
      summary: { studentSubmitted: 6, totalApplied: 8, teamOffset: 2, clubOffset: 0, manualCredit: 0, totalApproved: 9 },
      items: [
        { sourceType: "学生自提交（课程相关）", sportType: "跑步", appliedHours: 2, approvedHours: 2, submittedAt: "2026-03-01", status: "有效" },
        { sourceType: "校队抵扣", sportType: "篮球", appliedHours: 10, approvedHours: 2, submittedAt: "2026-02-15", status: "可抵扣" },
      ],
    };
  }

  async function renderStudentDetail() {
    const students = await loadStudentList();
    if (!state.studentDetailId && students[0]) state.studentDetailId = students[0].id;
    await loadHoursDetail(state.studentDetailId);
    const courses = await getCourses();
    const student = students.find((s) => s.id === state.studentDetailId);
    const detail = state.studentHoursDetail;
    const root = document.getElementById(rootId("student-detail"));
    if (!root) return;

    const summary = detail?.summary || {};
    const items = detail?.items || [];

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="toolbar-inline">
        <select class="field-input" id="legacy-detail-course">${courses.map((c) => `<option value="${esc(c.id)}"${c.id === state.courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
        <select class="field-input" id="legacy-detail-student">${students.map((s) => `<option value="${esc(s.id)}"${s.id === state.studentDetailId ? " selected" : ""}>${esc(s.name)} (${esc(s.id)})</option>`).join("")}</select>
      </div>
      <div class="two-col">
        <div class="box">
          <h2 class="h2">学时来源明细</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>来源</th><th>运动类型</th><th>申请</th><th>审批</th><th>状态</th><th>提交时间</th></tr></thead>
              <tbody>
                ${items.length
                  ? items
                      .map(
                        (r) => `<tr>
                      <td>${esc(r.sourceType)}</td><td>${esc(r.sportType || "—")}</td>
                      <td>${esc(r.appliedHours)}h</td><td>${esc(r.approvedHours)}h</td>
                      <td><span class="badge ${statusCls(r.status)}">${esc(r.status)}</span></td>
                      <td>${esc(r.submittedAt || "—")}</td>
                    </tr>`
                      )
                      .join("")
                  : `<tr><td colspan="6" class="table-empty">暂无数据</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
        <div class="detail-stack">
          <div class="box">
            <h2 class="h2">学生信息</h2>
            ${student
              ? `<div class="detail-kv">
              <div>学号：${esc(student.id)}</div>
              <div>姓名：${esc(student.name)}</div>
              <div>状态：<span class="badge ${statusCls(student.status)}">${esc(student.status || "—")}</span></div>
            </div>`
              : `<p class="table-empty">暂无数据</p>`}
          </div>
          <div class="box">
            <h2 class="h2">学时汇总</h2>
            <div class="detail-kv">
              <div>学生自提交：${Number(summary.studentSubmitted || 0).toFixed(1)}h</div>
              <div>校队抵扣：${Number(summary.teamOffset || 0).toFixed(1)}h</div>
              <div>社团抵扣：${Number(summary.clubOffset || 0).toFixed(1)}h</div>
              <div>手动加抵：${Number(summary.manualCredit || 0).toFixed(1)}h</div>
              <div><strong>合计有效：${Number(summary.totalApproved || 0).toFixed(1)}h</strong></div>
            </div>
          </div>
          ${student
            ? `<div class="box">
            <h2 class="h2">成绩进度</h2>
            <div class="detail-kv">
              <div>课程相关：${esc(student.course ?? 0)}h</div>
              <div>其他运动：${esc(student.general ?? 0)}h</div>
              <div>考试：${esc(student.exam ?? "—")}</div>
              <div>出勤：${esc(student.attendance ?? "—")}</div>
              <div>体测：${esc(student.physical ?? "—")}</div>
            </div>
          </div>`
            : ""}
        </div>
      </div>
      </div>`;
  }

  // ── Pending certifications ─────────────────────────────────────

  async function loadPendingCerts() {
    const cid = await ensureCourseId();
    if (!cid) {
      state.pendingCerts = [];
      return;
    }
    if (hasApi()) {
      const data = await apiFetch(`/api/teacher/courses/${encodeURIComponent(cid)}/pending-certifications`);
      state.pendingCerts = data.items || [];
      return;
    }
    state.pendingCerts = demoPendingCerts();
  }

  function readCertHours(certId) {
    const course = Number(document.getElementById(`cert-course-hours-${certId}`)?.value || 0);
    const general = Number(document.getElementById(`cert-general-hours-${certId}`)?.value || 0);
    return { course, general, total: course + general };
  }

  async function renderPendingCertifications() {
    await loadPendingCerts();
    const courses = await getCourses();
    const pending = state.pendingCerts.filter((m) => (m.offset_status || m.offset) === "待确认");
    const root = document.getElementById(rootId("pending-certifications"));
    if (!root) return;

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="toolbar-inline">
        <select class="field-input" id="legacy-certs-course">${courses.map((c) => `<option value="${esc(c.id)}"${c.id === state.courseId ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
      </div>
      <div class="box">
        <h2 class="h2">待确认抵扣（${pending.length}）</h2>
        <p class="box-hint">课程运动与自主运动合计不得超过 20 小时。确认 / 驳回由授课老师直接完成。</p>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>学生</th><th>组织</th><th>类型</th><th>课程运动(h)</th><th>自主运动(h)</th><th>合计</th><th>操作</th></tr></thead>
            <tbody>
              ${pending.length
                ? pending
                    .map((m) => {
                      const name = m.student_name || m.studentName || "";
                      const sid = m.student_id || m.studentId || "";
                      const courseHours = 0;
                      const generalHours = m.offset_hours ?? m.offsetHours ?? 10;
                      const total = courseHours + generalHours;
                      return `<tr>
                    <td><strong>${esc(name)}</strong><br><small>${esc(sid)}</small></td>
                    <td>${esc(m.organization || "—")}</td>
                    <td>${m.type === "team" ? "校队" : "社团"}</td>
                    <td><input class="field-input field-input-sm field-input-narrow" type="number" min="0" max="20" step="0.5" id="cert-course-hours-${esc(m.id)}" value="${esc(courseHours)}" /></td>
                    <td><input class="field-input field-input-sm field-input-narrow" type="number" min="0" max="20" step="0.5" id="cert-general-hours-${esc(m.id)}" value="${esc(generalHours)}" /></td>
                    <td><strong>${esc(total)}</strong></td>
                    <td>
                      <button class="btn btn-primary" type="button" data-legacy-action="cert-confirm" data-cert-id="${esc(m.id)}">确认生效</button>
                      <button class="btn btn-secondary btn-danger-outline" type="button" data-legacy-action="cert-reject" data-cert-id="${esc(m.id)}">驳回</button>
                    </td>
                  </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="7" class="table-empty">暂无数据</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      </div>`;
  }

  async function confirmCert(certId, reject) {
    if (!reject) {
      const { course, general, total } = readCertHours(certId);
      if (total > 20) {
        setNotice(`合计 ${total}h 超过上限 20h，请调整课程运动或自主运动小时后再确认`, "danger");
        await renderPendingCertifications();
        return;
      }
      if (hasApi()) {
        await apiFetch(`/api/teacher/certifications/${encodeURIComponent(certId)}/confirm`, {
          method: "PUT",
          body: JSON.stringify({ courseHours: course, generalHours: general, adjustedHours: total }),
        });
      } else {
        state.pendingCerts = state.pendingCerts.filter((m) => m.id !== certId);
        setNotice(`抵扣已确认：课程运动 ${course}h，自主运动 ${general}h（合计 ${total}h）`);
        await renderPendingCertifications();
        return;
      }
    } else if (hasApi()) {
      await apiFetch(`/api/teacher/certifications/${encodeURIComponent(certId)}/reject`, {
        method: "PUT",
        body: JSON.stringify({ reason: "教师驳回" }),
      });
    } else {
      state.pendingCerts = state.pendingCerts.filter((m) => m.id !== certId);
    }
    setNotice(reject ? "已驳回抵扣申请" : "抵扣已确认生效");
    await renderPendingCertifications();
  }

  // ── Endurance scoring ───────────────────────────────────────────

  async function renderEnduranceScoring() {
    const root = document.getElementById(rootId("endurance-scoring"));
    if (!root) return;
    const result = state.scoringResult;

    root.innerHTML = `
      <div class="legacy-stack">
      ${renderNotice()}
      <div class="two-col">
        <div class="box">
          <h2 class="h2">耐力跑成绩换算</h2>
          <form id="legacy-scoring-form" class="form-grid">
            <label class="field"><span class="field-label">性别</span>
              <select class="field-input" name="gender"><option value="male">男</option><option value="female">女</option></select>
            </label>
            <label class="field"><span class="field-label">年级</span>
              <select class="field-input" name="gradeLevel">
                <option value="freshman">大一</option><option value="sophomore">大二</option>
                <option value="junior">大三</option><option value="senior">大四</option>
              </select>
            </label>
            <label class="field"><span class="field-label">分钟</span><input class="field-input" name="minutes" type="number" min="0" max="10" value="3" /></label>
            <label class="field"><span class="field-label">秒</span><input class="field-input" name="seconds" type="number" min="0" max="59" value="30" /></label>
            <div class="form-actions"><button class="btn btn-primary" type="submit">开始换算</button></div>
          </form>
          ${result
            ? `<div class="rules-banner">
              <strong>试算结果：${esc(result.score)} 分（${esc(result.tier || "—")}）</strong>
              <span>用时 ${Math.floor(result.timeSeconds / 60)}′${String(result.timeSeconds % 60).padStart(2, "0")}″ · <em>试算，非正式成绩</em></span>
            </div>`
            : ""}
        </div>
        <div class="box">
          <h2 class="h2">评分表参考</h2>
          <p class="box-hint">1000 米 / 800 米耐力跑国标换算。用时越短分数越高，及格线约 4′30″–4′34″。</p>
          <div class="table-wrap table-scroll-sm">
            <table class="data-table data-table-sm">
              <thead><tr><th>等级</th><th>分数</th><th>大一大二男</th><th>大一大二女</th></tr></thead>
              <tbody>
                <tr><td>优秀</td><td>100</td><td>3′17″</td><td>3′18″</td></tr>
                <tr><td>良好</td><td>80</td><td>3′42″</td><td>3′44″</td></tr>
                <tr><td>及格</td><td>60</td><td>4′32″</td><td>4′34″</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>`;
  }

  async function runScoring(form) {
    const minutes = Number(form.minutes.value || 0);
    const seconds = Number(form.seconds.value || 0);
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 59) {
      throw new Error("秒须为 0–59 的整数");
    }
    const timeSeconds = minutes * 60 + seconds;
    const body = { timeSeconds, gender: form.gender.value, gradeLevel: form.gradeLevel.value };
    if (hasApi()) {
      state.scoringResult = await apiFetch("/api/scoring/convert-endurance", { method: "POST", body: JSON.stringify(body) });
    } else {
      const demoScore = Math.max(10, Math.min(100, 100 - Math.max(0, timeSeconds - 197)));
      state.scoringResult = { ...body, score: demoScore, tier: demoScore >= 90 ? "优秀" : demoScore >= 60 ? "及格" : "不及格" };
    }
    setNotice("");
    await renderEnduranceScoring();
  }

  // ── Router ──────────────────────────────────────────────────────

  const renderers = {
    "roster-import": renderRosterImport,
    "attendance-scores": renderAttendanceScores,
    "grade-export": renderGradeExport,
    "student-detail": renderStudentDetail,
    "pending-certifications": renderPendingCertifications,
    "endurance-scoring": renderEnduranceScoring,
  };

  async function render(pageId, options = {}) {
    if (!LEGACY_PAGES.has(pageId)) return false;
    setNotice("");
    if (options.courseId) state.courseId = options.courseId;
    if (options.studentId) state.studentDetailId = options.studentId;
    await ensureCourseId(options.courseId);
    const fn = renderers[pageId];
    if (fn) await fn();
    return true;
  }

  function bindCourseChange(selectId, pageId) {
    const sel = document.getElementById(selectId);
    if (!sel || sel.dataset.legacyBound) return;
    sel.dataset.legacyBound = "1";
    sel.addEventListener("change", async (e) => {
      state.courseId = e.target.value;
      state.notice = "";
      await render(pageId);
    });
  }

  async function handleAction(action, el) {
    try {
      if (action === "import-preview") {
        const file = document.getElementById("legacy-import-file")?.files?.[0];
        await previewImport(file);
        setNotice(file ? "预检完成" : "已加载演示预检数据");
        await renderRosterImport();
      } else if (action === "import-template") {
        downloadImportTemplate();
      } else if (action === "import-confirm") {
        await confirmImport();
        await renderRosterImport();
      } else if (action === "attendance-save") {
        await saveAttendanceScores();
      } else if (action === "export-view-precheck") {
        await viewExportPrecheck();
      } else if (action === "export-download") {
        await downloadGradeCsv();
        await renderGradeExport();
      } else if (action === "cert-confirm") {
        await confirmCert(el.dataset.certId, false);
      } else if (action === "cert-reject") {
        await confirmCert(el.dataset.certId, true);
      }
    } catch (err) {
      alert(err.message || String(err));
    }
  }

  function bindOnce(showPage) {
    if (eventsBound) return;
    eventsBound = true;
    showPageRef = showPage;

    document.body.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-legacy-action]");
      if (!btn) return;
      e.preventDefault();
      await handleAction(btn.dataset.legacyAction, btn);
    });

    document.body.addEventListener("change", async (e) => {
      if (e.target.id === "legacy-import-course") {
        state.courseId = e.target.value;
        await renderRosterImport();
      } else if (e.target.id === "legacy-attendance-course") {
        state.courseId = e.target.value;
        await renderAttendanceScores();
      } else if (e.target.id === "legacy-export-course") {
        state.courseId = e.target.value;
        await renderGradeExport();
      } else if (e.target.id === "legacy-detail-course") {
        state.courseId = e.target.value;
        state.studentDetailId = "";
        await renderStudentDetail();
      } else if (e.target.id === "legacy-detail-student") {
        state.studentDetailId = e.target.value;
        await renderStudentDetail();
      } else if (e.target.id === "legacy-certs-course") {
        state.courseId = e.target.value;
        await renderPendingCertifications();
      }
    });

    document.body.addEventListener("submit", async (e) => {
      if (e.target.id === "legacy-scoring-form") {
        e.preventDefault();
        try {
          await runScoring(e.target);
        } catch (err) {
          alert(err.message || String(err));
        }
      }
    });

    document.body.addEventListener("click", (e) => {
      const link = e.target.closest("[data-legacy-page]");
      if (!link || !showPageRef) return;
      e.preventDefault();
      const pageId = link.dataset.legacyPage;
      const opts = {};
      if (link.dataset.studentId) opts.studentId = link.dataset.studentId;
      if (link.dataset.courseId) opts.courseId = link.dataset.courseId;
      showPageRef(pageId, opts);
    });
  }

  global.LegacyPages = {
    isLegacyPage(pageId) {
      return LEGACY_PAGES.has(pageId);
    },
    render,
    bindOnce,
    setContext(ctx = {}) {
      if (ctx.courseId) state.courseId = ctx.courseId;
      if (ctx.studentId) state.studentDetailId = ctx.studentId;
    },
  };
})(window);
