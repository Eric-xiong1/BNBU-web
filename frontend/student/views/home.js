import { escapeHtml, formatDate } from "../core/utils.js";

const progress = (value, max) => `<div class="progress progress-large"><i style="width:${Math.min(100, Math.round((Number(value || 0) / Number(max || 1)) * 100))}%"></i></div>`;

export function renderHome(state) {
  const summary = state.summary || {};
  const urgent = state.records?.find((item) => ["补材料", "需补材料", "已驳回"].includes(item.status));
  return `<section class="page-stack">
    <header><h1 class="page-heading">首页</h1><p class="page-caption">你好，${escapeHtml(state.student?.name || "同学")} · 本学期体育进度</p></header>
    <section class="card"><div class="card-head"><h2 class="card-title">学时进度</h2></div><div class="card-body page-stack">
      <div class="hero-metric"><div><span>已完成</span><strong>${summary.totalCompleted || 0}<small> / ${summary.totalRequired || 20}h</small></strong></div><span class="badge badge-warning">待审核 ${summary.pendingCount || 0}</span></div>
      ${progress(summary.totalCompleted, summary.totalRequired)}
      <div class="grid grid-2"><div class="metric-card"><span>课程相关</span><strong>${summary.courseHours || 0}h</strong><small>还差 ${summary.courseRemaining || 0}h</small></div><div class="metric-card"><span>其他运动</span><strong>${summary.generalHours || 0}h</strong><small>还差 ${summary.generalRemaining || 0}h</small></div></div>
    </div></section>
    <section><h2 class="section-heading">风险提示</h2><div class="notice ${urgent ? "risk-notice" : ""}">${urgent ? `有记录需要处理：${escapeHtml(urgent.reviewComment || urgent.status)} <button class="text-button" data-route="record/${urgent.id}">立即处理</button>` : `当前仍有 ${summary.totalRemaining || 0} 小时缺口，请按周计划完成。`}</div></section>
    <section><h2 class="section-heading">行动入口</h2><div class="quick-actions"><button data-route="checkin"><b>＋</b><span>继续打卡</span></button><button data-route="grades"><b>▥</b><span>查看成绩</span></button><button data-route="exemptions"><b>◇</b><span>免测申请</span></button></div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">周计划</h2></div><div class="card-body week-grid">${(state.weeklyPlan || []).map((item) => `<div class="week-day ${item.done ? "is-done" : ""}"><span>${escapeHtml(item.day)}</span><strong>${escapeHtml(item.label)}</strong><i>${item.done ? "已完成" : "计划"}</i></div>`).join("")}</div></section>
    <div class="grid grid-2">
      <section class="card"><div class="card-head"><h2 class="card-title">近期任务</h2></div><div class="card-body list-stack">${(state.tasks || []).filter((item) => item.status !== "已完成").slice(0,3).map((item) => `<button class="list-row" data-action="use-task" data-task-id="${item.id}"><span><strong>${escapeHtml(item.title)}</strong><small>${formatDate(item.deadline)}</small></span><b>去完成 →</b></button>`).join("") || '<p class="muted">暂无近期任务</p>'}</div></section>
      <section class="card"><div class="card-head"><h2 class="card-title">通知</h2></div><div class="card-body list-stack">${(state.notifications || []).slice(0,3).map((item) => `<button class="list-row" data-route="notifications"><span><strong>${item.isUnread ? "● " : ""}${escapeHtml(item.title)}</strong><small>${escapeHtml(item.message)}</small></span><b>→</b></button>`).join("") || '<p class="muted">暂无通知</p>'}</div></section>
    </div>
  </section>`;
}
