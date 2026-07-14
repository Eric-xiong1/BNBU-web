import { escapeHtml, formatDate, formatBytes, safeProofUrl } from "../core/utils.js";

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
  const population = result?.population || `${student.gender === "male" ? "M" : "F"}/${student.gradeLevel || "FS"}`;
  return `<section class="page-stack tool-page"><button class="button button-secondary back-button" data-route="profile">← 返回我的</button><header><span class="eyebrow">ENDURANCE</span><h1 class="page-heading">耐力跑成绩换算</h1><p class="page-caption">${escapeHtml(student.genderLabel || "未设置性别")} · ${escapeHtml(student.gradeLabel || "未设置年级")} · ${type}</p></header>
    <section class="card rule-card"><div class="card-body"><span class="eyebrow">SCORING RULE</span><div class="rule-facts"><div><span>适用人群</span><strong>${escapeHtml(population)}</strong></div><div><span>测试项目</span><strong>${type}</strong></div><div><span>规则方向</span><strong>用时越短，得分越高</strong></div></div></div></section>
    ${error ? `<div class="notice risk-notice">${escapeHtml(error)}</div>` : ""}<form id="endurance-form" class="card endurance-form"><div class="card-body page-stack"><h2 class="card-title">输入完成时间</h2><div class="time-inputs"><label class="field"><span>分钟</span><input name="minutes" inputmode="numeric" maxlength="2" placeholder="3" required></label><b>′</b><label class="field"><span>秒</span><input name="seconds" inputmode="numeric" maxlength="2" placeholder="45" required></label><b>″</b></div><button class="button button-primary button-block" ${busy ? "disabled" : ""}>${busy ? "换算中…" : "开始换算"}</button></div></form>
    ${result ? `<section class="score-result"><span class="eyebrow">换算结果</span><strong>${result.score}</strong><b>${escapeHtml({excellent:"优秀",good:"良好",pass:"及格",fail:"不及格"}[result.tier] || result.tier)}</b><div class="score-trace"><span>${Math.floor(result.timeSeconds/60)}′${result.timeSeconds%60}″</span><span>${escapeHtml(population)}</span><span>${result.source === "local" ? "本地规则换算" : "服务端规则"}</span></div></section>` : ""}</section>`;
}

const exemptionTone = (status) => status === "已通过" ? "badge-success" : ["已驳回","需补材料","补材料"].includes(status) ? "badge-danger" : "badge-warning";

export function renderExemptions(items = []) {
  return `<section class="page-stack tool-page"><button class="button button-secondary back-button" data-route="profile">← 返回我的</button><header><span class="eyebrow">EXEMPTION</span><h1 class="page-heading">体育免测与免打卡申请</h1><p class="page-caption">800m / 1000m 申请、材料补交与审核记录</p></header><button class="button button-primary new-exemption" data-route="exemption-new">＋ 提交新申请</button><div class="section-row"><div><span class="eyebrow">APPLICATIONS</span><h2 class="section-heading">我的申请</h2></div><span class="badge">${items.length} 条</span></div><div class="record-list exemption-list">${items.map((item) => `<button class="record-card exemption-card" type="button" data-route="exemption/${escapeHtml(item.id)}" data-exemption-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.type)} 免测</strong><span class="badge ${exemptionTone(item.status)}">${escapeHtml(item.status)}</span></div><p>${escapeHtml(item.reason)}</p><span class="page-caption">${formatDate(item.createdAt)} · ${item.proofFiles?.length || 0} 个证明</span>${["需补材料","补材料","已驳回"].includes(item.status) ? '<span class="exemption-action">补交证明 →</span>' : ""}</button>`).join("") || '<div class="card"><div class="card-body muted">你还没有提交过免测或免打卡申请。</div></div>'}</div></section>`;
}

export function renderExemptionDetail(item) {
  if (!item) return '<div class="card"><div class="card-body muted">申请不存在。</div></div>';
  const proofs = (item.proofFiles || []).map(safeProofUrl).filter(Boolean);
  return `<section class="page-stack tool-page"><button class="button button-secondary back-button" data-route="exemptions">← 返回我的申请</button><header><span class="eyebrow">APPLICATION DETAIL</span><h1 class="page-heading">${escapeHtml(item.type)} 申请详情</h1></header><section class="card"><div class="card-body page-stack"><div class="section-row"><h2 class="card-title">申请状态</h2><span class="badge ${exemptionTone(item.status)}">${escapeHtml(item.status)}</span></div><div class="detail-facts"><div><span>所属组织</span><strong>${escapeHtml(item.organization || "个人申请")}</strong></div><div><span>提交时间</span><strong>${formatDate(item.createdAt)}</strong></div><div><span>申请理由</span><strong>${escapeHtml(item.reason || "未填写")}</strong></div></div></div></section><section class="card"><div class="card-head"><h2 class="card-title">证明材料</h2></div><div class="card-body proof-grid">${proofs.map((url,index) => `<a class="proof-preview" href="${escapeHtml(url)}" target="_blank" rel="noopener"><img src="${escapeHtml(url)}" alt="免测证明 ${index + 1}" loading="lazy"></a>`).join("") || '<div class="upload-empty">尚未上传证明材料</div>'}</div></section><section class="card"><div class="card-head"><h2 class="card-title">处理意见</h2></div><div class="card-body"><p>${escapeHtml(item.reviewComment || "申请正在审核，暂无处理意见。")}</p></div></section>${["需补材料","补材料","已驳回"].includes(item.status) ? `<button class="button button-primary" type="button" data-action="supplement-exemption" data-exemption-id="${escapeHtml(item.id)}">补交证明材料</button>` : ""}</section>`;
}

export function renderExemptionForm({ student = {}, proofs = [], error = "", busy = false, supplementTarget = null } = {}) {
  const defaultType = student.gender === "male" ? "1000m" : "800m";
  const type = supplementTarget?.type || defaultType;
  return `<section class="page-stack tool-page"><button class="button button-secondary back-button" data-route="${supplementTarget ? `exemption/${escapeHtml(supplementTarget.id)}` : "exemptions"}">← 返回申请记录</button><header><span class="eyebrow">${supplementTarget ? "SUPPLEMENT" : "NEW APPLICATION"}</span><h1 class="page-heading">${supplementTarget ? "补交证明材料" : "提交免测申请"}</h1><p class="page-caption">${supplementTarget ? `正在为 ${escapeHtml(type)} 申请补交新的有效材料` : "请填写真实原因并上传有效证明"}</p></header>${error ? `<div class="notice risk-notice">${escapeHtml(error)}</div>` : ""}<form id="exemption-form" class="card exemption-form"><div class="card-body page-stack"><label class="field"><span>免测项目</span><select name="type" ${supplementTarget ? "disabled" : ""}><option ${type === "800m" ? "selected" : ""}>800m</option><option ${type === "1000m" ? "selected" : ""}>1000m</option></select>${supplementTarget ? `<input type="hidden" name="type" value="${escapeHtml(type)}">` : ""}</label>${supplementTarget ? "" : '<label class="field"><span>申请原因</span><textarea name="reason" maxlength="500" placeholder="请说明伤病情况、医生建议或其他原因"></textarea></label>'}<label class="upload-picker"><input id="exemption-proof-picker" type="file" accept="image/*" multiple><span>＋ 添加证明图片</span></label><div class="exemption-upload-list">${proofs.map((proof) => `<div><span><strong>${escapeHtml(proof.file?.name || "证明文件")}</strong><small>${formatBytes(proof.size)}</small></span><button type="button" class="text-action" data-action="remove-exemption-upload" data-upload-id="${escapeHtml(proof.id)}">删除</button></div>`).join("") || '<p class="page-caption">尚未选择证明文件</p>'}</div><button class="button button-primary button-block" ${busy ? "disabled" : ""}>${busy ? "提交中…" : supplementTarget ? "提交补充材料" : "提交免测申请"}</button></div></form></section>`;
}
