/**
 * Targeted seed: inserts/upserts only the "maintenance" permission rows.
 * Run with: npx tsx --env-file=.env.local prisma/seed-maintenance-perms.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, Role } from "@prisma/client";

function createAdapter() {
  const url = process.env.DATABASE_URL ?? "";
  const parsed = new URL(url);
  const useSSL = process.env.DATABASE_SSL === "true" || parsed.hostname !== "localhost";
  return new PrismaMariaDb({
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username || "root",
    password: parsed.password || undefined,
    database: parsed.pathname.slice(1).split("?")[0] || undefined,
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    connectTimeout: 30000,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter(), log: ["error"] });

const MAINTENANCE_PERMS = [
  { role: Role.ADMIN,    page: "maintenance", canRead: true,  canWrite: true,  canDelete: true  },
  { role: Role.MANAGER,  page: "maintenance", canRead: true,  canWrite: true,  canDelete: false },
];

async function main() {
  for (const perm of MAINTENANCE_PERMS) {
    await prisma.permission.upsert({
      where: { role_page: { role: perm.role, page: perm.page } },
      update: { canRead: perm.canRead, canWrite: perm.canWrite, canDelete: perm.canDelete },
      create: perm,
    });
    console.log(`  ✓ ${perm.role} / maintenance`);
  }
  console.log("✅ Maintenance permissions seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
