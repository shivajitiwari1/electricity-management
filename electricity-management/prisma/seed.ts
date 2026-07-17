import { PrismaClient, Role, ConnectionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();

function normalizeTower(raw: string): string {
  if (!raw) return "A";
  if (raw.toUpperCase() === "VAULT") return "V";
  return raw;
}

function cleanUnitType(raw: unknown): string {
  if (!raw) return "";
  return String(raw).trim();
}

// Sheets to import (skip the inventory summary sheet)
const IMPORT_SHEETS = [
  "TOWER-A-57",
  "TOWER-B-127",
  "TOWER-C-131",
  "TOWER-VAULT-83",
  "Shop-Commercial-8",
];

async function main() {
  console.log("=== OVH Customer Import — SOCIETY ELECTRICITY WORKING 14-07-26 ===\n");

  // ── 1. Upsert admin user ─────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@oasis.local" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@oasis.local",
      password: adminPassword,
      role: Role.ADMIN,
    },
  });
  console.log(`Admin user: ${admin.email}`);

  // ── 2. Upsert rate ───────────────────────────────────────────────────────
  const rateCount = await prisma.rate.count();
  if (rateCount === 0) {
    await prisma.rate.create({
      data: {
        ncplPerUnit: 7.0,
        dgFixed: 200.0,
        fixedPerKw: 115.0,
        effectiveFrom: new Date(),
      },
    });
    console.log("Default rate created (NPCL ₹7/unit, DG ₹200 fixed, Fixed ₹115/kW).");
  } else {
    console.log("Rate already exists — keeping current rate.");
  }

  // ── 3. Clear ALL resident / billing data ─────────────────────────────────
  console.log("\nClearing all existing data...");
  await prisma.auditLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.meterReading.deleteMany({});
  await prisma.connection.deleteMany({});
  const oldResidents = await prisma.resident.findMany({ select: { userId: true } });
  await prisma.resident.deleteMany({});
  if (oldResidents.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: oldResidents.map((r) => r.userId) } },
    });
  }
  console.log(`Cleared ${oldResidents.length} old residents.\n`);

  // ── 4. Read Excel & import ───────────────────────────────────────────────
  const wb = XLSX.readFile(
    "C:/Users/omtiw/Downloads/SOCIETY ELECTRICITY WORKING 14-07-26.xlsx"
  );

  const usedEmails = new Set<string>(["admin@oasis.local"]);
  const hashedPassword = await bcrypt.hash("Oasis@1234", 10);

  let created = 0;
  let failed = 0;
  let seq = 1;

  for (const sheetName of IMPORT_SHEETS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.log(`  ⚠ Sheet not found: ${sheetName}`);
      continue;
    }

    // Row 0 = title, Row 1 = column headers → skip both
    const rows = (XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]).slice(2);
    console.log(`Sheet: ${sheetName} — ${rows.length} data rows`);

    for (const row of rows) {
      // Skip empty rows or total/summary rows (S.No. must be a number)
      if (row[0] == null || typeof row[0] !== "number") continue;

      const towerRaw = String(row[1] ?? "").trim();
      const floor    = String(row[2] ?? "").trim();
      const flatNoRaw = String(row[3] ?? "").trim();
      const meterNo  = row[5] != null && String(row[5]).trim() ? String(row[5]).trim() : null;
      const sanctionedLoad = Number(row[8]) || 5;
      const name     = String(row[11] ?? "").trim();

      // Columns 12 & 13: unitArea (number) and unitType (string)
      // Tower A/B/C: [12]=area, [13]=type   |   VAULT/Shop: [12]=type, [13]=area
      let unitArea: number;
      let unitType: string;
      if (typeof row[12] === "number") {
        unitArea = row[12] as number;
        unitType = cleanUnitType(row[13]);
      } else {
        unitType = cleanUnitType(row[12]);
        unitArea = Number(row[13]) || 0;
      }

      if (!name || !flatNoRaw) continue;

      const tower  = normalizeTower(towerRaw);
      const flatNo = flatNoRaw.toUpperCase();
      const residentNumber = `RES-${String(seq).padStart(4, "0")}`;

      // Generate unique email from flat number
      const baseEmail = `${flatNo.toLowerCase().replace(/[\s-]/g, "")}@ovh.local`;
      let email = baseEmail;
      let suffix = 2;
      while (usedEmails.has(email)) {
        const atIdx = baseEmail.lastIndexOf("@");
        email = `${baseEmail.slice(0, atIdx)}${suffix}${baseEmail.slice(atIdx)}`;
        suffix++;
      }
      usedEmails.add(email);

      try {
        await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role: Role.RESIDENT,
            resident: {
              create: {
                residentNumber,
                phone: null,
                connections: {
                  create: {
                    tower,
                    floor,
                    flatNo,
                    unitType,
                    unitArea,
                    sanctionedLoad,
                    meterNo,
                    status: ConnectionStatus.ACTIVE,
                  },
                },
              },
            },
          },
        });
        created++;
        seq++;
        if (created % 50 === 0) console.log(`  ${created} imported...`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  FAILED (${name} / ${flatNo}): ${msg}`);
        failed++;
      }
    }
  }

  console.log(`\n✓ Import complete!`);
  console.log(`  Created : ${created}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`\nAdmin login    : admin@oasis.local / Admin@123`);
  console.log(`Resident login : <flat-based email> / Oasis@1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
