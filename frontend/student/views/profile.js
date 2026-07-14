import { escapeHtml, formatDate } from "../core/utils.js";

export function filterNotifications(items = [], filter = "all") {
  if (filter === "unread") return items.filter((item) => item.isUnread);
  if (filter === "review") return items.filter((item) => item.category === "审核反馈");
  return items;
}

export function renderNotifications(items = [], filter = "all") {
  const visible = filterNotifications(items, filter);
  return `<section class="page-stack"><button class="button button-secondary" data-route="profile">← 返回我的</button><header><h1 class="page-heading">通知</h1><p class="page-caption">审核反馈、任务提醒和申请结果</p></header>
    <div class="tabs"><button data-notice-filter="all" aria-selected="${filter === "all"}">全部</button><button data-notice-filter="unread" aria-selected="${filter === "unread"}">未读</button><button data-notice-filter="review" aria-selected="${filter === "review"}">审核反馈</button></div>
    <button class="button button-secondary" data-action="mark-all-read">全部标记已读</button>
    <div class="record-list">${visible.map((item) => `<button class="record-card" data-action="read-notice" data-notice-id="${item.id}"><div><strong>${item.isUnread ? "● " : ""}${escapeHtml(item.title)}</strong><span class="page-caption">${formatDate(item.createdAt)}</span></div><p>${escapeHtml(item.message)}</p><span class="badge">${escapeHtml(item.category)}</span></button>`).join("") || '<div class="card"><div class="card-body muted">当前筛选下暂无通知。</div></div>'}</div></section>`;
}

export function renderProfile(state) {
  const student = state.student || {};
  const teacher = state.teacher || {};
  const settings = state.settings || {};
  return `<section class="page-stack profile-page"><header><span class="eyebrow">PROFILE</span><h1 class="page-heading">我的</h1><p class="page-caption">身份、课程联系、组织认证与学生服务</p></header>
    <section class="profile-hero"><div class="avatar">${escapeHtml(student.name?.slice(0,1) || "学")}</div><div><span class="eyebrow">学生身份</span><h2>${escapeHtml(student.name)}</h2><p>${escapeHtml(student.id)} · ${escapeHtml(student.college)} · ${escapeHtml(student.gradeLabel)}</p></div></section>
    <section class="card teacher-card"><div class="card-head"><span class="eyebrow">TEACHER</span><h2 class="card-title">任课老师</h2></div><div class="card-body teacher-body"><div class="teacher-avatar">${escapeHtml(teacher.name?.slice(0,1) || "师")}</div><div><strong>${escapeHtml(teacher.name || "待公布")}</strong><span>${escapeHtml(teacher.title || "大学体育任课教师")}</span><a href="mailto:${escapeHtml(teacher.email || "pe@bnbu.edu.cn")}">${escapeHtml(teacher.email || "pe@bnbu.edu.cn")}</a></div></div></section>
    <section class="card"><div class="card-head"><span class="eyebrow">校队 / 社团抵扣</span><h2 class="card-title">校队 / 社团认证</h2></div><div class="card-body list-stack">${(state.memberships || []).map((item) => `<div class="list-row static"><span><strong>${escapeHtml(item.organization)}</strong><small>${escapeHtml(item.type === "team" ? "校队" : "社团")} · ${escapeHtml(item.status || "待确认")} · 有效期至 ${escapeHtml(item.expiresAt)}</small></span><span class="badge ${item.offsetStatus === "可抵扣" ? "badge-success" : "badge-warning"}">${escapeHtml(item.offsetStatus)}</span></div>`).join("") || '<p class="muted">暂无组织认证</p>'}</div></section>
    <section class="menu-card"><button data-route="notifications"><span><b>通知</b><small>${(state.notifications || []).filter((item) => item.isUnread).length} 条未读</small></span><strong>→</strong></button><button data-route="endurance"><span><b>耐力跑成绩换算</b><small>800m / 1000m 国家标准</small></span><strong>→</strong></button><button data-route="exemptions"><span><b>免测与免打卡</b><small>免测申请、补交材料与审核记录</small></span><strong>→</strong></button><button data-route="privacy"><span><b>隐私政策</b><small>了解体育数据的采集与使用</small></span><strong>→</strong></button></section>
    <section class="card settings-card"><div class="card-head"><span class="eyebrow">SETTINGS</span><h2 class="card-title">设置</h2></div><div class="card-body page-stack"><label class="field"><span>主题模式</span><select data-setting="themeMode"><option value="light" ${settings.themeMode === "light" ? "selected" : ""}>浅色</option><option value="dark" ${settings.themeMode === "dark" ? "selected" : ""}>深色</option><option value="system" ${settings.themeMode === "system" ? "selected" : ""}>跟随系统</option></select></label><label class="toggle-row"><span><strong>减少动态效果</strong><small>关闭非必要页面动画</small></span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? "checked" : ""}></label><button class="button button-secondary" data-action="reset-demo">重置演示数据</button></div></section>
    <button class="button button-danger button-block" data-action="logout">退出登录</button>
  </section>`;
}

export function renderSettings(settings = {}) {
  return `<section class="page-stack"><button class="button button-secondary" data-route="profile">← 返回我的</button><header><h1 class="page-heading">设置</h1></header><section class="card"><div class="card-body page-stack"><label class="toggle-row"><span><strong>减少动态效果</strong><small>遵循设备辅助功能偏好</small></span><input type="checkbox" data-setting="reducedMotion" ${settings.reducedMotion ? "checked" : ""}></label><button class="button button-secondary" data-action="reset-demo">重置演示数据</button></div></section></section>`;
}
