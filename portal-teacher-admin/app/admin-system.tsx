"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { adminCopy, adminLabel } from "./admin-i18n";
import { publishMaintenanceAnnouncement, purgeAllBusinessData, switchSystemMode } from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, MaintenanceAnnouncement, MaintenanceKind, SystemMode } from "./admin-types";
import { AdminBadge, AdminConfirm, AdminDialog, AdminField, AdminInlineError, AdminSectionHeading, formatAdminDate, type AdminTone } from "./admin-components";

function modeTone(mode: SystemMode): AdminTone {
  return mode === "NORMAL" ? "green" : mode === "READ_ONLY" ? "orange" : "red";
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function AnnouncementDialog({ locale, close }: { locale: AdminLocale; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const [kind, setKind] = useState<MaintenanceKind>("planned");
  const [titleZh, setTitleZh] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [messageZh, setMessageZh] = useState("");
  const [messageEn, setMessageEn] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [expectedRecoveryAt, setExpectedRecoveryAt] = useState("");
  const key = "maintenance.announce";
  useEffect(() => () => clearError(), [clearError]);
  const submit = async () => {
    const result = await run(key, () => publishMaintenanceAnnouncement({ kind, titleZh, titleEn, messageZh, messageEn, startsAt: toIso(startsAt), expectedRecoveryAt: expectedRecoveryAt ? toIso(expectedRecoveryAt) : undefined }), adminCopy(locale, "announcement_published"));
    if (result) close();
  };
  const kindLabel = (value: MaintenanceKind) => value === "planned" ? (locale === "en" ? "Scheduled maintenance" : "计划内维护") : value === "emergency" ? (locale === "en" ? "Emergency maintenance" : "紧急维护") : (locale === "en" ? "Service recovery" : "维护完成");
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, "publish_announcement")} description={adminCopy(locale, "planned_48h")} close={close} dirty={Boolean(titleZh || titleEn || messageZh || messageEn)} wide footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className="primary-button" type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "publish_announcement")}</button>
    </>}>
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "maintenance_kind")} required><AppSelect label={adminCopy(locale, "maintenance_kind")} value={kind} options={(["planned", "emergency", "recovery"] as MaintenanceKind[]).map((value) => ({ value, label: kindLabel(value) }))} onChange={(value) => value && setKind(value as MaintenanceKind)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "starts_at")} required><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "expected_recovery")}><input type="datetime-local" value={expectedRecoveryAt} onChange={(event) => setExpectedRecoveryAt(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "title_zh")} required><input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "title_en")} required><input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "message_zh")} required><textarea value={messageZh} onChange={(event) => setMessageZh(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "message_en")} required><textarea value={messageEn} onChange={(event) => setMessageEn(event.target.value)} /></AdminField>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

function PurgeAllBusinessDataDialog({ locale, close }: { locale: AdminLocale; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const key = "system.business-data.purge";
  useEffect(() => () => clearError(), [clearError]);

  const submit = async () => {
    const result = await run(key, () => purgeAllBusinessData({ adminPassword, confirmation, reason }), adminCopy(locale, "purge_completed"));
    if (result) close();
  };

  return <AdminDialog locale={locale} title={adminCopy(locale, "purge_all_data_title")} description={adminCopy(locale, "purge_all_data_body")} close={close} dirty={Boolean(adminPassword || confirmation || reason)} footer={<>
    <button className="secondary-button" type="button" onClick={close} disabled={busyKey === key}>{adminCopy(locale, "cancel")}</button>
    <button className="danger-button" type="button" onClick={() => void submit()} disabled={busyKey === key || !adminPassword || confirmation.trim() !== "ERASE" || !reason.trim()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "purge_all_business_data")}</button>
  </>}>
    <aside className="admin-cascade-warning"><b>{adminCopy(locale, "purge_all_data_body")}</b><ul><li>{adminCopy(locale, "purge_audit_notice")}</li></ul></aside>
    <div className="admin-form-grid">
      <AdminField locale={locale} label={adminCopy(locale, "admin_password")} required errorCode={error?.fieldErrors.adminPassword}><input type="password" autoComplete="current-password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} /></AdminField>
      <AdminField locale={locale} label={adminCopy(locale, "purge_confirmation")} required errorCode={error?.fieldErrors.confirmation}><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></AdminField>
      <AdminField locale={locale} label={adminCopy(locale, "purge_reason")} required errorCode={error?.fieldErrors.reason}><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
    </div>
    <AdminInlineError message={error?.message} />
  </AdminDialog>;
}

export function AdminSystem({ locale }: { locale: AdminLocale }) {
  const { state, busyKey, error, clearError, run } = useAdminStore();
  const [targetMode, setTargetMode] = useState<SystemMode>(() => state!.systemMode.mode);
  const [reason, setReason] = useState("");
  const [titleZh, setTitleZh] = useState("系统维护中");
  const [titleEn, setTitleEn] = useState("System maintenance in progress");
  const [messageZh, setMessageZh] = useState("");
  const [messageEn, setMessageEn] = useState("");
  const [expectedRecoveryAt, setExpectedRecoveryAt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [purgeOpen, setPurgeOpen] = useState(false);
  useEffect(() => () => clearError(), [clearError]);
  if (!state) return null;
  const key = "system.mode.switch";
  const modes: SystemMode[] = ["NORMAL", "READ_ONLY", "MAINTENANCE"];
  const impactKey = targetMode === "NORMAL" ? "normal_impact" : targetMode === "READ_ONLY" ? "readonly_impact" : "maintenance_impact";
  const switchMode = async () => {
    const announcement: Omit<MaintenanceAnnouncement, "id" | "publishedAt" | "publishedBy"> | undefined = targetMode === "MAINTENANCE" ? {
      kind: "emergency",
      titleZh,
      titleEn,
      messageZh,
      messageEn,
      startsAt: new Date().toISOString(),
      expectedRecoveryAt: expectedRecoveryAt ? toIso(expectedRecoveryAt) : undefined,
    } : undefined;
    const result = await run(key, () => switchSystemMode(targetMode, reason, announcement), adminCopy(locale, "mode_switched"));
    if (result) {
      setReason(""); setMessageZh(""); setMessageEn(""); setExpectedRecoveryAt(""); setConfirmOpen(false);
    }
  };
  const announcementKind = (kind: MaintenanceKind) => kind === "planned" ? (locale === "en" ? "Scheduled" : "计划内") : kind === "emergency" ? (locale === "en" ? "Emergency" : "紧急") : (locale === "en" ? "Recovered" : "已恢复");
  return (
    <div className="admin-page-stack">
      <div className="admin-system-layout">
        <section className="admin-surface admin-settings-panel">
          <div className="admin-current-mode"><span className={`admin-mode-dot is-${state.systemMode.mode.toLowerCase()}`} /><div><small>{adminCopy(locale, "current_mode")}</small><h2>{adminLabel(locale, "systemMode", state.systemMode.mode)}</h2><p>{adminCopy(locale, "mode_changed_at", { time: formatAdminDate(locale, state.systemMode.changedAt, true), actor: state.systemMode.changedBy })}</p></div><AdminBadge tone={modeTone(state.systemMode.mode)}>{adminLabel(locale, "systemMode", state.systemMode.mode)}</AdminBadge></div>
          <AdminSectionHeading title={adminCopy(locale, "select_mode")} description={adminCopy(locale, "switch_mode_body")} />
          <div className="admin-mode-options">
            {modes.map((mode) => <label className={targetMode === mode ? "selected" : ""} key={mode}><input type="radio" name="admin-system-mode" checked={targetMode === mode} onChange={() => setTargetMode(mode)} /><span><b>{adminLabel(locale, "systemMode", mode)}</b><small>{adminCopy(locale, mode === "NORMAL" ? "normal_impact" : mode === "READ_ONLY" ? "readonly_impact" : "maintenance_impact")}</small></span></label>)}
          </div>
          <AdminField locale={locale} label={adminCopy(locale, "mode_reason")} required errorCode={error?.fieldErrors.reason}><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
          {targetMode === "MAINTENANCE" && <div className="admin-maintenance-fields"><h3>{adminCopy(locale, "maintenance_notice")}</h3><div className="admin-form-grid two-columns"><AdminField locale={locale} label={adminCopy(locale, "title_zh")} required><input value={titleZh} onChange={(event) => setTitleZh(event.target.value)} /></AdminField><AdminField locale={locale} label={adminCopy(locale, "title_en")} required><input value={titleEn} onChange={(event) => setTitleEn(event.target.value)} /></AdminField><AdminField locale={locale} label={adminCopy(locale, "message_zh")} required><textarea value={messageZh} onChange={(event) => setMessageZh(event.target.value)} /></AdminField><AdminField locale={locale} label={adminCopy(locale, "message_en")} required><textarea value={messageEn} onChange={(event) => setMessageEn(event.target.value)} /></AdminField><AdminField locale={locale} label={adminCopy(locale, "expected_recovery")} required><input type="datetime-local" value={expectedRecoveryAt} onChange={(event) => setExpectedRecoveryAt(event.target.value)} /></AdminField></div></div>}
          <AdminInlineError message={error?.message} />
          <div className="admin-form-footer"><span>{adminCopy(locale, "mode_impact")}: {adminCopy(locale, impactKey)}</span><button className="primary-button" type="button" disabled={targetMode === state.systemMode.mode} onClick={() => setConfirmOpen(true)}>{adminCopy(locale, "confirm_mode")}</button></div>
        </section>
        <aside className="admin-surface admin-system-note"><h3>{adminCopy(locale, "data_protection")}</h3><p>{adminCopy(locale, "data_protection_body")}</p><ul><li>{adminCopy(locale, "readonly_impact")}</li><li>{adminCopy(locale, "maintenance_impact")}</li><li>{adminCopy(locale, "planned_48h")}</li></ul></aside>
      </div>

      <section className="admin-surface">
        <AdminSectionHeading title={adminCopy(locale, "announcements")} action={<button className="secondary-button" type="button" onClick={() => setAnnouncementOpen(true)}>{adminCopy(locale, "publish_announcement")}</button>} />
        <div className="admin-announcement-list">{state.maintenanceAnnouncements.map((item) => <article key={item.id}><div><AdminBadge tone={item.kind === "emergency" ? "red" : item.kind === "recovery" ? "green" : "blue"}>{announcementKind(item.kind)}</AdminBadge><h3>{locale === "en" ? item.titleEn : item.titleZh}</h3><p>{locale === "en" ? item.messageEn : item.messageZh}</p></div><small>{formatAdminDate(locale, item.startsAt, true)} · {item.publishedBy}</small></article>)}</div>
      </section>

      {confirmOpen && <AdminConfirm locale={locale} title={adminCopy(locale, "switch_mode_title")} description={adminCopy(locale, "switch_mode_body")} close={() => setConfirmOpen(false)} confirm={() => void switchMode()} confirmLabel={adminCopy(locale, "confirm_mode")} busy={busyKey === key} danger={targetMode === "MAINTENANCE"}><div className="admin-confirm-object"><b>{adminLabel(locale, "systemMode", state.systemMode.mode)} → {adminLabel(locale, "systemMode", targetMode)}</b><span>{reason || adminCopy(locale, "reason_required")}</span></div></AdminConfirm>}
      <section className="admin-surface admin-danger-zone">
        <AdminSectionHeading title={adminCopy(locale, "data_purge")} description={adminCopy(locale, "data_purge_body")} action={<button className="danger-button" type="button" onClick={() => setPurgeOpen(true)}>{adminCopy(locale, "purge_all_business_data")}</button>} />
        <p>{adminCopy(locale, "purge_audit_notice")}</p>
      </section>
      {announcementOpen && <AnnouncementDialog locale={locale} close={() => setAnnouncementOpen(false)} />}
      {purgeOpen && <PurgeAllBusinessDataDialog locale={locale} close={() => setPurgeOpen(false)} />}
    </div>
  );
}
