/**
 * Fix: move _test from end of email to before the @ sign
 * Before: shivajitiwari@gmail.com_test
 * After:  shivajitiwari_test@gmail.com
 */

import * as dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrismaAdapter() {
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

const prisma = new PrismaClient({ adapter: createPrismaAdapter() });

async function main() {
  const residents = await prisma.user.findMany({
    where: { role: "RESIDENT", email: { endsWith: "_test" } },
    select: { id: true, email: true },
  });

  console.log(`\nFound ${residents.length} emails to fix.\n`);

  for (const r of residents) {
    // "user@domain.com_test" → "user_test@domain.com"
    const withoutSuffix = r.email.replace(/_test$/, "");
    const atIdx = withoutSuffix.indexOf("@");
    const newEmail = atIdx !== -1
      ? withoutSuffix.slice(0, atIdx) + "_test" + withoutSuffix.slice(atIdx)
      : r.email; // fallback: leave unchanged if no @

    await prisma.user.update({ where: { id: r.id }, data: { email: newEmail } });
    console.log(`  ${r.email}  →  ${newEmail}`);
  }

  console.log("\nDone.\n");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
