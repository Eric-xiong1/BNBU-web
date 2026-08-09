// Login method chooser (#5) — feature/login/LoginScreen.kt

import { t, tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, universityLockup } from "../ui.js";
import { apiErrorText } from "../api.js";

function loginMethodButton({ title, subtitle, iconName, primary, enabled, action }) {
  const stateCls = !enabled ? "is-disabled" : primary ? "is-primary" : "is-plain";
  return `<button class="login-method pressable ${stateCls}" data-action="${action}" ${enabled ? "" : "disabled"}>
    <span class="login-method-icon">${icon(iconName, 19)}</span>
    <span class="col grow" style="text-align:left">
      <span class="title-medium">${title}</span>
      <span class="body-small login-method-sub">${subtitle}</span>
    </span>
    ${icon("chevron-right", 19, "login-method-chevron")}
  </button>`;
}

export function renderLogin(app) {
  const accepted = app.state.loginPrivacyAccepted;
  // Present only when the preview server has a demo account provisioned.
  const demo = app.state.demoAccount;
  const ui = app.ui.login || (app.ui.login = { demoSigningIn: false, demoError: null });
  return `<div class="screen login-screen">
    <div class="screen-scroll" data-scroll-key="login">
      <div class="auth-column">
        ${universityLockup()}
        <div style="height:40px"></div>
        <div class="headline-large" style="color:var(--color-on-background);font-weight:600">${t("login_title")}</div>
        <div style="height:10px"></div>
        <div class="body-large text-muted">${t("login_subtitle")}</div>
        <div style="height:32px"></div>
        <div class="swiss-panel" style="padding:20px">
          <div class="title-large text-on-surface">${t("login_choose_method")}</div>
          <div style="height:20px"></div>
          <div class="privacy-consent-row">
            <input type="checkbox" id="login-privacy-check" class="checkbox" data-change="login.privacyToggle" ${accepted ? "checked" : ""} />
            <label for="login-privacy-check" class="col grow" style="padding-top:2px;gap:0">
              <span class="body-medium text-on-surface">${t("login_privacy_prefix")} <button class="privacy-link" data-action="login.openPrivacy">${t("login_privacy_policy")}</button></span>
              ${accepted ? "" : `<span class="body-small text-muted" style="padding-top:4px">${t("login_privacy_required")}</span>`}
            </label>
          </div>
          <div style="height:24px"></div>
          ${loginMethodButton({ title: t("login_email_button"), subtitle: t("login_email_hint"), iconName: "email", primary: true, enabled: accepted, action: "login.email" })}
          <div style="height:12px"></div>
          ${loginMethodButton({ title: t("login_phone_button"), subtitle: t("login_phone_hint"), iconName: "smartphone", primary: false, enabled: accepted, action: "login.phone" })}
          <div class="login-divider"></div>
          <div class="label-large text-muted" style="font-weight:500;padding:28px 0 12px">${t("login_other_methods")}</div>
          ${loginMethodButton({ title: t("login_scan_button"), subtitle: t("login_scan_hint"), iconName: "qr-code-scanner", primary: false, enabled: accepted, action: "login.scan" })}
          ${demo ? `
            <div style="height:12px"></div>
            ${loginMethodButton({
              title: t("login_demo_button"),
              subtitle: tx(`${demo.fullName} · ${demo.studentNumber} · 数据来自后端`, `${demo.fullName} · ${demo.studentNumber} · live backend data`),
              iconName: "person",
              primary: false,
              enabled: accepted && !ui.demoSigningIn,
              action: "login.demo",
            })}
            ${ui.demoError ? `<div class="body-small text-error" style="padding-top:8px">${esc(ui.demoError)}</div>` : ""}` : ""}
        </div>
        <div style="height:12px"></div>
        <button class="text-btn pressable" data-action="login.recovery" style="align-self:center;min-height:48px;padding:10px 4px;margin:0 auto;display:flex">
          <span class="label-large">${t("login_recovery")}</span>
        </button>
      </div>
    </div>
  </div>`;
}

export const loginActions = {
  "login.privacyToggle": (app, el) => {
    app.state.loginPrivacyAccepted = el.checked;
    app.render();
  },
  "login.openPrivacy": (app, el, event) => {
    event.preventDefault();
    app.state.showLoginPrivacy = true;
    app.navDirection = "forward";
    app.render();
  },
  "login.email": (app) => { app.state.showEmailLogin = true; app.ui.verification = null; app.navDirection = "forward"; app.render(); },
  "login.phone": (app) => { app.state.showPhoneLogin = true; app.ui.verification = null; app.navDirection = "forward"; app.render(); },
  "login.scan": (app) => { app.state.showScanJoin = true; app.ui.scan = null; app.navDirection = "forward"; app.render(); },
  "login.recovery": (app) => { app.state.showRecoveryRequest = true; app.ui.recovery = null; app.navDirection = "forward"; app.render(); },
  "login.demo": async (app) => {
    const ui = app.ui.login || (app.ui.login = { demoSigningIn: false, demoError: null });
    if (ui.demoSigningIn) return;
    ui.demoSigningIn = true;
    ui.demoError = null;
    app.render();
    try {
      await app.loginDemoUser();
    } catch (error) {
      ui.demoSigningIn = false;
      ui.demoError = apiErrorText(error);
      app.render();
    }
  },
};
