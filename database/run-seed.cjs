// Execute the full-flow test seed SQL against the production database
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const sqlFile = path.join(__dirname, '..', '..', 'web端测试v0.1', 'baota-fullflow-test-seed-20260704.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

async function main() {
  const conn = await mysql.createConnection({
    host: '123.207.5.70',
    user: '123_207_5_70_96',
    password: 'Bd84EKfpw3XSmheB',
    database: '123_207_5_70_96',
    multipleStatements: true,
  });

  console.log('✅ Connected to MySQL');

  // Execute the SQL (includes TRANSACTION, COMMIT, and verification SELECTs)
  const [results] = await conn.query(sql);
  console.log('✅ SQL executed successfully.\n');

  // The last few results arrays are from the verification SELECTs at the end
  // Print them nicely
  let selectIndex = 0;
  const labels = ['Users', 'Course', 'Student Progress', 'Reviews'];
  for (const result of results) {
    if (Array.isArray(result) && result.length > 0) {
      const label = labels[selectIndex] || `Result ${selectIndex}`;
      console.log(`── ${label} ──`);
      for (const row of result) {
        console.log(JSON.stringify(row));
      }
      console.log();
      selectIndex++;
    }
  }

  await conn.end();
  console.log('✅ Done. Connection closed.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
