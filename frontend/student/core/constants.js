export const NAV_ITEMS = [
  { id: "home", label: "首页", route: "home", icon: "home" },
  { id: "courses", label: "课程", route: "courses", icon: "courses" },
  { id: "checkin", label: "打卡", route: "checkin", icon: "checkin" },
  { id: "grades", label: "成绩", route: "grades", icon: "grades" },
  { id: "profile", label: "我的", route: "profile", icon: "profile" },
];

export const GRADE_WEIGHTS = { checkin: 0.25, exam: 0.30, performance: 0.20, physical: 0.25 };
export const uploadLimits = {
  images: 6,
  videos: 1,
  imageBytes: 8 * 1024 * 1024,
  videoBytes: 100 * 1024 * 1024,
};

export const SPORT_TYPES = [
  { value: "", label: "暂不选择" },
  { value: "running", label: "跑步" },
  { value: "basketball", label: "篮球" },
  { value: "football", label: "足球" },
  { value: "badminton", label: "羽毛球" },
  { value: "swimming", label: "游泳" },
  { value: "fitness", label: "健身" },
  { value: "cycling", label: "骑行" },
  { value: "other", label: "其他" },
];

// New model: a submitted service record counts immediately. Only a teacher's
// end-of-term "mark invalid" changes it. Legacy backend statuses map onto these.
export const RECORD_STATUS_META = {
  "有效": { tone: "success", label: "已计入" },
  "无效": { tone: "danger", label: "不计入学时" },
  "已驳回": { tone: "danger", label: "不计入学时" }, // legacy backend value
};

// Anything that is not explicitly invalidated is treated as counted.
export function isCountedStatus(status) {
  return status !== "无效" && status !== "已驳回";
}

// Exercise-session thresholds (ms) and description limit.
export const SESSION = {
  minMs: 60 * 60 * 1000,       // 1h — below this earns 0 and does not count
  fullMs: 2 * 60 * 60 * 1000,  // 2h — auto-end cap
  maxPauseMs: 6 * 60 * 60 * 1000, // paused beyond 6h auto-ends
};

export const DESC_MAX = 200;

export const STORAGE_KEY = "bnbuStudentWebV1";
