"use client";

import { adminCopy, adminLabel } from "./admin-i18n";
import { refreshHealth } from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, AdminRoute } from "./admin-types";
import { AdminBadge, AdminSectionHeading, formatAdminDate } from "./admin-components";

export function AdminOverview({
  locale,
  onNavigate,
  onOpenCourses,
}: {
  locale: AdminLocale;
  onNavigate: (route: AdminRoute) => void;
  onOpenCourses: () => void;
}) {
  const { state, busyKey, run } = useAdminStore();
  if (!state) return null;
  const current = state.semesters.find((semester) => semester.status === "current");
  const pendingRecoveries = state.recoveryRequests.filter((request) => request.status === "pending").length;
  const lockedAccounts = state.users.filter((user) => user.verificationLock).length;
  const incompleteArticles = state.helpArticles.filter((article) => !article.bodyZh.trim() || !article.bodyEn.trim()).length;
  const pendingCorrections = state.gradeCorrections.filter((request) => request.status === "pending").length;
  const todos = [
    { key: "todo_recovery" as const, count: pendingRecoveries, route: "accounts" as const },
    { key: "todo_lock" as const, count: lockedAccounts, route: "accounts" as const },
    { key: "todo_translation" as const, count: incompleteArticles, route: "help" as const },
    { key: "todo_grade_correction" as const, count: pendingCorrections, route: "semesters" as const },
  ].filter((item) => item.count > 0);

  const healthRows = [
    { label: adminCopy(locale, "api_service"), value: `${state.health.apiLatencyMs} ms` },
    { label: adminCopy(locale, "database"), value: adminCopy(locale, "connections", { used: state.health.databaseConnections, limit: state.health.databaseConnectionLimit }) },
    { label: adminCopy(locale, "notification_queue"), value: adminCopy(locale, "backlog", { count: state.health.notificationBacklog }) },
    { label: adminCopy(locale, "object_storage"), value: `${state.health.storageAvailability.toFixed(2)}%` },
  ];

  return (
    <div className="admin-page-stack">
      <section className="admin-surface">
        <AdminSectionHeading
          title={adminCopy(locale, "course_catalog")}
          description={adminCopy(locale, "course_catalog_hint")}
          action={<button className="primary-button" type="button" onClick={onOpenCourses}>{adminCopy(locale, "open_course_catalog")} →</button>}
        />
      </section>
      <section className="admin-summary-grid" aria-label={adminCopy(locale, "overview_metrics")}>
        <button type="button" onClick={() => onNavigate("semesters")}><span>{adminCopy(locale, "current_semester")}</span><b>{current?.name ?? adminCopy(locale, "no_current_semester")}</b><small>{current ? `${formatAdminDate(locale, current.startDate)} – ${formatAdminDate(locale, current.endDate)}` : adminCopy(locale, "not_available")}</small></button>
        <button type="button" onClick={() => onNavigate("accounts")}><span>{adminCopy(locale, "total_users")}</span><b>{state.users.length}</b><small>{state.users.filter((user) => user.role === "teacher").length} {adminLabel(locale, "userRole", "teacher")} · {state.users.filter((user) => user.role === "student").length} {adminLabel(locale, "userRole", "student")}</small></button>
        <button type="button" onClick={() => onNavigate("accounts")}><span>{adminCopy(locale, "pending_recoveries")}</span><b>{pendingRecoveries}</b><small>{adminCopy(locale, "locked_accounts")} · {lockedAccounts}</small></button>
        <button type="button" onClick={() => onNavigate("system")}><span>{adminCopy(locale, "system_mode")}</span><b>{adminLabel(locale, "systemMode", state.systemMode.mode)}</b><small>{formatAdminDate(locale, state.systemMode.changedAt, true)}</small></button>
      </section>

      <div className="admin-two-column">
        <section className="admin-surface">
          <AdminSectionHeading title={adminCopy(locale, "system_todos")} description={adminCopy(locale, "system_todos_hint")} />
          <div className="admin-todo-list">
            {todos.length === 0 ? <p className="admin-quiet-empty">{adminCopy(locale, "empty")}</p> : todos.map((item) => (
              <button type="button" key={item.key} onClick={() => onNavigate(item.route)}>
                <span>{adminCopy(locale, item.key)}</span><AdminBadge tone="orange">{item.count}</AdminBadge><i aria-hidden="true">→</i>
              </button>
            ))}
          </div>
        </section>

        <section className="admin-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "health")}
            description={adminCopy(locale, "health_hint", { time: formatAdminDate(locale, state.health.checkedAt, true) })}
            action={<button className="text-button" type="button" disabled={busyKey === "health.refresh"} onClick={() => void run("health.refresh", refreshHealth, adminCopy(locale, "health_refreshed"))}>{busyKey === "health.refresh" ? adminCopy(locale, "processing") : adminCopy(locale, "refresh_health")}</button>}
          />
          <div className="admin-health-list">
            {healthRows.map((row) => <div key={row.label}><span className="status-dot" /><b>{row.label}</b><small>{row.value}</small><AdminBadge tone="green">{adminCopy(locale, "normal")}</AdminBadge></div>)}
          </div>
        </section>
      </div>

      <section className="admin-surface">
        <AdminSectionHeading title="耐力跑换算表" action={<button className="text-button" type="button" onClick={() => onNavigate("rules")}>管理换算表 →</button>} />
        <div className="admin-rule-snapshot">
          <span><small>已配置规则</small><b>{state.enduranceRules.length} 条</b></span>
          <span><small>适用分组</small><b>4 套</b></span>
        </div>
      </section>
    </div>
  );
}
