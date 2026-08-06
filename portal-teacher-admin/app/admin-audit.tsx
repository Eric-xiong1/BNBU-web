"use client";

import { useState } from "react";
import { AppSelect } from "./app-select";
import { pageItems } from "./admin-domain";
import { adminCopy } from "./admin-i18n";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, AuditLog } from "./admin-types";
import { AdminBadge, AdminDrawer, AdminEmpty, AdminPagination, AdminSectionHeading, formatAdminDate } from "./admin-components";

export function AdminAudit({ locale }: { locale: AdminLocale }) {
  const { state } = useAdminStore();
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  const [resourceType, setResourceType] = useState("all");
  const [resourceId, setResourceId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  if (!state) return null;
  const logs = [...state.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const actors = [...new Map(logs.map((log) => [log.actorId ?? `deleted:${log.actorName}`, { value: log.actorId ?? `deleted:${log.actorName}`, label: log.actorName }])).values()];
  const actions = [...new Set(logs.map((log) => log.action))].sort();
  const resourceTypes = [...new Set(logs.map((log) => log.resourceType))].sort();
  const filtered = logs.filter((log) => {
    if (actor !== "all" && (log.actorId ?? `deleted:${log.actorName}`) !== actor) return false;
    if (action !== "all" && log.action !== action) return false;
    if (resourceType !== "all" && log.resourceType !== resourceType) return false;
    if (resourceId.trim() && !String(log.resourceId ?? "").toLowerCase().includes(resourceId.trim().toLowerCase())) return false;
    if (requestId.trim() && !log.requestId.toLowerCase().includes(requestId.trim().toLowerCase())) return false;
    if (dateFrom && log.createdAt.slice(0, 10) < dateFrom) return false;
    if (dateTo && log.createdAt.slice(0, 10) > dateTo) return false;
    return true;
  });
  const paged = pageItems(filtered, page, 8);
  const detail = state.auditLogs.find((log) => log.id === detailId);
  const filteredActive = actor !== "all" || action !== "all" || resourceType !== "all" || resourceId || requestId || dateFrom || dateTo;
  const clear = () => { setActor("all"); setAction("all"); setResourceType("all"); setResourceId(""); setRequestId(""); setDateFrom(""); setDateTo(""); setPage(1); };
  return (
    <div className="admin-page-stack">
      <aside className="admin-readonly-banner"><span aria-hidden="true">⌕</span><b>{adminCopy(locale, "audit_readonly")}</b></aside>
      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "audit_detail")} description={adminCopy(locale, "audit_readonly")} />
        <div className="admin-audit-filters">
          <AppSelect label={adminCopy(locale, "actor_filter")} value={actor} options={[{ value: "all", label: adminCopy(locale, "all") }, ...actors]} onChange={(value) => { if (value) { setActor(String(value)); setPage(1); } }} />
          <AppSelect label={adminCopy(locale, "action_filter")} value={action} options={[{ value: "all", label: adminCopy(locale, "all") }, ...actions.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) { setAction(String(value)); setPage(1); } }} />
          <AppSelect label={adminCopy(locale, "resource_type_filter")} value={resourceType} options={[{ value: "all", label: adminCopy(locale, "all") }, ...resourceTypes.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) { setResourceType(String(value)); setPage(1); } }} />
          <label><span>{adminCopy(locale, "resource_id_filter")}</span><input value={resourceId} onChange={(event) => { setResourceId(event.target.value); setPage(1); }} /></label>
          <label><span>{adminCopy(locale, "request_id_filter")}</span><input value={requestId} onChange={(event) => { setRequestId(event.target.value); setPage(1); }} /></label>
          <label><span>{adminCopy(locale, "date_from")}</span><input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></label>
          <label><span>{adminCopy(locale, "date_to")}</span><input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></label>
          {filteredActive && <button className="text-button" type="button" onClick={clear}>{adminCopy(locale, "clear_filters")}</button>}
        </div>
        {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "created_at")}</th><th>{adminCopy(locale, "actor")}</th><th>{adminCopy(locale, "action")}</th><th>{adminCopy(locale, "resource")}</th><th>{adminCopy(locale, "request_id")}</th><th>{adminCopy(locale, "details")}</th></tr></thead><tbody>{paged.items.map((log) => <tr key={log.id}><td>{formatAdminDate(locale, log.createdAt, true)}</td><td><b>{log.actorName}</b><small className="table-sub">{log.actorId ?? adminCopy(locale, "not_available")}</small></td><td><code>{log.action}</code></td><td><AdminBadge tone="gray">{log.resourceType}</AdminBadge><small className="table-sub">{log.resourceId ?? adminCopy(locale, "not_available")}</small></td><td><code>{log.requestId}</code></td><td><button className="text-button" type="button" onClick={() => setDetailId(log.id)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
        <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
      </section>
      {detail && <AuditDrawer locale={locale} log={detail} close={() => setDetailId(null)} />}
    </div>
  );
}

function AuditDrawer({ locale, log, close }: { locale: AdminLocale; log: AuditLog; close: () => void }) {
  return (
    <AdminDrawer locale={locale} title={adminCopy(locale, "audit_detail")} description={log.id} close={close}>
      <div className="admin-detail-list"><span><small>{adminCopy(locale, "created_at")}</small><b>{formatAdminDate(locale, log.createdAt, true)}</b></span><span><small>{adminCopy(locale, "actor")}</small><b>{log.actorName} · {log.actorId ?? adminCopy(locale, "not_available")}</b></span><span><small>{adminCopy(locale, "action")}</small><code>{log.action}</code></span><span><small>{adminCopy(locale, "resource")}</small><b>{log.resourceType} · {log.resourceId ?? adminCopy(locale, "not_available")}</b></span><span><small>{adminCopy(locale, "request_id")}</small><code>{log.requestId}</code></span></div>
      <section className="admin-json-panel"><h3>{adminCopy(locale, "audit_metadata")}</h3><pre>{JSON.stringify(log.metadata, null, 2)}</pre></section>
    </AdminDrawer>
  );
}
