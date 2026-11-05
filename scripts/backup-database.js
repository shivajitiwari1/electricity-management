#!/usr/bin/env node
/**
 * Oasis Venetia Heights — Daily MySQL Database Backup Script (Node.js)
 *
 * Run this EVERY DAY before starting any development work:
 *
 *   node scripts/backup-database.js
 *
 * Requires:
 *   - .env file with DATABASE_URL
 *   - node_modules installed (mariadb client is already a dependency)
 */

const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');

const PROJECT_ROOT = 'E:\\Demo Website\\Electricity Bill\\electricity-management';
const REPO_ROOT = 'E:\\Demo Website\\Electricity Bill';
const BACKUP_DIR = path.join(REPO_ROOT, 'backups');
const RETENTION_DAYS = 30;

// Load .env manually (simple dotenv)
function loadEnv() {
  try {
    const envContent = fs.readFileSync(path.join(PROJECT_ROOT, '.env'), 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^"|"$/, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {
    // .env may not exist
  }
}

loadEnv();

const url = new URL(process.env.DATABASE_URL || '');

const config = {
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1).split('?')[0],
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
};

async function getAllTables(conn) {
  const rows = await conn.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  return rows.map(r => r.TABLE_NAME || r.table_name);
}

function escapeSqlValue(val) {
  if (val === null) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

async function dumpTable(conn, tableName) {
  // Get CREATE TABLE statement
  const createRows = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
  const createStmt = createRows[0]['Create Table'] || createRows[0][1];

  // Get all data
  const rows = await conn.query(`SELECT * FROM \`${tableName}\``);

  let output = `\n-- Table: ${tableName}\n`;
  output += `--\nDROP TABLE IF EXISTS \`${tableName}\`;\n${createStmt};\n\n`;

  if (rows.length > 0) {
    // Get column names
    const cols = Object.keys(rows[0]);
    const colList = cols.map(c => `\`${c}\``).join(', ');

    output += `INSERT INTO \`${tableName}\` (${colList}) VALUES\n`;
    const valueTuples = rows.map(row => {
      return `(` + cols.map(c => escapeSqlValue(row[c])).join(', ') + `)`;
    });
    // Insert in batches of 100
    for (let i = 0; i < valueTuples.length; i += 100) {
      const batch = valueTuples.slice(i, i + 100);
      output += batch.join(',\n') + ';\n';
    }
  }

  return output;
}

async function main() {
  const conn = await mariadb.createConnection(config);

  try {
    const dateStamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)
      .replace('T', '-');
    const backupFile = path.join(BACKUP_DIR, `db-backup-${dateStamp}.sql`);

    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    console.log('============================================================');
    console.log('  Oasis Venetia Heights — Daily Database Backup');
    console.log(`  Date: ${new Date().toISOString()}`);
    console.log(`  Database: ${config.database}@${config.host}:${config.port}`);
    console.log('============================================================\n');

    const tables = await getAllTables(conn);
    console.log(`[1/3] Found ${tables.length} tables`);

    let fullDump = `-- Oasis Venetia Heights Database Backup\n`;
    fullDump += `-- Generated: ${new Date().toISOString()}\n`;
    fullDump += `-- Database: ${config.database}\n`;
    fullDump += `-- Host: ${config.host}:${config.port}\n`;
    fullDump += `--\nSET FOREIGN_KEY_CHECKS = 0;\nSET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";\n\n`;

    for (const table of tables) {
      console.log(`   Dumping ${table}...`);
      fullDump += await dumpTable(conn, table);
    }

    fullDump += '\nSET FOREIGN_KEY_CHECKS = 1;\n';

    fs.writeFileSync(backupFile, fullDump);

    const stats = fs.statSync(backupFile);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log(`\n[2/3] Backup saved: ${backupFile}`);
    console.log(`   Size: ${sizeMB} MB`);

    // Cleanup old backups
    console.log('\n[3/3] Cleaning up backups older than ' + RETENTION_DAYS + ' days...');
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('db-backup-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
        mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime,
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    let deleted = 0;
    for (const f of files) {
      if (f.mtime < cutoff) {
        fs.unlinkSync(f.path);
        console.log(`   Deleted: ${f.name}`);
        deleted++;
      }
    }
    if (deleted === 0) {
      console.log('   No old backups to delete.');
    }

    console.log('\n============================================================');
    console.log('  Backup complete!');
    console.log(`  File: ${backupFile}`);
    console.log('============================================================');

  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
