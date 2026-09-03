/**
 * Re-dates existing maintenance bills onto the month-end rule: the due date is
 * the last day of the month after the billing month, instead of the day the
 * bill happened to be raised plus 15 days.
 *
 *   node scripts/backfill-maintenance-due-dates.mjs            # dry run (default)
 *   node scripts/backfill-maintenance-due-dates.mjs --apply    # write changes
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { maintenanceDueDate } from "../lib/maintenance-billing.ts";

const APPLY = process.argv.includes("--apply");

const url = new URL(process.env.DATABASE_URL ?? "");
const useSSL = process.env.DATABASE_SSL === "true" || url.hostname !== "localhost";
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password) || undefined,
    database: url.pathname.slice(1).split("?")[0],
    ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
    connectTimeout: 30000,
  }),
});

const bills = await prisma.maintenanceBill.findMany({
  select: { id: true, billNumber: true, billingPeriodStart: true, dueDate: true, status: true },
  orderBy: { billingPeriodStart: "asc" },
});

const iso = (d) => d.toISOString().slice(0, 10);
const changes = bills
  .map((b) => ({ ...b, next: maintenanceDueDate(b.billingPeriodStart) }))
  .filter((b) => iso(b.next) !== iso(b.dueDate));

console.table(
  changes.map((c) => ({
    bill: c.billNumber,
    period: iso(c.billingPeriodStart),
    was: iso(c.dueDate),
    now: iso(c.next),
    status: c.status,
  }))
);
console.log(`${changes.length} of ${bills.length} maintenance bills need re-dating.`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these changes.");
} else {
  for (const c of changes) {
    await prisma.maintenanceBill.update({ where: { id: c.id }, data: { dueDate: c.next } });
  }
  console.log(`\nApplied: ${changes.length} bills re-dated.`);
}

await prisma.$disconnect();
