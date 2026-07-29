// Contact binding (#12 RequiredActivation / #29 ManageContacts) and
// activation help (#13) — feature/login/ContactBindingScreen.kt.

import { tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner } from "../ui.js";
import { localStore } from "../store.js";

const isEmailValid = (value) => value.includes("@") && value.split("@").slice(1).join("@").includes(".");
const phoneDigits = (value) => {
  const raw = value.replace(/\D/g, "");
  return raw.startsWith("86") ? raw.slice(2) : raw;
};
const isPhoneValid = (value) => /^1[3-9]\d{9}$/.test(phoneDigits(value));

function bindingState(app, mode) {
  if (!app.ui.binding || app.ui.binding.mode !== mode) {
    const contact = app.overlay.contact || {};
    const student = app.state.workspace.student;
    app.ui.binding = {
      mode,
      selectedKind: "email",
      email: {
        value: contact.emailVerified ? contact.email || student.email : student.email || "",
        code: "", verified: !!contact.emailVerified, codeSent: false, sending: false,
        verifying: false, message: null, isError: false, resend: 0,
      },
      phone: {
        value: contact.phoneVerified ? contact.phone || "" : "",
        code: "", verified: !!contact.phoneVerified, codeSent: false, sending: false,
        verifying: false, message: null, isError: false, resend: 0,
      },
      completionSent: false,
    };
  }
  return app.ui.binding;
}

function contactStatusRow({ kind, iconName, label, verified, selected }) {
  const detail = verified ? tx("已验证", "Verified") : tx("待验证", "Not verified");
  return `<button class="contact-status-row pressable" role="tab" data-action="binding.selectKind" data-kind="${kind}">
    <span style="display:inline-flex;color:${selected ? "var(--color-primary)" : "var(--color-on-surface-variant)"}">${icon(iconName, 20)}</span>
    <span class="body-large text-on-surface grow" style="text-align:left">${esc(label)}</span>
    ${verified ? `<span class="text-primary" style="display:inline-flex">${icon("check-circle", 18)}</span><span style="width:4px"></span>` : ""}
    <span class="body-small" style="color:${verified || selected ? "var(--color-primary)" : "var(--color-on-surface-variant)"}">${detail}</span>
  </button>`;
}

function verificationMessage(text, isError) {
  return `<div class="binding-message ${isError ? "is-error" : "is-info"}"><span class="body-small">${esc(text)}</span></div>`;
}

function contactField({ id, label, iconName, value, disabled, inputMode }) {
  return `<div class="contact-field${disabled ? " disabled" : ""}">
    ${iconName ? `<span class="contact-field-icon">${icon(iconName, 22)}</span>` : ""}
    <div class="contact-field-inner">
      <label class="label-medium text-muted" for="${id}">${esc(label)}</label>
      <input id="${id}" type="text" inputmode="${inputMode}" value="${esc(value)}" data-input="binding.field" data-field="${id}" ${disabled ? "disabled" : ""} />
    </div>
  </div>`;
}

function verificationForm(app, ui, kind) {
  const m = ui[kind];
  const isEmail = kind === "email";
  const busy = m.sending || m.verifying;
  const contactLabel = isEmail ? tx("邮箱", "Email") : tx("手机号", "Mobile number");
  const codeLabel = isEmail ? tx("邮箱验证码", "Email verification code") : tx("短信验证码", "SMS verification code");
  const allowChange = ui.mode === "manageContacts";
  let inner;
  if (m.verified) {
    inner = `
      <div class="row" style="gap:12px;padding:4px 0">
        <span class="text-primary" style="display:inline-flex">${icon("check-circle", 24)}</span>
        <div class="col grow">
          <div class="title-medium text-on-surface">${tx(`${contactLabel}已验证`, `${contactLabel} verified`)}</div>
          <div class="body-small text-muted">${esc(m.value)}</div>
        </div>
        <span class="text-muted" style="display:inline-flex">${icon(isEmail ? "email" : "smartphone", 20)}</span>
      </div>
      ${allowChange ? `<button class="text-btn pressable" data-action="binding.changeContact" data-kind="${kind}" style="min-height:48px;align-self:flex-start">${isEmail ? tx("更换邮箱", "Use another email") : tx("更换手机号", "Use another mobile number")}</button>` : ""}`;
  } else {
    const sendLabel = m.resend > 0
      ? tx(`${m.resend} 秒后可重发`, `Resend in ${m.resend}s`)
      : tx("获取验证码", "Send verification code");
    inner = `
      ${contactField({ id: `binding-${kind}-value`, label: contactLabel, iconName: isEmail ? "email" : "smartphone", value: m.value, disabled: busy, inputMode: isEmail ? "email" : "tel" })}
      <button class="primary-btn pressable" data-action="binding.sendCode" data-kind="${kind}" ${busy || m.resend > 0 ? "disabled" : ""} style="min-height:52px">
        ${m.sending ? spinner(18, "on-primary") : `<span>${sendLabel}</span>`}
      </button>
      ${m.codeSent ? `
        ${contactField({ id: `binding-${kind}-code`, label: codeLabel, iconName: null, value: m.code, disabled: busy, inputMode: "numeric" })}
        <button class="primary-btn pressable" data-action="binding.verifyCode" data-kind="${kind}" ${/^\d{6}$/.test(m.code) && !busy ? "" : "disabled"} style="min-height:52px">
          ${m.verifying ? spinner(18, "on-primary") : `<span>${tx("确认验证", "Verify")}</span>`}
        </button>` : ""}`;
  }
  return `<div class="swiss-panel"><div class="col" style="gap:16px">
    ${inner}
    ${m.message ? verificationMessage(m.message, m.isError) : ""}
  </div></div>`;
}

export function renderContactBinding(app, { mode }) {
  const ui = bindingState(app, mode);
  const required = mode === "requiredActivation";
  const kind = ui.selectedKind;
  const isEmail = kind === "email";
  const anyVerified = ui.email.verified || ui.phone.verified;

  const header = `
    <div class="col" style="gap:8px">
      <div class="headline-large" style="color:var(--color-on-background)">${required ? tx("完成账户激活", "Complete account activation") : tx("登录与安全", "Sign-in and security")}</div>
      <div class="body-large text-muted">${required
        ? tx("你已加入课程。验证一个手机号或邮箱后，即可开始打卡并使用课程服务。", "Your course is ready. Verify either a mobile number or email address to start check-ins and use course services.")
        : tx("添加或更换邮箱、手机号，保持登录方式随时可用。", "Add or change your email and mobile number to keep your sign-in methods available.")}</div>
    </div>`;

  const statusGroup = `
    <div class="col" style="gap:8px">
      <div class="label-medium text-muted" style="padding-left:4px">${required ? tx("选择一种验证方式", "Choose one verification method") : tx("登录方式", "Sign-in methods")}</div>
      <div class="contact-status-group">
        ${contactStatusRow({ kind: "email", iconName: "email", label: tx("邮箱", "Email"), verified: ui.email.verified, selected: kind === "email" })}
        <div class="contact-status-divider"></div>
        ${contactStatusRow({ kind: "phone", iconName: "smartphone", label: tx("手机号", "Mobile number"), verified: ui.phone.verified, selected: kind === "phone" })}
      </div>
    </div>`;

  const formSection = `
    <div class="col" style="gap:12px">
      <div class="title-medium" style="color:var(--color-on-background)">${isEmail ? tx("绑定邮箱", "Link email") : tx("绑定手机号", "Link mobile number")}</div>
      <div class="body-small text-muted">${isEmail
        ? tx("用于接收登录验证和账户安全通知。", "Used for sign-in verification and account security notifications.")
        : tx("用于登录验证和重要账户提醒。", "Used for sign-in verification and important account alerts.")}</div>
      ${verificationForm(app, ui, kind)}
    </div>`;

  const footer = required
    ? `<div class="col" style="gap:4px;align-items:center">
        <button class="text-btn pressable" data-action="binding.logout" style="min-height:48px">${tx("退出登录", "Sign out")}</button>
        <div class="row">
          <button class="text-btn pressable" data-action="binding.openPrivacy" style="min-height:48px">${tx("隐私说明", "Privacy")}</button>
          <span class="body-small text-muted">·</span>
          <button class="text-btn pressable" data-action="binding.openHelp" style="min-height:48px">${tx("需要帮助", "Get help")}</button>
        </div>
      </div>`
    : `<div class="body-small text-muted" style="padding:0 4px">${tx("验证任一联系方式后会自动保存。", "Either verified contact method is saved automatically.")}</div>`;

  return `<div class="screen binding-screen">
    <div class="screen-scroll" data-scroll-key="binding-${mode}">
      <div class="binding-column col" style="gap:24px">
        ${mode === "manageContacts" ? `<button class="icon-btn pressable" data-action="binding.back" aria-label="${tx("返回", "Back")}" style="margin-left:-12px">${icon("arrow-back", 24)}</button>` : ""}
        ${header}
        ${statusGroup}
        ${formSection}
        ${required && anyVerified ? `<div class="row" style="justify-content:center;gap:8px">${spinner(18)}<span class="body-small text-muted">${tx("正在准备你的账户…", "Preparing your account…")}</span></div>` : ""}
        ${footer}
      </div>
    </div>
  </div>`;
}

export function renderActivationHelp(app) {
  return `<div class="screen binding-screen">
    <div class="screen-scroll" data-scroll-key="activation-help">
      <div class="binding-column col" style="gap:24px">
        <button class="icon-btn pressable" data-action="binding.helpBack" aria-label="${tx("返回", "Back")}" style="margin-left:-12px">${icon("arrow-back", 24)}</button>
        <div class="col" style="gap:8px">
          <div class="headline-large" style="color:var(--color-on-background)">${tx("需要帮助？", "Need help?")}</div>
          <div class="body-large text-muted">${tx("完成一次联系方式验证后，就可以继续使用课程、打卡和进度服务。", "Verify one contact method to continue to courses, check-ins, and progress.")}</div>
        </div>
        <div class="swiss-panel"><div class="col" style="gap:16px">
          <div class="col" style="gap:4px">
            <div class="title-medium text-on-surface">${tx("没有收到验证码", "Didn't receive a code?")}</div>
            <div class="body-medium text-muted">${tx("检查邮箱或手机号是否输入正确。验证码有效期为 10 分钟，可在 60 秒后重新发送。", "Check that the email address or mobile number is correct. Codes are valid for 10 minutes and can be resent after 60 seconds.")}</div>
          </div>
          <div class="contact-status-divider" style="margin:0"></div>
          <div class="col" style="gap:4px">
            <div class="title-medium text-on-surface">${tx("仍然无法完成验证", "Still can't verify?")}</div>
            <div class="body-medium text-muted">${tx("请联系学校体育教学部或账户管理员，并说明你的学号与遇到的问题。", "Contact the university sports office or your account administrator with your student ID and a description of the issue.")}</div>
          </div>
        </div></div>
      </div>
    </div>
  </div>`;
}

function persistContact(app, ui) {
  app.overlay.contact = {
    email: ui.email.value,
    emailVerified: ui.email.verified,
    phone: ui.phone.value,
    phoneVerified: ui.phone.verified,
  };
  app.saveOverlay();
}

function startResendTicker(app, m) {
  m.resend = 60;
  const timer = setInterval(() => {
    if (m.resend > 0) {
      m.resend -= 1;
      if (m.resend === 0) {
        clearInterval(timer);
        app.render();
      } else {
        const btn = app._viewport?.querySelector('[data-action="binding.sendCode"] span');
        if (btn) btn.textContent = tx(`${m.resend} 秒后可重发`, `Resend in ${m.resend}s`);
      }
    } else {
      clearInterval(timer);
    }
  }, 1000);
}

export const bindingActions = {
  "binding.back": (app) => app.handleBack(),
  "binding.helpBack": (app) => app.handleBack(),
  "binding.selectKind": (app, el) => {
    const ui = app.ui.binding;
    if (!ui) return;
    ui.selectedKind = el.dataset.kind;
    app.render();
  },
  "binding.field": (app, el) => {
    const ui = app.ui.binding;
    if (!ui) return;
    const id = el.dataset.field;
    const kind = id.includes("email") ? "email" : "phone";
    const m = ui[kind];
    if (id.endsWith("value") && !m.verified) m.value = el.value.trim();
    if (id.endsWith("code") && !m.verified) {
      m.code = el.value.trim();
      const verifyBtn = app._viewport?.querySelector('[data-action="binding.verifyCode"]');
      if (verifyBtn) verifyBtn.disabled = !/^\d{6}$/.test(m.code) || m.sending || m.verifying;
    }
  },
  "binding.sendCode": (app, el) => {
    const ui = app.ui.binding;
    const kind = el.dataset.kind;
    const m = ui[kind];
    const valid = kind === "email" ? isEmailValid(m.value) : isPhoneValid(m.value);
    if (!valid) {
      m.isError = true;
      m.message = kind === "email" ? tx("请输入有效的邮箱", "Enter a valid email address.") : tx("请输入有效的手机号", "Enter a valid mobile number.");
      app.render();
      return;
    }
    m.sending = true;
    m.isError = false;
    m.message = null;
    app.render();
    setTimeout(() => {
      m.sending = false;
      m.codeSent = true;
      m.message = tx("验证码已发送", "Verification code sent.");
      startResendTicker(app, m);
      app.render();
    }, 700);
  },
  "binding.verifyCode": (app, el) => {
    const ui = app.ui.binding;
    const kind = el.dataset.kind;
    const m = ui[kind];
    if (!/^\d{6}$/.test(m.code)) return;
    m.verifying = true;
    m.isError = false;
    m.message = null;
    app.render();
    setTimeout(() => {
      m.verifying = false;
      if (m.code === "123456") {
        m.verified = true;
        m.message = tx("验证成功", "Verification successful.");
        persistContact(app, ui);
        app.render();
        if (ui.mode === "requiredActivation" && !ui.completionSent) {
          ui.completionSent = true;
          setTimeout(() => {
            app.state.requiresContactBinding = false;
            app.navDirection = "forward";
            app.render();
          }, 450);
        } else if (ui.mode === "manageContacts") {
          // ManageContacts saves automatically; the screen remains open.
        }
      } else {
        m.isError = true;
        m.message = tx("验证失败，请检查验证码后重试", "Verification failed. Check the code and try again.");
        app.render();
      }
    }, 800);
  },
  "binding.changeContact": (app, el) => {
    const ui = app.ui.binding;
    const m = ui[el.dataset.kind];
    m.verified = false;
    m.value = "";
    m.code = "";
    m.codeSent = false;
    m.message = null;
    persistContact(app, ui);
    app.render();
  },
  "binding.logout": (app) => {
    app.ui.binding = null;
    app.logout();
  },
  "binding.openPrivacy": (app) => {
    app.state.activationSupportScreen = "privacy";
    app.navDirection = "forward";
    app.render();
  },
  "binding.openHelp": (app) => {
    app.state.activationSupportScreen = "help";
    app.navDirection = "forward";
    app.render();
  },
};
