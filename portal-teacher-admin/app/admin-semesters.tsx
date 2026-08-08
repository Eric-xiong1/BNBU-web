"use client";

import { useCallback, useEffect, useState } from "react";
import { adminCopy } from "./admin-i18n";
import { adminApiErrorText, getCurrentSemesterProjection } from "./admin-service";
import type { AdminLocale, CurrentSemesterProjection } from "./admin-types";
import { AdminBadge, AdminLoadError, AdminLoading, AdminSectionHeading, formatAdminDate } from "./admin-components";

export function AdminSemesters({ locale }: { locale: AdminLocale }) {
  const [semester, setSemester] = useState<CurrentSemesterProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSemester(await getCurrentSemesterProjection());
    } catch (failure) {
      setError(adminApiErrorText(failure));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = globalThis.setTimeout(() => { void load(); }, 0);
    return () => globalThis.clearTimeout(timer);
  }, [load]);

  if (loading) return <AdminLoading locale={locale} />;
  if (error || !semester) return <AdminLoadError locale={locale} message={error || adminCopy(locale, "no_current_semester")} retry={() => void load()} />;

  return (
    <div className="admin-page-stack">
      <aside className="admin-readonly-banner"><span aria-hidden="true">API</span><b>{adminCopy(locale, "current_semester_contract")}</b></aside>
      <section className="admin-surface">
        <AdminSectionHeading title={adminCopy(locale, "current_semester")} description={adminCopy(locale, "contract_readonly")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
        <div className="admin-detail-list">
          <span><small>{locale === "zh" ? "学期名称" : "Semester name"}</small><b>{semester.displayName}</b></span>
          <span><small>{adminCopy(locale, "academic_year")}</small><b>{semester.academicYear}</b></span>
          <span><small>{adminCopy(locale, "term_code")}</small><code>{semester.termCode}</code></span>
          <span><small>{adminCopy(locale, "date_range")}</small><b>{formatAdminDate(locale, semester.startDate)} – {formatAdminDate(locale, semester.endDate)}</b></span>
          <span><small>{adminCopy(locale, "status")}</small><AdminBadge tone={semester.isCurrent ? "green" : "gray"}>{semester.status}</AdminBadge></span>
          <span><small>{adminCopy(locale, "organization")}</small><code>{semester.organizationId}</code></span>
          <span><small>{adminCopy(locale, "updated_at")}</small><b>{formatAdminDate(locale, semester.updatedAt, true)}</b></span>
          <span><small>{adminCopy(locale, "record_version")}</small><b>{semester.version}</b></span>
        </div>
      </section>
    </div>
  );
}
