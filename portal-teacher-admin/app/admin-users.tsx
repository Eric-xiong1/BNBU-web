"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { AppSelect } from "./app-select";
import { buildUserImportPreview, pageItems, type CsvPreviewRow } from "./admin-domain";
import { adminCopy, adminErrorCopy, adminLabel } from "./admin-i18n";
import {
  createUser,
  deleteUser,
  forceLogoutUser,
  importUsers,
  reviewRecoveryRequest,
  transferTeacherCourses,
  unlockVerificationCode,
  updateUser,
} from "./admin-service";
import { useAdminStore } from "./admin-store";
import {
  AdminServiceError,
  type AdminLocale,
  type AdminUser,
  type Gender,
  type GradeLevel,
  type RecoveryRequest,
  type UserInput,
  type UserRole,
  type UserStatus,
} from "./admin-types";
import {
  AdminBadge,
  AdminDialog,
  AdminDrawer,
  AdminEmpty,
  AdminField,
  AdminInlineError,
  AdminPagination,
  AdminSectionHeading,
  downloadAdminCsv,
  formatAdminDate,
  type AdminTone,
} from "./admin-components";

type AccountsView = "users" | "recoveries";
type RoleFilter = "all" | UserRole;
type StatusFilter = "all" | UserStatus | "LOCKED";
type UserAction = "unlock" | "force_logout" | "delete" | "handover";

function userTone(status: UserStatus, locked = false): AdminTone {
  if (locked) return "orange";
  if (status === "ACTIVE") return "green";
  if (status === "DISABLED") return "gray";
  return "orange";
}

function recoveryTone(status: RecoveryRequest["status"]): AdminTone {
  return status === "approved" ? "green" : status === "rejected" ? "red" : "orange";
}

function blankUser(): UserInput {
  return { account: "", email: "", role: "teacher", name: "", college: "体育部", status: "ACTIVE", initialPassword: "" };
}

function UserForm({ locale, user, close }: { locale: AdminLocale; user?: AdminUser; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const initial: UserInput = user ? {
    id: user.id,
    account: user.account,
    email: user.email,
    role: user.role,
    name: user.name,
    college: user.college,
    className: user.className,
    gender: user.gender,
    gradeLevel: user.gradeLevel,
    admissionYear: user.admissionYear,
    status: user.status,
    expectedUpdatedAt: user.updatedAt,
  } : blankUser();
  const [form, setForm] = useState<UserInput>(initial);
  const [reason, setReason] = useState("");
  const key = user ? `user.update.${user.id}` : "user.create";
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || Boolean(reason);
  useEffect(() => () => clearError(), [clearError]);
  const update = <K extends keyof UserInput>(field: K, value: UserInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const changeRole = (role: UserRole) => setForm((current) => ({
    ...current,
    role,
    ...(role === "student" ? {
      className: current.className ?? "",
      gender: current.gender ?? "female",
      gradeLevel: current.gradeLevel ?? "freshman",
      admissionYear: current.admissionYear ?? new Date().getFullYear(),
      initialPassword: undefined,
    } : { className: undefined, gender: undefined, gradeLevel: undefined, admissionYear: undefined }),
  }));
  const submit = async () => {
    const result = user
      ? await run(key, () => updateUser(form, reason), adminCopy(locale, "user_updated"))
      : await run(key, () => createUser(form), adminCopy(locale, "user_created"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, user ? "edit_user" : "create_teacher")} close={close} dirty={dirty} wide footer={<>
      <button className="secondary-button" type="button" onClick={close} disabled={busyKey === key}>{adminCopy(locale, "cancel")}</button>
      <button className="primary-button" type="button" onClick={() => void submit()} disabled={busyKey === key}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "save")}</button>
    </>}>
      <div className="admin-form-grid two-columns">
        {user && <AdminField locale={locale} label={adminCopy(locale, "role_filter")} required>
          <AppSelect label={adminCopy(locale, "role_filter")} value={form.role} options={(["teacher", "student", "admin"] as UserRole[]).map((value) => ({ value, label: adminLabel(locale, "userRole", value) }))} onChange={(value) => value && changeRole(value as UserRole)} />
        </AdminField>}
        <AdminField locale={locale} label={adminCopy(locale, form.role === "student" ? "student_number" : "employee_id")} required errorCode={error?.fieldErrors.account}><input value={form.account} onChange={(event) => update("account", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "name")} required errorCode={error?.fieldErrors.name}><input value={form.name} onChange={(event) => update("name", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "email")} required errorCode={error?.fieldErrors.email}><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "college")} required errorCode={error?.fieldErrors.college}><input value={form.college} onChange={(event) => update("college", event.target.value)} /></AdminField>
        {!user && form.role !== "student" && <AdminField locale={locale} label={adminCopy(locale, "initial_password")} required errorCode={error?.fieldErrors.initialPassword} hint={adminCopy(locale, "initial_password_hint")}><input type="password" autoComplete="new-password" value={form.initialPassword ?? ""} onChange={(event) => update("initialPassword", event.target.value)} /></AdminField>}
        {form.role === "student" && <>
          <AdminField locale={locale} label={adminCopy(locale, "class_name")} required errorCode={error?.fieldErrors.className}><input value={form.className ?? ""} onChange={(event) => update("className", event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "gender")} required errorCode={error?.fieldErrors.gender}><AppSelect label={adminCopy(locale, "gender")} value={form.gender ?? "female"} options={(["female", "male"] as Gender[]).map((value) => ({ value, label: adminLabel(locale, "gender", value) }))} onChange={(value) => value && update("gender", value as Gender)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "grade_level")} required errorCode={error?.fieldErrors.gradeLevel}><AppSelect label={adminCopy(locale, "grade_level")} value={form.gradeLevel ?? "freshman"} options={(["freshman", "sophomore", "junior", "senior"] as GradeLevel[]).map((value) => ({ value, label: adminLabel(locale, "gradeLevel", value) }))} onChange={(value) => value && update("gradeLevel", value as GradeLevel)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "admission_year")} required errorCode={error?.fieldErrors.admissionYear}><input type="number" min="2000" max={new Date().getFullYear() + 1} value={form.admissionYear ?? ""} onChange={(event) => update("admissionYear", Number(event.target.value))} /></AdminField>
        </>}
        <AdminField locale={locale} label={adminCopy(locale, "status_filter")} required><AppSelect label={adminCopy(locale, "status_filter")} value={form.status} options={(["ACTIVE", "DISABLED", "RECOVERY_REQUIRED"] as UserStatus[]).map((value) => ({ value, label: adminLabel(locale, "userStatus", value) }))} onChange={(value) => value && update("status", value as UserStatus)} /></AdminField>
        {user && <AdminField locale={locale} label={adminCopy(locale, "reason")} required errorCode={error?.fieldErrors.reason}><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>}
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

function UserActionDialog({ locale, user, action, close }: { locale: AdminLocale; user: AdminUser; action: UserAction; close: () => void }) {
  const { state, busyKey, error, clearError, run } = useAdminStore();
  const [reason, setReason] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [replacementId, setReplacementId] = useState("");
  const [localError, setLocalError] = useState("");
  const key = `user.${action}.${user.id}`;
  useEffect(() => () => clearError(), [clearError]);
  if (!state) return null;
  const teachers = state.users.filter((item) => item.role === "teacher" && item.status === "ACTIVE" && item.id !== user.id);
  const titleKey = action === "unlock" ? "unlock_title" : action === "force_logout" ? "force_logout_title" : action === "delete" ? "delete_user_title" : "teacher_handover";
  const bodyKey = action === "unlock" ? "unlock_body" : action === "force_logout" ? "force_logout_body" : action === "delete" ? "delete_user_body" : "handover_body";
  const successKey = action === "unlock" ? "unlocked" : action === "force_logout" ? "forced_logout" : action === "delete" ? "user_deleted" : "handover_completed";
  const submit = async () => {
    setLocalError("");
    if (action === "delete" && confirmation !== user.account) {
      setLocalError(adminCopy(locale, "confirm_account_mismatch"));
      return;
    }
    const result = action === "unlock"
      ? await run(key, () => unlockVerificationCode(user.id, reason), adminCopy(locale, successKey))
      : action === "force_logout"
        ? await run(key, () => forceLogoutUser(user.id, reason), adminCopy(locale, successKey))
        : action === "delete"
          ? await run(key, () => deleteUser(user.id, password, reason), adminCopy(locale, successKey))
          : await run(key, () => transferTeacherCourses(user.id, replacementId, reason), adminCopy(locale, successKey));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, titleKey)} description={adminCopy(locale, bodyKey)} close={close} dirty={Boolean(reason || password || confirmation || replacementId)} footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className={action === "delete" ? "danger-button" : "primary-button"} type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, action === "delete" ? "delete_account" : "confirm")}</button>
    </>}>
      <div className="admin-confirm-object"><b>{user.name}</b><span>{user.account} · {adminLabel(locale, "userRole", user.role)}</span></div>
      {action === "handover" && <AdminField locale={locale} label={adminCopy(locale, "replacement_teacher")} required><AppSelect label={adminCopy(locale, "replacement_teacher")} value={replacementId || null} placeholder={adminCopy(locale, "replacement_teacher")} options={teachers.map((item) => ({ value: item.id, label: `${item.name} · ${item.account} · ${item.assignedCourseCount}` }))} onChange={(value) => setReplacementId(String(value ?? ""))} /></AdminField>}
      {action === "delete" && <>
        <div className="admin-cascade-warning"><b>{adminCopy(locale, "delete_user_body")}</b><ul><li>course_enrollments / sport_records / proof_files</li><li>record_supplements / memberships / notifications</li><li>exemptions / grades / idempotency_keys</li></ul></div>
        <AdminField locale={locale} label={adminCopy(locale, "admin_password")} required errorCode={error?.fieldErrors.adminPassword} hint={adminCopy(locale, "demo_password_hint")}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={`${adminCopy(locale, "delete_confirm_account")} · ${user.account}`} required><input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></AdminField>
      </>}
      <AdminField locale={locale} label={adminCopy(locale, "reason")} required errorCode={error?.fieldErrors.reason}><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
      <AdminInlineError message={localError || error?.message} />
    </AdminDialog>
  );
}

function RecoveryDialog({ locale, request, decision, close }: { locale: AdminLocale; request: RecoveryRequest; decision: "approve" | "reject"; close: () => void }) {
  const { state, busyKey, error, clearError, run } = useAdminStore();
  const user = state?.users.find((item) => item.id === request.userId);
  const [verificationMethod, setVerificationMethod] = useState("");
  const [reason, setReason] = useState("");
  const [newEmail, setNewEmail] = useState(request.requestedEmail ?? "");
  const [newPhone, setNewPhone] = useState(request.requestedPhone ?? "");
  const key = `recovery.${request.id}.${decision}`;
  useEffect(() => () => clearError(), [clearError]);
  if (!user) return null;
  const submit = async () => {
    const result = await run(key, () => reviewRecoveryRequest({ requestId: request.id, decision, verificationMethod, reason, newEmail, newPhone }), adminCopy(locale, "recovery_reviewed"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, decision === "approve" ? "approve_recovery" : "reject_recovery")} close={close} dirty={Boolean(verificationMethod || reason)} footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className={decision === "reject" ? "danger-button" : "primary-button"} type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, decision === "approve" ? "approve_recovery" : "reject_recovery")}</button>
    </>}>
      <div className="admin-confirm-object"><b>{user.name} · {user.account}</b><span>{request.requestedEmail ?? request.requestedPhone ?? adminCopy(locale, "not_available")}</span></div>
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "verify_identity")} required errorCode={error?.fieldErrors.verificationMethod}><input value={verificationMethod} onChange={(event) => setVerificationMethod(event.target.value)} /></AdminField>
        {decision === "approve" && <><AdminField locale={locale} label={adminCopy(locale, "new_email")} required errorCode={error?.fieldErrors.newEmail}><input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></AdminField><AdminField locale={locale} label={adminCopy(locale, "new_phone")}><input value={newPhone} onChange={(event) => setNewPhone(event.target.value)} /></AdminField></>}
        <AdminField locale={locale} label={adminCopy(locale, "review_reason")} required errorCode={error?.fieldErrors.reason} className="full-width"><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></AdminField>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

function ImportDialog({ locale, close }: { locale: AdminLocale; close: () => void }) {
  const { state, busyKey, error, clearError, run } = useAdminStore();
  const [fallbackPassword, setFallbackPassword] = useState("");
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<CsvPreviewRow[]>([]);
  const [previewError, setPreviewError] = useState("");
  const [passwordRows, setPasswordRows] = useState<Array<{ account: string; name: string; email: string; initialPassword: string }>>([]);
  const key = "users.import";
  useEffect(() => () => clearError(), [clearError]);
  if (!state) return null;
  const parsePreview = (text = csvText) => {
    setPreviewError("");
    try {
      setPreview(buildUserImportPreview(text, "teacher", state.users, fallbackPassword));
    } catch (failure) {
      const code = failure instanceof AdminServiceError ? failure.message : "CSV_EMPTY";
      setPreview([]);
      setPreviewError(adminErrorCopy(locale, code, failure instanceof AdminServiceError ? { fields: failure.fieldErrors.csv ?? "" } : {}));
    }
  };
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFilename(file.name);
    setCsvText(text);
    setPasswordRows([]);
    parsePreview(text);
  };
  const downloadTemplate = () => {
    downloadAdminCsv("bnbu-teacher-import-template.csv", [["employee_id", "name", "email", "college", "initial_password"], ["T2026001", "Example Teacher", "teacher@example.edu", "体育部", "Temp2026!"]]);
  };
  const submit = async () => {
    const result = await run(key, () => importUsers(csvText, "teacher", fallbackPassword), adminCopy(locale, "import_completed"));
    if (result) setPasswordRows(result.passwordRows);
  };
  const valid = preview.filter((row) => row.errors.length === 0).length;
  const invalid = preview.length - valid;
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, "batch_import")} description={adminCopy(locale, "import_atomic_hint")} close={close} dirty={Boolean(csvText) && passwordRows.length === 0} wide footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "close")}</button>
      {passwordRows.length > 0 ? <button className="primary-button" type="button" onClick={() => downloadAdminCsv("bnbu-account-passwords.csv", [["account", "name", "email", "initial_password"], ...passwordRows.map((row) => [row.account, row.name, row.email, row.initialPassword])])}>{adminCopy(locale, "download_passwords")}</button> : <button className="primary-button" type="button" disabled={busyKey === key || !preview.length || invalid > 0} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "import_confirm")}</button>}
    </>}>
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "unified_password")} required hint={adminCopy(locale, "initial_password_hint")}><input type="password" value={fallbackPassword} onChange={(event) => setFallbackPassword(event.target.value)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "csv_file")} required className="full-width"><input type="file" accept=".csv,text/csv" onChange={(event) => void onFile(event)} /><small>{filename}</small></AdminField>
      </div>
      <button className="text-button" type="button" onClick={downloadTemplate}>{adminCopy(locale, "download_template")}</button>
      {preview.length > 0 && <section className="admin-import-preview"><div><b>{adminCopy(locale, "parse_preview")}</b><span><AdminBadge tone="green">{adminCopy(locale, "valid_rows", { count: valid })}</AdminBadge><AdminBadge tone={invalid ? "red" : "gray"}>{adminCopy(locale, "invalid_rows", { count: invalid })}</AdminBadge></span></div><div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "csv_line", { line: "#" })}</th><th>{adminCopy(locale, "account")}</th><th>{adminCopy(locale, "name")}</th><th>{adminCopy(locale, "email")}</th><th>{adminCopy(locale, "status")}</th></tr></thead><tbody>{preview.map((row) => <tr key={row.line}><td>{row.line}</td><td>{row.input.account}</td><td>{row.input.name}</td><td>{row.input.email}</td><td>{row.errors.length ? <span className="admin-row-error">{row.errors.map((code) => adminErrorCopy(locale, code)).join("; ")}</span> : <AdminBadge tone="green">OK</AdminBadge>}</td></tr>)}</tbody></table></div></section>}
      {passwordRows.length > 0 && <aside className="admin-info-banner">{adminCopy(locale, "password_security_hint")}</aside>}
      <AdminInlineError message={previewError || error?.message} />
    </AdminDialog>
  );
}

export function AdminUsers({ locale }: { locale: AdminLocale }) {
  const { state } = useAdminStore();
  const [view, setView] = useState<AccountsView>("users");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [formUser, setFormUser] = useState<AdminUser | "new" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [action, setAction] = useState<{ user: AdminUser; type: UserAction } | null>(null);
  const [recoveryAction, setRecoveryAction] = useState<{ request: RecoveryRequest; decision: "approve" | "reject" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  if (!state) return null;
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = state.users.filter((user) => {
    if (roleFilter !== "all" && user.role !== roleFilter) return false;
    if (statusFilter === "LOCKED" && !user.verificationLock) return false;
    if (statusFilter !== "all" && statusFilter !== "LOCKED" && user.status !== statusFilter) return false;
    return !normalizedSearch || [user.name, user.account, user.email, user.college].some((value) => value.toLowerCase().includes(normalizedSearch));
  });
  const paged = pageItems(filtered, page, 6);
  const detail = state.users.find((user) => user.id === detailId);
  const pendingRecoveries = state.recoveryRequests.filter((request) => request.status === "pending").length;
  const lockedCount = state.users.filter((user) => user.verificationLock).length;
  const activeCount = state.users.filter((user) => user.status === "ACTIVE").length;

  return (
    <div className="admin-page-stack">
      <section className="admin-summary-grid three" aria-label={adminCopy(locale, "user_summary")}>
        <button type="button" onClick={() => { setView("users"); setStatusFilter("all"); setPage(1); }}><span>{adminCopy(locale, "total_users")}</span><b>{state.users.length}</b><small>{activeCount} {adminLabel(locale, "userStatus", "ACTIVE")}</small></button>
        <button type="button" onClick={() => setView("recoveries")}><span>{adminCopy(locale, "pending_recoveries")}</span><b>{pendingRecoveries}</b><small>{adminCopy(locale, "verify_identity")}</small></button>
        <button type="button" onClick={() => { setView("users"); setStatusFilter("LOCKED"); setPage(1); }}><span>{adminCopy(locale, "locked_accounts")}</span><b>{lockedCount}</b><small>5 × / 15 min</small></button>
      </section>

      <div className="admin-view-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={view === "users"} className={view === "users" ? "selected" : ""} onClick={() => setView("users")}>{adminCopy(locale, "user_list")}</button>
        <button type="button" role="tab" aria-selected={view === "recoveries"} className={view === "recoveries" ? "selected" : ""} onClick={() => setView("recoveries")}>{adminCopy(locale, "recovery_requests")}<b>{pendingRecoveries}</b></button>
      </div>

      {view === "users" ? <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "user_list")} action={<div className="admin-heading-actions"><button className="secondary-button" type="button" onClick={() => setImportOpen(true)}>{adminCopy(locale, "batch_import")}</button><button className="primary-button" type="button" onClick={() => setFormUser("new")}>{adminCopy(locale, "create_teacher")}</button></div>} />
        <div className="admin-filter-row">
          <label className="admin-search"><span aria-hidden="true">⌕</span><input value={search} placeholder={adminCopy(locale, "account_search")} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <AppSelect label={adminCopy(locale, "role_filter")} value={roleFilter} options={[{ value: "all", label: adminCopy(locale, "all") }, ...(["student", "teacher", "admin"] as UserRole[]).map((value) => ({ value, label: adminLabel(locale, "userRole", value) }))]} onChange={(value) => { if (value) { setRoleFilter(value as RoleFilter); setPage(1); } }} />
          <AppSelect label={adminCopy(locale, "status_filter")} value={statusFilter} options={[{ value: "all", label: adminCopy(locale, "all") }, ...(["ACTIVE", "DISABLED", "RECOVERY_REQUIRED"] as UserStatus[]).map((value) => ({ value, label: adminLabel(locale, "userStatus", value) })), { value: "LOCKED", label: adminCopy(locale, "verification_lock") }]} onChange={(value) => { if (value) { setStatusFilter(value as StatusFilter); setPage(1); } }} />
          {(search || roleFilter !== "all" || statusFilter !== "all") && <button className="text-button" type="button" onClick={() => { setSearch(""); setRoleFilter("all"); setStatusFilter("all"); setPage(1); }}>{adminCopy(locale, "clear_filters")}</button>}
        </div>
        {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "name")}</th><th>{adminCopy(locale, "role_filter")}</th><th>{adminCopy(locale, "college")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "updated_at")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{paged.items.map((user) => <tr key={user.id}><td><div className="person-cell compact"><span>{user.name.slice(-1)}</span><div><b>{user.name}</b><small>{user.account} · {user.email}</small></div></div></td><td>{adminLabel(locale, "userRole", user.role)}</td><td>{user.college || adminCopy(locale, "not_available")}</td><td><AdminBadge tone={userTone(user.status, Boolean(user.verificationLock))}>{user.verificationLock ? adminCopy(locale, "verification_lock") : adminLabel(locale, "userStatus", user.status)}</AdminBadge></td><td>{formatAdminDate(locale, user.updatedAt, true)}</td><td><button className="text-button" type="button" onClick={() => setDetailId(user.id)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
        <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
      </section> : <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "recovery_requests")} description={adminCopy(locale, "verify_identity")} />
        {state.recoveryRequests.length === 0 ? <AdminEmpty locale={locale} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "name")}</th><th>{adminCopy(locale, "requested_contact")}</th><th>{adminCopy(locale, "submitted_at")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{state.recoveryRequests.map((request) => { const user = state.users.find((item) => item.id === request.userId); return <tr key={request.id}><td><b>{user?.name ?? adminCopy(locale, "not_found")}</b><small className="table-sub">{user?.account ?? request.userId} · {request.id}</small></td><td>{request.requestedEmail ?? request.requestedPhone ?? adminCopy(locale, "not_available")}</td><td>{formatAdminDate(locale, request.submittedAt, true)}</td><td><AdminBadge tone={recoveryTone(request.status)}>{adminLabel(locale, "recoveryStatus", request.status)}</AdminBadge></td><td>{request.status === "pending" ? <div className="admin-row-actions"><button type="button" onClick={() => setRecoveryAction({ request, decision: "approve" })}>{adminCopy(locale, "approve_recovery")}</button><button className="is-danger" type="button" onClick={() => setRecoveryAction({ request, decision: "reject" })}>{adminCopy(locale, "reject_recovery")}</button></div> : <span>{request.reviewReason ?? adminCopy(locale, "not_available")}</span>}</td></tr>; })}</tbody></table></div>}
      </section>}

      {formUser && <UserForm locale={locale} user={formUser === "new" ? undefined : formUser} close={() => setFormUser(null)} />}
      {detail && <AdminDrawer locale={locale} title={adminCopy(locale, "user_detail")} description={`${detail.name} · ${detail.account}`} close={() => setDetailId(null)} footer={<div className="admin-drawer-actions"><button className="secondary-button" type="button" onClick={() => setFormUser(detail)}>{adminCopy(locale, "edit")}</button>{detail.verificationLock && <button className="secondary-button" type="button" onClick={() => setAction({ user: detail, type: "unlock" })}>{adminCopy(locale, "unlock_code")}</button>}<button className="secondary-button" type="button" onClick={() => setAction({ user: detail, type: "force_logout" })}>{adminCopy(locale, "force_logout")}</button>{detail.role === "teacher" && detail.assignedCourseCount > 0 && <button className="secondary-button" type="button" onClick={() => setAction({ user: detail, type: "handover" })}>{adminCopy(locale, "teacher_handover")}</button>}<button className="danger-button" type="button" onClick={() => setAction({ user: detail, type: "delete" })}>{adminCopy(locale, "delete_account")}</button></div>}><div className="admin-detail-list"><span><small>{adminCopy(locale, "status")}</small><AdminBadge tone={userTone(detail.status)}>{adminLabel(locale, "userStatus", detail.status)}</AdminBadge></span><span><small>{adminCopy(locale, "role_filter")}</small><b>{adminLabel(locale, "userRole", detail.role)}</b></span><span><small>{adminCopy(locale, "email")}</small><b>{detail.email}</b></span><span><small>{adminCopy(locale, "college")}</small><b>{detail.college}</b></span>{detail.role === "student" && <><span><small>{adminCopy(locale, "class_name")}</small><b>{detail.className}</b></span><span><small>{adminCopy(locale, "gender")}</small><b>{detail.gender ? adminLabel(locale, "gender", detail.gender) : adminCopy(locale, "not_available")}</b></span><span><small>{adminCopy(locale, "grade_level")}</small><b>{detail.gradeLevel ? adminLabel(locale, "gradeLevel", detail.gradeLevel) : adminCopy(locale, "not_available")}</b></span><span><small>{adminCopy(locale, "admission_year")}</small><b>{detail.admissionYear}</b></span></>}<span><small>{adminCopy(locale, "token_version")}</small><b>{detail.tokenVersion}</b></span><span><small>{adminCopy(locale, "assigned_courses")}</small><b>{detail.assignedCourseCount}</b></span><span><small>{adminCopy(locale, "created_at")}</small><b>{formatAdminDate(locale, detail.createdAt, true)}</b></span></div></AdminDrawer>}
      {action && <UserActionDialog locale={locale} user={action.user} action={action.type} close={() => { setAction(null); if (action.type === "delete") setDetailId(null); }} />}
      {recoveryAction && <RecoveryDialog locale={locale} request={recoveryAction.request} decision={recoveryAction.decision} close={() => setRecoveryAction(null)} />}
      {importOpen && <ImportDialog locale={locale} close={() => setImportOpen(false)} />}
    </div>
  );
}
