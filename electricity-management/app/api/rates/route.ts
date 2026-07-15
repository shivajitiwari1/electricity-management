import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createRateSchema = z.object({
  ncplPerUnit: z.number().positive(),
  dgFixed: z.number().nonnegative(),
  fixedPerKw: z.number().nonnegative(),
});

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rates = await prisma.rate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });

  return NextResponse.json(rates);
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

  const parsed = createRateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { ncplPerUnit, dgFixed, fixedPerKw } = parsed.data;

  const rate = await prisma.$transaction(async (tx) => {
    const newRate = await tx.rate.create({
      data: {
        ncplPerUnit,
        dgFixed,
        fixedPerKw,
        effectiveFrom: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Rate",
        entityId: newRate.id,
        meta: { ncplPerUnit, dgFixed, fixedPerKw, effectiveFrom: newRate.effectiveFrom },
      },
    });

    return newRate;
  });

  return NextResponse.json(rate, { status: 201 });
}
