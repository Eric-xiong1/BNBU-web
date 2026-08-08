"use client";

import { useCallback, useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { adminCopy, adminLabel } from "./admin-i18n";
import { adminApiErrorText, getSystemModeProjection } from "./admin-service";
import type { AdminLocale, SystemMode, SystemModeProjection } from "./admin-types";
import { AdminBadge, AdminLoadError, AdminLoading, AdminSectionHeading, formatAdminDate } from "./admin-components";

export function AdminSystem({ locale }: { locale: AdminLocale }) {
  const [projection, setProjection] = useState<SystemModeProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProjection(await getSystemModeProjection());
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
  if (error || !projection) return <AdminLoadError locale={locale} message={error || adminCopy(locale, "load_error")} retry={() => void load()} />;

  const modes: SystemMode[] = ["NORMAL", "READ_ONLY", "MAINTENANCE"];
  return (
    <div className="admin-page-stack">
      <aside className="admin-readonly-banner"><span aria-hidden="true">API</span><b>{adminCopy(locale, "api_data_notice")}</b></aside>
      <section className="admin-surface">
        <AdminSectionHeading title={adminCopy(locale, "system_mode")} description={adminCopy(locale, "contract_readonly")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
        <div className="admin-summary-grid">
          <div><span>{adminCopy(locale, "system_mode")}</span><b>{adminLabel(locale, "systemMode", projection.mode)}</b><small><AdminBadge tone={projection.mode === "NORMAL" ? "green" : projection.mode === "READ_ONLY" ? "orange" : "red"}>{projection.mode}</AdminBadge></small></div>
          <div><span>{adminCopy(locale, "policy_version")}</span><b>{projection.policyVersion}</b></div>
          <div><span>{adminCopy(locale, "updated_at")}</span><b>{formatAdminDate(locale, projection.updatedAt, true)}</b></div>
        </div>
      </section>
      <section className="admin-surface">
        <AdminSectionHeading title={locale === "zh" ? "模式切换" : "Change mode"} description={adminCopy(locale, "mode_switch_unavailable")} />
        <AppSelect
          label={adminCopy(locale, "system_mode")}
          value={projection.mode}
          disabled
          options={modes.map((mode) => ({ value: mode, label: adminLabel(locale, "systemMode", mode) }))}
        />
        <div className="admin-form-actions">
          {modes.map((mode) => <button className="secondary-button" type="button" disabled key={mode}>{adminLabel(locale, "systemMode", mode)} · {adminCopy(locale, "temporarily_unavailable")}</button>)}
        </div>
      </section>
    </div>
  );
}
