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
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { flushSync } from "react-dom";
import { AdminWorkspace } from "./admin-workspace";
import { AppSelect } from "./app-select";
import {
  apiErrorText,
  clearApiSession,
  completeAccountRecovery,
  getMe,
  hasApiSession,
  logoutApi,
  passwordLogin,
  requestAccountRecovery,
  type CurrentUserData,
} from "./api-client";
import { adminCopy, adminLabel } from "./admin-i18n";
import { LanguageToggle, LocalizedContent, type Locale } from "./language";
import {
  TAB_PAGE_TRANSITION_EXIT_FALLBACK_MS,
  type TabTransitionDirection,
} from "./teacher-tab-page-transition";
import { PageHeader } from "./teacher-ui";
import { TeacherWorkspace } from "./teacher-workspace";
import type { AdminRoute, SystemMode } from "./admin-types";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_MAX_WIDTH,
  useResizableSidebar,
  type SidebarRole,
} from "./use-resizable-sidebar";

type Role = SidebarRole;
export type WorkspaceMode = "real" | "demo";
type Theme = "light" | "dark" | "system";
type Tone = "blue" | "green" | "orange" | "red" | "gray";
type RecoveryStep = "identify" | "reset" | "assistance" | "complete";

export type WorkspaceUser = {
  id: string;
  role: Role;
  name: string;
  account: string;
  department: string;
  email: string;
};

function workspaceUserFromCurrent(
  current: CurrentUserData,
): WorkspaceUser | null {
  if (current.user.role === "TEACHER" && current.teacherProfile) {
    return {
      id: current.user.id,
      role: "teacher",
      name: current.teacherProfile.fullName,
      account: current.teacherProfile.employeeNumber,
      department:
        current.teacherProfile.departmentName ??
        current.teacherProfile.collegeName ??
        "—",
      email: current.user.primaryEmailMasked ?? current.user.primaryEmail ?? "",
    };
  }
  if (current.user.role === "ADMIN" && current.adminProfile) {
    return {
      id: current.user.id,
      role: "admin",
      name: current.adminProfile.fullName,
      account: current.adminProfile.employeeNumber,
      department: current.adminProfile.departmentName ?? "—",
      email: current.user.primaryEmailMasked ?? current.user.primaryEmail ?? "",
    };
  }
  return null;
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (updateCallback: () => void) => unknown;
};

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

const adminRouteIds = new Set<AdminRoute>(
  adminNav.map((item) => item.id as AdminRoute),
);

function adminRouteFromHash(hash: string): AdminRoute | null {
  const match = hash.match(/^#admin\/([^?]+)/);
  const candidate = match?.[1] as AdminRoute | undefined;
  return candidate && adminRouteIds.has(candidate) ? candidate : null;
}

function updateAdminHash(route: AdminRoute) {
  const nextHash = `#admin/${route}`;
  if (window.location.hash === nextHash) return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}${nextHash}`,
  );
}

const pageCopy: Record<
  Role,
  Record<string, { title: string; eyebrow: string; description: string }>
> = {
  teacher: {
    courses: {
      title: "课程管理",
      eyebrow: "教学业务",
      description: "管理本人授课班级、课程目标、打卡时间窗与邀请码。",
    },
    roster: {
      title: "学生管理",
      eyebrow: "教学业务",
      description: "查看直接加入的课程成员、加入信息、学时进度与当前状态。",
    },
    checkins: {
      title: "打卡审核",
      eyebrow: "教学业务",
      description: "集中处理学生打卡记录与异常内容。",
    },
    grades: {
      title: "成绩管理",
      eyebrow: "教学业务",
      description: "录入耐力跑成绩并统一发布给学生。",
    },
    exemptions: {
      title: "免测与组织认证",
      eyebrow: "教学业务",
      description: "审核免测申请及组织认证材料。",
    },
  },
  admin: {
    overview: {
      title: "系统概览",
      eyebrow: "管理员工作台",
      description: "查看 Backend 实时健康状态与当前可用的管理数据。",
    },
    semesters: {
      title: "学期管理",
      eyebrow: "全局治理",
      description: "创建、切换与归档学期。切换当前学期会影响全系统业务范围。",
    },
    accounts: {
      title: "用户与账号",
      eyebrow: "全局治理",
      description: "管理教师和学生账号、恢复申请、验证码解锁与数据删除。",
    },
    support: {
      title: "支持请求",
      eyebrow: "服务运营",
      description:
        "集中处理系统故障及需要技术团队协助的事项；当前为前端规划功能演示。",
    },
    rules: {
      title: "耐力跑换算表",
      eyebrow: "全局治理",
      description:
        "维护四套耐力跑成绩换算规则。学时目标仅由任课教师在教学班内配置。",
    },
    system: {
      title: "系统模式",
      eyebrow: "系统维护",
      description: "在正常、只读和维护模式之间切换；每次变更都写入审计日志。",
    },
    help: {
      title: "帮助中心",
      eyebrow: "内容管理",
      description: "维护面向学生的中英双语帮助内容、关键词与发布状态。",
    },
    audit: {
      title: "审计日志",
      eyebrow: "系统维护",
      description: "追踪关键操作。审计记录只读，不可修改或删除。",
    },
  },
};

const realPageDescription: Record<Role, Record<string, string>> = {
  teacher: {
    courses: "查看服务端教学班、成员关系、时间窗与一次性课程邀请。",
    roster: "查看真实课程成员、加入状态与服务端成绩进度。",
    checkins: "依据服务端记录与受保护运动凭证追加有效或无效审核。",
    grades: "重新计算并发布服务端成绩投影；客户端不录入或伪造分数。",
    exemptions: "审核服务端免测申请；审核结论不会自动生成分数或抵扣时长。",
  },
  admin: {
    overview: "查看 Backend 实时健康状态与当前可用的管理数据。",
    semesters: "查看服务端学期状态；当前合同不提供手工创建、切换或归档操作。",
    accounts: "查看组织范围内的账号与角色资料；当前合同不提供账号恢复、解锁或删除操作。",
    support: "查看组织范围内的用户反馈；当前合同不提供回复或状态变更操作。",
    rules: "维护服务端总学时成绩规则草稿，并执行双管理员审批流程。",
    system: "查看当前服务端系统模式；客户端不显示合同未开放的切换操作。",
    help: "查看服务端已发布的中英文帮助内容；发布能力不在当前客户端合同中。",
    audit: "追踪服务端关键操作；审计记录只读，不可修改或删除。",
  },
};

function ThemeControl({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  return (
    <div className="theme-control" aria-label="主题模式">
      {(
        [
          ["light", "浅色"],
          ["dark", "深色"],
          ["system", "跟随系统"],
        ] as const
      ).map(([value, label]) => (
        <button
          key={value}
          className={theme === value ? "selected" : ""}
          aria-pressed={theme === value}
          onClick={() => onChange(value)}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Badge({
  children,
  tone = "blue",
}: {
  children: React.ReactNode;
  tone?: Tone;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PortalApp() {
  const [role, setRole] = useState<Role | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode | null>(
    null,
  );
  const [currentUser, setCurrentUser] = useState<WorkspaceUser | null>(null);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep | null>(null);
  const [recoveryOrganizationCode, setRecoveryOrganizationCode] = useState("");
  const [recoveryAccount, setRecoveryAccount] = useState("");
  const [recoveryRole, setRecoveryRole] = useState<"TEACHER" | "ADMIN">(
    "TEACHER",
  );
  const [recoveryId, setRecoveryId] = useState("");
  const [recoveryExpiresAt, setRecoveryExpiresAt] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [recoveryPasswordConfirmation, setRecoveryPasswordConfirmation] =
    useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [locale, setLocale] = useState<Locale>("zh");
  const [active, setActive] = useState("overview");
  const [tabDirection, setTabDirection] =
    useState<TabTransitionDirection>("forward");
  const [tabTransitionVersion, setTabTransitionVersion] = useState(0);
  const [tabScrollTop, setTabScrollTop] = useState(0);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<string | null>(null);
  const [adminContext, setAdminContext] = useState<{
    semesterName: string;
    notificationCount: number;
    systemMode: SystemMode;
  }>({
    semesterName: "—",
    notificationCount: 0,
    systemMode: "NORMAL",
  });
  const [teacherSemesterName, setTeacherSemesterName] = useState("—");
  const sidebarController = useResizableSidebar(role ?? "teacher");
  const preferencesRestored = useRef(false);
  const themeTransitionTimeoutRef = useRef<number | null>(null);
  const workspaceScrollPositions = useRef<Record<Role, Record<string, number>>>(
    { teacher: {}, admin: {} },
  );
  const sidebarState = sidebarController.sidebar;
  const sidebarWidth = sidebarState.width;
  const isSidebarCollapsed = sidebarState.collapsed;

  const enterWorkspace = useCallback(
    (resolvedRole: Role, user: WorkspaceUser) => {
      workspaceScrollPositions.current[resolvedRole] = {};
      setTabDirection("forward");
      setTabTransitionVersion(0);
      setTabScrollTop(0);
      setRole(resolvedRole);
      setWorkspaceMode("real");
      setCurrentUser(user);
      setActive(resolvedRole === "teacher" ? "courses" : "overview");
      if (resolvedRole === "admin") updateAdminHash("overview");
      setLoginError("");
    },
    [],
  );

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
        if (
          storedTheme === "light" ||
          storedTheme === "dark" ||
          storedTheme === "system"
        )
          nextTheme = storedTheme;
        nextLocale =
          window.localStorage.getItem("bnbu-locale") === "en" ? "en" : "zh";
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

  useEffect(
    () => () => {
      if (themeTransitionTimeoutRef.current !== null)
        window.clearTimeout(themeTransitionTimeoutRef.current);
    },
    [],
  );

  const handleThemeChange = (nextTheme: Theme) => {
    if (nextTheme === theme) return;
    const root = document.documentElement;
    if (themeTransitionTimeoutRef.current !== null)
      window.clearTimeout(themeTransitionTimeoutRef.current);
    const updateTheme = () =>
      flushSync(() => {
        // The root attribute must change inside the view-transition callback so the
        // browser captures the new palette before the next frame is painted.
        root.dataset.theme = nextTheme;
        setTheme(nextTheme);
      });
    const transitionDocument = document as ViewTransitionDocument;
    if (
      typeof transitionDocument.startViewTransition === "function" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
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
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (hasApiSession()) {
          try {
            const user = workspaceUserFromCurrent(await getMe());
            if (!user) throw new Error("SESSION_ROLE_PROFILE_MISMATCH");
            if (!cancelled) enterWorkspace(user.role, user);
            return;
          } catch {
            clearApiSession();
          }
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enterWorkspace]);

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
    const transitionSettledTimeout = window.setTimeout(
      restoreScroll,
      TAB_PAGE_TRANSITION_EXIT_FALLBACK_MS,
    );

    restoreScroll();
    const animationFrame = window.requestAnimationFrame(() => {
      restoreScroll();
      settledAnimationFrame = window.requestAnimationFrame(restoreScroll);
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      if (settledAnimationFrame !== null)
        window.cancelAnimationFrame(settledAnimationFrame);
      window.clearTimeout(transitionSettledTimeout);
    };
  }, [active, role, tabScrollTop]);

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
      const user = workspaceUserFromCurrent(await getMe());
      if (!user || user.role !== (apiRole === "ADMIN" ? "admin" : "teacher")) {
        clearApiSession();
        setLoginError(
          "账号资料与登录角色不一致，请联系管理员。 requestId：请查看 /me 响应",
        );
        return;
      }
      enterWorkspace(user.role, user);
    } catch (error) {
      setLoginError(apiErrorText(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const logout = () => {
    if (hasApiSession()) void logoutApi();
    if (role === "admin") {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
    setRole(null);
    setWorkspaceMode(null);
    setCurrentUser(null);
    setPassword("");
    setShowPassword(false);
    setIsSubmitting(false);
    setActive("overview");
    setTabTransitionVersion(0);
    setTabScrollTop(0);
    setModal(null);
  };

  const openRecovery = () => {
    setRecoveryOrganizationCode("");
    setRecoveryAccount(account.trim());
    setRecoveryRole("TEACHER");
    setRecoveryId("");
    setRecoveryExpiresAt("");
    setRecoveryCode("");
    setRecoveryPassword("");
    setRecoveryPasswordConfirmation("");
    setRecoveryError("");
    setRecoveryBusy(false);
    setRecoveryStep("identify");
  };

  const returnToLogin = () => {
    setRecoveryStep(null);
    setRecoveryError("");
  };

  const sendRecoveryCode = async () => {
    if (recoveryBusy) return;
    const organizationCode = recoveryOrganizationCode.trim().toUpperCase();
    const recoveryEmail = recoveryAccount.trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(organizationCode)) {
      setRecoveryError("请输入 2–32 位学校组织代码（大写字母、数字、下划线或连字符）。");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(recoveryEmail)) {
      setRecoveryError("请输入账号已绑定的完整邮箱地址。");
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError("");
    try {
      const accepted = await requestAccountRecovery({
        organizationCode,
        account: recoveryEmail,
        requestedRole: recoveryRole,
        locale: locale === "en" ? "en" : "zh-CN",
      });
      setRecoveryOrganizationCode(organizationCode);
      setRecoveryId(accepted.recoveryId);
      setRecoveryExpiresAt(accepted.expiresAt);
      setRecoveryStep("reset");
    } catch (error) {
      setRecoveryError(apiErrorText(error, locale));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const resetPassword = async () => {
    if (recoveryBusy) return;
    if (!recoveryId) {
      setRecoveryError("密码恢复请求已失效，请返回登录页后重新发起。");
      return;
    }
    if (!/^\d{4,10}$/.test(recoveryCode)) {
      setRecoveryError("请输入邮箱收到的 4–10 位数字验证码。");
      return;
    }
    if (recoveryPassword.length < 12) {
      setRecoveryError("新密码至少需要 12 位字符。");
      return;
    }
    if (recoveryPassword !== recoveryPasswordConfirmation) {
      setRecoveryError("两次输入的新密码不一致。");
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError("");
    try {
      await completeAccountRecovery({
        recoveryId,
        verificationCode: recoveryCode,
        newPassword: recoveryPassword,
      });
      setAccount(recoveryAccount.trim());
      setRecoveryStep("complete");
    } catch (error) {
      setRecoveryError(apiErrorText(error, locale));
    } finally {
      setRecoveryBusy(false);
    }
  };

  if (!role || !workspaceMode || !currentUser) {
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
            <section
              className={`login-card ${recoveryStep ? "login-card-recovery" : ""}`}
              aria-labelledby="login-title"
            >
              <div className="login-brand">
                <span className="login-logo-surface">
                  <Image
                    className="login-logo"
                    src="/branding/sports-logo.png"
                    alt="体育课程管理平台标志"
                    width={104}
                    height={104}
                    priority
                    unoptimized
                  />
                </span>
                <p className="login-platform-name">体育课程管理平台</p>
                <p className="login-school-name">北师香港浸会大学</p>
              </div>
              {!recoveryStep ? (
                <>
                  <div className="login-card-head">
                    <h1 id="login-title">登录管理平台</h1>
                    <p>使用学校分配的教师或管理员账号登录。</p>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submitLogin();
                    }}
                    onKeyDown={(event) => {
                      if (
                        event.key !== "Enter" ||
                        event.nativeEvent.isComposing ||
                        !(event.target instanceof HTMLInputElement)
                      )
                        return;
                      event.preventDefault();
                      void submitLogin();
                    }}
                  >
                    <label>
                      <span>工号或邮箱</span>
                      <input
                        value={account}
                        onChange={(event) => setAccount(event.target.value)}
                        placeholder="请输入工号或学校邮箱"
                        autoComplete="username"
                      />
                    </label>
                    <label>
                      <span>密码</span>
                      <span className="password-field">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="请输入密码"
                          autoComplete="current-password"
                        />
                        <button
                          className="password-visibility"
                          type="button"
                          aria-label="显示或隐藏密码"
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? (
                            <EyeOff aria-hidden="true" />
                          ) : (
                            <Eye aria-hidden="true" />
                          )}
                        </button>
                      </span>
                    </label>
                    {loginError && <p className="form-error">{loginError}</p>}
                    <button
                      className="primary-button full-button"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "正在登录…" : "登录"}
                    </button>
                  </form>
                  <button
                    className="text-button forgot-button"
                    type="button"
                    onClick={openRecovery}
                  >
                    忘记密码或无法登录？
                  </button>
                  <p className="security-note">
                    系统仅使用后端认证与授权数据，并根据账号权限进入对应工作台
                  </p>
                </>
              ) : (
                <PasswordRecovery
                  step={recoveryStep}
                  organizationCode={recoveryOrganizationCode}
                  account={recoveryAccount}
                  requestedRole={recoveryRole}
                  expiresAt={recoveryExpiresAt}
                  code={recoveryCode}
                  password={recoveryPassword}
                  passwordConfirmation={recoveryPasswordConfirmation}
                  error={recoveryError}
                  busy={recoveryBusy}
                  onOrganizationCodeChange={setRecoveryOrganizationCode}
                  onAccountChange={setRecoveryAccount}
                  onRequestedRoleChange={setRecoveryRole}
                  onCodeChange={setRecoveryCode}
                  onPasswordChange={setRecoveryPassword}
                  onPasswordConfirmationChange={setRecoveryPasswordConfirmation}
                  onBack={returnToLogin}
                  onSendCode={() => void sendRecoveryCode()}
                  onResetPassword={() => void resetPassword()}
                  onOpenAssistance={() => {
                    setRecoveryError("");
                    setRecoveryStep("assistance");
                  }}
                />
              )}
            </section>
          </section>
          {toast && (
            <div className="toast" role="status">
              {toast}
            </div>
          )}
        </main>
      </LocalizedContent>
    );
  }

  const displayUser = currentUser;
  const nav = role === "teacher" ? teacherNav : adminNav;
  const baseCopy =
    pageCopy[role][active] ??
    pageCopy[role][role === "teacher" ? "courses" : "overview"];
  const copy = {
    ...baseCopy,
    ...(role === "admin" && active === "rules"
      ? { title: "全局规则" }
      : {}),
    description: realPageDescription[role][active] ?? baseCopy.description,
  };
  const isCourseManagement = role === "teacher" && active === "courses";
  const isFocusedTeacherPage =
    role === "teacher" &&
    ["roster", "checkins", "grades", "exemptions"].includes(active);
  const isFocusedWorkspace = role === "admin" || isFocusedTeacherPage;

  const navigateTo = (nextActive: string) => {
    if (nextActive === active) return;

    workspaceScrollPositions.current[role][active] = window.scrollY;
    const nextScrollTop =
      workspaceScrollPositions.current[role][nextActive] ?? 0;
    const roleNav = role === "teacher" ? teacherNav : adminNav;
    const currentIndex = roleNav.findIndex((item) => item.id === active);
    const nextIndex = roleNav.findIndex((item) => item.id === nextActive);

    if (currentIndex >= 0 && nextIndex >= 0) {
      setTabDirection(nextIndex > currentIndex ? "forward" : "backward");
    }
    setTabTransitionVersion((version) => version + 1);
    setTabScrollTop(nextScrollTop);

    setActive(nextActive);
    if (role === "admin" && adminRouteIds.has(nextActive as AdminRoute))
      updateAdminHash(nextActive as AdminRoute);
  };

  return (
    <LocalizedContent locale={locale}>
      <div
        ref={sidebarController.setShellNode}
        className={`app-shell app-shell-tabbed-workspace app-shell-${role} ${isCourseManagement ? "app-shell-course-management" : ""} ${isFocusedWorkspace ? "app-shell-focused-workspace" : ""} ${isSidebarCollapsed ? "is-sidebar-collapsed" : ""} ${sidebarController.isResizing ? "is-resizing-sidebar" : ""} ${sidebarController.isTransitioning ? "is-sidebar-transitioning" : ""} ${sidebarController.isInitialized ? "is-sidebar-initialized" : "is-sidebar-initializing"}`}
        style={
          {
            "--sidebar-width": `${sidebarWidth}px`,
            "--sidebar-content-visibility": isSidebarCollapsed ? 0 : 1,
          } as CSSProperties
        }
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
                aria-label={
                  locale === "en"
                    ? `Open ${displayUser.name}'s profile`
                    : `打开${displayUser.name}的用户信息`
                }
                aria-describedby={
                  isSidebarCollapsed ? "teacher-profile-tooltip" : undefined
                }
                onClick={() => setModal("profile")}
              >
                <span
                  className="avatar teacher-profile-avatar"
                  aria-hidden="true"
                >
                  {displayUser.name.trim().slice(0, 1) || "师"}
                </span>
                <span className="teacher-profile-copy">
                  <b>{displayUser.name}</b>
                  <small>
                    {displayUser.department} · {displayUser.account}
                  </small>
                </span>
                <span
                  className="teacher-profile-tooltip"
                  id="teacher-profile-tooltip"
                  role="tooltip"
                >
                  <b>{displayUser.name}</b>
                  <small>
                    {displayUser.department} · {displayUser.account}
                  </small>
                </span>
              </button>
            ) : (
              <button
                className="profile-button sidebar-profile-card"
                type="button"
                aria-label={
                  locale === "en"
                    ? `Open ${displayUser.name}'s profile`
                    : `打开${displayUser.name}的用户信息`
                }
                onClick={() => setModal("profile")}
              >
                <span className="avatar">
                  {displayUser.name.trim().slice(0, 1) || "管"}
                </span>
                <span>
                  <b>{displayUser.name}</b>
                  <small>
                    {displayUser.email ||
                      `${displayUser.department} · ${displayUser.account}`}
                  </small>
                </span>
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
            {isSidebarCollapsed ? (
              <ChevronRight size={16} strokeWidth={2} />
            ) : (
              <ChevronLeft size={16} strokeWidth={2} />
            )}
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
            aria-valuetext={
              isSidebarCollapsed
                ? "导航栏已折叠"
                : `导航栏宽度 ${sidebarWidth} 像素`
            }
            tabIndex={0}
            onPointerDown={sidebarController.startResize}
            onPointerMove={sidebarController.moveResize}
            onPointerUp={(event) =>
              sidebarController.finishResize(event.pointerId)
            }
            onPointerCancel={(event) =>
              sidebarController.finishResize(event.pointerId, true)
            }
            onKeyDown={sidebarController.resizeWithKeyboard}
          />
        </aside>
        <main className="workspace">
          <PageHeader
            className={`workspace-header-tabbed ${role === "teacher" ? "workspace-header-teacher" : "workspace-header-admin"} ${isCourseManagement ? "workspace-header-course" : ""} ${isFocusedWorkspace ? "workspace-header-focused" : ""}`}
            title={copy.title}
            description={copy.description}
            eyebrow={isFocusedWorkspace ? undefined : copy.eyebrow}
            transitionKey={
              tabTransitionVersion > 0
                ? `${active}-${tabTransitionVersion}`
                : undefined
            }
            transitionDirection={tabDirection}
            actions={
              <>
                <div
                  className="workspace-school-mark"
                  aria-label="北师香港浸会大学"
                >
                  <Image src="/bnbu-emblem.svg" alt="" width={34} height={34} />
                  <span>
                    <b>北师香港浸会大学</b>
                    <small>BNBU 校园体育</small>
                  </span>
                </div>
                <div className="semester-pill">
                  <span>当前学期</span>
                  <b>
                    {role === "admin"
                      ? adminContext.semesterName
                      : teacherSemesterName}
                  </b>
                </div>
                {role === "admin" && adminContext.systemMode !== "NORMAL" && (
                  <Badge
                    tone={
                      adminContext.systemMode === "READ_ONLY" ? "orange" : "red"
                    }
                  >
                    {adminLabel(locale, "systemMode", adminContext.systemMode)}
                  </Badge>
                )}
                <LanguageToggle locale={locale} onChange={setLocale} compact />
                <ThemeControl theme={theme} onChange={handleThemeChange} />
                <button
                  className="icon-button"
                  aria-label="通知"
                  type="button"
                  onClick={() =>
                    setToast(
                      role === "admin" && adminContext.notificationCount
                        ? adminCopy(locale, "system_notifications", {
                            count: adminContext.notificationCount,
                          })
                        : adminCopy(locale, "no_system_notifications"),
                    )
                  }
                >
                  ◌
                  {role === "admin" && adminContext.notificationCount > 0 ? (
                    <span />
                  ) : null}
                </button>
              </>
            }
          />
          <section className="page-content">
            {role === "teacher" ? (
              <TeacherWorkspace
                active={active}
                direction={tabDirection}
                mode={workspaceMode}
                showToast={setToast}
                onSemesterChange={setTeacherSemesterName}
              />
            ) : (
              <AdminWorkspace
                active={active}
                direction={tabDirection}
                locale={locale}
                mode={workspaceMode}
                showToast={setToast}
                onNavigate={(route) => navigateTo(route)}
                onContextChange={setAdminContext}
              />
            )}
          </section>
        </main>
        {modal && (
          <Modal
            role={role}
            user={displayUser}
            theme={theme}
            onThemeChange={handleThemeChange}
            close={() => setModal(null)}
            logout={logout}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </div>
    </LocalizedContent>
  );
}

function LoginWordmark() {
  return (
    <p
      className="login-wordmark"
      aria-label="北师香港浸会大学 · 体育课程管理平台"
    >
      北师香港浸会大学 · 体育课程管理平台
    </p>
  );
}

function PasswordRecovery({
  step,
  organizationCode,
  account,
  requestedRole,
  expiresAt,
  code,
  password,
  passwordConfirmation,
  error,
  busy,
  onOrganizationCodeChange,
  onAccountChange,
  onRequestedRoleChange,
  onCodeChange,
  onPasswordChange,
  onPasswordConfirmationChange,
  onBack,
  onSendCode,
  onResetPassword,
  onOpenAssistance,
}: {
  step: RecoveryStep;
  organizationCode: string;
  account: string;
  requestedRole: "TEACHER" | "ADMIN";
  expiresAt: string;
  code: string;
  password: string;
  passwordConfirmation: string;
  error: string;
  busy: boolean;
  onOrganizationCodeChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onRequestedRoleChange: (value: "TEACHER" | "ADMIN") => void;
  onCodeChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onPasswordConfirmationChange: (value: string) => void;
  onBack: () => void;
  onSendCode: () => void;
  onResetPassword: () => void;
  onOpenAssistance: () => void;
}) {
  const submit = (event: React.FormEvent, action: () => void) => {
    event.preventDefault();
    action();
  };
  const titles: Record<RecoveryStep, string> = {
    identify: "重置密码",
    reset: "验证并设置新密码",
    assistance: "无法登录协助",
    complete: "密码重置完成",
  };

  return (
    <div className="password-recovery" aria-live="polite">
      <div className="recovery-head">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="返回登录"
        >
          <ArrowLeft size={18} aria-hidden="true" /> 返回登录
        </button>
        <span className="recovery-step">
          {step === "identify" ? "1 / 2" : step === "reset" ? "2 / 2" : ""}
        </span>
        <h1 id="login-title">{titles[step]}</h1>
      </div>
      {step === "identify" && (
        <form
          className="recovery-form"
          onSubmit={(event) => submit(event, onSendCode)}
        >
          <p>
            输入学校组织代码、账号绑定邮箱和账号身份。后端会创建一次性恢复请求，并通过已配置的邮件服务发送验证码。
          </p>
          <label>
            <span>学校组织代码</span>
            <input
              value={organizationCode}
              onChange={(event) =>
                onOrganizationCodeChange(event.target.value.toUpperCase())
              }
              placeholder="例如 BNBU"
              autoComplete="organization"
              autoCapitalize="characters"
              autoFocus
            />
          </label>
          <AppSelect
            label="账号身份"
            value={requestedRole}
            options={[
              { value: "TEACHER", label: "教师" },
              { value: "ADMIN", label: "管理员" },
            ]}
            onChange={(value) =>
              onRequestedRoleChange(value === "ADMIN" ? "ADMIN" : "TEACHER")
            }
            required
          />
          <label>
            <span>账号绑定邮箱</span>
            <input
              value={account}
              onChange={(event) => onAccountChange(event.target.value)}
              placeholder="请输入完整学校邮箱"
              type="email"
              autoComplete="email"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="primary-button full-button"
            type="submit"
            disabled={busy}
          >
            <Mail size={17} aria-hidden="true" />
            {busy ? "正在提交…" : "发送验证码"}
          </button>
          <button
            className="text-button recovery-assistance-link"
            type="button"
            onClick={onOpenAssistance}
          >
            收不到邮箱验证码或账号无法使用？
          </button>
        </form>
      )}
      {step === "reset" && (
        <form
          className="recovery-form"
          onSubmit={(event) => submit(event, onResetPassword)}
        >
          <p>
            恢复请求已由后端受理。请输入邮件验证码和新密码；成功后，该账号在所有设备上的旧登录状态将失效。
          </p>
          {expiresAt && (
            <p className="recovery-note">
              本次恢复请求有效期至：
              {new Date(expiresAt).toLocaleString()}
            </p>
          )}
          <label>
            <span>邮件验证码</span>
            <input
              value={code}
              onChange={(event) =>
                onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="请输入 4–10 位数字验证码"
              autoFocus
            />
          </label>
          <label>
            <span>新密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="至少 12 位字符"
              autoComplete="new-password"
            />
          </label>
          <label>
            <span>确认新密码</span>
            <input
              type="password"
              value={passwordConfirmation}
              onChange={(event) =>
                onPasswordConfirmationChange(event.target.value)
              }
              placeholder="请再次输入新密码"
              autoComplete="new-password"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button
            className="primary-button full-button"
            type="submit"
            disabled={busy}
          >
            <KeyRound size={17} aria-hidden="true" />
            {busy ? "正在验证…" : "验证并重置密码"}
          </button>
        </form>
      )}
      {step === "assistance" && (
        <div className="recovery-assistance">
          <span className="recovery-alert">
            <CircleAlert size={22} aria-hidden="true" />
          </span>
          <p>
            如账号不存在、已停用，或无法使用绑定邮箱，请联系系统管理员完成身份核验后处理账号恢复或联系方式更新。
          </p>
          <ul>
            <li>
              教师和管理员：管理员核实账号状态，并协助更新有效邮箱或恢复账号。
            </li>
            <li>
              学生：请使用学生端验证码登录；手机号和邮箱均失效时，由管理员核验身份后绑定新的联系方式。
            </li>
          </ul>
          <p className="recovery-note">
            请勿仅凭姓名或学号请求登录；身份核验需通过学校规定的安全渠道完成。
          </p>
          <button
            className="primary-button full-button"
            type="button"
            onClick={onBack}
          >
            返回登录
          </button>
        </div>
      )}
      {step === "complete" && (
        <div className="recovery-complete">
          <span className="recovery-success">
            <KeyRound size={24} aria-hidden="true" />
          </span>
          <p>
            密码已重置。请使用新密码重新登录；为保护账号安全，所有旧登录状态均已失效。
          </p>
          <button
            className="primary-button full-button"
            type="button"
            onClick={onBack}
          >
            使用新密码登录
          </button>
        </div>
      )}
    </div>
  );
}

function SportsBrand() {
  return (
    <div className="brand sports-brand" translate="no" aria-label="SPORTS">
      <Image
        className="sports-brand-emblem"
        src="/bnbu-emblem.svg"
        alt=""
        width={54}
        height={54}
      />
      <span className="sports-brand-wordmark" aria-hidden="true">
        SPORTS
      </span>
    </div>
  );
}

function Modal({
  role,
  user,
  theme,
  onThemeChange,
  close,
  logout,
}: {
  role: Role;
  user: WorkspaceUser;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  close: () => void;
  logout: () => void;
}) {
  const isTeacher = role === "teacher";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        className="modal account-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-head">
          <div>
            <h2 id="modal-title">{user.name}</h2>
            <p>{user.department} · {user.account}</p>
          </div>
          <button className="icon-button" aria-label="关闭" onClick={close}>
            ×
          </button>
        </div>
        <ThemeProfile theme={theme} onChange={onThemeChange} />
        <div className="profile-meta">
          <span>当前身份</span>
          <Badge tone={role === "teacher" ? "blue" : "green"}>
            {role.toUpperCase()}
          </Badge>
        </div>
        {isTeacher && (
          <p className="admin-planned-banner">
            已登录状态下修改密码尚未纳入 Backend 合同；请退出后使用真实邮箱恢复流程重置密码。
          </p>
        )}
        <div className="modal-footer">
          <button className="secondary-button" onClick={close}>
            取消
          </button>
          <button className="danger-button" onClick={logout}>
            退出登录
          </button>
        </div>
      </section>
    </div>
  );
}

function ThemeProfile({
  theme,
  onChange,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
}) {
  return (
    <section className="theme-profile" aria-labelledby="theme-profile-title">
      <div>
        <h3 id="theme-profile-title">系统配色</h3>
        <p>选择浅色、深色或跟随系统；设置会自动保存在此设备。</p>
      </div>
      <ThemeControl theme={theme} onChange={onChange} />
    </section>
  );
}
