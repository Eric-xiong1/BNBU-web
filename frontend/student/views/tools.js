import { escapeHtml, formatDate } from "../core/utils.js";

export function validateRunTime(minutes, seconds) {
  const errors = [];
  const min = Number(minutes), sec = Number(seconds);
  if (!Number.isInteger(min) || min < 0 || !Number.isInteger(sec)) errors.push("请输入有效的跑步时间");
  if (sec < 0 || sec > 59) errors.push("秒数须在 0–59 之间");
  if (min * 60 + sec <= 0) errors.push("跑步时间必须大于 0");
  return [...new Set(errors)];
}

export function validateExemption({ type, reason, proofs = [] }) {
  const errors = [];
  if (!["800m","1000m"].includes(type)) errors.push("请选择免测项目");
  const length = String(reason || "").trim().length;
  if (length < 5 || length > 500) errors.push("申请原因须为 5–500 个字符");
  if (proofs.length > 7) errors.push("证明文件数量超过限制");
  return errors;
}

export function renderEndurance({ student = {}, result = null, error = "", busy = false } = {}) {
  const type = student.gender === "male" ? "1000m" : "800m";
  return `<section class="page-stack"><button class="button button-secondary" data-route="profile">← 返回我的</button><header><h1 class="page-heading">耐力跑成绩换算</h1><p class="page-caption">${escapeHtml(student.genderLabel || "未设置性别")} · ${escapeHtml(student.gradeLabel || "未设置年级")} · ${type}</p></header>
    ${error ? `<div class="notice risk-notice">${escapeHtml(error)}</div>` : ""}<form id="endurance-form" class="card"><div class="card-body page-stack"><h2 class="card-title">输入完成时间</h2><div class="time-inputs"><label class="field"><span>分钟</span><input name="minutes" inputmode="numeric" maxlength="2" placeholder="3" required></label><b>′</b><label class="field"><span>秒</span><input name="seconds" inputmode="numeric" maxlength="2" placeholder="45" required></label><b>″</b></div><button class="button button-primary button-block" ${busy ? "disabled" : ""}>${busy ? "换算中…" : "开始换算"}</button></div></form>
    ${result ? `<section class="score-result"><span>换算结果</span><strong>${result.score}</strong><b>${escapeHtml({excellent:"优秀",good:"良好",pass:"及格",fail:"不及格"}[result.tier] || result.tier)}</b><small>${Math.floor(result.timeSeconds/60)}′${result.timeSeconds%60}″ · ${result.source === "local" ? "本地规则换算" : "服务端规则"}</small></section>` : ""}</section>`;
}

export function renderExemptions(items = []) {
  return `<section class="page-stack"><button class="button button-secondary" data-route="profile">← 返回我的</button><header><h1 class="page-heading">免测申请</h1><p class="page-caption">800m / 1000m 申请与审核记录</p></header><button class="button button-primary" data-route="exemption-new">＋ 提交新申请</button><h2 class="section-heading">我的申请</h2><div class="record-list">${items.map((item) => `<article class="record-card"><div><strong>${escapeHtml(item.type)} 免测</strong><span class="badge ${item.status === "已通过" ? "badge-success" : item.status === "已驳回" ? "badge-danger" : "badge-warning"}">${escapeHtml(item.status)}</span></div><p>${escapeHtml(item.reason)}</p><span class="page-caption">${formatDate(item.createdAt)} · ${item.proofFiles?.length || 0} 个证明</span>${item.reviewComment ? `<div class="notice">审核意见：${escapeHtml(item.reviewComment)}</div>` : ""}</article>`).join("") || '<div class="card"><div class="card-body muted">暂无免测申请。</div></div>'}</div></section>`;
}

export function renderExemptionForm({ student = {}, proofs = [], error = "", busy = false } = {}) {
  const defaultType = student.gender === "male" ? "1000m" : "800m";
  return `<section class="page-stack"><button class="button button-secondary" data-route="exemptions">← 返回申请记录</button><header><h1 class="page-heading">提交免测申请</h1><p class="page-caption">请填写真实原因并上传有效证明</p></header>${error ? `<div class="notice risk-notice">${escapeHtml(error)}</div>` : ""}<form id="exemption-form" class="card"><div class="card-body page-stack"><label class="field"><span>免测项目</span><select name="type"><option ${defaultType === "800m" ? "selected" : ""}>800m</option><option ${defaultType === "1000m" ? "selected" : ""}>1000m</option></select></label><label class="field"><span>申请原因</span><textarea name="reason" maxlength="500" placeholder="请说明伤病情况、医生建议或其他原因"></textarea></label><label class="upload-picker"><input id="exemption-proof-picker" type="file" accept="image/*" multiple><span>＋ 添加证明图片</span></label><p class="page-caption">已选择 ${proofs.length} 个证明文件</p><button class="button button-primary button-block" ${busy ? "disabled" : ""}>${busy ? "提交中…" : "提交免测申请"}</button></div></form></section>`;
}
