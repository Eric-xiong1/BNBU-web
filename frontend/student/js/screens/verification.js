// Email / phone verification-code sign-in (#6/#7)
// replicated from feature/login/VerificationLoginScreen.kt.
// NOTE [Android 当前实现]: a successful login returns to the sign-in method
// chooser; it does NOT enter an authenticated session (AppRootScreen comment).

import { t } from "../i18n.js";
import { icon } from "../icons.js";
import { brandMark, esc, spinner } from "../ui.js";
import { requestStudentSignInCode, apiErrorText, ApiError } from "../api.js";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

function methodState(app, method) {
  if (!app.ui.verification) {
    app.ui.verification = {
      method,
      email: { contact: "", code: "", cooldown: 0, sending: false, loggingIn: false, error: null, info: null },
      phone: { contact: "", code: "", cooldown: 0, sending: false, loggingIn: false, error: null, info: null },
    };
  }
  app.ui.verification.method = app.ui.verification.method || method;
  return app.ui.verification;
}

const normalizedPhone = (value) => value.trim().replace(/^\+?86/, "");
const isValidPhone = (value) => /^1[3-9]\d{9}$/.test(value);
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function derived(m, isPhone) {
  const contactNorm = isPhone ? normalizedPhone(m.contact) : m.contact.trim();
  const contactValid = isPhone ? isValidPhone(contactNorm) : isValidEmail(contactNorm);
  const contactInvalid = m.contact.trim() !== "" && !contactValid;
  const codeInvalid = m.code !== "" && m.code.length !== CODE_LENGTH;
  const canSend = contactValid && m.cooldown === 0 && !m.sending && !m.loggingIn;
  const canLogin = contactValid && m.code.length === CODE_LENGTH && !m.sending && !m.loggingIn;
  return { contactValid, contactInvalid, codeInvalid, canSend, canLogin };
}

function inputField({ id, label, value, placeholder, leadingIcon, prefix, invalid, errorText, disabled, inputMode, maxlength, inputAction, trailing, codeStyle }) {
  return `<div class="col" style="width:100%">
    <div class="label-large text-on-surface" style="font-weight:500">${esc(label)}</div>
    <div style="height:8px"></div>
    <div class="vfield${invalid ? " error" : ""}${disabled ? " disabled" : ""}">
      <span class="vfield-icon">${icon(leadingIcon, 20)}</span>
      ${prefix || ""}
      <input id="${id}" class="vfield-input${codeStyle ? " code-style" : ""}" type="text" inputmode="${inputMode}" ${maxlength ? `maxlength="${maxlength}"` : ""}
        value="${esc(value)}" placeholder="${esc(placeholder)}" data-input="${inputAction}" ${disabled ? "disabled" : ""} autocomplete="${codeStyle ? "one-time-code" : "on"}" />
      ${trailing || ""}
    </div>
    ${invalid ? `<div class="row" style="gap:6px;padding-top:7px"><span class="text-error" style="display:inline-flex">${icon("error-outline", 15)}</span><span class="body-small text-error">${esc(errorText)}</span></div>` : ""}
  </div>`;
}

function statusBanner(message, isError) {
  return `<div class="vlogin-banner ${isError ? "is-error" : "is-info"}">
    ${icon(isError ? "error-outline" : "check-circle", 18)}
    <span class="body-small grow">${esc(message)}</span>
  </div>`;
}

export function renderVerificationLogin(app, { method }) {
  const ui = methodState(app, method);
  const activeMethod = app.state.showPhoneLogin ? "phone" : "email";
  const isPhone = activeMethod === "phone";
  const m = isPhone ? ui.phone : ui.email;
  const d = derived(m, isPhone);
  const formEnabled = !m.sending && !m.loggingIn;

  const title = t(isPhone ? "login_verification_phone_title" : "login_verification_email_title");
  const subtitle = t(isPhone ? "login_verification_phone_subtitle" : "login_verification_email_subtitle");
  const resendLabel = m.cooldown > 0 ? t("login_verification_resend_countdown", m.cooldown) : t("login_verification_send_code");

  return `<div class="screen vlogin-screen">
    <div class="screen-scroll" data-scroll-key="vlogin-${activeMethod}">
      <div class="vlogin-topbar">
        <button class="icon-btn pressable" data-action="verification.back" aria-label="${t("common_back")}">${icon("arrow-back", 24)}</button>
      </div>
      <div class="auth-column" style="padding-top:30px">
        ${brandMark(true)}
        <div style="height:22px"></div>
        <div class="headline-large" style="color:var(--color-on-background);font-weight:600">${title}</div>
        <div style="height:10px"></div>
        <div class="body-large text-muted">${subtitle}</div>
        <div style="height:28px"></div>
        <div class="vlogin-card">
          ${inputField({
            id: "vlogin-contact",
            label: t(isPhone ? "login_verification_phone_label" : "login_verification_email_label"),
            value: m.contact,
            placeholder: t(isPhone ? "login_verification_phone_placeholder" : "login_verification_email_placeholder"),
            leadingIcon: isPhone ? "smartphone" : "email",
            prefix: isPhone ? `<span class="vfield-prefix"><span class="body-large" style="font-weight:500;color:var(--color-on-surface)">${t("login_verification_phone_prefix")}</span><span class="vfield-prefix-divider"></span></span>` : "",
            invalid: d.contactInvalid,
            errorText: t(isPhone ? "login_verification_phone_invalid" : "login_verification_email_invalid"),
            disabled: !formEnabled,
            inputMode: isPhone ? "tel" : "email",
            inputAction: "verification.contact",
          })}
          <div style="height:20px"></div>
          ${inputField({
            id: "vlogin-code",
            label: t("login_verification_code_label"),
            value: m.code,
            placeholder: t("login_verification_code_placeholder"),
            leadingIcon: "lock",
            invalid: d.codeInvalid,
            errorText: t("login_verification_code_invalid"),
            disabled: !formEnabled,
            inputMode: "numeric",
            maxlength: CODE_LENGTH,
            inputAction: "verification.code",
            codeStyle: true,
            trailing: `<button class="text-btn pressable vfield-trailing" data-action="verification.sendCode" ${d.canSend ? "" : "disabled"} style="min-height:48px;padding:0 8px">
              ${m.sending ? spinner(18) : `<span class="label-large" style="font-weight:500;white-space:nowrap">${resendLabel}</span>`}
            </button>`,
          })}
          <div style="height:14px"></div>
          <div class="row" style="gap:8px">
            <span class="text-muted" style="display:inline-flex">${icon("info-outline", 17)}</span>
            <span class="body-small text-muted grow">${t("login_verification_code_expiry")}</span>
          </div>
          ${m.info || m.error ? `<div style="padding-top:18px" class="col gap8">${m.info ? statusBanner(m.info, false) : ""}${m.error ? statusBanner(m.error, true) : ""}</div>` : ""}
          <div style="height:24px"></div>
          <button class="vlogin-submit pressable" data-action="verification.submit" ${d.canLogin && !m.loggingIn ? "" : "disabled"}>
            ${m.loggingIn ? `${spinner(18, "on-primary")}<span style="width:10px"></span>` : ""}
            <span class="title-medium">${t("login_verification_submit")}</span>
          </button>
        </div>
        <div style="height:10px"></div>
        <button class="text-btn pressable" data-action="verification.switch" ${formEnabled ? "" : "disabled"} style="min-height:48px;padding:0 4px">
          ${icon(isPhone ? "email" : "smartphone", 18)}
          <span class="label-large" style="font-weight:500">${t(isPhone ? "login_verification_switch_to_email" : "login_verification_switch_to_phone")}</span>
        </button>
        <div class="body-small text-muted" style="text-align:center;width:100%">${t("login_verification_privacy_notice")}</div>
      </div>
    </div>
  </div>`;
}

function activeState(app) {
  const ui = app.ui.verification;
  if (!ui) return null;
  return app.state.showPhoneLogin ? ui.phone : ui.email;
}

function startCooldown(app, m) {
  m.cooldown = RESEND_COOLDOWN;
  const timer = setInterval(() => {
    if (m.cooldown > 0) {
      m.cooldown -= 1;
      const btn = app._viewport?.querySelector('[data-action="verification.sendCode"] .label-large');
      if (btn) {
        btn.textContent = m.cooldown > 0 ? t("login_verification_resend_countdown", m.cooldown) : t("login_verification_send_code");
      }
      if (m.cooldown === 0) {
        clearInterval(timer);
        app.render();
      }
    } else {
      clearInterval(timer);
    }
  }, 1000);
}

export const verificationActions = {
  "verification.back": (app) => app.handleBack(),
  "verification.contact": (app, el) => {
    const m = activeState(app);
    if (!m) return;
    m.contact = el.value;
    m.error = null;
    m.info = null;
    syncControls(app);
  },
  "verification.code": (app, el) => {
    const m = activeState(app);
    if (!m) return;
    const formatted = el.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (formatted !== el.value) el.value = formatted;
    m.code = formatted;
    m.error = null;
    syncControls(app);
  },
  "verification.sendCode": (app) => {
    const isPhone = app.state.showPhoneLogin;
    const m = activeState(app);
    if (!m) return;
    const d = derived(m, isPhone);
    if (!d.canSend) return;
    m.error = null;
    m.info = null;
    m.sending = true;
    app.render();
    // The unified backend ships this operation as contract-complete but
    // business-closed (SYSTEM_MODE_UNSUPPORTED) — report that honestly, and
    // only fall back to the offline demo flow when the backend is unreachable.
    requestStudentSignInCode(m.contact.trim()).then(
      () => {
        m.sending = false;
        m.info = t(isPhone ? "login_verification_phone_code_sent" : "login_verification_email_code_sent");
        startCooldown(app, m);
        app.render();
        app._viewport?.querySelector("#vlogin-code")?.focus();
      },
      (error) => {
        m.sending = false;
        if (error instanceof ApiError) {
          m.error = apiErrorText(error);
          app.render();
        } else {
          // Backend offline — keep the original demo behaviour (code 123456).
          m.info = t(isPhone ? "login_verification_phone_code_sent" : "login_verification_email_code_sent");
          startCooldown(app, m);
          app.render();
          app._viewport?.querySelector("#vlogin-code")?.focus();
        }
      }
    );
  },
  "verification.submit": (app) => {
    const isPhone = app.state.showPhoneLogin;
    const m = activeState(app);
    if (!m) return;
    const d = derived(m, isPhone);
    if (!d.canLogin) return;
    m.error = null;
    m.info = null;
    m.loggingIn = true;
    app.render();
    setTimeout(() => {
      m.loggingIn = false;
      if (m.code === "123456") {
        // [Android 当前实现，待产品确认] Success only returns to the method
        // chooser; the session is not entered from this screen.
        app.state.showEmailLogin = false;
        app.state.showPhoneLogin = false;
        app.navDirection = "back";
        app.render();
      } else {
        m.error = t("login_verification_error_invalid");
        app.render();
      }
    }, 800);
  },
  "verification.switch": (app) => {
    const toPhone = !app.state.showPhoneLogin;
    app.state.showPhoneLogin = toPhone;
    app.state.showEmailLogin = !toPhone;
    app.navDirection = "none";
    app.render();
  },
};

// Update dependent button states without a full re-render (keystrokes must not
// reset the focused input, matching the Compose per-keystroke recomposition).
function syncControls(app) {
  const isPhone = app.state.showPhoneLogin;
  const m = activeState(app);
  if (!m) return;
  const d = derived(m, isPhone);
  const sendBtn = app._viewport?.querySelector('[data-action="verification.sendCode"]');
  if (sendBtn) sendBtn.disabled = !d.canSend;
  const submitBtn = app._viewport?.querySelector('[data-action="verification.submit"]');
  if (submitBtn) submitBtn.disabled = !d.canLogin;
  // Re-render only when a validation error state changes (banner text appears).
  const contactField = app._viewport?.querySelector("#vlogin-contact")?.closest(".vfield");
  if (contactField) contactField.classList.toggle("error", d.contactInvalid);
  const codeField = app._viewport?.querySelector("#vlogin-code")?.closest(".vfield");
  if (codeField) codeField.classList.toggle("error", d.codeInvalid);
}
