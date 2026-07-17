// Updates phone & email for all residents using 425 CUSTOMER LIST OVH.xlsx as lookup
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

import { PrismaClient } from "@prisma/client";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const prisma = new PrismaClient();

async function main() {
  console.log("=== Updating Phone & Email from 425 CUSTOMER LIST ===\n");

  // Build flatNo → { phone, email } map from the customer list
  const wb = XLSX.readFile("C:/Users/omtiw/Downloads/425 CUSTOMER LIST OVH.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1); // skip header

  const lookup = new Map();
  for (const row of rows) {
    const flatNo = String(row[5] ?? "").trim().toUpperCase();
    const phone  = row[2] != null ? String(row[2]).trim() : null;
    const email  = row[8] != null ? String(row[8]).trim().toLowerCase() : null;
    if (flatNo) lookup.set(flatNo, { phone, email });
  }
  console.log(`Loaded ${lookup.size} entries from customer list.\n`);

  // Fetch all residents with their connections and user
  const residents = await prisma.resident.findMany({
    include: {
      user: { select: { id: true, email: true } },
      connections: { select: { flatNo: true } },
    },
  });
  console.log(`Found ${residents.length} residents in DB.\n`);

  let updated = 0;
  let skipped = 0;
  let emailConflict = 0;

  for (const resident of residents) {
    const flatNo = resident.connections[0]?.flatNo;
    if (!flatNo) { skipped++; continue; }

    const match = lookup.get(flatNo);
    if (!match) { skipped++; continue; }

    const { phone, email } = match;

    // Check if target email is already used by a different user
    if (email && email !== resident.user.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== resident.user.id) {
        console.log(`  ⚠ Email conflict for ${flatNo}: ${email} already used — skipping email update`);
        emailConflict++;
        // Still update phone only
        await prisma.resident.update({
          where: { id: resident.id },
          data: { phone },
        });
        updated++;
        continue;
      }
    }

    // Update resident phone
    await prisma.resident.update({
      where: { id: resident.id },
      data: { phone },
    });

    // Update user email if changed
    if (email && email !== resident.user.email) {
      await prisma.user.update({
        where: { id: resident.user.id },
        data: { email },
      });
    }

    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} updated...`);
  }

  console.log(`\n✓ Done!`);
  console.log(`  Updated        : ${updated}`);
  console.log(`  Skipped        : ${skipped}`);
  console.log(`  Email conflicts: ${emailConflict}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
