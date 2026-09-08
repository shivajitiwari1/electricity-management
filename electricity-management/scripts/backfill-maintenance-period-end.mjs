/**
 * One-time backfill for maintenance bills whose billingPeriodEnd was stored as
 * 23:59:59.999 UTC on the last day of the month. That is 05:29 the next
 * morning in IST, so an August bill rendered as "01 Aug – 01 Sept". Moves the
 * end to 00:00 UTC on the last day, matching how the start is stored.
 *
 *   node scripts/backfill-maintenance-period-end.mjs            # dry run
 *   node scripts/backfill-maintenance-period-end.mjs --apply    # write
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { maintenanceBillingPeriod } from "../lib/maintenance-billing.ts";

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
  select: { id: true, billNumber: true, billingPeriodStart: true, billingPeriodEnd: true },
  orderBy: { billNumber: "asc" },
});

const plan = [];
for (const bill of bills) {
  const { periodEnd } = maintenanceBillingPeriod(
    bill.billingPeriodStart.getUTCFullYear(),
    bill.billingPeriodStart.getUTCMonth()
  );
  if (bill.billingPeriodEnd.getTime() !== periodEnd.getTime()) {
    plan.push({ id: bill.id, billNumber: bill.billNumber, was: bill.billingPeriodEnd, now: periodEnd });
  }
}

const fmt = (d) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
console.table(plan.slice(0, 10).map((p) => ({ bill: p.billNumber, was: fmt(p.was), now: fmt(p.now) })));
if (plan.length > 10) console.log(`… and ${plan.length - 10} more`);
console.log(`\n${plan.length} of ${bills.length} maintenance bills need their period end corrected.`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these changes.");
} else {
  for (const p of plan) {
    await prisma.maintenanceBill.update({ where: { id: p.id }, data: { billingPeriodEnd: p.now } });
  }
  console.log(`\nApplied: ${plan.length} bills corrected.`);
}

await prisma.$disconnect();
