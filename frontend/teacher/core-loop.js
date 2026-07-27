/**
 * 教师端核心闭环：成绩规则 / 平时表现板 / 成绩发布与申诉 UI
 */
(function (global) {
  const API = global.API;
  let rulesCourseId = "c1";
  let rulesDraft = null;
  let showPageRef = null;

  const STATUS_LABEL = {
    rules_draft: "规则未发布",
    recording: "录入中",
    publicity: "公示中",
    ready_archive: "待归档",
  };

  function esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function typeLabel(t) {
    return { checkin: "体育打卡", final: "专项考试", attendance: "平时表现", physical: "体测", custom: "自定义" }[t] || t;
  }

  async function ensureRulesCourse() {
    const courses = (await API.getCourses()) || [];
    const teacher = courses.filter((c) => ["c1", "c3"].includes(c.id)).length
      ? courses.filter((c) => ["c1", "c3"].includes(c.id))
      : courses;
    if (!teacher.some((c) => c.id === rulesCourseId)) rulesCourseId = teacher[0]?.id || "c1";
    return teacher;
  }

  async function renderGradeRules() {
    const courses = await ensureRulesCourse();
    const sel = document.getElementById("grade-rules-course");
    if (sel) {
      sel.innerHTML = courses.map((c) => `<option value="${esc(c.id)}"${c.id === rulesCourseId ? " selected" : ""}>${esc(c.name)}</option>`).join("");
    }
    const rule = rulesDraft || (await API.getCourseGradeRule(rulesCourseId));
    rulesDraft = rule;
    const pill = document.getElementById("grade-rules-status-pill");
    if (pill) {
      pill.textContent = rule.status === "published" ? `已发布 v${rule.version}` : "草稿";
      pill.className = `status-pill ${rule.status === "published" ? "status-ok" : "status-warn"}`;
    }
    const frozen = rule.status === "published";
    const sum = (rule.items || []).reduce((s, it) => s + Number(it.weight || 0), 0);
    const kpi = document.getElementById("grade-rules-kpi");
    if (kpi) {
      kpi.innerHTML = `
        <div class="kpi-card"><span class="kpi-label">状态</span><span class="kpi-value">${frozen ? "已冻结" : "可编辑"}</span></div>
        <div class="kpi-card"><span class="kpi-label">权重合计</span><span class="kpi-value">${Math.round(sum * 100)}%</span></div>
        <div class="kpi-card"><span class="kpi-label">专项子项</span><span class="kpi-value">${(rule.finalSubItems || []).length}</span></div>
        <div class="kpi-card"><span class="kpi-label">版本</span><span class="kpi-value">${rule.version || 0}</span></div>`;
    }
    const hint = document.getElementById("grade-rules-weight-hint");
    if (hint) {
      hint.textContent =
        Math.abs(sum - 1) > 0.01 ? `权重合计须为 100%，当前 ${Math.round(sum * 100)}%` : "权重合法 · 发布后结构与权重冻结";
    }
    const body = document.getElementById("grade-rules-items-body");
    if (body) {
      body.innerHTML = (rule.items || [])
        .map(
          (it, i) => `<tr>
          <td>${esc(typeLabel(it.type))}</td>
          <td><input class="field-input field-input-sm" data-rule-name="${i}" value="${esc(it.name)}" ${frozen ? "disabled" : ""} /></td>
          <td><input class="field-input field-input-sm" type="number" min="0" max="100" data-rule-weight="${i}" value="${Math.round(Number(it.weight || 0) * 100)}" ${frozen ? "disabled" : ""} /> %</td>
          <td>${it.locked || it.type !== "custom" ? "—" : `<button type="button" class="btn btn-text" data-rule-del="${i}" ${frozen ? "disabled" : ""}>删除</button>`}</td>
        </tr>`
        )
        .join("");
    }
    const sub = document.getElementById("grade-rules-subitems-body");
    if (sub) {
      sub.innerHTML = (rule.finalSubItems || []).length
        ? rule.finalSubItems
            .map(
              (it, i) => `<tr>
            <td><input class="field-input field-input-sm" data-sub-label="${i}" value="${esc(it.label)}" ${frozen ? "disabled" : ""} /></td>
            <td><code>${esc(it.key)}</code></td>
            <td><input class="field-input field-input-sm" data-sub-unit="${i}" value="${esc(it.unit || "")}" ${frozen ? "disabled" : ""} /></td>
            <td><button type="button" class="btn btn-text" data-sub-del="${i}" ${frozen ? "disabled" : ""}>删除</button></td>
          </tr>`
            )
            .join("")
        : `<tr><td colspan="4" class="table-empty">暂无子项</td></tr>`;
    }
    const ver = document.getElementById("grade-rules-version-text");
    if (ver) {
      ver.textContent = frozen
        ? `已发布 v${rule.version} · ${rule.publishedAt || ""} · 结构已冻结`
        : "尚未发布 · 学生可正常打卡，不可见正式分项构成";
    }
    document.getElementById("btn-grade-rules-save").disabled = frozen;
    document.getElementById("btn-grade-rules-publish").disabled = frozen;
    document.getElementById("btn-grade-rules-add-custom").disabled = frozen;
    document.getElementById("btn-grade-rules-add-sub").disabled = frozen;
  }

  function collectRulesDraftFromDom() {
    if (!rulesDraft) return null;
    document.querySelectorAll("[data-rule-name]").forEach((el) => {
      const i = Number(el.dataset.ruleName);
      if (rulesDraft.items[i]) rulesDraft.items[i].name = el.value.trim() || rulesDraft.items[i].name;
    });
    document.querySelectorAll("[data-rule-weight]").forEach((el) => {
      const i = Number(el.dataset.ruleWeight);
      if (rulesDraft.items[i]) rulesDraft.items[i].weight = (Number(el.value) || 0) / 100;
    });
    document.querySelectorAll("[data-sub-label]").forEach((el) => {
      const i = Number(el.dataset.subLabel);
      if (rulesDraft.finalSubItems[i]) rulesDraft.finalSubItems[i].label = el.value.trim() || rulesDraft.finalSubItems[i].label;
    });
    document.querySelectorAll("[data-sub-unit]").forEach((el) => {
      const i = Number(el.dataset.subUnit);
      if (rulesDraft.finalSubItems[i]) rulesDraft.finalSubItems[i].unit = el.value.trim();
    });
    return rulesDraft;
  }

  async function renderAttendanceBoard() {
    const root = document.getElementById("legacy-attendance-scores-root");
    if (!root) return;
    const courses = await API.getCourses();
    const cid = rulesCourseId || courses[0]?.id || "c1";
    const board = await API.getAttendanceBoard(cid);
    const sessions = board.sessions || [];
    const rules = board.rules || { base: 100, late: 5, leave: 3, absent: 10, floor: 0 };
    root.innerHTML = `
      <div class="legacy-stack">
        <div class="kpi-row">
          <div class="kpi-card"><span class="kpi-label">课次数</span><span class="kpi-value">${sessions.length}</span></div>
          <div class="kpi-card"><span class="kpi-label">基数分</span><span class="kpi-value">${rules.base}</span></div>
          <div class="kpi-card"><span class="kpi-label">学生数</span><span class="kpi-value">${board.students.length}</span></div>
        </div>
        <div class="box">
          <div class="box-header"><h2 class="h2">扣分规则</h2>
            <button class="btn btn-primary" type="button" id="btn-att-save">保存平时表现</button>
          </div>
          <div class="toolbar-inline">
            <label class="field">基数 <input class="field-input field-input-sm" id="att-base" type="number" value="${rules.base}" /></label>
            <label class="field">迟到扣 <input class="field-input field-input-sm" id="att-late" type="number" value="${rules.late}" /></label>
            <label class="field">请假扣 <input class="field-input field-input-sm" id="att-leave" type="number" value="${rules.leave}" /></label>
            <label class="field">缺勤扣 <input class="field-input field-input-sm" id="att-absent" type="number" value="${rules.absent}" /></label>
            <label class="field">下限 <input class="field-input field-input-sm" id="att-floor" type="number" value="${rules.floor}" /></label>
          </div>
          <p class="box-hint">未记状态默认视为出勤；可对单人「覆盖分」手工定分。</p>
        </div>
        <div class="box">
          <div class="table-wrap table-scroll-x">
            <table class="data-table data-table-sm">
              <thead><tr><th>学生</th>${sessions.map((s) => `<th>${esc(s.label)}</th>`).join("")}<th>自动分</th><th>覆盖分</th></tr></thead>
              <tbody>
                ${board.students
                  .map((st) => {
                    const rec = st.records || {};
                    return `<tr data-att-student="${esc(st.id)}">
                      <td><strong>${esc(st.name)}</strong><br><small>${esc(st.no)}</small></td>
                      ${sessions
                        .map((s) => {
                          const val = rec[s.id] || "出勤";
                          return `<td><select class="field-input field-input-sm" data-att-sess="${esc(s.id)}">
                            ${["出勤", "迟到", "请假", "缺勤"].map((v) => `<option${val === v ? " selected" : ""}>${v}</option>`).join("")}
                          </select></td>`;
                        })
                        .join("")}
                      <td>${esc(st.score)}</td>
                      <td><input class="field-input field-input-sm" type="number" min="0" max="100" data-att-override value="${rec.override != null ? esc(rec.override) : ""}" placeholder="自动" /></td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    document.getElementById("btn-att-save")?.addEventListener("click", async () => {
      const records = {};
      root.querySelectorAll("[data-att-student]").forEach((tr) => {
        const sid = tr.dataset.attStudent;
        records[sid] = {};
        tr.querySelectorAll("[data-att-sess]").forEach((sel) => {
          records[sid][sel.dataset.attSess] = sel.value;
        });
        const ov = tr.querySelector("[data-att-override]")?.value;
        if (ov !== "" && ov != null) records[sid].override = Number(ov);
      });
      await API.saveAttendanceBoard(cid, {
        rules: {
          base: Number(document.getElementById("att-base").value) || 100,
          late: Number(document.getElementById("att-late").value) || 0,
          leave: Number(document.getElementById("att-leave").value) || 0,
          absent: Number(document.getElementById("att-absent").value) || 0,
          floor: Number(document.getElementById("att-floor").value) || 0,
        },
        records,
      });
      alert("平时表现已保存，将计入总评");
      renderAttendanceBoard();
    });
  }

  async function renderAppeals(courseId) {
    const body = document.getElementById("grade-appeals-body");
    if (!body) return;
    const list = await API.getGradeAppeals(courseId || "");
    const st = await API.getCourseGradeStatus(courseId || "c1");
    const hint = document.getElementById("grade-publicity-hint");
    if (hint) {
      const pub = st.publicity;
      hint.textContent =
        st.status === "publicity" && pub
          ? `公示中 · 截止 ${pub.endsAt || "—"} · ${STATUS_LABEL[st.status] || st.status}`
          : st.status === "ready_archive"
            ? "公示结束 · 待管理员归档"
            : "发布成绩后进入公示；处理完申诉可结束公示";
    }
    const pill = document.getElementById("grade-course-status-pill");
    if (pill) {
      pill.textContent = STATUS_LABEL[st.status] || st.status;
      pill.className = "status-pill";
    }
    body.innerHTML = list.length
      ? list
          .map(
            (a) => `<tr>
          <td>${esc(a.no)}</td><td>${esc(a.name)}</td><td>${esc(a.item)}</td><td>${esc(a.reason)}</td>
          <td><span class="badge ${a.status === "pending" ? "status-pending" : a.status === "accepted" ? "status-ok" : "status-warn"}">${esc(a.status)}</span></td>
          <td>${
            a.status === "pending"
              ? `<button type="button" class="btn btn-text" data-appeal-accept="${esc(a.id)}">采纳</button>
                 <button type="button" class="btn btn-text" data-appeal-reject="${esc(a.id)}">驳回</button>`
              : "—"
          }</td>
        </tr>`
          )
          .join("")
      : `<tr><td colspan="6" class="table-empty">暂无申诉</td></tr>`;
    body.querySelectorAll("[data-appeal-accept]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const note = prompt("采纳说明（将改分）") || "已按申诉修正";
        await API.resolveGradeAppeal(btn.dataset.appealAccept, "accept", note);
        renderAppeals(courseId);
      });
    });
    body.querySelectorAll("[data-appeal-reject]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const note = prompt("驳回理由") || "维持原成绩";
        await API.resolveGradeAppeal(btn.dataset.appealReject, "reject", note);
        renderAppeals(courseId);
      });
    });
  }

  function bindEvents(showPage) {
    showPageRef = showPage;
    document.getElementById("grade-rules-course")?.addEventListener("change", async (e) => {
      rulesCourseId = e.target.value;
      rulesDraft = null;
      await renderGradeRules();
    });
    document.getElementById("btn-grade-rules-save")?.addEventListener("click", async () => {
      const draft = collectRulesDraftFromDom();
      const res = await API.saveCourseGradeRule(rulesCourseId, { ...draft, status: "draft" });
      if (res.success === false) return alert(res.message);
      rulesDraft = null;
      alert("草稿已保存");
      await renderGradeRules();
    });
    document.getElementById("btn-grade-rules-publish")?.addEventListener("click", async () => {
      collectRulesDraftFromDom();
      await API.saveCourseGradeRule(rulesCourseId, { ...rulesDraft, status: "draft" });
      if (!confirm("发布后结构与权重将冻结，确认发布？")) return;
      const res = await API.publishCourseGradeRule(rulesCourseId);
      if (res.success === false) return alert(res.message);
      rulesDraft = null;
      alert("成绩规则已发布");
      await renderGradeRules();
    });
    document.getElementById("btn-grade-rules-add-custom")?.addEventListener("click", () => {
      if (!rulesDraft || rulesDraft.status === "published") return;
      rulesDraft.items.push({ type: "custom", name: "自定义项", weight: 0, locked: false });
      renderGradeRules();
    });
    document.getElementById("btn-grade-rules-add-sub")?.addEventListener("click", () => {
      if (!rulesDraft || rulesDraft.status === "published") return;
      const key = `item_${Date.now()}`;
      rulesDraft.finalSubItems = rulesDraft.finalSubItems || [];
      rulesDraft.finalSubItems.push({ key, label: "新子项", unit: "分" });
      renderGradeRules();
    });
    document.getElementById("btn-grade-rules-void")?.addEventListener("click", () => {
      alert("演示：废止已发布规则需向管理员申请，批准后方可发布新版本。");
    });
    document.body.addEventListener("click", (e) => {
      const del = e.target.closest("[data-rule-del]");
      if (del && rulesDraft) {
        rulesDraft.items.splice(Number(del.dataset.ruleDel), 1);
        renderGradeRules();
      }
      const sdel = e.target.closest("[data-sub-del]");
      if (sdel && rulesDraft) {
        rulesDraft.finalSubItems.splice(Number(sdel.dataset.subDel), 1);
        renderGradeRules();
      }
    });
    document.getElementById("btn-publish-grades")?.addEventListener("click", async () => {
      const courseId = document.getElementById("grade-course-filter")?.value || rulesCourseId || "c1";
      const res = await API.publishCourseGrades(courseId);
      if (res.success === false) return alert(res.message);
      alert("成绩已发布，进入公示期");
      if (showPageRef) showPageRef("grade-summary");
    });
    document.getElementById("btn-end-publicity")?.addEventListener("click", async () => {
      const courseId = document.getElementById("grade-course-filter")?.value || "c1";
      const res = await API.endCoursePublicity(courseId);
      if (res.success === false) return alert(res.message);
      alert("公示结束，课程进入「待归档」（管理员发起归档）");
      if (showPageRef) showPageRef("grade-summary");
    });
  }

  global.CoreLoop = {
    bindEvents,
    renderGradeRules,
    renderAttendanceBoard,
    renderAppeals,
    statusLabel: STATUS_LABEL,
    setRulesCourse(id) {
      rulesCourseId = id;
      rulesDraft = null;
    },
  };
})(window);
