import { escapeHtml, formatDate } from "../core/utils.js";

export function renderCourses(courses = [], tasks = [], records = []) {
  return `<section class="page-stack"><header><h1 class="page-heading">课程</h1><p class="page-caption">课程代码 + 四位 Section 是唯一课程标识</p></header>
    <div class="grid grid-2">${courses.map((course) => { const courseTasks = tasks.filter((item) => item.courseId === course.id); const courseRecords = records.filter((item) => item.courseId === course.id); return `<article class="card course-card"><div class="card-body page-stack" style="gap:12px">
      <div><span class="eyebrow">${escapeHtml(course.courseCode)} / Section ${escapeHtml(String(course.section).padStart(4,"0"))}</span><h2 class="card-title">${escapeHtml(course.name)}</h2><p class="page-caption">${escapeHtml(course.teacher)} · ${escapeHtml(course.semester)}</p></div>
      <div class="hero-metric compact"><div><span>课程学时</span><strong>${course.completedHours || 0}<small> / ${course.requiredHours || 10}h</small></strong></div></div>
      <div class="progress"><i style="width:${Math.min(100,Math.round((course.completedHours/course.requiredHours)*100))}%"></i></div>
      <div class="course-facts"><span>课程任务 <b>${courseTasks.length}</b></span><span>相关记录 <b>${courseRecords.length}</b></span></div>
      <button class="button button-primary button-block" data-route="course/${course.id}">查看课程详情</button>
    </div></article>`; }).join("") || '<div class="card"><div class="card-body muted">暂无课程</div></div>'}</div>
  </section>`;
}

export function renderCourseDetail(course, tasks = [], records = []) {
  if (!course) return '<div class="card"><div class="card-body muted">课程不存在。</div></div>';
  return `<section class="page-stack"><button class="button button-secondary" data-route="courses">← 返回课程</button>
    <header><span class="eyebrow">${escapeHtml(course.courseCode)} / Section ${escapeHtml(String(course.section).padStart(4,"0"))}</span><h1 class="page-heading">${escapeHtml(course.name)}</h1><p class="page-caption">${escapeHtml(course.teacher || course.teacherName)} · ${escapeHtml(course.semester || "当前学期")}</p></header>
    <div class="grid grid-2"><section class="card"><div class="card-head"><h2 class="card-title">课程任务</h2></div><div class="card-body list-stack">${tasks.map((task) => `<button class="list-row" data-action="use-task" data-task-id="${task.id}"><span><strong>${escapeHtml(task.title)}</strong><small>${escapeHtml(task.description || "")} · ${formatDate(task.deadline)}</small></span><b>打卡 →</b></button>`).join("") || '<p class="muted">暂无任务</p>'}</div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">相关记录</h2></div><div class="card-body list-stack">${records.map((record) => `<button class="list-row" data-route="record/${record.id}"><span><strong>${record.hours}h · ${escapeHtml(record.status)}</strong><small>${escapeHtml(record.description || "")}</small></span><b>→</b></button>`).join("") || '<p class="muted">暂无相关记录</p>'}</div></section></div>
  </section>`;
}
