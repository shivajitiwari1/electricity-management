// One-time script to reset admin@oasis.local password to Admin@123
// Run: node scripts/reset-admin-password.mjs

import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { URL } from 'url';

const require = createRequire(import.meta.url);

// Load .env.local manually
const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
for (const line of envFile.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx < 0) continue;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  process.env[key] = val;
}

const { PrismaMariaDb } = require('@prisma/adapter-mariadb');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const dbUrl = process.env.DATABASE_URL;
const parsed = new URL(dbUrl);
const adapter = new PrismaMariaDb({
  host: parsed.hostname,
  port: parseInt(parsed.port, 10) || 3306,
  user: parsed.username,
  password: parsed.password,
  database: parsed.pathname.slice(1).split('?')[0],
  ssl: { rejectUnauthorized: false },
  connectTimeout: 30000,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash('Admin@123', 12);
  const user = await prisma.user.update({
    where: { email: 'admin@oasis.local' },
    data: { password: hash },
  });
  console.log('✅ Password reset for:', user.email);
  console.log('   New password: Admin@123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
