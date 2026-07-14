import { escapeHtml, formatDate } from "../core/utils.js";

const enrollmentLabel = (value) => ({ enrolled: "修读中", completed: "已完成", withdrawn: "已退课" }[value] || "待确认");

function courseCard(course, tasks, records) {
  const courseTasks = tasks.filter((item) => item.courseId === course.id);
  const courseRecords = records.filter((item) => item.courseId === course.id);
  const required = Number(course.requiredHours || 10);
  const completed = Number(course.completedHours || 0);
  const percent = required ? Math.min(100, Math.round((completed / required) * 100)) : 0;
  return `<article class="card course-card"><div class="card-body">
    <div class="course-card-top"><div><span class="eyebrow">${escapeHtml(course.courseCode)} / Section ${escapeHtml(String(course.section).padStart(4,"0"))}</span><h2 class="card-title">${escapeHtml(course.name)}</h2></div><span class="badge">${escapeHtml(enrollmentLabel(course.enrollmentStatus))}</span></div>
    <div class="course-fact-grid"><div><span>任课老师</span><strong>${escapeHtml(course.teacher || "待公布")}</strong></div><div><span>下一截止</span><strong>${course.deadline ? formatDate(course.deadline) : "暂无"}</strong></div></div>
    <div class="course-progress-copy"><span>课程相关进度</span><strong>${completed}<small> / ${required}h</small></strong></div>
    <div class="progress"><i style="width:${percent}%"></i></div>
    <div class="course-facts"><span>课程任务 <b>${courseTasks.length}</b></span><span>相关记录 <b>${courseRecords.length}</b></span></div>
    <button class="button button-tonal button-block" data-route="course/${escapeHtml(course.id)}">查看课程详情</button>
  </div></article>`;
}

export function renderCourses(courses = [], tasks = [], records = []) {
  const current = courses.filter((course) => course.semesterStatus !== "archived");
  const archived = courses.filter((course) => course.semesterStatus === "archived");
  return `<section class="page-stack courses-page"><header><span class="eyebrow">COURSES</span><h1 class="page-heading">课程</h1><p class="page-caption">课程代码 + 四位 Section 是唯一课程标识</p></header>
    <section class="page-stack"><div class="section-row"><div><span class="eyebrow">CURRENT</span><h2 class="section-heading">当前学期课程</h2></div><span class="badge">${current.length} 门</span></div>
      <div class="grid grid-2">${current.map((course) => courseCard(course, tasks, records)).join("") || '<div class="card"><div class="card-body muted">当前学期暂无课程</div></div>'}</div>
    </section>
    <details class="course-history" ${current.length ? "" : "open"}><summary><span><span class="eyebrow">ARCHIVE</span><strong>历史课程（${archived.length}）</strong></span><b aria-hidden="true">⌄</b></summary><div class="grid grid-2">${archived.map((course) => courseCard(course, tasks, records)).join("") || '<div class="card"><div class="card-body muted">暂无历史课程</div></div>'}</div></details>
  </section>`;
}

export function renderCourseDetail(course, tasks = [], records = []) {
  if (!course) return '<div class="card"><div class="card-body muted">课程不存在。</div></div>';
  const remaining = Math.max(0, Number(course.requiredHours || 10) - Number(course.completedHours || 0));
  return `<section class="page-stack course-detail-page"><button class="button button-secondary back-button" data-route="courses">← 返回课程</button>
    <header><span class="eyebrow">${escapeHtml(course.courseCode)} / Section ${escapeHtml(String(course.section).padStart(4,"0"))}</span><h1 class="page-heading">${escapeHtml(course.name)}</h1><p class="page-caption">${escapeHtml(course.semester || "当前学期")}</p></header>
    <div class="grid grid-2"><section class="card"><div class="card-head"><h2 class="card-title">课程信息</h2></div><div class="card-body detail-facts"><div><span>课程名称</span><strong>${escapeHtml(course.name)}</strong></div><div><span>Section</span><strong>${escapeHtml(String(course.section).padStart(4,"0"))}</strong></div><div><span>任课老师</span><strong>${escapeHtml(course.teacher || course.teacherName || "待公布")}</strong></div><div><span>下一截止</span><strong>${course.deadline ? formatDate(course.deadline) : "暂无"}</strong></div></div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">我的课程相关进度</h2></div><div class="card-body page-stack"><div class="hero-metric compact"><div><span>已完成</span><strong>${Number(course.completedHours || 0)}<small> / ${Number(course.requiredHours || 10)}h</small></strong></div><span class="badge ${remaining ? "badge-warning" : "badge-success"}">${remaining ? `还差 ${remaining}h` : "已完成"}</span></div><div class="progress progress-large"><i style="width:${Math.min(100,Math.round(Number(course.completedHours || 0)/Number(course.requiredHours || 10)*100))}%"></i></div></div></section></div>
    <div class="grid grid-2"><section class="card"><div class="card-head"><h2 class="card-title">本教学班任务</h2></div><div class="card-body list-stack">${tasks.map((task) => `<button class="list-row" data-action="use-task" data-task-id="${task.id}"><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.description || "")} · ${formatDate(task.deadline)}</small></span><b>打卡 →</b></button>`).join("") || '<p class="muted">当前教学班还没有可展示任务。</p>'}</div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">相关记录</h2></div><div class="card-body list-stack">${records.map((record) => `<button class="list-row" data-route="record/${record.id}"><span><strong>${record.hours}h · ${escapeHtml(record.status)}</strong><small>${escapeHtml(record.description || "")}</small></span><b>→</b></button>`).join("") || '<p class="muted">当前教学班还没有课程相关打卡记录。</p>'}</div></section></div>
  </section>`;
}
