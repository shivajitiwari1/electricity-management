import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Find all users with _test in email
  const affected = await prisma.user.findMany({
    where: { email: { contains: "_test" } },
    select: { id: true, email: true },
  });

  console.log(`Found ${affected.length} users with _test in email`);

  let updated = 0;
  for (const user of affected) {
    const newEmail = user.email.replace("_test@", "@");
    if (newEmail === user.email) {
      console.log(`  SKIP (no change): ${user.email}`);
      continue;
    }
    // Check if new email already taken
    const existing = await prisma.user.findUnique({ where: { email: newEmail } });
    if (existing && existing.id !== user.id) {
      console.log(`  CONFLICT (${newEmail} already exists): skipping ${user.email}`);
      continue;
    }
    await prisma.user.update({ where: { id: user.id }, data: { email: newEmail } });
    console.log(`  ${user.email} -> ${newEmail}`);
    updated++;
  }

  console.log(`\nDone: ${updated} emails updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
