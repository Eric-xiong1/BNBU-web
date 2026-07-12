import { escapeHtml } from "../core/utils.js";

export function renderLogin({ error = "", busy = false } = {}) {
  return `
    <div class="auth-shell">
      <section class="auth-brand" aria-label="BNBU Sports 学生端">
        <div>
          <div class="brand-word" style="color:#fff">BNBU</div>
          <div style="color:rgba(255,255,255,.82)">Sports 学生端</div>
          <h1>体育学习与运动记录</h1>
          <p>打卡、课程、成绩与申请，一处完成。网页端主要服务于无法安装学生 App 的设备。</p>
        </div>
        <p style="margin-top:36px;font-size:12px">BNBU Sports · 2025–2026</p>
      </section>
      <main class="auth-main">
        <section class="auth-card">
          <h2 class="page-heading">学生登录</h2>
          <p class="page-caption">登录后将优先进入运动打卡</p>
          ${error ? `<p class="notice" style="color:var(--danger);border-color:rgba(245,63,63,.22);background:rgba(245,63,63,.08)">${escapeHtml(error)}</p>` : ""}
          <form id="student-login-form" class="page-stack" style="margin-top:24px">
            <label class="field"><span>学号或账号</span><input name="account" autocomplete="username" placeholder="请输入学号 / 邮箱" required></label>
            <label class="field"><span>密码</span><input name="password" type="password" autocomplete="current-password" placeholder="请输入密码" required></label>
            <button class="button button-primary button-block" type="submit" ${busy ? "disabled" : ""}>${busy ? "登录中…" : "进入学生端"}</button>
          </form>
          <div style="display:grid;gap:10px;margin-top:24px;padding-top:20px;border-top:1px solid var(--border)">
            <p class="page-caption" style="margin:0">后端暂不可用时，可完整体验全部学生功能。</p>
            <button class="button button-secondary button-block" type="button" data-action="demo-login">进入演示学生端</button>
          </div>
        </section>
      </main>
    </div>`;
}
