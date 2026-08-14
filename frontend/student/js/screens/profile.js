// Profile tab (#26), account details (#27) and settings (#28)
// — feature/profile/ProfileScreen.kt, AccountDetailsScreen.kt.

import { t, tx, getLanguage, currentLocale } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, brandMark, sectionTitle, statusBadge, emptyPlaceholder, segmented } from "../ui.js";
import { localStore } from "../store.js";

function localizedGradeLabel(student) {
  switch (student.gradeLevel) {
    case "freshman": return tx("大一", "Year 1");
    case "sophomore": return tx("大二", "Year 2");
    case "junior": return tx("大三", "Year 3");
    case "senior": return tx("大四", "Year 4");
    default: return student.gradeLevel;
  }
}

function displayDate(value) {
  const raw = value.slice(0, 10);
  const [year, month, day] = raw.split("-").map(Number);
  if (!year || !month || !day) return raw;
  // Construct as local time so a date-only string never shifts by timezone.
  return new Date(year, month - 1, day).toLocaleDateString(currentLocale(), { year: "numeric", month: "short", day: "numeric" });
}

// ── #26 Profile tab ──

function serviceShortcut({ title, description, iconName, action }) {
  return `<button class="service-shortcut pressable" data-action="${action}">
    <span class="service-shortcut-icon">${icon(iconName, 21)}</span>
    <div class="col" style="gap:4px;text-align:left;min-width:0">
      <span class="title-small text-on-surface ellipsis">${esc(title)}</span>
      <span class="label-medium text-muted ellipsis">${esc(description)}</span>
    </div>
  </button>`;
}

export function renderProfile(app) {
  const workspace = app.state.workspace;
  const student = workspace.student;
  const grade = localizedGradeLabel(student) || t("profile_pending_calculation");

  const header = `<div class="col" style="gap:14px">
    <div class="row">
      <span class="headline-large text-on-surface grow">${t("profile_heading")}</span>
      <button class="icon-btn pressable" data-action="profile.openSettings" aria-label="${t("profile_settings")}">${icon("settings", 24)}</button>
    </div>
    <button class="swiss-panel pressable" data-action="profile.openAccount" style="text-align:left" aria-label="${t("profile_account_details")}">
      <div class="col" style="gap:18px">
        <div class="row" style="gap:14px">
          ${brandMark(true)}
          <span class="headline-small text-on-surface grow ellipsis">${esc(student.name)}</span>
          ${statusBadge(student.status, true)}
          <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 20)}</span>
        </div>
        <div class="profile-facts">
          <div class="col grow" style="gap:3px"><span class="label-small text-muted">${t("profile_student_id_short")}</span><span class="label-medium text-on-surface ellipsis">${esc(student.id)}</span></div>
          <div class="col grow" style="gap:3px"><span class="label-small text-muted">${t("profile_class_short")}</span><span class="label-medium text-on-surface ellipsis">${esc(student.className || "—")}</span></div>
          <div class="col grow" style="gap:3px"><span class="label-small text-muted">${t("profile_grade_short")}</span><span class="label-medium text-on-surface ellipsis">${esc(grade)}</span></div>
        </div>
      </div>
    </button>
  </div>`;

  const services = `<div class="col" style="gap:12px">
    ${sectionTitle(t("profile_services_title"))}
    <div class="row" style="gap:12px;align-items:stretch">
      ${serviceShortcut({ title: t("profile_exemption"), description: t("profile_exemption_short_hint"), iconName: "fitness-center", action: "profile.openExemption" })}
      ${serviceShortcut({ title: t("profile_endurance"), description: t("profile_endurance_short_hint"), iconName: "timer", action: "profile.openEndurance" })}
    </div>
  </div>`;

  const teachers = workspace.teachers;
  const teacherPanel = teachers.length === 0 ? "" : `<div class="col" style="gap:12px">
    ${sectionTitle(t("profile_teacher_title"))}
    <div class="swiss-panel">
      ${teachers
        .map(
          (teacher, index) => `${index > 0 ? '<div class="course-divider"></div>' : ""}
          <div class="row" style="padding:12px 0;gap:12px">
            <span class="text-primary" style="display:inline-flex;flex:none">${icon("check-circle", 22)}</span>
            <div class="col grow" style="gap:4px">
              <span class="title-medium text-on-surface">${esc(teacher.teacherName)}</span>
              <span class="label-medium text-muted">${t("profile_teacher_role")}</span>
            </div>
          </div>`
        )
        .join("")}
    </div>
  </div>`;

  const memberships = workspace.memberships;
  const identityPanel = `<div class="col" style="gap:12px">
    ${sectionTitle(t("profile_identity_title"))}
    ${memberships.length === 0
      ? emptyPlaceholder(t("profile_no_memberships"), t("profile_no_memberships_hint"))
      : `<div class="swiss-panel">${memberships
          .map(
            (membership, index) => `${index > 0 ? '<div class="course-divider"></div>' : ""}
            <div class="col" style="gap:12px;padding:12px 0">
              <div class="col" style="gap:6px">
                <span class="title-medium text-on-surface">${esc(`${membership.type === "team" ? "校队" : "社团"} · ${membership.organization}`)}</span>
                <span class="label-medium text-muted">${t("profile_valid_until", displayDate(membership.validUntil))}</span>
                <div class="row" style="gap:8px">
                  ${statusBadge(membership.status, membership.status === "认证有效")}
                  <span class="label-medium text-primary">${t("profile_offset", esc(membership.offset))}</span>
                </div>
              </div>
              ${membership.comment && membership.comment !== "offset" ? `<div class="membership-comment">
                <span class="text-primary" style="display:inline-flex;flex:none">${icon("notifications", 16)}</span>
                <span class="body-medium text-muted grow">${esc(membership.comment)}</span>
              </div>` : ""}
            </div>`
          )
          .join("")}</div>`}
  </div>`;

  return `<div class="tab-content col" style="gap:24px">
    ${header}
    ${services}
    ${teacherPanel}
    ${identityPanel}
    <div style="height:40px"></div>
  </div>`;
}

// ── #27 Account details ──

function accountDetailRow(label, value) {
  return `<div class="row" style="align-items:flex-start">
    <span class="body-medium text-muted" style="flex:none">${esc(label)}</span>
    <span style="width:12px"></span>
    <span class="body-medium text-on-surface grow" style="text-align:right">${esc(value)}</span>
  </div>`;
}

export function renderAccountDetails(app) {
  const student = app.state.workspace.student;
  const grade = localizedGradeLabel(student) || t("profile_pending_calculation");
  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="account-details">
      <div class="col" style="gap:16px">
        <button class="row pressable" data-action="profile.subBack" style="gap:8px;padding:12px 0 4px;width:100%;color:var(--color-on-surface)">
          ${icon("chevron-left", 24)}<span class="body-large">${t("common_back")}</span>
        </button>
        <div class="headline-small text-on-surface">${t("profile_account_details")}</div>
        <div class="swiss-panel">
          <div class="row" style="gap:14px">
            ${brandMark(true)}
            <span class="title-large text-on-surface grow ellipsis">${esc(student.name)}</span>
            ${statusBadge(student.status, true)}
          </div>
        </div>
        <div class="swiss-panel"><div class="col" style="gap:14px">
          ${accountDetailRow(t("profile_name"), student.name)}
          ${accountDetailRow(t("profile_student_id"), student.id)}
          ${accountDetailRow(t("profile_class"), student.className)}
          ${accountDetailRow(t("profile_admission_year"), student.admissionYear ? String(student.admissionYear) : t("profile_pending"))}
          ${accountDetailRow(t("profile_current_grade"), grade)}
          ${student.currentAcademicYear ? accountDetailRow(t("profile_calculation_year"), student.currentAcademicYear) : ""}
        </div></div>
      </div>
    </div>
  </div>`;
}

// ── #28 Settings ──

function navigationRow(title, iconName, action, last = false) {
  return `<button class="settings-row pressable" data-action="${action}">
      <span class="text-primary" style="display:inline-flex;flex:none">${icon(iconName, 20)}</span>
      <span style="width:10px"></span>
      <span class="body-medium text-on-surface grow" style="text-align:left">${esc(title)}</span>
      <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 18)}</span>
    </button>${last ? "" : '<div class="course-divider"></div>'}`;
}

export function renderSettings(app) {
  const themeMode = localStore.getThemeMode();
  const language = getLanguage();
  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="settings">
      <div class="col" style="gap:16px">
        <button class="row pressable" data-action="profile.settingsBack" style="gap:8px;padding:12px 0 4px;width:100%;color:var(--color-on-surface)">
          ${icon("chevron-left", 24)}<span class="body-large">${t("common_back")}</span>
        </button>
        <div class="headline-small text-on-surface">${t("profile_settings")}</div>

        <div class="swiss-panel">
          <div class="title-medium text-on-surface" style="padding-bottom:4px">${t("profile_account_security")}</div>
          ${navigationRow(t("profile_login_contacts"), "email", "profile.openBinding", true)}
        </div>

        <div class="swiss-panel"><div class="col" style="gap:12px">
          <div class="title-medium text-on-surface">${t("profile_preferences")}</div>
          <div class="title-medium text-on-surface">${t("profile_appearance")}</div>
          ${segmented({
            items: [
              { value: "light", label: t("theme_light") },
              { value: "dark", label: t("theme_dark") },
              { value: "system", label: t("theme_system") },
            ],
            selected: themeMode,
            action: "profile.theme",
          })}
          <div class="body-small text-muted">${t("profile_appearance_hint")}</div>
          <div class="course-divider"></div>
          <div class="title-medium text-on-surface">${t("profile_language")}</div>
          ${segmented({
            items: [
              { value: "zh", label: t("profile_chinese") },
              { value: "en", label: t("profile_english") },
            ],
            selected: language,
            action: "profile.language",
          })}
          <div class="body-small text-muted">${t("profile_language_hint")}</div>
        </div></div>

        <div class="swiss-panel">
          <div class="title-medium text-on-surface" style="padding-bottom:4px">${t("profile_help_support")}</div>
          ${navigationRow(t("profile_help_center"), "help-outline", "profile.openHelp")}
          ${navigationRow(t("profile_privacy"), "fitness-center", "profile.openPrivacy")}
          ${navigationRow(t("profile_feedback"), "notifications", "profile.openFeedback")}
          ${navigationRow(t("profile_about"), "info-outline", "profile.openAbout", true)}
        </div>

        <button class="logout-card pressable" data-action="profile.logoutConfirm">
          <span class="text-error" style="display:inline-flex">${icon("close", 20)}</span>
          <span class="title-medium grow" style="color:var(--color-on-error-container);text-align:left">${t("profile_logout")}</span>
          <span class="text-error" style="display:inline-flex">${icon("chevron-right", 20)}</span>
        </button>
        <div style="height:40px"></div>
      </div>
    </div>
  </div>`;
}

export const profileActions = {
  "profile.openSettings": (app) => app.openSub("settings"),
  "profile.openAccount": (app) => app.openSub("account"),
  "profile.openExemption": (app) => app.openSub("exemption", { targetId: null }),
  "profile.openEndurance": (app) => {
    app.ui.endurance = null;
    app.openSub("endurance");
  },
  "profile.subBack": (app) => app.closeSub(),
  "profile.settingsBack": (app) => app.closeSub(),
  "profile.openBinding": (app) => {
    app.ui.binding = null;
    app.openSub("binding");
  },
  "profile.openHelp": (app) => {
    app.ui.help = null;
    app.openSub("help");
  },
  "profile.openPrivacy": (app) => app.openSub("privacy"),
  "profile.openFeedback": (app) => {
    app.ui.feedback = null;
    app.openSub("feedback");
  },
  "profile.openAbout": (app) => app.openSub("about"),
  "profile.theme": (app, el) => {
    app.setThemeMode(el.dataset.value);
  },
  "profile.language": (app, el) => {
    if (el.dataset.value !== getLanguage()) app.setAppLanguage(el.dataset.value);
  },
  "profile.logoutConfirm": (app) => {
    app.showDialog({
      title: t("profile_logout"),
      body: t("profile_logout_confirmation_message"),
      buttons: [
        { label: t("common_cancel"), action: "dialog.close" },
        { label: t("profile_logout"), action: "profile.logout" },
      ],
    });
  },
  "profile.logout": (app) => {
    app.state.dialog = null;
    app.logout();
  },
};
