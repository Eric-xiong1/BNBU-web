import { escapeHtml } from "../core/utils.js";

export function renderLogin({ error = "", busy = false } = {}) {
  return `
    <div class="auth-shell">
      <section class="auth-brand auth-grid" aria-label="BNBU Sports 学生端">
        <div class="auth-brand-copy">
          <div class="auth-brand-lockup"><span>BNBU</span> SPORTS</div>
          <p class="auth-eyebrow">STUDENT CAMPUS SPORTS</p>
          <h1>体育打卡与成绩进度</h1>
          <p>把课程任务、运动打卡、学时与成绩放进同一个清晰的学生工作台。</p>
          <div class="auth-feature-list" aria-label="学生端主要功能">
            <span>01 · 课程与任务</span><span>02 · 运动打卡</span><span>03 · 成绩与申请</span>
          </div>
        </div>
        <p class="auth-edition">BNBU SPORTS · STUDENT WEB</p>
      </section>
      <main class="auth-main">
        <section class="auth-card">
          <p class="auth-form-kicker">WELCOME BACK</p>
          <h2 class="page-heading">学生登录</h2>
          <p class="page-caption">使用学生账号进入体育学习工作台</p>
          ${error ? `<p class="notice" style="color:var(--danger);border-color:rgba(245,63,63,.22);background:rgba(245,63,63,.08)">${escapeHtml(error)}</p>` : ""}
          <form id="student-login-form" class="page-stack auth-form">
            <label class="field"><span>学号或账号</span><input name="account" autocomplete="username" placeholder="请输入学号 / 邮箱" required></label>
            <label class="field"><span>密码</span><span class="password-field"><input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required><button type="button" data-action="toggle-password" aria-label="显示密码" aria-pressed="false">显示</button></span></label>
            <button class="button button-primary button-block" type="submit" ${busy ? "disabled" : ""}>${busy ? "登录中…" : "进入学生端"}</button>
          </form>
          <div class="demo-entry">
            <p class="page-caption">暂不连接后端也可验收完整学生端。</p>
            <button class="button button-secondary button-block" type="button" data-action="demo-login">进入演示学生端</button>
          </div>
        </section>
      </main>
    </div>`;
}
