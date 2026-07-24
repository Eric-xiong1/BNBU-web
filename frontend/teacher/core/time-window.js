/**
 * 统一时间窗模型 — 打卡设置（课程级 startsAt / endsAt）使用。
 * 生命周期派生仅用于展示；保存后以服务端回读为准。
 */
(function (global) {
  const LIFECYCLE = {
    NOT_STARTED: "未开始",
    ACTIVE: "进行中",
    ENDED: "已结束",
  };

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  /** ISO → datetime-local value (local TZ) */
  function toDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /** datetime-local → ISO with local offset */
  function fromDatetimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const oh = pad(Math.floor(Math.abs(offset) / 60));
    const om = pad(Math.abs(offset) % 60);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sign}${oh}:${om}`;
  }

  function deriveLifecycle(startsAt, endsAt, now = new Date()) {
    const start = startsAt ? new Date(startsAt) : null;
    const end = endsAt ? new Date(endsAt) : null;
    const t = now instanceof Date ? now : new Date(now);
    if (start && !Number.isNaN(start.getTime()) && t < start) return LIFECYCLE.NOT_STARTED;
    if (end && !Number.isNaN(end.getTime()) && t > end) return LIFECYCLE.ENDED;
    if (start || end) return LIFECYCLE.ACTIVE;
    return LIFECYCLE.ACTIVE;
  }

  function validateTimeWindow(startsAt, endsAt) {
    if (!startsAt || !endsAt) {
      return { ok: false, message: "请填写开始与结束时间" };
    }
    const s = new Date(startsAt);
    const e = new Date(endsAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
      return { ok: false, message: "时间格式无效" };
    }
    if (e < s) {
      return { ok: false, message: "结束时间必须晚于或等于开始时间" };
    }
    return { ok: true, message: "" };
  }

  function lifecycleBadgeClass(status) {
    if (status === LIFECYCLE.NOT_STARTED) return "status-pending";
    if (status === LIFECYCLE.ACTIVE) return "status-ok";
    if (status === LIFECYCLE.ENDED) return "status-warn";
    return "status-info";
  }

  function lifecycleBadgeHtml(status) {
    const s = status || LIFECYCLE.ACTIVE;
    return `<span class="badge ${lifecycleBadgeClass(s)} lifecycle-badge">${s}</span>`;
  }

  function formatWindowRange(startsAt, endsAt) {
    const fmt = (iso) => {
      if (!iso) return "—";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(iso);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    return `${fmt(startsAt)} → ${fmt(endsAt)}`;
  }

  function escAttr(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  /**
   * @param {{ idPrefix: string, value?: object, showDailyWindow?: boolean, includeHint?: boolean }} opts
   * @returns {string} HTML
   */
  function renderTimeWindowEditor(opts) {
    const idPrefix = opts.idPrefix || "tw";
    const v = opts.value || {};
    const showDaily = !!opts.showDailyWindow;
    const includeHint = opts.includeHint !== false;
    const startsLocal = toDatetimeLocal(v.startsAt);
    const endsLocal = toDatetimeLocal(v.endsAt);
    const dailyStart = v.dailyWindowStart || v.windowStart || "06:00";
    const dailyEnd = v.dailyWindowEnd || v.windowEnd || "22:00";
    const lifecycle = v.lifecycleStatus || deriveLifecycle(v.startsAt, v.endsAt);

    let html = `
      <div class="time-window-editor" data-tw-prefix="${escAttr(idPrefix)}">
        ${includeHint ? `<p class="box-hint tw-hint">修改起止时间不会删除已有打卡记录</p>` : ""}
        <div class="tw-lifecycle-row">
          <span class="field-label">活动状态</span>
          ${lifecycleBadgeHtml(lifecycle)}
          <span class="box-hint tw-lifecycle-note">（业务态，与发布态无关）</span>
        </div>
        <label class="field">
          <span class="field-label">开始时间</span>
          <input type="datetime-local" class="field-input" id="${escAttr(idPrefix)}-starts" value="${escAttr(startsLocal)}" />
        </label>
        <label class="field">
          <span class="field-label">结束时间</span>
          <input type="datetime-local" class="field-input" id="${escAttr(idPrefix)}-ends" value="${escAttr(endsLocal)}" />
        </label>
        <p class="field-error" id="${escAttr(idPrefix)}-error" hidden></p>`;

    if (showDaily) {
      html += `
        <label class="field">
          <span class="field-label">每日打卡开始</span>
          <input type="time" class="field-input" id="${escAttr(idPrefix)}-daily-start" value="${escAttr(dailyStart)}" />
        </label>
        <label class="field">
          <span class="field-label">每日打卡截止</span>
          <input type="time" class="field-input" id="${escAttr(idPrefix)}-daily-end" value="${escAttr(dailyEnd)}" />
        </label>`;
    }

    html += `</div>`;
    return html;
  }

  function readTimeWindowEditor(idPrefix, showDailyWindow) {
    const startsLocal = document.getElementById(`${idPrefix}-starts`)?.value || "";
    const endsLocal = document.getElementById(`${idPrefix}-ends`)?.value || "";
    const startsAt = fromDatetimeLocal(startsLocal);
    const endsAt = fromDatetimeLocal(endsLocal);
    const result = {
      startsAt,
      endsAt,
      lifecycleStatus: deriveLifecycle(startsAt, endsAt),
    };
    if (showDailyWindow) {
      result.dailyWindowStart = document.getElementById(`${idPrefix}-daily-start`)?.value || "";
      result.dailyWindowEnd = document.getElementById(`${idPrefix}-daily-end`)?.value || "";
      result.windowStart = result.dailyWindowStart;
      result.windowEnd = result.dailyWindowEnd;
    }
    return result;
  }

  function showEditorError(idPrefix, message) {
    const el = document.getElementById(`${idPrefix}-error`);
    if (!el) return;
    if (message) {
      el.hidden = false;
      el.textContent = message;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  /**
   * 改期确认。返回 false 表示用户取消。
   * @param {{ recordCount?: number, prevStartsAt?: string, prevEndsAt?: string, nextStartsAt?: string, nextEndsAt?: string }} opts
   */
  function confirmWindowChange(opts = {}) {
    const hadPrev = !!(opts.prevStartsAt || opts.prevEndsAt);
    const changed =
      (opts.prevStartsAt || "") !== (opts.nextStartsAt || "") ||
      (opts.prevEndsAt || "") !== (opts.nextEndsAt || "");
    if (!hadPrev || !changed) return true;
    const n = opts.recordCount;
    const msg =
      n != null && n > 0
        ? `修改起止时间不会删除已有打卡记录（当前约 ${n} 条）。确认保存？`
        : "已有打卡记录不会被删除。确认修改起止时间？";
    return global.confirm(msg);
  }

  global.TimeWindow = {
    LIFECYCLE,
    toDatetimeLocal,
    fromDatetimeLocal,
    deriveLifecycle,
    validateTimeWindow,
    lifecycleBadgeClass,
    lifecycleBadgeHtml,
    formatWindowRange,
    renderTimeWindowEditor,
    readTimeWindowEditor,
    showEditorError,
    confirmWindowChange,
  };
})(window);
