// Help centre (#31), feedback (#32), about (#33), changelog (#34)
// — help/HelpCenterScreen.kt, feedback/FeedbackScreen.kt,
//   settings/AboutScreen.kt, settings/ChangelogScreen.kt.
// The Mock session has no API repository; these screens reproduce the
// Android demo/offline branches (load failure + retry, submit disabled).

import { t, tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner, emptyPlaceholder, validationPanel, sectionTitle, segmented, tonalButton } from "../ui.js";
import { BUILD } from "../store.js";

const MAX_FEEDBACK_DESCRIPTION = 2000;
const MAX_SCREENSHOTS = 3;

function backTitleRow(action) {
  return `<button class="row pressable" data-action="${action}" style="gap:8px;padding:12px 0 4px;width:100%;color:var(--color-on-surface)">
    ${icon("chevron-left", 24)}<span class="body-large">${tx("返回", "Back")}</span>
  </button>`;
}

// ── #31 Help centre ──

function helpState(app) {
  if (!app.ui.help) {
    app.ui.help = { loading: true, error: null, articles: [], cached: false, query: "", expandedId: null };
    startHelpLoad(app);
  }
  return app.ui.help;
}

function startHelpLoad(app) {
  // Demo/offline session: no help repository and no cache → load failure.
  setTimeout(() => {
    const ui = app.ui.help;
    if (!ui) return;
    ui.loading = false;
    ui.error = tx("帮助内容暂时无法加载，请稍后重试。", "Help content could not be loaded. Try again later.");
    app.render();
  }, 900);
}

export function renderHelpCenter(app) {
  const ui = helpState(app);
  const query = ui.query.trim().toLowerCase();
  const filtered = ui.articles.filter((a) => !query || a.title.toLowerCase().includes(query) || a.content.toLowerCase().includes(query) || a.category.toLowerCase().includes(query));
  const byCategory = new Map();
  for (const article of filtered) {
    const category = article.category || tx("其他", "Other");
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(article);
  }

  let body;
  if (ui.loading) {
    body = `<div class="row" style="justify-content:center;padding:32px 0">${spinner(32)}</div>`;
  } else if (ui.error) {
    body = `${emptyPlaceholder(tx("帮助内容加载失败", "Help content failed to load"), ui.error)}
      <button class="text-btn compact pressable" data-action="help.retry" style="padding:8px 0;align-self:flex-start">${tx("点击重试", "Try again")}</button>`;
  } else if (filtered.length === 0) {
    body = emptyPlaceholder(
      ui.articles.length === 0 ? tx("暂无帮助内容", "No help content") : tx("未找到相关帮助", "No matching help"),
      ui.articles.length === 0 ? tx("管理员尚未发布帮助内容。", "No help content has been published yet.") : tx("请尝试其他关键词。", "Try another keyword.")
    );
  } else {
    body = [...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, articles]) => `
        <div class="title-large text-on-surface">${esc(category)}</div>
        ${articles.map((article) => `<button class="swiss-panel pressable" data-action="help.toggleArticle" data-article-id="${esc(article.id)}" style="text-align:left">
          <div class="row">
            <span class="title-medium text-on-surface grow">${esc(article.title)}</span>
            <span class="text-muted" style="display:inline-flex">${icon(ui.expandedId === article.id ? "expand-less" : "expand-more", 22)}</span>
          </div>
          ${ui.expandedId === article.id ? `<div style="height:12px"></div><div class="body-medium text-muted">${esc(article.content)}</div>` : ""}
        </button>`).join("")}`)
      .join("");
  }

  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="help">
      <div class="col" style="gap:16px">
        ${backTitleRow("support.back")}
        <div class="headline-small text-on-surface">${tx("帮助中心", "Help centre")}</div>
        <div class="help-search">
          <span class="text-muted" style="display:inline-flex">${icon("search", 20)}</span>
          <input type="text" value="${esc(ui.query)}" placeholder="${tx("搜索帮助内容...", "Search help...")}" data-input="help.search" />
        </div>
        ${ui.cached ? `<div class="body-small text-muted">${tx("当前正在显示最近缓存的帮助内容。", "Showing the most recently cached help content.")}</div>` : ""}
        ${body}
        <div style="height:24px"></div>
      </div>
    </div>
  </div>`;
}

// ── #32 Feedback ──

function feedbackState(app) {
  if (!app.ui.feedback) {
    const categories = [
      tx("功能异常", "Feature issue"), tx("打卡问题", "Check-in issue"), tx("成绩问题", "Grade issue"),
      tx("课程问题", "Course issue"), tx("账号问题", "Account issue"), tx("免测/认证", "Exemption or verification"),
      tx("系统故障", "System issue"), tx("其他", "Other"),
    ];
    app.ui.feedback = {
      tab: "new",
      categories,
      selectedCategory: categories[0],
      dropdownOpen: false,
      description: "",
      email: app.state.workspace.student.email || "",
      phone: "",
      screenshots: [],
      tickets: [],
      loadingTickets: false,
      submitting: false,
      error: null,
    };
  }
  return app.ui.feedback;
}

export function renderFeedback(app) {
  const ui = feedbackState(app);
  // Mock/offline session ⇒ repository unavailable ⇒ submission disabled.
  const serviceUnavailable = true;
  const writeEnabled = app.isWriteAllowed() && !serviceUnavailable;
  const formEnabled = writeEnabled && !ui.submitting;

  let body;
  if (ui.tab === "new") {
    body = `
      ${!writeEnabled ? validationPanel(serviceUnavailable
        ? tx("当前为演示或离线模式。你仍可查看反馈表单，但连接服务器并使用正式账户后才能提交。", "You can view the feedback form in demo or offline mode, but submission requires a server connection and a signed-in account.")
        : tx("系统当前为只读模式，暂时无法提交反馈。", "The system is currently read-only; feedback submission is unavailable.")) : ""}
      <div class="swiss-panel"><div class="col" style="gap:12px">
        <span class="title-medium text-on-surface">${tx("问题内容", "Problem details")}</span>
        <span class="body-small text-muted">${tx("请选择问题类型并描述你遇到的情况。", "Choose a category and describe what happened.")}</span>
        <div class="col" style="position:relative">
          <label class="field-label">${tx("问题类型", "Category")}</label>
          <button class="text-field row pressable" data-action="feedback.toggleDropdown" ${formEnabled ? "" : "disabled"} style="justify-content:space-between;text-align:left">
            <span>${esc(ui.selectedCategory)}</span>
            <span class="text-muted" style="display:inline-flex">${icon(ui.dropdownOpen ? "expand-less" : "expand-more", 20)}</span>
          </button>
          ${ui.dropdownOpen ? `<div class="feedback-dropdown">${ui.categories
            .map((category) => `<button class="feedback-dropdown-item pressable" data-action="feedback.selectCategory" data-value="${esc(category)}">${esc(category)}</button>`)
            .join("")}</div>` : ""}
        </div>
        <div class="col">
          <label class="field-label">${tx("问题描述（必填）", "Description (required)")}</label>
          <textarea class="text-field" rows="5" maxlength="${MAX_FEEDBACK_DESCRIPTION}" placeholder="${tx("例如：操作步骤、预期结果和实际情况", "Include the steps, expected result, and actual result")}" data-input="feedback.description" ${formEnabled ? "" : "disabled"}>${esc(ui.description)}</textarea>
          <div class="field-supporting" data-feedback-counter>${ui.description.length}/${MAX_FEEDBACK_DESCRIPTION}</div>
        </div>
      </div></div>
      <div class="swiss-panel"><div class="col" style="gap:12px">
        <span class="title-medium text-on-surface">${tx("截图（可选）", "Screenshots (optional)")}</span>
        <span class="body-small text-muted">${tx(`最多 ${MAX_SCREENSHOTS} 张。截图可帮助我们更快定位问题。`, `Add up to ${MAX_SCREENSHOTS} screenshots to help us diagnose the problem.`)}</span>
        ${ui.screenshots.map((shot, index) => `<div class="row" style="gap:12px">
          <img src="${shot.url}" alt="${tx(`截图 ${index + 1}`, `Screenshot ${index + 1}`)}" style="width:64px;height:64px;object-fit:cover;border-radius:var(--shape-small)">
          <span class="body-medium text-on-surface grow">${tx(`截图 ${index + 1}`, `Screenshot ${index + 1}`)}</span>
          <button class="icon-btn pressable" data-action="feedback.removeShot" data-index="${index}" ${formEnabled ? "" : "disabled"} aria-label="${tx("删除截图", "Remove screenshot")}">${icon("delete", 20)}</button>
        </div>`).join("")}
        <div class="row" style="gap:10px">
          ${tonalButton({ label: tx("拍摄", "Take photo"), iconName: "camera-alt", action: "feedback.takePhoto", disabled: !formEnabled || ui.screenshots.length >= MAX_SCREENSHOTS })}
          ${tonalButton({ label: tx("从相册选择", "Choose photos"), iconName: "photo", action: "feedback.choosePhotos", disabled: !formEnabled || ui.screenshots.length >= MAX_SCREENSHOTS })}
        </div>
        <input type="file" accept="image/*" capture="environment" style="display:none" data-change="feedback.photoPicked" data-feedback-input="camera" />
        <input type="file" accept="image/*" multiple style="display:none" data-change="feedback.photosPicked" data-feedback-input="gallery" />
      </div></div>
      <div class="swiss-panel"><div class="col" style="gap:12px">
        <span class="title-medium text-on-surface">${tx("联系方式", "Contact details")}</span>
        <span class="body-small text-muted">${tx("用于回复和跟进此问题，不会公开展示。", "Used only to reply and follow up. These details are not displayed publicly.")}</span>
        <div class="col">
          <label class="field-label">${tx("邮箱（必填）", "Email (required)")}</label>
          <input class="text-field" type="email" value="${esc(ui.email)}" placeholder="name@example.com" data-input="feedback.email" ${formEnabled ? "" : "disabled"} />
        </div>
        <div class="col">
          <label class="field-label">${tx("联系电话（必填）", "Phone number (required)")}</label>
          <input class="text-field" type="tel" value="${esc(ui.phone)}" placeholder="${tx("例如：138 0000 0000", "e.g. +1 555 0100")}" data-input="feedback.phone" ${formEnabled ? "" : "disabled"} />
        </div>
      </div></div>
      <button class="primary-btn pressable${ui.submitting ? " is-loading" : ""}" data-action="feedback.submit" ${writeEnabled && !ui.submitting ? "" : "disabled"}>
        ${ui.submitting ? spinner(18, "on-primary") : icon("send", 20)}<span>${tx("提交问题", "Submit report")}</span>
      </button>`;
  } else {
    body = `
      ${ui.loadingTickets
        ? `<div class="row" style="justify-content:center">${spinner(28)}</div>`
        : ui.tickets.length === 0
          ? emptyPlaceholder(tx("暂无已提交问题", "No reports yet"), tx("提交问题后，可在这里查看处理状态。", "After submitting a report, you can track its status here."))
          : ""}
      ${tonalButton({ label: tx("刷新处理状态", "Refresh status"), iconName: "refresh", action: "feedback.refreshTickets", disabled: ui.loadingTickets || serviceUnavailable })}`;
  }

  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="feedback">
      <div class="col" style="gap:16px">
        ${backTitleRow("support.back")}
        ${sectionTitle(tx("问题反馈", "Report a problem"))}
        ${segmented({
          items: [
            { value: "new", label: tx("提交问题", "New report") },
            { value: "tickets", label: tx("我的反馈", "My reports") },
          ],
          selected: ui.tab,
          action: "feedback.tab",
        })}
        ${ui.error ? validationPanel(ui.error) : ""}
        ${body}
        <div style="height:24px"></div>
      </div>
    </div>
  </div>`;
}

// ── #33 About / #34 Changelog ──

export function renderAbout(app) {
  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="about">
      <div class="col" style="gap:16px">
        ${backTitleRow("support.back")}
        <div class="headline-small text-on-surface">${t("profile_about")}</div>
        <div class="swiss-panel">
          <div class="title-large text-on-surface">${t("app_name")}</div>
          <div style="height:8px"></div>
          <div class="body-medium text-muted">${t("profile_version")} ${BUILD.VERSION_NAME}</div>
        </div>
        <button class="swiss-panel pressable" data-action="support.openChangelog" style="text-align:left">
          <div class="row" style="gap:12px">
            <span class="text-primary" style="display:inline-flex">${icon("refresh", 20)}</span>
            <span class="title-medium text-on-surface grow">${t("profile_changelog")}</span>
            <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 20)}</span>
          </div>
        </button>
      </div>
    </div>
  </div>`;
}

export function renderChangelog(app) {
  const items = [t("changelog_feature_core"), t("changelog_feature_support"), t("changelog_feature_offline")];
  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="changelog">
      <div class="col" style="gap:16px">
        ${backTitleRow("support.changelogBack")}
        <div class="headline-small text-on-surface">${t("changelog_title")}</div>
        <div class="swiss-panel">
          <div class="title-large text-on-surface">${BUILD.VERSION_NAME}</div>
          <div style="height:4px"></div>
          <div class="label-large text-primary">${t("changelog_initial_release")}</div>
          <div style="height:14px"></div>
          ${items.map((text) => `<div class="row" style="align-items:flex-start;margin-bottom:10px">
            <span class="body-medium text-primary">•</span>
            <span style="width:8px"></span>
            <span class="body-medium text-muted grow">${esc(text)}</span>
          </div>`).join("")}
        </div>
        <div style="height:24px"></div>
      </div>
    </div>
  </div>`;
}

export const supportActions = {
  "support.back": (app) => app.handleBack(),
  "support.openChangelog": (app) => app.openSub("changelog"),
  "support.changelogBack": (app) => {
    app.navDirection = "back";
    app.openSub("about");
  },
  // — Help —
  "help.retry": (app) => {
    const ui = helpState(app);
    ui.loading = true;
    ui.error = null;
    app.render();
    startHelpLoad(app);
  },
  "help.search": (app, el) => {
    const ui = helpState(app);
    ui.query = el.value;
    if (!ui.loading && !ui.error) app.render();
  },
  "help.toggleArticle": (app, el) => {
    const ui = helpState(app);
    ui.expandedId = ui.expandedId === el.dataset.articleId ? null : el.dataset.articleId;
    app.render();
  },
  // — Feedback —
  "feedback.tab": (app, el) => {
    const ui = feedbackState(app);
    ui.tab = el.dataset.value;
    ui.error = null;
    if (ui.tab === "tickets" && ui.tickets.length === 0) {
      // Demo/offline branch: ticket history is unavailable.
      ui.error = tx("演示或离线模式下暂时无法加载反馈记录。", "Feedback history is unavailable in demo or offline mode.");
    }
    app.render();
  },
  "feedback.toggleDropdown": (app) => {
    const ui = feedbackState(app);
    ui.dropdownOpen = !ui.dropdownOpen;
    app.render();
  },
  "feedback.selectCategory": (app, el) => {
    const ui = feedbackState(app);
    ui.selectedCategory = el.dataset.value;
    ui.dropdownOpen = false;
    app.render();
  },
  "feedback.description": (app, el) => {
    const ui = feedbackState(app);
    ui.description = el.value.slice(0, MAX_FEEDBACK_DESCRIPTION);
    const counter = app._viewport?.querySelector("[data-feedback-counter]");
    if (counter) counter.textContent = `${ui.description.length}/${MAX_FEEDBACK_DESCRIPTION}`;
  },
  "feedback.email": (app, el) => { feedbackState(app).email = el.value; },
  "feedback.phone": (app, el) => { feedbackState(app).phone = el.value; },
  "feedback.takePhoto": (app) => app._viewport?.querySelector('[data-feedback-input="camera"]')?.click(),
  "feedback.choosePhotos": (app) => app._viewport?.querySelector('[data-feedback-input="gallery"]')?.click(),
  "feedback.photoPicked": (app, el) => {
    const ui = feedbackState(app);
    const file = el.files?.[0];
    el.value = "";
    if (file && ui.screenshots.length < MAX_SCREENSHOTS) {
      ui.screenshots.push({ url: URL.createObjectURL(file), name: file.name });
      app.render();
    }
  },
  "feedback.photosPicked": (app, el) => {
    const ui = feedbackState(app);
    const files = [...(el.files || [])].slice(0, Math.max(0, MAX_SCREENSHOTS - ui.screenshots.length));
    el.value = "";
    for (const file of files) ui.screenshots.push({ url: URL.createObjectURL(file), name: file.name });
    app.render();
  },
  "feedback.removeShot": (app, el) => {
    const ui = feedbackState(app);
    const shot = ui.screenshots[Number(el.dataset.index)];
    if (shot?.url.startsWith("blob:")) URL.revokeObjectURL(shot.url);
    ui.screenshots.splice(Number(el.dataset.index), 1);
    app.render();
  },
  "feedback.submit": (app) => {
    const ui = feedbackState(app);
    // Demo/offline branch mirrors the Android repository == null error.
    ui.error = tx("演示或离线模式下暂时无法提交反馈，请连接服务器并使用正式账户后重试。", "Feedback cannot be submitted in demo or offline mode. Connect to the server with a signed-in account and try again.");
    app.render();
  },
  "feedback.refreshTickets": (app) => {
    const ui = feedbackState(app);
    ui.error = tx("演示或离线模式下暂时无法加载反馈记录。", "Feedback history is unavailable in demo or offline mode.");
    app.render();
  },
};
