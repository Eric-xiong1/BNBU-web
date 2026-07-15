(function () {
  const STATUS_LABEL = {
    checked: { text: "已通过", cls: "status-ok" },
    unchecked: { text: "未提交", cls: "status-warn" },
    pending_review: { text: "待审核", cls: "status-pending" },
    rejected: { text: "已驳回", cls: "status-warn" },
  };

  const AUDIT_STATUS = {
    pending: "待审核",
    reviewing: "审核中",
    approved: "已通过",
    rejected: "已驳回",
  };

  const ROLE_HOME = {
    sports_teacher: "home",
    dept_head: "home",
    team_teacher: "audit-workbench",
    club_teacher: "home",
    super_admin: "home",
  };

  const ROLE_AUDIT_TAB = {
    sports_teacher: ["checkin_review", "exempt_test", "exempt_exam"],
    dept_head: ["checkin_review", "exempt_test", "exempt_exam"],
    team_teacher: ["exempt_test"],
    club_teacher: [],
    super_admin: ["checkin_review", "exempt_test", "exempt_exam"],
  };

  let currentRole = "sports_teacher";
  let selectedDate = todayStr();
  let checkinState = { level: 1, classId: null, className: "", studentId: null, studentName: "" };
  let resetCheckinOnEnter = false;
  let matrixCourseId = null;
  let studentFilter = "all";
  let studentSearch = "";
  let auditTab = "checkin_review";
  let auditDetail = null;
  let auditEvidenceViewed = false;
  let auditDetailSource = null;
  let selectedEvidenceIdx = 0;
  let physicalCourseId = "";
  let physicalClassId = "";
  let physicalStatus = "all";
  let physicalSearch = "";
  let physicalEntryId = null;
  let gradeCourseId = "";
  let gradeClassId = "";
  let gradeWeightsCourseId = "c1";
  let basicCourseId = "";
  let basicClassId = "";
  let basicStudentSearch = "";
  let finalItemsDraft = null;
  let finalClassId = "";
  let finalStatus = "all";
  let finalSearch = "";
  let finalEntryId = null;
  let finalCourseId = "";
  let finalItemsCourseId = "c1";
  let lastSettingsSnapshot = null;
  let lastGradeRecords = [];
  let settingsTimeWindowMounted = false;

  const pages = document.querySelectorAll(".page");
  const navItems = document.querySelectorAll(".nav-item[data-page]");
  const groupTitles = document.querySelectorAll(".nav-group-title[data-group]");

  const pageToGroup = {
    "checkin-overview": "checkin",
    "checkin-matrix": "checkin",
    "checkin-settings": "checkin",
    "checkin-history": "checkin",
    "audit-workbench": "audit",
    "exam-physical": "exam",
    "exam-final": "exam",
    "exam-final-items": "exam",
    "grade-summary": "exam",
    "course-tasks": "course-mgmt",
    "roster-import": "course-mgmt",
    "attendance-scores": "course-mgmt",
    "grade-export": "course-mgmt",
    "student-detail": "course-mgmt",
    "pending-certifications": "course-mgmt",
    "endurance-scoring": "course-mgmt",
    "basic-courses": "basic",
    "basic-students": "basic",
    "admin-permissions": "admin",
  };

  function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function syncDateInputs() {
    const homeDate = document.getElementById("home-date");
    const checkinDate = document.getElementById("checkin-date");
    if (homeDate) homeDate.value = selectedDate;
    if (checkinDate) checkinDate.value = selectedDate;
  }

  function setSelectedDate(date) {
    selectedDate = date;
    syncDateInputs();
  }

  function canAccess(pageId) {
    const item = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (!item || item.hidden) return false;
    const roles = item.dataset.roles || "all";
    if (roles === "all") return true;
    return roles.split(",").includes(currentRole);
  }

  function applyRoleMenu() {
    document.querySelectorAll("[data-roles]").forEach((el) => {
      const roles = el.dataset.roles;
      const show = roles === "all" || roles.split(",").includes(currentRole);
      el.hidden = !show;
    });

    const allowedTabs = ROLE_AUDIT_TAB[currentRole] || ROLE_AUDIT_TAB.sports_teacher;
    document.querySelectorAll("#audit-tabs .tab").forEach((tab) => {
      tab.hidden = !allowedTabs.includes(tab.dataset.tab);
    });
    if (!allowedTabs.includes(auditTab)) auditTab = allowedTabs[0] || "checkin_review";
  }

  function activatePage(pageId) {
    if (!canAccess(pageId)) {
      alert("当前角色无权访问该页面");
      return false;
    }
    pages.forEach((p) => p.classList.toggle("active", p.id === "page-" + pageId));
    navItems.forEach((item) => {
      if (!item.hidden) item.classList.toggle("active", item.dataset.page === pageId);
    });
    groupTitles.forEach((title) => {
      const gid = title.dataset.group;
      title.classList.toggle("active", pageToGroup[pageId] === gid);
    });
    window.scrollTo(0, 0);
    return true;
  }

  function showPage(pageId, options = {}) {
    if (!activatePage(pageId)) return;

    if (pageId === "home") renderHome();
    if (pageId === "checkin-overview") enterCheckinOverview(options);
    if (pageId === "checkin-matrix") renderMatrix();
    if (pageId === "checkin-settings") renderSettings();
    if (pageId === "checkin-history") renderHistory();
    if (pageId === "audit-workbench") renderAudit();
    if (pageId === "exam-physical") renderPhysical();
    if (pageId === "exam-final") renderFinalExam();
    if (pageId === "exam-final-items") renderFinalItemsConfig();
    if (pageId === "grade-summary") renderGradeSummary();
    if (pageId === "admin-permissions") renderPermissions();
    if (pageId === "basic-courses") renderBasicCourses();
    if (pageId === "basic-students") renderBasicStudents();
    if (window.LegacyPages?.isLegacyPage(pageId)) {
      window.LegacyPages.render(pageId, options);
    }
  }

  async function enterCheckinOverview(options = {}) {
    if (options.drillTo) {
      resetCheckinOnEnter = false;
      await drillToStudents(options.drillTo.id, options.drillTo.name);
      return;
    }
    if (resetCheckinOnEnter) {
      resetCheckinDrill();
      resetCheckinOnEnter = false;
      return;
    }
    if (checkinState.level === 2 && checkinState.classId) {
      showCheckinLevel(2);
      updateBreadcrumb();
      await renderStudentTable();
      return;
    }
    if (checkinState.level === 3 && checkinState.studentId) {
      showCheckinLevel(3);
      updateBreadcrumb();
      await drillToEvidence(checkinState.studentId, checkinState.studentName, { restore: true });
      return;
    }
    resetCheckinDrill();
  }

  function showCheckinLevel(level) {
    document.getElementById("checkin-level-1").hidden = level !== 1;
    document.getElementById("checkin-level-2").hidden = level !== 2;
    document.getElementById("checkin-level-3").hidden = level !== 3;
    checkinState.level = level;
  }

  function bindNavigation() {
    document.querySelectorAll("[data-page]:not(.nav-item):not(.nav-group-title)").forEach((el) => {
      el.addEventListener("click", (e) => {
        const pageId = el.dataset.page;
        if (!pageId) return;
        e.preventDefault();
        showPage(pageId);
      });
      if (el.classList.contains("clickable-box")) {
        el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            showPage(el.dataset.page);
          }
        });
      }
    });
  }

  function formatSemesterHours(s) {
    let html = `<strong>${s.approvedHours}</strong> / ${s.semesterRequired}h`;
    if (s.pendingHours) html += `<br><small class="box-hint">+${s.pendingHours}h 待审</small>`;
    if (s.specialtyRequired != null) {
      html += `<br><small class="box-hint">专项 ${s.specialtyHours}/${s.specialtyRequired}h</small>`;
    }
    return html;
  }

  function renderKpiCards(container, stats) {
    container.innerHTML = `
      <div class="kpi-card"><span class="kpi-label">待审核</span><span class="kpi-value kpi-warn">${stats.pendingReview}</span></div>
      <div class="kpi-card"><span class="kpi-label">进度达标</span><span class="kpi-value">${stats.onTrack}</span></div>
      <div class="kpi-card"><span class="kpi-label">进度不足</span><span class="kpi-value">${stats.behind}</span></div>
      <div class="kpi-card kpi-accent"><span class="kpi-label">平均进度</span><span class="kpi-value">${Math.round(stats.avgProgress * 100)}%</span></div>`;
  }

  function sumStats(list) {
    const agg = list.reduce(
      (a, c) => {
        const s = c.stats;
        a.pendingReview += s.pendingReview;
        a.onTrack += s.onTrack;
        a.behind += s.behind;
        a.total += c.total;
        a.progressSum += s.avgProgress * c.total;
        return a;
      },
      { pendingReview: 0, onTrack: 0, behind: 0, total: 0, avgProgress: 0, progressSum: 0 }
    );
    agg.avgProgress = agg.total ? agg.progressSum / agg.total : 0;
    return agg;
  }

  function renderClassCards(container, classes, onClick) {
    if (!classes.length) {
      container.innerHTML = `<p class="box-hint">暂无班级数据</p>`;
      return;
    }
    container.innerHTML = classes
      .map((c) => {
        const s = c.stats;
        return `
          <button type="button" class="class-card" data-class-id="${c.id}" data-class-name="${c.name}">
            <div class="class-card-head">
              <strong>${c.name}</strong>
              <span class="rate-badge">${Math.round(s.avgProgress * 100)}%</span>
            </div>
            <div class="class-card-stats">
              <span class="status-ok">达标 ${s.onTrack}</span>
              <span class="status-warn">不足 ${s.behind}</span>
              <span class="status-pending">待审 ${s.pendingReview}</span>
            </div>
            <div class="progress-bar-wrap"><div class="progress-bar" style="width:${Math.round(s.avgProgress * 100)}%"></div></div>
          </button>`;
      })
      .join("");

    container.querySelectorAll(".class-card").forEach((card) => {
      card.addEventListener("click", () => onClick(card.dataset.classId, card.dataset.className));
    });
  }

  async function renderHome() {
    const user = await API.getCurrentUser();
    document.getElementById("greeting-text").textContent = `你好，${user.name}（${roleLabel(currentRole)}）`;

    syncDateInputs();
    const classes = await API.getCheckinOverview({ date: selectedDate });
    renderKpiCards(document.getElementById("home-kpi"), sumStats(classes));

    renderClassCards(document.getElementById("home-class-cards"), classes, (id, name) => {
      showPage("checkin-overview", { drillTo: { id, name } });
    });

    const pending = await API.getAuditPendingSummary();
    document.getElementById("home-pending-audit").textContent =
      `打卡待审 ${pending.checkin} · 免测 ${pending.exemptTest} · 免考 ${pending.exemptExam}`;
  }

  function roleLabel(role) {
    return {
      sports_teacher: "体育老师",
      dept_head: "体育部主任",
      team_teacher: "校队老师",
      club_teacher: "社团指导老师",
      super_admin: "超级管理员",
    }[role] || role;
  }

  /** 打卡页状态：仅反映当日提交与审核，不含免测/免考 */
  function getCheckinStatusBadges(s) {
    if (s.todayReview === "pending") return [STATUS_LABEL.pending_review];
    if (s.todayReview === "approved") return [STATUS_LABEL.checked];
    if (s.todayReview === "rejected") return [STATUS_LABEL.rejected];
    if (!s.todaySubmitted) return [STATUS_LABEL.unchecked];
    return [STATUS_LABEL.unchecked];
  }

  function getHistoryProgressBadge(r) {
    if (r.progress >= 1) return [{ text: "已满", cls: "status-ok" }];
    if (r.pendingHours > 0) return [{ text: "有待审", cls: "status-pending" }];
    return [{ text: "进行中", cls: "status-info" }];
  }

  function renderStatusCell(s) {
    return `<td><div class="badge-group">${getCheckinStatusBadges(s)
      .map((b) => `<span class="badge ${b.cls}">${b.text}</span>`)
      .join("")}</div></td>`;
  }

  function matchesStudentFilter(s, filter) {
    if (filter === "all") return true;
    if (filter === "checked") return s.todayReview === "approved";
    if (filter === "unchecked") return !s.todaySubmitted;
    if (filter === "pending_review") return s.todayReview === "pending";
    return true;
  }

  function needsCheckinPhoto(s) {
    return !s.todaySubmitted;
  }

  function resetCheckinDrill() {
    checkinState = { level: 1, classId: null, className: "", studentId: null, studentName: "" };
    studentFilter = "all";
    studentSearch = "";
    const searchEl = document.getElementById("student-search");
    if (searchEl) searchEl.value = "";
    document.querySelectorAll("#status-filter .chip").forEach((c) => {
      c.classList.toggle("active", c.dataset.status === "all");
    });
    showCheckinLevel(1);
    updateBreadcrumb();
    loadCheckinLevel1();
  }

  function updateBreadcrumb() {
    const bc = document.getElementById("checkin-breadcrumb");
    let html = `<button type="button" class="crumb ${checkinState.level === 1 ? "active" : ""}" data-level="1">班级总览</button>`;
    if (checkinState.level >= 2) {
      html += `<span class="crumb-sep">›</span><button type="button" class="crumb ${checkinState.level === 2 ? "active" : ""}" data-level="2">${checkinState.className}</button>`;
    }
    if (checkinState.level >= 3) {
      html += `<span class="crumb-sep">›</span><button type="button" class="crumb active" data-level="3">${checkinState.studentName}</button>`;
    }
    bc.innerHTML = html;
    bc.querySelectorAll(".crumb").forEach((btn) => {
      btn.addEventListener("click", () => {
        const lv = Number(btn.dataset.level);
        if (lv === 1) resetCheckinDrill();
        else if (lv === 2) drillToStudents(checkinState.classId, checkinState.className);
      });
    });
  }

  async function loadCheckinLevel1() {
    const courseId = document.getElementById("checkin-course-filter").value;
    const classes = await API.getCheckinOverview({ courseId, date: selectedDate });
    renderClassCards(document.getElementById("checkin-class-list"), classes, drillToStudents);

    const heatmapEl = document.getElementById("checkin-heatmap");
    const hm = await API.getCheckinHeatmap(checkinState.classId || "cl1", selectedDate.slice(0, 7));
    heatmapEl.innerHTML = hm.values
      .map((v, i) => {
        const level = v >= 0.85 ? 4 : v >= 0.7 ? 3 : v >= 0.5 ? 2 : 1;
        return `<button type="button" class="heat-cell l${level}" data-heat-idx="${i}" title="${Math.round(v * 100)}%"></button>`;
      })
      .join("");

    heatmapEl.querySelectorAll(".heat-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        heatmapEl.querySelectorAll(".heat-cell").forEach((c) => c.classList.remove("selected"));
        cell.classList.add("selected");
      });
    });
  }

  async function drillToStudents(classId, className) {
    checkinState = { ...checkinState, level: 2, classId, className, studentId: null, studentName: "" };
    showCheckinLevel(2);
    document.getElementById("checkin-l2-title").textContent = `${className} · 学生明细（${selectedDate}）`;
    updateBreadcrumb();
    await renderStudentTable();
    checkinState.classId = classId;
  }

  function renderPhotoCell(student) {
    if (!student.photo) {
      const emptyLabel = needsCheckinPhoto(student) ? "未上传" : "—";
      return `<td><span class="checkin-photo-empty">${emptyLabel}</span></td>`;
    }
    const p = student.photo;
    const count = p.evidenceCount || p.attachments?.length || 1;
    const thumbHtml =
      window.MediaViewer?.thumbImgHtml?.(p, "checkin-photo-img") ||
      `<span class="checkin-photo-inner">${p.thumb || "📷"}</span>`;
    return `<td>
      <button type="button" class="checkin-photo-thumb" data-action="preview-photo" data-student-id="${student.id}" title="${p.desc || "预览打卡照片"}">
        ${thumbHtml}
        ${count > 1 ? `<span class="evidence-count-badge">${count}</span>` : ""}
      </button>
    </td>`;
  }

  async function renderStudentTable() {
    let students = await API.getClassStudents(checkinState.classId, selectedDate);
    if (studentFilter !== "all") students = students.filter((s) => matchesStudentFilter(s, studentFilter));
    if (studentSearch) {
      const q = studentSearch.toLowerCase();
      students = students.filter((s) => s.name.toLowerCase().includes(q) || s.no.includes(q));
    }

    const tbody = document.querySelector("#student-table tbody");
    if (!students.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">暂无符合条件的学生</td></tr>`;
      return;
    }

    tbody.innerHTML = students
      .map(
        (s) => `<tr>
          <td>${s.no}</td>
          <td>${s.name}</td>
          <td>${formatSemesterHours(s)}</td>
          ${renderStatusCell(s)}
          <td>${s.todayDuration != null ? `${s.todayDuration}h` : "—"}</td>
          ${renderPhotoCell(s)}
          <td>
            <button type="button" class="btn btn-text" data-action="view-evidence" data-student-id="${s.id}" data-student-name="${s.name}">查看证据</button>
            ${s.todayReview === "pending" && s.todayEvidenceId
              ? `<button type="button" class="btn btn-text" data-action="audit-checkin" data-evidence-id="${s.todayEvidenceId}">审核</button>`
              : ""}
          </td>
        </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", async () => {
        const sid = el.dataset.studentId;
        const action = el.dataset.action;
        if (action === "audit-checkin") {
          openAuditDetail("checkin_review", el.dataset.evidenceId, { source: "checkin-overview" });
          return;
        }
        if (el.dataset.action === "preview-photo") {
          const list = await API.getClassStudents(checkinState.classId, selectedDate);
          const student = list.find((s) => s.id === sid);
          if (student?.photo) {
            const atts = student.photo.attachments?.length
              ? student.photo.attachments
              : [student.photo];
            openMediaDialog(atts, 0);
          }
        } else {
          drillToEvidence(sid, el.dataset.studentName);
        }
      });
    });
  }

  async function drillToEvidence(studentId, studentName, options = {}) {
    checkinState = { ...checkinState, level: 3, studentId, studentName };
    showCheckinLevel(3);
    document.getElementById("evidence-title").textContent = `${studentName} · 全部打卡证据`;
    updateBreadcrumb();

    const items = await API.getStudentEvidence(studentId);
    const timeline = document.getElementById("evidence-timeline");

    if (!items.length) {
      timeline.innerHTML = `<p class="box-hint">暂无历史打卡证据</p>`;
      document.getElementById("media-preview").innerHTML = `<div class="media-placeholder">暂无材料</div>`;
      document.getElementById("evidence-desc").textContent = "";
      return;
    }

    const idx = options.restore ? Math.min(selectedEvidenceIdx, items.length - 1) : 0;
    timeline.innerHTML = items
      .map(
        (ev, i) => `
        <button type="button" class="timeline-item ${i === idx ? "active" : ""}" data-idx="${i}">
          <time>${ev.date} ${ev.time} · ${ev.durationHours}h</time>
          <strong>${ev.type === "video" ? "🎬 视频" : "📷 照片"} · ${ev.desc}</strong>
          <span class="badge ${ev.reviewStatus === "approved" ? "status-ok" : ev.reviewStatus === "pending" ? "status-pending" : "status-warn"}">${AUDIT_STATUS[ev.reviewStatus] || ev.reviewStatus}</span>
          ${ev.isSpecialty ? '<span class="badge status-info">专项</span>' : ""}
        </button>`
      )
      .join("");

    timeline.querySelectorAll(".timeline-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedEvidenceIdx = Number(btn.dataset.idx);
        timeline.querySelectorAll(".timeline-item").forEach((t) => t.classList.remove("active"));
        btn.classList.add("active");
        showEvidencePreview(items[selectedEvidenceIdx]);
      });
    });

    showEvidencePreview(items[idx]);
  }

  function showEvidencePreview(ev) {
    const preview = document.getElementById("media-preview");
    const isVideo = ev.type === "video" || ev.kind === "video";
    const first = ev.attachments?.[0] || ev;
    const thumbHtml =
      window.MediaViewer?.thumbImgHtml?.(first, "evidence-preview-img") ||
      `<span>${ev.thumb || "📷"}</span>`;
    preview.innerHTML = `
      <div class="media-thumb ${isVideo ? "is-video" : ""}" role="button" tabindex="0">
        ${thumbHtml}
        ${ev.evidenceCount > 1 ? `<span class="evidence-count-badge">${ev.evidenceCount}</span>` : ""}
      </div>`;
    document.getElementById("evidence-desc").textContent =
      `${ev.date} ${ev.time} · ${ev.durationHours}h — ${ev.desc} · ${AUDIT_STATUS[ev.reviewStatus] || ev.reviewStatus}`;
    const reviewBar = document.getElementById("evidence-review-actions");
    if (reviewBar) {
      if (ev.reviewStatus === "pending") {
        reviewBar.hidden = false;
        reviewBar.innerHTML = `<button type="button" class="btn btn-text" data-action="audit-checkin-evidence" data-evidence-id="${ev.id}">审核此条打卡</button>`;
        reviewBar.querySelector("[data-action='audit-checkin-evidence']")?.addEventListener("click", () => {
          openAuditDetail("checkin_review", ev.id, { source: "checkin-overview" });
        });
      } else {
        reviewBar.hidden = true;
        reviewBar.innerHTML = "";
      }
    }
    const thumb = preview.querySelector(".media-thumb");
    thumb.addEventListener("click", () => openMediaDialog(ev.attachments?.length ? ev.attachments : [ev], 0));
    thumb.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openMediaDialog(ev.attachments?.length ? ev.attachments : [ev], 0);
    });
  }

  function mediaRestoreContext() {
    return window.MediaViewer?.captureRestoreContext?.({
      checkinLevel: checkinState.level,
      classId: checkinState.classId,
      className: checkinState.className,
      studentId: checkinState.studentId,
      studentName: checkinState.studentName,
      onRestore: (ctx) => {
        if (ctx.statusFilter) studentFilter = ctx.statusFilter;
        if (ctx.studentSearch != null) studentSearch = ctx.studentSearch;
        if (ctx.checkinLevel === 2 && checkinState.classId) {
          renderStudentTable();
        } else if (ctx.checkinLevel === 3 && checkinState.studentId) {
          drillToEvidence(checkinState.studentId, checkinState.studentName, { restore: true });
        }
      },
    });
  }

  function openMediaDialog(attachments, index = 0) {
    if (window.MediaViewer) {
      MediaViewer.open(attachments, index, mediaRestoreContext());
      return;
    }
    const dlg = document.getElementById("media-dialog");
    const content = document.getElementById("dialog-media");
    const list = Array.isArray(attachments) ? attachments : [attachments];
    const att = list[index] || list[0];
    content.innerHTML =
      att?.type === "video" || att?.kind === "video"
        ? `<div class="fake-video">▶ 视频播放</div>`
        : `<div class="fake-photo">📷 ${att?.thumb || att?.thumbUrl || ""}</div>`;
    dlg.showModal();
  }

  async function renderMatrix() {
    const courses = await API.getCourses();
    const list = document.getElementById("matrix-course-list");
    if (!matrixCourseId && courses[0]) matrixCourseId = courses[0].id;

    list.innerHTML = courses
      .map(
        (c) =>
          `<li><button type="button" class="list-item ${c.id === matrixCourseId ? "active" : ""}" data-course-id="${c.id}">${c.name}</button></li>`
      )
      .join("");

    list.querySelectorAll("[data-course-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        matrixCourseId = btn.dataset.courseId;
        renderMatrix();
      });
    });

    const classes = await API.getCheckinOverview({ courseId: matrixCourseId, date: selectedDate });
    renderKpiCards(document.getElementById("matrix-kpi"), sumStats(classes));
    renderClassCards(document.getElementById("matrix-class-list"), classes, (id, name) => {
      showPage("checkin-overview", { drillTo: { id, name } });
    });
  }

  async function renderSettings() {
    const courses = await API.getCourses();
    const courseSel = document.getElementById("settings-course");
    const prevCourse = courseSel.value;
    courseSel.innerHTML = courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    if (prevCourse) courseSel.value = prevCourse;

    const classes = await API.getClasses(courseSel.value);
    const classSel = document.getElementById("settings-class");
    const prevClass = classSel.value;
    classSel.innerHTML = classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    if (prevClass && classes.some((c) => c.id === prevClass)) classSel.value = prevClass;

    const settings = await API.getCheckinSettings(courseSel.value, classSel.value);
    lastSettingsSnapshot = { ...settings };
    const twHost = document.getElementById("settings-time-window");
    if (twHost && window.TimeWindow) {
      twHost.innerHTML = TimeWindow.renderTimeWindowEditor({
        idPrefix: "settings-tw",
        value: settings,
        showDailyWindow: true,
        includeHint: true,
      });
      settingsTimeWindowMounted = true;
    }
    document.getElementById("settings-semester-hours").value = settings.semesterHoursRequired;
    document.getElementById("settings-specialty-hours").value = settings.specialtyHoursRequired;
    document.getElementById("settings-specialty-wrap").hidden = !settings.isSpecialtyCourse;
    document.getElementById("settings-gps").checked = settings.gpsEnabled;
    document.getElementById("settings-radius").value = settings.gpsRadius;
    document.getElementById("settings-radius").disabled = !settings.gpsEnabled;
    const errEl = document.getElementById("settings-save-error");
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }

    const history = await API.getSettingsHistory();
    document.getElementById("settings-history").innerHTML = history.length
      ? history.map((h) => `<li><time>${h.at}</time> ${h.by}：${h.change}</li>`).join("")
      : `<li class="box-hint">暂无变更记录</li>`;
  }

  async function renderHistory() {
    const semSel = document.getElementById("history-semester");
    const prevSem = semSel.value;
    semSel.innerHTML = MOCK.semesters.map((s) => `<option value="${s}">${s}</option>`).join("");
    if (prevSem) semSel.value = prevSem;

    const classes = await API.getClasses();
    const classSel = document.getElementById("history-class");
    const prevClass = classSel.value;
    classSel.innerHTML = classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    if (prevClass && classes.some((c) => c.id === prevClass)) classSel.value = prevClass;

    const data = await API.getCheckinHistory({ semester: semSel.value, classId: classSel.value });
    const tbody = document.querySelector("#history-table tbody");
    if (!data.records.length) {
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty">暂无历史记录</td></tr>`;
      return;
    }
    tbody.innerHTML = data.records
      .map((r) => {
        const badges = getHistoryProgressBadge(r);
        const specialtyCol =
          r.specialtyRequired != null ? `${r.specialtyHours}/${r.specialtyRequired}h` : "—";
        return `<tr>
          <td>${r.no}</td><td>${r.name}</td>
          <td>${r.approvedHours}/${data.required}h</td>
          <td>${specialtyCol}</td>
          <td>${Math.round(r.progress * 100)}%</td>
          <td>${r.scoreHint}</td>
          <td><div class="badge-group">${badges.map((b) => `<span class="badge ${b.cls}">${b.text}</span>`).join("")}</div></td>
        </tr>`;
      })
      .join("");
  }

  function canReviewAuditKind(kind) {
    if (kind === "checkin_review") {
      return currentRole === "sports_teacher" || currentRole === "dept_head" || currentRole === "super_admin";
    }
    if (kind === "exempt_test") {
      return currentRole === "team_teacher" || currentRole === "sports_teacher" || currentRole === "super_admin";
    }
    if (kind === "exempt_exam") {
      return currentRole === "sports_teacher" || currentRole === "dept_head" || currentRole === "super_admin";
    }
    return false;
  }

  function isAuditActionable(status) {
    return status === "pending" || status === "reviewing";
  }

  function resetAuditDetailState() {
    auditDetail = null;
    auditEvidenceViewed = false;
    auditDetailSource = null;
  }

  function closeAuditDetail() {
    const dlg = document.getElementById("audit-review-dialog");
    if (dlg.open) dlg.close();
    else resetAuditDetailState();
  }

  function setAuditReviewButtonsEnabled(enabled) {
    document.getElementById("audit-btn-approve").disabled = !enabled;
    document.getElementById("audit-btn-reject").disabled = !enabled;
    document.getElementById("audit-detail-hint").textContent = enabled
      ? "已查看证据，可进行审核"
      : "请先点击查看证据材料";
  }

  function markAuditEvidenceViewed() {
    if (!auditDetail || auditEvidenceViewed) return;
    auditEvidenceViewed = true;
    if (canReviewAuditKind(auditDetail.kind) && isAuditActionable(auditDetail.status)) {
      setAuditReviewButtonsEnabled(true);
    }
  }

  function renderAuditEvidenceGrid(attachments) {
    const grid = document.getElementById("audit-detail-evidence");
    if (!attachments?.length) {
      grid.innerHTML = `<p class="box-hint">暂无上传材料</p>`;
      return;
    }
    grid.innerHTML = attachments
      .map((att, i) => {
        const thumbHtml =
          window.MediaViewer?.thumbImgHtml?.(att, "evidence-card-img") ||
          `<span class="evidence-card-thumb">${att.type === "video" || att.kind === "video" ? "🎬" : "📷"} ${att.thumb || att.name}</span>`;
        return `
        <button type="button" class="evidence-card" data-evidence-idx="${i}">
          <span class="evidence-card-thumb-wrap">${thumbHtml}</span>
          <span class="evidence-card-name">${att.name || "材料"}</span>
        </button>`;
      })
      .join("");

    grid.querySelectorAll(".evidence-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        markAuditEvidenceViewed();
        openMediaDialog(attachments, Number(btn.dataset.evidenceIdx));
      });
    });
  }

  const AUDIT_DETAIL_TITLES = {
    checkin_review: "打卡审核详情",
    exempt_test: "免测申请详情",
    exempt_exam: "免考申请详情",
  };

  function renderAuditDetailInfo(kind, detail) {
    const rows = {
      checkin_review: [
        ["学号", detail.no],
        ["姓名", detail.studentName],
        ["班级", detail.classLabel],
        ["申报时长", `${detail.durationHours}h`],
        ["运动内容", detail.desc],
        ["提交时间", `${detail.date} ${detail.time}`],
        ["状态", AUDIT_STATUS[detail.status]],
      ],
      exempt_test: [
        ["学号", detail.no],
        ["姓名", detail.student],
        ["类型", detail.type],
        ["有效期", detail.expire],
        ["申请日期", detail.date],
        ["状态", AUDIT_STATUS[detail.status]],
      ],
      exempt_exam: [
        ["学号", detail.no],
        ["姓名", detail.student],
        ["类型", detail.type],
        ["申请说明", detail.reason],
        ["申请日期", detail.date],
        ["状态", AUDIT_STATUS[detail.status]],
      ],
    };
    return (rows[kind] || [])
      .map(([label, value]) => `<dt>${label}</dt><dd>${value ?? "—"}</dd>`)
      .join("");
  }

  async function openAuditDetail(kind, id, options = {}) {
    let detail = null;
    if (kind === "checkin_review") {
      detail = await API.getCheckinReviewDetail(id);
    } else {
      detail = await API.getApplicationDetail(kind, id);
      if (detail) detail.kind = kind;
    }
    if (!detail) return;

    auditDetail = detail;
    auditEvidenceViewed = false;
    auditDetailSource = options.source || "audit-workbench";

    const closeBtn = document.getElementById("audit-detail-close");
    closeBtn.textContent = auditDetailSource === "checkin-overview" ? "← 关闭" : "← 返回列表";

    document.getElementById("audit-detail-title").textContent = AUDIT_DETAIL_TITLES[kind] || "审核详情";
    document.getElementById("audit-detail-subtitle").textContent =
      `${detail.studentName || detail.student}（${detail.no}） · ${AUDIT_STATUS[detail.status] || detail.status}`;

    document.getElementById("audit-detail-info").innerHTML = renderAuditDetailInfo(kind, detail);
    renderAuditEvidenceGrid(detail.attachments);
    const canAct = canReviewAuditKind(kind) && isAuditActionable(detail.status);
    setAuditReviewButtonsEnabled(false);
    if (!canAct) {
      document.getElementById("audit-detail-hint").textContent =
        detail.status === "approved" || detail.status === "rejected" ? "该申请已处理" : "当前角色无权审核";
      document.getElementById("audit-btn-approve").hidden = true;
      document.getElementById("audit-btn-reject").hidden = true;
    } else {
      document.getElementById("audit-btn-approve").hidden = false;
      document.getElementById("audit-btn-reject").hidden = false;
    }

    document.getElementById("audit-review-dialog").showModal();
  }

  async function submitAuditReview(action) {
    if (!auditDetail || !auditEvidenceViewed) return;
    if (auditDetail.kind === "checkin_review") {
      await API.reviewCheckin(auditDetail.id, action);
    } else {
      await API.reviewApplication(auditDetail.id, action, auditDetail.kind);
    }
    const source = auditDetailSource;
    closeAuditDetail();
    renderHome();
    if (source === "checkin-overview") {
      if (checkinState.level === 2) await renderStudentTable();
      if (checkinState.level === 3) {
        await drillToEvidence(checkinState.studentId, checkinState.studentName, { restore: true });
      }
    }
    if (source === "audit-workbench") {
      renderAudit();
    }
  }

  async function renderAudit() {
    applyRoleMenu();
    document.querySelectorAll("#audit-tabs .tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.tab === auditTab);
    });

    document.getElementById("audit-panel-checkin_review").hidden = auditTab !== "checkin_review";
    document.getElementById("audit-panel-exempt_test").hidden = auditTab !== "exempt_test";
    document.getElementById("audit-panel-exempt_exam").hidden = auditTab !== "exempt_exam";

    if (auditTab === "checkin_review") {
      const checkinApps = await API.getPendingCheckins();
      document.getElementById("audit-checkin-body").innerHTML = checkinApps.length
        ? checkinApps
            .map(
              (a) => `<tr>
                <td>${a.no}</td><td>${a.studentName}</td><td>${a.classLabel}</td>
                <td>${a.durationHours}h</td><td>${a.desc}</td><td>${a.date} ${a.time}</td>
                <td><button type="button" class="btn btn-text" data-audit-detail="checkin_review" data-audit-id="${a.id}">审核</button></td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="7" class="table-empty">暂无待审核打卡</td></tr>`;
    }

    if (auditTab === "exempt_test") {
      const testApps = await API.getApplications("exempt_test");
      document.getElementById("audit-exempt-test-body").innerHTML = testApps.length
        ? testApps
            .map(
              (a) => `<tr>
                <td>${a.no}</td><td>${a.student}</td><td>${a.type}</td><td>${a.expire}</td>
                <td><span class="badge status-info">${AUDIT_STATUS[a.status]}</span></td>
                <td><button type="button" class="btn btn-text" data-audit-detail="exempt_test" data-audit-id="${a.id}">审核</button></td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="6" class="table-empty">暂无免测申请</td></tr>`;
    }

    if (auditTab === "exempt_exam") {
      const examApps = await API.getApplications("exempt_exam");
      document.getElementById("audit-exempt-exam-body").innerHTML = examApps.length
        ? examApps
            .map(
              (a) => `<tr>
                <td>${a.no}</td><td>${a.student}</td><td>${a.type}</td>
                <td class="cell-reason">${a.reason}</td><td>${a.date}</td>
                <td><span class="badge status-club">${AUDIT_STATUS[a.status]}</span></td>
                <td><button type="button" class="btn btn-text" data-audit-detail="exempt_exam" data-audit-id="${a.id}">审核</button></td>
              </tr>`
            )
            .join("")
        : `<tr><td colspan="7" class="table-empty">暂无免考申请</td></tr>`;
    }

    document.querySelectorAll("[data-audit-detail]").forEach((btn) => {
      btn.addEventListener("click", () =>
        openAuditDetail(btn.dataset.auditDetail, btn.dataset.auditId, { source: "audit-workbench" })
      );
    });
  }

  function physicalEntryLabel(status) {
    return {
      submitted: { text: "已录入", cls: "status-ok" },
      draft: { text: "草稿", cls: "status-pending" },
      pending: { text: "未录入", cls: "status-warn" },
      exempt: { text: "免测", cls: "status-info" },
    }[status] || { text: "未录入", cls: "status-warn" };
  }

  async function populateCourseSelect(selectId, selected, teacherOnly = false) {
    const el = document.getElementById(selectId);
    if (!el) return;
    const courses = teacherOnly ? (await API.getTeacherCourseOverview()).map((c) => ({ id: c.id, name: c.name })) : await API.getCourses();
    el.innerHTML =
      `<option value="">全部课程</option>` + courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    el.value = selected || "";
  }

  async function populateClassSelect(selectId, courseId, selected) {
    const el = document.getElementById(selectId);
    if (!el) return;
    const classes = await API.getClasses(courseId || undefined);
    el.innerHTML =
      `<option value="">全部班级</option>` + classes.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    el.value = selected || "";
  }

  async function renderPhysical() {
    await populateCourseSelect("physical-course-filter", physicalCourseId, true);
    await populateClassSelect("physical-class-filter", physicalCourseId, physicalClassId);

    const data = await API.getPhysicalTests({
      courseId: physicalCourseId || undefined,
      classId: physicalClassId || undefined,
      status: physicalStatus,
      q: physicalSearch || undefined,
    });

    const s = data.stats;
    document.getElementById("physical-kpi").innerHTML = `
      <div class="kpi-card"><span class="kpi-label">学生总数</span><span class="kpi-value">${s.total}</span></div>
      <div class="kpi-card"><span class="kpi-label">已录入</span><span class="kpi-value">${s.submitted}</span></div>
      <div class="kpi-card"><span class="kpi-label">草稿/未录入</span><span class="kpi-value kpi-warn">${s.draft + s.pending}</span></div>
      <div class="kpi-card kpi-accent"><span class="kpi-label">免测</span><span class="kpi-value">${s.exempt}</span></div>`;

    document.querySelector("#physical-table tbody").innerHTML = data.records.length
      ? data.records
          .map((r) => {
            const entry = physicalEntryLabel(r.entryStatus);
            const matchBadge =
              r.entryStatus === "exempt"
                ? `<span class="badge status-info">免测</span>`
                : r.matched === false
                  ? `<span class="badge status-warn">待核对</span>`
                  : r.matched
                    ? `<span class="badge status-ok">已匹配</span>`
                    : `<span class="badge status-warn">—</span>`;
            const hw = r.height && r.weight ? `${r.height}cm / ${r.weight}kg` : "—";
            const progress =
              r.entryStatus === "exempt"
                ? "—"
                : r.itemsTotal
                  ? `${r.itemsEntered}/${r.itemsTotal}`
                  : "—";
            const score =
              r.entryStatus === "exempt"
                ? `<span class="text-muted">${r.exemptReason || "免测"}</span>`
                : r.totalScore != null
                  ? `<strong>${r.totalScore}</strong>`
                  : "—";
            const canEdit = r.entryStatus !== "exempt";
            return `<tr>
              <td>${r.no}</td><td>${r.name}</td><td>${r.classLabel || "—"}</td>
              <td>${r.age ?? "—"}</td><td>${r.gender ?? "—"}</td>
              <td>${hw}${r.bmi ? `<br><small class="box-hint">BMI ${r.bmi}</small>` : ""}</td>
              <td>${score}</td>
              <td>${progress}</td>
              <td>${matchBadge}</td>
              <td>${canEdit ? `<button class="btn btn-text" data-physical-entry="${r.studentId}">${r.entryStatus === "submitted" ? "查看" : "录入"}</button>` : "—"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="10" class="empty-cell">暂无数据</td></tr>`;

    document.querySelectorAll("[data-physical-entry]").forEach((btn) => {
      btn.addEventListener("click", () => openPhysicalEntry(btn.dataset.physicalEntry));
    });
  }

  async function openPhysicalEntry(studentId) {
    physicalEntryId = studentId;
    const detail = await API.getPhysicalTestDetail(studentId);
    const config = await API.getPhysicalTestConfig();
    if (!detail) return;

    document.getElementById("physical-entry-title").textContent = `${detail.name} · 体测录入`;
    document.getElementById("physical-entry-subtitle").textContent =
      `${detail.classLabel} · ${detail.no} · ${detail.gender || "—"} · ${detail.age ?? "—"}岁`;

    document.getElementById("physical-meta-form").innerHTML = `
      <label class="field"><span class="field-label">身高 (cm)</span>
        <input type="number" class="field-input" id="pe-height" value="${detail.height ?? ""}" /></label>
      <label class="field"><span class="field-label">体重 (kg)</span>
        <input type="number" class="field-input" id="pe-weight" value="${detail.weight ?? ""}" step="0.1" /></label>
      <label class="field"><span class="field-label">年龄</span>
        <input type="number" class="field-input" id="pe-age" value="${detail.age ?? ""}" /></label>
      <label class="field"><span class="field-label">性别</span>
        <select class="field-input" id="pe-gender">
          <option value="">请选择</option>
          <option value="男" ${detail.gender === "男" ? "selected" : ""}>男</option>
          <option value="女" ${detail.gender === "女" ? "selected" : ""}>女</option>
        </select></label>`;

    const scoreItems = config.items.filter(
      (item) => item.type === "score" && (!item.gender || item.gender === detail.gender)
    );
    document.getElementById("physical-scores-form").innerHTML = scoreItems
      .map((item) => {
        const val = detail.scores?.[item.key];
        if (item.entryMode === "minsec" || item.key === "run800m" || item.key === "run1000m") {
          const total = val != null && val !== "" ? Number(val) : null;
          const mins = total != null && Number.isFinite(total) ? Math.floor(total / 60) : "";
          const secs = total != null && Number.isFinite(total) ? Math.round(total % 60) : "";
          const converted = detail.convertedScores?.[item.key];
          const rawDisplay =
            total != null && Number.isFinite(total)
              ? API.formatMinSec
                ? API.formatMinSec(total)
                : `${mins}′${String(secs).padStart(2, "0")}″`
              : "";
          return `<div class="field pe-minsec-field" data-key="${item.key}">
            <span class="field-label">${item.label}（分:秒）</span>
            <div class="pe-minsec-row">
              <input type="number" class="field-input pe-min" data-key="${item.key}" min="0" step="1" value="${mins}" placeholder="分" />
              <span class="pe-minsec-sep">:</span>
              <input type="number" class="field-input pe-sec" data-key="${item.key}" min="0" max="59" step="1" value="${secs}" placeholder="秒" />
            </div>
            <p class="field-error pe-sec-error" data-key="${item.key}" hidden>秒须为 0–59</p>
            <p class="box-hint pe-converted-hint">原始 ${rawDisplay || "—"} · 百分制 ${converted != null ? converted : "—（待服务端回包）"}</p>
          </div>`;
        }
        return `<label class="field"><span class="field-label">${item.label} (${item.unit})</span>
          <input type="number" class="field-input pe-score" data-key="${item.key}" value="${val ?? ""}" step="0.1" /></label>`;
      })
      .join("");

    document.getElementById("physical-entry-dialog").showModal();
    document.querySelectorAll(".pe-sec").forEach((input) => {
      input.addEventListener("input", () => validatePhysicalSecInput(input));
    });
  }

  function validatePhysicalSecInput(input) {
    const key = input.dataset.key;
    const err = document.querySelector(`.pe-sec-error[data-key="${key}"]`);
    const n = input.value === "" ? null : Number(input.value);
    const bad = n != null && (!Number.isFinite(n) || n < 0 || n > 59 || !Number.isInteger(n));
    if (err) {
      err.hidden = !bad;
    }
    input.classList.toggle("input-invalid", !!bad);
    return !bad;
  }

  function collectPhysicalForm() {
    const scores = {};
    let valid = true;
    document.querySelectorAll(".pe-score").forEach((input) => {
      if (input.value !== "") scores[input.dataset.key] = Number(input.value);
    });
    document.querySelectorAll(".pe-minsec-field").forEach((wrap) => {
      const key = wrap.dataset.key;
      const minInput = wrap.querySelector(".pe-min");
      const secInput = wrap.querySelector(".pe-sec");
      if (!validatePhysicalSecInput(secInput)) valid = false;
      const minV = minInput.value;
      const secV = secInput.value;
      if (minV === "" && secV === "") return;
      const minutes = Number(minV || 0);
      const seconds = Number(secV || 0);
      if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(seconds) || seconds < 0 || seconds > 59) {
        valid = false;
        return;
      }
      scores[key] = minutes * 60 + seconds;
    });
    if (!valid) return null;
    return {
      height: Number(document.getElementById("pe-height").value) || null,
      weight: Number(document.getElementById("pe-weight").value) || null,
      age: Number(document.getElementById("pe-age").value) || null,
      gender: document.getElementById("pe-gender").value || null,
      scores,
    };
  }

  async function savePhysicalEntry(submit) {
    if (!physicalEntryId) return;
    const payload = collectPhysicalForm();
    if (!payload) {
      alert("请修正耐力跑秒数（须为 0–59）");
      return;
    }
    if (submit) payload.entryStatus = "submitted";
    await API.savePhysicalTest(physicalEntryId, payload);
    document.getElementById("physical-entry-dialog").close();
    physicalEntryId = null;
    renderPhysical();
  }

  function pct(n) {
    return Math.round(n * 100);
  }

  function dec(pctVal) {
    return Number(pctVal) / 100;
  }

  function renderGradeWeightsForm(weights) {
    const groups = [
      { key: "normal", title: "默认（含体测）", fields: ["regular", "physical", "final"], labels: ["平时分", "体测", "期末"] },
      { key: "exemptTest", title: "免测", fields: ["regular", "final"], labels: ["平时分", "期末"] },
      { key: "exemptExam", title: "免考", fields: ["regular", "physical"], labels: ["平时分", "体测"] },
    ];
    document.getElementById("grade-weights-form").innerHTML = groups
      .map((g) => {
        const w = weights[g.key];
        return `<div class="weight-group">
          <h3 class="weight-group-title">${g.title}</h3>
          <div class="weight-fields">${g.fields
            .map(
              (f, i) => `<label class="field field-inline">
                <span class="field-label">${g.labels[i]}</span>
                <input type="number" class="field-input field-input-sm weight-input" min="0" max="100" step="1"
                  data-group="${g.key}" data-field="${f}" value="${pct(w[f])}" />%</label>`
            )
            .join("")}</div></div>`;
      })
      .join("");
  }

  function collectGradeWeights() {
    const weights = { normal: {}, exemptTest: {}, exemptExam: {} };
    document.querySelectorAll(".weight-input").forEach((input) => {
      weights[input.dataset.group][input.dataset.field] = dec(input.value);
    });
    return weights;
  }

  function validateGradeWeights(weights) {
    const checks = [
      { key: "normal", label: "默认" },
      { key: "exemptTest", label: "免测" },
      { key: "exemptExam", label: "免考" },
    ];
    const errors = [];
    for (const c of checks) {
      const sum = Object.values(weights[c.key]).reduce((s, v) => s + v, 0);
      if (Math.abs(sum - 1) > 0.01) errors.push(`${c.label}权重合计 ${Math.round(sum * 100)}%，应为 100%`);
    }
    return errors;
  }

  function formatGradeCell(value, kind) {
    if (value == null) return "—";
    if (kind === "physical" && value === "免测") return '<span class="badge status-info">免测</span>';
    if (kind === "final" && value === "免考") return '<span class="badge status-info">免考</span>';
    if (kind === "physical" && value == null) return '<span class="badge status-warn">待录入</span>';
    return value;
  }

  function formatRegularCell(r) {
    if (r.gradePending) return "—";
    if (r.checkinHoursApproved != null && r.checkinHoursRequired != null) {
      const pctLabel = r.checkinPercent != null || r.regularScore != null ? `${r.checkinPercent ?? r.regularScore}` : "—";
      return `<span title="有效时长 / 要求">${r.checkinHoursApproved}/${r.checkinHoursRequired}h</span><br><small class="box-hint">${pctLabel} 分</small>`;
    }
    return formatGradeCell(r.regularScore ?? r.checkinPercent);
  }

  function renderGradeTableRow(r) {
    if (r.gradePending) {
      return `<tr class="row-muted">
        <td>${r.no}</td><td>${r.name}</td><td>${r.courseName || "—"}</td><td>${r.classLabel}</td>
        <td colspan="3"><span class="badge status-pending">${r.pendingReason}</span></td>
        <td>—</td>
      </tr>`;
    }
    return `<tr>
      <td>${r.no}</td><td>${r.name}</td><td>${r.courseName || "—"}</td><td>${r.classLabel}</td>
      <td>${formatRegularCell(r)}</td>
      <td>${formatGradeCell(r.physicalScore, "physical")}${
        r.enduranceRawDisplay
          ? `<br><small class="box-hint">耐力 ${r.enduranceRawDisplay}${r.endurancePercent != null ? ` · ${r.endurancePercent}` : ""}</small>`
          : ""
      }</td>
      <td>${formatGradeCell(r.finalScore, "final")}</td>
      <td title="${r.formula || ""}"><strong>${r.totalScore}</strong></td>
    </tr>`;
  }

  function updateGradeCopyStats(records) {
    const sorted = window.SortStudents ? SortStudents.sortStudents(records) : records;
    const missingCheckin = sorted.filter((r) => !r.gradePending && (r.checkinPercent == null && r.regularScore == null)).length;
    const missingEndurance = sorted.filter((r) => !r.gradePending && r.endurancePercent == null).length;
    const sortLabel = window.SortStudents ? SortStudents.sortLabel() : "导入顺序";
    const el = document.getElementById("grade-copy-stats");
    if (el) {
      el.textContent = `共 ${sorted.length} 人 · 排序：${sortLabel} · 缺失打卡分 ${missingCheckin} · 缺失耐力跑分 ${missingEndurance}`;
    }
    return sorted;
  }

  function buildGradeTsv(records, mode) {
    const rows = window.SortStudents ? SortStudents.sortStudents(records) : records;
    return rows
      .map((r) => {
        const id = r.no || r.studentId || "";
        const name = r.name || "";
        const checkin = r.gradePending ? "" : r.checkinPercent ?? r.regularScore ?? "";
        const endurance = r.gradePending ? "" : r.endurancePercent ?? "";
        if (mode === "checkin") return `${id}\t${name}\t${checkin}`;
        if (mode === "endurance") return `${id}\t${name}\t${endurance}`;
        return `${id}\t${name}\t${checkin}\t${endurance}`;
      })
      .join("\n");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      /* fallback */
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyGradeTsv(mode) {
    const tsv = buildGradeTsv(lastGradeRecords, mode);
    const ok = await copyText(tsv);
    const fb = document.getElementById("grade-copy-feedback");
    if (fb) {
      fb.hidden = false;
      fb.textContent = ok ? "已复制到剪贴板" : "复制失败，请手动选择文本";
    }
  }

  function renderGradeRulesBanner(data) {
    const el = document.getElementById("grade-rules-banner");
    if (data.activeCourseId && data.weights) {
      const w = data.weights.normal;
      el.innerHTML = `
        <strong>当前课程：${data.courseWeightSummaries.find((c) => c.courseId === data.activeCourseId)?.courseName || ""}</strong>
        <span>默认：平时×${pct(w.regular)}% + 体测×${pct(w.physical)}% + 期末×${pct(w.final)}%；
        免测：平时×${pct(data.weights.exemptTest.regular)}% + 期末×${pct(data.weights.exemptTest.final)}%；
        免考：平时×${pct(data.weights.exemptExam.regular)}% + 体测×${pct(data.weights.exemptExam.physical)}%。
        平时分由打卡有效时长折算。<em>免测/免考审核中暂不输出成绩。</em></span>`;
      return;
    }
    const summaries = (data.courseWeightSummaries || [])
      .map(
        (c) =>
          `<strong>${c.courseName}</strong>：平时${pct(c.normal.regular)}% / 体测${pct(c.normal.physical)}% / 期末${pct(c.normal.final)}%`
      )
      .join("；");
    el.innerHTML = `
      <strong>各课程权重不同</strong>
      <span>${summaries || "—"}。下表总评按每位学生<strong>所属课程</strong>的权重分别计算，鼠标悬停总评可查看公式。审核中的免测/免考暂不输出成绩。</span>`;
  }

  async function populateGradeWeightsCourseSelect() {
    const courses = await API.getCourses();
    const teacherCourses = (await API.getTeacherCourseOverview()).map((c) => c.id);
    const select = document.getElementById("grade-weights-course");
    select.innerHTML = courses
      .filter((c) => teacherCourses.includes(c.id))
      .map((c) => `<option value="${c.id}" ${c.id === gradeWeightsCourseId ? "selected" : ""}>${c.name}</option>`)
      .join("");
    if (!select.value && teacherCourses.length) gradeWeightsCourseId = teacherCourses[0];
    gradeWeightsCourseId = select.value || gradeWeightsCourseId;
  }

  async function renderFinalItemsConfig() {
    const courses = await API.getCourses();
    const teacherCourses = (await API.getTeacherCourseOverview()).map((c) => c.id);
    const select = document.getElementById("final-items-course");
    select.innerHTML = courses
      .filter((c) => teacherCourses.includes(c.id))
      .map((c) => `<option value="${c.id}" ${c.id === finalItemsCourseId ? "selected" : ""}>${c.name}</option>`)
      .join("");
    if (!select.value && teacherCourses.length) finalItemsCourseId = teacherCourses[0];
    finalItemsCourseId = select.value || finalItemsCourseId;

    if (!finalItemsDraft) {
      const config = await API.getFinalExamConfig(finalItemsCourseId);
      finalItemsDraft = config.items.map((item) => ({ ...item }));
    }

    const weights = await API.getGradeWeights(finalItemsCourseId);
    const w = weights.normal;
    document.getElementById("final-items-weight-hint").innerHTML = `
      <strong>该课程算分占比</strong>
      <span>平时${pct(w.regular)}% / 体测${pct(w.physical)}% / 期末${pct(w.final)}%（可在「成绩汇总」页调整）</span>`;

    document.getElementById("final-items-body").innerHTML = finalItemsDraft
      .map(
        (item, idx) => `<tr data-item-idx="${idx}">
          <td><input class="field-input field-input-sm" data-field="label" value="${item.label}" /></td>
          <td><input class="field-input field-input-sm" data-field="key" value="${item.key}" /></td>
          <td><input class="field-input field-input-sm" data-field="unit" value="${item.unit || ""}" /></td>
          <td><input type="checkbox" data-field="lowerBetter" ${item.lowerBetter ? "checked" : ""} /></td>
          <td><button type="button" class="btn btn-text btn-danger-outline" data-remove-final-item="${idx}">删除</button></td>
        </tr>`
      )
      .join("");

    document.querySelectorAll("#final-items-body tr").forEach((row) => {
      row.querySelectorAll("[data-field]").forEach((el) => {
        el.addEventListener("change", () => syncFinalItemRow(row));
        if (el.tagName === "INPUT" && el.type !== "checkbox") el.addEventListener("input", () => syncFinalItemRow(row));
      });
    });
    document.querySelectorAll("[data-remove-final-item]").forEach((btn) => {
      btn.addEventListener("click", () => {
        finalItemsDraft.splice(Number(btn.dataset.removeFinalItem), 1);
        renderFinalItemsConfig();
      });
    });
  }

  function syncFinalItemRow(row) {
    const idx = Number(row.dataset.itemIdx);
    const item = finalItemsDraft[idx];
    row.querySelectorAll("[data-field]").forEach((el) => {
      const field = el.dataset.field;
      if (field === "lowerBetter") item.lowerBetter = el.checked;
      else item[field] = el.value || undefined;
    });
    if (!item.lowerBetter) delete item.lowerBetter;
  }

  function collectFinalItemsDraft() {
    document.querySelectorAll("#final-items-body tr").forEach((row) => syncFinalItemRow(row));
    return finalItemsDraft;
  }

  async function renderFinalExam() {
    await populateCourseSelect("final-course-filter", finalCourseId, true);
    await populateClassSelect("final-class-filter", finalCourseId, finalClassId);

    const data = await API.getFinalExams({
      courseId: finalCourseId || undefined,
      classId: finalClassId || undefined,
      status: finalStatus,
      q: finalSearch || undefined,
    });

    const s = data.stats;
    document.getElementById("final-kpi").innerHTML = `
      <div class="kpi-card"><span class="kpi-label">学生总数</span><span class="kpi-value">${s.total}</span></div>
      <div class="kpi-card"><span class="kpi-label">已录入</span><span class="kpi-value">${s.submitted}</span></div>
      <div class="kpi-card"><span class="kpi-label">草稿/未录入</span><span class="kpi-value kpi-warn">${s.draft + s.pending}</span></div>
      <div class="kpi-card kpi-accent"><span class="kpi-label">免考</span><span class="kpi-value">${s.exempt}</span></div>`;

    document.querySelector("#final-table tbody").innerHTML = data.records.length
      ? data.records
          .map((r) => {
            const canEdit = r.entryStatus !== "exempt";
            const score =
              r.entryStatus === "exempt"
                ? `<span class="text-muted">${r.exemptReason || "免考"}</span>`
                : r.totalScore != null
                  ? `<strong>${r.totalScore}</strong>`
                  : "—";
            const progress = r.entryStatus === "exempt" ? "—" : `${r.itemsEntered}/${r.itemsTotal}`;
            const statusBadge =
              r.entryStatus === "exempt"
                ? `<span class="badge status-info">免考</span>`
                : r.entryStatus === "submitted"
                  ? `<span class="badge status-ok">已录入</span>`
                  : r.entryStatus === "draft"
                    ? `<span class="badge status-pending">草稿</span>`
                    : `<span class="badge status-warn">未录入</span>`;
            return `<tr>
              <td>${r.no}</td><td>${r.name}</td><td>${r.classLabel}</td><td>${r.courseName}</td>
              <td>${score}</td><td>${progress}</td><td>${statusBadge}</td>
              <td>${canEdit ? `<button class="btn btn-text" data-final-entry="${r.studentId}">${r.entryStatus === "submitted" ? "查看" : "录入"}</button>` : "—"}</td>
            </tr>`;
          })
          .join("")
      : `<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>`;

    document.querySelectorAll("[data-final-entry]").forEach((btn) => {
      btn.addEventListener("click", () => openFinalEntry(btn.dataset.finalEntry));
    });
  }

  async function openFinalEntry(studentId) {
    finalEntryId = studentId;
    const detail = await API.getFinalExamDetail(studentId);
    if (!detail) return;
    const config = await API.getFinalExamConfig(detail.courseId);

    document.getElementById("final-entry-title").textContent = `${detail.name} · 期末录入`;
    document.getElementById("final-entry-subtitle").textContent =
      `${detail.classLabel} · ${detail.courseName} · ${detail.no}`;

    document.getElementById("final-scores-form").innerHTML = config.items
      .map((item) => {
        const val = detail.scores?.[item.key] ?? "";
        return `<label class="field"><span class="field-label">${item.label} (${item.unit})</span>
          <input type="number" class="field-input fe-score" data-key="${item.key}" value="${val}" step="0.1" /></label>`;
      })
      .join("");

    document.getElementById("final-entry-dialog").showModal();
  }

  function collectFinalForm() {
    const scores = {};
    document.querySelectorAll(".fe-score").forEach((input) => {
      if (input.value !== "") scores[input.dataset.key] = Number(input.value);
    });
    return { scores };
  }

  async function saveFinalEntry(submit) {
    if (!finalEntryId) return;
    const payload = collectFinalForm();
    if (submit) payload.entryStatus = "submitted";
    await API.saveFinalExam(finalEntryId, payload);
    document.getElementById("final-entry-dialog").close();
    finalEntryId = null;
    renderFinalExam();
  }

  async function renderGradeSummary() {
    await populateGradeWeightsCourseSelect();
    const weights = await API.getGradeWeights(gradeWeightsCourseId);
    renderGradeWeightsForm(weights);

    await populateCourseSelect("grade-course-filter", gradeCourseId, true);
    await populateClassSelect("grade-class-filter", gradeCourseId, gradeClassId);

    const sortSel = document.getElementById("grade-roster-sort");
    if (sortSel && window.SortStudents) {
      sortSel.value = SortStudents.getRosterSort();
    }

    const data = await API.getGradeSummary({
      courseId: gradeCourseId || undefined,
      classId: gradeClassId || undefined,
    });
    renderGradeRulesBanner(data);

    const st = data.stats;
    document.getElementById("grade-kpi").innerHTML = `
      <div class="kpi-card"><span class="kpi-label">学生数</span><span class="kpi-value">${st.total}</span></div>
      <div class="kpi-card kpi-accent"><span class="kpi-label">平均总评</span><span class="kpi-value">${st.avgTotal}</span><small class="kpi-sub">已出分 ${st.graded} 人</small></div>
      <div class="kpi-card"><span class="kpi-label">审核暂不出分</span><span class="kpi-value kpi-warn">${st.pendingExempt}</span></div>
      <div class="kpi-card"><span class="kpi-label">体测待录入</span><span class="kpi-value kpi-warn">${st.pendingPhysical}</span></div>`;

    lastGradeRecords = data.records || [];
    const sorted = updateGradeCopyStats(lastGradeRecords);
    document.querySelector("#grade-table tbody").innerHTML = sorted.length
      ? sorted.map(renderGradeTableRow).join("")
      : `<tr><td colspan="8" class="empty-cell">暂无数据</td></tr>`;
  }

  async function renderBasicCourses() {
    const courses = await API.getTeacherCourseOverview();
    if (!courses.length) {
      document.getElementById("basic-course-list").innerHTML = `<div class="box"><p class="box-hint">暂无授课课程</p></div>`;
      return;
    }
    document.getElementById("basic-course-list").innerHTML = courses
      .map(
        (c) => `
        <div class="box course-overview-box">
          <div class="box-header">
            <div>
              <h2 class="h2">${c.name}${c.isSpecialty ? ' <span class="badge status-info">专项</span>' : ""}</h2>
              <p class="box-hint">${c.semester} · ${c.classCount} 个班级 · ${c.studentCount} 名学生</p>
            </div>
          </div>
          <div class="class-cards">
            ${c.classes
              .map(
                (cls) => `
              <button type="button" class="class-card" data-basic-class="${cls.id}" data-basic-course="${c.id}">
                <div class="class-card-head"><strong>${cls.name}</strong><span class="rate-badge">${cls.studentCount} 人</span></div>
                <p class="box-hint">点击查看学生名单</p>
              </button>`
              )
              .join("")}
          </div>
        </div>`
      )
      .join("");

    document.querySelectorAll("[data-basic-class]").forEach((btn) => {
      btn.addEventListener("click", () => {
        basicCourseId = btn.dataset.basicCourse;
        basicClassId = btn.dataset.basicClass;
        showPage("basic-students");
      });
    });
  }

  async function renderBasicStudents() {
    await populateCourseSelect("basic-course-filter", basicCourseId, true);
    await populateClassSelect("basic-class-filter", basicCourseId, basicClassId);

    const data = await API.getStudentRoster({
      courseId: basicCourseId || undefined,
      classId: basicClassId || undefined,
      q: basicStudentSearch || undefined,
    });

    document.getElementById("basic-students-summary").textContent = `共 ${data.total} 名学生`;
    document.getElementById("basic-students-body").innerHTML = data.records.length
      ? data.records
          .map(
            (s) => `<tr>
            <td>${s.no}</td><td>${s.name}</td><td>${s.classLabel}</td>
            <td>${s.gender || "—"}</td><td>${s.age ?? "—"}</td>
            <td><button class="btn btn-text" type="button" data-legacy-page="student-detail" data-student-id="${s.no}" data-course-id="${basicCourseId || s.courseId || ""}">学时明细</button></td>
          </tr>`
          )
          .join("")
      : `<tr><td colspan="6" class="empty-cell">暂无学生</td></tr>`;
  }

  async function renderPermissions() {
    const users = await API.getRoleConfig();
    document.querySelector("#permissions-table tbody").innerHTML = users
      .map(
        (u) => `<tr>
        <td>${u.name}</td>
        <td>${u.roles.map(roleLabel).join("、")}</td>
        <td><button class="btn btn-text">编辑角色</button></td>
      </tr>`
      )
      .join("");
  }

  async function initFilters() {
    const courses = await API.getCourses();
    document.getElementById("checkin-course-filter").innerHTML =
      `<option value="">全部课程</option>` + courses.map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
    setSelectedDate(todayStr());
  }

  function onDateChange() {
    syncDateInputs();
    const activePage = document.querySelector(".page.active")?.id;
    if (activePage === "page-home") renderHome();
    if (activePage === "page-checkin-overview") {
      if (checkinState.level === 1) loadCheckinLevel1();
      else if (checkinState.level === 2) {
        document.getElementById("checkin-l2-title").textContent = `${checkinState.className} · 学生明细（${selectedDate}）`;
        renderStudentTable();
      }
    }
    if (activePage === "page-checkin-matrix") renderMatrix();
  }

  function initEvents() {
    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (window.AuthBridge) AuthBridge.logout();
        else window.location.href = "../index.html";
      });
    }

    document.getElementById("home-date").addEventListener("change", (e) => {
      setSelectedDate(e.target.value);
      onDateChange();
    });

    document.getElementById("checkin-date").addEventListener("change", (e) => {
      setSelectedDate(e.target.value);
      onDateChange();
    });

    document.getElementById("checkin-course-filter").addEventListener("change", () => {
      if (checkinState.level === 1) loadCheckinLevel1();
    });

    document.getElementById("status-filter").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll("#status-filter .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      studentFilter = chip.dataset.status;
      renderStudentTable();
    });

    document.getElementById("student-search").addEventListener("input", (e) => {
      studentSearch = e.target.value.trim();
      renderStudentTable();
    });

    document.getElementById("audit-tabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".tab");
      if (!tab || tab.hidden) return;
      auditTab = tab.dataset.tab;
      closeAuditDetail();
      renderAudit();
    });

    document.getElementById("audit-detail-close").addEventListener("click", () => closeAuditDetail());
    document.getElementById("audit-review-dialog").addEventListener("close", resetAuditDetailState);

    document.getElementById("audit-btn-approve").addEventListener("click", () => submitAuditReview("approve"));
    document.getElementById("audit-btn-reject").addEventListener("click", () => submitAuditReview("reject"));

    document.getElementById("btn-save-settings").addEventListener("click", async () => {
      const errEl = document.getElementById("settings-save-error");
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
      let tw = {};
      if (window.TimeWindow && settingsTimeWindowMounted) {
        tw = TimeWindow.readTimeWindowEditor("settings-tw", true);
        const check = TimeWindow.validateTimeWindow(tw.startsAt, tw.endsAt);
        if (!check.ok) {
          TimeWindow.showEditorError("settings-tw", check.message);
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = check.message;
          }
          return;
        }
        TimeWindow.showEditorError("settings-tw", "");
        if (
          !TimeWindow.confirmWindowChange({
            recordCount: lastSettingsSnapshot?.recordCount,
            prevStartsAt: lastSettingsSnapshot?.startsAt,
            prevEndsAt: lastSettingsSnapshot?.endsAt,
            nextStartsAt: tw.startsAt,
            nextEndsAt: tw.endsAt,
          })
        ) {
          return;
        }
      }
      const res = await API.updateCheckinSettings({
        ...tw,
        windowStart: tw.dailyWindowStart || tw.windowStart,
        windowEnd: tw.dailyWindowEnd || tw.windowEnd,
        semesterHoursRequired: Number(document.getElementById("settings-semester-hours").value),
        specialtyHoursRequired: Number(document.getElementById("settings-specialty-hours").value),
        gpsEnabled: document.getElementById("settings-gps").checked,
        gpsRadius: Number(document.getElementById("settings-radius").value),
      });
      if (res && res.success === false) {
        const msg = res.message || "保存失败";
        if (errEl) {
          errEl.hidden = false;
          errEl.textContent = msg;
        }
        if (window.TimeWindow) TimeWindow.showEditorError("settings-tw", msg);
        return;
      }
      await renderSettings();
    });

    document.getElementById("btn-reset-settings").addEventListener("click", () => renderSettings());

    document.getElementById("settings-gps").addEventListener("change", (e) => {
      document.getElementById("settings-radius").disabled = !e.target.checked;
    });

    document.getElementById("settings-course").addEventListener("change", renderSettings);
    document.getElementById("settings-class").addEventListener("change", renderSettings);

    document.getElementById("history-semester").addEventListener("change", renderHistory);
    document.getElementById("history-class").addEventListener("change", renderHistory);

    document.getElementById("btn-export-checkin").addEventListener("click", async () => {
      const res = await API.exportCheckin({ format: "xlsx", date: selectedDate });
      alert(`导出请求已发送：${res.url}`);
    });

    document.getElementById("btn-export-history").addEventListener("click", async () => {
      const res = await API.exportCheckin({
        format: "xlsx",
        semester: document.getElementById("history-semester").value,
        classId: document.getElementById("history-class").value,
      });
      alert(`导出请求已发送：${res.url}`);
    });

    document.getElementById("physical-course-filter").addEventListener("change", async (e) => {
      physicalCourseId = e.target.value;
      physicalClassId = "";
      await renderPhysical();
    });
    document.getElementById("physical-class-filter").addEventListener("change", (e) => {
      physicalClassId = e.target.value;
      renderPhysical();
    });
    document.getElementById("physical-search").addEventListener("input", (e) => {
      physicalSearch = e.target.value.trim();
      renderPhysical();
    });
    document.getElementById("physical-status-filter").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll("#physical-status-filter .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      physicalStatus = chip.dataset.status;
      renderPhysical();
    });
    document.getElementById("physical-entry-close").addEventListener("click", () => {
      document.getElementById("physical-entry-dialog").close();
    });
    document.getElementById("physical-btn-draft").addEventListener("click", () => savePhysicalEntry(false));
    document.getElementById("physical-btn-submit").addEventListener("click", () => savePhysicalEntry(true));
    document.getElementById("btn-import-physical").addEventListener("click", () => alert("导入功能演示：对接后端后支持 Excel 批量导入"));
    document.getElementById("btn-export-physical").addEventListener("click", () => alert("导出功能演示：对接后端后支持导出体测原始数据"));

    document.getElementById("grade-course-filter").addEventListener("change", async (e) => {
      gradeCourseId = e.target.value;
      gradeClassId = "";
      if (gradeCourseId) gradeWeightsCourseId = gradeCourseId;
      await renderGradeSummary();
    });
    document.getElementById("grade-class-filter").addEventListener("change", (e) => {
      gradeClassId = e.target.value;
      renderGradeSummary();
    });
    document.getElementById("btn-export-grade").addEventListener("click", () => alert("导出功能演示：对接后端后支持导出成绩汇总表"));

    document.getElementById("grade-roster-sort")?.addEventListener("change", (e) => {
      if (window.SortStudents) SortStudents.setRosterSort(e.target.value);
      renderGradeSummary();
    });
    document.getElementById("btn-copy-checkin")?.addEventListener("click", () => copyGradeTsv("checkin"));
    document.getElementById("btn-copy-endurance")?.addEventListener("click", () => copyGradeTsv("endurance"));
    document.getElementById("btn-copy-both")?.addEventListener("click", () => copyGradeTsv("both"));

    document.getElementById("grade-weights-course").addEventListener("change", async (e) => {
      gradeWeightsCourseId = e.target.value;
      await renderGradeSummary();
    });

    document.getElementById("btn-save-grade-weights").addEventListener("click", async () => {
      const weights = collectGradeWeights();
      const errors = validateGradeWeights(weights);
      const hint = document.getElementById("grade-weights-hint");
      if (errors.length) {
        hint.hidden = false;
        hint.textContent = errors.join("；") + "。保存时将自动归一化。";
      } else {
        hint.hidden = true;
      }
      await API.updateGradeWeights(gradeWeightsCourseId, weights);
      renderGradeSummary();
    });
    document.getElementById("btn-reset-grade-weights").addEventListener("click", async () => {
      await API.resetGradeWeights(gradeWeightsCourseId);
      document.getElementById("grade-weights-hint").hidden = true;
      renderGradeSummary();
    });

    document.getElementById("final-items-course").addEventListener("change", (e) => {
      finalItemsCourseId = e.target.value;
      finalItemsDraft = null;
      renderFinalItemsConfig();
    });
    document.getElementById("btn-add-final-item").addEventListener("click", () => {
      if (!finalItemsDraft) finalItemsDraft = [];
      finalItemsDraft.push({ key: `final_${Date.now()}`, label: "新项目", unit: "" });
      renderFinalItemsConfig();
    });
    document.getElementById("btn-save-final-items").addEventListener("click", async () => {
      const items = collectFinalItemsDraft();
      await API.updateFinalExamConfig(finalItemsCourseId, { items });
      finalItemsDraft = null;
      alert("期末项目配置已保存");
      renderFinalItemsConfig();
    });
    document.getElementById("btn-reset-final-items").addEventListener("click", async () => {
      if (!confirm("确定恢复该课程的默认期末项目？")) return;
      await API.resetFinalExamConfig(finalItemsCourseId);
      finalItemsDraft = null;
      renderFinalItemsConfig();
    });

    document.getElementById("final-course-filter").addEventListener("change", async (e) => {
      finalCourseId = e.target.value;
      finalClassId = "";
      await renderFinalExam();
    });
    document.getElementById("final-class-filter").addEventListener("change", (e) => {
      finalClassId = e.target.value;
      renderFinalExam();
    });
    document.getElementById("final-search").addEventListener("input", (e) => {
      finalSearch = e.target.value.trim();
      renderFinalExam();
    });
    document.getElementById("final-status-filter").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      document.querySelectorAll("#final-status-filter .chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      finalStatus = chip.dataset.status;
      renderFinalExam();
    });
    document.getElementById("final-entry-close").addEventListener("click", () => {
      document.getElementById("final-entry-dialog").close();
    });
    document.getElementById("final-btn-draft").addEventListener("click", () => saveFinalEntry(false));
    document.getElementById("final-btn-submit").addEventListener("click", () => saveFinalEntry(true));
    document.getElementById("btn-export-final").addEventListener("click", () => alert("导出功能演示：对接后端后支持导出期末成绩"));

    document.getElementById("basic-course-filter").addEventListener("change", async (e) => {
      basicCourseId = e.target.value;
      basicClassId = "";
      await renderBasicStudents();
    });
    document.getElementById("basic-class-filter").addEventListener("change", (e) => {
      basicClassId = e.target.value;
      renderBasicStudents();
    });
    document.getElementById("basic-student-search").addEventListener("input", (e) => {
      basicStudentSearch = e.target.value.trim();
      renderBasicStudents();
    });
  }

  async function init() {
    const session = window.AuthBridge ? AuthBridge.requireTeacher() : null;
    if (!session) return;

    currentRole = "sports_teacher";
    if (window.MOCK) MOCK.currentUser.role = "sports_teacher";

    const userLabel = document.getElementById("teacher-user-name");
    if (userLabel) {
      userLabel.textContent = session.demo ? "演示模式（未连接后端）" : (session.user?.name || "体育老师");
    }

    if (typeof API.syncFromBackend === "function") {
      await API.syncFromBackend();
    }

    bindNavigation();

    navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        if (item.dataset.page === "checkin-overview") resetCheckinOnEnter = true;
        showPage(item.dataset.page);
      });
    });

    groupTitles.forEach((title) => {
      title.addEventListener("click", () => {
        const firstItem = title.closest(".nav-group")?.querySelector(".nav-item[data-page]");
        if (firstItem) {
          if (firstItem.dataset.page === "checkin-overview") resetCheckinOnEnter = true;
          showPage(firstItem.dataset.page);
        }
      });
    });

    await initFilters();
    initEvents();
    if (window.LegacyPages) LegacyPages.bindOnce(showPage);
    applyRoleMenu();
    showPage("home");
  }

  init();
})();
