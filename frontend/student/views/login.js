import { escapeHtml, formatDate } from "../core/utils.js";

export function renderLogin({ error = "", busy = false, challenge = null, account = "", organizationCode = "BNBU" } = {}) {
  const form = challenge ? `
    <form id="student-code-form" class="page-stack auth-form">
      <div class="notice"><strong>验证码已发送</strong><br>已向 ${escapeHtml(account)} 发送邮箱验证码，有效期至 ${formatDate(challenge.expiresAt)}。</div>
      <label class="field"><span>邮箱验证码</span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,10}" minlength="4" maxlength="10" placeholder="请输入 4–10 位验证码" required></label>
      <button class="button button-primary button-block" type="submit" ${busy ? "disabled" : ""}>${busy ? "验证中…" : "验证并进入学生端"}</button>
      <button class="button button-secondary button-block" type="button" data-action="change-login-email">更换邮箱</button>
    </form>` : `
    <form id="student-login-form" class="page-stack auth-form">
      <label class="field"><span>学校代码</span><input name="organizationCode" value="${escapeHtml(organizationCode)}" pattern="[A-Z0-9][A-Z0-9_-]{1,31}" maxlength="32" autocomplete="organization" required></label>
      <label class="field"><span>学校邮箱</span><input name="account" type="email" value="${escapeHtml(account)}" autocomplete="email" placeholder="name@bnbu.edu.cn" maxlength="254" required></label>
      <p class="page-caption">学生端仅支持邮箱验证码登录，不再支持手机号、短信或密码入口。</p>
      <button class="button button-primary button-block" type="submit" ${busy ? "disabled" : ""}>${busy ? "发送中…" : "发送邮箱验证码"}</button>
      <button class="button button-secondary button-block" type="button" data-action="public-course-join">首次扫码 / 邀请码入课</button>
    </form>`;
  return `
    <div class="auth-shell">
      <section class="auth-brand auth-grid" aria-label="BNBU Sports 学生端">
        <div class="auth-brand-copy"><div class="auth-brand-lockup"><span>BNBU</span> SPORTS</div><p class="auth-eyebrow">STUDENT CAMPUS SPORTS</p><h1>体育打卡与成绩进度</h1><p>课程、现场运动凭证、学时与成绩统一由 Backend /api/v1 管理。</p><div class="auth-feature-list"><span>01 · 邮箱认证</span><span>02 · 现场打卡</span><span>03 · 成绩与申请</span></div></div>
        <p class="auth-edition">BNBU SPORTS · STUDENT WEB</p>
      </section>
      <main class="auth-main"><section class="auth-card"><p class="auth-form-kicker">EMAIL SIGN-IN</p><h2 class="page-heading">学生邮箱登录</h2><p class="page-caption">${challenge ? "输入邮件中的一次性验证码" : "使用已验证的学校邮箱登录"}</p>${error ? `<p class="notice auth-error">${escapeHtml(error)}</p>` : ""}${form}
        <div class="demo-entry"><p class="page-caption">演示入口仅用于离线界面验收，不会在真实请求失败时自动启用。</p><button class="button button-secondary button-block" type="button" data-action="demo-login">进入演示学生端</button></div>
      </section></main>
    </div>`;
}
