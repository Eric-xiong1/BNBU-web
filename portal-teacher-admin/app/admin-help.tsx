"use client";

import { useEffect, useState } from "react";
import { AppSelect } from "./app-select";
import { pageItems } from "./admin-domain";
import { adminCopy, adminLabel } from "./admin-i18n";
import { saveHelpArticle, transitionHelpArticle } from "./admin-service";
import { useAdminStore } from "./admin-store";
import type { AdminLocale, HelpArticle, HelpArticleInput, HelpArticleStatus } from "./admin-types";
import { AdminBadge, AdminConfirm, AdminDialog, AdminEmpty, AdminField, AdminInlineError, AdminPagination, AdminSectionHeading, formatAdminDate, type AdminTone } from "./admin-components";

type HelpFilter = "all" | HelpArticleStatus;
const categories = ["login", "enrollment", "checkin", "evidence", "course", "exemption", "organization", "notification", "maintenance", "feedback"] as const;

function categoryLabel(locale: AdminLocale, category: string) {
  const labels: Record<string, [string, string]> = {
    login: ["登录与验证码", "Sign-in & verification codes"], enrollment: ["加入课程与补正", "Enrollment & corrections"], checkin: ["打卡与学时", "Check-ins & credits"], evidence: ["凭证上传", "Evidence upload"], course: ["课程与成绩", "Classes & grades"], exemption: ["免测", "Exemptions"], organization: ["组织认证", "Organization verification"], notification: ["通知", "Notifications"], maintenance: ["维护期间操作", "Maintenance operations"], feedback: ["服务反馈", "Service feedback"],
  };
  const pair = labels[category] ?? [category, category];
  return pair[locale === "en" ? 1 : 0];
}

function statusTone(status: HelpArticleStatus): AdminTone {
  return status === "published" ? "green" : status === "draft" ? "orange" : "gray";
}

function ArticleDialog({ locale, article, close }: { locale: AdminLocale; article?: HelpArticle; close: () => void }) {
  const { busyKey, error, clearError, run } = useAdminStore();
  const initial: HelpArticleInput = article ? {
    id: article.id,
    titleZh: article.titleZh,
    titleEn: article.titleEn,
    bodyZh: article.bodyZh,
    bodyEn: article.bodyEn,
    keywords: article.keywords,
    category: article.category,
    status: article.status,
    sortWeight: article.sortWeight,
    expectedUpdatedAt: article.updatedAt,
  } : { titleZh: "", titleEn: "", bodyZh: "", bodyEn: "", keywords: [], category: "login", status: "draft", sortWeight: 0 };
  const [form, setForm] = useState<HelpArticleInput>(initial);
  const [keywordText, setKeywordText] = useState(initial.keywords.join(", "));
  const [previewLocale, setPreviewLocale] = useState<AdminLocale>(locale);
  const key = `help.save.${article?.id ?? "new"}`;
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || keywordText !== initial.keywords.join(", ");
  useEffect(() => () => clearError(), [clearError]);
  const update = <K extends keyof HelpArticleInput>(field: K, value: HelpArticleInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (status: HelpArticleStatus) => {
    const result = await run(key, () => saveHelpArticle({ ...form, status, keywords: keywordText.split(/[,，]/).map((item) => item.trim()).filter(Boolean) }), adminCopy(locale, "article_saved"));
    if (result) close();
  };
  return (
    <AdminDialog locale={locale} title={adminCopy(locale, article ? "edit_article" : "create_article")} description={adminCopy(locale, "help_audience")} close={close} dirty={dirty} wide footer={<>
      <button className="secondary-button" type="button" onClick={close}>{adminCopy(locale, "cancel")}</button>
      {!article && <button className="secondary-button" type="button" disabled={busyKey === key} onClick={() => void submit("draft")}>{adminCopy(locale, "save_draft")}</button>}
      {article && <button className="secondary-button" type="button" disabled={busyKey === key} onClick={() => void submit(article.status)}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, "save")}</button>}
      {(!article || article.status === "draft" || article.status === "archived") && <button className="primary-button" type="button" disabled={busyKey === key} onClick={() => void submit("published")}>{busyKey === key ? adminCopy(locale, "processing") : adminCopy(locale, article?.status === "archived" ? "republish" : "save_publish")}</button>}
    </>}>
      <div className="admin-article-editor">
        <div className="admin-form-grid two-columns">
          <AdminField locale={locale} label={adminCopy(locale, "title_chinese")} required errorCode={error?.fieldErrors.titleZh}><input value={form.titleZh} onChange={(event) => update("titleZh", event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "title_english")} required errorCode={error?.fieldErrors.titleEn}><input value={form.titleEn} onChange={(event) => update("titleEn", event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "body_chinese")} required errorCode={error?.fieldErrors.bodyZh}><textarea className="admin-article-body" value={form.bodyZh} onChange={(event) => update("bodyZh", event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "body_english")} required errorCode={error?.fieldErrors.bodyEn}><textarea className="admin-article-body" value={form.bodyEn} onChange={(event) => update("bodyEn", event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "keywords")} required errorCode={error?.fieldErrors.keywords}><input value={keywordText} onChange={(event) => setKeywordText(event.target.value)} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "category")} required errorCode={error?.fieldErrors.category}><AppSelect label={adminCopy(locale, "category")} value={form.category} options={categories.map((value) => ({ value, label: categoryLabel(locale, value) }))} onChange={(value) => value && update("category", String(value))} /></AdminField>
          <AdminField locale={locale} label={adminCopy(locale, "sort_weight")} required errorCode={error?.fieldErrors.sortWeight}><input type="number" value={form.sortWeight} onChange={(event) => update("sortWeight", Number(event.target.value))} /></AdminField>
        </div>
        <section className="admin-article-preview">
          <div><h3>{adminCopy(locale, "preview")}</h3><div className="admin-view-tabs compact"><button type="button" className={previewLocale === "zh" ? "selected" : ""} onClick={() => setPreviewLocale("zh")}>中文</button><button type="button" className={previewLocale === "en" ? "selected" : ""} onClick={() => setPreviewLocale("en")}>English</button></div></div>
          <article><h2>{previewLocale === "en" ? form.titleEn : form.titleZh}</h2><p>{previewLocale === "en" ? form.bodyEn : form.bodyZh}</p></article>
        </section>
      </div>
      <AdminInlineError message={error?.message} />
    </AdminDialog>
  );
}

export function AdminHelp({ locale }: { locale: AdminLocale }) {
  const { state, busyKey, run } = useAdminStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<HelpFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<HelpArticle | "new" | null>(null);
  const [transition, setTransition] = useState<{ article: HelpArticle; nextStatus: "published" | "archived" } | null>(null);
  if (!state) return null;
  const query = search.trim().toLowerCase();
  const filtered = state.helpArticles.filter((article) => (statusFilter === "all" || article.status === statusFilter)
    && (categoryFilter === "all" || article.category === categoryFilter)
    && (!query || [article.titleZh, article.titleEn, ...article.keywords].some((value) => value.toLowerCase().includes(query))))
    .sort((left, right) => right.sortWeight - left.sortWeight || right.updatedAt.localeCompare(left.updatedAt));
  const paged = pageItems(filtered, page, 5);
  const published = state.helpArticles.filter((article) => article.status === "published").length;
  const drafts = state.helpArticles.filter((article) => article.status === "draft").length;
  const archived = state.helpArticles.filter((article) => article.status === "archived").length;
  const transitionKey = transition ? `help.transition.${transition.article.id}` : "";
  const confirmTransition = async () => {
    if (!transition) return;
    const result = await run(transitionKey, () => transitionHelpArticle(transition.article.id, transition.nextStatus), adminCopy(locale, transition.nextStatus === "published" ? "article_published" : "article_archived"));
    if (result) setTransition(null);
  };
  return (
    <div className="admin-page-stack">
      <section className="admin-summary-grid three">
        <button type="button" onClick={() => { setStatusFilter("published"); setPage(1); }}><span>{adminLabel(locale, "helpStatus", "published")}</span><b>{published}</b><small>{adminCopy(locale, "help_audience")}</small></button>
        <button type="button" onClick={() => { setStatusFilter("draft"); setPage(1); }}><span>{adminLabel(locale, "helpStatus", "draft")}</span><b>{drafts}</b><small>{adminCopy(locale, "content_incomplete")}</small></button>
        <button type="button" onClick={() => { setStatusFilter("archived"); setPage(1); }}><span>{adminLabel(locale, "helpStatus", "archived")}</span><b>{archived}</b><small>{adminCopy(locale, "republish")}</small></button>
      </section>
      <section className="admin-surface admin-table-surface">
        <AdminSectionHeading title={adminCopy(locale, "help_articles")} description={adminCopy(locale, "help_audience")} action={<button className="primary-button" type="button" onClick={() => setEditing("new")}>{adminCopy(locale, "create_article")}</button>} />
        <div className="admin-filter-row">
          <label className="admin-search"><span aria-hidden="true">⌕</span><input value={search} placeholder={adminCopy(locale, "help_search")} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <AppSelect label={adminCopy(locale, "article_status_filter")} value={statusFilter} options={[{ value: "all", label: adminCopy(locale, "all") }, ...(["published", "draft", "archived"] as HelpArticleStatus[]).map((value) => ({ value, label: adminLabel(locale, "helpStatus", value) }))]} onChange={(value) => { if (value) { setStatusFilter(value as HelpFilter); setPage(1); } }} />
          <AppSelect label={adminCopy(locale, "category_filter")} value={categoryFilter} options={[{ value: "all", label: adminCopy(locale, "all") }, ...categories.map((value) => ({ value, label: categoryLabel(locale, value) }))]} onChange={(value) => { if (value) { setCategoryFilter(String(value)); setPage(1); } }} />
          {(search || statusFilter !== "all" || categoryFilter !== "all") && <button className="text-button" type="button" onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); setPage(1); }}>{adminCopy(locale, "clear_filters")}</button>}
        </div>
        {paged.items.length === 0 ? <AdminEmpty locale={locale} filtered /> : <div className="admin-article-list">{paged.items.map((article) => <article key={article.id}><div><span><AdminBadge tone={statusTone(article.status)}>{adminLabel(locale, "helpStatus", article.status)}</AdminBadge><small>{categoryLabel(locale, article.category)} · {formatAdminDate(locale, article.updatedAt, true)}</small></span><h3>{locale === "en" ? article.titleEn : article.titleZh}</h3><p>{locale === "en" ? article.bodyEn : article.bodyZh}</p><div>{article.keywords.map((keyword) => <i key={keyword}>{keyword}</i>)}</div></div><aside><button className="secondary-button" type="button" onClick={() => setEditing(article)}>{adminCopy(locale, "edit")}</button>{article.status === "draft" && <button className="primary-button" type="button" onClick={() => setTransition({ article, nextStatus: "published" })}>{adminCopy(locale, "publish")}</button>}{article.status === "published" && <button className="danger-button" type="button" onClick={() => setTransition({ article, nextStatus: "archived" })}>{adminCopy(locale, "take_offline")}</button>}{article.status === "archived" && <button className="primary-button" type="button" onClick={() => setTransition({ article, nextStatus: "published" })}>{adminCopy(locale, "republish")}</button>}</aside></article>)}</div>}
        <AdminPagination locale={locale} page={paged.page} totalPages={paged.totalPages} total={paged.total} onPage={setPage} />
      </section>
      {editing && <ArticleDialog locale={locale} article={editing === "new" ? undefined : editing} close={() => setEditing(null)} />}
      {transition && <AdminConfirm locale={locale} title={adminCopy(locale, transition.nextStatus === "published" ? "publish" : "take_offline")} description={transition.nextStatus === "published" ? adminCopy(locale, "help_audience") : adminCopy(locale, "article_archived")} close={() => setTransition(null)} confirm={() => void confirmTransition()} confirmLabel={adminCopy(locale, transition.nextStatus === "published" ? "publish" : "take_offline")} busy={busyKey === transitionKey} danger={transition.nextStatus === "archived"}><div className="admin-confirm-object"><b>{locale === "en" ? transition.article.titleEn : transition.article.titleZh}</b><span>{adminLabel(locale, "helpStatus", transition.article.status)} → {adminLabel(locale, "helpStatus", transition.nextStatus)}</span></div></AdminConfirm>}
    </div>
  );
}
