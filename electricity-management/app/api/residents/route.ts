import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { revalidateTag } from "next/cache";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";

const createResidentSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  phone: z.string().optional(),
  tower: z.string().min(1),
  floor: z.string().min(1),
  flatNo: z.string().min(1),
  unitType: z.string().min(1),
  unitArea: z.number().positive(),
  sanctionedLoad: z.number().positive(),
  meterNo: z.string().optional(),
  password: z.string().min(6),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";

  const residents = await prisma.resident.findMany({
    where: search
      ? {
          OR: [
            { user: { name: { contains: search } } },
            {
              connections: {
                some: { flatNo: { contains: search } },
              },
            },
          ],
        }
      : undefined,
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
      connections: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(residents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "residents", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createResidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    name,
    email,
    phone,
    tower,
    floor,
    flatNo,
    unitType,
    unitArea,
    sanctionedLoad,
    meterNo,
    password,
  } = parsed.data;

  // Check for duplicate email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  // Check for duplicate flatNo
  const existingConnection = await prisma.connection.findUnique({
    where: { flatNo },
  });
  if (existingConnection) {
    return NextResponse.json({ error: "Flat number already exists" }, { status: 409 });
  }

  const hashedPassword = await bcryptjs.hash(password, 12);

  const last = await prisma.resident.findFirst({
    where: { residentNumber: { startsWith: "RES-" } },
    orderBy: { residentNumber: "desc" },
    select: { residentNumber: true },
  });
  const seq = last ? parseInt(last.residentNumber.slice(4), 10) + 1 : 1;
  const residentNumber = `RES-${String(seq).padStart(4, "0")}`;

  const resident = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "RESIDENT",
      },
    });

    const newResident = await tx.resident.create({
      data: {
        userId: user.id,
        residentNumber,
        phone,
      },
    });

    await tx.connection.create({
      data: {
        residentId: newResident.id,
        tower,
        floor,
        flatNo,
        unitType,
        unitArea,
        sanctionedLoad,
        meterNo,
        status: "ACTIVE",
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "CREATE",
        entity: "Resident",
        entityId: newResident.id,
        meta: { residentNumber, name, email, flatNo, tower },
      },
    });

    return tx.resident.findUnique({
      where: { id: newResident.id },
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true, createdAt: true },
        },
        connections: true,
      },
    });
  });

  // Send welcome email with credentials
  try {
    const html = welcomeEmail({
      residentName: name,
      flatNo,
      email,
      password,
      loginUrl: `${process.env.NEXTAUTH_URL}/login`,
    });
    await sendEmail(email, `Welcome to Oasis Venetia Heights â€” Your Login Details`, html);
  } catch (err) {
    console.error("Welcome email failed:", err);
  }

  revalidateTag("residents", {});
  return NextResponse.json(resident, { status: 201 });
}
