"use client";

import { useEffect, useMemo, useState } from "react";
import { AppSelect } from "./app-select";
import { statusLabel } from "./language";

type TicketStatus = "待受理" | "受理中" | "待技术团队处理" | "处理完成" | "已关闭";

type Ticket = {
  id: string;
  requester: string;
  account: string;
  category: "账户与登录" | "系统功能" | "数据与权限" | "其他咨询";
  subject: string;
  content: string;
  source: string;
  submittedAt: string;
  status: TicketStatus;
  replies: string[];
};

// The Backend contract does not expose a support-ticket workflow. Keep this
// retired component empty so it can never surface or mutate browser fixtures.
const initialTickets: Ticket[] = [];

function ticketTone(status: TicketStatus) {
  if (status === "处理完成") return "green";
  if (status === "待受理") return "orange";
  if (status === "已关闭") return "red";
  return "blue";
}

function TicketDialog({
  ticket,
  close,
  save,
}: {
  ticket: Ticket;
  close: () => void;
  save: (status: TicketStatus, reply: string) => boolean;
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status === "待受理" ? "受理中" : ticket.status);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  const submit = () => {
    if (!save(status, reply)) {
      setError("请填写处理说明后再保存。");
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="modal teacher-dialog" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title">
        <div className="modal-head">
          <div><span className="eyebrow">管理端支持请求</span><h2 id="ticket-dialog-title">支持请求 {ticket.id} · {ticket.subject}</h2><p>{ticket.category} · {ticket.submittedAt}</p></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={close}>×</button>
        </div>
        <div className="teacher-dialog-body">
          <div className="ticket-thread">
            <div className="ticket-message student-message"><b>{ticket.requester} · {ticket.account}</b><p>{ticket.content}</p></div>
            {ticket.replies.map((item, index) => <div className="ticket-message teacher-message" key={`${item}-${index}`}><b>系统管理员</b><p>{item}</p></div>)}
          </div>
          <div className="form-grid">
            <AppSelect
              label="处理状态"
              required
              value={status}
              options={[
                { value: "受理中", label: statusLabel("受理中", "ticket") },
                { value: "待技术团队处理", label: statusLabel("待技术团队处理", "ticket") },
                { value: "处理完成", label: statusLabel("处理完成", "ticket") },
                { value: "已关闭", label: statusLabel("已关闭", "ticket") },
              ]}
              onChange={(nextValue) => nextValue !== null && setStatus(nextValue as TicketStatus)}
            />
            <label className="teacher-field"><span>回复用户 <b>*</b></span><textarea value={reply} onChange={(event) => { setReply(event.target.value); setError(""); }} placeholder="说明处理结果、下一步或预计完成时间" /></label>
            {status === "待技术团队处理" && <aside className="inline-warning">该支持请求将保留在管理端队列，并标记为等待技术团队处理。</aside>}
            {error && <p className="form-error">{error}</p>}
          </div>
        </div>
        <div className="modal-footer"><button className="secondary-button" type="button" onClick={close}>取消</button><button className="primary-button" type="button" onClick={submit}>保存处理结果</button></div>
      </section>
    </div>
  );
}

export function AdminTicketWorkspace({ showToast }: { showToast: (message: string) => void }) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [statusFilter, setStatusFilter] = useState<"all" | TicketStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const visibleTickets = useMemo(
    () => tickets.filter((ticket) => statusFilter === "all" || ticket.status === statusFilter),
    [statusFilter, tickets],
  );
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId);
  const openCount = tickets.filter((ticket) => !["处理完成", "已关闭"].includes(ticket.status)).length;

  const saveTicket = (status: TicketStatus, reply: string) => {
    const message = reply.trim();
    if (!message) return false;
    setTickets((current) => current.map((ticket) => ticket.id === selectedId ? { ...ticket, status, replies: [...ticket.replies, message] } : ticket));
    setSelectedId(null);
    showToast(status === "待技术团队处理" ? "支持请求已移交技术团队处理。" : "支持请求处理结果已保存并同步给提交人。");
    return true;
  };

  return (
    <>
      <div className="stats-grid">
        <article className="stat-card"><div className="stat-mark mark-orange" /><p>待处理工单</p><strong>{openCount}</strong><span>由管理端统一受理</span></article>
        <article className="stat-card"><div className="stat-mark mark-blue" /><p>{statusLabel("待技术团队处理", "ticket")}</p><strong>{tickets.filter((ticket) => ticket.status === "待技术团队处理").length}</strong><span>等待技术团队反馈</span></article>
        <article className="stat-card"><div className="stat-mark mark-green" /><p>今日已完成</p><strong>{tickets.filter((ticket) => ticket.status === "处理完成").length}</strong><span>处理结果已同步</span></article>
      </div>
      <div className="panel">
        <div className="panel-head teacher-panel-head">
          <div><h2>支持请求</h2><p>学生和教师提交的支持请求由管理端统一受理、回复和协调处理。</p></div>
          <AppSelect
            label="状态"
            value={statusFilter}
            options={[
              { value: "all", label: "全部状态" },
              { value: "待受理", label: statusLabel("待受理", "ticket") },
              { value: "受理中", label: statusLabel("受理中", "ticket") },
              { value: "待技术团队处理", label: statusLabel("待技术团队处理", "ticket") },
              { value: "处理完成", label: statusLabel("处理完成", "ticket") },
              { value: "已关闭", label: statusLabel("已关闭", "ticket") },
            ]}
            onChange={(nextValue) => nextValue !== null && setStatusFilter(nextValue as "all" | TicketStatus)}
          />
        </div>
        <div className="sla-strip"><span><b>账户与登录</b>2 工作小时内首次响应</span><span><b>系统功能 / 数据权限</b>4 工作小时内首次响应</span><span><b>其他咨询</b>1 工作日内首次响应</span></div>
        <div className="table-wrap"><table><thead><tr><th>工单编号</th><th>提交人</th><th>类别与主题</th><th>来源</th><th>提交时间</th><th>状态</th><th>操作</th></tr></thead><tbody>{visibleTickets.map((ticket) => <tr key={ticket.id}><td><code>{ticket.id}</code></td><td><div className="person-cell compact"><span>{ticket.requester.slice(-1)}</span><div><b>{ticket.requester}</b><small>{ticket.account}</small></div></div></td><td><b>{ticket.subject}</b><small className="table-sub">{ticket.category}</small></td><td>{ticket.source}</td><td>{ticket.submittedAt}</td><td><span className={`badge badge-${ticketTone(ticket.status)}`}>{statusLabel(ticket.status, "ticket")}</span></td><td><button className="text-button" type="button" onClick={() => setSelectedId(ticket.id)}>查看并处理 →</button></td></tr>)}</tbody></table></div>
      </div>
      {selectedTicket && <TicketDialog ticket={selectedTicket} close={() => setSelectedId(null)} save={saveTicket} />}
    </>
  );
}
