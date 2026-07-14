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

export const STATUS_META = {
  "已通过": { tone: "success", label: "已通过" },
  "待审核": { tone: "warning", label: "待审核" },
  "待确认": { tone: "warning", label: "待审核" },
  "已驳回": { tone: "danger", label: "已驳回" },
  "补材料": { tone: "danger", label: "需补材料" },
  "需补材料": { tone: "danger", label: "需补材料" },
};

export const STORAGE_KEY = "bnbuStudentWebV1";
