// Account recovery request (#8) — feature/login/RecoveryRequestScreen.kt

import { tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner, validationPanel } from "../ui.js";

const MAX_DESCRIPTION = 500;

function recoveryState(app) {
  if (!app.ui.recovery) {
    app.ui.recovery = {
      studentId: "", name: "", description: "", newPhone: "", newEmail: "",
      submitting: false, submitted: false, error: null,
    };
  }
  return app.ui.recovery;
}

function recoveryField({ id, label, requirement, placeholder, value, supporting, disabled, multiline, inputMode }) {
  const input = multiline
    ? `<textarea id="${id}" class="rfield-input multiline" rows="4" data-input="recovery.field" data-field="${id}" placeholder="${esc(placeholder)}" ${disabled ? "disabled" : ""} maxlength="${MAX_DESCRIPTION}">${esc(value)}</textarea>`
    : `<input id="${id}" class="rfield-input" type="text" inputmode="${inputMode || "text"}" data-input="recovery.field" data-field="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${disabled ? "disabled" : ""} />`;
  return `<div class="col" style="gap:8px">
    <div class="row" style="width:100%">
      <span class="label-large text-on-surface">${esc(label)}</span>
      <span style="width:6px"></span>
      <span class="body-small text-muted">${esc(requirement)}</span>
      ${supporting ? `<span class="grow"></span><span class="body-small text-muted" data-recovery-counter>${esc(supporting)}</span>` : ""}
    </div>
    ${input}
  </div>`;
}

function recoverySection(title, description, contentHtml) {
  return `<div class="col" style="gap:12px">
    <div class="col" style="gap:3px">
      <span class="title-medium text-on-surface">${esc(title)}</span>
      <span class="body-small text-muted">${esc(description)}</span>
    </div>
    <div class="swiss-panel" style="padding:16px"><div class="col" style="gap:18px">${contentHtml}</div></div>
  </div>`;
}

export function renderRecoveryRequest(app) {
  const ui = recoveryState(app);
  let body;
  if (ui.submitted) {
    body = `<div class="recovery-success">
      <div class="col" style="align-items:center;max-width:420px;width:100%">
        <span class="recovery-success-circle">${icon("check", 30)}</span>
        <div style="height:24px"></div>
        <div class="headline-small text-on-surface">${tx("申请已提交", "Request submitted")}</div>
        <div style="height:10px"></div>
        <div class="body-large text-muted" style="text-align:center">${tx("恢复申请已提交，请等待老师或管理员联系你", "Your recovery request was submitted. Please wait for a teacher or administrator to contact you.")}</div>
        <div style="height:32px"></div>
        <button class="primary-btn pressable" data-action="recovery.back" style="min-height:52px;border-radius:var(--shape-large)">${tx("返回登录", "Back to sign in")}</button>
      </div>
    </div>`;
  } else {
    body = `<div class="recovery-form col" style="gap:28px">
      <div class="col" style="gap:10px">
        <div class="headline-medium text-on-surface">${tx("换手机后无法登录？", "Can't sign in after changing phones?")}</div>
        <div class="body-large text-muted">${tx("提交以下信息后，老师或管理员会核对你的身份，并协助绑定新的联系方式。", "Submit the details below so a teacher or administrator can verify your identity and help link new contact details.")}</div>
      </div>
      ${ui.error ? validationPanel(ui.error) : ""}
      ${recoverySection(
        tx("身份信息", "Identity details"),
        tx("请填写与校园账号一致的信息", "Use the same details as your campus account."),
        recoveryField({ id: "studentId", label: tx("学号", "Student ID"), requirement: tx("必填", "Required"), placeholder: tx("请输入学号", "Enter your student ID"), value: ui.studentId, disabled: ui.submitting }) +
        recoveryField({ id: "name", label: tx("姓名", "Name"), requirement: tx("必填", "Required"), placeholder: tx("请输入姓名", "Enter your name"), value: ui.name, disabled: ui.submitting })
      )}
      ${recoverySection(
        tx("情况说明", "What happened"),
        tx("简要说明原联系方式无法使用的情况", "Briefly explain why the original contact details cannot be used."),
        recoveryField({ id: "description", label: tx("说明", "Description"), requirement: tx("必填", "Required"), placeholder: tx("例如：更换手机后，原手机号和邮箱均无法接收验证码", "For example: after changing phones, neither the old mobile number nor email can receive codes."), value: ui.description, supporting: `${ui.description.length} / ${MAX_DESCRIPTION}`, disabled: ui.submitting, multiline: true })
      )}
      ${recoverySection(
        tx("新的联系方式", "New contact details"),
        tx("选填；如方便，请填写可正常使用的联系方式", "Optional. Provide contact details you can currently use, if available."),
        recoveryField({ id: "newPhone", label: tx("新手机号", "New mobile number"), requirement: tx("选填", "Optional"), placeholder: tx("请输入新手机号", "Enter a new mobile number"), value: ui.newPhone, disabled: ui.submitting, inputMode: "tel" }) +
        recoveryField({ id: "newEmail", label: tx("新邮箱", "New email"), requirement: tx("选填", "Optional"), placeholder: tx("请输入新邮箱", "Enter a new email"), value: ui.newEmail, disabled: ui.submitting, inputMode: "email" })
      )}
    </div>`;
  }

  return `<div class="screen recovery-screen">
    <div class="recovery-topbar">
      <button class="icon-btn pressable text-primary" data-action="recovery.back" aria-label="${tx("返回", "Back")}">${icon("arrow-back", 24)}</button>
      <span class="title-medium text-on-surface">${tx("账号恢复", "Account recovery")}</span>
    </div>
    <div class="screen-scroll" data-scroll-key="recovery">${body}</div>
    ${ui.submitted ? "" : `<div class="recovery-submit-bar">
      <button class="recovery-submit pressable" data-action="recovery.submit" ${ui.submitting ? "disabled" : ""}>
        ${ui.submitting ? spinner(18, "on-primary") : icon("send", 18)}
        <span class="label-large">${ui.submitting ? tx("正在提交…", "Submitting…") : tx("提交恢复申请", "Submit recovery request")}</span>
      </button>
    </div>`}
  </div>`;
}

export const recoveryActions = {
  "recovery.back": (app) => {
    app.ui.recovery = null;
    app.state.showRecoveryRequest = false;
    app.navDirection = "back";
    app.render();
  },
  "recovery.field": (app, el) => {
    const ui = recoveryState(app);
    const field = el.dataset.field;
    let value = el.value;
    if (field === "description") {
      value = value.slice(0, MAX_DESCRIPTION);
      const counter = app._viewport?.querySelector("[data-recovery-counter]");
      if (counter) counter.textContent = `${value.length} / ${MAX_DESCRIPTION}`;
    }
    ui[field] = value;
  },
  "recovery.submit": (app) => {
    const ui = recoveryState(app);
    if (ui.submitting || ui.submitted) return;
    const studentId = ui.studentId.trim();
    const name = ui.name.trim();
    const description = ui.description.trim();
    ui.error = !studentId
      ? tx("请填写学号", "Enter your student ID.")
      : !name
        ? tx("请填写姓名", "Enter your name.")
        : !description
          ? tx("请填写说明", "Enter a description.")
          : null;
    if (ui.error) {
      app.render();
      return;
    }
    ui.submitting = true;
    app.render();
    // Demo backend: the request resolves successfully after a short delay.
    setTimeout(() => {
      ui.submitting = false;
      ui.submitted = true;
      app.render();
    }, 900);
  },
};
