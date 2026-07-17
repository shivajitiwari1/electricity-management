// Updates connection flat info (tower, floor, unitType, unitArea, meterNo, sanctionedLoad)
// using SOCIETY ELECTRICITY WORKING 14-07-26.xlsx as the source of truth
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "";
const parsed = new URL(dbUrl);
const useSSL = process.env.DATABASE_SSL === "true" || parsed.hostname !== "localhost";
const adapter = new PrismaMariaDb({
  host: parsed.hostname || "localhost",
  port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  user: parsed.username || "root",
  password: parsed.password || undefined,
  database: parsed.pathname.slice(1).split("?")[0] || undefined,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});
const prisma = new PrismaClient({ adapter });

const IMPORT_SHEETS = [
  "TOWER-A-57",
  "TOWER-B-127",
  "TOWER-C-131",
  "TOWER-VAULT-83",
  "Shop-Commercial-8",
];

function normalizeTower(raw) {
  if (!raw) return "A";
  if (raw.toUpperCase() === "VAULT") return "V";
  return raw;
}

async function main() {
  console.log("=== Updating Flat Info from SOCIETY ELECTRICITY WORKING 14-07-26 ===\n");

  // Build flatNo → flat info map from SOCIETY Excel
  const wb = XLSX.readFile("C:/Users/omtiw/Downloads/SOCIETY ELECTRICITY WORKING 14-07-26.xlsx");

  const flatMap = new Map();

  for (const sheetName of IMPORT_SHEETS) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(2); // skip title + header

    for (const row of rows) {
      if (row[0] == null || typeof row[0] !== "number") continue;

      const flatNoRaw = String(row[3] ?? "").trim();
      if (!flatNoRaw) continue;

      const flatNo        = flatNoRaw.toUpperCase();
      const tower         = normalizeTower(String(row[1] ?? "").trim());
      const floor         = String(row[2] ?? "").trim();
      const meterNo       = row[5] != null && String(row[5]).trim() ? String(row[5]).trim() : null;
      const sanctionedLoad = Number(row[8]) || 5;

      // col 12 = unitType (string), col 13 = unitArea (number) — consistent across all sheets
      const unitType = String(row[12] ?? "").trim();
      const unitArea = Number(row[13]) || 0;

      flatMap.set(flatNo, { tower, floor, meterNo, sanctionedLoad, unitType, unitArea });
    }
  }

  console.log(`Loaded ${flatMap.size} flat records from Excel.\n`);

  // Fetch all connections from DB
  const connections = await prisma.connection.findMany({
    select: { id: true, flatNo: true, tower: true, floor: true, unitType: true, unitArea: true, meterNo: true, sanctionedLoad: true },
  });
  console.log(`Found ${connections.length} connections in DB.\n`);

  let updated = 0;
  let skipped = 0;

  for (const conn of connections) {
    const match = flatMap.get(conn.flatNo);
    if (!match) {
      console.log(`  ⚠ No match in Excel for flat: ${conn.flatNo}`);
      skipped++;
      continue;
    }

    await prisma.connection.update({
      where: { id: conn.id },
      data: {
        tower: match.tower,
        floor: match.floor,
        meterNo: match.meterNo,
        sanctionedLoad: match.sanctionedLoad,
        unitType: match.unitType,
        unitArea: match.unitArea,
      },
    });

    updated++;
    if (updated % 50 === 0) console.log(`  ${updated} connections updated...`);
  }

  console.log(`\n✓ Done!`);
  console.log(`  Updated : ${updated}`);
  console.log(`  Skipped : ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
