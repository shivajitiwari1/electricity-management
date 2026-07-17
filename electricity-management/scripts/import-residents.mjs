// Bulk import script: deletes all test data and imports 425 residents from XLS
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from project root
config({ path: path.join(__dirname, "../.env") });
config({ path: path.join(__dirname, "../.env.local") });

import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";
import ExcelJS from "exceljs";
const prisma = new PrismaClient();

const XLS_PATH = path.join(__dirname, "../../425 CUSTOMER LIST OVH.xlsx");
const DEFAULT_PASSWORD = "Oasis@1234";
const DEFAULT_SANCTIONED_LOAD = 5; // kW

async function main() {
  console.log("=== Step 1: Deleting all test data ===");

  // Delete in correct dependency order
  await prisma.payment.deleteMany({});
  console.log("  ✓ Payments deleted");

  await prisma.bill.deleteMany({});
  console.log("  ✓ Bills deleted");

  await prisma.meterReading.deleteMany({});
  console.log("  ✓ Meter readings deleted");

  await prisma.connection.deleteMany({});
  console.log("  ✓ Connections deleted");

  await prisma.resident.deleteMany({});
  console.log("  ✓ Residents deleted");

  // Delete all RESIDENT users (keep ADMIN)
  await prisma.user.deleteMany({ where: { role: "RESIDENT" } });
  console.log("  ✓ Resident users deleted");

  console.log("\n=== Step 2: Reading XLS file ===");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLS_PATH);
  const sheet = wb.worksheets[0];

  const rows = [];
  sheet.eachRow((row, i) => {
    if (i === 1) return; // skip header
    const values = row.values;
    const name = String(values[2] ?? "").trim();
    const phone = String(values[3] ?? "").trim();
    const tower = String(values[4] ?? "").trim();
    const floor = String(values[5] ?? "").trim();
    const flatNo = String(values[6] ?? "").trim();
    const unitType = String(values[7] ?? "").trim();
    const unitArea = Number(values[8]) || 0;
    const emailRaw = String(values[9] ?? "").trim();

    if (!flatNo || !name) return; // skip empty rows

    // Generate placeholder email if missing
    const email = emailRaw
      ? emailRaw.toLowerCase()
      : `${flatNo.toLowerCase().replace(/[^a-z0-9]/g, "")}@oasis.local`;

    rows.push({ name, phone, tower, floor, flatNo, unitType, unitArea, email });
  });

  console.log(`  Found ${rows.length} residents to import`);

  console.log("\n=== Step 3: Importing residents ===");
  const hashedPassword = await bcryptjs.hash(DEFAULT_PASSWORD, 12);

  let success = 0;
  let skipped = 0;
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const residentNumber = `RES-${String(i + 1).padStart(4, "0")}`;

    try {
      // Check for duplicate email
      const existingUser = await prisma.user.findUnique({ where: { email: r.email } });
      if (existingUser) {
        skipped++;
        console.log(`  ⚠ Skipped (email exists): ${r.flatNo} — ${r.email}`);
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: r.name,
            email: r.email,
            password: hashedPassword,
            role: "RESIDENT",
          },
        });

        const resident = await tx.resident.create({
          data: {
            userId: user.id,
            residentNumber,
            phone: r.phone || null,
          },
        });

        await tx.connection.create({
          data: {
            residentId: resident.id,
            tower: r.tower,
            floor: r.floor,
            flatNo: r.flatNo,
            unitType: r.unitType,
            unitArea: r.unitArea,
            sanctionedLoad: DEFAULT_SANCTIONED_LOAD,
            status: "ACTIVE",
          },
        });
      });

      success++;
      if (success % 50 === 0) console.log(`  Progress: ${success}/${rows.length}`);
    } catch (err) {
      errors.push({ flatNo: r.flatNo, error: String(err) });
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`  ✓ Imported: ${success}`);
  console.log(`  ⚠ Skipped:  ${skipped}`);
  console.log(`  ✗ Errors:   ${errors.length}`);
  if (errors.length > 0) {
    errors.forEach((e) => console.log(`    - ${e.flatNo}: ${e.error}`));
  }
  console.log(`\nDefault password for all residents: ${DEFAULT_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
