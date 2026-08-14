"use client";

import { adminCopy, adminLabel } from "./admin-i18n";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, AdminRoute } from "./admin-types";
import type { WorkspaceMode } from "./portal-app";
import {
  AdminBadge,
  AdminSectionHeading,
  formatAdminDate,
} from "./admin-components";

export function AdminOverview({
  locale,
  mode,
  onNavigate,
  onOpenCourses,
}: {
  locale: AdminLocale;
  mode: WorkspaceMode;
  onNavigate: (route: AdminRoute) => void;
  onOpenCourses: () => void;
}) {
  const { state, loading, refresh } = useAdminStore();
  if (!state) return null;
  const current = state.semesters.find(
    (semester) => semester.status === "current",
  );
  const pendingRecoveries = state.recoveryRequests.filter(
    (request) => request.status === "pending",
  ).length;
  const lockedAccounts = state.users.filter(
    (user) => user.verificationLock,
  ).length;
  const incompleteArticles = state.helpArticles.filter(
    (article) => !article.bodyZh.trim() || !article.bodyEn.trim(),
  ).length;
  const pendingCorrections = state.gradeCorrections.filter(
    (request) => request.status === "pending",
  ).length;
  const todos = [
    {
      key: "todo_recovery" as const,
      count: pendingRecoveries,
      route: "accounts" as const,
    },
    {
      key: "todo_lock" as const,
      count: lockedAccounts,
      route: "accounts" as const,
    },
    {
      key: "todo_translation" as const,
      count: incompleteArticles,
      route: "help" as const,
    },
    {
      key: "todo_grade_correction" as const,
      count: pendingCorrections,
      route: "semesters" as const,
    },
  ].filter((item) => item.count > 0);

  const healthRows = [
    {
      label: adminCopy(locale, "api_service"),
      status: state.health.apiStatus,
      value:
        state.health.apiLatencyMs === null
          ? adminCopy(locale, "not_available")
          : `${state.health.apiLatencyMs} ms`,
    },
    {
      label: adminCopy(locale, "database"),
      status: state.health.databaseStatus,
      value:
        state.health.databaseLatencyMs === null
          ? adminCopy(locale, "not_available")
          : `${state.health.databaseLatencyMs} ms`,
    },
    {
      label: adminCopy(locale, "notification_queue"),
      status: state.health.notificationQueueStatus,
      value:
        state.health.notificationQueueStatus === "UP"
          ? adminCopy(locale, "backlog", {
              count: state.health.notificationBacklog,
            })
          : adminCopy(locale, "not_available"),
    },
    {
      label: adminCopy(locale, "object_storage"),
      status: state.health.objectStorageStatus,
      value:
        state.health.objectStorageLatencyMs === null
          ? adminCopy(locale, "not_available")
          : `${state.health.objectStorageLatencyMs} ms`,
    },
    {
      label: adminCopy(locale, "media_storage"),
      status: state.health.mediaStorageStatus,
      value:
        state.health.mediaStorageLatencyMs === null
          ? adminCopy(locale, "not_available")
          : `${state.health.mediaStorageLatencyMs} ms`,
    },
  ];
  const healthTone = (status: "UP" | "DOWN" | "NOT_CONFIGURED") =>
    status === "UP"
      ? ("green" as const)
      : status === "DOWN"
        ? ("red" as const)
        : ("gray" as const);
  const healthLabel = (status: "UP" | "DOWN" | "NOT_CONFIGURED") =>
    status === "UP"
      ? adminCopy(locale, "normal")
      : status === "DOWN"
        ? adminCopy(locale, "health_down")
        : adminCopy(locale, "health_not_configured");

  if (mode === "real") {
    return (
      <div className="admin-page-stack">
        <aside className="admin-readonly-banner">
          <span aria-hidden="true">API</span>
          <b>{adminCopy(locale, "api_data_notice")}</b>
        </aside>
        <section className="admin-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "course_catalog")}
            description={adminCopy(locale, "course_catalog_hint")}
            action={
              <button
                className="primary-button"
                type="button"
                onClick={onOpenCourses}
              >
                {adminCopy(locale, "open_course_catalog")} →
              </button>
            }
          />
        </section>
        <section className="admin-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "health")}
            description={`${adminCopy(locale, "health_hint", { time: formatAdminDate(locale, state.health.checkedAt, true) })} · requestId: ${state.health.requestId ?? adminCopy(locale, "not_available")}`}
            action={
              <button
                className="text-button"
                type="button"
                disabled={loading}
                onClick={() => void refresh()}
              >
                {loading
                  ? adminCopy(locale, "processing")
                  : adminCopy(locale, "refresh_health")}
              </button>
            }
          />
          <div className="admin-health-list">
            {healthRows.map((row) => (
              <div key={row.label}>
                <span className="status-dot" />
                <b>{row.label}</b>
                <small>{row.value}</small>
                <AdminBadge tone={healthTone(row.status)}>
                  {healthLabel(row.status)}
                </AdminBadge>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-surface">
          <p className="admin-quiet-empty">
            {locale === "zh"
              ? "真实模式可查看支持反馈与已发布帮助内容，并管理服务端总学时规则审批；账号恢复及客户端帮助发布合同尚未开放。"
              : "Real mode can read support feedback and published help content and manage approval of total-hours score rules. Account recovery and client-side help publication are not in the contract."}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-page-stack">
      <section className="admin-surface">
        <AdminSectionHeading
          title={adminCopy(locale, "course_catalog")}
          description={adminCopy(locale, "course_catalog_hint")}
          action={
            <button
              className="primary-button"
              type="button"
              onClick={onOpenCourses}
            >
              {adminCopy(locale, "open_course_catalog")} →
            </button>
          }
        />
      </section>
      <section
        className="admin-summary-grid"
        aria-label={adminCopy(locale, "overview_metrics")}
      >
        <button type="button" onClick={() => onNavigate("semesters")}>
          <span>{adminCopy(locale, "current_semester")}</span>
          <b>{current?.name ?? adminCopy(locale, "no_current_semester")}</b>
          <small>
            {current
              ? `${formatAdminDate(locale, current.startDate)} – ${formatAdminDate(locale, current.endDate)}`
              : adminCopy(locale, "not_available")}
          </small>
        </button>
        <button type="button" onClick={() => onNavigate("accounts")}>
          <span>{adminCopy(locale, "total_users")}</span>
          <b>{state.users.length}</b>
          <small>
            {state.users.filter((user) => user.role === "teacher").length}{" "}
            {adminLabel(locale, "userRole", "teacher")} ·{" "}
            {state.users.filter((user) => user.role === "student").length}{" "}
            {adminLabel(locale, "userRole", "student")}
          </small>
        </button>
        <button type="button" onClick={() => onNavigate("accounts")}>
          <span>{adminCopy(locale, "pending_recoveries")}</span>
          <b>{pendingRecoveries}</b>
          <small>
            {adminCopy(locale, "locked_accounts")} · {lockedAccounts}
          </small>
        </button>
        <button type="button" onClick={() => onNavigate("system")}>
          <span>{adminCopy(locale, "system_mode")}</span>
          <b>{adminLabel(locale, "systemMode", state.systemMode.mode)}</b>
          <small>
            {formatAdminDate(locale, state.systemMode.changedAt, true)}
          </small>
        </button>
      </section>

      <div className="admin-two-column">
        <section className="admin-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "system_todos")}
            description={adminCopy(locale, "system_todos_hint")}
          />
          <div className="admin-todo-list">
            {todos.length === 0 ? (
              <p className="admin-quiet-empty">{adminCopy(locale, "empty")}</p>
            ) : (
              todos.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => onNavigate(item.route)}
                >
                  <span>{adminCopy(locale, item.key)}</span>
                  <AdminBadge tone="orange">{item.count}</AdminBadge>
                  <i aria-hidden="true">→</i>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="admin-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "health")}
            description={adminCopy(locale, "health_hint", {
              time: formatAdminDate(locale, state.health.checkedAt, true),
            })}
            action={
              <button
                className="text-button"
                type="button"
                disabled={loading}
                onClick={() => void refresh()}
              >
                {loading
                  ? adminCopy(locale, "processing")
                  : adminCopy(locale, "refresh_health")}
              </button>
            }
          />
          <div className="admin-health-list">
            {healthRows.map((row) => (
              <div key={row.label}>
                <span className="status-dot" />
                <b>{row.label}</b>
                <small>{row.value}</small>
                <AdminBadge tone={healthTone(row.status)}>
                  {healthLabel(row.status)}
                </AdminBadge>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-surface">
        <AdminSectionHeading
          title={adminCopy(locale, "endurance_table")}
          action={
            <button
              className="text-button"
              type="button"
              onClick={() => onNavigate("rules")}
            >
              {locale === "zh" ? "管理换算表" : "Manage conversion tables"} →
            </button>
          }
        />
        <div className="admin-rule-snapshot">
          <span>
            <small>{locale === "zh" ? "已配置规则" : "Configured rules"}</small>
            <b>
              {locale === "zh"
                ? `${state.enduranceRules.length} 条`
                : `${state.enduranceRules.length} rules`}
            </b>
          </span>
          <span>
            <small>{locale === "zh" ? "适用分组" : "Applicable groups"}</small>
            <b>{locale === "zh" ? "4 套" : "4 groups"}</b>
          </span>
        </div>
      </section>
    </div>
  );
}
