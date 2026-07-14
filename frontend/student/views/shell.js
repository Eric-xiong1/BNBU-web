import { NAV_ITEMS } from "../core/constants.js";
import { escapeHtml } from "../core/utils.js";
import { icon } from "../core/icons.js";

export function renderBottomNav(active) {
  return `<nav class="bottom-nav" aria-label="学生端主导航">${NAV_ITEMS.map((item) => `
    <button class="nav-button ${active === item.id ? "is-active" : ""}" type="button" data-route="${item.route}" aria-current="${active === item.id ? "page" : "false"}">
      ${icon(item.icon, "nav-icon")}<span>${item.label}</span>
    </button>`).join("")}</nav>`;
}

export function renderShell({ active = "checkin", title = "运动打卡", content = "", mode = "real", unread = 0, overlay = "" }) {
  return `<div class="student-shell">
    <header class="student-topbar">
      <div><span class="brand-word">BNBU</span><span class="muted" style="margin-left:8px">学生端</span></div>
      <div class="topbar-title">${escapeHtml(title)}</div>
      <button class="topbar-notification" type="button" data-action="open-notifications" aria-label="打开通知">${icon("notifications")}${unread ? `<sup>${unread}</sup>` : ""}</button>
    </header>
    ${mode === "demo" ? '<div class="notice" style="margin:12px 16px 0">演示模式（未连接后端）</div>' : ""}
    <main class="student-main">${content}</main>
    <div id="student-toast" role="status" aria-live="polite"></div>
    <div id="student-modal"></div>
    ${renderBottomNav(active)}
    ${overlay}
  </div>`;
}

export function renderPlaceholder(title, description) {
  return `<section class="page-stack"><header><h1 class="page-heading">${escapeHtml(title)}</h1><p class="page-caption">${escapeHtml(description)}</p></header><div class="card"><div class="card-body"><p class="muted">模块正在初始化，请稍候。</p></div></div></section>`;
}
