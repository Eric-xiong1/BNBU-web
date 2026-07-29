// Endurance run score conversion (#35) — scoring/EnduranceScoringScreen.kt
// Exemption applications (#36) — exemption/ExemptionScreen.kt
// The Mock session has no API repository: endurance uses the demo table and
// exemption submission reports the demo-account error, matching Android.

import { t, tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc, spinner, emptyPlaceholder, validationPanel, sectionTitle, statusBadge, statusMessagePanel, segmented, actionButton } from "../ui.js";

// ═══════════════════════════════════════════════════════════════
//  #35 Endurance scoring
// ═══════════════════════════════════════════════════════════════

function enduranceState(app) {
  if (!app.ui.endurance) {
    app.ui.endurance = { minutes: "", seconds: "", result: null, loading: false, error: null };
  }
  return app.ui.endurance;
}

function demographicLabel(student) {
  const gender = student.gender === "male" ? tx("男", "Male") : student.gender === "female" ? tx("女", "Female") : student.gender;
  const grade = { freshman: tx("大一", "Year 1"), sophomore: tx("大二", "Year 2"), junior: tx("大三", "Year 3"), senior: tx("大四", "Year 4") }[student.gradeLevel] || student.gradeLevel;
  return [gender, grade].filter(Boolean).join(" · ");
}

/** Mirrors the initialized demo bands (previewEnduranceResult). */
function previewEnduranceResult(timeSeconds, gender, gradeLevel) {
  const juniorOrSenior = gradeLevel === "junior" || gradeLevel === "senior";
  let bands;
  if (gender === "male" && !juniorOrSenior) {
    bands = [[120, 240, 100, "excellent"], [241, 270, 90, "good"], [271, 330, 80, "pass"], [331, 390, 60, "pass"], [391, 600, 40, "fail"]];
  } else if (gender === "male") {
    bands = [[120, 250, 100, "excellent"], [251, 280, 90, "good"], [281, 340, 80, "pass"], [341, 400, 60, "pass"], [401, 600, 40, "fail"]];
  } else if (!juniorOrSenior) {
    bands = [[120, 210, 100, "excellent"], [211, 240, 90, "good"], [241, 300, 80, "pass"], [301, 360, 60, "pass"], [361, 600, 40, "fail"]];
  } else {
    bands = [[120, 220, 100, "excellent"], [221, 250, 90, "good"], [251, 310, 80, "pass"], [311, 370, 60, "pass"], [371, 600, 40, "fail"]];
  }
  let score = 0;
  let tier = "fail";
  if (timeSeconds < bands[0][0]) {
    score = 100; tier = "excellent";
  } else if (timeSeconds > bands[bands.length - 1][1]) {
    score = 0; tier = "fail";
  } else {
    const band = bands.find(([lo, hi]) => timeSeconds >= lo && timeSeconds <= hi);
    if (band) { score = band[2]; tier = band[3]; }
  }
  return { score, tier, timeSeconds };
}

const tierLabel = (tier) => ({ excellent: tx("优秀", "Excellent"), good: tx("良好", "Good"), pass: tx("及格", "Pass"), fail: tx("不及格", "Fail") }[tier] || tier);

export function renderEnduranceScoring(app) {
  const ui = enduranceState(app);
  const student = app.state.workspace.student;
  const runType = student.gender === "male" ? "1000m" : "800m";
  const label = demographicLabel(student);
  const tierColor = ui.result
    ? { excellent: "var(--color-primary)", good: "#4CAF50", pass: "var(--color-secondary)", fail: "var(--color-error)" }[ui.result.tier] || "var(--color-on-surface-variant)"
    : null;

  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="endurance">
      <div class="col" style="gap:0">
        <button class="row pressable" data-action="services.back" style="height:48px;width:100%;color:var(--color-on-surface)">
          ${icon("chevron-left", 24)}<span class="body-medium">${t("common_back")}</span>
        </button>
        <div style="height:16px"></div>
        ${sectionTitle(t("endurance_title"))}
        <div style="height:8px"></div>
        <div class="swiss-panel">
          <div class="row" style="gap:8px">
            <span class="text-primary" style="display:inline-flex;flex:none">${icon("fitness-center", 22)}</span>
            <div class="col">
              <span class="title-medium text-on-surface">${t("endurance_test", runType)}</span>
              <span class="body-medium text-muted">${esc(label)}</span>
            </div>
          </div>
        </div>
        <div style="height:12px"></div>
        <div class="swiss-panel">
          <div class="label-medium text-primary">${tx("演示试算", "Demo calculation")}</div>
          <div style="height:6px"></div>
          <div class="body-small text-muted">${tx("输入用时后按性别和年级组换算。女生对应 800m，男生对应 1000m。此工具只用于试算，不写入正式成绩。", "Enter a time to calculate by gender and grade group. Women use 800m and men use 1000m. This tool is a preview and does not change official grades.")}</div>
          <div style="height:4px"></div>
          <div class="body-small text-muted">${tx("演示账户使用初始化示例换算表；正式结果以服务器当前启用的换算表为准。", "Demo accounts use the initial sample table. Official results use the conversion table currently enabled by the server.")}</div>
        </div>
        <div style="height:16px"></div>
        <div class="swiss-panel">
          <div class="row" style="gap:12px;align-items:flex-end">
            <div class="col grow">
              <span class="label-medium text-muted">${t("endurance_minutes")}</span>
              <div style="height:6px"></div>
              <input class="text-field" inputmode="numeric" maxlength="2" placeholder="0" value="${esc(ui.minutes)}" data-input="endurance.minutes" />
            </div>
            <span style="font-size:28px;font-weight:500;color:var(--color-on-surface);padding-bottom:10px">′</span>
            <div class="col grow">
              <span class="label-medium text-muted">${t("endurance_seconds")}</span>
              <div style="height:6px"></div>
              <input class="text-field" inputmode="numeric" maxlength="2" placeholder="00" value="${esc(ui.seconds)}" data-input="endurance.seconds" />
            </div>
            <span style="font-size:28px;font-weight:500;color:var(--color-on-surface);padding-bottom:10px">″</span>
          </div>
          <div style="height:14px"></div>
          <button class="primary-btn pressable" data-action="endurance.convert" ${ui.loading ? "disabled" : ""}>
            ${ui.loading ? spinner(18, "on-primary") : icon("timer", 18)}<span>${ui.loading ? t("endurance_converting") : t("endurance_convert")}</span>
          </button>
        </div>
        ${ui.error ? `<div style="height:12px"></div>${validationPanel(ui.error)}` : ""}
        ${ui.result ? `
          <div style="height:16px"></div>
          ${sectionTitle(t("endurance_result"))}
          <div style="height:8px"></div>
          <div class="swiss-panel">
            <div class="row" style="justify-content:space-between">
              <div class="col" style="gap:6px">
                <span class="label-medium text-muted">${t("endurance_score")}</span>
                <span style="font-size:48px;line-height:54px;font-weight:500;color:${tierColor}">${ui.result.score}</span>
              </div>
              <div class="col" style="gap:6px;align-items:flex-end">
                <span class="label-medium text-muted">${t("endurance_level")}</span>
                ${statusBadge(tierLabel(ui.result.tier), true)}
              </div>
            </div>
            <div style="height:14px"></div>
            <div class="endurance-result-strip">
              <span class="text-primary" style="display:inline-flex">${icon("check-circle", 20)}</span>
              <span class="body-medium text-on-surface">${t("endurance_input_time", Math.floor(ui.result.timeSeconds / 60), ui.result.timeSeconds % 60)}</span>
              <span class="body-small text-muted">${esc(label)}</span>
            </div>
          </div>` : ""}
        <div style="height:28px"></div>
      </div>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
//  #36 Exemptions
// ═══════════════════════════════════════════════════════════════

const EXEMPTION_TYPES = {
  "800m": { checkIn: false }, "1000m": { checkIn: false },
  team: { checkIn: true }, club: { checkIn: true },
};

const exemptionTypeLabel = (type) => ({
  "800m": tx("800m 免测", "800 m test exemption"),
  "1000m": tx("1000m 免测", "1000 m test exemption"),
  team: tx("校队免打卡", "Team check-in exemption"),
  club: tx("社团免打卡", "Club check-in exemption"),
}[type] || type);

const exemptionStatusLabel = (status) => ({
  待审核: tx("审核中", "Under review"), 审核中: tx("审核中", "Under review"),
  需补材料: tx("需补材料", "Additional materials required"),
  已通过: tx("已通过", "Approved"), 已驳回: tx("已驳回", "Rejected"), 已过期: tx("已过期", "Expired"),
}[status] || status);

function exemptionState(app, params = {}) {
  if (!app.ui.exemption) {
    const student = app.state.workspace.student;
    app.ui.exemption = {
      tab: "applications",
      selectedId: params.targetId || null,
      resubmitting: null,
      error: null,
      success: null,
      submitting: false,
      form: {
        type: student.gender === "male" ? "1000m" : "800m",
        organization: "",
        reason: "",
        proofs: [],
        notice: null,
      },
    };
  } else if (params.targetId && app.ui.exemption.selectedId !== params.targetId && !app.ui.exemption._consumedTarget) {
    app.ui.exemption.selectedId = params.targetId;
    app.ui.exemption._consumedTarget = true;
  }
  return app.ui.exemption;
}

function exemptionCard(exemption) {
  return `<button class="swiss-panel pressable" data-action="exemption.open" data-exemption-id="${esc(exemption.id)}" style="text-align:left">
    <div class="row" style="align-items:flex-start;gap:10px">
      <span class="text-primary" style="display:inline-flex;flex:none">${icon("fitness-center", 22)}</span>
      <div class="col grow" style="gap:8px">
        <div class="row">
          <span class="title-medium text-on-surface grow">${exemptionTypeLabel(exemption.type)}</span>
          ${statusBadge(exemptionStatusLabel(exemption.status), exemption.status === "已通过")}
        </div>
        ${exemption.reason ? `<div class="row" style="align-items:flex-start;gap:6px">
          <span class="text-muted" style="display:inline-flex;flex:none">${icon("description", 16)}</span>
          <span class="body-medium text-muted">${esc(exemption.reason)}</span>
        </div>` : ""}
        ${exemption.organization ? `<span class="body-medium text-muted">${tx(`所属组织：${exemption.organization}`, `Organization: ${exemption.organization}`)}</span>` : ""}
        ${exemption.proofFiles.length ? `<span class="label-medium text-primary">${tx(`已上传 ${exemption.proofFiles.length} 个证明文件`, `${exemption.proofFiles.length} proof file(s) uploaded`)}</span>` : ""}
        ${exemption.reviewComment ? `<div class="membership-comment">
          <span class="text-primary" style="display:inline-flex;flex:none">${icon("warning", 16)}</span>
          <div class="col">
            <span class="label-medium text-on-surface">${tx("审核意见", "Review comments")}</span>
            <span class="body-small text-muted">${esc(exemption.reviewComment)}</span>
          </div>
        </div>` : ""}
        <span class="label-medium text-muted">${tx(`提交时间：${exemption.createdAt} · 点击查看详情`, `Submitted: ${exemption.createdAt} · View details`)}</span>
      </div>
    </div>
  </button>`;
}

function exemptionDetail(app, exemption) {
  return `<div class="col" style="gap:16px">
    <button class="row pressable" data-action="exemption.detailBack" style="height:48px;width:100%;color:var(--color-on-surface)">
      ${icon("chevron-left", 24)}<span class="body-medium">${tx("返回我的申请", "Back to my applications")}</span>
    </button>
    ${sectionTitle(exemptionTypeLabel(exemption.type))}
    <div class="swiss-panel">
      <div class="row">
        <span class="title-medium text-on-surface grow">${tx("申请状态", "Application status")}</span>
        ${statusBadge(exemptionStatusLabel(exemption.status), exemption.status === "已通过")}
      </div>
      <div style="height:14px"></div>
      ${exemption.organization ? `<div class="body-medium text-muted">${tx(`所属组织：${exemption.organization}`, `Organization: ${exemption.organization}`)}</div><div style="height:8px"></div>` : ""}
      <div class="body-medium text-muted">${tx(`申请理由：${exemption.reason}`, `Application reason: ${exemption.reason}`)}</div>
      <div style="height:8px"></div>
      <div class="label-medium text-muted">${tx(`提交时间：${exemption.createdAt}`, `Submitted: ${exemption.createdAt}`)}</div>
    </div>
    <div class="swiss-panel">
      <div class="title-medium text-on-surface">${tx("证明材料", "Supporting documents")}</div>
      <div style="height:10px"></div>
      ${exemption.proofFiles.length === 0
        ? `<div class="body-medium text-muted">${tx("尚未上传证明材料", "No supporting documents uploaded")}</div>`
        : exemption.proofFiles.map((proof, index) => `<div class="body-medium text-muted">${index + 1}. ${esc(proof.split("/").pop() || tx("证明文件", "Proof file"))}</div>`).join("")}
    </div>
    ${exemption.reviewComment ? `<div class="swiss-panel">
      <div class="title-medium text-on-surface">${tx("处理意见", "Review comments")}</div>
      <div style="height:8px"></div>
      <div class="body-medium text-muted">${esc(exemption.reviewComment)}</div>
    </div>` : ""}
    ${exemption.status === "需补材料" || exemption.status === "已驳回"
      ? actionButton({ label: tx("补交证明材料", "Submit additional documents"), iconName: "upload-file", action: "exemption.supplement", filled: true })
      : ""}
  </div>`;
}

function newExemptionForm(app, ui) {
  const student = app.state.workspace.student;
  const form = ui.form;
  const initial = ui.resubmitting;
  const exemptions = app.state.workspace.exemptions;
  const pendingTypes = new Set(exemptions.filter((e) => e.status === "待审核" || e.status === "审核中").map((e) => e.type));
  const hasPendingSameType = !initial && pendingTypes.has(form.type);
  const runTypes = student.gender === "male" ? ["1000m"] : ["800m"];
  const availableTypes = [...runTypes, "team", "club"];
  const isCheckInType = EXEMPTION_TYPES[form.type]?.checkIn;
  const maxAttachments = 5;
  const typeRows = [];
  for (let i = 0; i < availableTypes.length; i += 2) typeRows.push(availableTypes.slice(i, i + 2));

  return `<div class="swiss-panel"><div class="col" style="gap:16px">
    ${initial ? `<span class="body-medium text-primary">${tx(`正在为 ${exemptionTypeLabel(initial.type)} 补交证明，请上传新的有效材料。`, `Submitting additional documents for ${exemptionTypeLabel(initial.type)}. Upload new valid documents.`)}</span>` : `
      <span class="label-medium text-muted">${tx("选择申请类型", "Select application type")}</span>
      <div class="col" style="gap:10px">
        ${typeRows.map((row) => `<div class="row" style="gap:10px">${row
          .map((type) => `<button class="exemption-type-btn pressable${form.type === type ? " selected" : ""}" data-action="exemption.selectType" data-value="${type}" ${ui.submitting || pendingTypes.has(type) ? "disabled" : ""}>${exemptionTypeLabel(type)}</button>`)
          .join("")}</div>`).join("")}
      </div>
      ${hasPendingSameType ? validationPanel(tx("你已有一个相同类型的待审核申请，请等待教师处理后再提交新申请。", "You already have a pending application of this type. Wait for the teacher's decision before submitting another.")) : ""}`}
    ${isCheckInType ? `<div class="col" style="gap:6px">
      <span class="label-medium text-muted">${tx("组织名称", "Organization name")}</span>
      <input class="text-field" maxlength="128" value="${esc(form.organization)}" placeholder="${tx("填写校队或社团名称", "Enter the team or club name")}" data-input="exemption.organization" ${ui.submitting ? "disabled" : ""} />
    </div>` : ""}
    <div class="col" style="gap:6px">
      <span class="label-medium text-muted">${initial ? tx("补充说明", "Additional notes") : tx("申请理由", "Application reason")}</span>
      <textarea class="text-field" rows="3" maxlength="2000" data-input="exemption.reason" ${ui.submitting ? "disabled" : ""} placeholder="${initial
        ? tx("请说明本次补充材料的内容...", "Describe the additional documents...")
        : isCheckInType
          ? tx("请说明组织身份及申请原因...", "Describe your organization identity and reason...")
          : tx("请说明申请免测的原因...", "Explain why you are applying for an exemption...")}">${esc(form.reason)}</textarea>
    </div>
    <div class="col" style="gap:6px">
      <div class="row">
        <span class="label-medium text-muted grow">${tx("证明材料", "Supporting documents")}</span>
        <span class="label-medium text-muted">${tx(`${form.proofs.length} / ${maxAttachments} 个文件`, `${form.proofs.length} / ${maxAttachments} files`)}</span>
      </div>
      <div class="row" style="gap:10px">
        ${actionButton({ label: tx("拍照", "Take photo"), iconName: "camera-alt", action: "exemption.takePhoto", filled: form.proofs.length < maxAttachments, disabled: ui.submitting || form.proofs.length >= maxAttachments })}
        ${actionButton({ label: tx("选择照片", "Choose photos"), iconName: "upload-file", action: "exemption.choosePhotos", filled: form.proofs.length < maxAttachments, disabled: ui.submitting || form.proofs.length >= maxAttachments })}
      </div>
      <input type="file" accept="image/*" capture="environment" style="display:none" data-change="exemption.photoPicked" data-exemption-input="camera" />
      <input type="file" accept="image/*" multiple style="display:none" data-change="exemption.photosPicked" data-exemption-input="gallery" />
      ${form.notice ? `<span class="label-medium text-primary">${esc(form.notice)}</span>` : ""}
      ${form.proofs.length === 0
        ? `<span class="body-small text-muted">${isCheckInType
            ? tx("请上传能够证明校队或社团身份的材料。", "Upload documents that prove your team or club membership.")
            : tx("请至少上传 1 份医院证明或诊断材料。", "Upload at least one hospital certificate or diagnostic document.")}</span>`
        : form.proofs.map((proof) => `<div class="exemption-proof-row">
            <span class="text-on-surface" style="display:inline-flex;flex:none">${icon("photo", 24)}</span>
            <div class="col grow" style="gap:3px;min-width:0">
              <span style="font-size:13px;font-weight:500;color:var(--color-on-surface)" class="ellipsis">${esc(proof.name)}</span>
              <span class="label-medium text-muted">${tx("图片", "Image")} · ${(proof.size / 1_000_000).toFixed(1)} MB</span>
            </div>
            <button class="icon-btn pressable" data-action="exemption.removeProof" data-proof-id="${esc(proof.id)}" ${ui.submitting ? "disabled" : ""} aria-label="${tx("移除", "Remove")}" style="width:32px;height:32px">${icon("delete", 18)}</button>
          </div>`).join("")}
    </div>
    <button class="primary-btn pressable${ui.submitting ? " is-loading" : ""}" data-action="exemption.submit" ${!ui.submitting && app.isWriteAllowed() && !hasPendingSameType ? "" : "disabled"}>
      ${ui.submitting ? spinner(18, "on-primary") : icon("add", 20)}
      <span>${ui.submitting ? tx("提交中...", "Submitting...") : initial ? tx("提交补充材料", "Submit additional documents") : tx("提交申请", "Submit application")}</span>
    </button>
  </div></div>`;
}

export function renderExemption(app, params) {
  const ui = exemptionState(app, params);
  const exemptions = app.state.workspace.exemptions;
  const selected = ui.selectedId ? exemptions.find((e) => e.id === ui.selectedId) : null;

  let inner;
  if (selected) {
    inner = exemptionDetail(app, selected);
  } else {
    const listBody = ui.tab === "applications"
      ? exemptions.length === 0
        ? emptyPlaceholder(tx("暂无申请", "No applications"), tx("你还没有提交过免测或免打卡申请。", "You have not submitted a test- or check-in-exemption application."))
        : exemptions.map(exemptionCard).join("")
      : newExemptionForm(app, ui);
    inner = `<div class="col" style="gap:16px">
      <button class="row pressable" data-action="exemption.back" ${ui.submitting ? "disabled" : ""} style="height:48px;width:100%;color:var(--color-on-surface)">
        ${icon("chevron-left", 24)}<span class="body-medium">${tx("返回", "Back")}</span>
      </button>
      ${sectionTitle(tx("体育免测与免打卡申请", "Test and check-in exemptions"))}
      <div class="swiss-panel"><div class="col" style="gap:8px">
        <span class="label-medium text-primary">${tx("演示数据", "Demo data")}</span>
        <span class="body-medium text-on-surface">${tx("耐力跑免测仅适用于 800m / 1000m；通过后由任课教师为该生单独评定耐力跑分数。", "Endurance-run exemptions apply only to 800 m / 1000 m. After approval, the instructor assigns the endurance-run score individually.")}</span>
        <span class="body-small text-muted">${tx("校队或社团免打卡须填写组织名称并上传证明，审核通过后由教师确认可抵扣的运动时长。", "Team or club check-in exemptions require an organization name and proof. The instructor confirms any eligible hour offset after approval.")}</span>
        <span class="body-small text-muted">${tx("当前为本地演示账户：可查看完整申请状态与材料示例；正式提交请登录已连接服务器的学生账户。", "This is a local demo account. You can view example applications, but must sign in with a server-connected student account to submit one.")}</span>
      </div></div>
      ${segmented({
        items: [
          { value: "applications", label: tx("我的申请", "My applications") },
          { value: "new", label: tx("提交申请", "New application") },
        ],
        selected: ui.tab,
        action: "exemption.tab",
      })}
      ${ui.success ? statusMessagePanel(ui.success, "exemption.dismissSuccess") : ""}
      ${ui.error ? validationPanel(ui.error) : ""}
      ${listBody}
    </div>`;
  }

  return `<div class="screen" style="background:transparent">
    <div class="screen-scroll" data-scroll-key="exemption">${inner}<div style="height:28px"></div></div>
  </div>`;
}

export const servicesActions = {
  "services.back": (app) => {
    app.ui.endurance = null;
    app.closeSub();
  },
  // — Endurance —
  "endurance.minutes": (app, el) => {
    const ui = enduranceState(app);
    ui.minutes = el.value.replace(/\D/g, "").slice(0, 2);
    if (el.value !== ui.minutes) el.value = ui.minutes;
  },
  "endurance.seconds": (app, el) => {
    const ui = enduranceState(app);
    ui.seconds = el.value.replace(/\D/g, "").slice(0, 2);
    if (el.value !== ui.seconds) el.value = ui.seconds;
  },
  "endurance.convert": (app) => {
    const ui = enduranceState(app);
    const student = app.state.workspace.student;
    const minutes = parseInt(ui.minutes, 10) || 0;
    const seconds = parseInt(ui.seconds, 10) || 0;
    const total = minutes * 60 + seconds;
    ui.result = null;
    if (total <= 0) {
      ui.error = t("endurance_invalid_time");
      app.render();
      return;
    }
    if (seconds < 0 || seconds > 59) {
      ui.error = t("endurance_invalid_seconds");
      app.render();
      return;
    }
    if (!student.gender) {
      ui.error = t("endurance_gender_required");
      app.render();
      return;
    }
    if (!student.gradeLevel) {
      ui.error = t("endurance_grade_required");
      app.render();
      return;
    }
    // Demo account: the initialized sample table computes the preview locally.
    ui.error = null;
    ui.result = previewEnduranceResult(total, student.gender, student.gradeLevel);
    app.render();
  },
  // — Exemption —
  "exemption.back": (app) => {
    app.ui.exemption = null;
    app.closeSub();
  },
  "exemption.tab": (app, el) => {
    const ui = exemptionState(app);
    if (ui.submitting) return;
    ui.tab = el.dataset.value;
    app.render();
  },
  "exemption.open": (app, el) => {
    const ui = exemptionState(app);
    ui.selectedId = el.dataset.exemptionId;
    app.navDirection = "forward";
    app.render();
  },
  "exemption.detailBack": (app) => {
    const ui = exemptionState(app);
    ui.selectedId = null;
    app.navDirection = "back";
    app.render();
  },
  "exemption.supplement": (app) => {
    const ui = exemptionState(app);
    ui.resubmitting = app.state.workspace.exemptions.find((e) => e.id === ui.selectedId) || null;
    ui.selectedId = null;
    ui.tab = "new";
    ui.form.reason = "";
    ui.form.organization = ui.resubmitting?.organization || "";
    app.render();
  },
  "exemption.selectType": (app, el) => {
    const ui = exemptionState(app);
    ui.form.type = el.dataset.value;
    if (!EXEMPTION_TYPES[ui.form.type]?.checkIn) ui.form.organization = "";
    app.render();
  },
  "exemption.organization": (app, el) => { exemptionState(app).form.organization = el.value.slice(0, 128); },
  "exemption.reason": (app, el) => { exemptionState(app).form.reason = el.value.slice(0, 2000); },
  "exemption.takePhoto": (app) => app._viewport?.querySelector('[data-exemption-input="camera"]')?.click(),
  "exemption.choosePhotos": (app) => app._viewport?.querySelector('[data-exemption-input="gallery"]')?.click(),
  "exemption.photoPicked": (app, el) => {
    const ui = exemptionState(app);
    const file = el.files?.[0];
    el.value = "";
    if (!file) return;
    if (ui.form.proofs.length >= 5) {
      ui.form.notice = tx("已达到 5 个凭证上限。", "Maximum of 5 proof items reached.");
    } else {
      ui.form.proofs.push({ id: `proof-${Date.now()}`, name: file.name, size: file.size });
      ui.form.notice = tx("已拍摄 1 张凭证照片。", "Captured 1 proof photo.");
    }
    app.render();
  },
  "exemption.photosPicked": (app, el) => {
    const ui = exemptionState(app);
    const remaining = Math.max(0, 5 - ui.form.proofs.length);
    const files = [...(el.files || [])].slice(0, remaining);
    el.value = "";
    for (const file of files) {
      ui.form.proofs.push({ id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, name: file.name, size: file.size });
    }
    ui.form.notice = files.length
      ? tx(`已添加 ${files.length} 个凭证。`, `Added ${files.length} proof item(s).`)
      : null;
    app.render();
  },
  "exemption.removeProof": (app, el) => {
    const ui = exemptionState(app);
    ui.form.proofs = ui.form.proofs.filter((p) => p.id !== el.dataset.proofId);
    app.render();
  },
  "exemption.dismissSuccess": (app) => {
    exemptionState(app).success = null;
    app.render();
  },
  "exemption.submit": (app) => {
    const ui = exemptionState(app);
    if (ui.submitting || !app.isWriteAllowed()) return;
    const reason = ui.form.reason.trim();
    if (reason.length < 2) {
      ui.error = tx("申请理由或补充说明至少需要 2 个字符", "The application reason or additional notes must contain at least 2 characters.");
      app.render();
      return;
    }
    if (EXEMPTION_TYPES[ui.form.type]?.checkIn && !ui.form.organization.trim()) {
      ui.error = tx("请填写校队或社团名称", "Enter the team or club name.");
      app.render();
      return;
    }
    if (ui.form.proofs.length === 0) {
      ui.error = tx("请至少上传 1 个申请证明", "Upload at least one supporting document.");
      app.render();
      return;
    }
    // Demo account has no API repository — official submissions are rejected.
    ui.error = tx("演示账户不发送正式申请；请使用已连接服务器的学生账户提交材料。", "Demo accounts cannot submit applications. Use a student account connected to the server.");
    app.render();
  },
};

// Detail back and submitting lock (免测详情返回列表；提交中禁用返回).
export function servicesBackInterceptor(app) {
  if (app.state.subScreen === "exemption" && app.ui.exemption) {
    if (app.ui.exemption.submitting) {
      app.ui.exemption.error = tx("申请正在提交，请等待完成后再返回", "Your application is being submitted. Please wait.");
      app.render();
      return true;
    }
    if (app.ui.exemption.selectedId) {
      app.ui.exemption.selectedId = null;
      app.navDirection = "back";
      app.render();
      return true;
    }
  }
  return false;
}
