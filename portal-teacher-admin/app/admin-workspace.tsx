"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_PERMISSIONS, ADMIN_ROUTE_PERMISSION } from "./admin-domain";
import { adminCopy } from "./admin-i18n";
import { AdminAudit } from "./admin-audit";
import { AdminCourses } from "./admin-courses";
import { AdminHelp } from "./admin-help";
import { AdminOverview } from "./admin-overview";
import { AdminRules } from "./admin-rules";
import { AdminSemesters } from "./admin-semesters";
import { AdminStoreProvider, useAdminStore } from "./admin-store";
import { AdminSupport } from "./admin-support";
import { AdminSystem } from "./admin-system";
import { AdminUsers } from "./admin-users";
import { AdminLoadError, AdminLoading } from "./admin-components";
import {
  getCurrentSemesterProjection,
  getSystemModeProjection,
} from "./admin-service";
import {
  TabPageTransition,
  type TabTransitionDirection,
} from "./teacher-tab-page-transition";
import type { AdminLocale, AdminRoute, AdminState } from "./admin-types";
import type { WorkspaceMode } from "./portal-app";

const adminRoutes: AdminRoute[] = [
  "overview",
  "semesters",
  "accounts",
  "support",
  "rules",
  "system",
  "help",
  "audit",
];

function AdminPage({
  active,
  locale,
  mode,
  onNavigate,
  onOpenCourses,
}: {
  active: AdminRoute;
  locale: AdminLocale;
  mode: WorkspaceMode;
  onNavigate: (route: AdminRoute) => void;
  onOpenCourses: () => void;
}) {
  const { state, loading, loadError, refresh } = useAdminStore();
  if (loading) return <AdminLoading locale={locale} />;
  if (loadError)
    return (
      <AdminLoadError
        locale={locale}
        message={loadError}
        retry={() => void refresh()}
      />
    );
  if (!state)
    return (
      <AdminLoadError
        locale={locale}
        message={adminCopy(locale, "load_error")}
        retry={() => void refresh()}
      />
    );
  if (!ADMIN_PERMISSIONS.has(ADMIN_ROUTE_PERMISSION[active])) {
    return (
      <div className="admin-empty-state is-error" role="alert">
        <span>!</span>
        <h2>{adminCopy(locale, "permission_denied")}</h2>
      </div>
    );
  }
  if (active === "semesters")
    return mode === "real" ? (
      <AdminSemesters locale={locale} />
    ) : (
      <DemoUnavailableCapability locale={locale} capability="semesters" />
    );
  if (active === "accounts")
    return mode === "real" ? (
      <AdminUsers locale={locale} />
    ) : (
      <DemoUnavailableCapability locale={locale} capability="accounts" />
    );
  if (active === "support")
    return <AdminSupport locale={locale} />;
  if (active === "rules")
    return <AdminRules locale={locale} />;
  if (active === "system")
    return mode === "real" ? (
      <AdminSystem locale={locale} />
    ) : (
      <DemoUnavailableCapability locale={locale} capability="system" />
    );
  if (active === "help")
    return <AdminHelp locale={locale} />;
  if (active === "audit")
    return mode === "real" ? (
      <AdminAudit locale={locale} />
    ) : (
      <DemoUnavailableCapability locale={locale} capability="audit" />
    );
  return (
    <AdminOverview
      locale={locale}
      mode={mode}
      onNavigate={onNavigate}
      onOpenCourses={onOpenCourses}
    />
  );
}

function DemoUnavailableCapability({
  locale,
  capability,
}: {
  locale: AdminLocale;
  capability: string;
}) {
  return (
    <div className="admin-empty-state" role="status">
      <span>DEMO</span>
      <h2>
        {locale === "zh"
          ? "此页没有离线演示数据"
          : "No offline demo data for this page"}
      </h2>
      <p>
        {locale === "zh"
          ? `${capability} 不会在演示会话中请求真实 Backend；请退出后使用真实管理员账号登录。`
          : `${capability} does not call the real Backend during a demo session. Sign out and use a real administrator account.`}
      </p>
    </div>
  );
}

export function AdminWorkspace({
  active,
  direction,
  locale,
  mode,
  showToast,
  onNavigate,
  onContextChange,
}: {
  active: string;
  direction: TabTransitionDirection;
  locale: AdminLocale;
  mode: WorkspaceMode;
  showToast: (message: string) => void;
  onNavigate: (route: AdminRoute) => void;
  onContextChange?: (context: {
    semesterName: string;
    notificationCount: number;
    systemMode: AdminState["systemMode"]["mode"];
  }) => void;
}) {
  const route = adminRoutes.includes(active as AdminRoute)
    ? (active as AdminRoute)
    : "overview";
  const [showCourses, setShowCourses] = useState(false);
  const backendContextRef = useRef<{
    semesterName?: string;
    systemMode?: AdminState["systemMode"]["mode"];
  }>({});
  const latestNotificationCountRef = useRef(0);

  const publishBackendContext = useCallback(() => {
    onContextChange?.({
      semesterName:
        backendContextRef.current.semesterName ??
        adminCopy(locale, "no_current_semester"),
      notificationCount: latestNotificationCountRef.current,
      systemMode: backendContextRef.current.systemMode ?? "NORMAL",
    });
  }, [locale, onContextChange]);

  useEffect(() => {
    if (mode === "demo") return;
    let cancelled = false;
    void Promise.allSettled([
      getCurrentSemesterProjection(),
      getSystemModeProjection(),
    ]).then(([semester, systemMode]) => {
      if (cancelled) return;
      if (semester.status === "fulfilled")
        backendContextRef.current.semesterName = semester.value.displayName;
      if (systemMode.status === "fulfilled")
        backendContextRef.current.systemMode = systemMode.value.mode;
      publishBackendContext();
    });
    return () => {
      cancelled = true;
    };
  }, [mode, publishBackendContext]);

  useEffect(() => {
    if (route === "overview") return;
    const frame = window.requestAnimationFrame(() => setShowCourses(false));
    return () => window.cancelAnimationFrame(frame);
  }, [route]);
  const handleStateChange = useCallback(
    (state: AdminState) => {
      latestNotificationCountRef.current = state.notifications.length;
      if (mode === "demo") {
        backendContextRef.current.semesterName = state.semesters.find(
          (semester) => semester.status === "current",
        )?.name;
        backendContextRef.current.systemMode = state.systemMode.mode;
      }
      publishBackendContext();
    },
    [mode, publishBackendContext],
  );
  return (
    <div className="admin-i18n-boundary">
      <AdminStoreProvider
        mode={mode}
        locale={locale}
        showToast={showToast}
        onStateChange={handleStateChange}
      >
        <TabPageTransition
          activeKey={showCourses ? "course-catalog" : route}
          direction={direction}
          renderPage={(pageKey) => (
            <div className="teacher-page-layout admin-page-layout admin-business-page">
              {pageKey === "course-catalog" ? (
                mode === "real" ? (
                  <AdminCourses
                    locale={locale}
                    onBack={() => setShowCourses(false)}
                  />
                ) : (
                  <DemoUnavailableCapability
                    locale={locale}
                    capability="course catalog"
                  />
                )
              ) : (
                <AdminPage
                  active={pageKey as AdminRoute}
                  locale={locale}
                  mode={mode}
                  onNavigate={onNavigate}
                  onOpenCourses={() => setShowCourses(true)}
                />
              )}
            </div>
          )}
        />
      </AdminStoreProvider>
    </div>
  );
}
