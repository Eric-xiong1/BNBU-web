/**
 * 全屏证据预览器：缩略图入口打开，原图按需加载。
 * 状态：loading | ready | error | forbidden
 */
(function (global) {
  const state = {
    open: false,
    attachments: [],
    index: 0,
    zoom: 1,
    status: "loading",
    restore: null,
    keyHandler: null,
  };

  function dlg() {
    return document.getElementById("media-dialog");
  }

  function contentEl() {
    return document.getElementById("dialog-media");
  }

  function current() {
    return state.attachments[state.index] || null;
  }

  function isVideo(att) {
    if (!att) return false;
    const kind = att.kind || att.type || att.mediaType || "";
    return kind === "video" || String(att.mime || "").startsWith("video/");
  }

  function captureRestoreContext(extra) {
    const statusFilter = document.querySelector("#status-filter .chip.active")?.dataset.status || "all";
    const studentSearch = document.getElementById("student-search")?.value || "";
    return {
      scrollY: global.scrollY || 0,
      statusFilter,
      studentSearch,
      checkinLevel: extra?.checkinLevel,
      classId: extra?.classId,
      className: extra?.className,
      studentId: extra?.studentId,
      studentName: extra?.studentName,
      pageId: document.querySelector(".page.active")?.id || null,
      ...extra,
    };
  }

  function applyRestore() {
    const r = state.restore;
    if (!r) return;
    if (r.statusFilter) {
      document.querySelectorAll("#status-filter .chip").forEach((c) => {
        c.classList.toggle("active", c.dataset.status === r.statusFilter);
      });
    }
    const search = document.getElementById("student-search");
    if (search && r.studentSearch != null) search.value = r.studentSearch;
    if (typeof r.onRestore === "function") {
      try {
        r.onRestore(r);
      } catch (err) {
        console.warn("[media-viewer] restore failed", err);
      }
    }
    global.requestAnimationFrame(() => {
      global.scrollTo(0, r.scrollY || 0);
    });
  }

  function setStatus(status) {
    state.status = status;
    render();
  }

  function renderChrome() {
    const att = current();
    const total = state.attachments.length;
    const label = att?.name || att?.desc || `材料 ${state.index + 1}`;
    return `
      <div class="mv-toolbar">
        <button type="button" class="btn btn-text mv-btn" data-mv="prev" ${state.index <= 0 ? "disabled" : ""} title="上一张">‹</button>
        <span class="mv-counter">${total ? state.index + 1 : 0} / ${total}</span>
        <button type="button" class="btn btn-text mv-btn" data-mv="next" ${state.index >= total - 1 ? "disabled" : ""} title="下一张">›</button>
        <button type="button" class="btn btn-text mv-btn" data-mv="zoom-out" title="缩小">−</button>
        <span class="mv-zoom">${Math.round(state.zoom * 100)}%</span>
        <button type="button" class="btn btn-text mv-btn" data-mv="zoom-in" title="放大">+</button>
        <button type="button" class="btn btn-text mv-btn" data-mv="close" title="关闭">关闭</button>
      </div>
      <p class="mv-caption">${escapeHtml(label)}</p>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderBody() {
    if (state.status === "loading") {
      return `<div class="mv-state">加载中…</div>`;
    }
    if (state.status === "forbidden") {
      return `<div class="mv-state mv-error">
        <p>无权限查看</p>
        <button type="button" class="btn btn-secondary" data-mv="retry">重试</button>
      </div>`;
    }
    if (state.status === "error") {
      return `<div class="mv-state mv-error">
        <p>加载失败</p>
        <button type="button" class="btn btn-secondary" data-mv="retry">重试</button>
      </div>`;
    }
    const att = current();
    if (!att) return `<div class="mv-state">无材料</div>`;
    const url = att.originalUrl || att.url || att.thumbUrl || att.thumb;
    if (isVideo(att)) {
      return `<div class="mv-stage" style="transform:scale(${state.zoom})">
        <video class="mv-media" controls src="${escapeHtml(url)}" playsinline></video>
      </div>`;
    }
    return `<div class="mv-stage" style="transform:scale(${state.zoom})">
      <img class="mv-media" alt="${escapeHtml(att.name || "证据")}" src="${escapeHtml(url)}" />
    </div>`;
  }

  function bindMediaLoad() {
    const media = contentEl()?.querySelector(".mv-media");
    if (!media) return;
    const fail = (forbidden) => {
      setStatus(forbidden ? "forbidden" : "error");
    };
    if (media.tagName === "IMG") {
      if (media.complete && media.naturalWidth > 0) return;
      media.addEventListener("error", () => {
        const src = media.getAttribute("src") || "";
        fail(src.includes("forbidden") || media.dataset.forbidden === "1");
      });
      media.addEventListener("load", () => {
        if (state.status === "loading") setStatus("ready");
      });
      // already cached
      if (media.complete) {
        if (media.naturalWidth === 0) fail(false);
        else if (state.status === "loading") setStatus("ready");
      }
    } else if (media.tagName === "VIDEO") {
      media.addEventListener("loadeddata", () => {
        if (state.status === "loading") setStatus("ready");
      });
      media.addEventListener("error", () => fail(false));
    }
  }

  function render() {
    const el = contentEl();
    if (!el) return;
    el.innerHTML = `${renderChrome()}<div class="mv-body">${renderBody()}</div>`;
    el.querySelectorAll("[data-mv]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        onAction(btn.dataset.mv);
      });
    });
    if (state.status === "ready" || state.status === "loading") bindMediaLoad();
  }

  function onAction(action) {
    if (action === "close") {
      close();
      return;
    }
    if (action === "prev") {
      go(-1);
      return;
    }
    if (action === "next") {
      go(1);
      return;
    }
    if (action === "zoom-in") {
      state.zoom = Math.min(3, Math.round((state.zoom + 0.25) * 100) / 100);
      render();
      return;
    }
    if (action === "zoom-out") {
      state.zoom = Math.max(0.5, Math.round((state.zoom - 0.25) * 100) / 100);
      render();
      return;
    }
    if (action === "retry") {
      loadCurrent();
    }
  }

  function go(delta) {
    const next = state.index + delta;
    if (next < 0 || next >= state.attachments.length) return;
    state.index = next;
    state.zoom = 1;
    loadCurrent();
  }

  function loadCurrent() {
    const att = current();
    if (!att) {
      setStatus("error");
      return;
    }
    if (att.forbidden || att.status === 403) {
      setStatus("forbidden");
      return;
    }
    state.status = "loading";
    render();
    // sync ready if data-uri / cached thumb used as original
    const url = att.originalUrl || att.url || att.thumbUrl;
    if (!url) {
      setStatus("error");
      return;
    }
    if (String(url).includes("forbidden=1")) {
      setStatus("forbidden");
      return;
    }
    // Let img/video events flip to ready; for non-network immediate ready fallback
    global.setTimeout(() => {
      if (state.status === "loading" && !isVideo(att) && String(url).startsWith("data:")) {
        setStatus("ready");
      }
    }, 0);
  }

  function onKey(e) {
    if (!state.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go(1);
    }
  }

  /**
   * @param {object|object[]} attachmentOrList
   * @param {number} [index]
   * @param {object} [restoreCtx]
   */
  function open(attachmentOrList, index = 0, restoreCtx) {
    const list = Array.isArray(attachmentOrList)
      ? attachmentOrList
      : attachmentOrList
        ? [normalizeAttachment(attachmentOrList)]
        : [];
    state.attachments = list.map(normalizeAttachment);
    state.index = Math.min(Math.max(0, index), Math.max(0, state.attachments.length - 1));
    state.zoom = 1;
    state.restore = restoreCtx || captureRestoreContext();
    state.open = true;
    if (!state.keyHandler) {
      state.keyHandler = onKey;
      document.addEventListener("keydown", state.keyHandler);
    }
    const dialog = dlg();
    if (dialog && !dialog.open) dialog.showModal();
    loadCurrent();
  }

  function normalizeAttachment(raw) {
    if (!raw) return { kind: "image", thumbUrl: "", originalUrl: "", name: "" };
    if (typeof raw === "string") {
      return { kind: "image", thumbUrl: raw, originalUrl: raw, name: "" };
    }
    const kind =
      raw.kind ||
      (raw.type === "video" || raw.mediaType === "video" ? "video" : "image");
    return {
      id: raw.id,
      kind,
      thumbUrl: raw.thumbUrl || raw.thumb || raw.url || "",
      originalUrl: raw.originalUrl || raw.url || raw.thumbUrl || raw.thumb || "",
      name: raw.name || raw.desc || "",
      mime: raw.mime,
      forbidden: raw.forbidden,
      status: raw.status,
      type: kind === "video" ? "video" : "photo",
      desc: raw.desc || raw.name,
      thumb: raw.thumbUrl || raw.thumb,
    };
  }

  function close() {
    state.open = false;
    const dialog = dlg();
    if (dialog?.open) dialog.close();
    const restore = state.restore;
    state.attachments = [];
    state.index = 0;
    state.zoom = 1;
    state.status = "loading";
    state.restore = null;
    if (state.keyHandler) {
      document.removeEventListener("keydown", state.keyHandler);
      state.keyHandler = null;
    }
    if (restore) {
      state.restore = restore;
      applyRestore();
      state.restore = null;
    }
  }

  function bindDialogUi() {
    const dialog = dlg();
    if (!dialog || dialog.dataset.mvBound) return;
    dialog.dataset.mvBound = "1";
    document.getElementById("dialog-close")?.addEventListener("click", () => close());
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog) close();
    });
    dialog.addEventListener("close", () => {
      if (state.open) {
        state.open = false;
        if (state.keyHandler) {
          document.removeEventListener("keydown", state.keyHandler);
          state.keyHandler = null;
        }
        applyRestore();
        state.restore = null;
      }
    });
  }

  /** 缩略图 HTML：只用 thumbUrl */
  function thumbImgHtml(att, extraClass) {
    const a = normalizeAttachment(att);
    const src = a.thumbUrl;
    if (!src) {
      return `<span class="mv-thumb-fallback">${escapeHtml(a.name || "📷")}</span>`;
    }
    if (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/") || src.startsWith("blob:")) {
      return `<img class="mv-thumb-img ${extraClass || ""}" loading="lazy" alt="${escapeHtml(a.name || "证据")}" src="${escapeHtml(src)}" />`;
    }
    return `<span class="mv-thumb-fallback">${escapeHtml(src)}</span>`;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDialogUi);
  } else {
    bindDialogUi();
  }

  global.MediaViewer = {
    open,
    close,
    normalizeAttachment,
    thumbImgHtml,
    captureRestoreContext,
  };
})(window);
