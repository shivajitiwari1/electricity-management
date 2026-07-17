// Populates FlatInfo table from existing Connection records
import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "";
const parsed = new URL(dbUrl);
const useSSL = process.env.DATABASE_SSL === "true" || parsed.hostname !== "localhost";
const adapter = new PrismaMariaDb({
  host: parsed.hostname,
  port: parsed.port ? parseInt(parsed.port, 10) : 3306,
  user: parsed.username,
  password: parsed.password || undefined,
  database: parsed.pathname.slice(1).split("?")[0],
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("=== Populating FlatInfo from Connection table ===\n");

  const connections = await prisma.connection.findMany({
    select: { flatNo: true, tower: true, floor: true, unitType: true, unitArea: true },
    orderBy: [{ tower: "asc" }, { flatNo: "asc" }],
  });

  console.log(`Found ${connections.length} connections.\n`);

  let created = 0, skipped = 0;

  for (const c of connections) {
    try {
      await prisma.flatInfo.upsert({
        where: { flatNo: c.flatNo },
        update: { tower: c.tower, floor: c.floor, unitType: c.unitType, area: c.unitArea },
        create: { flatNo: c.flatNo, tower: c.tower, floor: c.floor, unitType: c.unitType, area: c.unitArea },
      });
      created++;
    } catch {
      skipped++;
    }
    if (created % 50 === 0 && created > 0) console.log(`  ${created} done...`);
  }

  console.log(`\n✓ Done!`);
  console.log(`  Upserted : ${created}`);
  console.log(`  Skipped  : ${skipped}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
