import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

const TENANT_VERIFICATION_PERMISSIONS = [
  { role: Role.ADMIN, canRead: true, canWrite: true, canDelete: true },
  { role: Role.MANAGER, canRead: true, canWrite: true, canDelete: false },
];

async function main() {
  for (const perm of TENANT_VERIFICATION_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { role_page: { role: perm.role, page: "tenant-verification" } },
      update: {
        canRead: perm.canRead,
        canWrite: perm.canWrite,
        canDelete: perm.canDelete,
      },
      create: {
        role: perm.role,
        page: "tenant-verification",
        canRead: perm.canRead,
        canWrite: perm.canWrite,
        canDelete: perm.canDelete,
      },
    });
  }

  console.log("Seeded Tenant Verification permissions for ADMIN/MANAGER.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
