// Contract 2.0.2 email-only first binding and verified-email change flow.

import { tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner } from "../ui.js";
import {
  requestEmailVerificationChallenge,
  verifyEmailVerificationChallenge,
  apiErrorText,
  ApiError,
} from "../api.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{4,10}$/;

function bindingState(app, mode) {
  const student = app.state.workspace.student;
  if (!app.ui.binding || app.ui.binding.mode !== mode) {
    app.ui.binding = {
      mode,
      currentEmail: student.email || "",
      initiallyVerified: Boolean(student.emailVerified),
      editing: !student.emailVerified,
      email: student.emailVerified ? "" : student.email || "",
      currentEmailCode: "",
      newEmailCode: "",
      challengeId: null,
      expiresAt: null,
      sending: false,
      verifying: false,
      resend: 0,
      message: null,
      isError: false,
    };
  }
  return app.ui.binding;
}

function diagnosticError(error) {
  if (!(error instanceof ApiError)) return apiErrorText(error);
  return `${apiErrorText(error)}\n${tx("错误码", "Error code")}: ${error.code}${error.requestId ? `\nrequestId: ${error.requestId}` : ""}`;
}

function messagePanel(message, isError) {
  return `<div class="binding-message ${isError ? "is-error" : "is-info"}"><span class="body-small" style="white-space:pre-line">${esc(message)}</span></div>`;
}

function field({ id, label, value, disabled, inputMode = "text", autocomplete = "off" }) {
  return `<div class="contact-field${disabled ? " disabled" : ""}">
    <span class="contact-field-icon">${icon(id === "email" ? "email" : "lock", 22)}</span>
    <div class="contact-field-inner">
      <label class="label-medium text-muted" for="binding-${id}">${esc(label)}</label>
      <input id="binding-${id}" type="text" inputmode="${inputMode}" autocomplete="${autocomplete}" value="${esc(value)}" data-input="binding.field" data-field="${id}" ${disabled ? "disabled" : ""} />
    </div>
  </div>`;
}

function startResendTicker(app, state) {
  state.resend = 60;
  const timer = setInterval(() => {
    state.resend -= 1;
    if (state.resend <= 0) {
      state.resend = 0;
      clearInterval(timer);
      app.render();
      return;
    }
    const label = app._viewport?.querySelector('[data-action="binding.sendCode"] span');
    if (label) label.textContent = tx(`${state.resend} 秒后可重发`, `Resend in ${state.resend}s`);
  }, 1000);
}

export function renderContactBinding(app, { mode }) {
  const state = bindingState(app, mode);
  const required = mode === "requiredActivation";
  const busy = state.sending || state.verifying;
  const emailValid = EMAIL_PATTERN.test(state.email.trim());
  const currentCodeValid = !state.initiallyVerified || CODE_PATTERN.test(state.currentEmailCode);
  const newCodeValid = CODE_PATTERN.test(state.newEmailCode);

  const verifiedPanel = !state.editing && state.initiallyVerified
    ? `<div class="swiss-panel"><div class="col" style="gap:16px">
        <div class="row" style="gap:12px">
          <span class="text-primary" style="display:inline-flex">${icon("check-circle", 24)}</span>
          <div class="col grow"><div class="title-medium text-on-surface">${tx("邮箱已验证", "Email verified")}</div><div class="body-small text-muted">${esc(state.currentEmail)}</div></div>
          <span class="text-muted" style="display:inline-flex">${icon("email", 20)}</span>
        </div>
        <button class="text-btn pressable" data-action="binding.changeEmail" style="min-height:48px;align-self:flex-start">${tx("更换邮箱", "Change email")}</button>
      </div></div>`
    : `<div class="swiss-panel"><div class="col" style="gap:16px">
        ${state.initiallyVerified ? `<div class="body-small text-muted">${tx(`当前已验证邮箱：${state.currentEmail}。发送后，当前邮箱和新邮箱会分别收到验证码。`, `Current verified email: ${state.currentEmail}. A code will be sent separately to the current and new addresses.`)}</div>` : ""}
        ${field({ id: "email", label: state.initiallyVerified ? tx("新邮箱", "New email") : tx("邮箱", "Email"), value: state.email, disabled: busy, inputMode: "email", autocomplete: "email" })}
        <button class="primary-btn pressable" data-action="binding.sendCode" ${!emailValid || busy || state.resend > 0 ? "disabled" : ""} style="min-height:52px">
          ${state.sending ? spinner(18, "on-primary") : `<span>${state.resend > 0 ? tx(`${state.resend} 秒后可重发`, `Resend in ${state.resend}s`) : tx("发送邮箱验证码", "Send email code")}</span>`}
        </button>
        ${state.challengeId ? `
          ${state.initiallyVerified ? field({ id: "currentEmailCode", label: tx("当前邮箱验证码", "Current-email code"), value: state.currentEmailCode, disabled: busy, inputMode: "numeric", autocomplete: "one-time-code" }) : ""}
          ${field({ id: "newEmailCode", label: state.initiallyVerified ? tx("新邮箱验证码", "New-email code") : tx("邮箱验证码", "Email verification code"), value: state.newEmailCode, disabled: busy, inputMode: "numeric", autocomplete: "one-time-code" })}
          <button class="primary-btn pressable" data-action="binding.verifyCode" ${!currentCodeValid || !newCodeValid || busy ? "disabled" : ""} style="min-height:52px">
            ${state.verifying ? spinner(18, "on-primary") : `<span>${tx("确认验证", "Verify")}</span>`}
          </button>` : ""}
        ${state.message ? messagePanel(state.message, state.isError) : ""}
      </div></div>`;

  const footer = required
    ? `<div class="col" style="gap:4px;align-items:center">
        <button class="text-btn pressable" data-action="binding.logout" style="min-height:48px">${tx("退出登录", "Sign out")}</button>
        <div class="row"><button class="text-btn pressable" data-action="binding.openPrivacy" style="min-height:48px">${tx("隐私说明", "Privacy")}</button><span class="body-small text-muted">·</span><button class="text-btn pressable" data-action="binding.openHelp" style="min-height:48px">${tx("需要帮助", "Get help")}</button></div>
      </div>`
    : "";

  return `<div class="screen binding-screen"><div class="screen-scroll" data-scroll-key="binding-${mode}"><div class="binding-column col" style="gap:24px">
    ${mode === "manageContacts" ? `<button class="icon-btn pressable" data-action="binding.back" aria-label="${tx("返回", "Back")}" style="margin-left:-12px">${icon("arrow-back", 24)}</button>` : ""}
    <div class="col" style="gap:8px">
      <div class="headline-large" style="color:var(--color-on-background)">${required ? tx("完成邮箱验证", "Verify your email") : tx("邮箱与安全", "Email and security")}</div>
      <div class="body-large text-muted">${required ? tx("请完成学校邮箱验证后继续使用课程和打卡服务。", "Verify your university email before continuing to course and check-in services.") : tx("学生账号统一使用已验证邮箱登录；手机号和短信登录已下线。", "Student accounts use verified email only; phone and SMS sign-in are retired.")}</div>
    </div>
    ${verifiedPanel}
    ${footer}
  </div></div></div>`;
}

export function renderActivationHelp(app) {
  return `<div class="screen binding-screen"><div class="screen-scroll" data-scroll-key="activation-help"><div class="binding-column col" style="gap:24px">
    <button class="icon-btn pressable" data-action="binding.helpBack" aria-label="${tx("返回", "Back")}" style="margin-left:-12px">${icon("arrow-back", 24)}</button>
    <div class="col" style="gap:8px"><div class="headline-large">${tx("邮箱验证帮助", "Email verification help")}</div><div class="body-large text-muted">${tx("验证码有有效期并受发送频率和失败次数限制。没有收到时，请检查垃圾邮件或等待 60 秒后重发。", "Codes expire and are protected by send-frequency and failure-attempt limits. Check spam or wait 60 seconds before resending.")}</div></div>
    <div class="swiss-panel"><div class="body-medium text-muted">${tx("仍然无法验证时，请联系学校体育教学部或账户管理员，并提供学号和可脱敏的错误码/requestId。", "If verification still fails, contact the sports office or account administrator with your student ID and the redacted error code/requestId.")}</div></div>
  </div></div></div>`;
}

export const bindingActions = {
  "binding.back": (app) => app.handleBack(),
  "binding.helpBack": (app) => app.handleBack(),
  "binding.field": (app, element) => {
    const state = app.ui.binding;
    if (!state) return;
    const fieldName = element.dataset.field;
    if (fieldName === "email") {
      state.email = element.value;
      state.challengeId = null;
      state.currentEmailCode = "";
      state.newEmailCode = "";
    } else {
      state[fieldName] = element.value.replace(/\D/g, "").slice(0, 10);
      if (state[fieldName] !== element.value) element.value = state[fieldName];
    }
    state.message = null;
  },
  "binding.sendCode": async (app) => {
    const state = app.ui.binding;
    if (!state || !EMAIL_PATTERN.test(state.email.trim()) || state.sending || state.resend > 0) return;
    state.sending = true;
    state.message = null;
    app.render();
    try {
      const accepted = await requestEmailVerificationChallenge(state.email.trim(), app.state.workspace.student.userVersion);
      state.challengeId = accepted.challengeId;
      state.expiresAt = accepted.expiresAt;
      state.isError = false;
      state.message = state.initiallyVerified ? tx("验证码已分别发送到当前邮箱和新邮箱。", "Codes were sent separately to the current and new email addresses.") : tx("验证码已发送到邮箱。", "A verification code was sent to the email address.");
      startResendTicker(app, state);
    } catch (error) {
      state.isError = true;
      state.message = diagnosticError(error);
    } finally {
      state.sending = false;
      app.render();
    }
  },
  "binding.verifyCode": async (app) => {
    const state = app.ui.binding;
    if (!state?.challengeId || !CODE_PATTERN.test(state.newEmailCode) || (state.initiallyVerified && !CODE_PATTERN.test(state.currentEmailCode))) return;
    state.verifying = true;
    state.message = null;
    app.render();
    try {
      await verifyEmailVerificationChallenge(state.challengeId, {
        currentEmailCode: state.initiallyVerified ? state.currentEmailCode : null,
        newEmailCode: state.newEmailCode,
      });
      state.isError = false;
      state.message = tx("邮箱验证成功。", "Email verification succeeded.");
      await app.reloadApiWorkspace();
      app.ui.binding = null;
      app.state.requiresContactBinding = false;
      app.navDirection = "forward";
      app.render();
    } catch (error) {
      state.verifying = false;
      state.isError = true;
      state.message = diagnosticError(error);
      app.render();
    }
  },
  "binding.changeEmail": (app) => {
    const state = app.ui.binding;
    if (!state) return;
    state.editing = true;
    state.email = "";
    state.challengeId = null;
    state.currentEmailCode = "";
    state.newEmailCode = "";
    state.message = null;
    app.render();
  },
  "binding.logout": (app) => { app.ui.binding = null; app.logout(); },
  "binding.openPrivacy": (app) => { app.state.activationSupportScreen = "privacy"; app.navDirection = "forward"; app.render(); },
  "binding.openHelp": (app) => { app.state.activationSupportScreen = "help"; app.navDirection = "forward"; app.render(); },
};
