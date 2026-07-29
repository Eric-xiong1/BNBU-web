// Course list (#17) and course detail (#18) — feature/courses/CoursesScreen.kt.

import { tx } from "../i18n.js";
import { icon } from "../icons.js";
import { esc } from "../ui.js";
import { hourText } from "../data.js";
import { localizedJoinStatus } from "./join.js";

const isHistorical = (course) =>
  !course.isCurrent || course.semesterStatus === "archived" || ["completed", "withdrawn"].includes(course.enrollmentStatus);

const displayTitle = (course) => `${course.code} / Section ${course.section}`;

function enrollmentStatusLabel(status) {
  switch (status) {
    case "enrolled": return tx("修读中", "In progress");
    case "completed": return tx("已完成", "Complete");
    case "withdrawn": return tx("已退课", "Withdrawn");
    default: return status || tx("待确认", "Pending");
  }
}

function semesterStatusLabel(status) {
  switch (status) {
    case "upcoming": return tx("即将开始", "Upcoming");
    case "current": return tx("当前学期", "Current semester");
    case "archived": return tx("历史学期", "Past semester");
    default: return status || tx("学期待定", "Semester pending");
  }
}

function gradeStatusLabel(status, finalGrade) {
  if (status === "pass") return tx("及格", "Pass");
  if (status === "fail") return tx("不及格", "Fail");
  return finalGrade >= 60 ? tx("及格", "Pass") : tx("不及格", "Fail");
}

function statusPill(text, { emphasized = false, destructive = false } = {}) {
  const cls = destructive ? "destructive" : emphasized ? "emphasized" : "";
  return `<span class="course-pill ${cls}">${esc(text)}</span>`;
}

function creditTypeLabel(creditType) {
  switch (creditType) {
    case "course": return tx("课程相关", "Course-related");
    case "general": return tx("其他运动", "Other exercise");
    default: return tx("系统抵扣", "System offset");
  }
}

function proofSummaryText(record) {
  if (record.proofPhotoCount === 0 && record.proofVideoCount === 0) return record.proofSummary;
  const parts = [];
  if (record.proofPhotoCount > 0) parts.push(tx(`${record.proofPhotoCount} 张图片`, `${record.proofPhotoCount} ${record.proofPhotoCount === 1 ? "photo" : "photos"}`));
  if (record.proofVideoCount > 0) parts.push(tx(`${record.proofVideoCount} 个短视频`, `${record.proofVideoCount} ${record.proofVideoCount === 1 ? "video" : "videos"}`));
  return parts.join(tx("，", ", "));
}

function recordTimeText(value) {
  if (!value) return tx("未提供", "Not available");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function actualDurationText(record) {
  const total = record.actualDurationSeconds;
  if (total === null || total === undefined) return tx("未提供", "Not available");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  let out = "";
  if (hours > 0) out += tx(`${hours}小时`, `${hours}h`);
  if (minutes > 0 || (hours === 0 && seconds === 0)) out += tx(`${minutes}分钟`, `${minutes}m`);
  if (seconds > 0) out += tx(`${seconds}秒`, `${seconds}s`);
  return out;
}

const localizedTaskTitle = (title) =>
  ["", "运动打卡", "Exercise check-in"].includes(title.trim()) ? tx("运动打卡", "Exercise check-in") : title;

function courseMetaLine(iconName, text) {
  return `<div class="row" style="gap:10px">
    <span class="text-muted" style="display:inline-flex;flex:none">${icon(iconName, 19)}</span>
    <span class="ellipsis" style="font-size:15px;line-height:20px;color:var(--color-on-surface)">${esc(text)}</span>
  </div>`;
}

function courseCard(course, historical) {
  return `<button class="course-card pressable" data-action="courses.open" data-course-id="${esc(course.id)}">
    <div class="row" style="align-items:flex-start">
      <div class="col grow" style="gap:5px;text-align:left">
        <span style="font-size:20px;line-height:26px;font-weight:600;color:var(--color-on-surface)">${esc(course.name)}</span>
        <span style="font-size:14px;line-height:19px;color:var(--color-on-surface-variant)">${esc(displayTitle(course))}</span>
      </div>
      <span style="width:10px"></span>
      <span class="text-muted" style="display:inline-flex;padding-top:2px">${icon("chevron-right", 22)}</span>
    </div>
    <div class="course-divider"></div>
    <div class="col" style="gap:10px;text-align:left">
      ${courseMetaLine("person-outline", course.teacher || tx("任课教师待公布", "Instructor to be announced"))}
      ${courseMetaLine("event", [course.academicYear || tx("学年待设置", "Academic year pending"), course.term || tx("学期待设置", "Term pending")].join(" · "))}
    </div>
    <div class="row" style="gap:10px">
      ${statusPill(historical ? semesterStatusLabel(course.semesterStatus) : enrollmentStatusLabel(course.enrollmentStatus), { emphasized: !historical && course.enrollmentStatus === "enrolled" })}
      <span class="grow ellipsis" style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant);text-align:left">${esc(course.semester || tx("学期待定", "Semester pending"))}</span>
    </div>
    ${historical && course.finalGrade !== null && course.finalGrade !== undefined ? `
      <div class="course-divider"></div>
      <div class="row">
        <span class="grow" style="font-size:14px;line-height:19px;color:var(--color-on-surface-variant);text-align:left">${tx("最终成绩", "Final grade")}</span>
        <span style="font-size:17px;line-height:22px;font-weight:600;color:var(--color-on-surface)">${tx(`${course.finalGrade} 分`, `${course.finalGrade} points`)}</span>
      </div>` : ""}
  </button>`;
}

function sectionHeader(title, count, unit) {
  return `<div class="row" style="padding-top:4px">
    <span class="grow" style="font-size:20px;line-height:25px;font-weight:600;color:var(--color-on-background)">${esc(title)}</span>
    <span style="font-size:15px;line-height:20px;color:var(--color-on-surface-variant)">${count} ${esc(unit)}</span>
  </div>`;
}

export function renderCourses(app) {
  if (!app.ui.courses) app.ui.courses = { selectedCourseId: null, historyExpanded: false };
  const ui = app.ui.courses;
  const workspace = app.state.workspace;
  const selected = ui.selectedCourseId ? workspace.courses.find((c) => c.id === ui.selectedCourseId) : null;
  if (selected) return renderCourseDetail(app, selected);

  const courses = workspace.courses;
  const historyCourses = courses.filter(isHistorical);
  const currentCourses = courses.filter((c) => !historyCourses.includes(c));
  const subtitle = courses.length === 0
    ? tx("课程同步后将在这里显示", "Your courses will appear here after syncing.")
    : historyCourses.length === 0
      ? tx(`${currentCourses.length} 门课程正在修读`, `${currentCourses.length} courses in progress`)
      : tx(`${currentCourses.length} 门正在修读 · ${historyCourses.length} 门历史课程`, `${currentCourses.length} in progress · ${historyCourses.length} past courses`);

  const request = workspace.courseJoinRequest;
  const hasPendingJoinRequest = request && request.status !== "ACTIVE";

  let listBody = "";
  if (courses.length === 0) {
    listBody = `<div class="course-card" style="padding:24px 20px">
      <div class="col" style="gap:7px">
        <span style="font-size:20px;line-height:25px;font-weight:600;color:var(--color-on-surface)">${tx("还没有课程", "No courses yet")}</span>
        <span style="font-size:15px;line-height:22px;color:var(--color-on-surface-variant)">${tx("扫描教师提供的二维码或输入邀请码，加入体育教学班。", "Scan your instructor's QR code or enter an invitation code to join a class.")}</span>
      </div>
    </div>`;
  } else {
    listBody = sectionHeader(tx("本学期", "This semester"), currentCourses.length, tx("门", "courses"));
    listBody += currentCourses.length === 0
      ? `<div class="course-card"><div class="col" style="gap:5px">
          <span style="font-size:17px;line-height:22px;font-weight:600;color:var(--color-on-surface)">${tx("本学期暂无课程", "No courses this semester")}</span>
          <span style="font-size:14px;line-height:20px;color:var(--color-on-surface-variant)">${tx("你仍可以在下方查看历史课程。", "You can still view past courses below.")}</span>
        </div></div>`
      : currentCourses.map((course) => courseCard(course, false)).join("");
    if (historyCourses.length) {
      listBody += `<div class="col" style="gap:12px">
        <button class="history-header pressable" data-action="courses.toggleHistory">
          <span class="text-muted" style="display:inline-flex">${icon("history", 20)}</span>
          <span class="grow" style="text-align:left;font-size:17px;line-height:22px;font-weight:500;color:var(--color-on-surface)">${tx("历史课程", "Past courses")}</span>
          <span style="font-size:15px;line-height:20px;color:var(--color-on-surface-variant)">${tx(`${historyCourses.length} 门`, `${historyCourses.length} courses`)}</span>
          <span style="width:8px"></span>
          <span class="text-muted history-arrow${ui.historyExpanded ? " expanded" : ""}" style="display:inline-flex">${icon("expand-more", 22)}</span>
        </button>
        ${ui.historyExpanded ? `<div class="col" style="gap:12px">${historyCourses.map((course) => courseCard(course, true)).join("")}</div>` : ""}
      </div>`;
    }
  }

  return `<div class="tab-content col" style="gap:20px;padding-top:8px">
    <div class="col" style="gap:5px">
      <span class="course-large-title">${tx("我的课程", "My courses")}</span>
      <span style="font-size:17px;line-height:23px;color:var(--color-on-surface)">${esc(subtitle)}</span>
      <span style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant)">${tx("每学期仅可选择一门课程", "You may select one course per semester.")}</span>
    </div>
    ${hasPendingJoinRequest ? `
      <button class="course-card pressable" data-action="join.openStatus" style="padding:16px 18px">
        <div class="row">
          <div class="col grow" style="gap:5px;text-align:left">
            <span style="font-size:17px;line-height:22px;font-weight:600;color:var(--color-on-surface)">${tx("课程加入申请", "Course join request")}</span>
            <span style="font-size:14px;line-height:19px;color:var(--color-on-surface-variant)">${esc(request.courseCode)} · Section ${esc(request.section)}</span>
          </div>
          ${statusPill(localizedJoinStatus(request.status), { emphasized: request.status === "PENDING" })}
          <span style="width:8px"></span>
          <span class="text-muted" style="display:inline-flex">${icon("chevron-right", 20)}</span>
        </div>
      </button>` : ""}
    ${listBody}
    ${app.canStartNewCourseJoin() ? `<div class="col" style="gap:10px">
      <button class="primary-btn pressable" data-action="courses.scan" style="min-height:52px">
        ${icon("qr-code-scanner", 20)}<span style="font-size:16px;font-weight:600">${tx("扫描二维码", "Scan QR code")}</span>
      </button>
      <button class="outlined-btn pressable" data-action="courses.enterCode" style="min-height:52px;border-radius:14px">
        ${icon("text-fields", 20)}<span style="font-size:16px;font-weight:600">${tx("输入邀请码", "Enter invitation code")}</span>
      </button>
    </div>` : ""}
  </div>`;
}

function detailFactRow(label, value, last) {
  return `<div class="row" style="min-height:48px;padding:12px 0;align-items:flex-start">
      <span style="width:80px;flex:none;font-size:14px;line-height:20px;color:var(--color-on-surface-variant)">${esc(label)}</span>
      <span style="width:12px"></span>
      <span class="grow" style="font-size:15px;line-height:20px;color:var(--color-on-surface)">${esc(value)}</span>
    </div>${last ? "" : `<div class="course-divider" style="margin-left:92px"></div>`}`;
}

function recordMetric(iconName, label, value) {
  return `<div class="row grow" style="gap:8px">
    <span class="text-muted" style="display:inline-flex;flex:none">${icon(iconName, 18)}</span>
    <span class="col" style="gap:1px">
      <span style="font-size:12px;line-height:16px;color:var(--color-on-surface-variant)">${esc(label)}</span>
      <span style="font-size:14px;line-height:19px;font-weight:500;color:var(--color-on-surface)">${esc(value)}</span>
    </span>
  </div>`;
}

function recordDetailLine(iconName, label, value) {
  return `<div class="row" style="align-items:flex-start">
    <span class="text-muted" style="display:inline-flex;flex:none;padding-top:1px">${icon(iconName, 18)}</span>
    <span style="width:10px"></span>
    <span style="width:68px;flex:none;font-size:13px;line-height:19px;color:var(--color-on-surface-variant)">${esc(label)}</span>
    <span class="grow" style="font-size:13px;line-height:19px;color:var(--color-on-surface)">${esc(value)}</span>
  </div>`;
}

export function courseRecordCard(record, courseDisplayName) {
  return `<div class="course-card">
    <div class="col" style="gap:12px">
      <div class="row" style="align-items:flex-start">
        <div class="col grow" style="gap:4px">
          <span style="font-size:17px;line-height:23px;font-weight:600;color:var(--color-on-surface)">${esc(localizedTaskTitle(record.taskTitle))}</span>
          <span style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant)">${esc(record.sportType || tx("运动", "Exercise"))} · ${esc(record.submittedAt.split(" ")[0] || tx("未提供", "Not available"))}</span>
        </div>
        <span style="width:10px"></span>
        <span class="text-primary" style="font-size:20px;line-height:25px;font-weight:600">${hourText(record.hours)}</span>
      </div>
      <span style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant)">${creditTypeLabel(record.creditType)}</span>
      <div class="course-divider"></div>
      <div class="col" style="gap:10px">
        <div class="row" style="gap:12px">
          ${recordMetric("event", tx("开始时间", "Start time"), recordTimeText(record.startTime))}
          ${recordMetric("timer", tx("结束时间", "End time"), recordTimeText(record.endTime))}
        </div>
        <div class="row" style="gap:12px">
          ${recordMetric("timer", tx("实际运动时长", "Active duration"), actualDurationText(record))}
          ${recordMetric("check-circle-outline", tx("计入学时", "Credited hours"), hourText(record.hours))}
        </div>
      </div>
      ${recordDetailLine("check-circle-outline", tx("关联课程", "Course"), courseDisplayName)}
      ${recordDetailLine("attach-file", tx("运动凭证", "Exercise proof"), proofSummaryText(record))}
      ${record.note ? `<span style="font-size:13px;line-height:19px;color:var(--color-on-surface-variant)">${tx("运动说明：", "Exercise notes: ")}${esc(record.note)}</span>` : ""}
    </div>
  </div>`;
}

function renderCourseDetail(app, course) {
  const historical = isHistorical(course);
  const records = app.state.workspace.records.filter((r) => r.courseId === course.id && r.creditType !== "offset");
  const facts = [
    [tx("课程代码", "Course code"), course.code || tx("待设置", "Pending")],
    [tx("教学班", "Section"), `Section ${course.section || tx("待设置", "Pending")}`],
    [tx("任课教师", "Instructor"), course.teacher || tx("待公布", "To be announced")],
    [tx("开课学期", "Teaching term"), [course.academicYear || tx("学年待设置", "Academic year pending"), course.term || tx("学期待设置", "Term pending")].join(" · ")],
  ];
  return `<div class="tab-content col anim-enter-forward" style="gap:18px;padding-top:2px">
    <button class="row pressable" data-action="courses.backToList" style="min-height:48px;color:var(--color-primary)">
      <span style="display:inline-flex;padding:0 10px">${icon("arrow-back", 24)}</span>
      <span style="font-size:17px;line-height:22px">${tx("我的课程", "My courses")}</span>
    </button>
    <div class="col" style="gap:8px">
      <span style="font-size:30px;line-height:37px;font-weight:700;letter-spacing:-0.25px;color:var(--color-on-background)">${esc(course.name)}</span>
      <span style="font-size:16px;line-height:22px;color:var(--color-on-surface-variant)">${esc(displayTitle(course))}</span>
      <div class="row" style="gap:10px">
        ${statusPill(historical ? semesterStatusLabel(course.semesterStatus) : enrollmentStatusLabel(course.enrollmentStatus), { emphasized: !historical && course.enrollmentStatus === "enrolled" })}
        <span class="grow ellipsis" style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant)">${esc(course.semester || tx("学期待定", "Semester pending"))}</span>
      </div>
    </div>
    <div class="course-card" style="padding:16px 18px">${facts.map((f, i) => detailFactRow(f[0], f[1], i === facts.length - 1)).join("")}</div>
    ${historical ? `<div class="course-card" style="padding:16px 18px">
      <span style="font-size:14px;line-height:19px;color:var(--color-on-surface-variant)">${tx("最终成绩", "Final grade")}</span>
      <div style="height:8px"></div>
      ${course.finalGrade === null || course.finalGrade === undefined
        ? `<span style="font-size:20px;line-height:26px;font-weight:600;color:var(--color-on-surface)">${tx("暂未发布", "Not published")}</span>`
        : `<div class="row">
            <span class="grow" style="font-size:30px;line-height:35px;font-weight:600;color:var(--color-on-surface)">${tx(`${course.finalGrade} 分`, `${course.finalGrade} points`)}</span>
            ${statusPill(gradeStatusLabel(course.gradeStatus, course.finalGrade), { emphasized: course.gradeStatus !== "fail" && course.finalGrade >= 60, destructive: course.gradeStatus === "fail" || course.finalGrade < 60 })}
          </div>`}
    </div>` : ""}
    ${sectionHeader(historical ? tx("打卡记录", "Check-in records") : tx("相关记录", "Related records"), records.length, tx("条", "records"))}
    ${historical ? `<span style="font-size:13px;line-height:18px;color:var(--color-on-surface-variant)">${tx("历史课程记录仅供查看", "Past-course records are view only.")}</span>` : ""}
    ${records.length === 0
      ? `<div class="course-card"><div class="col" style="gap:5px">
          <span style="font-size:17px;line-height:22px;font-weight:600;color:var(--color-on-surface)">${tx("暂无相关记录", "No related records")}</span>
          <span style="font-size:14px;line-height:20px;color:var(--color-on-surface-variant)">${tx("当前教学班还没有课程相关打卡记录。", "There are no course-related check-in records for this class yet.")}</span>
        </div></div>`
      : records.map((record) => courseRecordCard(record, displayTitle(course))).join("")}
  </div>`;
}

export const coursesActions = {
  "courses.open": (app, el) => {
    app.ui.courses.selectedCourseId = el.dataset.courseId;
    app.navDirection = "forward";
    app.render();
  },
  "courses.backToList": (app) => {
    app.ui.courses.selectedCourseId = null;
    app.navDirection = "back";
    app.render();
  },
  "courses.toggleHistory": (app) => {
    app.ui.courses.historyExpanded = !app.ui.courses.historyExpanded;
    app.render();
  },
  "courses.scan": (app) => {
    app.ui.scan = null;
    app.openSub("scan", {});
  },
  "courses.enterCode": (app) => {
    app.ui.enterCode = null;
    app.openSub("enterCode", {});
  },
};

// Course detail intercepts back to return to the list (返回规则).
export function coursesBackInterceptor(app) {
  if (app.screenKey() === "tab-courses" && app.ui.courses?.selectedCourseId) {
    app.ui.courses.selectedCourseId = null;
    app.navDirection = "back";
    app.render();
    return true;
  }
  return false;
}
