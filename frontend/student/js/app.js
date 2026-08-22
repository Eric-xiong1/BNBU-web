// Root application shell replicated from feature/shell/AppRootScreen.kt.
// Single state machine — no route strings, mirroring the Compose implementation:
//   SystemMode (MAINTENANCE / READ_ONLY / NORMAL+planned banner)
//   AuthUiState: Restoring → CheckingPrivacyConsent → PrivacyConsent → Login/Authenticated
//   AppTab five-tab scaffold + SubScreen overlay + NotificationSheet.

import { t, tx, setLanguage, getLanguage } from "./i18n.js";
import { localStore, BUILD } from "./store.js";
import { emptyWorkspace } from "./data.js";
import {
  hasApiSession,
  clearApiSession,
  logoutApi,
  resolveStudentApiState,
  currentUserFromJoin,
  apiErrorText,
  demoSignIn,
  demoAccountInfo,
  ApiError,
} from "./api.js";
import { icon } from "./icons.js";
import {
  renderStartupSplash,
  renderMaintenancePage,
  renderReadOnlyBanner,
  renderPlannedMaintenanceBanner,
  renderSyncStatusBanner,
} from "./screens/startup.js";
import {
  renderPrivacyConsent,
  renderPrivacyPolicy,
  consentActions,
  loadPolicyMarkdown,
} from "./screens/consent.js";
import {
  renderPreLoginGuide,
  renderPostEnrollmentGuide,
  guideActions,
  guideBackInterceptor,
  attachGuideSwipe,
} from "./screens/guide.js";
import { renderLogin, loginActions } from "./screens/login.js";
import {
  renderVerificationLogin,
  verificationActions,
} from "./screens/verification.js";
import { renderRecoveryRequest, recoveryActions } from "./screens/recovery.js";
import {
  renderContactBinding,
  renderActivationHelp,
  bindingActions,
} from "./screens/binding.js";
import {
  renderScanJoin,
  renderEnterInviteCode,
  renderCourseJoinConfirm,
  renderJoinRequestStatus,
  joinActions,
  joinBackInterceptor,
  attachScanCamera,
  consumeInviteDeepLink,
  beginInviteDeepLink,
} from "./screens/join.js";
import { renderDashboard, dashboardActions } from "./screens/dashboard.js";
import {
  renderNotificationSheet,
  notificationActions,
} from "./screens/notifications.js";
import {
  renderCourses,
  coursesActions,
  coursesBackInterceptor,
} from "./screens/courses.js";
import {
  renderCheckIn,
  checkinActions,
  checkinTick,
  checkinBackInterceptor,
} from "./screens/checkin.js";
import { renderGrades } from "./screens/grades.js";
import {
  renderProfile,
  renderAccountDetails,
  renderSettings,
  profileActions,
} from "./screens/profile.js";
import {
  renderHelpCenter,
  renderFeedback,
  renderAbout,
  renderChangelog,
  supportActions,
} from "./screens/support.js";
import {
  renderEnduranceScoring,
  renderExemption,
  servicesActions,
  servicesBackInterceptor,
} from "./screens/services.js";

const params = new URLSearchParams(globalThis.location?.search || "");
const initialDeepLinkInviteCode = consumeInviteDeepLink(
  globalThis.location,
  globalThis.history,
);

export const app = {
  BUILD,
  state: {
    // System mode is server-owned on Android; preview via ?sysmode= for QA.
    systemMode:
      params.get("sysmode") === "maintenance"
        ? "MAINTENANCE"
        : params.get("sysmode") === "readonly"
          ? "READ_ONLY"
          : "NORMAL",
    systemModeStatus: {
      message: "",
      estimatedRecoveryTime:
        params.get("sysmode") === "maintenance" ? "2026-07-29 06:00" : null,
      plannedMaintenanceAt:
        params.get("sysmode") === "planned" ? "2026-08-01 02:00" : null,
    },
    isRestoringSession: true,
    privacyConsentChecked: false,
    // Filled at startup when the preview server has a demo account (local only).
    demoAccount: null,
    needsPrivacyConsent: false,
    authenticated: false,
    requiresContactBinding: false,
    activationSupportScreen: null, // 'privacy' | 'help'
    workspace: emptyWorkspace(),
    lastError: null,
    isShowingCachedData: false,
    isLoading: false,

    // Pre-auth navigation flags (AppRootContent rememberSaveable set)
    loginPrivacyAccepted: false,
    showLoginPrivacy: false,
    showEmailLogin: false,
    showRecoveryRequest: false,
    showScanJoin: false,
    deepLinkInviteCode: initialDeepLinkInviteCode,
    pendingInvite: null, // { code, course } — pre-login confirm
    preLoginGuideCompleted: localStore.hasCompletedPreLoginCourseGuide(),
    postEnrollmentGuideCompleted: false,

    // Authenticated shell
    tab: "dashboard",
    subScreen: null, // scan|enterCode|joinStatus|joinConfirm|endurance|exemption|account|settings|binding|privacy|help|feedback|about|changelog
    subParams: {},
    notificationSheetOpen: false,
    dialog: null,
  },
  ui: {}, // per-screen transient UI state, owned by screen modules
  actions: {}, // data-action registry
  navDirection: "forward",
  scrollPositions: new Map(),
  lastScreenKey: "",

  // ── Derived helpers ─────────────────────────────────────────
  isWriteAllowed() {
    return this.state.systemMode !== "READ_ONLY";
  },
  hasActiveEnrollment() {
    return this.state.workspace.courses.some(
      (c) => c.isCurrent && c.enrollmentStatus === "enrolled",
    );
  },
  canStartNewCourseJoin() {
    const w = this.state.workspace;
    const activeEnrollment = w.courses.some(
      (c) => c.isCurrent && c.enrollmentStatus === "enrolled",
    );
    const req = w.courseJoinRequest;
    return (
      !activeEnrollment &&
      !(req && (req.status === "PENDING" || req.status === "ACTIVE"))
    );
  },
  visibleNotices() {
    return this.state.workspace.notices.filter((n) => {
      if (n.category !== "review") return true;
      const targets = [
        "exemption",
        "physical_test_exemption",
        "checkin_exemption",
        "application",
      ];
      if (n.targetType && targets.includes(String(n.targetType).toLowerCase()))
        return true;
      const keywords = ["免测", "免打卡", "校队", "社团", "证明材料", "申请"];
      return keywords.some((k) => n.title.includes(k) || n.message.includes(k));
    });
  },
  unreadNoticeCount() {
    return this.visibleNotices().filter((n) => n.isUnread).length;
  },

  // ── Workspace mutations (persisted through the overlay) ──────
  overlay: localStore.getOverlay(),
  saveOverlay() {
    localStore.setOverlay(this.overlay);
  },
  applyOverlay(workspace) {
    const o = this.overlay;
    workspace.notices = workspace.notices.map((n) =>
      o.readNoticeIds.includes(n.id) ? { ...n, isUnread: false } : n,
    );
    workspace.records = [...o.newRecords, ...workspace.records];
    for (const rec of o.newRecords) {
      const hours = Number(rec.hours) || 0;
      if (rec.creditType === "course") {
        workspace.progress.course += hours;
        workspace.progress.rawCourse += hours;
      } else if (rec.creditType === "general") {
        workspace.progress.general += hours;
        workspace.progress.rawGeneral += hours;
      }
    }
    if (o.joinRequest) workspace.courseJoinRequest = o.joinRequest;
    if (o.exemptions.length)
      workspace.exemptions = [...o.exemptions, ...workspace.exemptions];
    return workspace;
  },

  markNoticeRead(id) {
    if (!this.overlay.readNoticeIds.includes(id))
      this.overlay.readNoticeIds.push(id);
    this.saveOverlay();
    const notice = this.state.workspace.notices.find((n) => n.id === id);
    if (notice) notice.isUnread = false;
  },
  markAllNoticesRead() {
    for (const n of this.visibleNotices())
      if (n.isUnread) this.markNoticeRead(n.id);
  },

  openDeepLinkInvite() {
    const code = this.state.deepLinkInviteCode;
    if (!code || this.state.authenticated || this.state.needsPrivacyConsent)
      return false;
    this.state.deepLinkInviteCode = null;
    beginInviteDeepLink(this, code);
    return true;
  },

  // ── Auth ─────────────────────────────────────────────────────
  /** True when the signed-in session talks to the real backend. */
  isApiMode() {
    return localStore.getSession()?.kind === "api";
  },
  /** Establishes the authenticated shell after a successful invite join. */
  async completeApiLogin(joined = {}) {
    const accountId = joined.studentProfile?.studentNumber || null;
    localStore.setSession({
      accountId,
      kind: "api",
      signedInAt: new Date().toISOString(),
    });
    this.state.authenticated = true;
    this.state.postEnrollmentGuideCompleted = accountId
      ? localStore.hasCompletedPostEnrollmentGuide(accountId)
      : false;
    this.navDirection = "forward";
    return this.reloadApiWorkspace({
      currentUser: currentUserFromJoin(joined),
      deferInitialRender: true,
    });
  },
  /**
   * Signs in as the local demo student. It is a real backend account, so this
   * lands on exactly the same authenticated path as an invite join — only the
   * way the session is obtained differs.
   */
  async loginDemoUser() {
    const student = await demoSignIn();
    if (!student)
      throw new ApiError(404, {
        code: "DEMO_ACCOUNT_NOT_CONFIGURED",
        message: "尚未创建演示账号。",
      });
    return this.completeApiLogin({
      studentProfile: { studentNumber: student.studentNumber },
    });
  },
  /** Loads/refreshes the live workspace; keeps the shell usable on failure. */
  async reloadApiWorkspace({
    currentUser = null,
    deferInitialRender = false,
    finishSessionRestore = false,
  } = {}) {
    this.state.isLoading = true;
    if (!deferInitialRender) this.render();
    try {
      const resolved = await resolveStudentApiState({ currentUser });
      const accountId = resolved.student.id;
      const session = localStore.getSession();
      if (session?.kind === "api" && session.accountId !== accountId) {
        localStore.setSession({ ...session, accountId });
      }
      this.state.postEnrollmentGuideCompleted =
        localStore.hasCompletedPostEnrollmentGuide(accountId);
      this.state.requiresContactBinding = resolved.mode === "binding";

      if (resolved.mode === "binding") {
        // Never retain or reveal an older protected workspace while the
        // current session is restricted to first contact binding.
        const bindingWorkspace = emptyWorkspace();
        bindingWorkspace.student = resolved.student;
        bindingWorkspace.progress = {
          ...bindingWorkspace.progress,
          id: resolved.student.id,
          name: resolved.student.name,
          college: resolved.student.college,
          className: resolved.student.className,
        };
        this.state.workspace = bindingWorkspace;
        this.state.lastError = null;
        this.state.isShowingCachedData = false;
      } else if (resolved.workspace) {
        this.state.workspace = resolved.workspace;
        this.state.lastError = null;
        this.state.isShowingCachedData = false;
      } else {
        const sameStudent =
          this.state.workspace.student.id === resolved.student.id;
        if (!sameStudent) {
          const identityWorkspace = emptyWorkspace();
          identityWorkspace.student = resolved.student;
          identityWorkspace.progress = {
            ...identityWorkspace.progress,
            id: resolved.student.id,
            name: resolved.student.name,
            college: resolved.student.college,
            className: resolved.student.className,
          };
          this.state.workspace = identityWorkspace;
        }
        this.state.lastError = apiErrorText(resolved.workspaceError);
        this.state.isShowingCachedData = true;
        if (resolved.workspaceError?.status === 401) {
          clearApiSession();
          localStore.clearSession();
          this.state.authenticated = false;
        }
      }
    } catch (error) {
      this.state.lastError = apiErrorText(error);
      this.state.isShowingCachedData = true;
      if (error?.status === 401) {
        // Session is unrecoverable — return to the login flow.
        clearApiSession();
        localStore.clearSession();
        this.state.authenticated = false;
      }
    } finally {
      if (finishSessionRestore) this.state.isRestoringSession = false;
      this.state.isLoading = false;
      this.render();
    }
  },
  logout() {
    if (this.isApiMode()) logoutApi();
    else clearApiSession();
    localStore.clearSession();
    // Release per-screen transient state, mirroring the Android controller's
    // clearAccount on sign-out (media draft blobs would otherwise leak).
    for (const draft of this.ui.checkin?.drafts || []) {
      if (draft.url?.startsWith("blob:")) URL.revokeObjectURL(draft.url);
    }
    this.ui = {};
    this.scrollPositions.clear();
    this.state.authenticated = false;
    this.state.requiresContactBinding = false;
    this.state.workspace = emptyWorkspace();
    this.state.tab = "dashboard";
    this.state.subScreen = null;
    this.state.notificationSheetOpen = false;
    this.state.dialog = null;
    this.navDirection = "back";
    this.render();
  },

  // ── Theme & language ────────────────────────────────────────
  applyTheme() {
    const mode = localStore.getThemeMode();
    const dark =
      mode === "dark" ||
      (mode === "system" &&
        globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  },
  setThemeMode(mode) {
    localStore.setThemeMode(mode);
    this.applyTheme();
    this.render();
  },
  setAppLanguage(lang) {
    localStore.setLanguage(lang);
    setLanguage(lang);
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    // Android recreates the Activity; the web equivalent re-renders in place.
    this.render();
  },

  // ── SubScreen navigation (AuthenticatedAppContent) ───────────
  openSub(name, subParams = {}) {
    this.state.subScreen = name;
    this.state.subParams = { ...subParams };
    this.navDirection = "forward";
    this.render();
  },
  closeSub() {
    this.state.subScreen = null;
    this.state.subParams = {};
    this.navDirection = "back";
    this.render();
  },
  selectTab(tab) {
    if (this.state.tab !== tab) {
      this.state.tab = tab;
      // Tab changes are deliberately instantaneous (no cross-fade) on Android.
      this.navDirection = "none";
      this.render();
    }
  },

  // ── Back chain (BackHandler rules + §返回规则) ───────────────
  handleBack() {
    const s = this.state;
    if (s.dialog) {
      if (s.dialog.dismissible === false) return true;
      s.dialog = null;
      this.render();
      return true;
    }
    if (s.notificationSheetOpen) {
      if (this.ui.notifications?.selectedNoticeId) {
        this.ui.notifications.selectedNoticeId = null;
        this.render();
        return true;
      }
      this.actions["notifications.close"]?.(this);
      return true;
    }
    if (s.systemMode === "MAINTENANCE") return true;
    // Screen-level back interception (guides pager, scanning lock, …)
    for (const interceptor of this._backInterceptors) {
      if (interceptor(this)) return true;
    }
    if (s.authenticated) {
      if (s.requiresContactBinding) {
        if (s.activationSupportScreen) {
          s.activationSupportScreen = null;
          this.navDirection = "back";
          this.render();
          return true;
        }
        return true; // activation blocks the app
      }
      if (s.subScreen) {
        const from = s.subScreen;
        this.navDirection = "back";
        if (
          ["binding", "privacy", "help", "feedback", "about"].includes(from)
        ) {
          s.subScreen = "settings";
          s.subParams = {};
        } else if (from === "changelog") {
          s.subScreen = "about";
          s.subParams = {};
        } else {
          s.subScreen = null;
          s.subParams = {};
        }
        this.render();
        return true;
      }
      if (s.tab !== "dashboard") {
        this.selectTab("dashboard");
        return true;
      }
      return false;
    }
    // Pre-auth back chain
    if (s.needsPrivacyConsent) return true; // first-run consent blocks back
    if (s.pendingInvite) {
      s.pendingInvite = null;
      s.showScanJoin = true;
      this.navDirection = "back";
      this.render();
      return true;
    }
    if (s.showScanJoin) {
      s.showScanJoin = false;
      this.navDirection = "back";
      this.render();
      return true;
    }
    if (s.showRecoveryRequest) {
      s.showRecoveryRequest = false;
      this.navDirection = "back";
      this.render();
      return true;
    }
    if (s.showEmailLogin) {
      s.showEmailLogin = false;
      this.navDirection = "back";
      this.render();
      return true;
    }
    if (s.showLoginPrivacy) {
      s.showLoginPrivacy = false;
      this.navDirection = "back";
      this.render();
      return true;
    }
    return false;
  },
  _backInterceptors: [],
  registerBackInterceptor(fn) {
    this._backInterceptors.push(fn);
  },

  // ── Render ───────────────────────────────────────────────────
  screenKey() {
    const s = this.state;
    if (s.systemMode === "MAINTENANCE") return "maintenance";
    if (s.isRestoringSession || !s.privacyConsentChecked) return "splash";
    if (s.needsPrivacyConsent)
      return this.ui.consent?.showFullPolicy ? "consent-policy" : "consent";
    if (s.authenticated) {
      if (s.requiresContactBinding)
        return `binding-${s.activationSupportScreen || "main"}`;
      if (this.hasActiveEnrollment() && !s.postEnrollmentGuideCompleted)
        return "post-guide";
      if (s.subScreen) return `sub-${s.subScreen}`;
      return `tab-${s.tab}`;
    }
    if (s.pendingInvite) return "prelogin-join-confirm";
    if (s.showScanJoin) return "prelogin-scan";
    if (s.showRecoveryRequest) return "recovery";
    if (s.showEmailLogin) return "email-login";
    if (!s.preLoginGuideCompleted) return "pre-guide";
    if (s.showLoginPrivacy) return "login-privacy";
    return "login";
  },

  renderAuthContent() {
    const s = this.state;
    if (s.isRestoringSession || !s.privacyConsentChecked)
      return renderStartupSplash(this);
    if (s.needsPrivacyConsent) return renderPrivacyConsent(this);
    if (s.authenticated) {
      if (s.requiresContactBinding) {
        if (s.activationSupportScreen === "privacy")
          return renderPrivacyPolicy(this, { context: "activation" });
        if (s.activationSupportScreen === "help")
          return renderActivationHelp(this);
        return renderContactBinding(this, { mode: "requiredActivation" });
      }
      if (this.hasActiveEnrollment() && !s.postEnrollmentGuideCompleted)
        return renderPostEnrollmentGuide(this);
      return this.renderAuthenticatedShell();
    }
    if (s.pendingInvite) {
      return renderCourseJoinConfirm(this, {
        inviteCode: s.pendingInvite.code,
        course: s.pendingInvite.course,
        preLogin: true,
      });
    }
    if (s.showScanJoin) return renderScanJoin(this, { preLogin: true });
    if (s.showRecoveryRequest) return renderRecoveryRequest(this);
    if (s.showEmailLogin)
      return renderVerificationLogin(this, { method: "email" });
    if (!s.preLoginGuideCompleted) return renderPreLoginGuide(this);
    if (s.showLoginPrivacy)
      return renderPrivacyPolicy(this, { context: "login" });
    return renderLogin(this);
  },

  renderTabContent() {
    switch (this.state.tab) {
      case "dashboard":
        return renderDashboard(this);
      case "courses":
        return renderCourses(this);
      case "checkin":
        return renderCheckIn(this);
      case "grades":
        return renderGrades(this);
      case "profile":
        return renderProfile(this);
      default:
        return "";
    }
  },

  renderSubScreen() {
    const p = this.state.subParams;
    switch (this.state.subScreen) {
      case "endurance":
        return renderEnduranceScoring(this);
      case "exemption":
        return renderExemption(this, p);
      case "account":
        return renderAccountDetails(this);
      case "settings":
        return renderSettings(this);
      case "binding":
        return renderContactBinding(this, { mode: "manageContacts" });
      case "privacy":
        return renderPrivacyPolicy(this, { context: "settings" });
      case "help":
        return renderHelpCenter(this);
      case "feedback":
        return renderFeedback(this);
      case "about":
        return renderAbout(this);
      case "changelog":
        return renderChangelog(this);
      case "scan":
        return renderScanJoin(this, {});
      case "enterCode":
        return renderEnterInviteCode(this);
      case "joinStatus":
        return renderJoinRequestStatus(this, p);
      case "joinConfirm":
        return renderCourseJoinConfirm(this, p);
      default:
        return "";
    }
  },

  bottomNavHtml() {
    const tabs = [
      { id: "dashboard", label: t("navigation_dashboard"), icon: null },
      { id: "courses", label: t("navigation_courses"), icon: "menu-book" },
      { id: "checkin", label: t("navigation_checkin"), icon: "add-box" },
      { id: "grades", label: t("navigation_grades"), icon: "bar-chart" },
      { id: "profile", label: t("navigation_profile"), icon: "account-circle" },
    ];
    return `<div class="bottom-nav-wrap"><nav class="bottom-nav" role="tablist">${tabs
      .map(
        (
          tab,
        ) => `<button class="nav-item" role="tab" aria-selected="${this.state.tab === tab.id}" data-action="root.tab" data-tab="${tab.id}">
          <span class="pill">${tab.icon ? icon(tab.icon, 24) : `<svg class="icon" width="24" height="24" viewBox="0 0 83 83" fill="currentColor" aria-hidden="true"><use href="#bnbu-emblem-path"/></svg>`}</span>
          <span class="nav-label">${tab.label}</span>
        </button>`,
      )
      .join("")}</nav></div>`;
  },

  renderAuthenticatedShell() {
    const s = this.state;
    const banner =
      s.lastError !== null || s.isShowingCachedData
        ? renderSyncStatusBanner(this)
        : "";
    const sub = s.subScreen
      ? `<div class="screen sub-screen-overlay ${this.navDirection === "forward" ? "anim-enter-forward" : ""}">${this.renderSubScreen()}</div>`
      : "";
    const sheet = s.notificationSheetOpen ? renderNotificationSheet(this) : "";
    return `
      <div class="screen main-shell">
        ${banner}
        <div class="tab-host screen-scroll" data-scroll-key="tab-${s.tab}">${this.renderTabContent()}</div>
        ${this.bottomNavHtml()}
      </div>
      ${sub}
      ${sheet}`;
  },

  render() {
    const viewport = this._viewport;
    if (!viewport) return;
    // Preserve scroll positions of the outgoing tree.
    for (const el of viewport.querySelectorAll("[data-scroll-key]")) {
      this.scrollPositions.set(el.dataset.scrollKey, el.scrollTop);
    }
    const key = this.screenKey();
    const changed = key !== this.lastScreenKey;
    const s = this.state;

    let content;
    if (s.systemMode === "MAINTENANCE") {
      content = renderMaintenancePage(this);
    } else {
      const wrapped = this.renderAuthContent();
      if (s.systemModeStatus.plannedMaintenanceAt) {
        content = `<div class="system-frame">${renderPlannedMaintenanceBanner(this)}<div class="system-frame-body">${wrapped}</div></div>`;
      } else if (s.systemMode === "READ_ONLY") {
        content = `<div class="system-frame">${renderReadOnlyBanner(this)}<div class="system-frame-body">${wrapped}</div></div>`;
      } else {
        content = wrapped;
      }
    }
    const animClass =
      changed && this.navDirection !== "none"
        ? this.navDirection === "back"
          ? "anim-enter-back"
          : "anim-enter-forward"
        : "";
    viewport.innerHTML = `<div class="root-layer ${animClass}">${content}</div>${s.dialog ? this.renderDialog() : ""}`;
    this.lastScreenKey = key;
    this.navDirection = "none";
    // Restore scroll positions.
    for (const el of viewport.querySelectorAll("[data-scroll-key]")) {
      const saved = this.scrollPositions.get(el.dataset.scrollKey);
      if (saved) el.scrollTop = saved;
    }
    for (const hook of this._afterRenderHooks) hook(this);
  },
  _afterRenderHooks: [],
  registerAfterRender(fn) {
    this._afterRenderHooks.push(fn);
  },

  renderDialog() {
    const d = this.state.dialog;
    if (!d) return "";
    const dismissible = d.dismissible !== false;
    return `<div class="dialog-scrim" ${dismissible ? 'data-action="dialog.scrim"' : ""}>
      <div class="dialog" role="alertdialog" aria-modal="true">
        ${d.title ? `<div class="dialog-title">${d.title}</div>` : ""}
        ${d.body ? `<div class="dialog-body">${d.body}</div>` : ""}
        ${d.contentHtml || ""}
        <div class="dialog-actions">
          ${(d.buttons || [])
            .map(
              (b) =>
                `<button class="text-btn pressable" data-action="${b.action}" ${
                  b.args
                    ? Object.entries(b.args)
                        .map(([k, v]) => `data-${k}="${v}"`)
                        .join(" ")
                    : ""
                }>${b.label}</button>`,
            )
            .join("")}
        </div>
      </div>
    </div>`;
  },
  showDialog(dialog) {
    this.state.dialog = dialog;
    this.render();
  },
  closeDialog() {
    this.state.dialog = null;
    this.render();
  },

  // ── Boot ─────────────────────────────────────────────────────
  start(rootElement) {
    this._viewport = rootElement;
    setLanguage(localStore.getLanguage());
    document.documentElement.lang = getLanguage() === "en" ? "en" : "zh-CN";
    this.applyTheme();
    globalThis
      .matchMedia?.("(prefers-color-scheme: dark)")
      .addEventListener?.("change", () => {
        if (localStore.getThemeMode() === "system") {
          this.applyTheme();
        }
      });

    Object.assign(this.actions, {
      "root.tab": (a, el) => a.selectTab(el.dataset.tab),
      "root.back": (a) => a.handleBack(),
      "dialog.scrim": (a, el, event) => {
        if (event.target === el) a.closeDialog();
      },
      "dialog.close": (a) => a.closeDialog(),
    });
    Object.assign(
      this.actions,
      consentActions,
      guideActions,
      loginActions,
      verificationActions,
      recoveryActions,
      bindingActions,
      joinActions,
      dashboardActions,
      notificationActions,
      coursesActions,
      checkinActions,
      profileActions,
      supportActions,
      servicesActions,
    );

    this.registerBackInterceptor(guideBackInterceptor);
    this.registerBackInterceptor(joinBackInterceptor);
    this.registerBackInterceptor(coursesBackInterceptor);
    this.registerBackInterceptor(checkinBackInterceptor);
    this.registerBackInterceptor(servicesBackInterceptor);
    this.registerAfterRender(attachGuideSwipe);
    this.registerAfterRender(attachScanCamera);

    // Delegated events
    rootElement.addEventListener("click", (event) => {
      const target = event.target.closest("[data-action]");
      if (!target || target.disabled) return;
      const handler = this.actions[target.dataset.action];
      if (handler) handler(this, target, event);
    });
    rootElement.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-submit]");
      if (!form) return;
      event.preventDefault();
      const handler = this.actions[form.dataset.submit];
      if (handler) handler(this, form, event);
    });
    rootElement.addEventListener("input", (event) => {
      const field = event.target.closest("[data-input]");
      if (!field) return;
      const handler = this.actions[field.dataset.input];
      if (handler) handler(this, field, event);
    });
    rootElement.addEventListener("change", (event) => {
      const field = event.target.closest("[data-change]");
      if (!field) return;
      const handler = this.actions[field.dataset.change];
      if (handler) handler(this, field, event);
    });
    globalThis.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.handleBack();
    });

    // Browser back follows the same back chain as the Android BackHandler.
    history.pushState({ bnbu: true }, "");
    globalThis.addEventListener("popstate", () => {
      const handled = this.handleBack();
      history.pushState({ bnbu: true }, "");
      if (!handled) {
        // Root dashboard: remain in app (Android keeps no custom interception,
        // the activity would background; the web stays on the page).
      }
    });

    // Session restore (StartupSplashScreen while isRestoringSession).
    this.render();
    loadPolicyMarkdown();
    // Probed unconditionally: a session that later expires drops the user back
    // on the login screen, which must still offer the demo entry point.
    demoAccountInfo().then((student) => {
      if (!student) return;
      this.state.demoAccount = student;
      this.render();
    });
    setTimeout(() => {
      const session = localStore.getSession();
      const privacyAccepted = localStore.hasAgreedPrivacyPolicy(
        BUILD.PRIVACY_POLICY_VERSION,
      );
      this.state.needsPrivacyConsent = !privacyAccepted;
      this.state.loginPrivacyAccepted = privacyAccepted;
      this.state.privacyConsentChecked = true;
      if (session?.kind === "api" && hasApiSession()) {
        this.state.authenticated = true;
        this.state.postEnrollmentGuideCompleted =
          localStore.hasCompletedPostEnrollmentGuide(session.accountId);
        this.navDirection = "forward";
        this.reloadApiWorkspace({
          deferInitialRender: true,
          finishSessionRestore: true,
        });
        return;
      }
      if (session) {
        // Either the API tokens are gone (cleared storage) or this is a legacy
        // demo session from the removed mock sign-in. Both must fall back to a
        // fresh join sign-in so the app never shows non-backend data.
        localStore.clearSession();
        clearApiSession();
      }
      this.state.isRestoringSession = false;
      this.navDirection = "forward";
      if (privacyAccepted && this.openDeepLinkInvite()) return;
      this.render();
    }, 900);

    // 1 Hz heartbeat for the exercise session timer.
    setInterval(() => checkinTick(this), 1000);
  },
};

if (typeof document !== "undefined") {
  const root = document.querySelector("#app-viewport");
  if (root) app.start(root);
}
