import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

const PAGES = [
  "dashboard", "residents", "connections", "meter-readings",
  "bills", "payments", "reports", "rates", "flat-info", "users", "permissions",
];

const ADMIN_PERMS = PAGES.map((page) => ({
  role: "ADMIN" as const,
  page,
  canRead: true,
  canWrite: true,
  canDelete: true,
}));

const MANAGER_PERMS: { role: "MANAGER"; page: string; canRead: boolean; canWrite: boolean; canDelete: boolean }[] = [
  { role: "MANAGER", page: "dashboard",      canRead: true,  canWrite: false, canDelete: false },
  { role: "MANAGER", page: "residents",      canRead: true,  canWrite: false, canDelete: false },
  { role: "MANAGER", page: "connections",    canRead: true,  canWrite: false, canDelete: false },
  { role: "MANAGER", page: "meter-readings", canRead: true,  canWrite: true,  canDelete: false },
  { role: "MANAGER", page: "bills",          canRead: true,  canWrite: false, canDelete: false },
  { role: "MANAGER", page: "payments",       canRead: true,  canWrite: true,  canDelete: false },
  { role: "MANAGER", page: "reports",        canRead: true,  canWrite: false, canDelete: false },
  { role: "MANAGER", page: "rates",          canRead: false, canWrite: false, canDelete: false },
  { role: "MANAGER", page: "flat-info",      canRead: false, canWrite: false, canDelete: false },
  { role: "MANAGER", page: "users",          canRead: false, canWrite: false, canDelete: false },
  { role: "MANAGER", page: "permissions",    canRead: false, canWrite: false, canDelete: false },
];

async function main() {
  for (const perm of [...ADMIN_PERMS, ...MANAGER_PERMS]) {
    await prisma.permission.upsert({
      where: { role_page: { role: perm.role, page: perm.page } },
      update: {},
      create: perm,
    });
  }
  console.log("✅ Permissions seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
