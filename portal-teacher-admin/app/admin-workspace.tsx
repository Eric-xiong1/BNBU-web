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
import { getCurrentSemesterProjection, getSystemModeProjection } from "./admin-service";
import { TabPageTransition, type TabTransitionDirection } from "./teacher-tab-page-transition";
import type { AdminLocale, AdminRoute, AdminState } from "./admin-types";

const adminRoutes: AdminRoute[] = ["overview", "semesters", "accounts", "support", "rules", "system", "help", "audit"];

function AdminPage({
  active,
  locale,
  onNavigate,
  onOpenCourses,
}: {
  active: AdminRoute;
  locale: AdminLocale;
  onNavigate: (route: AdminRoute) => void;
  onOpenCourses: () => void;
}) {
  const { state, loading, loadError, refresh } = useAdminStore();
  if (loading) return <AdminLoading locale={locale} />;
  if (loadError) return <AdminLoadError locale={locale} message={loadError} retry={() => void refresh()} />;
  if (!state) return <AdminLoadError locale={locale} message={adminCopy(locale, "load_error")} retry={() => void refresh()} />;
  if (!ADMIN_PERMISSIONS.has(ADMIN_ROUTE_PERMISSION[active])) {
    return <div className="admin-empty-state is-error" role="alert"><span>!</span><h2>{adminCopy(locale, "permission_denied")}</h2></div>;
  }
  if (active === "semesters") return <AdminSemesters locale={locale} />;
  if (active === "accounts") return <AdminUsers locale={locale} />;
  if (active === "support") return <AdminSupport locale={locale} />;
  if (active === "rules") return <AdminRules locale={locale} />;
  if (active === "system") return <AdminSystem locale={locale} />;
  if (active === "help") return <AdminHelp locale={locale} />;
  if (active === "audit") return <AdminAudit locale={locale} />;
  return <AdminOverview locale={locale} onNavigate={onNavigate} onOpenCourses={onOpenCourses} />;
}

export function AdminWorkspace({
  active,
  direction,
  locale,
  showToast,
  onNavigate,
  onContextChange,
}: {
  active: string;
  direction: TabTransitionDirection;
  locale: AdminLocale;
  showToast: (message: string) => void;
  onNavigate: (route: AdminRoute) => void;
  onContextChange?: (context: { semesterName: string; notificationCount: number; systemMode: AdminState["systemMode"]["mode"] }) => void;
}) {
  const route = adminRoutes.includes(active as AdminRoute) ? active as AdminRoute : "overview";
  const [showCourses, setShowCourses] = useState(false);
  const backendContextRef = useRef<{
    semesterName?: string;
    systemMode?: AdminState["systemMode"]["mode"];
  }>({});
  const latestNotificationCountRef = useRef(0);

  const publishBackendContext = useCallback(() => {
    onContextChange?.({
      semesterName: backendContextRef.current.semesterName ?? adminCopy(locale, "no_current_semester"),
      notificationCount: latestNotificationCountRef.current,
      systemMode: backendContextRef.current.systemMode ?? "NORMAL",
    });
  }, [locale, onContextChange]);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([getCurrentSemesterProjection(), getSystemModeProjection()]).then(([semester, systemMode]) => {
      if (cancelled) return;
      if (semester.status === "fulfilled") backendContextRef.current.semesterName = semester.value.displayName;
      if (systemMode.status === "fulfilled") backendContextRef.current.systemMode = systemMode.value.mode;
      publishBackendContext();
    });
    return () => {
      cancelled = true;
    };
  }, [publishBackendContext]);

  useEffect(() => {
    if (route === "overview") return;
    const frame = window.requestAnimationFrame(() => setShowCourses(false));
    return () => window.cancelAnimationFrame(frame);
  }, [route]);
  const handleStateChange = useCallback((state: AdminState) => {
    latestNotificationCountRef.current = state.notifications.length;
    publishBackendContext();
  }, [publishBackendContext]);
  return (
    <div className="admin-i18n-boundary" translate="no">
      <AdminStoreProvider locale={locale} showToast={showToast} onStateChange={handleStateChange}>
        <TabPageTransition
          activeKey={showCourses ? "course-catalog" : route}
          direction={direction}
          renderPage={(pageKey) => (
            <div className="teacher-page-layout admin-page-layout admin-business-page">
              {pageKey === "course-catalog"
                ? <AdminCourses locale={locale} onBack={() => setShowCourses(false)} />
                : <AdminPage active={pageKey as AdminRoute} locale={locale} onNavigate={onNavigate} onOpenCourses={() => setShowCourses(true)} />}
            </div>
          )}
        />
      </AdminStoreProvider>
    </div>
  );
}
