"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { pageItems } from "./admin-domain";
import { adminCopy, adminLabel } from "./admin-i18n";
import { updateTicket } from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, SupportTicket, TicketStatus } from "./admin-types";
import { AdminBadge, AdminDialog, AdminEmpty, AdminField, AdminInlineError, AdminPagination, AdminSectionHeading, formatAdminDate, type AdminTone } from "./admin-components";

type TicketFilter = "all" | TicketStatus;

function ticketTone(status: TicketStatus): AdminTone {
  if (status === "resolved") return "green";
  if (status === "closed") return "gray";
  if (status === "pending") return "orange";
  return "blue";
}

function TicketDialog({ locale, ticket, close }: { locale: AdminLocale; ticket: SupportTicket; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const [status, setStatus] = useState<TicketStatus>(ticket.status === "pending" ? "in_progress" : ticket.status);
  const [reply, setReply] = useState("");
  const key = `ticket.${ticket.id}`;
  useEffect(() => () => clearError(), [clearError]);
  const submit = async () => {
    const result = await run(key, () => updateTicket(ticket.id, status, reply), adminCopy(locale, "ticket_saved"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={`${ticket.id} · ${ticket.subject}`} description={`${adminLabel(locale, "ticketCategory", ticket.category)} · ${formatAdminDate(locale, ticket.submittedAt, true)}`} close={close} dirty={Boolean(reply)} wide footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className="primary-button" type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "save_ticket")}</button>
    </>}>
      <div className="admin-ticket-thread">
        <article className="is-requester"><b>{ticket.requester} · {ticket.account}</b><p>{ticket.content}</p><small>{formatAdminDate(locale, ticket.submittedAt, true)}</small></article>
        {ticket.replies.map((item) => <article key={item.id}><b>{item.author}</b><p>{item.message}</p><small>{formatAdminDate(locale, item.createdAt, true)}</small></article>)}
      </div>
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "status")} required><AppSelect label={adminCopy(locale, "status")} value={status} options={(["in_progress", "technical", "resolved", "closed"] as TicketStatus[]).map((value) => ({ value, label: adminLabel(locale, "ticketStatus", value) }))} onChange={(value) => value && setStatus(value as TicketStatus)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "reply")} required errorCode={error?.fieldErrors.reply} className="full-width"><textarea value={reply} placeholder={adminCopy(locale, "reply_placeholder")} onChange={(event) => setReply(event.target.value)} /></AdminField>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

export function AdminSupport({ locale }: { locale: AdminLocale }) {
  const { state } = useAdminStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!state) return null;
  const query = search.trim().toLowerCase();
  const filtered = state.tickets.filter((ticket) => (statusFilter === "all" || ticket.status === statusFilter)
    && (!query || [ticket.id, ticket.requester, ticket.account, ticket.subject].some((value) => value.toLowerCase().includes(query))));
  const paged = pageItems(filtered, page, 6);
  const selected = state.tickets.find((ticket) => ticket.id === selectedId);
  const openCount = state.tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;

  return (
    <div className="admin-page-stack">
      <aside className="admin-planned-banner">{adminCopy(locale, "support_planned")}</aside>
      <section className="admin-summary-grid three">
        <button type="button" onClick={() => { setStatusFilter("all"); setPage(1); }}><span>{adminCopy(locale, "tickets")}</span><b>{state.tickets.length}</b><small>{adminCopy(locale, "open_tickets", { count: openCount })}</small></button>
        <button type="button" onClick={() => { setStatusFilter("technical"); setPage(1); }}><span>{adminLabel(locale, "ticketStatus", "technical")}</span><b>{state.tickets.filter((ticket) => ticket.status === "technical").length}</b><small>{locale === "zh" ? "技术团队" : "Technical team"}</small></button>
        <button type="button" onClick={() => { setStatusFilter("resolved"); setPage(1); }}><span>{adminLabel(locale, "ticketStatus", "resolved")}</span><b>{state.tickets.filter((ticket) => ticket.status === "resolved").length}</b><small>{adminCopy(locale, "updated_at")}</small></button>
      </section>
      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "tickets")} />
        <div className="admin-filter-row">
          <label className="admin-search"><span aria-hidden="true">⌕</span><input value={search} placeholder={adminCopy(locale, "ticket_search")} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <AppSelect label={adminCopy(locale, "ticket_status_filter")} value={statusFilter} options={[{ value: "all", label: adminCopy(locale, "all") }, ...(["pending", "in_progress", "technical", "resolved", "closed"] as TicketStatus[]).map((value) => ({ value, label: adminLabel(locale, "ticketStatus", value) }))]} onChange={(value) => { if (value) { setStatusFilter(value as TicketFilter); setPage(1); } }} />
          {(search || statusFilter !== "all") && <button className="text-button" type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1); }}>{adminCopy(locale, "clear_filters")}</button>}
        </div>
        {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>ID</th><th>{adminCopy(locale, "requester")}</th><th>{adminCopy(locale, "subject")}</th><th>{adminCopy(locale, "source")}</th><th>{adminCopy(locale, "submitted_at")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{paged.items.map((ticket) => <tr key={ticket.id}><td><code>{ticket.id}</code></td><td><b>{ticket.requester}</b><small className="table-sub">{ticket.account}</small></td><td><b>{ticket.subject}</b><small className="table-sub">{adminLabel(locale, "ticketCategory", ticket.category)}</small></td><td>{adminLabel(locale, "userRole", ticket.source)}</td><td>{formatAdminDate(locale, ticket.submittedAt, true)}</td><td><AdminBadge tone={ticketTone(ticket.status)}>{adminLabel(locale, "ticketStatus", ticket.status)}</AdminBadge></td><td><button className="text-button" type="button" onClick={() => setSelectedId(ticket.id)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
        <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
      </section>
      {selected && <TicketDialog locale={locale} ticket={selected} close={() => setSelectedId(null)} />}
    </div>
  );
}
