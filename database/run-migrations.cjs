// Execute the backend P0 migrations against an explicitly configured database.
// Required: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME. This script does not use
// production defaults and reports the post-migration schema evidence.
const fs = require('fs');
const path = require('path');
const mysql = require('../backend/node_modules/mysql2/promise');

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const migrationFiles = [
  '20260717_task_time_windows.sql',
  '20260717_roster_import_order.sql',
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });
  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(__dirname, 'migrations', file), 'utf8');
      await connection.query(sql);
      console.log(`applied ${file}`);
    }
    const [columns] = await connection.query(
      `SELECT TABLE_NAME, COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND ((TABLE_NAME = 'tasks' AND COLUMN_NAME IN ('start_at', 'end_at', 'timezone'))
           OR (TABLE_NAME = 'student_progress' AND COLUMN_NAME IN ('import_batch', 'import_order')))
       ORDER BY TABLE_NAME, COLUMN_NAME`
    );
    const [indexes] = await connection.query(
      `SELECT TABLE_NAME, INDEX_NAME
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'student_progress'
         AND INDEX_NAME = 'idx_student_progress_course_import_order'`
    );
    console.log(JSON.stringify({ database: process.env.DB_NAME, columns, indexes }));
  } finally {
    await connection.end();
  }
}

main().catch((error) => { console.error(error.code || error.message); process.exit(1); });
