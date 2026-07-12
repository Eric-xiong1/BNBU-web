import { GRADE_WEIGHTS } from "../core/constants.js";
import { escapeHtml, formatDate } from "../core/utils.js";

const labels = { checkin: "体育打卡", exam: "专项考试", performance: "平时表现", physical: "体测" };

export function calculateGrade(components = {}) {
  const rows = Object.entries(GRADE_WEIGHTS).map(([key, weight]) => ({ key, value: components[key] ?? null, weight, weighted: components[key] == null ? null : Number(components[key]) * weight }));
  const missing = rows.filter((row) => row.value == null).map((row) => row.key);
  const total = missing.length ? null : Math.round(rows.reduce((sum, row) => sum + row.weighted, 0) * 10) / 10;
  return { total, rows, missing };
}

export function renderGrades(grades = {}) {
  const result = calculateGrade(grades.components || {});
  return `<section class="page-stack"><header><h1 class="page-heading">成绩</h1><p class="page-caption">所有权重、公式和数据来源均可核验</p></header>
    <section class="grade-hero"><div><span>总分预估</span><strong>${result.total ?? "—"}</strong><small>${result.missing.length ? "存在缺失项，暂不形成完整预估" : "按当前已录入成绩计算"}</small></div></section>
    <div class="grid grid-2">${result.rows.map((row) => `<article class="card"><div class="card-body component-card"><div><span>${labels[row.key]}</span><b>${Math.round(row.weight*100)}%</b></div><strong>${row.value ?? "未录入"}</strong><small>${row.weighted == null ? "等待数据" : `${row.value} × ${Math.round(row.weight*100)}% = ${row.weighted.toFixed(1)}`}</small></div></article>`).join("")}</div>
    <section class="card"><div class="card-head"><h2 class="card-title">计算公式</h2></div><div class="card-body"><code class="formula">体育打卡 × 25% + 专项考试 × 30% + 平时表现 × 20% + 体测 × 25%</code><p class="page-caption">最终显示保留一位小数；待审核打卡暂不计入。</p></div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">缺失项</h2></div><div class="card-body">${result.missing.length ? result.missing.map((key) => `<span class="badge badge-warning" style="margin-right:6px">${labels[key]}未录入</span>`).join("") : '<span class="badge badge-success">无缺失</span>'}</div></section>
    <section class="card"><div class="card-head"><h2 class="card-title">数据来源</h2></div><div class="card-body list-stack">${(grades.sources || []).map((source) => `<div class="list-row static"><span><strong>${escapeHtml(typeof source === "string" ? source : `${source.courseCode || "课程"} / Section ${source.section || "—"}`)}</strong><small>${typeof source === "string" ? "已同步" : escapeHtml(source.courseName || "课程数据")}</small></span></div>`).join("") || '<p class="muted">暂无数据来源</p>'}<p class="page-caption">更新时间 ${formatDate(grades.updatedAt)}</p></div></section>
  </section>`;
}
