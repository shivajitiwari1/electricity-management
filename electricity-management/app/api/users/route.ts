import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcryptjs from "bcryptjs";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";

const createManagerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { role: "MANAGER" },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createManagerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, phone } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const hashedPassword = await bcryptjs.hash(password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "MANAGER",
        isActive: true,
      },
      select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "ManagerUser",
        entityId: newUser.id,
        meta: { name, email },
      },
    });

    return newUser;
  });

  try {
    const html = welcomeEmail({
      residentName: name,
      flatNo: "Manager Account",
      email,
      password,
      loginUrl: `${process.env.NEXTAUTH_URL}/login`,
    });
    await sendEmail(email, "Welcome — Your Manager Account Details", html);
  } catch (err) {
    console.error("Manager welcome email failed:", err);
  }

  return NextResponse.json(user, { status: 201 });
}
