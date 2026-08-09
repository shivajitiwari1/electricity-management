import { prisma } from "../lib/prisma";

async function main() {
  const billCount = await prisma.bill.count();
  console.log("Bills:", billCount);

  const readingCount = await prisma.meterReading.count();
  console.log("MeterReadings:", readingCount);

  const auditCount = await prisma.auditLog.count();
  console.log("AuditLogs:", auditCount);

  const rateCount = await prisma.rate.count();
  console.log("Rates:", rateCount);

  // Try inserting a test audit log
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  console.log("Admin user:", admin?.id, admin?.email);
}

main().catch(console.error).finally(() => process.exit());
