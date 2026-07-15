import { PrismaClient, Role, ConnectionStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Support both CJS (__dirname) and ESM (import.meta.url) contexts
const _dirname =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

function createClient() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const prisma = createClient();

interface ResidentData {
  tower: string;
  floor: string;
  flatNo: string;
  unitType: string;
  unitArea: number;
  sanctionedLoad: number;
  dgFixed: number;
  ratePerUnit: number;
  customerName: string;
  meterNo: string;
  previousDues: number;
}

async function main() {
  console.log("Seeding database...");

  // 1. Create admin user
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

  // 2. Create Rate record (only if none exist)
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
    console.log("Rate record created.");
  } else {
    console.log("Rate record already exists, skipping.");
  }

  // 3. Load residents from JSON
  const dataPath = join(_dirname, "data", "residents.json");
  const residentsData: ResidentData[] = JSON.parse(
    readFileSync(dataPath, "utf-8")
  );

  // Filter only records with non-empty customerName
  const validResidents = residentsData.filter(
    (r) => r.customerName && r.customerName.trim() !== ""
  );

  console.log(`Processing ${validResidents.length} residents...`);

  let seq = 1;
  for (const resident of validResidents) {
    const email = `${resident.flatNo.toLowerCase()}@oasis.local`;
    const residentPassword = await bcrypt.hash("Flat@123", 12);
    const residentNumber = `RES-${String(seq).padStart(4, "0")}`;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      console.log(`Skipping existing resident: ${email}`);
      seq++;
      continue;
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: resident.customerName,
        email,
        password: residentPassword,
        role: Role.RESIDENT,
      },
    });

    // Create resident record
    const residentRecord = await prisma.resident.create({
      data: {
        userId: user.id,
        residentNumber,
        phone: null,
      },
    });

    // Check if connection already exists for this flat
    const existingConnection = await prisma.connection.findUnique({
      where: { flatNo: resident.flatNo },
    });

    if (!existingConnection) {
      await prisma.connection.create({
        data: {
          residentId: residentRecord.id,
          tower: resident.tower,
          floor: resident.floor,
          flatNo: resident.flatNo,
          unitType: resident.unitType,
          unitArea: resident.unitArea,
          meterNo: resident.meterNo || null,
          sanctionedLoad: resident.sanctionedLoad,
          status: ConnectionStatus.ACTIVE,
        },
      });
    }

    console.log(`Created: ${email} (${residentNumber})`);
    seq++;
  }

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
