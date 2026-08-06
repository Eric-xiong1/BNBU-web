"use client";

/* eslint-disable react-hooks/refs -- transient drag data is intentionally kept outside React rendering. */

import {
  ArrowLeft,
  BookOpen,
  CalendarRange,
  CircleAlert,
  CircleHelp,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  GraduationCap,
  LayoutDashboard,
  Mail,
  ScrollText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  TicketCheck,
  UserCog,
  Users,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { AdminWorkspace } from "./admin-workspace";
import { ADMIN_SESSION_KEY } from "./admin-domain";
import { apiErrorText, clearApiSession, hasApiSession, logoutApi, passwordLogin } from "./api-client";
import { adminCopy, adminLabel } from "./admin-i18n";
import { LanguageToggle, LocalizedContent, type Locale } from "./language";
import {
  TAB_PAGE_TRANSITION_EXIT_FALLBACK_MS,
  type TabTransitionDirection,
} from "./teacher-tab-page-transition";
import { PageHeader } from "./teacher-ui";
import { TeacherWorkspace } from "./teacher-workspace";
import type { AdminRoute, SystemMode } from "./admin-types";
import { SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_MAX_WIDTH, useResizableSidebar, type SidebarRole } from "./use-resizable-sidebar";

type Role = SidebarRole;
type Theme = "light" | "dark" | "system";
type Tone = "blue" | "green" | "orange" | "red" | "gray";
type RecoveryStep = "identify" | "verify" | "reset" | "assistance" | "complete";

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => unknown;
};

const IS_DEMO_ENVIRONMENT = process.env.NODE_ENV !== "production";

type NavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

const teacherNav: NavItem[] = [
  { id: "courses", label: "课程管理", icon: BookOpen },
  { id: "roster", label: "学生管理", icon: Users },
  { id: "checkins", label: "打卡审核", icon: ClipboardCheck },
  { id: "grades", label: "成绩管理", icon: GraduationCap },
  { id: "exemptions", label: "免测与认证", icon: ShieldCheck },
];

const adminNav: NavItem[] = [
  { id: "overview", label: "系统概览", icon: LayoutDashboard },
  { id: "semesters", label: "学期管理", icon: CalendarRange },
  { id: "accounts", label: "用户与账号", icon: UserCog },
  { id: "support", label: "支持请求", icon: TicketCheck },
  { id: "rules", label: "全局规则", icon: SlidersHorizontal },
  { id: "system", label: "系统模式", icon: Settings },
  { id: "help", label: "帮助中心", icon: CircleHelp },
  { id: "audit", label: "审计日志", icon: ScrollText },
];

const adminRouteIds = new Set<AdminRoute>(adminNav.map((item) => item.id as AdminRoute));

function adminRouteFromHash(hash: string): AdminRoute | null {
  const match = hash.match(/^#admin\/([^?]+)/);
  const candidate = match?.[1] as AdminRoute | undefined;
  return candidate && adminRouteIds.has(candidate) ? candidate : null;
}

function updateAdminHash(route: AdminRoute) {
  const nextHash = `#admin/${route}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
}

const pageCopy: Record<Role, Record<string, { title: string; eyebrow: string; description: string }>> = {
  teacher: {
    courses: { title: "课程管理", eyebrow: "教学业务", description: "管理本人授课班级、课程目标、打卡时间窗与邀请码。" },
    roster: { title: "学生管理", eyebrow: "教学业务", description: "查看直接加入的课程成员、加入信息、学时进度与当前状态。" },
    checkins: { title: "打卡审核", eyebrow: "教学业务", description: "集中处理学生打卡记录与异常内容。" },
    grades: { title: "成绩管理", eyebrow: "教学业务", description: "录入耐力跑成绩并统一发布给学生。" },
    exemptions: { title: "免测与组织认证", eyebrow: "教学业务", description: "审核免测申请及组织认证材料。" },
  },
  admin: {
    overview: { title: "系统运行平稳", eyebrow: "管理员工作台", description: "当前处于正常模式，优先处理账号恢复与配置提醒。" },
    semesters: { title: "学期管理", eyebrow: "全局治理", description: "创建、切换与归档学期。切换当前学期会影响全系统业务范围。" },
    accounts: { title: "用户与账号", eyebrow: "全局治理", description: "管理教师和学生账号、恢复申请、验证码解锁与数据删除。" },
    support: { title: "支持请求", eyebrow: "服务运营", description: "集中处理系统故障及需要技术团队协助的事项；当前为前端规划功能演示。" },
    rules: { title: "耐力跑换算表", eyebrow: "全局治理", description: "维护四套耐力跑成绩换算规则。学时目标仅由任课教师在教学班内配置。" },
    system: { title: "系统模式", eyebrow: "系统维护", description: "在正常、只读和维护模式之间切换；每次变更都写入审计日志。" },
    help: { title: "帮助中心", eyebrow: "内容管理", description: "维护面向学生的中英双语帮助内容、关键词与发布状态。" },
    audit: { title: "审计日志", eyebrow: "系统维护", description: "追踪关键操作。审计记录只读，不可修改或删除。" },
  },
};

function ThemeControl({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return (
    <div className="theme-control" aria-label="主题模式">
      {([
        ["light", "浅色"],
        ["dark", "深色"],
        ["system", "跟随系统"],
      ] as const).map(([value, label]) => (
        <button key={value} className={theme === value ? "selected" : ""} aria-pressed={theme === value} onClick={() => onChange(value)} type="button">
          {label}
        </button>
      ))}
    </div>
  );
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PortalApp() {
  const [role, setRole] = useState<Role | null>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep | null>(null);
  const [recoveryAccount, setRecoveryAccount] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [theme, setTheme] = useState<Theme>("system");
  const [locale, setLocale] = useState<Locale>("zh");
  const [active, setActive] = useState("overview");
  const [tabDirection, setTabDirection] = useState<TabTransitionDirection>("forward");
  const [tabTransitionVersion, setTabTransitionVersion] = useState(0);
  const [tabScrollTop, setTabScrollTop] = useState(0);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [adminContext, setAdminContext] = useState<{ semesterName: string; notificationCount: number; systemMode: SystemMode }>({ semesterName: "2025–2026 · 第二学期", notificationCount: 0, systemMode: "NORMAL" });
  const sidebarController = useResizableSidebar(role ?? "teacher");
  const preferencesRestored = useRef(false);
  const themeTransitionTimeoutRef = useRef<number | null>(null);
  const workspaceScrollPositions = useRef<Record<Role, Record<string, number>>>({ teacher: {}, admin: {} });
  const sidebarState = sidebarController.sidebar;
  const sidebarWidth = sidebarState.width;
  const isSidebarCollapsed = sidebarState.collapsed;

  useLayoutEffect(() => {
    if (!preferencesRestored.current) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("bnbu-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (!preferencesRestored.current) return;
    window.localStorage.setItem("bnbu-locale", locale);
  }, [locale]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      let nextTheme: Theme = "system";
      let nextLocale: Locale = "zh";
      try {
        const storedTheme = window.localStorage.getItem("bnbu-theme");
        if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") nextTheme = storedTheme;
        nextLocale = window.localStorage.getItem("bnbu-locale") === "en" ? "en" : "zh";
      } catch {
        // Use deterministic defaults when browser preferences are unavailable.
      }
      preferencesRestored.current = true;
      document.documentElement.dataset.theme = nextTheme;
      setTheme(nextTheme);
      setLocale(nextLocale);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    if (themeTransitionTimeoutRef.current !== null) window.clearTimeout(themeTransitionTimeoutRef.current);
  }, []);

  const handleThemeChange = (nextTheme: Theme) => {
    if (nextTheme === theme) return;
    const root = document.documentElement;
    if (themeTransitionTimeoutRef.current !== null) window.clearTimeout(themeTransitionTimeoutRef.current);
    const updateTheme = () => flushSync(() => {
      // The root attribute must change inside the view-transition callback so the
      // browser captures the new palette before the next frame is painted.
      root.dataset.theme = nextTheme;
      setTheme(nextTheme);
    });
    const transitionDocument = document as ViewTransitionDocument;
    if (typeof transitionDocument.startViewTransition === "function" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      transitionDocument.startViewTransition(updateTheme);
      return;
    }
    root.classList.add("is-theme-transitioning");
    updateTheme();
    themeTransitionTimeoutRef.current = window.setTimeout(() => {
      root.classList.remove("is-theme-transitioning");
      themeTransitionTimeoutRef.current = null;
    }, 280);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
        if (!raw) return;
        const session = JSON.parse(raw) as { role?: string; expiresAt?: number };
        if (session.role !== "admin" || !session.expiresAt || session.expiresAt <= Date.now()) {
          window.localStorage.removeItem(ADMIN_SESSION_KEY);
          return;
        }
        const route = adminRouteFromHash(window.location.hash) ?? "overview";
        workspaceScrollPositions.current.admin = {};
        setRole("admin");
        setActive(route);
        updateAdminHash(route);
      } catch {
        window.localStorage.removeItem(ADMIN_SESSION_KEY);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (role !== "admin") return;
    const onHashChange = () => {
      const route = adminRouteFromHash(window.location.hash);
      if (!route) {
        setToast(adminCopy(locale, "invalid_route"));
        setActive("overview");
        updateAdminHash("overview");
        return;
      }
      setActive(route);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [locale, role]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  useLayoutEffect(() => {
    if (!role) return;

    const scrollTop = tabScrollTop;
    const restoreScroll = () => {
      window.scrollTo({ top: scrollTop, behavior: "auto" });
    };
    let settledAnimationFrame: number | null = null;
    const transitionSettledTimeout = window.setTimeout(restoreScroll, TAB_PAGE_TRANSITION_EXIT_FALLBACK_MS);

    restoreScroll();
    const animationFrame = window.requestAnimationFrame(() => {
      restoreScroll();
      settledAnimationFrame = window.requestAnimationFrame(restoreScroll);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (settledAnimationFrame !== null) window.cancelAnimationFrame(settledAnimationFrame);
      window.clearTimeout(transitionSettledTimeout);
    };
  }, [active, role, tabScrollTop]);

  const enterWorkspace = (resolvedRole: Role) => {
    workspaceScrollPositions.current[resolvedRole] = {};
    setTabDirection("forward");
    setTabTransitionVersion(0);
    setTabScrollTop(0);
    setRole(resolvedRole);
    setActive(resolvedRole === "teacher" ? "courses" : "overview");
    if (resolvedRole === "admin") {
      try {
        window.localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ role: "admin", expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000 }));
      } catch {
        // Session persistence is optional in privacy-restricted demo contexts.
      }
      updateAdminHash("overview");
    }
    setLoginError("");
  };

  // Demo entry keeps working fully offline; the account/password form goes
  // through the real backend (see submitLogin).
  const authenticate = (forcedRole?: Role) => {
    if (forcedRole) {
      enterWorkspace(forcedRole);
      return true;
    }
    if (!account.trim() || !password.trim()) {
      setLoginError("请输入账号与密码后继续。");
      return false;
    }
    enterWorkspace(/admin|sys|^a\d+/i.test(account.trim()) ? "admin" : "teacher");
    return true;
  };

  const submitLogin = async () => {
    if (isSubmitting) return;
    const trimmedAccount = account.trim();
    if (!trimmedAccount || !password.trim()) {
      setLoginError("请输入账号与密码后继续。");
      return;
    }
    setIsSubmitting(true);
    try {
      const session = await passwordLogin(trimmedAccount, password);
      const apiRole = session.user?.role;
      if (apiRole !== "TEACHER" && apiRole !== "ADMIN") {
        clearApiSession();
        setLoginError("该账号不是教师或管理员，无法登录本平台。");
        return;
      }
      enterWorkspace(apiRole === "ADMIN" ? "admin" : "teacher");
    } catch (error) {
      setLoginError(apiErrorText(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    if (hasApiSession()) void logoutApi();
    if (role === "admin") {
      try { window.localStorage.removeItem(ADMIN_SESSION_KEY); } catch { /* Ignore restricted storage. */ }
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    setRole(null);
    setPassword("");
    setShowPassword(false);
    setIsSubmitting(false);
    setActive("overview");
    setTabTransitionVersion(0);
    setTabScrollTop(0);
    setModal(null);
  };

  const openRecovery = () => {
    setRecoveryAccount(account.trim());
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirmation("");
    setRecoveryError("");
    setRecoveryStep("identify");
  };

  const returnToLogin = () => {
    setRecoveryStep(null);
    setRecoveryError("");
  };

  const sendRecoveryCode = () => {
    if (!recoveryAccount.trim()) {
      setRecoveryError("请输入工号后继续。");
      return;
    }
    setRecoveryError("");
    setRecoveryStep("verify");
  };

  const verifyRecoveryCode = () => {
    if (!/^\d{6}$/.test(recoveryCode)) {
      setRecoveryError("请输入邮箱收到的 6 位验证码。");
      return;
    }
    setRecoveryError("");
    setRecoveryStep("reset");
  };

  const resetPassword = () => {
    if (recoveryPassword.length < 8 || !/[A-Za-z]/.test(recoveryPassword) || !/\d/.test(recoveryPassword)) {
      setRecoveryError("新密码至少 8 位，并同时包含字母和数字。");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirmation) {
      setRecoveryError("两次输入的新密码不一致。");
      return;
    }
    setRecoveryError("");
    setRecoveryStep("complete");
  };

  if (!role) {
    return (
      <LocalizedContent locale={locale}>
      <main className="login-shell">
        <header className="login-topbar">
          <LoginWordmark />
          <div className="topbar-controls">
            <LanguageToggle locale={locale} onChange={setLocale} />
            <ThemeControl theme={theme} onChange={handleThemeChange} />
          </div>
        </header>
        <section className="login-layout">
          <section className={`login-card ${recoveryStep ? "login-card-recovery" : ""}`} aria-labelledby="login-title">
            <div className="login-brand">
              <span className="login-logo-surface">
                <img className="login-logo" src="/branding/sports-logo.png" alt="体育课程管理平台标志" />
              </span>
              <p className="login-platform-name">体育课程管理平台</p>
              <p className="login-school-name">北师香港浸会大学</p>
            </div>
            {!recoveryStep ? <>
              <div className="login-card-head">
                <h1 id="login-title">登录管理平台</h1>
                <p>使用学校分配的教师或管理员账号登录。</p>
              </div>
              <form
                onSubmit={(event) => { event.preventDefault(); void submitLogin(); }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
                  event.preventDefault();
                  void submitLogin();
                }}
              >
                <label>
                  <span>工号或邮箱</span>
                  <input value={account} onChange={(event) => setAccount(event.target.value)} placeholder="请输入工号或学校邮箱" autoComplete="username" />
                </label>
                <label>
                  <span>密码</span>
                  <span className="password-field">
                    <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" autoComplete="current-password" />
                    <button className="password-visibility" type="button" aria-label="显示或隐藏密码" aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                      {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                    </button>
                  </span>
                </label>
                {loginError && <p className="form-error">{loginError}</p>}
                <button className="primary-button full-button" type="submit" disabled={isSubmitting}>{isSubmitting ? "正在登录…" : "登录"}</button>
              </form>
              <button className="text-button forgot-button" type="button" onClick={openRecovery}>忘记密码或无法登录？</button>
              {IS_DEMO_ENVIRONMENT && (
                <details className="demo-access">
                  <summary>进入演示模式</summary>
                  <div className="demo-menu" role="group" aria-label="演示模式选项">
                    <button type="button" onClick={() => authenticate("teacher")}>教师端演示</button>
                    <button type="button" onClick={() => authenticate("admin")}>管理员端演示</button>
                  </div>
                </details>
              )}
              <p className="security-note">系统将根据账号权限自动进入对应工作台</p>
            </> : <PasswordRecovery
              step={recoveryStep}
              account={recoveryAccount}
              code={recoveryCode}
              password={recoveryPassword}
              passwordConfirmation={recoveryPasswordConfirmation}
              error={recoveryError}
              onAccountChange={setRecoveryAccount}
              onCodeChange={setRecoveryCode}
              onPasswordChange={setRecoveryPassword}
              onPasswordConfirmationChange={setRecoveryPasswordConfirmation}
              onBack={returnToLogin}
              onSendCode={sendRecoveryCode}
              onVerifyCode={verifyRecoveryCode}
              onResetPassword={resetPassword}
              onOpenAssistance={() => { setRecoveryError(""); setRecoveryStep("assistance"); }}
            />}
          </section>
        </section>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
      </LocalizedContent>
    );
  }

  const nav = role === "teacher" ? teacherNav : adminNav;
  const copy = pageCopy[role][active] ?? pageCopy[role][role === "teacher" ? "courses" : "overview"];
  const isCourseManagement = role === "teacher" && active === "courses";
  const isFocusedTeacherPage = role === "teacher" && ["roster", "checkins", "grades", "exemptions"].includes(active);
  const isFocusedWorkspace = role === "admin" || isFocusedTeacherPage;

  const navigateTo = (nextActive: string) => {
    if (nextActive === active) return;

    workspaceScrollPositions.current[role][active] = window.scrollY;
    const nextScrollTop = workspaceScrollPositions.current[role][nextActive] ?? 0;
    const roleNav = role === "teacher" ? teacherNav : adminNav;
    const currentIndex = roleNav.findIndex((item) => item.id === active);
    const nextIndex = roleNav.findIndex((item) => item.id === nextActive);

    if (currentIndex >= 0 && nextIndex >= 0) {
      setTabDirection(nextIndex > currentIndex ? "forward" : "backward");
    }
    setTabTransitionVersion((version) => version + 1);
    setTabScrollTop(nextScrollTop);

    setActive(nextActive);
    if (role === "admin" && adminRouteIds.has(nextActive as AdminRoute)) updateAdminHash(nextActive as AdminRoute);
  };

  return (
    <LocalizedContent locale={locale}>
    <div
      ref={sidebarController.setShellNode}
      className={`app-shell app-shell-tabbed-workspace app-shell-${role} ${isCourseManagement ? "app-shell-course-management" : ""} ${isFocusedWorkspace ? "app-shell-focused-workspace" : ""} ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""} ${sidebarController.isResizing ? "is-resizing-sidebar" : ""} ${sidebarController.isTransitioning ? "is-sidebar-transitioning" : ""} ${sidebarController.isInitialized ? "is-sidebar-initialized" : "is-sidebar-initializing"}`}
      style={{ "--sidebar-width": `${sidebarWidth}px`, "--sidebar-content-visibility": isSidebarCollapsed ? 0 : 1 } as CSSProperties}
    >
      <aside className="sidebar" id={`${role}-sidebar`}>
        <SportsBrand />
        <div className="workspace-label">
          <span>{role === "teacher" ? "教师空间" : "管理空间"}</span>
          {role === "admin" && <Badge tone="green">ADMIN</Badge>}
        </div>
        <nav aria-label="主要导航">
          {nav.map((item) => {
            const NavIcon = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                className={active === item.id ? "active" : ""}
                aria-current={active === item.id ? "page" : undefined}
                aria-label={item.label}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => navigateTo(item.id)}
              >
                <i className="sidebar-nav-icon" aria-hidden="true">
                  <NavIcon size={21} strokeWidth={1.8} />
                </i>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          {role === "teacher" ? (
            <button
              className="profile-button teacher-profile-card sidebar-profile-card"
              type="button"
              aria-label="打开陈若宁的用户信息"
              aria-describedby={isSidebarCollapsed ? "teacher-profile-tooltip" : undefined}
              onClick={() => setModal("profile")}
            >
              <span className="avatar teacher-profile-avatar" aria-hidden="true">陈</span>
              <span className="teacher-profile-copy">
                <b>陈若宁</b>
                <small>体育部 · T2024007</small>
              </span>
              <span className="teacher-profile-tooltip" id="teacher-profile-tooltip" role="tooltip">
                <b>陈若宁</b>
                <small>体育部 · T2024007</small>
              </span>
            </button>
          ) : (
            <button
              className="profile-button sidebar-profile-card"
              type="button"
              aria-label="打开系统管理员的用户信息"
              onClick={() => setModal("profile")}
            >
              <span className="avatar">管</span>
              <span><b>系统管理员</b><small>admin@bnbu.edu.cn</small></span>
              <i>•••</i>
            </button>
          )}
        </div>
        <button
          className="sidebar-collapse-button"
          type="button"
          aria-controls={`${role}-sidebar`}
          aria-label={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          aria-expanded={!isSidebarCollapsed}
          title={isSidebarCollapsed ? "展开侧边栏" : "折叠侧边栏"}
          onClick={sidebarController.toggle}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} strokeWidth={2} /> : <ChevronLeft size={16} strokeWidth={2} />}
        </button>
        <div
          className="sidebar-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="调整导航栏宽度"
          aria-controls={`${role}-sidebar`}
          aria-valuemin={SIDEBAR_COLLAPSED_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          aria-valuetext={isSidebarCollapsed ? "导航栏已折叠" : `导航栏宽度 ${sidebarWidth} 像素`}
          tabIndex={0}
          onPointerDown={sidebarController.startResize}
          onPointerMove={sidebarController.moveResize}
          onPointerUp={(event) => sidebarController.finishResize(event.pointerId)}
          onPointerCancel={(event) => sidebarController.finishResize(event.pointerId, true)}
          onKeyDown={sidebarController.resizeWithKeyboard}
        />
      </aside>
      <main className="workspace">
        <PageHeader
          className={`workspace-header-tabbed ${role === "teacher" ? "workspace-header-teacher" : "workspace-header-admin"} ${isCourseManagement ? "workspace-header-course" : ""} ${isFocusedWorkspace ? "workspace-header-focused" : ""}`}
          title={copy.title}
          description={copy.description}
          eyebrow={isFocusedWorkspace ? undefined : copy.eyebrow}
          transitionKey={tabTransitionVersion > 0 ? `${active}-${tabTransitionVersion}` : undefined}
          transitionDirection={tabDirection}
          actions={<>
            <div className="workspace-school-mark" aria-label="北师香港浸会大学">
              <img src="/bnbu-emblem.svg" alt="" />
              <span><b>北师香港浸会大学</b><small>BNBU 校园体育</small></span>
            </div>
            <div className="semester-pill"><span>当前学期</span><b>{role === "admin" ? adminContext.semesterName : "2025–2026 · 第二学期"}</b></div>
            {role === "admin" && adminContext.systemMode !== "NORMAL" && <Badge tone={adminContext.systemMode === "READ_ONLY" ? "orange" : "red"}>{adminLabel(locale, "systemMode", adminContext.systemMode)}</Badge>}
            <LanguageToggle locale={locale} onChange={setLocale} compact />
            <ThemeControl theme={theme} onChange={handleThemeChange} />
            <button className="icon-button" aria-label="通知" type="button" onClick={() => setToast(role === "admin" && adminContext.notificationCount ? adminCopy(locale, "demo_notifications", { count: adminContext.notificationCount }) : adminCopy(locale, "no_system_notifications"))}>◌{role === "admin" && adminContext.notificationCount > 0 ? <span /> : null}</button>
          </>}
        />
        <section className="page-content">
          {role === "teacher"
            ? <TeacherWorkspace active={active} direction={tabDirection} showToast={setToast} />
            : <AdminWorkspace active={active} direction={tabDirection} locale={locale} showToast={setToast} onNavigate={(route) => navigateTo(route)} onContextChange={setAdminContext} />}
        </section>
      </main>
      {modal && (
        <Modal role={role} theme={theme} onThemeChange={handleThemeChange} close={() => setModal(null)} logout={logout} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
    </LocalizedContent>
  );
}

function LoginWordmark() {
  return (
    <p className="login-wordmark" aria-label="北师香港浸会大学 · 体育课程管理平台">北师香港浸会大学 · 体育课程管理平台</p>
  );
}

function PasswordRecovery({
  step, account, code, password, passwordConfirmation, error,
  onAccountChange, onCodeChange, onPasswordChange, onPasswordConfirmationChange,
  onBack, onSendCode, onVerifyCode, onResetPassword, onOpenAssistance,
}: {
  step: RecoveryStep; account: string; code: string; password: string; passwordConfirmation: string; error: string;
  onAccountChange: (value: string) => void; onCodeChange: (value: string) => void; onPasswordChange: (value: string) => void; onPasswordConfirmationChange: (value: string) => void;
  onBack: () => void; onSendCode: () => void; onVerifyCode: () => void; onResetPassword: () => void; onOpenAssistance: () => void;
}) {
  const submit = (event: React.FormEvent, action: () => void) => { event.preventDefault(); action(); };
  const titles: Record<RecoveryStep, string> = {
    identify: "重置密码",
    verify: "验证邮箱",
    reset: "设置新密码",
    assistance: "无法登录协助",
    complete: "密码重置完成",
  };

  return <div className="password-recovery" aria-live="polite">
    <div className="recovery-head">
      <button type="button" className="back-button" onClick={onBack} aria-label="返回登录"><ArrowLeft size={18} aria-hidden="true" /> 返回登录</button>
      <span className="recovery-step">{step === "identify" ? "1 / 3" : step === "verify" ? "2 / 3" : step === "reset" ? "3 / 3" : ""}</span>
      <h1 id="login-title">{titles[step]}</h1>
    </div>
    {step === "identify" && <form className="recovery-form" onSubmit={(event) => submit(event, onSendCode)}>
      <p>输入教师或管理员工号。验证通过后，系统会向该账号绑定的邮箱发送密码重置验证码。</p>
      <label><span>工号</span><input value={account} onChange={(event) => onAccountChange(event.target.value)} placeholder="请输入工号" autoComplete="username" autoFocus /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button" type="submit"><Mail size={17} aria-hidden="true" />发送验证码</button>
      <button className="text-button recovery-assistance-link" type="button" onClick={onOpenAssistance}>收不到邮箱验证码或账号无法使用？</button>
    </form>}
    {step === "verify" && <form className="recovery-form" onSubmit={(event) => submit(event, onVerifyCode)}>
      <p>验证码已发送至绑定邮箱（已脱敏显示）。验证码 10 分钟内有效，仅可使用一次。</p>
      <label><span>6 位验证码</span><input value={code} onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="请输入 6 位数字验证码" autoFocus /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button" type="submit">验证并继续</button>
      <p className="recovery-note">未收到验证码？同一邮箱 60 秒后可重新发送；连续输错 5 次将锁定 15 分钟。</p>
      <button className="text-button recovery-assistance-link" type="button" onClick={onOpenAssistance}>无法使用绑定邮箱？</button>
    </form>}
    {step === "reset" && <form className="recovery-form" onSubmit={(event) => submit(event, onResetPassword)}>
      <p>请设置新密码。成功后，当前账号在所有设备上的旧登录状态将失效。</p>
      <label><span>新密码</span><input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder="至少 8 位，包含字母和数字" autoComplete="new-password" autoFocus /></label>
      <label><span>确认新密码</span><input type="password" value={passwordConfirmation} onChange={(event) => onPasswordConfirmationChange(event.target.value)} placeholder="请再次输入新密码" autoComplete="new-password" /></label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-button full-button" type="submit"><KeyRound size={17} aria-hidden="true" />确认重置密码</button>
    </form>}
    {step === "assistance" && <div className="recovery-assistance">
      <span className="recovery-alert"><CircleAlert size={22} aria-hidden="true" /></span>
      <p>如账号不存在、已停用，或无法使用绑定邮箱，请联系系统管理员完成身份核验后处理账号恢复或联系方式更新。</p>
      <ul>
        <li>教师和管理员：管理员核实账号状态，并协助更新有效邮箱或恢复账号。</li>
        <li>学生：请使用学生端验证码登录；手机号和邮箱均失效时，由管理员核验身份后绑定新的联系方式。</li>
      </ul>
      <p className="recovery-note">请勿仅凭姓名或学号请求登录；身份核验需通过学校规定的安全渠道完成。</p>
      <button className="primary-button full-button" type="button" onClick={onBack}>返回登录</button>
    </div>}
    {step === "complete" && <div className="recovery-complete">
      <span className="recovery-success"><KeyRound size={24} aria-hidden="true" /></span>
      <p>密码已重置。请使用新密码重新登录；为保护账号安全，所有旧登录状态均已失效。</p>
      <button className="primary-button full-button" type="button" onClick={onBack}>使用新密码登录</button>
    </div>}
  </div>;
}

function SportsBrand() {
  return (
    <div className="brand sports-brand" translate="no" aria-label="SPORTS">
      <img className="sports-brand-emblem" src="/bnbu-emblem.svg" alt="" />
      <span className="sports-brand-wordmark" aria-hidden="true">SPORTS</span>
    </div>
  );
}

function Modal({ role, theme, onThemeChange, close, logout }: { role: Role; theme: Theme; onThemeChange: (theme: Theme) => void; close: () => void; logout: () => void }) {
  const [view, setView] = useState<"profile" | "password" | "complete">("profile");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const isTeacher = role === "teacher";
  const hasMinimumLength = newPassword.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(newPassword) && /\d/.test(newPassword);
  const passwordsMatch = passwordConfirmation.length > 0 && newPassword === passwordConfirmation;
  const title = view === "password" ? "设置新密码" : view === "complete" ? "密码已更新" : isTeacher ? "陈若宁" : "系统管理员";
  const description = view === "password" ? "使用新密码保护您的教师账号" : view === "complete" ? "账号安全设置已完成" : isTeacher ? "体育部 · 教师账号" : "全局系统管理账号";

  const openPasswordSettings = () => {
    setPasswordError("");
    setView("password");
  };

  const returnToProfile = () => {
    setCurrentPassword("");
    setNewPassword("");
    setPasswordConfirmation("");
    setPasswordError("");
    setView("profile");
  };

  const submitPasswordChange = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentPassword) {
      setPasswordError("请输入当前密码以验证身份。");
      return;
    }
    if (!hasMinimumLength || !hasLetterAndNumber) {
      setPasswordError("新密码至少 8 位，并同时包含字母和数字。");
      return;
    }
    if (newPassword !== passwordConfirmation) {
      setPasswordError("两次输入的新密码不一致。");
      return;
    }
    setPasswordError("");
    setCurrentPassword("");
    setNewPassword("");
    setPasswordConfirmation("");
    setView("complete");
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className={`modal account-modal ${view !== "profile" ? "account-modal-security" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-head"><div><h2 id="modal-title">{title}</h2><p>{description}</p></div><button className="icon-button" aria-label="关闭" onClick={close}>×</button></div>
        {view === "profile" && <>
          <ThemeProfile theme={theme} onChange={onThemeChange} />
          <div className="profile-meta"><span>当前身份</span><Badge tone={role === "teacher" ? "blue" : "green"}>{role.toUpperCase()}</Badge></div>
          {isTeacher && <section className="account-security-card" aria-labelledby="account-security-title">
            <span className="account-security-icon"><KeyRound size={18} aria-hidden="true" /></span>
            <div>
              <p className="account-security-eyebrow">账号安全</p>
              <h3 id="account-security-title">设置新密码</h3>
              <p>定期更新密码，有助于保护课程和学生信息。</p>
            </div>
            <button className="secondary-button account-security-action" type="button" onClick={openPasswordSettings}>去设置</button>
          </section>}
          <div className="modal-footer"><button className="secondary-button" onClick={close}>取消</button><button className="danger-button" onClick={logout}>退出登录</button></div>
        </>}
        {view === "password" && <>
          <form className="password-settings-form" id="password-settings-form" onSubmit={submitPasswordChange}>
            <p className="password-settings-intro">修改后，其他设备上的登录状态将失效；请使用新密码重新登录。</p>
            <label>
              <span>当前密码</span>
              <span className="password-field">
                <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="请输入当前密码" autoComplete="current-password" autoFocus />
                <button className="password-visibility" type="button" aria-label="显示或隐藏当前密码" aria-pressed={showCurrentPassword} onClick={() => setShowCurrentPassword((visible) => !visible)}>{showCurrentPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
              </span>
            </label>
            <div className="password-settings-divider" />
            <label>
              <span>新密码</span>
              <span className="password-field">
                <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="至少 8 位，包含字母和数字" autoComplete="new-password" />
                <button className="password-visibility" type="button" aria-label="显示或隐藏新密码" aria-pressed={showNewPassword} onClick={() => setShowNewPassword((visible) => !visible)}>{showNewPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
              </span>
            </label>
            <div className="password-rule-list" aria-label="新密码要求">
              <span className={hasMinimumLength ? "met" : ""}>{hasMinimumLength ? "✓" : "○"} 至少 8 位字符</span>
              <span className={hasLetterAndNumber ? "met" : ""}>{hasLetterAndNumber ? "✓" : "○"} 同时包含字母和数字</span>
            </div>
            <label>
              <span>确认新密码</span>
              <span className="password-field">
                <input type={showPasswordConfirmation ? "text" : "password"} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} placeholder="请再次输入新密码" autoComplete="new-password" />
                <button className="password-visibility" type="button" aria-label="显示或隐藏确认密码" aria-pressed={showPasswordConfirmation} onClick={() => setShowPasswordConfirmation((visible) => !visible)}>{showPasswordConfirmation ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}</button>
              </span>
            </label>
            {passwordConfirmation && <p className={`password-match-hint ${passwordsMatch ? "matched" : ""}`}>{passwordsMatch ? "✓ 两次密码一致" : "两次输入的密码不一致"}</p>}
            {passwordError && <p className="form-error">{passwordError}</p>}
          </form>
          <div className="modal-footer"><button className="secondary-button" type="button" onClick={returnToProfile}>返回</button><button className="primary-button" type="submit" form="password-settings-form">确认更新</button></div>
        </>}
        {view === "complete" && <>
          <div className="password-change-complete">
            <span><KeyRound size={25} aria-hidden="true" /></span>
            <h3>新密码设置成功</h3>
            <p>为保护账号安全，其他设备上的登录状态将失效。请在需要时使用新密码重新登录。</p>
          </div>
          <div className="modal-footer"><button className="primary-button" type="button" onClick={close}>完成</button></div>
        </>}
      </section>
    </div>
  );
}

function ThemeProfile({ theme, onChange }: { theme: Theme; onChange: (theme: Theme) => void }) {
  return <section className="theme-profile" aria-labelledby="theme-profile-title">
    <div>
      <h3 id="theme-profile-title">系统配色</h3>
      <p>选择浅色、深色或跟随系统；设置会自动保存在此设备。</p>
    </div>
    <ThemeControl theme={theme} onChange={onChange} />
  </section>;
}
