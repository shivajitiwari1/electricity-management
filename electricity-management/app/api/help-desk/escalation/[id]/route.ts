export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const updateEscalationSchema = z.object({ isActive: z.boolean().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const guard = await guardPermission(session as any, "help-desk", "canWrite");
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateEscalationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const rule = await prisma.escalationRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const updated = await prisma.escalationRule.update({
    where: { id },
    data: { isActive: parsed.data.isActive },
  });

  return NextResponse.json({ rule: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const guard = await guardPermission(session as any, "help-desk", "canDelete");
  if (guard) return guard;

  const { id } = await params;
  const rule = await prisma.escalationRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  await prisma.escalationRule.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
