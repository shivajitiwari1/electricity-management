import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { guardPermission } from "@/lib/permissions";

const schema = z.object({
  flatNo:   z.string().min(1).optional(),
  tower:    z.string().min(1).optional(),
  floor:    z.string().min(1).optional(),
  unitType: z.string().min(1).optional(),
  area:     z.number().positive().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "flat-info", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const flat = await prisma.flatInfo.findUnique({ where: { id } });
  if (!flat) return NextResponse.json({ error: "Flat not found" }, { status: 404 });

  if (parsed.data.flatNo && parsed.data.flatNo !== flat.flatNo) {
    const dup = await prisma.flatInfo.findUnique({ where: { flatNo: parsed.data.flatNo } });
    if (dup) return NextResponse.json({ error: "Flat number already exists" }, { status: 409 });
  }

  const updated = await prisma.flatInfo.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "flat-info", "canDelete");
  if (guard) return guard;

  const { id } = await params;
  const flat = await prisma.flatInfo.findUnique({ where: { id } });
  if (!flat) return NextResponse.json({ error: "Flat not found" }, { status: 404 });

  await prisma.flatInfo.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
