import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { guardPermission } from "@/lib/permissions";

const schema = z.object({
  flatNo:   z.string().min(1),
  tower:    z.string().min(1),
  floor:    z.string().min(1),
  unitType: z.string().min(1),
  area:     z.number().positive(),
});

export async function GET() {
  const session = await auth();
  if (!session || ((session.user as any).role !== "ADMIN" && (session.user as any).role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const flats = await prisma.flatInfo.findMany({ orderBy: [{ tower: "asc" }, { flatNo: "asc" }] });
  return NextResponse.json(flats);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "flat-info", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.flatInfo.findUnique({ where: { flatNo: parsed.data.flatNo } });
  if (existing) {
    return NextResponse.json({ error: "Flat number already exists" }, { status: 409 });
  }

  const flat = await prisma.flatInfo.create({ data: parsed.data });
  return NextResponse.json(flat, { status: 201 });
}
