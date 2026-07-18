// Import May 31, 2026 meter readings from 485-INVENTORY sheet
// Sets April reading as ncplPrevious (0 if April was not available)
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const _u = process.env.DATABASE_URL ?? "";
const _p = new URL(_u);
const _ssl = process.env.DATABASE_SSL === "true" || _p.hostname !== "localhost";
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: _p.hostname, port: _p.port ? parseInt(_p.port, 10) : 3306,
    user: _p.username, password: _p.password || undefined,
    database: _p.pathname.slice(1).split("?")[0],
    ...(_ssl ? { ssl: { rejectUnauthorized: false } } : {}),
  }),
});

const XLS_PATH = path.join(__dirname, "../../SOCIETY ELECTRICITY WORKING 15-07-26 (4).xlsx");
const READING_DATE = new Date("2026-05-31T00:00:00.000Z");

function normalizeFlat(flat) {
  return String(flat).trim().replace(/\s*\(.*\)$/, "").trim();
}

async function main() {
  console.log("=== Reading Excel file ===");
  const wb = XLSX.readFile(XLS_PATH);
  const inv = XLSX.utils.sheet_to_json(wb.Sheets["485-INVENTORY"], { header: 1, defval: "" });

  const rows = [];
  inv.slice(1).forEach((row) => {
    if (!row[0] || typeof row[0] !== "number") return;
    const flat = String(row[3]).trim();
    const apr = Number(row[4]) || 0;   // Meter Reading 30-04-2026
    const may = Number(row[5]) || 0;   // Meter Reading 31-05-2026
    if (may <= 0) return; // skip zero/missing May readings
    rows.push({ flat, normalFlat: normalizeFlat(flat), apr, may });
  });
  console.log(`Found ${rows.length} rows with valid May readings`);
  console.log(`  - with April reading: ${rows.filter(r => r.apr > 0).length}`);
  console.log(`  - April=0 (first reading): ${rows.filter(r => r.apr === 0).length}`);

  const dbConns = await prisma.connection.findMany({ select: { id: true, flatNo: true } });
  const dbMap = new Map(dbConns.map((c) => [c.flatNo, c.id]));

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No admin user found");

  const existingReadings = await prisma.meterReading.findMany({
    where: { readingDate: READING_DATE },
    select: { connectionId: true },
  });
  const alreadyImported = new Set(existingReadings.map((r) => r.connectionId));
  if (alreadyImported.size > 0) {
    console.log(`Skipping ${alreadyImported.size} connections that already have a May-31 reading`);
  }

  console.log("\n=== Importing May 31, 2026 meter readings ===");

  let imported = 0, skipped = 0, noMatch = 0;
  const errors = [];
  const unmatchedFlats = [];

  for (const row of rows) {
    const connId = dbMap.get(row.flat) ?? dbMap.get(row.normalFlat);
    if (!connId) {
      noMatch++;
      unmatchedFlats.push(row.flat);
      continue;
    }

    if (alreadyImported.has(connId)) {
      skipped++;
      continue;
    }

    const ncplUnits = row.apr > 0 ? row.may - row.apr : row.may;

    try {
      await prisma.meterReading.create({
        data: {
          connectionId: connId,
          readingDate: READING_DATE,
          ncplPrevious: row.apr,
          ncplCurrent: row.may,
          ncplUnits: Math.max(0, ncplUnits),
          dgPrevious: 0,
          dgCurrent: 0,
          dgUnits: 0,
          recordedById: admin.id,
        },
      });
      imported++;
      if (imported % 50 === 0) console.log(`  Progress: ${imported} imported...`);
    } catch (err) {
      errors.push({ flat: row.flat, error: String(err) });
    }
  }

  console.log("\n=== Import Complete ===");
  console.log(`  ✓ Imported:       ${imported}`);
  console.log(`  ⚠ Skipped (dup):  ${skipped}`);
  console.log(`  ✗ No DB match:    ${noMatch}`);
  console.log(`  ✗ Errors:         ${errors.length}`);

  if (unmatchedFlats.length > 0) {
    console.log("\nFlats not found in DB (not yet handed over / unsold):");
    unmatchedFlats.forEach((f) => console.log("  -", f));
  }
  if (errors.length > 0) {
    console.log("\nErrors:");
    errors.forEach((e) => console.log(`  - ${e.flat}: ${e.error}`));
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
