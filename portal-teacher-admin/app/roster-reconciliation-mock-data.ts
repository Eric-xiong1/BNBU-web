import type { OfficialRosterSnapshot, OfficialRosterStudent } from "./roster-reconciliation-types";

const importedAt = "2026-08-01T09:30:00+08:00";

const students: OfficialRosterStudent[] = [
  { id: "official-1", courseId: "1", studentNumber: "2024110261", name: "赵可心", gender: "女", grade: "2024级", major: "传播学", administrativeClass: "传播2401", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 2 },
  { id: "official-2", courseId: "1", studentNumber: "2024110618", name: "陈昊然", gender: "男", grade: "2024级", major: "计算机科学", administrativeClass: "计科2402", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 3 },
  { id: "official-3", courseId: "1", studentNumber: "2024110335", name: "何雨彤", gender: "女", grade: "2025级", major: "应用经济学", administrativeClass: "经管2401", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 4 },
  { id: "official-4", courseId: "1", studentNumber: "2024110772", name: "许嘉宁", gender: "男", grade: "2024级", major: "数据科学", administrativeClass: "数科2401", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 5 },
  { id: "official-5", courseId: "1", studentNumber: "0000240188", name: "周子墨", gender: "男", grade: "2024级", major: "会计学", administrativeClass: "会计2401", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 6 },
  { id: "official-6", courseId: "1", studentNumber: "2024110248", name: "李欣然", gender: "女", grade: "2024级", major: "文化创意", administrativeClass: "文创2401", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 7 },
  { id: "official-7", courseId: "1", studentNumber: "2024110999", name: "林乐怡", gender: "女", grade: "2024级", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 8 },
  { id: "official-8", courseId: "1", studentNumber: "2024110999", name: "林乐怡", gender: "女", grade: "2024级", courseName: "大学体育（一）", courseCode: "PE101", teachingClassCode: "01班", sourceRow: 9 },
  { id: "official-9", courseId: "2", studentNumber: "2023110724", name: "郭思远", gender: "男", grade: "2023级", major: "工商管理", administrativeClass: "工商2302", courseName: "羽毛球", courseCode: "PE203", teachingClassCode: "03班", sourceRow: 2 },
  { id: "official-10", courseId: "2", studentNumber: "2024110158", name: "高嘉雯", gender: "女", grade: "2024级", major: "金融数学", administrativeClass: "金数2401", courseName: "羽毛球", courseCode: "PE203", teachingClassCode: "03班", sourceRow: 3 },
  { id: "official-11", courseId: "2", studentNumber: "2024110401", name: "吴雨菲", gender: "女", grade: "2024级", major: "传播学", administrativeClass: "传播2402", courseName: "羽毛球", courseCode: "PE203", teachingClassCode: "03班", sourceRow: 4 },
];

export function createInitialRosterSnapshots(): OfficialRosterSnapshot[] {
  return [
    {
      version: {
        id: "roster-version-1",
        courseId: "1",
        versionNumber: 1,
        fileName: "PE101-01班-官方名单.xlsx",
        importedAt,
        importedBy: "陈若宁",
        totalRows: 8,
        validRows: 8,
        invalidRows: 0,
        isCurrent: true,
        source: "FILE",
      },
      students: students.filter((student) => student.courseId === "1").map((student) => ({ ...student })),
    },
    {
      version: {
        id: "roster-version-2",
        courseId: "2",
        versionNumber: 1,
        fileName: "PE203-03班-官方名单.csv",
        importedAt: "2026-07-31T16:10:00+08:00",
        importedBy: "陈若宁",
        totalRows: 3,
        validRows: 3,
        invalidRows: 0,
        isCurrent: true,
        source: "FILE",
      },
      students: students.filter((student) => student.courseId === "2").map((student) => ({ ...student })),
    },
  ];
}
