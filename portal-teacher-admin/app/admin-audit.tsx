"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSelect } from "./app-select";
import { adminCopy } from "./admin-i18n";
import { adminApiErrorText, getAuditLogProjection, listAuditLogProjections, type AuditLogCursorPage } from "./admin-service";
import type { AdminLocale, AuditLogProjection } from "./admin-types";
import { AdminBadge, AdminDrawer, AdminEmpty, AdminLoadError, AdminLoading, AdminSectionHeading, formatAdminDate } from "./admin-components";

function actorText(log: AuditLogProjection, fallback: string) {
  return [log.actorRoleSnapshot, log.actorUserId].filter(Boolean).join(" · ") || fallback;
}

export function AdminAudit({ locale }: { locale: AdminLocale }) {
  const [pages, setPages] = useState<AuditLogCursorPage[]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageBusy, setPageBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState("all");
  const [targetType, setTargetType] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [actor, setActor] = useState("");
  const [targetId, setTargetId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detail, setDetail] = useState<AuditLogProjection | null>(null);
  const [detailError, setDetailError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await listAuditLogProjections();
      setPages([{ ...loaded, items: [...loaded.items].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)) }]);
      setPageIndex(0);
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

  const currentPage = pages[pageIndex] ?? { items: [], nextCursor: null, hasMore: false, limit: 50 };
  const logs = currentPage.items;
  const actions = useMemo(() => [...new Set(logs.map((log) => log.actionType))].sort(), [logs]);
  const targetTypes = useMemo(() => [...new Set(logs.map((log) => log.targetType))].sort(), [logs]);
  const outcomes = useMemo(() => [...new Set(logs.map((log) => log.outcome))].sort(), [logs]);
  const filtered = useMemo(() => logs.filter((log) => {
    if (action !== "all" && log.actionType !== action) return false;
    if (targetType !== "all" && log.targetType !== targetType) return false;
    if (outcome !== "all" && log.outcome !== outcome) return false;
    if (actor.trim() && !actorText(log, "").toLocaleLowerCase().includes(actor.trim().toLocaleLowerCase())) return false;
    if (targetId.trim() && !String(log.targetId ?? "").toLocaleLowerCase().includes(targetId.trim().toLocaleLowerCase())) return false;
    if (requestId.trim() && !log.requestId.toLocaleLowerCase().includes(requestId.trim().toLocaleLowerCase())) return false;
    if (dateFrom && log.occurredAt.slice(0, 10) < dateFrom) return false;
    if (dateTo && log.occurredAt.slice(0, 10) > dateTo) return false;
    return true;
  }), [action, actor, dateFrom, dateTo, logs, outcome, requestId, targetId, targetType]);
  const filteredActive = Boolean(action !== "all" || targetType !== "all" || outcome !== "all" || actor || targetId || requestId || dateFrom || dateTo);

  function clear() {
    setAction("all"); setTargetType("all"); setOutcome("all"); setActor(""); setTargetId(""); setRequestId(""); setDateFrom(""); setDateTo("");
  }

  async function nextPage() {
    if (pageBusy) return;
    if (pages[pageIndex + 1]) {
      setPageIndex((value) => value + 1);
      return;
    }
    if (!currentPage.hasMore || !currentPage.nextCursor) return;
    setPageBusy(true);
    setError("");
    try {
      const loaded = await listAuditLogProjections(currentPage.nextCursor);
      const next = { ...loaded, items: [...loaded.items].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)) };
      setPages((items) => [...items, next]);
      setPageIndex((value) => value + 1);
    } catch (failure) {
      setError(adminApiErrorText(failure));
    } finally {
      setPageBusy(false);
    }
  }

  async function openDetail(id: string) {
    setDetailError("");
    try {
      setDetail(await getAuditLogProjection(id));
    } catch (failure) {
      setDetailError(adminApiErrorText(failure));
    }
  }

  if (loading) return <AdminLoading locale={locale} />;
  if (error && pages.length === 0) return <AdminLoadError locale={locale} message={error} retry={() => void load()} />;

  return (
    <div className="admin-page-stack">
      <aside className="admin-readonly-banner"><span aria-hidden="true">⌕</span><b>{adminCopy(locale, "audit_limit_notice")}</b></aside>
      {error && <div className="admin-empty-state is-error" role="alert"><span>!</span><p>{error}</p></div>}
      {detailError && <div className="admin-empty-state is-error" role="alert"><span>!</span><p>{detailError}</p></div>}
      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "audit_detail")} description={adminCopy(locale, "audit_readonly")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
        <div className="admin-audit-filters">
          <AppSelect label={adminCopy(locale, "action_filter")} value={action} options={[{ value: "all", label: adminCopy(locale, "all") }, ...actions.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) setAction(String(value)); }} />
          <AppSelect label={adminCopy(locale, "resource_type_filter")} value={targetType} options={[{ value: "all", label: adminCopy(locale, "all") }, ...targetTypes.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) setTargetType(String(value)); }} />
          <AppSelect label={adminCopy(locale, "outcome")} value={outcome} options={[{ value: "all", label: adminCopy(locale, "all") }, ...outcomes.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) setOutcome(String(value)); }} />
          <label><span>{adminCopy(locale, "actor_filter")}</span><input value={actor} onChange={(event) => setActor(event.target.value)} /></label>
          <label><span>{adminCopy(locale, "resource_id_filter")}</span><input value={targetId} onChange={(event) => setTargetId(event.target.value)} /></label>
          <label><span>{adminCopy(locale, "request_id_filter")}</span><input value={requestId} onChange={(event) => setRequestId(event.target.value)} /></label>
          <label><span>{adminCopy(locale, "date_from")}</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>{adminCopy(locale, "date_to")}</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          {filteredActive && <button className="text-button" type="button" onClick={clear}>{adminCopy(locale, "clear_filters")}</button>}
        </div>
        {filtered.length === 0 ? <AdminEmpty locale={locale} filtered={filteredActive} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "created_at")}</th><th>{adminCopy(locale, "actor")}</th><th>{adminCopy(locale, "action")}</th><th>{adminCopy(locale, "resource")}</th><th>{adminCopy(locale, "request_id")}</th><th>{adminCopy(locale, "details")}</th></tr></thead><tbody>{filtered.map((log) => <tr key={log.id}><td>{formatAdminDate(locale, log.occurredAt, true)}</td><td><b>{actorText(log, adminCopy(locale, "not_available"))}</b></td><td><code>{log.actionType}</code><small className="table-sub">{log.outcome}</small></td><td><AdminBadge tone="gray">{log.targetType}</AdminBadge><small className="table-sub">{log.targetId ?? adminCopy(locale, "not_available")}</small></td><td><code>{log.requestId}</code></td><td><button className="text-button" type="button" onClick={() => void openDetail(log.id)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
        <div className="admin-pagination" aria-label={adminCopy(locale, "cursor_pagination", { page: pageIndex + 1, limit: currentPage.limit })}>
          <button type="button" disabled={pageIndex === 0 || pageBusy} onClick={() => setPageIndex((value) => Math.max(0, value - 1))}>{adminCopy(locale, "previous")}</button>
          <span>{adminCopy(locale, "cursor_pagination", { page: pageIndex + 1, limit: currentPage.limit })}</span>
          <button type="button" disabled={pageBusy || (!pages[pageIndex + 1] && (!currentPage.hasMore || !currentPage.nextCursor))} onClick={() => void nextPage()}>{pageBusy ? adminCopy(locale, "processing") : adminCopy(locale, "next")}</button>
        </div>
      </section>
      {detail && <AuditDrawer locale={locale} log={detail} close={() => setDetail(null)} />}
    </div>
  );
}

function AuditDrawer({ locale, log, close }: { locale: AdminLocale; log: AuditLogProjection; close: () => void }) {
  return (
    <AdminDrawer locale={locale} title={adminCopy(locale, "audit_detail")} description={log.id} close={close}>
      <div className="admin-detail-list">
        <span><small>{adminCopy(locale, "created_at")}</small><b>{formatAdminDate(locale, log.occurredAt, true)}</b></span>
        <span><small>{adminCopy(locale, "actor")}</small><b>{actorText(log, adminCopy(locale, "not_available"))}</b></span>
        <span><small>{adminCopy(locale, "action")}</small><code>{log.actionType}</code></span>
        <span><small>{adminCopy(locale, "resource")}</small><b>{log.targetType} · {log.targetId ?? adminCopy(locale, "not_available")}</b></span>
        <span><small>{adminCopy(locale, "outcome")}</small><b>{log.outcome}</b></span>
        <span><small>{adminCopy(locale, "reason_code")}</small><code>{log.reasonCode ?? adminCopy(locale, "not_available")}</code></span>
        <span><small>{adminCopy(locale, "request_id")}</small><code>{log.requestId}</code></span>
      </div>
      <section className="admin-json-panel"><h3>{adminCopy(locale, "safe_metadata")}</h3><pre>{JSON.stringify(log.safeMetadata, null, 2)}</pre></section>
    </AdminDrawer>
  );
}
