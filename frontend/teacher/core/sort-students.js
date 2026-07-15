/**
 * 学生名单统一排序 — 成绩汇总 / 复制 TSV / CSV 共用。
 */
(function (global) {
  if (!global.TeacherUiState) {
    global.TeacherUiState = { rosterSort: "import" };
  }

  const SORT_OPTIONS = [
    { value: "import", label: "导入顺序" },
    { value: "studentId", label: "学号" },
    { value: "name", label: "姓名" },
  ];

  function studentIdOf(row) {
    return String(row.studentId ?? row.no ?? row.id ?? "");
  }

  function nameOf(row) {
    return String(row.name ?? row.studentName ?? "");
  }

  function importIndexOf(row, fallback) {
    if (row.importIndex != null && Number.isFinite(Number(row.importIndex))) {
      return Number(row.importIndex);
    }
    return fallback;
  }

  /**
   * @param {Array<object>} rows
   * @param {"import"|"studentId"|"name"} [mode]
   * @returns {Array<object>} 新数组，不改动入参
   */
  function sortStudents(rows, mode) {
    const sortMode = mode || global.TeacherUiState.rosterSort || "import";
    const list = (rows || []).map((row, i) => ({ row, i }));

    list.sort((a, b) => {
      if (sortMode === "studentId") {
        const cmp = studentIdOf(a.row).localeCompare(studentIdOf(b.row), "en");
        return cmp !== 0 ? cmp : a.i - b.i;
      }
      if (sortMode === "name") {
        const cmp = nameOf(a.row).localeCompare(nameOf(b.row), "zh-CN");
        return cmp !== 0 ? cmp : a.i - b.i;
      }
      // import
      const ai = importIndexOf(a.row, a.i);
      const bi = importIndexOf(b.row, b.i);
      if (ai !== bi) return ai - bi;
      return a.i - b.i;
    });

    return list.map((x) => x.row);
  }

  function setRosterSort(mode) {
    if (SORT_OPTIONS.some((o) => o.value === mode)) {
      global.TeacherUiState.rosterSort = mode;
    }
  }

  function getRosterSort() {
    return global.TeacherUiState.rosterSort || "import";
  }

  function sortLabel(mode) {
    const m = mode || getRosterSort();
    return SORT_OPTIONS.find((o) => o.value === m)?.label || m;
  }

  global.SortStudents = {
    SORT_OPTIONS,
    sortStudents,
    setRosterSort,
    getRosterSort,
    sortLabel,
    studentIdOf,
    nameOf,
  };
})(window);
