/**
 * One-time backfill for bills whose unpaid balance was rolled into a later
 * bill's previousDues before the CARRIED_FORWARD status existed. Those bills
 * stayed PENDING/OVERDUE and were counted twice in every outstanding figure.
 *
 *   node scripts/backfill-carried-forward.mjs            # dry run (default)
 *   node scripts/backfill-carried-forward.mjs --apply    # write changes
 */
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import { selectCarriedForwardBills } from "../lib/carry-forward.ts";

const APPLY = process.argv.includes("--apply");
const REVERT = process.argv.includes("--revert");

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

if (REVERT) {
  // Rollback: hand the dues back to the original bills. Needed if the running
  // deployment ever predates the CARRIED_FORWARD enum value, since its Prisma
  // client cannot read a bill carrying that status.
  const carried = await prisma.bill.findMany({
    where: { status: "CARRIED_FORWARD" },
    select: { id: true, billNumber: true, dueDate: true },
  });
  console.log(`${carried.length} carried-forward bills to reopen.`);
  if (!APPLY) {
    console.log("Dry run. Re-run with --revert --apply to write these changes.");
  } else {
    const now = new Date();
    for (const bill of carried) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { status: bill.dueDate < now ? "OVERDUE" : "PENDING", carriedForwardToId: null },
      });
    }
    console.log(`Reverted: ${carried.length} bills reopened.`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

const open = await prisma.bill.findMany({
  where: { status: { in: ["PENDING", "OVERDUE", "PARTIAL"] } },
  select: {
    id: true, billNumber: true, connectionId: true, billDate: true,
    previousDues: true, totalAmount: true, paidAmount: true,
    connection: { select: { flatNo: true } },
  },
  orderBy: { billDate: "asc" },
});

const byConnection = new Map();
for (const bill of open) {
  if (!byConnection.has(bill.connectionId)) byConnection.set(bill.connectionId, []);
  byConnection.get(bill.connectionId).push(bill);
}

const plan = [];
for (const bills of byConnection.values()) {
  // Walk newest to oldest: each bill that carries dues absorbs the open bills before it.
  const remaining = [...bills];
  while (remaining.length > 1) {
    const target = remaining.pop();
    const prevDues = Number(target.previousDues);
    if (prevDues <= 0) continue;
    const covered = selectCarriedForwardBills(
      prevDues,
      remaining.map((b) => ({ id: b.id, balance: Number(b.totalAmount) - Number(b.paidAmount) }))
    );
    for (const id of covered) {
      const bill = remaining.find((b) => b.id === id);
      plan.push({
        flatNo: bill.connection.flatNo,
        billNumber: bill.billNumber,
        balance: Number(bill.totalAmount) - Number(bill.paidAmount),
        billId: bill.id,
        intoBillId: target.id,
        intoBillNumber: target.billNumber,
      });
    }
    // Absorbed bills are settled; keep walking in case of deeper chains.
    for (const id of covered) {
      const i = remaining.findIndex((b) => b.id === id);
      if (i >= 0) remaining.splice(i, 1);
    }
  }
}

console.table(plan.map((p) => ({ flat: p.flatNo, bill: p.billNumber, balance: p.balance, absorbedBy: p.intoBillNumber })));
const total = plan.reduce((s, p) => s + p.balance, 0);
console.log(`\n${plan.length} bills to mark CARRIED_FORWARD — ₹${total.toFixed(2)} of phantom outstanding removed.`);
console.log(`Open bills before: ${open.length}, after: ${open.length - plan.length}`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to write these changes.");
} else {
  for (const p of plan) {
    await prisma.bill.update({
      where: { id: p.billId },
      data: { status: "CARRIED_FORWARD", carriedForwardToId: p.intoBillId },
    });
  }
  console.log(`\nApplied: ${plan.length} bills updated.`);
}

await prisma.$disconnect();
