"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { enduranceTableKey, validateEnduranceTable } from "./admin-domain";
import { adminCopy, adminLabel } from "./admin-i18n";
import {
  adminApiErrorText,
  approveScoreRuleProjection,
  createScoreRuleProjection,
  deleteEnduranceRule,
  listClassSectionProjections,
  listScoreRuleProjections,
  saveEnduranceRule,
  submitScoreRuleProjection,
  type ClassSectionProjection,
  type ScoreRuleProjection,
} from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, EnduranceRule, EnduranceRuleInput, EnduranceTier, Gender, GradeGroup, RunType } from "./admin-types";
import { AdminBadge, AdminConfirm, AdminDialog, AdminEmpty, AdminField, AdminInlineError, AdminSectionHeading } from "./admin-components";

function RuleDialog({ locale, tableKey, rule, close }: { locale: AdminLocale; tableKey: string; rule?: EnduranceRule; close: () => void }) {
  const { state, busyKey, error, clearError, run } = useAdminStore();
  const tableRules = state?.enduranceRules.filter((item) => enduranceTableKey(item) === tableKey).sort((left, right) => left.maxSeconds - right.maxSeconds) ?? [];
  const [gender, gradeGroup, runType] = tableKey.split(":") as [Gender, GradeGroup, RunType];
  const last = tableRules.at(-1);
  const initial: EnduranceRuleInput = rule ? { ...rule } : {
    gender, gradeGroup, runType,
    minSeconds: (last?.maxSeconds ?? -1) + 1,
    maxSeconds: (last?.maxSeconds ?? -1) + 30,
    score: Math.max(0, (last?.score ?? 60) - 10),
    tier: "fail",
    note: "",
  };
  const [form, setForm] = useState<EnduranceRuleInput>(initial);
  const key = `endurance.${rule ? "update" : "create"}.${rule?.id ?? tableKey}`;
  useEffect(() => () => clearError(), [clearError]);
  const update = <K extends keyof EnduranceRuleInput>(field: K, value: EnduranceRuleInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async () => {
    const result = await run(key, () => saveEnduranceRule(form), adminCopy(locale, "rule_saved"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, rule ? "edit_rule" : "add_rule")} close={close} dirty={JSON.stringify(form) !== JSON.stringify(initial)} footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      <button className="primary-button" type="button" disabled={busyKey === key} onClick={() => void submit()}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "save")}</button>
    </>}>
      <div className="admin-form-grid two-columns">
        <AdminField locale={locale} label={adminCopy(locale, "min_seconds")} required><input type="number" min="0" value={form.minSeconds} onChange={(event) => update("minSeconds", Number(event.target.value))} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "max_seconds")} required><input type="number" min="0" value={form.maxSeconds} onChange={(event) => update("maxSeconds", Number(event.target.value))} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "score")} required><input type="number" min="0" max="100" value={form.score} onChange={(event) => update("score", Number(event.target.value))} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "tier")} required><AppSelect label={adminCopy(locale, "tier")} value={form.tier} options={(["excellent", "good", "pass", "fail"] as EnduranceTier[]).map((value) => ({ value, label: adminLabel(locale, "enduranceTier", value) }))} onChange={(value) => value && update("tier", value as EnduranceTier)} /></AdminField>
        <AdminField locale={locale} label={adminCopy(locale, "note")} className="full-width"><textarea value={form.note} onChange={(event) => update("note", event.target.value)} /></AdminField>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

function EndurancePanel({ locale }: { locale: AdminLocale }) {
  const { state, busyKey, error, run } = useAdminStore();
  const tableOptions = [
    { gender: "male" as const, gradeGroup: "freshman_sophomore" as const, runType: "1000m" as const },
    { gender: "male" as const, gradeGroup: "junior_senior" as const, runType: "1000m" as const },
    { gender: "female" as const, gradeGroup: "freshman_sophomore" as const, runType: "800m" as const },
    { gender: "female" as const, gradeGroup: "junior_senior" as const, runType: "800m" as const },
  ];
  const [tableKey, setTableKey] = useState(enduranceTableKey(tableOptions[0]));
  const [editing, setEditing] = useState<EnduranceRule | "new" | null>(null);
  const [deleting, setDeleting] = useState<EnduranceRule | null>(null);
  if (!state) return null;
  const rules = state.enduranceRules.filter((rule) => enduranceTableKey(rule) === tableKey).sort((left, right) => left.minSeconds - right.minSeconds);
  const issues = validateEnduranceTable(rules);
  const optionLabel = (item: typeof tableOptions[number]) => `${adminLabel(locale, "gender", item.gender)} · ${adminLabel(locale, "gradeGroup", item.gradeGroup)} · ${item.runType}`;
  const deleteKey = deleting ? `endurance.delete.${deleting.id}` : "";
  const confirmDelete = async () => {
    if (!deleting) return;
    const result = await run(deleteKey, () => deleteEnduranceRule(deleting.id), adminCopy(locale, "rule_deleted"));
    if (result) setDeleting(null);
  };
  return (
    <section className="admin-surface admin-table-surface">
      <AdminSectionHeading title={adminCopy(locale, "endurance_table")} action={<button className="primary-button" type="button" onClick={() => setEditing("new")}>{adminCopy(locale, "add_rule")}</button>} />
      <div className="admin-filter-row"><AppSelect label={adminCopy(locale, "table_selection")} value={tableKey} options={tableOptions.map((item) => ({ value: enduranceTableKey(item), label: optionLabel(item) }))} onChange={(value) => value && setTableKey(String(value))} /><AdminBadge tone={issues.length ? "red" : "green"}>{issues.length ? adminCopy(locale, "table_invalid", { count: issues.length }) : adminCopy(locale, "table_valid")}</AdminBadge></div>
      {rules.length === 0 ? <AdminEmpty locale={locale} /> : <div className="table-wrap"><table className="admin-table"><thead><tr><th>{adminCopy(locale, "min_seconds")}</th><th>{adminCopy(locale, "max_seconds")}</th><th>{adminCopy(locale, "score")}</th><th>{adminCopy(locale, "tier")}</th><th>{adminCopy(locale, "note")}</th><th>{adminCopy(locale, "actions")}</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id}><td>{rule.minSeconds}</td><td>{rule.maxSeconds}</td><td><b>{rule.score}</b></td><td><AdminBadge tone={rule.tier === "fail" ? "red" : rule.tier === "pass" ? "orange" : "green"}>{adminLabel(locale, "enduranceTier", rule.tier)}</AdminBadge></td><td>{rule.note || adminCopy(locale, "not_available")}</td><td><div className="admin-row-actions"><button type="button" onClick={() => setEditing(rule)}>{adminCopy(locale, "edit")}</button><button className="is-danger" type="button" onClick={() => setDeleting(rule)}>{adminCopy(locale, "delete")}</button></div></td></tr>)}</tbody></table></div>}
      <AdminInlineError message={error?.message} />
      {editing && <RuleDialog locale={locale} tableKey={tableKey} rule={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
      {deleting && <AdminConfirm locale={locale} title={adminCopy(locale, "delete_rule_title")} description={adminCopy(locale, "delete_rule_body")} close={() => setDeleting(null)} confirm={() => void confirmDelete()} confirmLabel={adminCopy(locale, "delete")} busy={busyKey === deleteKey} danger><div className="admin-confirm-object"><b>{adminCopy(locale, "seconds_range", { min: deleting.minSeconds, max: deleting.maxSeconds })}</b><span>{deleting.score} · {adminLabel(locale, "enduranceTier", deleting.tier)}</span></div></AdminConfirm>}
    </section>
  );
}

export function AdminRules({ locale }: { locale: AdminLocale }) {
  const { mode } = useAdminStore();
  if (mode === "real") return <ScoreRulePanel locale={locale} />;
  return (
    <div className="admin-page-stack">
      <EndurancePanel locale={locale} />
    </div>
  );
}

function ScoreRulePanel({ locale }: { locale: AdminLocale }) {
  const [sections, setSections] = useState<ClassSectionProjection[]>([]);
  const [sectionId, setSectionId] = useState("");
  const [rules, setRules] = useState<ScoreRuleProjection[]>([]);
  const [ruleCode, setRuleCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadRules = async (nextSectionId: string) => {
    if (!nextSectionId) {
      setRules([]);
      return;
    }
    setRules(await listScoreRuleProjections(nextSectionId));
  };

  useEffect(() => {
    void (async () => {
      try {
        const next = await listClassSectionProjections();
        const ordered = [...next].sort((left, right) => {
          const priority = { ACTIVE: 0, UPCOMING: 1, CLOSED: 2, ARCHIVED: 3 };
          return priority[left.status] - priority[right.status];
        });
        setSections(ordered);
        const first = ordered[0]?.id ?? "";
        setSectionId(first);
        await loadRules(first);
      } catch (failure) {
        setError(adminApiErrorText(failure, locale));
      } finally {
        setLoading(false);
      }
    })();
  }, [locale]);

  const run = async (key: string, operation: () => Promise<unknown>) => {
    setBusy(key);
    setError("");
    try {
      await operation();
      await loadRules(sectionId);
    } catch (failure) {
      setError(adminApiErrorText(failure, locale));
    } finally {
      setBusy("");
    }
  };

  const create = async () => {
    if (!sectionId || !ruleCode.trim() || !displayName.trim()) {
      setError(locale === "zh" ? "规则代码和显示名称均为必填项。" : "Rule code and display name are required.");
      return;
    }
    await run("create", async () => {
      await createScoreRuleProjection(sectionId, {
        ruleCode: ruleCode.trim(),
        displayName: displayName.trim(),
      });
      setRuleCode("");
      setDisplayName("");
    });
  };

  return (
    <div className="admin-page-stack">
      <aside className="admin-planned-banner">
        {locale === "zh"
          ? "成绩规则已接入服务端固定 TOTAL_ONLY 公式：累计有效运动 20 小时、满分 100 分。规则版本不可在客户端改写公式，激活需要两名不同管理员审批。"
          : "Score rules use the server-owned TOTAL_ONLY formula: 20 valid hours and a 100-point cap. Activation requires two distinct administrators."}
      </aside>
      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={locale === "zh" ? "服务端成绩规则" : "Server score rules"} />
        <div className="admin-filter-row">
          <AppSelect
            label={locale === "zh" ? "教学班" : "Class section"}
            value={sectionId}
            options={sections.map((section) => ({
              value: section.id,
              label: `${section.displayName} · ${section.classCode}`,
            }))}
            onChange={(value) => {
              const next = String(value ?? "");
              setSectionId(next);
              void loadRules(next).catch((failure) =>
                setError(adminApiErrorText(failure, locale)),
              );
            }}
          />
          <button className="text-button" type="button" onClick={() => void loadRules(sectionId)}>
            {locale === "zh" ? "刷新" : "Refresh"}
          </button>
        </div>
        <div className="admin-form-grid two-columns">
          <AdminField locale={locale} label={locale === "zh" ? "规则代码" : "Rule code"} required>
            <input value={ruleCode} onChange={(event) => setRuleCode(event.target.value)} />
          </AdminField>
          <AdminField locale={locale} label={locale === "zh" ? "显示名称" : "Display name"} required>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          </AdminField>
        </div>
        <button className="primary-button" type="button" disabled={busy === "create" || !sectionId} onClick={() => void create()}>
          {busy === "create" ? (locale === "zh" ? "创建中…" : "Creating…") : locale === "zh" ? "创建规则草案" : "Create draft"}
        </button>
        <AdminInlineError message={error} />
        {loading ? null : rules.length === 0 ? (
          <AdminEmpty locale={locale} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead><tr><th>{locale === "zh" ? "规则" : "Rule"}</th><th>{locale === "zh" ? "目标" : "Target"}</th><th>{locale === "zh" ? "状态" : "Status"}</th><th>{locale === "zh" ? "审批" : "Approvals"}</th><th>{adminCopy(locale, "actions")}</th></tr></thead>
              <tbody>{rules.map((rule) => (
                <tr key={rule.id}>
                  <td><b>{rule.displayName}</b><small className="table-sub">{rule.ruleCode} · v{rule.ruleVersion}</small></td>
                  <td>{rule.totalRequiredSeconds / 3600}h · {rule.calculationDefinition.categoryAllocationMode}</td>
                  <td><AdminBadge tone={rule.status === "ACTIVE" ? "green" : rule.status === "REJECTED" ? "red" : "orange"}>{rule.status}</AdminBadge></td>
                  <td>{rule.approvalCount}/2</td>
                  <td><div className="admin-row-actions">
                    {rule.status === "DRAFT" && <button type="button" disabled={busy === rule.id} onClick={() => void run(rule.id, () => submitScoreRuleProjection(rule.id, rule.version))}>{locale === "zh" ? "提交审批" : "Submit"}</button>}
                    {rule.status === "PENDING_APPROVAL" && <button type="button" disabled={busy === rule.id} onClick={() => void run(rule.id, () => approveScoreRuleProjection(rule.id, rule.version))}>{locale === "zh" ? "批准" : "Approve"}</button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
