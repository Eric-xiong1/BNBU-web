import {
  ADMIN_STORAGE_EVENT,
  ADMIN_STORAGE_KEY,
  GRADE_CORRECTION_TRANSITIONS,
  HELP_ARTICLE_TRANSITIONS,
  SEMESTER_TRANSITIONS,
  USER_TRANSITIONS,
  assertAdminPermission,
  buildUserImportPreview,
  deepClone,
  enduranceTableKey,
  makeId,
  makeRequestId,
  nowIso,
  todayIso,
  validateEnduranceTable,
  validateSemesterInput,
  validateUserInput,
} from "./admin-domain";
import { createInitialAdminState } from "./admin-mock-data";
import {
  AdminServiceError,
  type AdminPermission,
  type AdminState,
  type AdminUser,
  type CreateSemesterInput,
  type EnduranceRuleInput,
  type GradeCorrectionStatus,
  type HelpArticleInput,
  type MaintenanceAnnouncement,
  type PurgeAllBusinessDataInput,
  type PurgeAllBusinessDataResult,
  type RecoveryReviewInput,
  type SupportTicket,
  type SystemMode,
  type TicketStatus,
  type UpdateSemesterInput,
  type UserInput,
  type UserRole,
} from "./admin-types";

export type AdminMutationResult<T = undefined> = {
  state: AdminState;
  value: T;
};

let memoryState: AdminState | null = null;

function readPersistedState() {
  if (typeof window === "undefined") return memoryState ?? createInitialAdminState();
  try {
    const saved = window.localStorage.getItem(ADMIN_STORAGE_KEY);
    if (!saved) return createInitialAdminState();
    const parsed = JSON.parse(saved) as Partial<AdminState>;
    if (parsed.schemaVersion !== 2 || !Array.isArray(parsed.users) || !Array.isArray(parsed.semesters)) {
      return createInitialAdminState();
    }
    return parsed as AdminState;
  } catch {
    return memoryState ?? createInitialAdminState();
  }
}

function persistState(state: AdminState) {
  memoryState = deepClone(state);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent(ADMIN_STORAGE_EVENT, { detail: { revision: state.revision } }));
  } catch {
    throw new AdminServiceError("STORAGE", "STORAGE_UNAVAILABLE");
  }
}

async function waitForMock() {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 160));
}

function currentActor(state: AdminState) {
  return state.users.find((user) => user.id === state.currentAdminId) ?? null;
}

function addAudit(
  state: AdminState,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown>,
) {
  const actor = currentActor(state);
  state.auditLogs.unshift({
    id: makeId("AL"),
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? "System administrator",
    action,
    resourceType,
    resourceId,
    requestId: makeRequestId(),
    metadata,
    createdAt: nowIso(),
  });
}

function addNotification(
  state: AdminState,
  kind: AdminState["notifications"][number]["kind"],
  audience: AdminState["notifications"][number]["audience"],
  title: string,
  message: string,
) {
  state.notifications.unshift({ id: makeId("notice"), kind, audience, title, message, createdAt: nowIso() });
}

async function mutate<T>(
  permission: AdminPermission,
  operation: (draft: AdminState) => T,
): Promise<AdminMutationResult<T>> {
  await waitForMock();
  assertAdminPermission(permission);
  const draft = deepClone(readPersistedState());
  const value = operation(draft);
  draft.revision += 1;
  persistState(draft);
  return { state: deepClone(draft), value };
}

function findUser(state: AdminState, id: string) {
  const user = state.users.find((item) => item.id === id);
  if (!user) throw new AdminServiceError("NOT_FOUND", "USER_NOT_FOUND");
  return user;
}

function ensureExpectedVersion(actual: string, expected?: string) {
  if (expected && actual !== expected) throw new AdminServiceError("CONFLICT", "DATA_CHANGED");
}

function normalizeUserInput(input: UserInput, existing?: AdminUser): AdminUser {
  const stamp = nowIso();
  return {
    id: existing?.id ?? makeId("user"),
    account: input.account.trim(),
    email: input.email.trim().toLowerCase(),
    role: input.role,
    name: input.name.trim(),
    college: input.college.trim(),
    ...(input.role === "student" ? {
      className: input.className?.trim(),
      gender: input.gender,
      gradeLevel: input.gradeLevel,
      admissionYear: input.admissionYear,
    } : {}),
    status: input.status,
    tokenVersion: existing?.tokenVersion ?? 0,
    verificationLock: existing?.verificationLock,
    assignedCourseCount: existing?.assignedCourseCount ?? 0,
    createdAt: existing?.createdAt ?? stamp,
    updatedAt: stamp,
  };
}

export async function loadAdminState() {
  await waitForMock();
  const state = readPersistedState();
  if (!memoryState && typeof window !== "undefined" && !window.localStorage.getItem(ADMIN_STORAGE_KEY)) {
    persistState(state);
  }
  return deepClone(state);
}

export async function reloadAdminState() {
  return deepClone(readPersistedState());
}

export async function createSemester(input: CreateSemesterInput) {
  return mutate("admin.semesters.write", (state) => {
    validateSemesterInput(input, state.semesters);
    const semester = {
      ...input,
      id: makeId("semester"),
      name: input.name.trim(),
      status: "upcoming" as const,
      courseCount: 0,
      studentCount: 0,
      updatedAt: nowIso(),
    };
    state.semesters.unshift(semester);
    addAudit(state, "semester.create", "semester", semester.id, { after: semester });
    return semester;
  });
}

export async function updateSemester(input: UpdateSemesterInput) {
  return mutate("admin.semesters.write", (state) => {
    const semester = state.semesters.find((item) => item.id === input.id);
    if (!semester) throw new AdminServiceError("NOT_FOUND", "SEMESTER_NOT_FOUND");
    ensureExpectedVersion(semester.updatedAt, input.expectedUpdatedAt);
    if (semester.status !== "upcoming") throw new AdminServiceError("DEPENDENCY", "SEMESTER_EDIT_LOCKED");
    validateSemesterInput(input, state.semesters, semester.id);
    const before = deepClone(semester);
    Object.assign(semester, {
      name: input.name.trim(),
      academicYear: input.academicYear,
      term: input.term,
      startDate: input.startDate,
      endDate: input.endDate,
      updatedAt: nowIso(),
    });
    addAudit(state, "semester.update", "semester", semester.id, { before, after: semester });
    return semester;
  });
}

export async function setCurrentSemester(id: string) {
  return mutate("admin.semesters.write", (state) => {
    const target = state.semesters.find((semester) => semester.id === id);
    if (!target) throw new AdminServiceError("NOT_FOUND", "SEMESTER_NOT_FOUND");
    if (!SEMESTER_TRANSITIONS[target.status].includes("current")) throw new AdminServiceError("VALIDATION", "SEMESTER_TRANSITION_INVALID");
    if (target.startDate > todayIso()) throw new AdminServiceError("VALIDATION", "SEMESTER_NOT_STARTED");
    const previous = state.semesters.find((semester) => semester.status === "current");
    if (previous) {
      previous.status = "archived";
      previous.updatedAt = nowIso();
    }
    target.status = "current";
    target.updatedAt = nowIso();
    addNotification(state, "semester", "all", "Current semester changed", target.name);
    addAudit(state, "semester.switch", "semester", target.id, { previousSemesterId: previous?.id ?? null, nextSemesterId: target.id });
    return target;
  });
}

export async function createUser(input: UserInput) {
  return mutate("admin.users.write", (state) => {
    if (input.role !== "teacher") throw new AdminServiceError("VALIDATION", "TEACHER_CREATION_ONLY", { role: "TEACHER_CREATION_ONLY" });
    validateUserInput(input, state.users);
    const created = normalizeUserInput(input);
    state.users.unshift(created);
    addAudit(state, "user.create", "user", created.id, { account: created.account, role: created.role, status: created.status });
    return created;
  });
}

export async function updateUser(input: UserInput, reason: string) {
  return mutate("admin.users.write", (state) => {
    const existing = findUser(state, input.id ?? "");
    ensureExpectedVersion(existing.updatedAt, input.expectedUpdatedAt);
    validateUserInput(input, state.users, existing.id);
    if (existing.status !== input.status && !USER_TRANSITIONS[existing.status].includes(input.status)) {
      throw new AdminServiceError("VALIDATION", "USER_STATUS_TRANSITION_INVALID", { status: "USER_STATUS_TRANSITION_INVALID" });
    }
    const materialChange = existing.status !== input.status || existing.role !== input.role || existing.email !== input.email.trim().toLowerCase();
    if (materialChange && !reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const before = deepClone(existing);
    const next = normalizeUserInput(input, existing);
    if (existing.status !== "DISABLED" && next.status === "DISABLED") next.tokenVersion += 1;
    Object.assign(existing, next);
    addNotification(state, "account", next.role === "student" ? "students" : "teachers", "Account updated", next.account);
    addAudit(state, "user.update", "user", existing.id, { before, after: existing, reason: reason.trim() });
    return existing;
  });
}

export async function unlockVerificationCode(userId: string, reason: string) {
  return mutate("admin.users.write", (state) => {
    const user = findUser(state, userId);
    if (user.role !== "student" || !user.verificationLock) throw new AdminServiceError("VALIDATION", "USER_NOT_LOCKED");
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const before = user.verificationLock;
    delete user.verificationLock;
    user.updatedAt = nowIso();
    addAudit(state, "user.unlock_vcode", "user", user.id, { account: user.account, before, reason: reason.trim() });
    return user;
  });
}

export async function forceLogoutUser(userId: string, reason: string) {
  return mutate("admin.users.write", (state) => {
    const user = findUser(state, userId);
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const before = user.tokenVersion;
    user.tokenVersion += 1;
    user.updatedAt = nowIso();
    addAudit(state, "user.force_logout", "user", user.id, { account: user.account, before, after: user.tokenVersion, reason: reason.trim() });
    return user;
  });
}

export async function transferTeacherCourses(fromId: string, toId: string, reason: string) {
  return mutate("admin.users.write", (state) => {
    const from = findUser(state, fromId);
    const to = findUser(state, toId);
    if (from.role !== "teacher" || to.role !== "teacher" || to.status !== "ACTIVE" || from.id === to.id) {
      throw new AdminServiceError("VALIDATION", "TEACHER_TRANSFER_INVALID");
    }
    if (from.assignedCourseCount <= 0) throw new AdminServiceError("DEPENDENCY", "NO_ASSIGNED_COURSES");
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const transferred = from.assignedCourseCount;
    from.assignedCourseCount = 0;
    to.assignedCourseCount += transferred;
    from.updatedAt = nowIso();
    to.updatedAt = nowIso();
    addNotification(state, "account", "students", "Course teacher changed", `${from.name} → ${to.name}`);
    addAudit(state, "user.teacher_handover", "user", from.id, { replacementTeacherId: to.id, transferredCourseCount: transferred, reason: reason.trim() });
    return { from, to, transferred };
  });
}

export async function deleteUser(userId: string, adminPassword: string, reason: string) {
  return mutate("admin.users.delete", (state) => {
    const target = findUser(state, userId);
    if (target.id === state.currentAdminId) throw new AdminServiceError("DEPENDENCY", "CANNOT_DELETE_SELF");
    if (target.role === "teacher" && target.assignedCourseCount > 0) throw new AdminServiceError("DEPENDENCY", "TEACHER_HAS_COURSES");
    if (adminPassword !== "Admin2026!") throw new AdminServiceError("VALIDATION", "ADMIN_PASSWORD_INVALID", { adminPassword: "ADMIN_PASSWORD_INVALID" });
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const cascade = {
      recoveryRequests: state.recoveryRequests.filter((request) => request.userId === target.id).length,
      assignedCourses: target.assignedCourseCount,
    };
    state.users = state.users.filter((user) => user.id !== target.id);
    state.recoveryRequests = state.recoveryRequests.filter((request) => request.userId !== target.id);
    state.auditLogs.forEach((log) => {
      if (log.actorId === target.id) log.actorId = null;
    });
    addAudit(state, "user.delete", "user", target.id, { account: target.account, role: target.role, cascade, reason: reason.trim() });
    return { target, cascade };
  });
}

export async function reviewRecoveryRequest(input: RecoveryReviewInput) {
  return mutate("admin.recovery.review", (state) => {
    const request = state.recoveryRequests.find((item) => item.id === input.requestId);
    if (!request) throw new AdminServiceError("NOT_FOUND", "RECOVERY_NOT_FOUND");
    if (request.status !== "pending") throw new AdminServiceError("VALIDATION", "RECOVERY_ALREADY_REVIEWED");
    if (!input.verificationMethod.trim()) throw new AdminServiceError("VALIDATION", "VERIFICATION_REQUIRED", { verificationMethod: "REQUIRED" });
    if (!input.reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const user = findUser(state, request.userId);
    if (input.decision === "approve") {
      const nextEmail = (input.newEmail || request.requestedEmail || "").trim().toLowerCase();
      if (!nextEmail || !nextEmail.includes("@")) throw new AdminServiceError("VALIDATION", "EMAIL_FORMAT", { newEmail: "EMAIL_FORMAT" });
      if (state.users.some((item) => item.id !== user.id && item.email.toLowerCase() === nextEmail)) {
        throw new AdminServiceError("VALIDATION", "EMAIL_DUPLICATE", { newEmail: "EMAIL_DUPLICATE" });
      }
      user.email = nextEmail;
      user.status = "ACTIVE";
      user.tokenVersion += 1;
      user.updatedAt = nowIso();
      request.status = "approved";
      addNotification(state, "recovery", "students", "Account recovery approved", user.account);
      addAudit(state, "user.recovery", "user", user.id, { decision: "approved", verificationMethod: input.verificationMethod, newEmail: nextEmail, reason: input.reason.trim() });
    } else {
      request.status = "rejected";
      addNotification(state, "recovery", "students", "Account recovery rejected", user.account);
      addAudit(state, "user.recovery", "user", user.id, { decision: "rejected", verificationMethod: input.verificationMethod, reason: input.reason.trim() });
    }
    request.reviewedAt = nowIso();
    request.verificationMethod = input.verificationMethod.trim();
    request.reviewReason = input.reason.trim();
    return request;
  });
}

export async function importUsers(csvText: string, role: "teacher", fallbackPassword: string) {
  return mutate("admin.users.write", (state) => {
    if (role !== "teacher") throw new AdminServiceError("VALIDATION", "TEACHER_CREATION_ONLY", { role: "TEACHER_CREATION_ONLY" });
    const preview = buildUserImportPreview(csvText, role, state.users, fallbackPassword);
    if (preview.length === 0) throw new AdminServiceError("VALIDATION", "CSV_EMPTY");
    if (preview.some((row) => row.errors.length > 0)) throw new AdminServiceError("VALIDATION", "CSV_HAS_ERRORS");
    const created = preview.map((row) => normalizeUserInput(row.input));
    state.users.unshift(...created);
    addAudit(state, "user.batch_create", "user", null, { role, count: created.length, accounts: created.map((user) => user.account) });
    return {
      created,
      passwordRows: preview.map((row) => ({ account: row.input.account, name: row.input.name, email: row.input.email, initialPassword: row.input.initialPassword ?? "" })),
    };
  });
}

function validateRuleMutation(state: AdminState, input: EnduranceRuleInput, replacingId?: string) {
  if (input.minSeconds < 0 || input.maxSeconds < input.minSeconds || input.score < 0 || input.score > 100) {
    throw new AdminServiceError("VALIDATION", "ENDURANCE_RULE_INVALID");
  }
  const nextRule = { ...input, id: replacingId ?? input.id ?? makeId("rule"), updatedAt: nowIso() };
  const groupKey = enduranceTableKey(nextRule);
  const group = state.enduranceRules
    .filter((rule) => rule.id !== replacingId && enduranceTableKey(rule) === groupKey)
    .concat(nextRule);
  const issues = validateEnduranceTable(group);
  if (issues.length > 0) throw new AdminServiceError("VALIDATION", "ENDURANCE_TABLE_INVALID", { table: JSON.stringify(issues) });
  return nextRule;
}

export async function saveEnduranceRule(input: EnduranceRuleInput) {
  return mutate("admin.config.write", (state) => {
    const existing = input.id ? state.enduranceRules.find((rule) => rule.id === input.id) : undefined;
    if (input.id && !existing) throw new AdminServiceError("NOT_FOUND", "ENDURANCE_RULE_NOT_FOUND");
    const before = existing ? deepClone(existing) : null;
    const next = validateRuleMutation(state, input, existing?.id);
    if (existing) Object.assign(existing, next);
    else state.enduranceRules.push(next);
    addAudit(state, existing ? "endurance_rule.update" : "endurance_rule.create", "endurance_rule", next.id, { before, after: next });
    return next;
  });
}

export async function deleteEnduranceRule(id: string) {
  return mutate("admin.config.write", (state) => {
    const target = state.enduranceRules.find((rule) => rule.id === id);
    if (!target) throw new AdminServiceError("NOT_FOUND", "ENDURANCE_RULE_NOT_FOUND");
    const remaining = state.enduranceRules.filter((rule) => enduranceTableKey(rule) === enduranceTableKey(target) && rule.id !== id);
    const issues = validateEnduranceTable(remaining);
    if (remaining.length === 0 || issues.length > 0) throw new AdminServiceError("DEPENDENCY", "ENDURANCE_DELETE_BREAKS_TABLE");
    state.enduranceRules = state.enduranceRules.filter((rule) => rule.id !== id);
    addAudit(state, "endurance_rule.delete", "endurance_rule", id, { before: target });
    return target;
  });
}

export async function switchSystemMode(
  mode: SystemMode,
  reason: string,
  announcement?: Omit<MaintenanceAnnouncement, "id" | "publishedAt" | "publishedBy">,
) {
  return mutate("admin.system.write", (state) => {
    if (state.systemMode.mode === mode) throw new AdminServiceError("VALIDATION", "SYSTEM_MODE_UNCHANGED");
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    if (mode === "MAINTENANCE" && (!announcement?.messageZh.trim() || !announcement.messageEn.trim() || !announcement.expectedRecoveryAt)) {
      throw new AdminServiceError("VALIDATION", "MAINTENANCE_NOTICE_REQUIRED");
    }
    const before = deepClone(state.systemMode);
    state.systemMode = { mode, reason: reason.trim(), changedAt: nowIso(), changedBy: currentActor(state)?.name ?? "System administrator" };
    if (announcement) {
      const item = { ...announcement, id: makeId("ANN"), publishedAt: nowIso(), publishedBy: currentActor(state)?.name ?? "System administrator" };
      state.maintenanceAnnouncements.unshift(item);
      addNotification(state, "maintenance", "all", item.titleZh, item.messageZh);
    } else if (mode === "NORMAL") {
      addNotification(state, "maintenance", "all", "系统已恢复", reason.trim());
    }
    addAudit(state, "system_mode.change", "system", "global", { before: before.mode, after: mode, reason: reason.trim(), announcementId: announcement ? state.maintenanceAnnouncements[0]?.id : null });
    return state.systemMode;
  });
}

export async function publishMaintenanceAnnouncement(input: Omit<MaintenanceAnnouncement, "id" | "publishedAt" | "publishedBy">) {
  return mutate("admin.system.write", (state) => {
    if (!input.titleZh.trim() || !input.titleEn.trim() || !input.messageZh.trim() || !input.messageEn.trim()) {
      throw new AdminServiceError("VALIDATION", "MAINTENANCE_NOTICE_REQUIRED");
    }
    if (input.kind === "planned" && new Date(input.startsAt).getTime() - Date.now() < 48 * 60 * 60 * 1000) {
      throw new AdminServiceError("VALIDATION", "PLANNED_NOTICE_48H");
    }
    const item = { ...input, id: makeId("ANN"), publishedAt: nowIso(), publishedBy: currentActor(state)?.name ?? "System administrator" };
    state.maintenanceAnnouncements.unshift(item);
    addNotification(state, "maintenance", "all", item.titleZh, item.messageZh);
    addAudit(state, "maintenance.announce", "system", item.id, { kind: item.kind, startsAt: item.startsAt, expectedRecoveryAt: item.expectedRecoveryAt ?? null });
    return item;
  });
}

/**
 * Starts a new academic-year workspace while retaining the active administrator,
 * global rules, and immutable audit history required for accountability.
 */
export async function purgeAllBusinessData(input: PurgeAllBusinessDataInput) {
  return mutate("admin.system.purge", (state): PurgeAllBusinessDataResult => {
    if (input.adminPassword !== "Admin2026!") {
      throw new AdminServiceError("VALIDATION", "ADMIN_PASSWORD_INVALID", { adminPassword: "ADMIN_PASSWORD_INVALID" });
    }
    if (input.confirmation.trim() !== "ERASE") {
      throw new AdminServiceError("VALIDATION", "PURGE_CONFIRMATION_INVALID", { confirmation: "PURGE_CONFIRMATION_INVALID" });
    }
    if (!input.reason.trim()) {
      throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    }

    const administrator = currentActor(state);
    if (!administrator || administrator.role !== "admin") {
      throw new AdminServiceError("FORBIDDEN", "PERMISSION_DENIED");
    }

    const result: PurgeAllBusinessDataResult = {
      semesters: state.semesters.length,
      users: state.users.filter((user) => user.id !== administrator.id).length,
      recoveryRequests: state.recoveryRequests.length,
      maintenanceAnnouncements: state.maintenanceAnnouncements.length,
      helpArticles: state.helpArticles.length,
      tickets: state.tickets.length,
      gradeCorrections: state.gradeCorrections.length,
      notifications: state.notifications.length,
    };

    state.semesters = [];
    state.users = [administrator];
    state.recoveryRequests = [];
    state.maintenanceAnnouncements = [];
    state.helpArticles = [];
    state.tickets = [];
    state.gradeCorrections = [];
    state.notifications = [];
    state.auditLogs.forEach((log) => {
      if (log.actorId && log.actorId !== administrator.id) {
        log.actorId = null;
        log.actorName = "Deleted account";
      }
    });
    addAudit(state, "system.business_data_purge", "system", "global", {
      ...result,
      reason: input.reason.trim(),
      preserved: ["active_administrator", "hour_rules", "endurance_rules", "system_mode", "audit_logs"],
    });
    return result;
  });
}

function validateHelpArticle(input: HelpArticleInput) {
  const errors: Record<string, string> = {};
  if (!input.titleZh.trim()) errors.titleZh = "REQUIRED";
  if (!input.titleEn.trim()) errors.titleEn = "REQUIRED";
  if (!input.category.trim()) errors.category = "REQUIRED";
  if (!Number.isFinite(input.sortWeight)) errors.sortWeight = "NUMBER_REQUIRED";
  if (input.status === "published") {
    if (!input.bodyZh.trim()) errors.bodyZh = "REQUIRED";
    if (!input.bodyEn.trim()) errors.bodyEn = "REQUIRED";
    if (input.keywords.length === 0) errors.keywords = "REQUIRED";
  }
  if (Object.keys(errors).length) throw new AdminServiceError("VALIDATION", "FORM_INVALID", errors);
}

export async function saveHelpArticle(input: HelpArticleInput) {
  return mutate("admin.help.write", (state) => {
    validateHelpArticle(input);
    const existing = input.id ? state.helpArticles.find((article) => article.id === input.id) : undefined;
    if (input.id && !existing) throw new AdminServiceError("NOT_FOUND", "HELP_ARTICLE_NOT_FOUND");
    if (existing) ensureExpectedVersion(existing.updatedAt, input.expectedUpdatedAt);
    if (existing && existing.status !== input.status && !HELP_ARTICLE_TRANSITIONS[existing.status].includes(input.status)) {
      throw new AdminServiceError("VALIDATION", "HELP_TRANSITION_INVALID");
    }
    const before = existing ? deepClone(existing) : null;
    const article = {
      ...input,
      id: existing?.id ?? makeId("HA"),
      titleZh: input.titleZh.trim(),
      titleEn: input.titleEn.trim(),
      bodyZh: input.bodyZh.trim(),
      bodyEn: input.bodyEn.trim(),
      keywords: [...new Set(input.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
      category: input.category.trim(),
      publishedAt: input.status === "published" ? existing?.publishedAt ?? nowIso() : existing?.publishedAt,
      updatedAt: nowIso(),
    };
    delete (article as Partial<HelpArticleInput>).expectedUpdatedAt;
    if (existing) Object.assign(existing, article);
    else state.helpArticles.unshift(article);
    const action = !existing
      ? "help_article.create"
      : before?.status !== article.status
        ? article.status === "published" ? "help_article.publish" : "help_article.archive"
        : "help_article.update";
    addAudit(state, action, "help_article", article.id, { before, after: article });
    return article;
  });
}

export async function transitionHelpArticle(id: string, nextStatus: "published" | "archived") {
  return mutate("admin.help.write", (state) => {
    const article = state.helpArticles.find((item) => item.id === id);
    if (!article) throw new AdminServiceError("NOT_FOUND", "HELP_ARTICLE_NOT_FOUND");
    if (!HELP_ARTICLE_TRANSITIONS[article.status].includes(nextStatus)) throw new AdminServiceError("VALIDATION", "HELP_TRANSITION_INVALID");
    if (nextStatus === "published") validateHelpArticle({ ...article, status: "published" });
    const before = article.status;
    article.status = nextStatus;
    article.updatedAt = nowIso();
    if (nextStatus === "published" && !article.publishedAt) article.publishedAt = nowIso();
    addAudit(state, nextStatus === "published" ? "help_article.publish" : "help_article.archive", "help_article", article.id, { before, after: nextStatus });
    return article;
  });
}

export async function updateTicket(ticketId: string, status: TicketStatus, reply: string) {
  return mutate("admin.support.write", (state) => {
    const ticket = state.tickets.find((item) => item.id === ticketId);
    if (!ticket) throw new AdminServiceError("NOT_FOUND", "TICKET_NOT_FOUND");
    if (!reply.trim()) throw new AdminServiceError("VALIDATION", "REPLY_REQUIRED", { reply: "REQUIRED" });
    const before = ticket.status;
    ticket.status = status;
    ticket.replies.push({ id: makeId("reply"), author: currentActor(state)?.name ?? "System administrator", message: reply.trim(), createdAt: nowIso() });
    addAudit(state, "feedback.update", "feedback", ticket.id, { before, after: status, reply: reply.trim() });
    return ticket;
  });
}

export async function transitionGradeCorrection(id: string, nextStatus: GradeCorrectionStatus, reason: string) {
  return mutate("admin.semesters.write", (state) => {
    const request = state.gradeCorrections.find((item) => item.id === id);
    if (!request) throw new AdminServiceError("NOT_FOUND", "GRADE_CORRECTION_NOT_FOUND");
    if (!GRADE_CORRECTION_TRANSITIONS[request.status].includes(nextStatus)) throw new AdminServiceError("VALIDATION", "GRADE_CORRECTION_TRANSITION_INVALID");
    if (!reason.trim()) throw new AdminServiceError("VALIDATION", "REASON_REQUIRED", { reason: "REQUIRED" });
    const before = request.status;
    request.status = nextStatus;
    request.reviewedAt = nowIso();
    request.reviewReason = reason.trim();
    addNotification(state, "semester", "teachers", "Grade correction updated", request.id);
    addAudit(state, nextStatus === "approved" ? "grade_correction.approve" : nextStatus === "rejected" ? "grade_correction.reject" : "grade_correction.close", "grade", request.id, { before, after: nextStatus, reason: reason.trim() });
    return request;
  });
}

export async function refreshHealth() {
  return mutate("admin.dashboard.read", (state) => {
    state.health = {
      ...state.health,
      apiLatencyMs: 28 + Math.round(Math.random() * 15),
      notificationBacklog: Math.max(0, state.health.notificationBacklog),
      checkedAt: nowIso(),
    };
    return state.health;
  });
}

export function previewUserImport(csvText: string, role: Exclude<UserRole, "admin">, users: AdminUser[], fallbackPassword: string) {
  return buildUserImportPreview(csvText, role, users, fallbackPassword);
}

export function validateStoredEnduranceTable(state: AdminState, tableKey: string) {
  return validateEnduranceTable(state.enduranceRules.filter((rule) => enduranceTableKey(rule) === tableKey));
}

export type TicketMutationInput = Pick<SupportTicket, "id" | "status"> & { reply: string };
