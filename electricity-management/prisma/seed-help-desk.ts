import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { DEFAULT_HELP_DESK_CATEGORIES } from "../lib/help-desk-categories";

const HELP_DESK_PERMISSIONS = [
  { role: Role.ADMIN, canRead: true, canWrite: true, canDelete: true },
  { role: Role.MANAGER, canRead: true, canWrite: true, canDelete: false },
];

async function main() {
  for (const perm of HELP_DESK_PERMISSIONS) {
    for (const page of ["help-desk"]) {
      await prisma.permission.upsert({
        where: { role_page: { role: perm.role, page } },
        update: {
          canRead: perm.canRead,
          canWrite: perm.canWrite,
          canDelete: perm.canDelete,
        },
        create: {
          role: perm.role,
          page,
          canRead: perm.canRead,
          canWrite: perm.canWrite,
          canDelete: perm.canDelete,
        },
      });
    }
  }

  for (const [index, name] of DEFAULT_HELP_DESK_CATEGORIES.entries()) {
    await prisma.ticketCategory.upsert({
      where: { name },
      update: { sortOrder: index + 1 },
      create: { name, sortOrder: index + 1 },
    });
  }

  console.log(
    `Seeded Help Desk permissions for ADMIN/MANAGER and ${DEFAULT_HELP_DESK_CATEGORIES.length} categories.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
