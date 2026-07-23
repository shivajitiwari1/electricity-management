import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient({
  log: ["error"],
});

const PAGES = [
  "dashboard", "residents", "connections", "meter-readings",
  "bills", "maintenance", "payments", "reports", "rates", "flat-info", "users", "permissions",
];

const ADMIN_PERMS = PAGES.map((page) => ({
  role: Role.ADMIN,
  page,
  canRead: true,
  canWrite: true,
  canDelete: true,
}));

const MANAGER_PERMS = [
  { role: Role.MANAGER, page: "dashboard",      canRead: true,  canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "residents",      canRead: true,  canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "connections",    canRead: true,  canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "meter-readings", canRead: true,  canWrite: true,  canDelete: false },
  { role: Role.MANAGER, page: "bills",          canRead: true,  canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "maintenance",    canRead: true,  canWrite: true,  canDelete: false },
  { role: Role.MANAGER, page: "payments",       canRead: true,  canWrite: true,  canDelete: false },
  { role: Role.MANAGER, page: "reports",        canRead: true,  canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "rates",          canRead: false, canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "flat-info",      canRead: false, canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "users",          canRead: false, canWrite: false, canDelete: false },
  { role: Role.MANAGER, page: "permissions",    canRead: false, canWrite: false, canDelete: false },
];

async function main() {
  for (const perm of [...ADMIN_PERMS, ...MANAGER_PERMS]) {
    await prisma.permission.upsert({
      where: { role_page: { role: perm.role, page: perm.page } },
      update: { canRead: perm.canRead, canWrite: perm.canWrite, canDelete: perm.canDelete },
      create: perm,
    });
  }
  console.log("✅ Permissions seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
