import { PrismaClient, Role, ConnectionStatus } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

function createAdapter() {
  const url =
    process.env.DATABASE_URL ??
    "mysql://root:@localhost:3306/electricity_management";
  const parsed = new URL(url);
  return new PrismaMariaDb({
    host: parsed.hostname || "localhost",
    port: parsed.port ? parseInt(parsed.port, 10) : 3306,
    user: parsed.username || "root",
    password: parsed.password || undefined,
    database: parsed.pathname.slice(1) || "electricity_management",
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

function normalizeTower(raw: string): string {
  if (!raw) return "A";
  if (raw.toUpperCase() === "VAULT") return "V";
  return raw;
}

function getSanctionedLoad(area: number): number {
  if (area <= 400) return 1;
  if (area <= 600) return 2;
  if (area <= 1000) return 3;
  if (area <= 1200) return 4;
  if (area <= 2000) return 5;
  return 8;
}

function cleanUnitType(raw: string): string {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]+\)\s*/g, "").trim();
}

async function main() {
  console.log("=== OVH Customer Import from Excel ===\n");

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

  // ── 3. Clear all resident / billing data ─────────────────────────────────
  console.log("\nClearing existing resident data...");
  await prisma.auditLog.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.meterReading.deleteMany({});
  await prisma.connection.deleteMany({});
  const oldResidents = await prisma.resident.findMany({
    select: { userId: true },
  });
  await prisma.resident.deleteMany({});
  if (oldResidents.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: oldResidents.map((r) => r.userId) } },
    });
  }
  console.log(`Cleared ${oldResidents.length} old residents.\n`);

  // ── 4. Read Excel ────────────────────────────────────────────────────────
  const wb = XLSX.readFile(
    "C:/Users/omtiw/Downloads/425 CUSTOMER LIST OVH.xlsx"
  );
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = (
    XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
  ).slice(1); // skip header row

  console.log(`Found ${rows.length} customer rows in Excel.`);
  console.log("Importing (password for all: Flat@123)...\n");

  const usedEmails = new Set<string>(["admin@oasis.local"]);
  const hashedPassword = await bcrypt.hash("Flat@123", 10);

  let created = 0;
  let failed = 0;

  for (const row of rows) {
    const sno = row[0] as number;
    const name = (row[1] as string)?.trim();
    const phone = row[2] != null ? String(row[2]).trim() : null;
    const tower = normalizeTower(row[3] as string);
    const floor = (row[4] as string) ?? "";
    const unitNo = (row[5] as string)?.trim();
    const unitTypeRaw = (row[6] as string) ?? "";
    const area = (row[7] as number) || 0;
    const emailRaw = (row[8] as string | undefined)?.trim().toLowerCase();

    if (!name || !unitNo) continue;

    const flatNo = unitNo.toUpperCase();

    // Resolve unique email
    let baseEmail =
      emailRaw || `${flatNo.toLowerCase().replace(/[\s-]/g, "")}@ovh.local`;
    let email = baseEmail;
    let suffix = 2;
    while (usedEmails.has(email)) {
      const atIdx = baseEmail.lastIndexOf("@");
      email = `${baseEmail.slice(0, atIdx)}${suffix}${baseEmail.slice(atIdx)}`;
      suffix++;
    }
    usedEmails.add(email);

    const unitType = cleanUnitType(unitTypeRaw);
    const sanctionedLoad = getSanctionedLoad(area);
    const residentNumber = `RES-${String(sno).padStart(4, "0")}`;

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
              phone,
              connections: {
                create: {
                  tower,
                  floor,
                  flatNo,
                  unitType,
                  unitArea: area,
                  sanctionedLoad,
                  status: ConnectionStatus.ACTIVE,
                },
              },
            },
          },
        },
      });
      created++;
      if (created % 50 === 0) console.log(`  ${created} customers imported...`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED row ${sno} (${name} / ${flatNo}): ${msg}`);
      failed++;
    }
  }

  console.log(`\n✓ Import complete!`);
  console.log(`  Created : ${created}`);
  console.log(`  Failed  : ${failed}`);
  console.log(`\nAdmin login : admin@oasis.local / Admin@123`);
  console.log(`Resident login: email (above) / Flat@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
