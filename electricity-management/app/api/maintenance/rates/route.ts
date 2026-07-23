import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { z } from "zod";

const rateSchema = z.object({
  ratePerSqFt: z.number().positive("Rate must be positive"),
  effectiveFrom: z.string().min(1, "effectiveFrom is required"),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const rates = await prisma.maintenanceRate.findMany({
    orderBy: { effectiveFrom: "desc" },
  });
  return NextResponse.json(rates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = rateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const rate = await prisma.maintenanceRate.create({
    data: {
      ratePerSqFt: parsed.data.ratePerSqFt,
      effectiveFrom: new Date(parsed.data.effectiveFrom),
    },
  });
  return NextResponse.json(rate, { status: 201 });
}
