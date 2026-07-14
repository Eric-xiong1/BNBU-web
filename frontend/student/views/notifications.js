import { escapeHtml, formatDate } from "../core/utils.js";
import { icon } from "../core/icons.js";

const visibleNotices = (notices, filter) => notices.filter((notice) => {
  if (filter === "unread") return notice.isUnread;
  if (filter === "review") return notice.category === "审核反馈";
  return true;
});

export function renderNotificationDrawer({ notices = [], filter = "all", selectedId = null } = {}) {
  const selected = notices.find((notice) => notice.id === selectedId);
  const unread = notices.filter((notice) => notice.isUnread).length;
  const list = visibleNotices(notices, filter);
  return `<div class="drawer-layer" data-notification-drawer>
    <button class="drawer-scrim" type="button" data-action="close-notifications" aria-label="关闭通知"></button>
    <section class="notification-drawer" role="dialog" aria-modal="true" aria-label="通知中心">
      <div class="drawer-handle" aria-hidden="true"></div>
      <header class="drawer-header">
        <button class="icon-button" type="button" data-action="${selected ? "back-notices" : "close-notifications"}" aria-label="${selected ? "返回通知列表" : "关闭通知"}">${icon(selected ? "back" : "close")}</button>
        <div><span class="eyebrow">NOTIFICATIONS</span><h2>${selected ? "通知详情" : "通知"}</h2></div>
        ${selected ? `<span class="drawer-spacer"></span>` : `<button class="text-action" type="button" data-action="mark-all-read" ${unread ? "" : "disabled"}>全部已读</button>`}
      </header>
      ${selected ? `<article class="notice-detail"><div class="notice-detail-meta"><span class="badge">${escapeHtml(selected.category || "系统通知")}</span><time>${formatDate(selected.createdAt)}</time></div><h3>${escapeHtml(selected.title)}</h3><p>${escapeHtml(selected.message)}</p>${selected.isUnread ? `<button class="button button-tonal" type="button" data-action="read-notice" data-notice-id="${escapeHtml(selected.id)}">标记为已读</button>` : '<span class="read-state">已读</span>'}</article>` : `<div class="drawer-content"><div class="filter-chips drawer-filters" aria-label="通知筛选">${[["all","全部"],["unread","未读"],["review","审核反馈"]].map(([id,label]) => `<button type="button" data-notice-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join("")}</div><div class="notice-list">${list.map((notice) => `<button class="notice-row ${notice.isUnread ? "is-unread" : ""}" type="button" data-action="open-notice" data-notice-id="${escapeHtml(notice.id)}"><span class="notice-dot" aria-hidden="true"></span><span><strong>${escapeHtml(notice.title)}</strong><small>${escapeHtml(notice.message)}</small><time>${formatDate(notice.createdAt)}</time></span><b aria-hidden="true">›</b></button>`).join("") || '<div class="empty-drawer"><strong>暂无通知</strong><span>当前筛选条件下没有通知。</span></div>'}</div></div>`}
    </section>
  </div>`;
}
