"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppSelect } from "./app-select";
import { pageItems } from "./admin-domain";
import { adminCopy } from "./admin-i18n";
import { adminApiErrorText, getStudentProfile, listAssociatedTeacherProfiles, listStudentProfiles } from "./admin-service";
import type { AdminLocale, StudentProfileProjection, TeacherProfileProjection } from "./admin-types";
import { AdminBadge, AdminDrawer, AdminEmpty, AdminLoadError, AdminLoading, AdminPagination, AdminSectionHeading, formatAdminDate } from "./admin-components";

export function AdminUsers({ locale }: { locale: AdminLocale }) {
  const [students, setStudents] = useState<StudentProfileProjection[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfileProjection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"students" | "teacher">("students");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [college, setCollege] = useState("all");
  const [page, setPage] = useState(1);
  const [studentDetail, setStudentDetail] = useState<StudentProfileProjection | null>(null);
  const [teacherDetail, setTeacherDetail] = useState<TeacherProfileProjection | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [loadedStudents, loadedTeachers] = await Promise.all([
        listStudentProfiles(),
        listAssociatedTeacherProfiles(),
      ]);
      setStudents([...loadedStudents].sort((left, right) => left.studentNumber.localeCompare(right.studentNumber)));
      setTeachers(loadedTeachers);
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

  const statuses = useMemo(() => [...new Set(students.map((student) => student.status))].sort(), [students]);
  const colleges = useMemo(() => [...new Set(students.map((student) => student.collegeName).filter((value): value is string => Boolean(value)))].sort(), [students]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return students.filter((student) => {
      if (status !== "all" && student.status !== status) return false;
      if (college !== "all" && student.collegeName !== college) return false;
      return !normalized || [student.studentNumber, student.fullName, student.collegeName, student.majorName, student.administrativeClassName]
        .filter(Boolean).join(" ").toLocaleLowerCase().includes(normalized);
    });
  }, [college, query, status, students]);
  const paged = pageItems(filtered, page, 10);

  async function openStudent(id: string) {
    setError("");
    try {
      setStudentDetail(await getStudentProfile(id));
    } catch (failure) {
      setError(adminApiErrorText(failure));
    }
  }

  if (loading) return <AdminLoading locale={locale} />;
  if (error && students.length === 0) return <AdminLoadError locale={locale} message={error} retry={() => void load()} />;

  return (
    <div className="admin-page-stack">
      <aside className="admin-readonly-banner"><span aria-hidden="true">API</span><b>{adminCopy(locale, "api_data_notice")} {adminCopy(locale, "student_edit_unavailable")}</b></aside>
      {error && <div className="admin-empty-state is-error" role="alert"><span>!</span><p>{error}</p></div>}
      <section className="admin-surface">
        <AppSelect
          label={locale === "zh" ? "资料类型" : "Profile type"}
          value={view}
          options={[{ value: "students", label: adminCopy(locale, "backend_students") }, { value: "teacher", label: adminCopy(locale, "associated_teachers") }]}
          onChange={(value) => { if (value) { setView(String(value) as typeof view); setPage(1); } }}
        />
      </section>

      {view === "students" ? (
        <section className="admin-surface admin-table-surface">
          <AdminSectionHeading title={adminCopy(locale, "backend_students")} description={adminCopy(locale, "contract_readonly")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
          <div className="admin-audit-filters">
            <label><span>{adminCopy(locale, "search")}</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={adminCopy(locale, "account_search")} /></label>
            <AppSelect label={adminCopy(locale, "status_filter")} value={status} options={[{ value: "all", label: adminCopy(locale, "all") }, ...statuses.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) { setStatus(String(value)); setPage(1); } }} />
            <AppSelect label={adminCopy(locale, "college")} value={college} searchable options={[{ value: "all", label: adminCopy(locale, "all") }, ...colleges.map((value) => ({ value, label: value }))]} onChange={(value) => { if (value) { setCollege(String(value)); setPage(1); } }} />
          </div>
          {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered={Boolean(query || status !== "all" || college !== "all")} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "student_number")}</th><th>{adminCopy(locale, "name")}</th><th>{adminCopy(locale, "college")}</th><th>{adminCopy(locale, "class_name")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "details")}</th></tr></thead><tbody>{paged.items.map((student) => <tr key={student.id}><td><code>{student.studentNumber}</code></td><td><b>{student.fullName}</b><small className="table-sub">{student.majorName ?? adminCopy(locale, "not_available")}</small></td><td>{student.collegeName ?? adminCopy(locale, "not_available")}</td><td>{student.administrativeClassName ?? adminCopy(locale, "not_available")}</td><td><AdminBadge tone={student.status === "ACTIVE" ? "green" : "gray"}>{student.status}</AdminBadge></td><td><button className="text-button" type="button" onClick={() => void openStudent(student.id)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
          <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
        </section>
      ) : (
        <section className="admin-surface admin-table-surface">
          <AdminSectionHeading title={adminCopy(locale, "associated_teachers")} description={adminCopy(locale, "associated_teachers_hint")} action={<button className="text-button" type="button" onClick={() => void load()}>{adminCopy(locale, "refresh_data")}</button>} />
          {teachers.length === 0 ? <AdminEmpty locale={locale} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "employee_number")}</th><th>{adminCopy(locale, "name")}</th><th>{adminCopy(locale, "college")}</th><th>{adminCopy(locale, "department")}</th><th>{adminCopy(locale, "status")}</th><th>{adminCopy(locale, "details")}</th></tr></thead><tbody>{teachers.map((teacher) => <tr key={teacher.id}><td><code>{teacher.employeeNumber}</code></td><td><b>{teacher.fullName}</b><small className="table-sub">{teacher.title ?? adminCopy(locale, "not_available")}</small></td><td>{teacher.collegeName ?? adminCopy(locale, "not_available")}</td><td>{teacher.departmentName ?? adminCopy(locale, "not_available")}</td><td><AdminBadge tone={teacher.status === "ACTIVE" ? "green" : "gray"}>{teacher.status}</AdminBadge></td><td><button className="text-button" type="button" onClick={() => setTeacherDetail(teacher)}>{adminCopy(locale, "details")} →</button></td></tr>)}</tbody></table></div>}
        </section>
      )}

      {studentDetail && <StudentDrawer locale={locale} student={studentDetail} close={() => setStudentDetail(null)} />}
      {teacherDetail && <TeacherDrawer locale={locale} teacher={teacherDetail} close={() => setTeacherDetail(null)} />}
    </div>
  );
}

function StudentDrawer({ locale, student, close }: { locale: AdminLocale; student: StudentProfileProjection; close: () => void }) {
  return (
    <AdminDrawer locale={locale} title={student.fullName} description={student.studentNumber} close={close}>
      <div className="admin-detail-list">
        <Detail label={adminCopy(locale, "user_id")} value={student.userId} />
        <Detail label={adminCopy(locale, "organization")} value={student.organizationId} />
        <Detail label={adminCopy(locale, "gender")} value={student.gender} />
        <Detail label={adminCopy(locale, "grade_year")} value={student.gradeYear} />
        <Detail label={adminCopy(locale, "college")} value={student.collegeName} />
        <Detail label={adminCopy(locale, "major")} value={student.majorName} />
        <Detail label={adminCopy(locale, "class_name")} value={student.administrativeClassName} />
        <Detail label={adminCopy(locale, "status")} value={student.status} />
        <Detail label={adminCopy(locale, "updated_at")} value={formatAdminDate(locale, student.updatedAt, true)} />
        <Detail label={adminCopy(locale, "record_version")} value={student.version} />
      </div>
    </AdminDrawer>
  );
}

function TeacherDrawer({ locale, teacher, close }: { locale: AdminLocale; teacher: TeacherProfileProjection; close: () => void }) {
  return <AdminDrawer locale={locale} title={teacher.fullName} description={teacher.employeeNumber} close={close}>
    <div className="admin-detail-list">
      <Detail label={adminCopy(locale, "user_id")} value={teacher.userId} />
      <Detail label={adminCopy(locale, "organization")} value={teacher.organizationId} />
      <Detail label={adminCopy(locale, "college")} value={teacher.collegeName} />
      <Detail label={adminCopy(locale, "department")} value={teacher.departmentName} />
      <Detail label={adminCopy(locale, "job_title")} value={teacher.title} />
      <Detail label={adminCopy(locale, "status")} value={teacher.status} />
      <Detail label={adminCopy(locale, "updated_at")} value={formatAdminDate(locale, teacher.updatedAt, true)} />
      <Detail label={adminCopy(locale, "record_version")} value={teacher.version} />
    </div>
  </AdminDrawer>;
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <span><small>{label}</small><b>{value ?? "—"}</b></span>;
}
