import { escapeHtml } from "../core/utils.js";
import { icon } from "../core/icons.js";
import { brandMark } from "../core/brand.js";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const hours = (value) => `${number(value).toFixed(number(value) % 1 ? 1 : 0)}h`;

export function dashboardRisk(state = {}) {
  const summary = state.summary || {};
  const rules = summary.rule || {};
  if (state.activeSession) {
    return {
      tone: "warning",
      title: "运动进行中",
      message: "你有一次尚未结束的运动，点此继续计时或结束记录。",
      action: "继续运动",
      route: "checkin",
    };
  }
  const courseGap = Math.max(0, number(rules.courseRequired || 10) - number(summary.courseHours));
  const generalGap = Math.max(0, number(rules.generalRequired || 10) - number(summary.generalHours));
  if (courseGap > 0) {
    return { tone: "warning", title: "优先补齐课程相关", message: `课程相关还差 ${hours(courseGap)}，请优先完成临近截止的教学班任务。`, action: "查看课程", route: "courses" };
  }
  if (generalGap > 0) {
    return { tone: "warning", title: "继续完成其他运动", message: `其他运动还差 ${hours(generalGap)}，可通过自主运动打卡或有效组织认证完成。`, action: "去打卡", route: "checkin" };
  }
  return { tone: "success", title: "本学期学时已达标", message: "课程相关与其他运动均达到要求，请继续保持运动并关注课程通知。", action: "查看成绩", route: "grades" };
}

function progressCell(label, value, total, detail) {
  const percent = total ? Math.min(100, Math.round((number(value) / number(total)) * 100)) : 0;
  return `<div class="progress-cell"><div><span>${escapeHtml(label)}</span><strong>${hours(value)} <small>/ ${hours(total)}</small></strong></div><div class="progress"><i style="width:${percent}%"></i></div><small>${escapeHtml(detail)}</small></div>`;
}

function focusItems(state) {
  const summary = state.summary || {};
  const rules = summary.rule || {};
  const courseGap = Math.max(0, number(rules.courseRequired || 10) - number(summary.courseHours));
  const generalGap = Math.max(0, number(rules.generalRequired || 10) - number(summary.generalHours));
  return [
    { label: "课程相关", value: courseGap ? `还差 ${hours(courseGap)}` : "已完成", route: "courses" },
    { label: "其他运动", value: generalGap ? `还差 ${hours(generalGap)}` : "已完成", route: "checkin" },
    { label: "运动记录", value: `${number((state.records || []).length)} 条`, route: "checkin" },
  ];
}

export function renderDashboard(state = {}) {
  const student = state.student || {};
  const summary = state.summary || {};
  const rule = summary.rule || {};
  const risk = dashboardRisk(state);
  const activeSession = state.activeSession;
  const unread = (state.notifications || []).filter((notice) => notice.isUnread).length;
  const total = number(rule.total || summary.totalRequired || 20);
  const completed = number(summary.totalCompleted || number(summary.courseHours) + number(summary.generalHours));
  const totalPercent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return `<section class="page-stack dashboard-page">
    <header class="dashboard-header">
      <div class="dashboard-identity">
        ${brandMark({ className: "dashboard-emblem" })}
        <div><span class="eyebrow">STUDENT DASHBOARD</span><h1 class="page-heading">你好，${escapeHtml(student.name || "同学")}</h1><p class="page-caption">本学期体育进度与下一步行动</p></div>
      </div>
      <button class="icon-button notification-button" type="button" data-action="open-notifications" aria-label="打开通知">
        ${icon("notifications")}${unread ? `<span>${unread}</span>` : ""}
      </button>
    </header>
    <div class="dashboard-grid">
      <section class="card progress-hero">
        <div class="card-body">
          <div class="section-kicker">学时进度</div>
          <div class="total-progress"><div><span>已完成</span><strong>${hours(completed)} <small>/ ${hours(total)}</small></strong></div><b>${totalPercent}%</b></div>
          <div class="progress progress-large"><i style="width:${totalPercent}%"></i></div>
          <div class="progress-split">
            ${progressCell("课程相关", summary.courseHours, rule.courseRequired || 10, Math.max(0, number(rule.courseRequired || 10) - number(summary.courseHours)) ? `还差 ${hours(Math.max(0, number(rule.courseRequired || 10) - number(summary.courseHours)))}` : "已完成")}
            ${progressCell("其他运动", summary.generalHours, rule.generalRequired || 10, Math.max(0, number(rule.generalRequired || 10) - number(summary.generalHours)) ? `还差 ${hours(Math.max(0, number(rule.generalRequired || 10) - number(summary.generalHours)))}` : "已完成")}
          </div>
        </div>
      </section>
      <section class="card risk-panel risk-${risk.tone}">
        <div class="card-body"><span class="section-kicker">风险提示</span><h2>${escapeHtml(risk.title)}</h2><p>${escapeHtml(risk.message)}</p><button class="button button-tonal" data-route="${risk.route}">${escapeHtml(risk.action)}</button></div>
      </section>
      <section class="card focus-panel"><div class="card-head"><div><span class="section-kicker">FOCUS</span><h2 class="card-title">重点计划</h2></div></div><div class="card-body focus-list">
        ${focusItems(state).map((item) => `<button data-route="${item.route}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><b aria-hidden="true">›</b></button>`).join("")}
      </div></section>
      <section class="card start-panel"><div class="card-head"><div><span class="section-kicker">EXERCISE</span><h2 class="card-title">运动服务</h2></div></div><div class="card-body page-stack">
        <p class="page-caption">${activeSession ? "你有一次进行中的运动，点此回到计时。" : "开始运动 → 计时 → 结束记录，满 1 小时计 1 学时。"}</p>
        <button class="button button-primary button-block" data-route="checkin">${activeSession ? "继续运动" : "开始运动"}</button>
      </div></section>
    </div>
  </section>`;
}
