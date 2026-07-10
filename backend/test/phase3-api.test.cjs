const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');
const Module = require('node:module');

function createFakeDb() {
  const db = {
    settings: new Map(),
    semesters: [
      { id: 's1', name: '2026 Spring', date_range: '2026.02.24 - 2026.06.28', status: '进行中', locked: '否' },
    ],
    courses: [
      { id: 'gepe', code: 'GEPE101', section: '1004', name: 'General PE', teacher_id: 't1', semester_id: 's1', students: 82, status: '正常' },
    ],
    users: [
      { id: 't1', name: '王老师', email: 'teacher@bnbu.edu.cn', password: 'pw', role: 'teacher', college: '', status: '正常' },
      { id: 'u2', name: 'Admin', email: 'admin@bnbu.edu.cn', password: 'pw', role: 'admin', college: '', status: '正常' },
      { id: '22301142', name: 'Alice', email: 'alice@bnbu.edu.cn', role: 'student', college: 'Science', status: 'normal' },
    ],
    organizations: [
      { id: 'org-1', name: '篮球队', type: 'team', manager_id: null, description: '校篮球队', created_at: '2026-01-01', updated_at: '2026-01-01' },
    ],
    conversionRules: [
      { id: 'cv-1', grade_group: 'freshman_sophomore', gender: 'male', item_name: '1000m', raw_value: "3'17\"", raw_seconds: 197, converted_score: 100.0, version: 1 },
    ],
    auditLogs: [
      { id: 'log1', actor: 'Admin', action: '测试', target: 'test', time: '2026-01-01' },
    ],
    progress: [
      {
        student_id: '22301142',
        course_id: 'gepe',
        course_hours: 10,
        general_hours: 10,
        exam_score: 80,
        attendance_score: 90,
        physical_score: 70,
        status: 'complete',
      },
    ],
    tasks: [],
  };

  function rowToTask(task) {
    const course = db.courses.find((item) => item.id === task.course_id) || {};
    return {
      ...task,
      course_code: course.code,
      course_section: course.section,
      course_name: course.name,
      teacher_id: course.teacher_id,
    };
  }

  const pool = {
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normalized.startsWith('create table if not exists app_settings')) return [[], []];
      if (normalized.startsWith('select setting_value as value from app_settings where')) {
        const value = db.settings.get(params[0]);
        return [value === undefined ? [] : [{ value: JSON.stringify(value) }], []];
      }
      if (normalized.startsWith('insert into app_settings')) {
        db.settings.set(params[0], JSON.parse(params[1]));
        return [{ affectedRows: 1 }, []];
      }

      if (normalized.startsWith('select teacher_id from courses where id = ?')) {
        const course = db.courses.find((item) => item.id === params[0]);
        return [course ? [{ teacher_id: course.teacher_id }] : [], []];
      }
      if (normalized.startsWith('select * from courses where id = ?')) {
        return [db.courses.filter((item) => item.id === params[0]), []];
      }
      if (normalized.includes('from tasks t join courses c') && normalized.includes('where t.course_id = ?')) {
        return [db.tasks.filter((item) => item.course_id === params[0]).map(rowToTask), []];
      }
      if (normalized.includes('from tasks t join courses c') && normalized.includes('where t.id = ?')) {
        return [db.tasks.filter((item) => item.id === params[0]).map(rowToTask), []];
      }
      if (normalized.startsWith('insert into tasks')) {
        const [id, courseId, title, description, creditType, requiredHours, deadline, status] = params;
        db.tasks.push({
          id,
          course_id: courseId,
          title,
          description,
          credit_type: creditType,
          required_hours: requiredHours,
          deadline,
          status,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('update tasks set')) {
        const id = normalized.includes('course_id = ?') ? params.at(-2) : params.at(-1);
        const task = db.tasks.find((item) => item.id === id);
        if (!task) return [{ affectedRows: 0 }, []];
        const updateParams = params.slice(0, normalized.includes('course_id = ?') ? -2 : -1);
        if (normalized.includes('title = ?')) task.title = params.shift();
        if (normalized.includes('description = ?')) task.description = params.shift();
        if (normalized.includes('credit_type = ?')) task.credit_type = params.shift();
        if (normalized.includes('required_hours = ?')) task.required_hours = params.shift();
        if (normalized.includes('deadline = ?')) task.deadline = params.shift();
        if (normalized.includes('status = ?')) task.status = params.shift();
        params.splice(0, params.length, ...updateParams);
        task.updated_at = new Date().toISOString();
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from tasks where')) {
        const original = db.tasks.length;
        db.tasks = db.tasks.filter((item) => item.id !== params[0] || (params[1] && item.course_id !== params[1]));
        return [{ affectedRows: original - db.tasks.length }, []];
      }

      if (normalized.includes('from student_progress sp join users u') && normalized.includes('where sp.course_id = ?')) {
        const rows = db.progress
          .filter((item) => item.course_id === params[0])
          .map((item) => {
            const user = db.users.find((candidate) => candidate.id === item.student_id) || {};
            return {
              studentId: item.student_id,
              studentName: user.name,
              course_hours: item.course_hours,
              general_hours: item.general_hours,
              exam: item.exam_score,
              attendance: item.attendance_score,
              physical: item.physical_score,
            };
          });
        return [rows, []];
      }
      if (normalized.startsWith('select * from student_progress where course_id = ?')) {
        return [db.progress.filter((item) => item.course_id === params[0]), []];
      }
      if (normalized.startsWith('select id from users where id in')) {
        return [db.users.filter((item) => params[0].includes(item.id)).map((item) => ({ id: item.id })), []];
      }
      if (normalized.startsWith('insert into users')) {
        // Two INSERT patterns: (id,name,email,role,college,status) for roster import,
        // and (id,name,email,password,role,college,status) for admin create.
        const id = params[0], name = params[1], email = params[2];
        const role = params.length === 7 ? params[4] : params[3];
        const college = params.length === 7 ? params[5] : params[4];
        const status = params.length === 7 ? params[6] : params[5];
        // Check duplicate email
        if (db.users.some((u) => u.email === email && u.id !== id)) {
          const err = new Error('Duplicate entry');
          err.code = 'ER_DUP_ENTRY';
          throw err;
        }
        const existing = db.users.find((item) => item.id === id);
        if (existing) {
          existing.name = name;
          existing.college = college;
        } else {
          db.users.push({ id, name, email, role, college, status });
        }
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('insert into student_progress')) {
        const [studentId, courseId] = params;
        if (!db.progress.some((item) => item.student_id === studentId && item.course_id === courseId)) {
          db.progress.push({
            student_id: studentId,
            course_id: courseId,
            course_hours: 0,
            general_hours: 0,
            exam_score: 0,
            attendance_score: 0,
            physical_score: 0,
            status: 'incomplete',
          });
        }
        return [{ affectedRows: 1 }, []];
      }

      // ── CRUD: semesters ────────────────────────────────────
      if (normalized.includes('column_name') && normalized.includes('information_schema')) {
        return [[{ COLUMN_NAME: 'locked' }], []]; // pretend locked column exists
      }
      if (normalized.startsWith('select * from semesters where id = ?')) {
        return [db.semesters.filter((item) => item.id === params[0]), []];
      }
      if (normalized.startsWith('select * from semesters')) {
        return [db.semesters, []];
      }
      if (normalized.startsWith('insert into semesters')) {
        const [id, name, dateRange, status, locked] = params;
        db.semesters.push({ id, name, date_range: dateRange, status, locked });
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('update semesters set')) {
        const id = params.pop();
        const item = db.semesters.find((i) => i.id === id);
        if (!item) return [{ affectedRows: 0 }, []];
        // Match params to columns based on SQL text
        const colMap = [
          { col: 'name', key: 'name = ?' },
          { col: 'date_range', key: 'date_range = ?' },
          { col: 'status', key: 'status = ?' },
          { col: 'locked', key: 'locked = ?' },
        ];
        let pi = 0;
        for (const { col, key } of colMap) {
          if (normalized.includes(key)) { item[col] = params[pi]; pi++; }
        }
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from semesters where')) {
        const before = db.semesters.length;
        db.semesters = db.semesters.filter((i) => i.id !== params[0]);
        return [{ affectedRows: before - db.semesters.length }, []];
      }

      // ── CRUD: courses ──────────────────────────────────────
      if (normalized.includes('from courses c left join users u') && normalized.includes('where c.id = ?')) {
        const course = db.courses.find((i) => i.id === params[0]);
        if (!course) return [[], []];
        const teacher = db.users.find((u) => u.id === course.teacher_id);
        return [[{ ...course, teacher: teacher ? teacher.name : '' }], []];
      }
      if (normalized.includes('from courses c left join users u')) {
        return [db.courses.map((c) => {
          const teacher = db.users.find((u) => u.id === c.teacher_id);
          return { ...c, teacher: teacher ? teacher.name : '' };
        }), []];
      }
      if (normalized.startsWith('select * from courses where id = ?')) {
        return [db.courses.filter((i) => i.id === params[0]), []];
      }
      if (normalized.startsWith('insert into courses')) {
        const [id, code, section, name, teacherId, semesterId, students, status] = params;
        db.courses.push({ id, code, section, name, teacher_id: teacherId, semester_id: semesterId, students, status });
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('update courses set')) {
        const id = params.pop();
        const item = db.courses.find((i) => i.id === id);
        if (!item) return [{ affectedRows: 0 }, []];
        // Would need more complex parsing for real use — simplified for tests
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from courses where')) {
        const before = db.courses.length;
        db.courses = db.courses.filter((i) => i.id !== params[0]);
        return [{ affectedRows: before - db.courses.length }, []];
      }

      // ── CRUD: users ────────────────────────────────────────
      if (normalized.startsWith('select id, name, email, role, college, status from users where id = ?')) {
        return [db.users.filter((i) => i.id === params[0]), []];
      }
      if (normalized.startsWith('select id, name, email, role, college, status from users')) {
        return [db.users, []];
      }
      if (normalized.startsWith('select * from users where id = ?')) {
        return [db.users.filter((i) => i.id === params[0]), []];
      }
      if (normalized.startsWith('select id from users where name = ? and role = ?')) {
        return [db.users.filter((i) => i.name === params[0] && i.role === params[1]).map((u) => ({ id: u.id })), []];
      }
      if (normalized.startsWith('update users set')) {
        const id = params.pop();
        const item = db.users.find((i) => i.id === id);
        if (!item) return [{ affectedRows: 0 }, []];
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from users where')) {
        const before = db.users.length;
        db.users = db.users.filter((i) => i.id !== params[0]);
        return [{ affectedRows: before - db.users.length }, []];
      }

      // ── CRUD: organizations ─────────────────────────────────
      if (normalized.includes('from organizations o left join users u') && normalized.includes('where o.id = ?')) {
        const org = db.organizations.find((i) => i.id === params[0]);
        if (!org) return [[], []];
        const mgr = org.manager_id ? db.users.find((u) => u.id === org.manager_id) : null;
        return [[{ ...org, manager_name: mgr ? mgr.name : null }], []];
      }
      if (normalized.includes('from organizations o left join users u')) {
        return [db.organizations.map((o) => {
          const mgr = o.manager_id ? db.users.find((u) => u.id === o.manager_id) : null;
          return { ...o, manager_name: mgr ? mgr.name : null };
        }), []];
      }
      if (normalized.startsWith('select * from organizations where id = ?')) {
        return [db.organizations.filter((i) => i.id === params[0]), []];
      }
      if (normalized.startsWith('insert into organizations')) {
        const [id, name, type, managerId, description] = params;
        db.organizations.push({ id, name, type, manager_id: managerId, description: description || '', created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('update organizations set')) {
        const id = params.pop();
        const item = db.organizations.find((i) => i.id === id);
        if (!item) return [{ affectedRows: 0 }, []];
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from organizations where')) {
        const before = db.organizations.length;
        db.organizations = db.organizations.filter((i) => i.id !== params[0]);
        return [{ affectedRows: before - db.organizations.length }, []];
      }

      // ── CRUD: conversion_rules_admin ────────────────────────
      if (normalized.includes('from conversion_rules_admin') && normalized.includes('where id = ?')) {
        return [db.conversionRules.filter((i) => i.id === params[0]), []];
      }
      if (normalized.includes('from conversion_rules_admin')) {
        return [db.conversionRules, []];
      }
      if (normalized.startsWith('insert into conversion_rules_admin')) {
        const [id, gradeGroup, gender, itemName, rawValue, rawSeconds, convertedScore, version] = params;
        db.conversionRules.push({ id, grade_group: gradeGroup, gender, item_name: itemName, raw_value: rawValue, raw_seconds: Number(rawSeconds), converted_score: Number(convertedScore), version: version || 1 });
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('update conversion_rules_admin')) {
        const id = params.pop();
        const item = db.conversionRules.find((i) => i.id === id);
        if (!item) return [{ affectedRows: 0 }, []];
        return [{ affectedRows: 1 }, []];
      }
      if (normalized.startsWith('delete from conversion_rules_admin')) {
        const before = db.conversionRules.length;
        db.conversionRules = db.conversionRules.filter((i) => i.id !== params[0]);
        return [{ affectedRows: before - db.conversionRules.length }, []];
      }

      // ── CRUD: audit_logs ────────────────────────────────────
      if (normalized.startsWith('select * from audit_logs')) {
        return [[...db.auditLogs].reverse(), []];
      }
      if (normalized.startsWith('insert into audit_logs')) {
        const [id, actor, action, target] = params;
        db.auditLogs.push({ id, actor, action, target, time: new Date().toISOString() });
        return [{ affectedRows: 1 }, []];
      }

      throw new Error(`Unhandled SQL in fake DB: ${sql}`);
    },
  };

  pool.getConnection = async () => ({
    query: pool.query,
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
  });

  return { db, pool };
}

function loadServer(pool) {
  process.env.ALLOW_DEMO_TOKENS = 'true';
  process.env.NODE_ENV = 'test';
  const serverPath = require.resolve('../server.js');
  delete require.cache[serverPath];

  const realLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'mysql2/promise') {
      return { createPool: () => pool };
    }
    if (request === 'express') {
      const express = realLoad(request, parent, isMain);
      function wrappedExpress(...args) {
        const app = express(...args);
        app.listen = () => ({ close() {} });
        return app;
      }
      Object.assign(wrappedExpress, express);
      return wrappedExpress;
    }
    return realLoad(request, parent, isMain);
  };

  try {
    return require(serverPath);
  } finally {
    Module._load = realLoad;
  }
}

async function request(app, method, path, body) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        Authorization: 'Bearer demo-token-t1',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    return {
      status: response.status,
      headers: response.headers,
      text,
      body: contentType.includes('application/json') && text ? JSON.parse(text) : text,
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('admin config endpoints validate and persist settings', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  assert.equal(typeof loaded.app, 'function');
  const app = loaded.app;

  const defaults = await request(app, 'GET', '/api/admin/grade-rules');
  assert.equal(defaults.status, 200);
  assert.equal(defaults.body.reduce((sum, item) => sum + item.weight, 0), 100);

  const invalid = await request(app, 'PUT', '/api/admin/grade-rules', [
    { key: 'checkin', name: 'Check-in', weight: 90, source: 'Hours', status: 'draft' },
  ]);
  assert.equal(invalid.status, 422);

  const savedRules = [
    { key: 'checkin', name: 'Check-in', weight: 30, source: 'Hours', status: 'published' },
    { key: 'exam', name: 'Exam', weight: 30, source: 'Teacher', status: 'published' },
    { key: 'attendance', name: 'Attendance', weight: 20, source: 'Teacher', status: 'published' },
    { key: 'physical', name: 'Physical', weight: 20, source: 'System', status: 'published' },
  ];
  const saveRules = await request(app, 'PUT', '/api/admin/grade-rules', savedRules);
  assert.equal(saveRules.status, 200);
  assert.equal(saveRules.body[0].id, 'g1');

  const sportRule = await request(app, 'PUT', '/api/admin/sport-rules', {
    version: 'v2',
    total: 24,
    courseRequired: 12,
    generalRequired: 12,
    dailyLimit: 2,
    stackAllowed: 'no',
    organizationOffset: '10h',
    status: 'published',
  });
  assert.equal(sportRule.status, 200);
  assert.equal(sportRule.body.total, 24);

  const template = await request(app, 'PUT', '/api/admin/export-template', {
    name: 'final-csv',
    format: 'CSV',
    fields: ['studentId', 'studentName', 'total'],
    status: 'matched',
  });
  assert.equal(template.status, 200);
  assert.deepEqual(template.body.fields, ['studentId', 'studentName', 'total']);
});

test('teacher task endpoints create, patch, and delete course tasks', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  assert.equal(typeof loaded.app, 'function');
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/teacher/courses/gepe/tasks', {
    title: 'Morning run',
    description: 'Complete two hours',
    creditType: 'course',
    hours: 2,
    deadline: 'Week 9',
    proof: 'Photo',
    status: 'draft',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.courseId, 'gepe');
  assert.equal(created.body.title, 'Morning run');
  assert.equal(created.body.hours, 2);

  const updated = await request(app, 'PATCH', `/api/teacher/courses/gepe/tasks/${created.body.id}`, {
    title: 'Morning run updated',
    status: 'published',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.title, 'Morning run updated');
  assert.equal(updated.body.status, 'published');

  const deleted = await request(app, 'DELETE', `/api/teacher/courses/gepe/tasks/${created.body.id}`);
  assert.equal(deleted.status, 204);

  const list = await request(app, 'GET', '/api/teacher/courses/gepe/tasks');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body, []);
});

test('openapi task aliases patch and delete tasks by id', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  assert.equal(typeof loaded.app, 'function');
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/teacher/courses/gepe/tasks', {
    title: 'Alias run',
    hours: 1,
    deadline: 'Week 10',
    status: 'draft',
  });
  assert.equal(created.status, 201);

  const patched = await request(app, 'PATCH', `/api/teacher/tasks/${created.body.id}`, {
    status: 'published',
  });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.status, 'published');

  const deleted = await request(app, 'DELETE', `/api/teacher/tasks/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('roster import preview validates rows and confirm enrolls valid students', async () => {
  const { db, pool } = createFakeDb();
  const loaded = loadServer(pool);
  assert.equal(typeof loaded.app, 'function');
  const app = loaded.app;
  const csv = [
    'id,name,college,className,courseCode,section,enrollmentStatus',
    '22309999,Bob,Data Science,DS1,GEPE101,1004,selected',
    ',Missing Id,Data Science,DS1,GEPE101,1004,selected',
    '22308888,Wrong Course,Data Science,DS1,PE999,1004,selected',
  ].join('\n');

  const preview = await request(app, 'POST', '/api/teacher/courses/gepe/students/import/preview', { csv });
  assert.equal(preview.status, 200);
  assert.equal(preview.body.validCount, 1);
  assert.equal(preview.body.invalidCount, 2);

  const confirm = await request(app, 'POST', '/api/teacher/courses/gepe/students/import/confirm', {
    rows: preview.body.rows,
  });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.body.importedCount, 1);
  assert.equal(confirm.body.rejectedCount, 2);
  assert.ok(db.progress.some((item) => item.student_id === '22309999' && item.course_id === 'gepe'));
});

test('course grade export returns csv using grade rules and template fields', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  assert.equal(typeof loaded.app, 'function');
  const app = loaded.app;

  await request(app, 'PUT', '/api/admin/export-template', {
    name: 'final-csv',
    format: 'CSV',
    fields: ['studentId', 'studentName', 'checkinScore', 'exam', 'attendance', 'physical', 'total'],
    status: 'matched',
  });

  const exported = await request(app, 'GET', '/api/teacher/courses/gepe/export');
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-type'), /text\/csv/);
  assert.match(exported.headers.get('content-disposition'), /gepe-grades\.csv/);
  assert.match(exported.text, /studentId,studentName,checkinScore,exam,attendance,physical,total/);
  assert.match(exported.text, /22301142,Alice,25,80,90,70,85/);
});

// ── Phase 4: Admin CRUD endpoints ─────────────────────────────────────

test('admin semesters CRUD: create, list, update, and delete', async () => {
  const { db, pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  // GET list
  const list = await request(app, 'GET', '/api/admin/semesters');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 1);
  assert.equal(list.body[0].locked, '否');

  // POST create
  const created = await request(app, 'POST', '/api/admin/semesters', {
    name: '2026 Fall', dateRange: '2026.09.01 - 2027.01.15', status: '草稿', locked: '否',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, '2026 Fall');

  // PUT update
  const updated = await request(app, 'PUT', `/api/admin/semesters/${created.body.id}`, {
    status: '进行中',
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.status, '进行中');

  // DELETE
  const deleted = await request(app, 'DELETE', `/api/admin/semesters/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('admin courses CRUD: create, list, update, and delete', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/admin/courses', {
    code: 'PE999', section: '1005', name: 'Test Course', teacher: '王老师', students: 30, status: '草稿',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.code, 'PE999');

  const list = await request(app, 'GET', '/api/admin/courses');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 2);

  const updated = await request(app, 'PUT', `/api/admin/courses/${created.body.id}`, {
    status: '正常',
  });
  assert.equal(updated.status, 200);

  const deleted = await request(app, 'DELETE', `/api/admin/courses/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('admin users CRUD: create, list, update, and delete', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/admin/users', {
    name: 'Test Teacher', email: 'test@bnbu.edu.cn', role: 'teacher',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, 'Test Teacher');

  // Duplicate email
  const dup = await request(app, 'POST', '/api/admin/users', {
    name: 'Dup', email: 'test@bnbu.edu.cn', role: 'teacher',
  });
  assert.equal(dup.status, 409);

  const list = await request(app, 'GET', '/api/admin/users');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 4);

  const updated = await request(app, 'PUT', `/api/admin/users/${created.body.id}`, {
    status: '正常',
  });
  assert.equal(updated.status, 200);

  const deleted = await request(app, 'DELETE', `/api/admin/users/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('admin organizations CRUD: create, list, update, and delete', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/admin/organizations', {
    name: '羽毛球队', type: 'team',
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.type, 'team');

  // Invalid type
  const invalid = await request(app, 'POST', '/api/admin/organizations', {
    name: 'Bad', type: 'invalid',
  });
  assert.equal(invalid.status, 422);

  const list = await request(app, 'GET', '/api/admin/organizations');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 2);

  const updated = await request(app, 'PUT', `/api/admin/organizations/${created.body.id}`, {
    name: '羽毛球队（更新）',
  });
  assert.equal(updated.status, 200);

  const deleted = await request(app, 'DELETE', `/api/admin/organizations/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('admin conversion-rules CRUD: create, list, update, and delete', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  const created = await request(app, 'POST', '/api/admin/conversion-rules', {
    grade_group: 'junior_senior', gender: 'female', item_name: '800m', raw_value: "3'20\"", raw_seconds: 200, converted_score: 95,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.converted_score, 95);

  // Missing required field
  const invalid = await request(app, 'POST', '/api/admin/conversion-rules', {
    grade_group: 'freshman_sophomore',
  });
  assert.equal(invalid.status, 422);

  const list = await request(app, 'GET', '/api/admin/conversion-rules');
  assert.equal(list.status, 200);
  assert.ok(list.body.length >= 2);

  const updated = await request(app, 'PUT', `/api/admin/conversion-rules/${created.body.id}`, {
    converted_score: 90,
  });
  assert.equal(updated.status, 200);

  const deleted = await request(app, 'DELETE', `/api/admin/conversion-rules/${created.body.id}`);
  assert.equal(deleted.status, 204);
});

test('admin logs: returns paginated audit log', async () => {
  const { pool } = createFakeDb();
  const loaded = loadServer(pool);
  const app = loaded.app;

  const list = await request(app, 'GET', '/api/admin/logs');
  assert.equal(list.status, 200);
  assert.ok(Array.isArray(list.body.items));
  assert.ok(list.body.items.length >= 1);
});
