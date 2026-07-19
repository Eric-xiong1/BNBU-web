/*
 * Finds proof uploads that are no longer referenced by a business record.
 * Safe by default: it only prints candidates. Set DELETE_ORPHANS=true to
 * delete files after reviewing the dry-run output in the development/staging
 * environment first.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const uploadsDir = path.join(__dirname, '..', 'uploads');
const minimumAgeHours = Number(process.env.ORPHAN_UPLOAD_MIN_AGE_HOURS || 24);
const deleteOrphans = process.env.DELETE_ORPHANS === 'true';

function extractUrls(value, urls) {
  if (value == null) return;
  let parsed = value;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch (_error) { parsed = [parsed]; }
  }
  if (!Array.isArray(parsed)) return;
  for (const item of parsed) {
    const url = typeof item === 'string' ? item : item?.url;
    if (typeof url === 'string' && url.startsWith('/uploads/')) urls.add(path.basename(url));
  }
}

async function main() {
  if (!fs.existsSync(uploadsDir)) {
    console.log('No uploads directory found; nothing to clean.');
    return;
  }
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const referenced = new Set();
  try {
    for (const [table, column] of [['sport_records', 'proof_files'], ['exemptions', 'proof_files'], ['manual_credits', 'proof_files']]) {
      const [rows] = await pool.query(`SELECT ${column} AS proof_files FROM ${table}`);
      rows.forEach((row) => extractUrls(row.proof_files, referenced));
    }
  } finally {
    await pool.end();
  }

  const cutoff = Date.now() - minimumAgeHours * 60 * 60 * 1000;
  const candidates = fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, fullPath: path.join(uploadsDir, entry.name), stat: fs.statSync(path.join(uploadsDir, entry.name)) }))
    .filter((entry) => !referenced.has(entry.name) && entry.stat.mtimeMs < cutoff);

  for (const file of candidates) {
    if (deleteOrphans) fs.unlinkSync(file.fullPath);
    console.log(`${deleteOrphans ? 'deleted' : 'candidate'} ${file.name}`);
  }
  console.log(JSON.stringify({ mode: deleteOrphans ? 'delete' : 'dry-run', minimumAgeHours, count: candidates.length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
