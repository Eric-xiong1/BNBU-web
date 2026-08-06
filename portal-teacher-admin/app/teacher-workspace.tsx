"use client";

import { CircleAlert, Copy, Download, Eye, ListChecks, MapPin, Maximize2, Minus, Pause, Play, Plus, Printer, QrCode, Settings, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppSelect } from "./app-select";
import {
  formatInviteExpiry,
  formatInviteRemaining,
  getInviteStatus,
  inviteStatusLabel,
} from "./course-invite";
import { InviteQrCode } from "./invite-qr";
import { statusLabel } from "./language";
import {
  deriveAuditSummary,
  type AttendanceAuditSummary,
  type AuditStatus,
} from "./checkin-audit";
import {
  CourseOverviewLayout,
  DataTable,
  FilterToolbar,
  ManagementTableLayout,
  PageSummaryMetrics,
  ProgressCell,
  ReviewWorkbenchLayout,
  StatusFilterTabs,
  StatusTabs,
  TableActionMenu,
  TableActionMenuItem,
} from "./teacher-ui";
import {
  StudentIdentity,
  type StudentCourseMetric,
  type StudentProfile,
  type StudentQuickAction,
} from "./student-profile";
import { TabPageTransition, type TabTransitionDirection } from "./teacher-tab-page-transition";
import { RosterReconciliationPage } from "./roster-reconciliation";
import type { PlatformCourseMember, RosterCourseReference } from "./roster-reconciliation-types";

type TeacherWorkspaceProps = {
  active: string;
  direction: TabTransitionDirection;
  showToast: (value: string) => void;
};

type ExemptionStatus = "pending" | "supplement_required" | "approved" | "rejected";
type GradeStatus = "NotRecorded" | "Recorded" | "Exempt" | "Absent";
type CourseStatus = "ACTIVE" | "ENDED";
type MembershipStatus = "active" | "removed" | "exited" | "disabled";
type CheckinDetailView = "list" | "album";
type CheckinAuditFilter = "all" | AuditStatus;
type RosterView = "all" | "needs_attention" | "complete" | "inactive";
type CheckinReviewFilter = "all" | "low_confidence";
type ExemptionFilter = "all" | ExemptionStatus;

type Invite = {
  code: string;
  expiresAt: string;
  status: "active" | "revoked";
};

type CheckinWindow = {
  windowMode: "available" | "unavailable";
  dateRangeStart: string;
  dateRangeEnd: string;
  dailyStartTime: string;
  dailyEndTime: string;
  excludedDates: { date: string; reason: string }[];
  semesterDeadline: string;
};

type Course = {
  id: number;
  code: string;
  section: string;
  name: string;
  semester: string;
  status: CourseStatus;
  courseTarget: number;
  otherTarget: number;
  checkinWindow: CheckinWindow;
  invite?: Invite;
};

type Student = {
  id: number;
  name: string;
  number: string;
  email: string;
  gender: "男" | "女" | "其他";
  grade: string;
  courseId: number;
  status: MembershipStatus;
  joinedAt: string;
  joinMethod: "qr" | "manual_import";
  courseHours: number;
  otherHours: number;
  courseWaiverHours?: number;
  otherWaiverHours?: number;
};

type CheckinRecord = {
  id: number;
  studentId: number;
  courseId: number;
  creditType: "课程相关" | "其他运动" | "系统抵扣";
  sport: string;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  creditedMinutes: number;
  originalHours: 1 | 2;
  approvedHours: 0 | 1 | 2;
  description: string;
  submittedAt: string;
  status: "有效" | "已调整" | "系统抵扣";
  risk: "低风险" | "需关注" | "凭证模糊";
  confidence: number;
  proof: string[];
  locationExpired: boolean;
  reviewComment?: string;
  internalNote?: string;
  source: "student" | "system";
  auditStatus: AuditStatus;
  invalidReason?: string;
  auditRemark?: string;
};

type Grade = {
  id: number;
  studentId: number;
  courseId: number;
  gender: "男" | "女";
  gradeGroup: "大一/大二" | "大三/大四";
  enduranceStatus: GradeStatus;
  minutes?: number;
  seconds?: number;
  physicalScore?: number;
  published: boolean;
};

type Exemption = {
  id: number;
  studentId: number;
  courseId: number;
  kind: "耐力跑免测" | "校队认证" | "社团认证";
  organization?: string;
  reason: string;
  material: string[];
  submittedAt: string;
  status: ExemptionStatus;
  reviewComment?: string;
  score?: number;
  courseOffset?: number;
  otherOffset?: number;
};

type MaterialPreview = {
  file: string;
  studentName: string;
  applicationKind: Exemption["kind"];
};

type DialogState =
  | { type: "course-new" }
  | { type: "course-manage"; courseId: number }
  | { type: "invite"; courseId: number }
  | { type: "invite-revoke"; courseId: number }
  | { type: "student-action"; studentId: number; action: "remove" | "supplement" | "waiver" }
  | { type: "supplement" }
  | { type: "checkin"; recordId: number }
  | { type: "checkin-invalid"; recordId: number }
  | { type: "checkin-complete"; studentId: number }
  | { type: "grade"; gradeId: number }
  | { type: "publish-grades"; courseId: number }
  | { type: "exemption"; exemptionId: number }
  | null;

const invalidAttendanceReasons = [
  "运动时长不符合要求",
  "图片或视频无法证明运动过程",
  "媒体内容与运动无关",
  "重复提交",
  "疑似代打卡",
  "运动记录异常",
  "其他",
] as const;

const semesterCurrent = "2025–2026 第二学期";

const defaultCheckinWindow: CheckinWindow = {
  windowMode: "available",
  dateRangeStart: "2026-02-23",
  dateRangeEnd: "2026-07-31",
  dailyStartTime: "06:00",
  dailyEndTime: "22:00",
  excludedDates: [],
  semesterDeadline: "2026-07-31",
};

const initialCourses: Course[] = [
  {
    id: 1,
    code: "PE101",
    section: "01班",
    name: "大学体育（一）",
    semester: semesterCurrent,
    status: "ACTIVE",
    courseTarget: 10,
    otherTarget: 10,
    checkinWindow: { ...defaultCheckinWindow, excludedDates: [{ date: "2026-05-01", reason: "劳动节假期" }] },
    invite: { code: "PE01-7K2Q", expiresAt: "2026-08-05T18:00:00+08:00", status: "active" },
  },
  {
    id: 2,
    code: "PE203",
    section: "03班",
    name: "羽毛球",
    semester: semesterCurrent,
    status: "ACTIVE",
    courseTarget: 12,
    otherTarget: 8,
    checkinWindow: { ...defaultCheckinWindow, dailyStartTime: "07:00", dailyEndTime: "21:30", excludedDates: [{ date: "2026-06-19", reason: "期末考试安排" }] },
  },
  {
    id: 3,
    code: "PE208",
    section: "02班",
    name: "篮球",
    semester: semesterCurrent,
    status: "ACTIVE",
    courseTarget: 10,
    otherTarget: 10,
    checkinWindow: { ...defaultCheckinWindow },
  },
  {
    id: 4,
    code: "PE101",
    section: "02班",
    name: "大学体育（一）",
    semester: "2025–2026 第一学期",
    status: "ENDED",
    courseTarget: 10,
    otherTarget: 10,
    checkinWindow: { ...defaultCheckinWindow, dateRangeStart: "2025-09-08", dateRangeEnd: "2026-01-16", semesterDeadline: "2026-01-16" },
  },
];

const initialStudents: Student[] = [
  { id: 1, name: "赵可心", number: "2024110261", email: "kexin.zhao@mail.bnbu.edu.cn", gender: "女", grade: "2024级", courseId: 1, status: "active", joinedAt: "2026-02-23 08:35", joinMethod: "qr", courseHours: 8, otherHours: 6 },
  { id: 2, name: "陈昊然", number: "2024110618", email: "haoran.chen@mail.bnbu.edu.cn", gender: "男", grade: "2024级", courseId: 1, status: "active", joinedAt: "2026-02-23 08:41", joinMethod: "qr", courseHours: 10, otherHours: 10 },
  { id: 3, name: "何雨桐", number: "2024110335", email: "yutong.he@mail.bnbu.edu.cn", gender: "女", grade: "2024级", courseId: 1, status: "active", joinedAt: "2026-02-23 09:02", joinMethod: "qr", courseHours: 7, otherHours: 4 },
  { id: 4, name: "许嘉宁", number: "2024110772", email: "jianing.xu@mail.bnbu.edu.cn", gender: "男", grade: "2024级", courseId: 1, status: "active", joinedAt: "2026-02-23 09:16", joinMethod: "manual_import", courseHours: 9, otherHours: 8 },
  { id: 5, name: "郭思远", number: "2023110724", email: "siyuan.guo@mail.bnbu.edu.cn", gender: "男", grade: "2023级", courseId: 2, status: "active", joinedAt: "2026-02-24 10:08", joinMethod: "qr", courseHours: 6, otherHours: 7 },
  { id: 6, name: "高嘉雯", number: "2024110158", email: "jiawen.gao@mail.bnbu.edu.cn", gender: "女", grade: "2024级", courseId: 2, status: "active", joinedAt: "2026-02-24 10:17", joinMethod: "qr", courseHours: 8, otherHours: 5 },
  { id: 7, name: "吴雨菲", number: "2024110401", email: "yufei.wu@mail.bnbu.edu.cn", gender: "女", grade: "2024级", courseId: 3, status: "active", joinedAt: "2026-02-25 11:26", joinMethod: "qr", courseHours: 5, otherHours: 4 },
  { id: 8, name: "李欣然", number: "2024110247", email: "xinran.li@mail.bnbu.edu.cn", gender: "女", grade: "2024级", courseId: 1, status: "active", joinedAt: "2026-08-02 09:42", joinMethod: "qr", courseHours: 0, otherHours: 0 },
];

const initialRecords: CheckinRecord[] = [
  { id: 1, studentId: 1, courseId: 1, creditType: "课程相关", sport: "校园跑", startAt: "2026-07-27 18:02", endAt: "2026-07-27 20:03", durationMinutes: 121, creditedMinutes: 120, originalHours: 2, approvedHours: 2, description: "按校园外圈完成连续跑步。", submittedAt: "2026-07-27", status: "有效", risk: "需关注", confidence: 0.62, proof: ["跑步轨迹.jpg", "结束视频.mp4"], locationExpired: false, source: "student", auditStatus: "pending" },
  { id: 2, studentId: 2, courseId: 1, creditType: "其他运动", sport: "游泳", startAt: "2026-07-26 16:00", endAt: "2026-07-26 18:00", durationMinutes: 120, creditedMinutes: 120, originalHours: 2, approvedHours: 2, description: "完成自由泳与蛙泳练习。", submittedAt: "2026-07-26", status: "有效", risk: "低风险", confidence: 0.94, proof: ["泳池凭证.jpg"], locationExpired: false, source: "student", auditStatus: "pending" },
  { id: 3, studentId: 3, courseId: 1, creditType: "课程相关", sport: "核心力量训练", startAt: "2026-07-26 08:10", endAt: "2026-07-26 09:10", durationMinutes: 60, creditedMinutes: 60, originalHours: 1, approvedHours: 1, description: "完成一小时核心力量训练。", submittedAt: "2026-07-26", status: "有效", risk: "凭证模糊", confidence: 0.48, proof: ["训练照片.heic"], locationExpired: true, source: "student", auditStatus: "pending" },
  { id: 4, studentId: 4, courseId: 1, creditType: "其他运动", sport: "骑行", startAt: "2026-07-25 19:00", endAt: "2026-07-25 21:00", durationMinutes: 120, creditedMinutes: 120, originalHours: 2, approvedHours: 2, description: "绿道往返骑行。", submittedAt: "2026-07-25", status: "有效", risk: "低风险", confidence: 0.91, proof: ["骑行记录.png"], locationExpired: false, source: "student", auditStatus: "pending" },
];

const initialGrades: Grade[] = [
  { id: 1, studentId: 1, courseId: 1, gender: "女", gradeGroup: "大一/大二", enduranceStatus: "Recorded", minutes: 4, seconds: 4, physicalScore: 87, published: false },
  { id: 2, studentId: 2, courseId: 1, gender: "男", gradeGroup: "大一/大二", enduranceStatus: "Recorded", minutes: 3, seconds: 34, physicalScore: 92, published: false },
  { id: 3, studentId: 3, courseId: 1, gender: "女", gradeGroup: "大一/大二", enduranceStatus: "Exempt", physicalScore: 85, published: false },
  { id: 4, studentId: 4, courseId: 1, gender: "男", gradeGroup: "大一/大二", enduranceStatus: "NotRecorded", published: false },
  { id: 5, studentId: 5, courseId: 2, gender: "男", gradeGroup: "大三/大四", enduranceStatus: "Recorded", minutes: 3, seconds: 45, physicalScore: 88, published: false },
];

const initialExemptions: Exemption[] = [
  { id: 1, studentId: 7, courseId: 3, kind: "耐力跑免测", reason: "右膝半月板术后恢复期", material: ["医学诊断证明.jpg", "康复建议.png"], submittedAt: "2 小时前", status: "pending" },
  { id: 2, studentId: 5, courseId: 2, kind: "校队认证", organization: "BNBU 男子篮球校队", reason: "本学期参加校队常规训练", material: ["在队证明.pdf"], submittedAt: "5 小时前", status: "pending" },
  { id: 3, studentId: 6, courseId: 2, kind: "社团认证", organization: "悦跑社", reason: "日常训练成员", material: ["社团证明.jpg", "训练计划.pdf"], submittedAt: "昨天", status: "pending" },
];

function toneForStatus(status: string) {
  if (["ACTIVE", "active", "有效", "已发布", "approved", "处理完成", "正常", "Recorded"].includes(status)) return "green";
  if (["REJECTED", "rejected", "removed", "exited", "disabled", "已关闭", "Absent", "已关闭"].includes(status)) return "red";
  if (["PENDING", "pending", "待受理", "需关注", "凭证模糊", "NEEDS_CORRECTION", "supplement_required", "NotRecorded"].includes(status)) return "orange";
  return "gray";
}

function membershipStatusLabel(status: MembershipStatus) {
  return ({
    active: "在课",
    removed: "已移出课程",
    exited: "已退出课程",
    disabled: "成员关系已停用",
  } as const)[status];
}

function joinMethodLabel(method: Student["joinMethod"]) {
  return method === "qr" ? "扫码加入" : "手动导入";
}

function actualDurationLabel(record: CheckinRecord) {
  if (record.source === "system") return "教师补录";
  const minutes = Math.max(0, record.durationMinutes);
  if (!Number.isFinite(minutes)) return `${record.originalHours.toFixed(1)} 小时`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0 && remainingMinutes > 0) return `${hours} 小时 ${remainingMinutes} 分`;
  if (hours > 0) return `${hours} 小时`;
  return `${remainingMinutes} 分`;
}

function attendanceHoursLabel(minutes: number) {
  return (Math.max(0, minutes) / 60).toFixed(1);
}

function checkinMonthLabel(record: CheckinRecord) {
  const [year, month] = record.startAt.slice(0, 7).split("-");
  return year && month ? `${year} 年 ${Number(month)} 月` : "补录记录";
}

function checkinDayLabel(record: CheckinRecord) {
  const day = record.startAt.slice(8, 10);
  return /^\d{2}$/.test(day) ? `${Number(day)} 日` : "补录";
}

const auditStatusLabels: Record<AuditStatus, string> = {
  pending: statusLabel("pending", "audit"),
  valid: statusLabel("valid", "audit"),
  invalid: statusLabel("invalid", "audit"),
};

function AuditStatusSelector({
  record,
  onSelect,
}: {
  record: CheckinRecord;
  onSelect: (record: CheckinRecord, status: AuditStatus) => void;
}) {
  return (
    <div className={`record-audit-control is-${record.auditStatus}`} data-audit-anchor tabIndex={-1}>
      <div className="record-audit-label"><span>审核状态</span><b>{auditStatusLabels[record.auditStatus]}</b></div>
      <div className="audit-status-selector" role="radiogroup" aria-label={`${record.sport}审核状态`}>
        {(Object.keys(auditStatusLabels) as AuditStatus[]).map((status) => (
          <button
            type="button"
            role="radio"
            aria-checked={record.auditStatus === status}
            className={`audit-status-option is-${status} ${record.auditStatus === status ? "selected" : ""}`.trim()}
            key={status}
            onClick={() => onSelect(record, status)}
          >
            <span aria-hidden="true" />
            {auditStatusLabels[status]}
          </button>
        ))}
      </div>
      {record.auditStatus === "invalid" && record.invalidReason && (
        <p className="record-invalid-reason"><span>无效原因</span>{record.invalidReason}{record.auditRemark ? `：${record.auditRemark}` : ""}</p>
      )}
    </div>
  );
}

function CheckinAuditSummary({
  summary,
  requiredMinutes,
  completed,
  disabled,
  onComplete,
}: {
  summary: AttendanceAuditSummary;
  requiredMinutes: number;
  completed: boolean;
  disabled: boolean;
  onComplete: () => void;
}) {
  const validHours = attendanceHoursLabel(summary.validMinutes);
  const remainingHours = attendanceHoursLabel(summary.remainingMinutes);
  const exceededHours = attendanceHoursLabel(summary.exceededMinutes);

  return (
    <section className="checkin-audit-summary" aria-label="打卡审核汇总">
      <div className="audit-summary-progress">
        <div className="audit-summary-heading">
          <div><span>有效时长</span><strong>{validHours}<small> / {attendanceHoursLabel(requiredMinutes)} 小时</small></strong></div>
          <span className={`audit-overall-status ${completed ? "is-complete" : ""}`}>{completed ? "审核已完成" : "审核中"}</span>
        </div>
        <div
          className="audit-progress-track"
          role="progressbar"
          aria-label="有效打卡时长进度"
          aria-valuemin={0}
          aria-valuemax={requiredMinutes}
          aria-valuenow={Math.min(summary.validMinutes, requiredMinutes)}
        >
          <span style={{ width: `${summary.progressPercent}%` }} />
        </div>
        <div className="audit-progress-note">
          <span>{summary.hasReachedTarget ? (summary.exceededMinutes > 0 ? `已超出目标 ${exceededHours} 小时` : "已达到教师设置的学时目标") : `还差 ${remainingHours} 小时`}</span>
          <span>有效 {summary.validCount} · 无效 {summary.invalidCount} · 待审核 {summary.pendingCount}</span>
        </div>
      </div>
      <button className="primary-button audit-complete-button" type="button" disabled={disabled} onClick={onComplete}>
        {completed ? "重新确认完成" : "完成审核"}
      </button>
    </section>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge badge-${tone ?? toneForStatus(String(children))}`}>{children}</span>;
}

function courseLabel(course?: Course) {
  return course ? `${course.name} · ${course.section}` : "未知教学班";
}

function enduranceScoreLabel(grade: Grade) {
  if (grade.enduranceStatus === "Recorded") {
    return `${grade.gender === "男" ? "1000m" : "800m"} ${grade.minutes}'${String(grade.seconds).padStart(2, "0")}″ · ${grade.physicalScore}分`;
  }
  if (grade.enduranceStatus === "Exempt") return `免测 ${grade.physicalScore}分`;
  if (grade.enduranceStatus === "Absent") return "缺考 0分";
  return "等待录入";
}

function csvCell(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function scoreEndurance(totalSeconds: number, distance: 800 | 1000, senior: boolean) {
  const excellent = distance === 1000 ? (senior ? 220 : 225) : senior ? 225 : 230;
  const score = 100 - Math.max(0, Math.ceil((totalSeconds - excellent) / 5) * 2);
  return Math.max(0, Math.min(100, score));
}

function isImageMaterial(file: string) {
  return /\.(?:avif|gif|heic|jpe?g|png|webp)$/i.test(file);
}

function isVideoMaterial(file: string) {
  return /\.(?:m4v|mov|mp4|webm)$/i.test(file);
}

const CHECKIN_EVIDENCE_PREVIEW = "/checkin-evidence-preview.svg";

function CheckinEvidenceReviewer({
  record,
  activeProofIndex,
  imageZoom,
  videoPlaying,
  onProofChange,
  onImageZoomChange,
  onVideoPlayingChange,
  onDownload,
}: {
  record: CheckinRecord;
  activeProofIndex: number;
  imageZoom: number;
  videoPlaying: boolean;
  onProofChange: (index: number) => void;
  onImageZoomChange: (zoom: number) => void;
  onVideoPlayingChange: (playing: boolean) => void;
  onDownload: (proof: string) => void;
}) {
  const proof = record.proof[activeProofIndex];
  if (!proof) return <EmptyState title="无凭证文件" description="该记录未附带照片或视频。" />;

  const video = isVideoMaterial(proof);
  const canZoomIn = imageZoom < 2;
  const canZoomOut = imageZoom > 0.6;

  return (
    <section className="checkin-evidence-reviewer" aria-label="打卡凭证审核工具">
      <div className="evidence-review-head">
        <div><span className="eyebrow">运动凭证</span><b>{record.proof.length} 份材料</b></div>
        <button className="secondary-button evidence-download-button" type="button" onClick={() => onDownload(proof)}><Download size={15} />下载原件</button>
      </div>

      <div className="evidence-proof-tabs" role="tablist" aria-label="选择要审核的凭证">
        {record.proof.map((item, index) => {
          const selected = index === activeProofIndex;
          const isVideo = isVideoMaterial(item);
          return <button key={item} type="button" role="tab" aria-selected={selected} className={selected ? "is-selected" : ""} onClick={() => onProofChange(index)}>
            <span>{isVideo ? <Play size={13} fill="currentColor" /> : "图"}</span><b>{item}</b><small>{isVideo ? "视频" : "图片"}</small>
          </button>;
        })}
      </div>

      <div className="evidence-stage">
        {video ? (
          <div className={`evidence-video-player ${videoPlaying ? "is-playing" : ""}`}>
            <img src={CHECKIN_EVIDENCE_PREVIEW} alt={`${proof} 的视频首帧预览`} />
            <button className="evidence-video-toggle" type="button" aria-label="播放或暂停视频" aria-pressed={videoPlaying} onClick={() => onVideoPlayingChange(!videoPlaying)}>
              {videoPlaying ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
            </button>
            <div className="evidence-video-controls" aria-label="视频播放进度">
              <span className="evidence-video-progress"><i /></span><small>{videoPlaying ? "00:14 / 00:36" : "00:00 / 00:36"}</small>
            </div>
          </div>
        ) : (
          <div className="evidence-image-canvas">
            <img src={CHECKIN_EVIDENCE_PREVIEW} alt={`${proof} 的图片预览`} style={{ transform: `scale(${imageZoom})` }} />
            <div className="evidence-image-controls" aria-label="图片缩放控制">
              <button type="button" disabled={!canZoomOut} aria-label="缩小图片" onClick={() => onImageZoomChange(Math.max(0.6, Number((imageZoom - 0.2).toFixed(1))))}><ZoomOut size={15} /></button>
              <button type="button" className="evidence-zoom-value" aria-label="恢复原始缩放" onClick={() => onImageZoomChange(1)}>{Math.round(imageZoom * 100)}%</button>
              <button type="button" disabled={!canZoomIn} aria-label="放大图片" onClick={() => onImageZoomChange(Math.min(2, Number((imageZoom + 0.2).toFixed(1))))}><ZoomIn size={15} /></button>
            </div>
          </div>
        )}
      </div>
      <p className="evidence-review-caption">{video ? "视频可播放并核对时长、场景与运动过程。" : "可缩放图片，核对时间、场景及运动凭证细节。"}</p>

      {record.locationExpired ? (
        <aside className="evidence-location-status is-expired"><CircleAlert size={18} /><div><b>定位数据已过期</b><span>超过 90 天的原始定位已按规则清除，当前不可查看地图。</span></div></aside>
      ) : (
        <aside className="evidence-location-status">
          <div className="evidence-masked-map" role="img" aria-label="已脱敏的校园运动区域地图">
            <svg viewBox="0 0 220 108" aria-hidden="true"><path d="M-10 24 C40 6 73 53 126 26 S190 31 235 7" /><path d="M9 92 C47 69 75 77 111 54 S174 64 225 42" /><path d="M28 -4 L52 112 M130 -2 L149 110" /><rect x="90" y="37" width="44" height="25" rx="7" /><circle cx="111" cy="49" r="15" /><path className="evidence-map-route" d="M56 74 C81 56 82 39 111 49 S145 76 166 52" /><circle className="evidence-map-marker" cx="111" cy="49" r="5" /></svg>
          </div>
          <div><b><MapPin size={16} />校园运动区域（已脱敏）</b><span>仅显示约 300m 范围和运动路径概览，不展示精确坐标。</span></div>
        </aside>
      )}
    </section>
  );
}

function materialTypeLabel(file: string) {
  if (/\.pdf$/i.test(file)) return "PDF";
  return isImageMaterial(file) ? "图片" : "文件";
}

function EvidenceMaterials({
  files,
  onPreview,
}: {
  files: string[];
  onPreview: (file: string) => void;
}) {
  return (
    <section className="evidence-materials" aria-label={`学生证明材料，共 ${files.length} 份`}>
      <div className="evidence-materials-head"><span>学生证明材料</span><small>{files.length} 份 · 点击缩略图或文件名预览</small></div>
      <div className="evidence-thumbnail-list">
        {files.map((file, index) => {
          const image = isImageMaterial(file);
          return (
            <button
              className={`evidence-thumbnail ${image ? "evidence-thumbnail-image" : "evidence-thumbnail-document"} evidence-thumbnail-tone-${index % 4}`}
              type="button"
              key={file}
              aria-label={`预览 ${file}`}
              onClick={() => onPreview(file)}
            >
              <span>{materialTypeLabel(file)}</span>
              <small>{file}</small>
            </button>
          );
        })}
      </div>
      <div className="material-file-links">
        {files.map((file) => <button className="document-link" type="button" key={file} onClick={() => onPreview(file)}>{file}<span>预览 ↗</span></button>)}
      </div>
    </section>
  );
}

function Dialog({
  title,
  description,
  close,
  children,
  footer,
  wide = false,
  drawer = false,
  className = "",
  eyebrow = "教师端业务操作",
  headerContent,
}: {
  title: string;
  description: React.ReactNode;
  close: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  drawer?: boolean;
  className?: string;
  eyebrow?: string;
  headerContent?: React.ReactNode;
}) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [close]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className={`modal teacher-dialog ${wide ? "teacher-dialog-wide" : ""} ${drawer ? "review-drawer" : ""} ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="teacher-dialog-title">
        <div className="modal-head">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2 id="teacher-dialog-title">{title}</h2>{headerContent}<p>{description}</p></div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={close}>×</button>
        </div>
        <div className="teacher-dialog-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </section>
    </div>
  );
}

function CourseTargetStatCard({
  icon,
  label,
  value,
  tone = "blue",
  compact = false,
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  tone?: "blue" | "orange" | "green" | "gray";
  compact?: boolean;
}) {
  return (
    <article className={`course-target-stat-card is-${tone} ${compact ? "is-compact" : ""}`.trim()}>
      <span className="course-target-stat-icon" aria-hidden="true">{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  );
}

function Field({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`teacher-field ${className ?? ""}`.trim()}>
      <span>{label}{required && <b> *</b>}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function TeacherWorkspace({ active, direction, showToast }: TeacherWorkspaceProps) {
  const [courses, setCourses] = useState<Course[]>(initialCourses);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [records, setRecords] = useState<CheckinRecord[]>(initialRecords);
  const [grades, setGrades] = useState<Grade[]>(initialGrades);
  const [exemptions, setExemptions] = useState<Exemption[]>(initialExemptions);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [materialPreview, setMaterialPreview] = useState<MaterialPreview | null>(null);
  const [activeCheckinProofIndex, setActiveCheckinProofIndex] = useState(0);
  const [checkinImageZoom, setCheckinImageZoom] = useState(1);
  const [checkinVideoPlaying, setCheckinVideoPlaying] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [courseView, setCourseView] = useState<"all" | "active" | "ended">("all");
  const [reconciliationCourseId, setReconciliationCourseId] = useState<number | null>(null);
  const [rosterView, setRosterView] = useState<RosterView>("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterSort, setRosterSort] = useState<"attention" | "progress" | "name">("attention");
  const [checkinStudentId, setCheckinStudentId] = useState<number | null>(null);
  const [checkinDetailView, setCheckinDetailView] = useState<CheckinDetailView>("list");
  const [checkinReviewFilter, setCheckinReviewFilter] = useState<CheckinReviewFilter>("all");
  const [checkinAuditFilter, setCheckinAuditFilter] = useState<CheckinAuditFilter>("all");
  const [checkinAuditCompleted, setCheckinAuditCompleted] = useState<Record<number, boolean>>({});
  const [pendingRecordFocusId, setPendingRecordFocusId] = useState<number | null>(null);
  const [gradeCourseId, setGradeCourseId] = useState(1);
  const [gradeView, setGradeView] = useState<"all" | "recorded" | "pending" | "exception">("all");
  const [exemptionFilter, setExemptionFilter] = useState<ExemptionFilter>("pending");
  const [exemptionSearch, setExemptionSearch] = useState("");
  const [exemptionKind, setExemptionKind] = useState<"all" | Exemption["kind"]>("all");
  const [inviteClock, setInviteClock] = useState(() => Date.now());
  const [inviteQr, setInviteQr] = useState<{ code: string; dataUrl: string } | null>(null);
  const invitePresentationRef = useRef<HTMLDivElement>(null);
  const handleInviteQrReady = useCallback((code: string, dataUrl: string) => setInviteQr({ code, dataUrl }), []);

  useEffect(() => {
    const timer = window.setInterval(() => setInviteClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const teacherCourses = courses;
  const reconciliationCourses: RosterCourseReference[] = useMemo(() => courses.map((course) => ({
    id: String(course.id),
    code: course.code,
    name: course.name,
    teachingClassCode: course.section,
  })), [courses]);
  const reconciliationMembers: PlatformCourseMember[] = useMemo(() => students
    .filter((student) => student.status === "active")
    .map((student) => ({
      id: String(student.id),
      courseId: String(student.courseId),
      studentId: String(student.id),
      studentNumber: student.number,
      name: student.name,
      gender: student.gender,
      grade: student.grade,
      joinedAt: student.joinedAt,
      joinMethod: student.joinMethod === "qr" ? "QR_CODE" : "IMPORT",
    })), [students]);
  const getCheckinSummary = (student: Student) => {
    const course = courses.find((item) => item.id === student.courseId);
    const approvedOffsets = exemptions.filter((item) => item.studentId === student.id && item.status === "approved");
    const courseTarget = Math.max(0, (course?.courseTarget ?? 0) - (student.courseWaiverHours ?? 0) - approvedOffsets.reduce((total, item) => total + (item.courseOffset ?? 0), 0));
    const otherTarget = Math.max(0, (course?.otherTarget ?? 0) - (student.otherWaiverHours ?? 0) - approvedOffsets.reduce((total, item) => total + (item.otherOffset ?? 0), 0));
    const expectedHours = courseTarget + otherTarget;
    const completedHours = student.courseHours + student.otherHours;
    const studentRecords = records.filter((record) => record.studentId === student.id);
    const confidence = studentRecords.length ? studentRecords.reduce((total, record) => total + record.confidence, 0) / studentRecords.length : null;
    return {
      expectedHours,
      remainingHours: Math.max(0, expectedHours - completedHours),
      confidence,
      recordCount: studentRecords.length,
    };
  };

  const getRosterProgress = (student: Student) => {
    const course = courses.find((item) => item.id === student.courseId);
    const approvedOffsets = exemptions.filter((item) => item.studentId === student.id && item.status === "approved");
    const courseWaiver = (student.courseWaiverHours ?? 0) + approvedOffsets.reduce((total, item) => total + (item.courseOffset ?? 0), 0);
    const otherWaiver = (student.otherWaiverHours ?? 0) + approvedOffsets.reduce((total, item) => total + (item.otherOffset ?? 0), 0);
    const courseTarget = Math.max(0, (course?.courseTarget ?? 0) - courseWaiver);
    const otherTarget = Math.max(0, (course?.otherTarget ?? 0) - otherWaiver);
    const coursePercent = courseTarget ? Math.min(100, Math.round((student.courseHours / courseTarget) * 100)) : 100;
    const otherPercent = otherTarget ? Math.min(100, Math.round((student.otherHours / otherTarget) * 100)) : 100;
    const totalTarget = courseTarget + otherTarget;
    const totalPercent = totalTarget ? Math.min(100, Math.round(((student.courseHours + student.otherHours) / totalTarget) * 100)) : 100;
    return { course, courseWaiver, otherWaiver, courseTarget, otherTarget, coursePercent, otherPercent, totalPercent };
  };

  const getCourseManagementSummary = (course: Course) => {
    const enrolledStudents = students.filter((student) => student.courseId === course.id && student.status === "active");
    const studentCount = enrolledStudents.length;
    const qualifiedStudentCount = enrolledStudents.filter((student) => getRosterProgress(student).totalPercent >= 100).length;
    const unqualifiedStudentCount = studentCount - qualifiedStudentCount;
    const completionRate = studentCount > 0
      ? Math.round((qualifiedStudentCount / studentCount) * 100)
      : 0;
    const pendingAuditRecordCount = records.filter((record) => record.courseId === course.id && record.auditStatus === "pending").length;
    const newStudentCount = enrolledStudents.filter((student) => student.joinedAt.startsWith("2026-08-02")).length;

    return {
      studentCount,
      qualifiedStudentCount,
      unqualifiedStudentCount,
      completionRate,
      pendingAuditRecordCount,
      newStudentCount,
    };
  };

  const studentProfileFor = (student: Student): StudentProfile => {
    const course = courses.find((item) => item.id === student.courseId);
    return {
      id: `student-${student.id}`,
      name: student.name,
      number: student.number,
      email: student.email,
      gender: student.gender,
      grade: student.grade,
      joinedAt: student.joinedAt,
      joinMethod: joinMethodLabel(student.joinMethod),
      course: courseLabel(course),
      courseStatus: membershipStatusLabel(student.status),
    };
  };

  const studentCourseMetricsFor = (student: Student): StudentCourseMetric[] => {
    const studentRecords = records.filter((record) => record.studentId === student.id);
    const studentGrade = grades.find((grade) => grade.studentId === student.id && grade.courseId === student.courseId);
    const pendingReviewCount = studentRecords.filter((record) => record.auditStatus === "pending").length
      + exemptions.filter((item) => item.studentId === student.id && (item.status === "pending" || item.status === "supplement_required")).length;
    const gradeStatus = !studentGrade
      ? "暂无成绩"
      : studentGrade.published
        ? "已发布"
        : statusLabel(studentGrade.enduranceStatus, "grade");

    return [
      { label: "累计运动学时", value: `${(student.courseHours + student.otherHours).toFixed(1)}h` },
      { label: "打卡次数", value: `${studentRecords.length} 次` },
      { label: "成绩状态", value: gradeStatus, tone: gradeStatus === "待录入" || gradeStatus === "缺考" ? "attention" : "default" },
      { label: "待审核内容", value: pendingReviewCount > 0 ? `${pendingReviewCount} 项` : "无", tone: pendingReviewCount > 0 ? "attention" : "success" },
    ];
  };

  // Removing a member blocks new check-ins but must not hide or delete existing
  // pending/valid/invalid records from the teacher's audit workspace.
  const checkinStudents = students.filter((student) =>
    student.status === "active" || records.some((record) => record.studentId === student.id),
  );
  const checkinStudentSummaries = checkinStudents.map((student) => ({ student, ...getCheckinSummary(student) }));
  const selectedCheckinStudent = checkinStudents.find((student) => student.id === checkinStudentId);
  const selectedCheckinSummary = selectedCheckinStudent ? getCheckinSummary(selectedCheckinStudent) : undefined;
  const selectedCheckinCourse = courses.find((course) => course.id === selectedCheckinStudent?.courseId);
  const selectedCheckinRequiredMinutes = ((selectedCheckinCourse?.courseTarget ?? 0) + (selectedCheckinCourse?.otherTarget ?? 0)) * 60;
  const selectedStudentCheckins = useMemo(
    () => (checkinStudentId === null ? [] : records
      .filter((record) => record.studentId === checkinStudentId)
      .sort((left, right) => right.startAt.localeCompare(left.startAt))),
    [checkinStudentId, records],
  );
  const selectedCheckinAuditSummary = useMemo(
    () => deriveAuditSummary(selectedStudentCheckins, selectedCheckinRequiredMinutes),
    [selectedCheckinRequiredMinutes, selectedStudentCheckins],
  );
  const visibleSelectedStudentCheckins = useMemo(
    () => selectedStudentCheckins.filter((record) => checkinAuditFilter === "all" || record.auditStatus === checkinAuditFilter),
    [checkinAuditFilter, selectedStudentCheckins],
  );
  const selectedCheckinAlbums = useMemo(
    () => visibleSelectedStudentCheckins.reduce<{ month: string; records: CheckinRecord[] }[]>((groups, record) => {
      const month = checkinMonthLabel(record);
      const group = groups.find((item) => item.month === month);
      if (group) group.records.push(record);
      else groups.push({ month, records: [record] });
      return groups;
    }, []),
    [visibleSelectedStudentCheckins],
  );

  useEffect(() => {
    if (pendingRecordFocusId === null) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const recordElement = document.getElementById(`checkin-record-${pendingRecordFocusId}`);
      recordElement?.scrollIntoView({ behavior: "smooth", block: "center" });
      recordElement?.querySelector<HTMLElement>("[data-audit-anchor]")?.focus({ preventScroll: true });
      setPendingRecordFocusId(null);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [checkinAuditFilter, checkinDetailView, pendingRecordFocusId]);

  const openDialog = (nextDialog: Exclude<DialogState, null>, initialForm: Record<string, string> = {}) => {
    setForm(initialForm);
    setFormError("");
    setDialog(nextDialog);
  };

  const closeDialog = () => {
    setDialog(null);
    setForm({});
    setFormError("");
  };

  const openMaterialPreview = (file: string, studentName: string, applicationKind: Exemption["kind"]) => {
    setMaterialPreview({ file, studentName, applicationKind });
  };

  const updateForm = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (formError) setFormError("");
  };

  const markStudentAuditInProgress = (studentId: number) => {
    setCheckinAuditCompleted((current) => current[studentId] ? { ...current, [studentId]: false } : current);
  };

  const selectRecordAuditStatus = (record: CheckinRecord, status: AuditStatus) => {
    if (status === "invalid") {
      openDialog(
        { type: "checkin-invalid", recordId: record.id },
        { invalidReason: record.invalidReason ?? "", auditRemark: record.auditRemark ?? "" },
      );
      return;
    }
    if (record.auditStatus === status) return;
    setRecords((current) => current.map((item) => item.id === record.id ? {
      ...item,
      auditStatus: status,
      invalidReason: undefined,
      auditRemark: undefined,
    } : item));
    markStudentAuditInProgress(record.studentId);
    showToast(status === "valid" ? "已标记为有效，汇总有效时长已更新。" : "已恢复为待审核。");
  };

  const confirmInvalidAttendance = (recordId: number) => {
    const record = records.find((item) => item.id === recordId);
    const invalidReason = form.invalidReason?.trim();
    const auditRemark = form.auditRemark?.trim();
    if (!record || !invalidReason) {
      setFormError("请选择一项无效原因。");
      return;
    }
    if (invalidReason === "其他" && !auditRemark) {
      setFormError("选择“其他”时，请填写备注。");
      return;
    }
    setRecords((current) => current.map((item) => item.id === recordId ? {
      ...item,
      auditStatus: "invalid",
      invalidReason,
      auditRemark: invalidReason === "其他" ? auditRemark : undefined,
    } : item));
    markStudentAuditInProgress(record.studentId);
    showToast("已标记为无效，汇总有效时长已更新。");
    closeDialog();
  };

  const openCheckinStudentRecords = (studentId: number) => {
    setCheckinStudentId(studentId);
    setCheckinDetailView("list");
    setCheckinAuditFilter("all");
    setPendingRecordFocusId(null);
  };

  const startCheckinAuditCompletion = () => {
    if (!selectedCheckinStudent || selectedStudentCheckins.length === 0) {
      showToast("暂无打卡记录需要审核。");
      return;
    }
    const firstPendingRecord = selectedStudentCheckins.find((record) => record.auditStatus === "pending");
    if (firstPendingRecord) {
      setCheckinAuditFilter("pending");
      setPendingRecordFocusId(firstPendingRecord.id);
      showToast(`还有 ${selectedCheckinAuditSummary.pendingCount} 条记录未审核。`);
      return;
    }
    openDialog({ type: "checkin-complete", studentId: selectedCheckinStudent.id });
  };

  const confirmCheckinAuditCompletion = (studentId: number) => {
    const studentRecords = records.filter((record) => record.studentId === studentId);
    const student = students.find((item) => item.id === studentId);
    const course = courses.find((item) => item.id === student?.courseId);
    const summary = deriveAuditSummary(studentRecords, ((course?.courseTarget ?? 0) + (course?.otherTarget ?? 0)) * 60);
    if (summary.pendingCount > 0) {
      closeDialog();
      setCheckinAuditFilter("pending");
      setPendingRecordFocusId(studentRecords.find((record) => record.auditStatus === "pending")?.id ?? null);
      showToast(`还有 ${summary.pendingCount} 条记录未审核。`);
      return;
    }
    setCheckinAuditCompleted((current) => ({ ...current, [studentId]: true }));
    showToast("审核已完成（结果仅保存在当前页面）。");
    closeDialog();
  };

  const notify = (message: string, forced = false) => {
    showToast(`${message}${forced ? "；已自动发送不可静默的学生通知。" : "；学生通知已自动生成。"}`);
  };

  const addCourse = () => {
    const code = form.code?.trim().toUpperCase();
    const section = form.section?.trim();
    const name = form.name?.trim();
    if (!code || !section || !name) {
      setFormError("课程代码、教学班号和课程名称均为必填项。");
      return;
    }
    if (courses.some((course) => course.semester === semesterCurrent && course.code === code && course.section === section)) {
      setFormError("当前学期已存在相同课程代码和教学班号。");
      return;
    }
    const nextId = Math.max(...courses.map((course) => course.id)) + 1;
    setCourses((current) => [
      ...current,
      {
        id: nextId,
        code,
        section,
        name,
        semester: semesterCurrent,
        status: "ACTIVE",
        courseTarget: 10,
        otherTarget: 10,
        checkinWindow: { ...defaultCheckinWindow, excludedDates: [] },
      },
    ]);
    showToast(`已创建 ${name} · ${section}，并自动关联当前教师与当前学期。`);
    closeDialog();
  };

  const saveCourseSettings = (courseId: number) => {
    const courseTarget = Number(form.courseTarget);
    const otherTarget = Number(form.otherTarget);
    if (!Number.isFinite(courseTarget) || !Number.isFinite(otherTarget) || courseTarget < 0 || otherTarget < 0) {
      setFormError("两类学时目标必须为不小于 0 的数字。");
      return;
    }
    const windowMode = form.windowMode === "unavailable" ? "unavailable" : "available";
    const dateRangeStart = form.dateRangeStart?.trim();
    const dateRangeEnd = form.dateRangeEnd?.trim();
    const dailyStartTime = form.dailyStartTime?.trim();
    const dailyEndTime = form.dailyEndTime?.trim();
    const semesterDeadline = form.semesterDeadline?.trim();
    if (!dateRangeStart || !dateRangeEnd || !dailyStartTime || !dailyEndTime || !semesterDeadline) {
      setFormError("请完整填写打卡时间窗的日期和每日时段。");
      return;
    }
    if (dateRangeEnd < dateRangeStart) {
      setFormError("打卡结束日期不能早于开始日期。");
      return;
    }
    if (dailyEndTime <= dailyStartTime) {
      setFormError("每日结束时间必须晚于开始时间。");
      return;
    }
    if (semesterDeadline > dateRangeEnd) {
      setFormError("学期截止日期不能晚于打卡结束日期。");
      return;
    }
    const excludedDates = (form.excludedDates ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
      const [date, ...reasonParts] = line.split(",");
      return { date: date?.trim() ?? "", reason: reasonParts.join(",").trim() };
    });
    if (excludedDates.some((item) => !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.reason)) {
      setFormError("排除日期请按“YYYY-MM-DD, 原因”每行一条填写。");
      return;
    }
    if (new Set(excludedDates.map((item) => item.date)).size !== excludedDates.length) {
      setFormError("排除日期不能重复。");
      return;
    }
    if (excludedDates.some((item) => item.date < dateRangeStart || item.date > dateRangeEnd)) {
      setFormError("排除日期必须位于打卡日期范围内。");
      return;
    }
    const checkinWindow: CheckinWindow = { windowMode, dateRangeStart, dateRangeEnd, dailyStartTime, dailyEndTime, excludedDates, semesterDeadline };
    setCourses((current) => current.map((course) => course.id === courseId ? { ...course, courseTarget, otherTarget, checkinWindow } : course));
    showToast("课程设置已保存，学生端将按本教学班的目标和打卡时间窗执行。");
    closeDialog();
  };

  const generateInvite = (courseId: number) => {
    const randomValue = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0].toString(36)
      : Math.random().toString(36);
    const code = `PE${String(courseId).padStart(2, "0")}-${randomValue.slice(-5).toUpperCase().padStart(5, "0")}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    setCourses((current) => current.map((course) => course.id === courseId ? {
      ...course,
      invite: { code, expiresAt, status: "active" },
    } : course));
    setInviteQr(null);
    showToast("已生成新的课程邀请，二维码将在几秒内可扫码。有效期为 7 天。");
  };

  const revokeInvite = (courseId: number) => {
    setCourses((current) => current.map((course) => course.id === courseId && course.invite ? {
      ...course,
      invite: { ...course.invite, status: "revoked" },
    } : course));
    showToast("邀请码已撤销，学生将不能再凭此码加入课程。");
    closeDialog();
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    }
  };

  const copyInviteCode = async (invite: Invite) => {
    const copied = await copyText(invite.code);
    showToast(copied ? `邀请码 ${invite.code} 已复制。` : "未能自动复制邀请码，请手动选择后复制。");
  };

  const downloadInviteQr = (course: Course, invite: Invite) => {
    const dataUrl = inviteQr?.code === invite.code ? inviteQr.dataUrl : null;
    if (!dataUrl) {
      showToast("二维码正在生成，请稍候再下载。");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `${course.code}-${course.section}-${invite.code}-二维码.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast("二维码已下载，可投影或发送给学生。");
  };

  const presentInviteQr = () => {
    const target = invitePresentationRef.current;
    if (!target?.requestFullscreen) {
      showToast("当前浏览器不支持全屏展示，请使用下载或打印功能。");
      return;
    }
    void target.requestFullscreen().catch(() => showToast("无法进入全屏展示，请检查浏览器权限。"));
  };

  const runStudentAction = (studentId: number, action: "remove" | "supplement" | "waiver") => {
    const student = students.find((item) => item.id === studentId);
    const reason = form.reason?.trim();
    if (!student) return;
    if (action === "remove") {
      if (!reason) {
        setFormError("移出课程原因必填，学生将收到课程成员关系变更通知。");
        return;
      }
      setStudents((current) => current.map((item) => item.id === studentId ? { ...item, status: "removed" } : item));
      notify(`已将 ${student.name} 移出课程；原打卡和成绩保留为只读历史`);
    } else if (action === "waiver") {
      const hours = Number(form.hours);
      const creditType = form.creditType as "课程相关" | "其他运动";
      const course = courses.find((item) => item.id === student.courseId);
      const isCourseHours = creditType === "课程相关";
      const currentWaiver = isCourseHours ? student.courseWaiverHours ?? 0 : student.otherWaiverHours ?? 0;
      const approvedOffset = exemptions.filter((item) => item.studentId === studentId && item.status === "approved").reduce((total, item) => total + (isCourseHours ? item.courseOffset ?? 0 : item.otherOffset ?? 0), 0);
      const target = isCourseHours ? course?.courseTarget ?? 0 : course?.otherTarget ?? 0;
      const availableHours = Math.max(0, target - currentWaiver - approvedOffset);
      if (!Number.isFinite(hours) || hours <= 0 || !creditType || !reason) {
        setFormError("减免类别、减免时长和减免原因均为必填项，时长须大于 0。");
        return;
      }
      if (hours > availableHours) {
        setFormError(`该类别最多还可减免 ${availableHours.toFixed(1)} 小时，请调整减免时长。`);
        return;
      }
      setStudents((current) => current.map((item) => item.id === studentId ? {
        ...item,
        courseWaiverHours: isCourseHours ? currentWaiver + hours : item.courseWaiverHours ?? 0,
        otherWaiverHours: isCourseHours ? item.otherWaiverHours ?? 0 : currentWaiver + hours,
      } : item));
      const completedHours = isCourseHours ? student.courseHours : student.otherHours;
      const remainingHours = Math.max(0, availableHours - hours - completedHours);
      notify(`已为 ${student.name} 减免 ${hours} 小时${creditType}，该类别还需完成 ${remainingHours.toFixed(1)} 小时`, true);
    } else {
      const hours = Number(form.hours);
      if (![1, 2].includes(hours) || !form.creditType || !form.sport?.trim() || !reason) {
        setFormError("学时类型、1/2 小时时长、运动项目和补录原因均为必填项。");
        return;
      }
      const nextRecord: CheckinRecord = {
        id: Math.max(0, ...records.map((record) => record.id)) + 1,
        studentId,
        courseId: student.courseId,
        creditType: form.creditType as "课程相关" | "其他运动",
        sport: form.sport.trim(),
        startAt: "教师补录",
        endAt: "教师补录",
        durationMinutes: hours * 60,
        creditedMinutes: hours * 60,
        originalHours: hours as 1 | 2,
        approvedHours: hours as 1 | 2,
        description: reason,
        submittedAt: new Date().toISOString().slice(0, 10),
        status: "有效",
        risk: "低风险",
        confidence: 1,
        proof: form.proof ? [form.proof] : [],
        locationExpired: false,
        source: "system",
        reviewComment: reason,
        auditStatus: "valid",
      };
      setRecords((current) => [...current, nextRecord]);
      setStudents((current) => current.map((item) => item.id === studentId ? {
        ...item,
        courseHours: item.courseHours + (form.creditType === "课程相关" ? hours : 0),
        otherHours: item.otherHours + (form.creditType === "其他运动" ? hours : 0),
      } : item));
      notify(`已为 ${student.name} 补录 ${hours} 小时${form.creditType}学时，且不占用每日提交额度`, true);
    }
    closeDialog();
  };

  const saveCheckinReview = (recordId: number) => {
    const currentRecord = records.find((record) => record.id === recordId);
    const approvedHours = Number(form.approvedHours);
    const reviewComment = form.reviewComment?.trim();
    if (!currentRecord || ![0, 1, 2].includes(approvedHours) || !reviewComment) {
      setFormError("有效学时只能为 0、1 或 2 小时，且学生可见的审查意见必填。");
      return;
    }
    setRecords((current) => current.map((record) => record.id === recordId ? {
      ...record,
      approvedHours: approvedHours as 0 | 1 | 2,
      creditedMinutes: approvedHours * 60,
      status: "已调整",
      reviewComment,
      internalNote: form.internalNote?.trim(),
    } : record));
    markStudentAuditInProgress(currentRecord.studentId);
    const hoursDelta = approvedHours - currentRecord.approvedHours;
    if (hoursDelta !== 0 && currentRecord.creditType !== "系统抵扣") {
      setStudents((current) => current.map((student) => student.id === currentRecord.studentId ? {
        ...student,
        courseHours: Math.max(0, student.courseHours + (currentRecord.creditType === "课程相关" ? hoursDelta : 0)),
        otherHours: Math.max(0, student.otherHours + (currentRecord.creditType === "其他运动" ? hoursDelta : 0)),
      } : student));
    }
    showToast("可计入时长已调整，当前页面统计将以审核状态重新计算。");
    closeDialog();
  };

  const saveGrade = (gradeId: number) => {
    const grade = grades.find((item) => item.id === gradeId);
    if (!grade) return;
    const status = form.enduranceStatus as GradeStatus;
    let physicalScore = grade.physicalScore;
    let minutes = grade.minutes;
    let seconds = grade.seconds;
    if (status === "Recorded") {
      minutes = Number(form.minutes);
      seconds = Number(form.seconds);
      if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || seconds < 0 || seconds > 59) {
        setFormError("请填写有效的耐力跑分钟和秒数。");
        return;
      }
      physicalScore = scoreEndurance(minutes * 60 + seconds, grade.gender === "男" ? 1000 : 800, grade.gradeGroup === "大三/大四");
    } else if (status === "Absent") {
      if (!form.reason?.trim()) {
        setFormError("标记缺考时必须填写缺考原因。");
        return;
      }
      physicalScore = 0;
      minutes = undefined;
      seconds = undefined;
    } else if (status === "NotRecorded") {
      physicalScore = undefined;
      minutes = undefined;
      seconds = undefined;
    } else if (status === "Exempt") {
      physicalScore = grade.physicalScore;
    }
    setGrades((current) => current.map((item) => item.id === gradeId ? {
      ...item,
      enduranceStatus: status,
      minutes,
      seconds,
      physicalScore,
    } : item));
    notify(grade.published ? "已发布成绩已修改，审计来源已记录" : "学生成绩已保存", grade.published);
    closeDialog();
  };

  const publishGrades = (courseId: number) => {
    setGrades((current) => current.map((grade) => grade.courseId === courseId ? { ...grade, published: true } : grade));
    notify("全班成绩已发布", true);
    closeDialog();
  };

  const reviewExemption = (exemptionId: number) => {
    const item = exemptions.find((exemption) => exemption.id === exemptionId);
    const decision = form.decision as "approve" | "reject" | "supplement";
    const comment = form.comment?.trim();
    if (!item || !decision || !comment) {
      setFormError("审核结果和学生可见的审核意见均为必填项。");
      return;
    }
    const next: Partial<Exemption> = { reviewComment: comment };
    if (decision === "reject") next.status = "rejected";
    if (decision === "supplement") next.status = "supplement_required";
    if (decision === "approve") {
      next.status = "approved";
      if (item.kind === "耐力跑免测") {
        const score = Number(form.score);
        if (!Number.isFinite(score) || score < 0 || score > 100) {
          setFormError("通过耐力跑免测时必须设置 0–100 的自定义分数。");
          return;
        }
        next.score = score;
        setGrades((current) => current.map((grade) => grade.studentId === item.studentId && grade.courseId === item.courseId ? {
          ...grade,
          enduranceStatus: "Exempt",
          physicalScore: score,
        } : grade));
      } else {
        const courseOffset = Number(form.courseOffset || 0);
        const otherOffset = Number(form.otherOffset || 0);
        const course = courses.find((candidate) => candidate.id === item.courseId);
        const maximumOffset = (course?.courseTarget ?? 0) + (course?.otherTarget ?? 0);
        if (courseOffset < 0 || otherOffset < 0 || courseOffset + otherOffset <= 0 || courseOffset + otherOffset > maximumOffset) {
          setFormError(`课程运动与其他运动抵扣之和必须大于 0，且不得超过本教学班设置的 ${maximumOffset} 小时。`);
          return;
        }
        next.courseOffset = courseOffset;
        next.otherOffset = otherOffset;
      }
    }
    setExemptions((current) => current.map((exemption) => exemption.id === exemptionId ? { ...exemption, ...next } : exemption));
    notify(decision === "approve" ? "申请已审核通过并同步成绩/抵扣结果" : decision === "reject" ? "申请已驳回，学生可补充材料后重新提交" : "已要求学生补充材料");
    closeDialog();
  };

  const revokeOffset = (exemptionId: number) => {
    setExemptions((current) => current.map((item) => item.id === exemptionId ? { ...item, courseOffset: 0, otherOffset: 0, reviewComment: "组织成员资格变更，教师手动撤销抵扣。" } : item));
    notify("组织认证抵扣已手动撤销，学生需通过正常打卡补足差额");
  };

  const studentIdentity = (student: Student, quickActions: StudentQuickAction[] = []) => (
    <StudentIdentity
      student={studentProfileFor(student)}
      courseMetrics={studentCourseMetricsFor(student)}
      quickActions={quickActions}
      nameDisplay="truncate"
    />
  );

  const selectedCourse = dialog && "courseId" in dialog ? courses.find((course) => course.id === dialog.courseId) : undefined;
  const selectedCourseSummary = selectedCourse ? getCourseManagementSummary(selectedCourse) : undefined;
  const selectedStudent = dialog && "studentId" in dialog ? students.find((student) => student.id === dialog.studentId) : undefined;
  const selectedRecord = dialog?.type === "checkin" ? records.find((record) => record.id === dialog.recordId) : undefined;
  const selectedInvalidRecord = dialog?.type === "checkin-invalid" ? records.find((record) => record.id === dialog.recordId) : undefined;
  const selectedCompletionCourse = courses.find((course) => course.id === selectedStudent?.courseId);
  const selectedCompletionRequiredMinutes = ((selectedCompletionCourse?.courseTarget ?? 0) + (selectedCompletionCourse?.otherTarget ?? 0)) * 60;
  const selectedCompletionSummary = dialog?.type === "checkin-complete"
    ? deriveAuditSummary(records.filter((record) => record.studentId === dialog.studentId), selectedCompletionRequiredMinutes)
    : undefined;
  const selectedGrade = dialog?.type === "grade" ? grades.find((grade) => grade.id === dialog.gradeId) : undefined;
  const selectedExemption = dialog?.type === "exemption" ? exemptions.find((item) => item.id === dialog.exemptionId) : undefined;

  const renderCourses = () => {
    const reconciliationCourse = reconciliationCourses.find((course) => course.id === String(reconciliationCourseId));
    if (reconciliationCourse) {
      return <RosterReconciliationPage
        course={reconciliationCourse}
        courses={reconciliationCourses}
        platformMembers={reconciliationMembers}
        onBack={() => setReconciliationCourseId(null)}
        showToast={showToast}
      />;
    }
    const filteredCourses = courses.filter((course) => {
      const ended = course.status === "ENDED";
      return courseView === "all" || (courseView === "ended" ? ended : !ended);
    });
    const activeStudentCount = students.filter((student) => student.status === "active").length;
    const newStudentCount = students.filter((student) => student.status === "active" && student.joinedAt.startsWith("2026-08-02")).length;
    return (
      <CourseOverviewLayout
        summary={
          <PageSummaryMetrics ariaLabel="课程管理核心统计" items={[
            { label: "教学班", value: courses.length },
            { label: "在班学生", value: activeStudentCount },
            { label: "今日直接加入", value: newStudentCount, tone: newStudentCount > 0 ? "success" : "default" },
          ]} />
        }
        tabs={
          <div className="layout-command-row">
            <StatusTabs
              ariaLabel="课程状态"
              value={courseView}
              onChange={setCourseView}
              options={[
                { value: "all", label: "全部", count: courses.length },
                { value: "active", label: "进行中", count: courses.filter((course) => course.status === "ACTIVE").length },
                { value: "ended", label: "已结束", count: courses.filter((course) => course.status === "ENDED").length },
              ]}
            />
            <button className="primary-button page-primary-action" type="button" onClick={() => openDialog({ type: "course-new" })}>＋ 新建教学班</button>
          </div>
        }
      >
        <div className="course-grid teacher-course-grid">
          {filteredCourses.map((course) => {
            const summary = getCourseManagementSummary(course);
            const ended = course.status === "ENDED";
            const qualificationTone = summary.studentCount === 0
              ? "empty"
              : summary.unqualifiedStudentCount === 0
                ? "complete"
                : "attention";
            return (
              <article className={`course-card teacher-course-card ${ended ? "is-ended" : ""}`} key={course.id}>
                <div className="course-card-top">
                  <div className="course-card-identity">
                    <h3 title={course.name}>{course.name}</h3>
                    <span>{course.code} · {course.section}</span>
                  </div>
                  <div className="course-card-head-actions">
                    <Badge tone={ended ? "gray" : "green"}>{ended ? "已结束" : "进行中"}</Badge>
                  </div>
                </div>
                <div className="course-card-metrics" aria-label={`${course.name} 课程概览`}>
                  <span><small>在班学生</small><b>{summary.studentCount}</b></span>
                  <span><small>未达标人数</small><b className={summary.unqualifiedStudentCount > 0 ? "metric-warning" : "metric-complete"}>{summary.unqualifiedStudentCount}</b></span>
                  <span><small>今日新增学生</small><b className={summary.newStudentCount > 0 ? "metric-complete" : ""}>{summary.newStudentCount}</b></span>
                </div>
                <div className={`course-achievement is-${qualificationTone}`}>
                  <div><span>学生达标情况</span><b>{`${summary.qualifiedStudentCount} / ${summary.studentCount} 人已达标`}</b></div>
                  <strong>{`达标率 ${summary.completionRate}%`}</strong>
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={`达标率 ${summary.completionRate}%`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={summary.completionRate}
                  >
                    <i style={{ width: `${summary.completionRate}%` }} />
                  </div>
                </div>
                <div className="course-card-footer">
                  <div className="course-card-summary">
                    <span>待处理：</span>
                    <b>
                      {summary.pendingAuditRecordCount > 0 && <span>{`${summary.pendingAuditRecordCount} 条待审核记录`}</span>}
                      {summary.pendingAuditRecordCount === 0 && "暂无待审核记录"}
                    </b>
                  </div>
                  <button className="course-roster-reconciliation-button" type="button" onClick={() => setReconciliationCourseId(course.id)}><ListChecks size={15} aria-hidden="true" />名单对齐</button>
                  <button className="course-invite-button" type="button" onClick={() => openDialog({ type: "invite", courseId: course.id })}><QrCode size={15} aria-hidden="true" />邀请二维码</button>
                  <button className="course-enter-button" type="button" onClick={() => openDialog({ type: "course-manage", courseId: course.id }, { courseTarget: String(course.courseTarget), otherTarget: String(course.otherTarget), windowMode: course.checkinWindow.windowMode, dateRangeStart: course.checkinWindow.dateRangeStart, dateRangeEnd: course.checkinWindow.dateRangeEnd, dailyStartTime: course.checkinWindow.dailyStartTime, dailyEndTime: course.checkinWindow.dailyEndTime, semesterDeadline: course.checkinWindow.semesterDeadline, excludedDates: course.checkinWindow.excludedDates.map((item) => `${item.date}, ${item.reason}`).join("\n") })}>进入课程 <span>→</span></button>
                </div>
              </article>
            );
          })}
        </div>
        {filteredCourses.length === 0 && <EmptyState title="没有符合条件的课程" description="切换课程状态后可查看其他教学班。" />}
      </CourseOverviewLayout>
    );
  };

  const renderRoster = () => {
    const rosterOverview = students.map((student) => ({ student, ...getRosterProgress(student) }));
    const activeStudents = rosterOverview.filter(({ student }) => student.status === "active");
    const belowTargetCount = activeStudents.filter((item) => item.totalPercent < 100).length;
    const completedCount = activeStudents.filter((item) => item.totalPercent >= 100).length;
    const inactiveCount = rosterOverview.length - activeStudents.length;
    const searchTerm = rosterSearch.trim().toLocaleLowerCase();
    const visible = rosterOverview
      .filter((item) => {
        if (rosterView === "needs_attention") return item.student.status === "active" && item.totalPercent < 100;
        if (rosterView === "complete") return item.student.status === "active" && item.totalPercent >= 100;
        if (rosterView === "inactive") return item.student.status !== "active";
        return true;
      })
      .filter(({ student }) => courseFilter === "all" || student.courseId === Number(courseFilter))
      .filter(({ student }) => !searchTerm || [student.name, student.number, student.email, student.gender, student.grade, joinMethodLabel(student.joinMethod)].some((value) => value.toLocaleLowerCase().includes(searchTerm)))
      .sort((left, right) => {
        if (rosterSort === "name") return left.student.name.localeCompare(right.student.name, "zh-CN");
        if (rosterSort === "progress") return right.totalPercent - left.totalPercent;
        return left.totalPercent - right.totalPercent;
      });
    const supplementStudentId = visible.find(({ student }) => student.status === "active")?.student.id
      ?? activeStudents[0]?.student.id;
    return (
      <ManagementTableLayout
        key="roster"
        summary={
          <div className="layout-command-row">
            <PageSummaryMetrics ariaLabel="学生管理核心统计" items={[
              { label: "学生总数", value: students.length },
              { label: "未达标人数", value: belowTargetCount, tone: belowTargetCount ? "attention" : "default" },
            ]} />
            <button className="primary-button page-primary-action" type="button" onClick={() => openDialog({ type: "supplement" }, { studentId: String(supplementStudentId ?? "") })}>＋ 补录学时</button>
          </div>
        }
        tabs={<StatusFilterTabs
          ariaLabel="学生列表状态筛选"
          value={rosterView}
          onChange={setRosterView}
          options={[
            { value: "all", label: "全部", count: students.length },
            { value: "needs_attention", label: "待跟进", count: belowTargetCount },
            { value: "complete", label: "已达标", count: completedCount },
            { value: "inactive", label: "非在课成员", count: inactiveCount },
          ]}
        />}
        toolbar={<FilterToolbar>
          <label className="filter-search"><span aria-hidden="true">⌕</span><input value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} placeholder="搜索姓名、学号或邮箱" aria-label="搜索姓名、学号或邮箱" /></label>
          <AppSelect
            className="filter-select"
            label="课程"
            value={courseFilter}
            options={[
              { value: "all", label: "全部课程" },
              ...teacherCourses.map((course) => ({ value: String(course.id), label: courseLabel(course) })),
            ]}
            onChange={(nextValue) => nextValue !== null && setCourseFilter(String(nextValue))}
          />
          <AppSelect
            className="filter-select"
            label="排序"
            value={rosterSort}
            options={[
              { value: "attention", label: "优先处理" },
              { value: "progress", label: "完成率从高到低" },
              { value: "name", label: "姓名" },
            ]}
            onChange={(nextValue) => nextValue !== null && setRosterSort(nextValue as typeof rosterSort)}
          />
        </FilterToolbar>}
      >
        <section className="table-surface" aria-label="教学班学生名单">
          <div className="table-result-line"><span>显示 {visible.length} 名学生</span>{rosterView !== "inactive" && belowTargetCount > 0 && <span className="attention-note">{belowTargetCount} 人学时尚未达标</span>}</div>
          <DataTable className="roster-table" minWidth={1240}>
              <thead><tr><th>学生</th><th>课程</th><th>加入信息</th><th>总学时进度</th><th>成员状态</th><th className="action-column">操作</th></tr></thead>
              <tbody>{visible.map(({ student, course, courseWaiver, otherWaiver, courseTarget, otherTarget, totalPercent }) => {
                return <tr key={student.id}>
                  <td><div>{studentIdentity(student, student.status === "active" ? [
                    { label: "补录学时", tone: "primary", onSelect: () => openDialog({ type: "student-action", studentId: student.id, action: "supplement" }, { creditType: "课程相关", hours: "1" }) },
                    { label: "设置减免", onSelect: () => openDialog({ type: "student-action", studentId: student.id, action: "waiver" }, { creditType: "课程相关", hours: "1" }) },
                    { label: "移出课程", tone: "danger", onSelect: () => openDialog({ type: "student-action", studentId: student.id, action: "remove" }) },
                  ] : [])}<small className="table-sub">{`${student.number} · ${student.gender} · ${student.grade}`}</small></div></td>
                  <td><b className="roster-course-name truncate-text" title={courseLabel(course)}>{courseLabel(course)}</b></td>
                  <td><b className="table-primary-text">{joinMethodLabel(student.joinMethod)}</b><small className="table-sub">{student.joinedAt}</small></td>
                  <td><ProgressCell value={student.courseHours + student.otherHours} target={courseTarget + otherTarget} percent={totalPercent} detail={`课程运动 ${student.courseHours.toFixed(1)}/${courseTarget.toFixed(1)}h · 其他运动 ${student.otherHours.toFixed(1)}/${otherTarget.toFixed(1)}h${courseWaiver + otherWaiver > 0 ? ` · 已减免 ${(courseWaiver + otherWaiver).toFixed(1)}h` : ""}`} /></td>
                  <td><div className="roster-status"><Badge tone={student.status === "active" ? "green" : "gray"}>{membershipStatusLabel(student.status)}</Badge><small>{student.status === "active" ? `总完成率 ${totalPercent}%` : "历史只读"}</small></div></td>
                  <td className="action-column"><div className="horizontal-actions roster-row-action">
                    {student.status === "active" ? <TableActionMenu>
                      <TableActionMenuItem icon={<Plus />} onClick={() => openDialog({ type: "student-action", studentId: student.id, action: "supplement" }, { creditType: "课程相关", hours: "1" })}>补录学时</TableActionMenuItem>
                      <TableActionMenuItem icon={<Settings />} onClick={() => openDialog({ type: "student-action", studentId: student.id, action: "waiver" }, { creditType: "课程相关", hours: "1" })}>设置减免</TableActionMenuItem>
                      <TableActionMenuItem icon={<Minus />} tone="danger" dividerBefore onClick={() => openDialog({ type: "student-action", studentId: student.id, action: "remove" })}>移出课程</TableActionMenuItem>
                    </TableActionMenu> : <Badge tone="gray">历史只读</Badge>}
                  </div></td>
                </tr>;
              })}</tbody>
          </DataTable>
          {visible.length === 0 && <EmptyState title="未找到符合条件的学生" description="调整搜索或筛选条件后重试。" />}
        </section>
      </ManagementTableLayout>
    );
  };

  const openCheckinDetail = (record: CheckinRecord, proofIndex = 0) => {
    setActiveCheckinProofIndex(Math.min(Math.max(proofIndex, 0), Math.max(record.proof.length - 1, 0)));
    setCheckinImageZoom(1);
    setCheckinVideoPlaying(false);
    openDialog({ type: "checkin", recordId: record.id }, {
      approvedHours: String(record.approvedHours),
      reviewComment: record.reviewComment ?? "",
      internalNote: record.internalNote ?? "",
    });
  };

  const downloadCheckinProof = (proof: string) => {
    const anchor = document.createElement("a");
    anchor.href = CHECKIN_EVIDENCE_PREVIEW;
    anchor.download = `${proof.replace(/\.[^.]+$/, "")}-审核原件.svg`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    showToast(`已开始下载 ${proof} 的原件。`);
  };

  const renderCheckins = () => {
    if (!selectedCheckinStudent || !selectedCheckinSummary) {
      const recordsWithoutLegacyReview = records.filter((record) => !record.reviewComment);
      const pendingRecords = records.every((record) => record.auditStatus !== undefined)
        ? records.filter((record) => record.auditStatus === "pending")
        : recordsWithoutLegacyReview;
      const lowConfidenceRecords = pendingRecords.filter((record) => record.confidence < 0.7);
      const visiblePendingRecords = checkinReviewFilter === "low_confidence"
        ? lowConfidenceRecords
        : pendingRecords;
      const involvedStudentIds = new Set(pendingRecords.map((record) => record.studentId));
      const visibleStudentIds = new Set(visiblePendingRecords.map((record) => record.studentId));
      const reviewRows = checkinStudentSummaries
        .filter((summary) => visibleStudentIds.has(summary.student.id))
        .map((summary) => {
          const matchingPendingRecords = visiblePendingRecords.filter((record) => record.studentId === summary.student.id);
          const pendingCount = matchingPendingRecords.length;
          const latest = [...matchingPendingRecords].sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))[0];
          return { ...summary, pendingCount, latest };
        })
        .sort((left, right) => right.pendingCount - left.pendingCount);
      return (
        <ReviewWorkbenchLayout
          key="checkins"
          summary={
            <div className="layout-command-row">
              <PageSummaryMetrics ariaLabel="打卡审核核心统计" items={[
                { label: "待审核记录", value: pendingRecords.length },
                { label: "涉及学生", value: involvedStudentIds.size },
                { label: "需要关注记录", value: lowConfidenceRecords.length, tone: lowConfidenceRecords.length ? "attention" : "default" },
              ]} />
              <button className="secondary-button page-secondary-action" type="button" onClick={() => openDialog({ type: "supplement" }, { studentId: String(checkinStudents[0]?.id ?? ""), creditType: "课程相关", hours: "1" })}>补录学时</button>
            </div>
          }
          tabs={<StatusFilterTabs
            ariaLabel="待审核记录状态筛选"
            value={checkinReviewFilter}
            onChange={setCheckinReviewFilter}
            options={[
              { value: "all", label: "全部待审核记录", count: pendingRecords.length },
              { value: "low_confidence", label: "低置信度记录", count: lowConfidenceRecords.length },
            ]}
          />}
          toolbar={<div className="compact-guidance"><span aria-hidden="true">i</span><p>辅助置信度仅用于排序与提示，最终审核结果仍由教师确认。</p></div>}
        >
          <section className="table-surface" aria-label="打卡审核列表">
            <div className="table-result-line"><span>显示 {visiblePendingRecords.length} 条待审核记录</span><span>涉及 {reviewRows.length} 名学生</span></div>
            <DataTable className="checkin-student-table" minWidth={940}>
              <thead><tr><th>学生</th><th>待审核记录</th><th>剩余学时</th><th>辅助置信度 <span className="help-tip" title="根据定位、时长与凭证完整度生成，仅作为教师审核辅助。">?</span></th><th>最近提交</th><th className="action-column">操作</th></tr></thead>
              <tbody>{reviewRows.map(({ student, remainingHours, confidence, recordCount, pendingCount, latest }) => {
                const lowConfidence = confidence !== null && confidence < 0.7;
                return <tr className={lowConfidence ? "is-attention" : ""} key={student.id}>
                  <td>{studentIdentity(student, [
                    { label: "查看打卡记录", tone: "primary", onSelect: () => openCheckinStudentRecords(student.id) },
                  ])}</td>
                  <td><b className={pendingCount > 0 ? "pending-count" : "muted-number"}>{pendingCount}</b><small className="table-sub">{pendingCount > 0 ? "条待处理" : "暂无待办"}</small></td>
                  <td><b className={remainingHours > 0 ? "hours-remaining" : "hours-complete"}>{remainingHours.toFixed(1)}h</b><small className="table-sub">{remainingHours > 0 ? "尚待完成" : "已达标"}</small></td>
                  <td>{confidence === null ? <span className="confidence-empty">暂无记录</span> : <><b className={lowConfidence ? "confidence-value is-low" : "confidence-value"} title="系统辅助置信度">{Math.round(confidence * 100)}%</b><small className="table-sub">基于 {recordCount} 条记录</small></>}</td>
                  <td><b className="tabular-number">{latest?.submittedAt ?? "—"}</b><small className="table-sub">{latest?.sport ?? "暂无提交"}</small></td>
                  <td className="action-column"><button className="row-review-action" type="button" onClick={() => openCheckinStudentRecords(student.id)}>查看记录 <span>→</span></button></td>
                </tr>;
              })}</tbody>
            </DataTable>
            {reviewRows.length === 0 && <EmptyState title="当前筛选没有待审核记录" description="切换状态筛选查看其他打卡记录。" />}
          </section>
        </ReviewWorkbenchLayout>
      );
    }

    const auditFilterOptions: { value: CheckinAuditFilter; label: string; count: number }[] = [
      { value: "all", label: "全部", count: selectedStudentCheckins.length },
      { value: "pending", label: "待审核", count: selectedCheckinAuditSummary.pendingCount },
      { value: "valid", label: "有效", count: selectedCheckinAuditSummary.validCount },
      { value: "invalid", label: "无效", count: selectedCheckinAuditSummary.invalidCount },
    ];
    const auditCompleted = Boolean(checkinAuditCompleted[selectedCheckinStudent.id]);

    return (
      <>
        <div className="checkin-detail-top">
          <button className="text-button back-to-checkin-list" type="button" onClick={() => setCheckinStudentId(null)}>← 返回学生名单</button>
          <div className="checkin-student-summary">
            <div>{studentIdentity(selectedCheckinStudent)}</div>
            <div className="checkin-summary-metrics">
              <span><small>打卡记录</small><b>{selectedStudentCheckins.length} 条</b></span>
              <span><small>已处理进度</small><b>{selectedCheckinAuditSummary.validCount + selectedCheckinAuditSummary.invalidCount} / {selectedStudentCheckins.length}</b></span>
              <span><small>系统辅助置信度</small><b>{selectedCheckinSummary.confidence === null ? "—" : `${Math.round(selectedCheckinSummary.confidence * 100)}%`}</b></span>
            </div>
          </div>
        </div>
        <div className="panel checkin-detail-panel">
          <div className="panel-head teacher-panel-head checkin-record-panel-head">
            <div>
              <h2>{selectedCheckinStudent.name}的全部打卡记录</h2>
              <p>共 {selectedStudentCheckins.length} 条记录；审核结果仅保存在当前页面，刷新后恢复默认状态。</p>
            </div>
            <div className="checkin-detail-toolbar">
              <div className="segmented checkin-audit-filter" role="tablist" aria-label="审核状态筛选">
                {auditFilterOptions.map((option) => (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={checkinAuditFilter === option.value}
                    className={checkinAuditFilter === option.value ? "selected" : ""}
                    key={option.value}
                    onClick={() => setCheckinAuditFilter(option.value)}
                  >
                    {option.label}<b>{option.count}</b>
                  </button>
                ))}
              </div>
              <div className="segmented" aria-label="打卡记录展示方式">
                <button type="button" className={checkinDetailView === "list" ? "selected" : ""} onClick={() => setCheckinDetailView("list")}>列表</button>
                <button type="button" className={checkinDetailView === "album" ? "selected" : ""} onClick={() => setCheckinDetailView("album")}>相册</button>
              </div>
            </div>
          </div>

          <CheckinAuditSummary
            summary={selectedCheckinAuditSummary}
            requiredMinutes={selectedCheckinRequiredMinutes}
            completed={auditCompleted}
            disabled={selectedStudentCheckins.length === 0}
            onComplete={startCheckinAuditCompletion}
          />

          {selectedStudentCheckins.length === 0 ? (
            <EmptyState title="该学生尚无打卡记录" description="学生提交的运动凭证会按日期出现在此处。" />
          ) : visibleSelectedStudentCheckins.length === 0 ? (
            <EmptyState title="当前筛选暂无记录" description="切换审核状态筛选可查看其他打卡记录。" />
          ) : checkinDetailView === "list" ? (
            <div className="checkin-record-list" aria-label={`${selectedCheckinStudent.name}的打卡记录列表`}>
              <div className="checkin-record-list-head" aria-hidden="true"><span>打卡时间</span><span>运动凭证</span><span>运动信息</span><span>审核操作</span></div>
              {visibleSelectedStudentCheckins.map((record) => (
                <article id={`checkin-record-${record.id}`} className={`checkin-record-row is-${record.auditStatus}`} key={record.id}>
                  <div className="checkin-record-time">
                    <span>开始</span><b>{record.startAt}</b>
                    <span>结束</span><small>{record.endAt}</small>
                  </div>
                  <div className="record-proof-links">
                    {record.proof.length ? record.proof.map((proof, index) => (
                      <button type="button" key={proof} onClick={() => openCheckinDetail(record, index)}>
                        <span>{proof.match(/mp4|mov/i) ? "▶" : "图"}</span>{proof || `凭证 ${index + 1}`}
                      </button>
                    )) : <span className="confidence-empty">无凭证</span>}
                  </div>
                  <div className="checkin-record-info">
                    <b>{record.sport}</b>
                    <span>实际运动：{actualDurationLabel(record)}</span>
                    <span>可计入时长：{attendanceHoursLabel(record.creditedMinutes)} 小时</span>
                    <button className="checkin-description" type="button" onClick={() => openCheckinDetail(record)}>{record.description}<span>查看详情 →</span></button>
                  </div>
                  <AuditStatusSelector record={record} onSelect={selectRecordAuditStatus} />
                </article>
              ))}
            </div>
          ) : (
            <div className="checkin-album" aria-label={`${selectedCheckinStudent.name}的打卡凭证相册`}>
              {selectedCheckinAlbums.map((group) => (
                <section key={group.month} className="checkin-album-month">
                  <h3>{group.month}</h3>
                  {group.records.map((record) => (
                    <article id={`checkin-record-${record.id}`} className={`checkin-album-record is-${record.auditStatus}`} key={record.id}>
                      <div className="checkin-album-date"><b>{checkinDayLabel(record)}</b><small>{record.startAt.slice(11, 16)}</small></div>
                      <div className="proof-cluster">
                        {record.proof.length ? record.proof.map((proof, index) => (
                          <button type="button" className={`proof-thumbnail proof-thumbnail-${(record.id + index) % 5}`} key={proof} title={`查看 ${proof}`} onClick={() => openCheckinDetail(record, index)}>
                            <span>{proof.match(/mp4|mov/i) ? "▶" : "图"}</span><small>{proof}</small>
                          </button>
                        )) : (
                          <button type="button" className="proof-thumbnail proof-thumbnail-empty" onClick={() => openCheckinDetail(record)}><span>—</span><small>无凭证</small></button>
                        )}
                      </div>
                      <button type="button" className="album-record-summary" onClick={() => openCheckinDetail(record)}>
                        <b>{record.sport}</b>
                        <span>实际运动：{actualDurationLabel(record)}</span>
                        <span>可计入时长：{attendanceHoursLabel(record.creditedMinutes)} 小时</span>
                      </button>
                      <AuditStatusSelector record={record} onSelect={selectRecordAuditStatus} />
                    </article>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const exportGradesCsv = (courseGrades: Grade[]) => {
    const course = courses.find((item) => item.id === gradeCourseId);
    const rows = courseGrades.map((grade) => {
      const student = students.find((item) => item.id === grade.studentId);
      return [student?.name ?? "", student?.number ?? "", enduranceScoreLabel(grade)];
    });
    const csv = [
      ["学生姓名", "学号", "耐力跑"],
      ...rows,
    ].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${courseLabel(course).replace(/[\\/:*?\"<>|]/g, "_")}-成绩册.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast(`已导出 ${courseLabel(course)} 的 CSV 成绩册。`);
  };

  const renderGrades = () => {
    const courseGrades = grades.filter((grade) => grade.courseId === gradeCourseId);
    const published = courseGrades.length > 0 && courseGrades.every((grade) => grade.published);
    const pendingCount = courseGrades.filter((grade) => grade.enduranceStatus === "NotRecorded").length;
    const absentCount = courseGrades.filter((grade) => grade.enduranceStatus === "Absent").length;
    const recordedCount = courseGrades.filter((grade) => grade.enduranceStatus === "Recorded" || grade.enduranceStatus === "Exempt").length;
    const visibleGrades = courseGrades.filter((grade) => {
      if (gradeView === "pending") return grade.enduranceStatus === "NotRecorded";
      if (gradeView === "exception") return grade.enduranceStatus === "Absent";
      if (gradeView === "recorded") return grade.enduranceStatus === "Recorded" || grade.enduranceStatus === "Exempt";
      return true;
    });
    const gradeStatusLabel = (grade: Grade) => statusLabel(grade.enduranceStatus, "grade");
    return (
      <ManagementTableLayout
        summary={
          <div className="layout-command-row grade-command-row">
            <AppSelect
              className="course-context-select"
              label="当前课程"
              value={gradeCourseId}
              options={teacherCourses.map((course) => ({ value: course.id, label: courseLabel(course) }))}
              onChange={(nextValue) => nextValue !== null && setGradeCourseId(Number(nextValue))}
            />
            <button className="primary-button page-primary-action" type="button" onClick={() => openDialog({ type: "publish-grades", courseId: gradeCourseId })}>{published ? "成绩已发布" : "发布成绩"}</button>
          </div>
        }
        tabs={
          <div className="grade-data-controls">
            <StatusTabs
              ariaLabel="成绩状态"
              value={gradeView}
              onChange={setGradeView}
              options={[
                { value: "all", label: "全部", count: courseGrades.length },
                { value: "recorded", label: "已录入", count: recordedCount },
                { value: "pending", label: "待录入", count: pendingCount },
                { value: "exception", label: "缺考", count: absentCount },
              ]}
            />
            <div className="grade-data-utilities">
              <button className="secondary-button" type="button" onClick={() => exportGradesCsv(courseGrades)}>导出 CSV</button>
            </div>
          </div>
        }
      >
        <section className="table-surface" aria-label="成绩册">
          <DataTable className="grade-table" minWidth={680}>
            <thead><tr><th>学生</th><th>耐力跑状态</th><th>耐力跑成绩</th><th className="action-column">操作</th></tr></thead>
            <tbody>{visibleGrades.map((grade) => {
              const student = students.find((item) => item.id === grade.studentId);
              const pending = grade.enduranceStatus === "NotRecorded";
              const statusTone = pending ? "orange" : grade.enduranceStatus === "Exempt" ? "gray" : grade.enduranceStatus === "Absent" ? "red" : "green";
              return <tr className={pending ? "is-pending-grade" : ""} key={grade.id}>
                <td>{student && studentIdentity(student, [
                  {
                    label: pending ? "录入成绩" : grade.published ? "编辑成绩" : "查看 / 编辑成绩",
                    tone: pending ? "primary" : "default",
                    onSelect: () => openDialog(
                      { type: "grade", gradeId: grade.id },
                      { enduranceStatus: grade.enduranceStatus, minutes: String(grade.minutes ?? ""), seconds: String(grade.seconds ?? "") },
                    ),
                  },
                ])}</td>
                <td><Badge tone={statusTone}>{gradeStatusLabel(grade)}</Badge></td>
                <td><b className="tabular-number">{enduranceScoreLabel(grade)}</b></td>
                <td className="action-column"><button className={pending ? "row-primary-action" : "row-review-action"} type="button" onClick={() => openDialog({ type: "grade", gradeId: grade.id }, { enduranceStatus: grade.enduranceStatus, minutes: String(grade.minutes ?? ""), seconds: String(grade.seconds ?? "") })}>{pending ? "录入成绩" : grade.published ? "编辑" : "查看 / 编辑"}</button></td>
              </tr>;
            })}</tbody>
          </DataTable>
          {visibleGrades.length === 0 && <EmptyState title="当前状态没有成绩记录" description="切换成绩状态查看其他学生。" />}
        </section>
      </ManagementTableLayout>
    );
  };

  const renderExemptions = () => {
    const searchTerm = exemptionSearch.trim().toLocaleLowerCase();
    const statusCount = (status: ExemptionStatus) => exemptions.filter((item) => item.status === status).length;
    const visible = exemptions.filter((item) => {
      const student = students.find((candidate) => candidate.id === item.studentId);
      return (exemptionFilter === "all" || item.status === exemptionFilter)
        && (exemptionKind === "all" || item.kind === exemptionKind)
        && (courseFilter === "all" || item.courseId === Number(courseFilter))
        && (!searchTerm || [student?.name ?? "", student?.number ?? "", item.reason, item.organization ?? ""].some((value) => value.toLocaleLowerCase().includes(searchTerm)));
    });
    return (
      <ReviewWorkbenchLayout
        key="exemptions"
        summary={<PageSummaryMetrics ariaLabel="免测与组织认证核心统计" items={[
          { label: statusLabel("pending", "exemption"), value: statusCount("pending") },
          { label: statusLabel("supplement_required", "exemption"), value: statusCount("supplement_required"), tone: statusCount("supplement_required") ? "attention" : "default" },
        ]} />}
        tabs={<StatusFilterTabs
          ariaLabel="认证申请状态筛选"
          value={exemptionFilter}
          onChange={setExemptionFilter}
          options={[
            { value: "all", label: "全部申请", count: exemptions.length },
            { value: "pending", label: statusLabel("pending", "exemption"), count: statusCount("pending") },
            { value: "supplement_required", label: statusLabel("supplement_required", "exemption"), count: statusCount("supplement_required") },
            { value: "approved", label: statusLabel("approved", "exemption"), count: statusCount("approved") },
            { value: "rejected", label: statusLabel("rejected", "exemption"), count: statusCount("rejected") },
          ]}
        />}
        toolbar={<FilterToolbar ariaLabel="认证申请筛选工具栏">
          <label className="filter-search"><span aria-hidden="true">⌕</span><input value={exemptionSearch} onChange={(event) => setExemptionSearch(event.target.value)} placeholder="搜索学生、学号或申请说明" aria-label="搜索认证申请" /></label>
          <AppSelect
            className="filter-select"
            label="申请类型"
            value={exemptionKind}
            options={[
              { value: "all", label: "全部类型" },
              { value: "耐力跑免测", label: "耐力跑免测" },
              { value: "校队认证", label: "校队认证" },
              { value: "社团认证", label: "社团认证" },
            ]}
            onChange={(nextValue) => nextValue !== null && setExemptionKind(nextValue as typeof exemptionKind)}
          />
          <AppSelect
            className="filter-select"
            label="课程"
            value={courseFilter}
            options={[
              { value: "all", label: "全部课程" },
              ...teacherCourses.map((course) => ({ value: String(course.id), label: courseLabel(course) })),
            ]}
            onChange={(nextValue) => nextValue !== null && setCourseFilter(String(nextValue))}
          />
        </FilterToolbar>}
      >
        <section className="table-surface" aria-label="免测与组织认证申请列表">
          <div className="table-result-line"><span>显示 {visible.length} 条申请</span><span>共 {exemptions.length} 条申请</span></div>
          <DataTable className="exemption-table" minWidth={980}>
            <thead><tr><th>学生</th><th>申请类型</th><th>申请说明</th><th>材料</th><th>提交时间</th><th className="action-column">操作</th></tr></thead>
            <tbody>{visible.map((item) => {
              const student = students.find((candidate) => candidate.id === item.studentId);
              return <tr key={item.id}>
                <td>{student && studentIdentity(student, [
                  {
                    label: item.status === "pending" ? "开始审核" : "查看审核详情",
                    tone: item.status === "pending" ? "primary" : "default",
                    onSelect: () => openDialog({ type: "exemption", exemptionId: item.id }, { decision: item.status === "pending" ? "approve" : "supplement" }),
                  },
                ])}</td>
                <td><Badge tone={item.kind === "耐力跑免测" ? "orange" : "blue"}>{item.kind}</Badge></td>
                <td><b className="truncate-text application-reason" title={item.reason}>{item.organization ?? item.reason}</b>{item.organization && <small className="table-sub truncate-text" title={item.reason}>{item.reason}</small>}</td>
                <td><div className="material-stack" aria-label={`${item.material.length} 份材料`}>
                  {item.material.slice(0, 2).map((file, index) => <button className={`material-thumb material-thumb-${index + 1}`} title={`预览 ${file}`} type="button" key={file} onClick={() => openMaterialPreview(file, student?.name ?? "该学生", item.kind)}><span>{materialTypeLabel(file)}</span></button>)}
                  {item.material.length > 2 && <span className="material-more">+{item.material.length - 2}</span>}
                  <small>{item.material.length} 份</small>
                </div></td>
                <td><b className="tabular-number">{item.submittedAt}</b></td>
                <td className="action-column">{item.status === "approved" && item.kind !== "耐力跑免测" && (item.courseOffset || item.otherOffset)
                  ? <TableActionMenu label="更多"><TableActionMenuItem icon={<Eye />} onClick={() => openDialog({ type: "exemption", exemptionId: item.id }, { decision: "supplement" })}>查看详情</TableActionMenuItem><TableActionMenuItem icon={<Undo2 />} tone="danger" dividerBefore onClick={() => revokeOffset(item.id)}>撤销抵扣</TableActionMenuItem></TableActionMenu>
                  : <button className="row-primary-action" type="button" onClick={() => openDialog({ type: "exemption", exemptionId: item.id }, { decision: item.status === "pending" ? "approve" : "supplement" })}>{item.status === "pending" ? "开始审核" : "重新处理"}</button>}
                </td>
              </tr>;
            })}</tbody>
          </DataTable>
          {visible.length === 0 && <EmptyState title="当前分类没有申请" description="新的申请或学生补充材料后会自动出现在对应列表。" />}
        </section>
      </ReviewWorkbenchLayout>
    );
  };

  const renderPage = (pageKey: string) => (
    pageKey === "courses" ? renderCourses() :
      pageKey === "roster" ? renderRoster() :
        pageKey === "checkins" ? renderCheckins() :
          pageKey === "grades" ? renderGrades() :
            pageKey === "exemptions" ? renderExemptions() :
              renderCourses()
  );

  return (
    <>
      <TabPageTransition activeKey={active} direction={direction} renderPage={renderPage} />

      {dialog?.type === "course-new" && <Dialog title="新建教学班" description="教师只能在当前学期创建课程，创建后自动成为授课教师。" close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="primary-button" type="button" onClick={addCourse}>创建教学班</button></>}>
        <div className="form-grid two-columns"><Field label="学期"><input value={semesterCurrent} disabled /></Field><Field label="授课教师"><input value="陈若宁 · T2024007" disabled /></Field><Field label="课程代码" required><input value={form.code ?? ""} onChange={(event) => updateForm("code", event.target.value)} placeholder="如 PE101" /></Field><Field label="教学班号" required><input value={form.section ?? ""} onChange={(event) => updateForm("section", event.target.value)} placeholder="如 04班" /></Field><Field label="课程名称" required><input value={form.name ?? ""} onChange={(event) => updateForm("name", event.target.value)} placeholder="如 大学体育（一）" /></Field></div><FormError message={formError} />
      </Dialog>}

      {dialog?.type === "course-manage" && selectedCourse && <Dialog
        wide
        className="course-target-dialog"
        eyebrow=""
        title="课程设置"
        headerContent={(
          <div className="course-target-identity">
            <span>当前课程</span>
            <strong>{selectedCourse.name}</strong>
            <small>{`${selectedCourse.code} · ${selectedCourse.section}`}</small>
            <small>{selectedCourse.semester}</small>
          </div>
        )}
        description={<><span>调整当前课程的学时目标和打卡时间窗。</span><span>保存后仅影响本教学班，不影响其他课程。</span></>}
        close={closeDialog}
        footer={<><button className="secondary-button course-target-cancel" type="button" onClick={closeDialog}>取消</button><button className="primary-button course-target-save" type="button" onClick={() => saveCourseSettings(selectedCourse.id)}>保存设置</button></>}
      >
        <section className="course-target-section" aria-labelledby="course-target-overview-title">
          <div className="course-target-section-head">
            <div>
              <h3 id="course-target-overview-title">课程概览</h3>
              <p>快速确认当前课程状态与已保存目标。</p>
            </div>
          </div>
          <div className="course-target-stat-grid" aria-label="课程目标概览">
            <CourseTargetStatCard icon="人" label="在班学生" value={selectedCourseSummary?.studentCount ?? 0} />
            <CourseTargetStatCard icon="◎" label="待审核记录" value={selectedCourseSummary?.pendingAuditRecordCount ?? 0} tone="orange" />
            <CourseTargetStatCard icon="◉" label="当前目标" value={`${selectedCourse.courseTarget + selectedCourse.otherTarget}h`} tone="green" />
            <CourseTargetStatCard icon="▦" label="当前学期" value={selectedCourse.semester} tone="gray" compact />
          </div>
        </section>

        <div className="course-target-divider" role="separator" />

        <section className="course-target-section course-target-config" aria-labelledby="course-target-config-title">
          <div className="course-target-section-head">
            <div>
              <h3 id="course-target-config-title">目标配置</h3>
              <p>修改学生在本课程中需要完成的两类最低学时。</p>
            </div>
          </div>
          <div className="course-target-setting-list">
            <div className="course-target-setting">
              <label htmlFor="course-target-course-hours">课程相关运动最低学时</label>
              <div className="course-target-unit-input">
                <input id="course-target-course-hours" type="number" min="0" value={form.courseTarget ?? selectedCourse.courseTarget} onChange={(event) => updateForm("courseTarget", event.target.value)} aria-describedby="course-target-course-help" />
                <span>小时</span>
              </div>
              <p id="course-target-course-help">{`学生至少需要完成 ${form.courseTarget ?? selectedCourse.courseTarget} 小时课程相关运动。`}</p>
            </div>
            <div className="course-target-setting">
              <label htmlFor="course-target-other-hours">自主运动最低学时</label>
              <div className="course-target-unit-input">
                <input id="course-target-other-hours" type="number" min="0" value={form.otherTarget ?? selectedCourse.otherTarget} onChange={(event) => updateForm("otherTarget", event.target.value)} aria-describedby="course-target-other-help" />
                <span>小时</span>
              </div>
              <p id="course-target-other-help">{`学生至少需要完成 ${form.otherTarget ?? selectedCourse.otherTarget} 小时自主运动。`}</p>
            </div>
          </div>
          <FormError message={formError} />
        </section>

        <div className="course-target-divider" role="separator" />

        <section className="course-target-section course-target-config" aria-labelledby="course-window-config-title">
          <div className="course-target-section-head">
            <div>
              <h3 id="course-window-config-title">打卡时间窗</h3>
              <p>由本教学班授课教师设置；学生仅能在本课程规定的时间窗内提交打卡。</p>
            </div>
          </div>
          <div className="form-grid two-columns">
            <AppSelect label="打卡状态" value={form.windowMode ?? selectedCourse.checkinWindow.windowMode} options={[{ value: "available", label: "允许打卡" }, { value: "unavailable", label: "暂停全部打卡" }]} onChange={(value) => updateForm("windowMode", String(value ?? "available"))} />
            <Field label="学期截止日期" required hint="此日期后不能开始或补交新的打卡记录。"><input type="date" value={form.semesterDeadline ?? selectedCourse.checkinWindow.semesterDeadline} onChange={(event) => updateForm("semesterDeadline", event.target.value)} /></Field>
            <Field label="打卡开始日期" required><input type="date" value={form.dateRangeStart ?? selectedCourse.checkinWindow.dateRangeStart} onChange={(event) => updateForm("dateRangeStart", event.target.value)} /></Field>
            <Field label="打卡结束日期" required><input type="date" value={form.dateRangeEnd ?? selectedCourse.checkinWindow.dateRangeEnd} onChange={(event) => updateForm("dateRangeEnd", event.target.value)} /></Field>
            <Field label="每日开始时间" required><input type="time" value={form.dailyStartTime ?? selectedCourse.checkinWindow.dailyStartTime} onChange={(event) => updateForm("dailyStartTime", event.target.value)} /></Field>
            <Field label="每日结束时间" required><input type="time" value={form.dailyEndTime ?? selectedCourse.checkinWindow.dailyEndTime} onChange={(event) => updateForm("dailyEndTime", event.target.value)} /></Field>
            <Field className="full-width" label="排除日期" hint="选填；每行一条，格式为 YYYY-MM-DD, 原因。"><textarea rows={4} value={form.excludedDates ?? selectedCourse.checkinWindow.excludedDates.map((item) => `${item.date}, ${item.reason}`).join("\n")} onChange={(event) => updateForm("excludedDates", event.target.value)} placeholder={"2026-05-01, 劳动节假期\n2026-06-19, 期末考试安排"} /></Field>
          </div>
          <FormError message={formError} />
        </section>
      </Dialog>}

      {dialog?.type === "invite" && selectedCourse && (() => {
        const invite = selectedCourse.invite;
        const inviteStatus = invite ? getInviteStatus(invite, inviteClock) : "invalid";
        const isActiveInvite = inviteStatus === "active";
        const statusTone = inviteStatus === "active" ? "green" : inviteStatus === "expired" ? "orange" : "red";
        return <Dialog
          wide
          className="course-invite-dialog"
          title={`${courseLabel(selectedCourse)} · 课程邀请`}
          description={isActiveInvite ? "将二维码投影给学生端扫码，或复制邀请码在学生端手动输入。学生确认资料且服务端校验成功后会立即成为课程成员。" : "邀请码失效后不能再用于加入课程。生成新邀请码会重新开始 7 天有效期。"}
          close={closeDialog}
          footer={<>
            <button className="secondary-button" type="button" onClick={closeDialog}>关闭</button>
            {isActiveInvite && invite && <>
              <button className="danger-button" type="button" onClick={() => openDialog({ type: "invite-revoke", courseId: selectedCourse.id })}>撤销邀请码</button>
            </>}
            {!isActiveInvite && <button className="primary-button" type="button" onClick={() => generateInvite(selectedCourse.id)}><QrCode size={15} aria-hidden="true" />生成新邀请码</button>}
          </>}
        >
          {isActiveInvite && invite ? <div className="course-invite-print-sheet" ref={invitePresentationRef}>
            <div className="course-invite-overview">
              <div>
                <span className="course-invite-eyebrow">课程加入邀请码</span>
                <h3>{selectedCourse.name}</h3>
                <p>{selectedCourse.code} · {selectedCourse.section} · {selectedCourse.semester}</p>
              </div>
              <Badge tone={statusTone}>{inviteStatusLabel(inviteStatus)}</Badge>
            </div>
            <div className="course-invite-content">
              <InviteQrCode code={invite.code} alt={`${selectedCourse.name} ${selectedCourse.section} 的课程邀请二维码`} onReady={handleInviteQrReady} />
              <div className="course-invite-details">
                <p className="course-invite-instruction">请使用学生端扫描二维码；无法扫码时，可在学生端手动输入邀请码。</p>
                <div className="course-invite-code-row"><span>邀请码</span><strong>{invite.code}</strong><button className="icon-button" type="button" aria-label="复制邀请码" onClick={() => void copyInviteCode(invite)}><Copy size={17} aria-hidden="true" /></button></div>
                <div className="course-invite-expiry"><span>有效期至（北京时间）</span><strong>{formatInviteExpiry(invite.expiresAt)}</strong><small>{formatInviteRemaining(invite.expiresAt, inviteClock)}</small></div>
                <div className="course-invite-actions">
                  <button className="secondary-button" type="button" onClick={presentInviteQr}><Maximize2 size={16} aria-hidden="true" />全屏投影</button>
                  <button className="secondary-button" type="button" onClick={() => downloadInviteQr(selectedCourse, invite)}><Download size={16} aria-hidden="true" />下载</button>
                  <button className="secondary-button" type="button" onClick={() => window.print()}><Printer size={16} aria-hidden="true" />打印</button>
                </div>
              </div>
            </div>
            <p className="course-invite-note">二维码仅用于定位课程并携带短期加入凭证；学生资料校验成功后直接加入，无需教师审批。已加入成员会立即出现在学生名单中。</p>
          </div> : <section className="course-invite-inactive">
            <span><CircleAlert size={23} aria-hidden="true" /></span>
            <div><h3>{invite ? `邀请码${inviteStatusLabel(inviteStatus)}` : "尚未生成邀请码"}</h3><p>{invite ? "此前展示的二维码已失效。请生成新邀请码后再让学生扫码。" : "生成后可投影二维码、下载或打印，也可将邀请码发送给学生。"}</p></div>
          </section>}
        </Dialog>;
      })()}

      {dialog?.type === "invite-revoke" && selectedCourse && <Dialog
        title="撤销课程邀请码"
        description="撤销后，当前二维码和邀请码将立即失效，学生无法再凭此码加入课程。此操作不会影响已经建立的课程成员关系。"
        close={closeDialog}
        footer={<><button className="secondary-button" type="button" onClick={() => openDialog({ type: "invite", courseId: selectedCourse.id })}>返回</button><button className="danger-button" type="button" onClick={() => revokeInvite(selectedCourse.id)}>确认撤销</button></>}
      >
        <section className="course-invite-revoke-summary"><QrCode size={21} aria-hidden="true" /><div><strong>{courseLabel(selectedCourse)}</strong><span>{selectedCourse.invite?.code ?? "尚未生成邀请码"}</span></div></section>
      </Dialog>}

      {(dialog?.type === "student-action" || dialog?.type === "supplement") && (() => {
        const action = dialog.type === "supplement" ? "supplement" : dialog.action;
        const student = dialog.type === "supplement" ? students.find((item) => item.id === Number(form.studentId)) : selectedStudent;
        const course = student ? courses.find((item) => item.id === student.courseId) : undefined;
        const waiverType = form.creditType ?? "课程相关";
        const manualWaiver = student ? waiverType === "课程相关" ? student.courseWaiverHours ?? 0 : student.otherWaiverHours ?? 0 : 0;
        const approvedOffset = student ? exemptions.filter((item) => item.studentId === student.id && item.status === "approved").reduce((total, item) => total + (waiverType === "课程相关" ? item.courseOffset ?? 0 : item.otherOffset ?? 0), 0) : 0;
        const waiverTarget = waiverType === "课程相关" ? course?.courseTarget ?? 0 : course?.otherTarget ?? 0;
        const availableWaiverHours = Math.max(0, waiverTarget - manualWaiver - approvedOffset);
        const actionTitle = action === "remove" ? "移出课程" : action === "waiver" ? "减免运动时长" : "补录学生学时";
        const actionDescription = action === "remove" ? "确认后该成员关系变为“已移出课程”；旧打卡和成绩保留为历史只读。" : action === "waiver" ? "减免只降低该学生对应类别的完成目标，不修改已有打卡记录。" : "教师补录不占用学生每日一次/2h额度，并立即计入统计。";
        return <Dialog title={actionTitle} description={actionDescription} close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className={action === "remove" ? "danger-button" : "primary-button"} type="button" onClick={() => student && runStudentAction(student.id, action)}>{action === "remove" ? "确认移出课程" : "确认操作"}</button></>}>
          <div className="form-grid">
            {dialog.type === "supplement" && (
              <AppSelect
                label="学生"
                required
                searchable
                value={form.studentId ?? ""}
                options={[
                  { value: "", label: "请选择" },
                  ...students
                    .filter((item) => item.status === "active")
                    .map((item) => ({
                      value: String(item.id),
                      label: `${item.name} · ${item.number} · ${courseLabel(courses.find((course) => course.id === item.courseId))}`,
                      keywords: [item.name, item.number],
                    })),
                ]}
                onChange={(nextValue) => updateForm("studentId", String(nextValue ?? ""))}
              />
            )}
            {student && <div className="detail-card">{studentIdentity(student)}<p>{courseLabel(course)}</p></div>}
            {action === "supplement" && (
              <div className="form-grid two-columns">
                <AppSelect
                  label="学时类别"
                  required
                  value={form.creditType ?? "课程相关"}
                  options={[
                    { value: "课程相关", label: "课程相关" },
                    { value: "其他运动", label: "其他运动" },
                  ]}
                  onChange={(nextValue) => updateForm("creditType", String(nextValue ?? ""))}
                />
                <AppSelect
                  label="补录时长"
                  required
                  value={form.hours ?? "1"}
                  options={[
                    { value: "1", label: "1 小时" },
                    { value: "2", label: "2 小时" },
                  ]}
                  onChange={(nextValue) => updateForm("hours", String(nextValue ?? ""))}
                />
                <Field label="运动项目" required><input value={form.sport ?? ""} onChange={(event) => updateForm("sport", event.target.value)} placeholder="如 校园跑、课堂活动" /></Field>
                <Field label="教师凭证（可选）"><input value={form.proof ?? ""} onChange={(event) => updateForm("proof", event.target.value)} placeholder="凭证文件名" /></Field>
              </div>
            )}
            {action === "waiver" && (
              <div className="form-grid two-columns">
                <AppSelect
                  label="减免类别"
                  required
                  value={waiverType}
                  options={[
                    { value: "课程相关", label: "课程相关" },
                    { value: "其他运动", label: "其他运动" },
                  ]}
                  onChange={(nextValue) => updateForm("creditType", String(nextValue ?? ""))}
                />
                <Field label="减免时长" required hint={`该类别还可减免 ${availableWaiverHours.toFixed(1)} 小时`}><input type="number" min="0.1" max={availableWaiverHours} step="0.1" value={form.hours ?? ""} onChange={(event) => updateForm("hours", event.target.value)} /></Field>
                <p className="field-note">减免后，学生端将按新的目标计算剩余学时；原有打卡记录和已获得学时保持不变。</p>
              </div>
            )}
            <Field label={action === "supplement" ? "补录原因" : action === "waiver" ? "减免原因" : "移出课程原因"} required><textarea value={form.reason ?? ""} onChange={(event) => updateForm("reason", event.target.value)} /></Field>
          </div><FormError message={formError} />
        </Dialog>;
      })()}

      {dialog?.type === "checkin-invalid" && selectedInvalidRecord && (
        <Dialog
          className="checkin-invalid-dialog"
          eyebrow="前端审核原型"
          title={`将“${selectedInvalidRecord.sport}”标记为无效`}
          description="请选择最符合本条记录的原因。取消不会改变当前审核状态。"
          close={closeDialog}
          footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="danger-button" type="button" onClick={() => confirmInvalidAttendance(selectedInvalidRecord.id)}>确认标记无效</button></>}
        >
          <div className="invalid-reason-list" role="radiogroup" aria-label="无效原因">
            {invalidAttendanceReasons.map((reason) => (
              <button
                type="button"
                role="radio"
                aria-checked={form.invalidReason === reason}
                className={form.invalidReason === reason ? "selected" : ""}
                key={reason}
                onClick={() => updateForm("invalidReason", reason)}
              >
                <span aria-hidden="true" />{reason}
              </button>
            ))}
          </div>
          {form.invalidReason === "其他" && (
            <Field label="其他原因备注" required hint="备注仅保存在当前页面状态中">
              <textarea autoFocus maxLength={240} value={form.auditRemark ?? ""} onChange={(event) => updateForm("auditRemark", event.target.value)} placeholder="请简要说明无效原因" />
            </Field>
          )}
          <FormError message={formError} />
        </Dialog>
      )}

      {dialog?.type === "checkin-complete" && selectedStudent && selectedCompletionSummary && (
        <Dialog
          className="checkin-complete-dialog"
          eyebrow="完成前确认"
          title={`完成 ${selectedStudent.name} 的打卡审核`}
          description="确认后仅在当前前端页面标记为“审核已完成”，不会发送接口请求。"
          close={closeDialog}
          footer={<><button className="secondary-button" type="button" onClick={closeDialog}>返回检查</button><button className="primary-button" type="button" onClick={() => confirmCheckinAuditCompletion(selectedStudent.id)}>确认完成审核</button></>}
        >
          <div className="complete-audit-summary-list">
            <span><small>有效记录</small><b>{selectedCompletionSummary.validCount} 条</b></span>
            <span><small>无效记录</small><b>{selectedCompletionSummary.invalidCount} 条</b></span>
            <span><small>有效时长</small><b>{attendanceHoursLabel(selectedCompletionSummary.validMinutes)} / {attendanceHoursLabel(selectedCompletionRequiredMinutes)} 小时</b></span>
            <span><small>目标完成</small><b>{selectedCompletionSummary.hasReachedTarget ? "已达到教师设置目标" : `还差 ${attendanceHoursLabel(selectedCompletionSummary.remainingMinutes)} 小时`}</b></span>
          </div>
        </Dialog>
      )}

      {dialog?.type === "checkin" && selectedRecord && (() => {
        const student = students.find((item) => item.id === selectedRecord.studentId);
        return <Dialog drawer wide title={`${student?.name} · ${selectedRecord.sport}打卡详情`} description="查看本次打卡的完整数据和运动凭证；此处调整也只保存在当前前端页面。" close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="primary-button" type="button" onClick={() => saveCheckinReview(selectedRecord.id)}>保存前端调整</button></>}>
          <div className="record-detail-grid"><div className="detail-card">{student ? studentIdentity(student) : <strong>未知学生</strong>}<dl><div><dt>打卡开始时间</dt><dd>{selectedRecord.startAt}</dd></div><div><dt>打卡结束时间</dt><dd>{selectedRecord.endAt}</dd></div><div><dt>实际运动时间</dt><dd>{actualDurationLabel(selectedRecord)}</dd></div><div><dt>可计入时长</dt><dd>{attendanceHoursLabel(selectedRecord.creditedMinutes)}h（实际 {attendanceHoursLabel(selectedRecord.durationMinutes)}h）</dd></div><div><dt>运动说明</dt><dd>{selectedRecord.description}</dd></div><div><dt>系统辅助</dt><dd>{selectedRecord.risk} · 置信度 {Math.round(selectedRecord.confidence * 100)}%</dd></div><div><dt>位置</dt><dd>{selectedRecord.locationExpired ? "定位数据已过期，地图不可查看" : "已提供脱敏地图与运动区域概览"}</dd></div></dl></div><CheckinEvidenceReviewer record={selectedRecord} activeProofIndex={activeCheckinProofIndex} imageZoom={checkinImageZoom} videoPlaying={checkinVideoPlaying} onProofChange={(index) => { setActiveCheckinProofIndex(index); setCheckinImageZoom(1); setCheckinVideoPlaying(false); }} onImageZoomChange={setCheckinImageZoom} onVideoPlayingChange={setCheckinVideoPlaying} onDownload={downloadCheckinProof} /></div>
          <div className="form-grid two-columns">
            <AppSelect
              label="计入学时"
              required
              value={form.approvedHours ?? String(selectedRecord.approvedHours)}
              options={[
                { value: "0", label: "0 小时（作废）" },
                { value: "1", label: "1 小时" },
                { value: "2", label: "2 小时" },
              ]}
              onChange={(nextValue) => updateForm("approvedHours", String(nextValue ?? ""))}
            />
            <Field label="审核说明（前端备注）" required><textarea value={form.reviewComment ?? ""} onChange={(event) => updateForm("reviewComment", event.target.value)} /></Field>
            <Field label="教师内部备注" hint="仅教师可见"><textarea value={form.internalNote ?? ""} onChange={(event) => updateForm("internalNote", event.target.value)} /></Field>
          </div><FormError message={formError} />
        </Dialog>;
      })()}

      {dialog?.type === "grade" && selectedGrade && (() => {
        const student = students.find((item) => item.id === selectedGrade.studentId);
        const distance = selectedGrade.gender === "男" ? "1000m" : "800m";
        const previewScore = form.enduranceStatus === "Recorded" && form.minutes !== "" && form.seconds !== "" ? scoreEndurance(Number(form.minutes) * 60 + Number(form.seconds), selectedGrade.gender === "男" ? 1000 : 800, selectedGrade.gradeGroup === "大三/大四") : undefined;
        return <Dialog title={`${student?.name} · 成绩录入`} description={`系统已按性别默认 ${distance}，用时将依据“${selectedGrade.gradeGroup}”换算表自动生成分数。`} close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="primary-button" type="button" onClick={() => saveGrade(selectedGrade.id)}>保存成绩</button></>}>
          <div className="detail-card">{student ? studentIdentity(student) : <strong>未知学生</strong>}<p>{selectedGrade.gender} · {selectedGrade.gradeGroup} · {distance}</p>{selectedGrade.published && <aside className="inline-warning">该成绩已发布；保存修改后会立即更新学生端、发送强制通知并记录审计来源。</aside>}</div>
          <div className="form-grid">
            <AppSelect
              label="耐力跑状态"
              required
              value={form.enduranceStatus ?? "NotRecorded"}
              disabled={selectedGrade.enduranceStatus === "Exempt"}
              options={[
                { value: "NotRecorded", label: statusLabel("NotRecorded", "grade") },
                { value: "Recorded", label: "录入用时" },
                { value: "Absent", label: "标记缺考" },
                ...(selectedGrade.enduranceStatus === "Exempt" ? [{ value: "Exempt", label: statusLabel("Exempt", "grade") }] : []),
              ]}
              onChange={(nextValue) => updateForm("enduranceStatus", String(nextValue ?? ""))}
            />
            {form.enduranceStatus === "Recorded" && <div className="form-grid two-columns"><Field label="分钟" required><input type="number" min="0" value={form.minutes ?? ""} onChange={(event) => updateForm("minutes", event.target.value)} /></Field><Field label="秒" required><input type="number" min="0" max="59" value={form.seconds ?? ""} onChange={(event) => updateForm("seconds", event.target.value)} /></Field>{previewScore !== undefined && <div className="score-preview"><span>自动换算</span><b>{previewScore} 分</b></div>}</div>}
            {form.enduranceStatus === "Absent" && <Field label="缺考原因" required><textarea value={form.reason ?? ""} onChange={(event) => updateForm("reason", event.target.value)} /></Field>}
          </div><FormError message={formError} />
        </Dialog>;
      })()}

      {dialog?.type === "publish-grades" && selectedCourse && <Dialog title={`发布 ${courseLabel(selectedCourse)} 成绩`} description="发布后，全班学生将在成绩页查看耐力跑分数/状态和打卡学时完成情况。" close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="primary-button" type="button" onClick={() => publishGrades(selectedCourse.id)}>确认发布</button></>}>
        <aside className="grade-publication-notice">发布将立即同步学生端并发送不可关闭的成绩通知；之后如修改耐力跑成绩，学生端会同步更新。</aside>
      </Dialog>}

      {dialog?.type === "exemption" && selectedExemption && (() => {
        const student = students.find((item) => item.id === selectedExemption.studentId);
        return <Dialog drawer wide title={`审核 ${student?.name} 的${selectedExemption.kind}`} description="审核意见会展示给学生；社团负责人不参与系统审核。" close={closeDialog} footer={<><button className="secondary-button" type="button" onClick={closeDialog}>取消</button><button className="primary-button" type="button" onClick={() => reviewExemption(selectedExemption.id)}>确认审核</button></>}>
          <div className="detail-card">{student ? studentIdentity(student) : <strong>未知学生</strong>}<p>{selectedExemption.organization ?? selectedExemption.reason}</p><p>{selectedExemption.reason}</p><EvidenceMaterials files={selectedExemption.material} onPreview={(file) => openMaterialPreview(file, student?.name ?? "该学生", selectedExemption.kind)} /></div>
          <div className="form-grid">
            <AppSelect
              label="审核结果"
              required
              value={form.decision ?? ""}
              options={[
                { value: "", label: "请选择" },
                { value: "approve", label: "通过" },
                { value: "reject", label: "驳回" },
                { value: "supplement", label: "要求补材料" },
              ]}
              onChange={(nextValue) => updateForm("decision", String(nextValue ?? ""))}
            />
            {form.decision === "approve" && selectedExemption.kind === "耐力跑免测" && <Field label="免测分数" required hint="根据实际情况自定义，不固定为 100 分"><input type="number" min="0" max="100" value={form.score ?? ""} onChange={(event) => updateForm("score", event.target.value)} /></Field>}
            {form.decision === "approve" && selectedExemption.kind !== "耐力跑免测" && <div className="form-grid two-columns"><Field label="课程运动抵扣" required><input type="number" min="0" max="20" value={form.courseOffset ?? "0"} onChange={(event) => updateForm("courseOffset", event.target.value)} /></Field><Field label="其他运动抵扣" required><input type="number" min="0" max="20" value={form.otherOffset ?? "0"} onChange={(event) => updateForm("otherOffset", event.target.value)} /></Field><p className="field-note">两类合计不得超过 20 小时；学生端按抵扣后的目标计算剩余学时。</p></div>}
            <Field label="审核意见" required><textarea value={form.comment ?? ""} onChange={(event) => updateForm("comment", event.target.value)} placeholder={form.decision === "supplement" ? "请明确需要补充的材料" : "请说明审核依据和处理结果"} /></Field>
          </div><FormError message={formError} />
        </Dialog>;
      })()}

      {materialPreview && (() => {
        const image = isImageMaterial(materialPreview.file);
        return <Dialog wide title={`预览 ${materialPreview.file}`} description={`${materialPreview.studentName} 提交的${materialPreview.applicationKind}证明材料，仅限本次审核使用。`} close={() => setMaterialPreview(null)} footer={<button className="primary-button" type="button" onClick={() => setMaterialPreview(null)}>关闭预览</button>}>
          <div className="evidence-preview-layout">
            <div className={`evidence-preview-canvas ${image ? "evidence-preview-image" : "evidence-preview-document"}`}>
              <span className="evidence-preview-type">{materialTypeLabel(materialPreview.file)}</span>
              <div className="evidence-preview-sheet"><b>{image ? "学生上传图片" : "学生上传文件"}</b><span>{image ? "证明材料预览" : "证明材料 · 第 1 页"}</span><i /><i /><i /></div>
              <small>只读预览</small>
            </div>
            <aside className="evidence-preview-info"><span>文件信息</span><dl><div><dt>文件名</dt><dd>{materialPreview.file}</dd></div><div><dt>材料类别</dt><dd>{materialPreview.applicationKind}</dd></div><div><dt>提交人</dt><dd>{materialPreview.studentName}</dd></div><div><dt>查看权限</dt><dd>教师审核只读</dd></div></dl></aside>
          </div>
        </Dialog>;
      })()}

    </>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><span>✓</span><strong>{title}</strong><p>{description}</p></div>;
}

function FormError({ message }: { message: string }) {
  return message ? <p className="form-error teacher-form-error" role="alert">{message}</p> : null;
}
