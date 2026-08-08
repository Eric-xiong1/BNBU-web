"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppSelect } from "./app-select";
import { adminCopy } from "./admin-i18n";
import {
  adminApiErrorText,
  createAdminCourse,
  listAdminCourses,
  updateAdminCourse,
} from "./admin-service";
import type { AdminCourse, AdminLocale, ApiRecordStatus } from "./admin-types";
import {
  AdminBadge,
  AdminEmpty,
  AdminLoadError,
  AdminLoading,
  AdminSectionHeading,
  formatAdminDate,
} from "./admin-components";

type CourseForm = { courseCode: string; courseName: string; description: string };
const emptyForm: CourseForm = { courseCode: "", courseName: "", description: "" };

export function AdminCourses({ locale, onBack }: { locale: AdminLocale; onBack: () => void }) {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ApiRecordStatus>("all");
  const [form, setForm] = useState<CourseForm>(emptyForm);
  const [editing, setEditing] = useState<AdminCourse | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const loaded = await listAdminCourses();
      setCourses([...loaded].sort((left, right) => left.courseCode.localeCompare(right.courseCode)));
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return courses.filter((course) => {
      if (status !== "all" && course.status !== status) return false;
      return !normalized || `${course.courseCode} ${course.courseName} ${course.description ?? ""}`.toLocaleLowerCase().includes(normalized);
    });
  }, [courses, query, status]);

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    if (!form.courseCode.trim() || !form.courseName.trim() || busyId) return;
    setBusyId("create");
    setError("");
    setNotice("");
    try {
      const created = await createAdminCourse(form);
      setCourses((items) => [...items, created].sort((left, right) => left.courseCode.localeCompare(right.courseCode)));
      setForm(emptyForm);
      setNotice(adminCopy(locale, "course_created"));
    } catch (failure) {
      setError(adminApiErrorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  function beginEdit(course: AdminCourse) {
    setEditing(course);
    setEditName(course.courseName);
    setEditDescription(course.description ?? "");
    setNotice("");
  }

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || !editName.trim() || busyId) return;
    setBusyId(editing.id);
    setError("");
    setNotice("");
    try {
      const updated = await updateAdminCourse(editing.id, {
        courseName: editName.trim(),
        description: editDescription.trim() || null,
        expectedVersion: editing.version,
      });
      setCourses((items) => items.map((item) => item.id === updated.id ? updated : item));
      setEditing(null);
      setNotice(adminCopy(locale, "course_updated"));
    } catch (failure) {
      setError(adminApiErrorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(course: AdminCourse) {
    if (busyId) return;
    setBusyId(course.id);
    setError("");
    setNotice("");
    try {
      const updated = await updateAdminCourse(course.id, {
        status: course.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        expectedVersion: course.version,
      });
      setCourses((items) => items.map((item) => item.id === updated.id ? updated : item));
      setNotice(adminCopy(locale, "course_updated"));
    } catch (failure) {
      setError(adminApiErrorText(failure));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <AdminLoading locale={locale} />;
  if (error && courses.length === 0) return <AdminLoadError locale={locale} message={error} retry={() => void load()} />;

  return (
    <div className="admin-page-stack">
      <button className="text-button" type="button" onClick={onBack}>← {adminCopy(locale, "back_overview")}</button>
      <aside className="admin-readonly-banner"><span aria-hidden="true">API</span><b>{adminCopy(locale, "api_data_notice")}</b></aside>
      {error && <div className="admin-empty-state is-error" role="alert"><span>!</span><p>{error}</p></div>}
      {notice && <aside className="admin-readonly-banner" role="status"><span aria-hidden="true">✓</span><b>{notice}</b></aside>}

      <section className="admin-surface">
        <AdminSectionHeading title={adminCopy(locale, "create_course")} description={adminCopy(locale, "course_catalog_hint")} />
        <form className="admin-form-grid" onSubmit={submitCreate}>
          <label><span>{adminCopy(locale, "course_code")}</span><input required value={form.courseCode} onChange={(event) => setForm((value) => ({ ...value, courseCode: event.target.value }))} /></label>
          <label><span>{adminCopy(locale, "course_name")}</span><input required value={form.courseName} onChange={(event) => setForm((value) => ({ ...value, courseName: event.target.value }))} /></label>
          <label className="admin-field-span"><span>{adminCopy(locale, "course_description")}</span><textarea value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} /></label>
          <div className="admin-form-actions"><button className="primary-button" type="submit" disabled={busyId !== null}>{busyId === "create" ? adminCopy(locale, "processing") : adminCopy(locale, "create_course")}</button></div>
        </form>
      </section>

      {editing && (
        <section className="admin-surface">
          <AdminSectionHeading title={`${adminCopy(locale, "edit")} · ${editing.courseCode}`} description={adminCopy(locale, "course_catalog_hint")} />
          <form className="admin-form-grid" onSubmit={submitEdit}>
            <label><span>{adminCopy(locale, "course_name")}</span><input required value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
            <label className="admin-field-span"><span>{adminCopy(locale, "course_description")}</span><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} /></label>
            <div className="admin-form-actions"><button className="secondary-button" type="button" onClick={() => setEditing(null)}>{adminCopy(locale, "cancel")}</button><button className="primary-button" type="submit" disabled={busyId !== null}>{adminCopy(locale, "save")}</button></div>
          </form>
        </section>
      )}

      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "course_catalog")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
        <div className="admin-audit-filters">
          <label><span>{adminCopy(locale, "search")}</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <AppSelect label={adminCopy(locale, "status")} value={status} options={[{ value: "all", label: adminCopy(locale, "all") }, { value: "ACTIVE", label: locale === "zh" ? "启用" : "Active" }, { value: "INACTIVE", label: locale === "zh" ? "停用" : "Inactive" }]} onChange={(value) => value && setStatus(String(value) as typeof status)} />
        </div>
        {filtered.length === 0 ? <AdminEmpty locale={locale} filtered={Boolean(query || status !== "all")} /> : (
          <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "course_code")}</th><th>{adminCopy(locale, "course_name")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "updated_at")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{filtered.map((course) => (
            <tr key={course.id}><td><code>{course.courseCode}</code></td><td><b>{course.courseName}</b><small className="table-sub">{course.description || adminCopy(locale, "not_available")}</small></td><td><AdminBadge tone={course.status === "ACTIVE" ? "green" : "gray"}>{course.status}</AdminBadge></td><td>{formatAdminDate(locale, course.updatedAt, true)}<small className="table-sub">v{course.version}</small></td><td><button className="text-button" type="button" onClick={() => beginEdit(course)}>{adminCopy(locale, "edit")}</button> · <button className="text-button" type="button" disabled={busyId !== null} onClick={() => void toggleStatus(course)}>{course.status === "ACTIVE" ? adminCopy(locale, "deactivate") : adminCopy(locale, "reactivate")}</button></td></tr>
          ))}</tbody></table></div>
        )}
      </section>
    </div>
  );
}
