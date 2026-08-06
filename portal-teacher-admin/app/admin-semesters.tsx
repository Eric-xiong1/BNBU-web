"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { pageItems, todayIso } from "./admin-domain";
import { adminCopy, adminLabel } from "./admin-i18n";
import { createSemester, setCurrentSemester, transitionGradeCorrection, updateSemester } from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, CreateSemesterInput, GradeCorrectionRequest, GradeCorrectionStatus, Semester, SemesterStatus, SemesterTerm } from "./admin-types";
import {
  AdminBadge,
  AdminConfirm,
  AdminDialog,
  AdminDrawer,
  AdminEmpty,
  AdminField,
  AdminInlineError,
  AdminPagination,
  AdminSectionHeading,
  formatAdminDate,
  type AdminTone,
} from "./admin-components";

type SemesterView = "semesters" | "corrections";
type SemesterFilter = "all" | SemesterStatus;

function semesterTone(status: SemesterStatus): AdminTone {
  return status === "current" ? "green" : status === "upcoming" ? "blue" : "gray";
}

function correctionTone(status: GradeCorrectionStatus): AdminTone {
  if (status === "closed") return "green";
  if (status === "rejected") return "red";
  if (status === "pending") return "orange";
  return "blue";
}

const blankSemester: CreateSemesterInput = {
  name: "",
  academicYear: "",
  term: "first",
  startDate: "",
  endDate: "",
};

function SemesterForm({ locale, semester, close }: { locale: AdminLocale; semester?: Semester; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const initial: CreateSemesterInput = semester ? {
    name: semester.name,
    academicYear: semester.academicYear,
    term: semester.term,
    startDate: semester.startDate,
    endDate: semester.endDate,
  } : blankSemester;
  const [form, setForm] = useState<CreateSemesterInput>(initial);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const key = semester ? `semester.update.${semester.id}` : "semester.create";
  useEffect(() => () => clearError(), [clearError]);
  const update = <K extends keyof CreateSemesterInput>(field: K, value: CreateSemesterInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    const result = semester
      ? await run(key, () => updateSemester({ ...form, id: semester.id, expectedUpdatedAt: semester.updatedAt }), adminCopy(locale, "semester_updated"))
      : await run(key, () => createSemester(form), adminCopy(locale, "semester_created"));
    if (result) close();
  };
  return (
    <AdminDialog
      locale={locale}
      title={adminCopy(locale, semester ? "edit_semester" : "create_semester")}
      description={semester ? adminCopy(locale, "semester_records_hint") : undefined}
      close={close}
      dirty={dirty}
      footer={<>
        <button className="secondary-button" type="button" onClick={close} disabled={busyKey === key}>{adminCopy(locale, "cancel")}</button>
        <button className="primary-button" type="button" onClick={() => void submit()} disabled={busyKey === key}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "save")}</button>
      </>}
    >
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "semester_name")} required errorCode={error?.fieldErrors.name}><input value={form.name} onChange={(event) => update("name", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "academic_year")} required errorCode={error?.fieldErrors.academicYear}><input value={form.academicYear} placeholder="2026-2027" onChange={(event) => update("academicYear", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "term")} required errorCode={error?.fieldErrors.term}>
          <AppSelect label={adminCopy(locale, "term")} value={form.term} options={(["first", "second", "summer"] as SemesterTerm[]).map((value) => ({ value, label: adminLabel(locale, "semesterTerm", value) }))} onChange={(value) => value && update("term", value as SemesterTerm)} />
        </AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "start_date")} required errorCode={error?.fieldErrors.startDate}><input type="date" value={form.startDate} onChange={(event) => update("startDate", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "end_date")} required errorCode={error?.fieldErrors.endDate}><input type="date" value={form.endDate} onChange={(event) => update("endDate", event.target.value)} /></AdminField>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

function CorrectionDialog({ locale, request, nextStatus, close }: { locale: AdminLocale; request: GradeCorrectionRequest; nextStatus: GradeCorrectionStatus; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const [reason, setReason] = useState("");
  const key = `correction.${request.id}.${nextStatus}`;
  useEffect(() => () => clearError(), [clearError]);
  const titleKey = nextStatus === "approved" ? "approve_window" : nextStatus === "rejected" ? "reject_request" : "close_window";
  const submit = async () => {
    const result = await run(key, () => transitionGradeCorrection(request.id, nextStatus, reason), adminCopy(locale, "grade_correction_updated"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, titleKey)} close={close} dirty={Boolean(reason)} footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className={nextStatus === "rejected" ? "danger-button" : "primary-button"} type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, titleKey)}</button>
    </>}>
      <div className="admin-detail-list compact"><span><small>{adminCopy(locale, "courses")}</small><b>{request.courseName}</b></span><span><small>{adminCopy(locale, "student_number")}</small><b>{request.studentAccount}</b></span><span><small>{adminCopy(locale, "reason")}</small><b>{request.reason}</b></span></div>
      <AdminField locale={locale} label={adminCopy(locale, "review_reason")} required errorCode={error?.fieldErrors.reason}><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

export function AdminSemesters({ locale }: { locale: AdminLocale }) {
  const { state, busyKey, run } = useAdminStore();
  const [view, setView] = useState<SemesterView>("semesters");
  const [filter, setFilter] = useState<SemesterFilter>("all");
  const [page, setPage] = useState(1);
  const [formSemester, setFormSemester] = useState<Semester | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<Semester | null>(null);
  const [correctionAction, setCorrectionAction] = useState<{ request: GradeCorrectionRequest; nextStatus: GradeCorrectionStatus } | null>(null);
  if (!state) return null;
  const current = state.semesters.find((semester) => semester.status === "current");
  const filtered = state.semesters.filter((semester) => filter === "all" || semester.status === filter).sort((left, right) => right.startDate.localeCompare(left.startDate));
  const paged = pageItems(filtered, page, 5);
  const detail = state.semesters.find((semester) => semester.id === detailId);
  const pendingCorrections = state.gradeCorrections.filter((request) => request.status === "pending").length;

  const performConfirm = async () => {
    if (!confirmAction) return;
    const semester = confirmAction;
    const key = `semester.switch.${semester.id}`;
    const result = await run(key, () => setCurrentSemester(semester.id), adminCopy(locale, "semester_switched"));
    if (result) setConfirmAction(null);
  };

  return (
    <div className="admin-page-stack">
      <div className="admin-view-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === "semesters"} className={view === "semesters" ? "selected" : ""} onClick={() => setView("semesters")}>{adminCopy(locale, "semester_records")}</button>
        <button type="button" role="tab" aria-selected={view === "corrections"} className={view === "corrections" ? "selected" : ""} onClick={() => setView("corrections")}>{adminCopy(locale, "grade_corrections")}<b>{pendingCorrections}</b></button>
      </div>

      {view === "semesters" ? <>
        {current && <section className="admin-current-semester">
          <div><AdminBadge tone="green">{adminLabel(locale, "semesterStatus", "current")}</AdminBadge><h2>{current.name}</h2><p>{formatAdminDate(locale, current.startDate)} – {formatAdminDate(locale, current.endDate)} · {current.courseCount} {adminCopy(locale, "courses")} · {current.studentCount} {adminCopy(locale, "students")}</p></div>
        </section>}

        <section className="admin-surface admin-table-surface">
          <AdminSectionHeading
            title={adminCopy(locale, "semester_records")}
            description={adminCopy(locale, "semester_records_hint")}
            action={<button className="primary-button" type="button" onClick={() => setFormSemester("new")}>{adminCopy(locale, "create_semester")}</button>}
          />
          <div className="admin-filter-row">
            <div className="admin-view-tabs compact" role="tablist" aria-label={adminCopy(locale, "semester_filter")}>
              {(["all", "current", "upcoming", "archived"] as SemesterFilter[]).map((value) => <button type="button" role="tab" aria-selected={filter === value} className={filter === value ? "selected" : ""} onClick={() => { setFilter(value); setPage(1); }} key={value}>{value === "all" ? adminCopy(locale, "all") : adminLabel(locale, "semesterStatus", value)}</button>)}
            </div>
          </div>
          {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered={filter !== "all"} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "semester_name")}</th><th>{adminCopy(locale, "academic_year")}</th><th>{adminCopy(locale, "start_date")}</th><th>{adminCopy(locale, "end_date")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{paged.items.map((semester) => {
            const canSwitch = semester.status === "upcoming" && semester.startDate <= todayIso();
            return <tr key={semester.id}><td><b>{semester.name}</b><small className="table-sub">{adminLabel(locale, "semesterTerm", semester.term)}</small></td><td>{semester.academicYear}</td><td>{formatAdminDate(locale, semester.startDate)}</td><td>{formatAdminDate(locale, semester.endDate)}</td><td><AdminBadge tone={semesterTone(semester.status)}>{adminLabel(locale, "semesterStatus", semester.status)}</AdminBadge></td><td><div className="admin-row-actions"><button type="button" onClick={() => setDetailId(semester.id)}>{adminCopy(locale, "details")}</button>{semester.status === "upcoming" && <button type="button" onClick={() => setFormSemester(semester)}>{adminCopy(locale, "edit")}</button>}{semester.status === "upcoming" && <button type="button" disabled={!canSwitch} title={!canSwitch ? adminCopy(locale, "start_not_reached") : undefined} onClick={() => setConfirmAction(semester)}>{adminCopy(locale, "set_current")}</button>}</div></td></tr>;
          })}</tbody></table></div>}
          <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
        </section>
      </> : <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "grade_corrections")} description={adminCopy(locale, "grade_correction_hint")} />
        {state.gradeCorrections.length === 0 ? <AdminEmpty locale={locale} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "courses")}</th><th>{adminCopy(locale, "student_number")}</th><th>{adminCopy(locale, "reason")}</th><th>{adminCopy(locale, "submitted_at")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{state.gradeCorrections.map((request) => <tr key={request.id}><td><b>{request.courseName}</b><small className="table-sub">{request.teacherName} · {request.id}</small></td><td>{request.studentAccount}</td><td className="admin-wrap-cell">{request.reason}</td><td>{formatAdminDate(locale, request.submittedAt, true)}</td><td><AdminBadge tone={correctionTone(request.status)}>{adminLabel(locale, "gradeCorrectionStatus", request.status)}</AdminBadge></td><td><div className="admin-row-actions">{request.status === "pending" && <><button type="button" onClick={() => setCorrectionAction({ request, nextStatus: "approved" })}>{adminCopy(locale, "approve_window")}</button><button className="is-danger" type="button" onClick={() => setCorrectionAction({ request, nextStatus: "rejected" })}>{adminCopy(locale, "reject_request")}</button></>}{request.status === "corrected" && <button type="button" onClick={() => setCorrectionAction({ request, nextStatus: "closed" })}>{adminCopy(locale, "close_window")}</button>}{!["pending", "corrected"].includes(request.status) && <span>{adminCopy(locale, "not_available")}</span>}</div></td></tr>)}</tbody></table></div>}
      </section>}

      {formSemester && <SemesterForm locale={locale} semester={formSemester === "new" ? undefined : formSemester} close={() => setFormSemester(null)} />}
      {detail && <AdminDrawer locale={locale} title={adminCopy(locale, "semester_detail")} description={detail.name} close={() => setDetailId(null)}><div className="admin-detail-list"><span><small>{adminCopy(locale, "status")}</small><AdminBadge tone={semesterTone(detail.status)}>{adminLabel(locale, "semesterStatus", detail.status)}</AdminBadge></span><span><small>{adminCopy(locale, "academic_year")}</small><b>{detail.academicYear}</b></span><span><small>{adminCopy(locale, "term")}</small><b>{adminLabel(locale, "semesterTerm", detail.term)}</b></span><span><small>{adminCopy(locale, "start_date")}</small><b>{formatAdminDate(locale, detail.startDate)}</b></span><span><small>{adminCopy(locale, "end_date")}</small><b>{formatAdminDate(locale, detail.endDate)}</b></span><span><small>{adminCopy(locale, "courses")}</small><b>{detail.courseCount}</b></span><span><small>{adminCopy(locale, "students")}</small><b>{detail.studentCount}</b></span></div><aside className="admin-info-banner">{detail.status === "archived" ? adminCopy(locale, "historical_readonly") : adminCopy(locale, "semester_delete_disabled")}</aside></AdminDrawer>}
      {confirmAction && <AdminConfirm locale={locale} title={adminCopy(locale, "set_current_title")} description={adminCopy(locale, "set_current_body")} close={() => setConfirmAction(null)} confirm={() => void performConfirm()} confirmLabel={adminCopy(locale, "set_current")} busy={busyKey === `semester.switch.${confirmAction.id}`}><div className="admin-confirm-object"><b>{confirmAction.name}</b><span>{formatAdminDate(locale, confirmAction.startDate)} – {formatAdminDate(locale, confirmAction.endDate)}</span></div></AdminConfirm>}
      {correctionAction && <CorrectionDialog locale={locale} request={correctionAction.request} nextStatus={correctionAction.nextStatus} close={() => setCorrectionAction(null)} />}
    </div>
  );
}
