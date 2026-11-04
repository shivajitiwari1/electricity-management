export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const slotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  day: z.string().trim().min(1).max(20).default("EVERYDAY"),
});

const ruleSchema = z.object({
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1),
  ticketSlots: z.array(slotSchema).min(1),
  visitSlots: z.array(slotSchema).optional().default([]),
});

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

  const parsed = ruleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const rule = await prisma.assignmentRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) return NextResponse.json({ error: "Assignment rule not found" }, { status: 404 });

  const { categoryId, subcategoryId, assigneeId, ticketSlots, visitSlots } = parsed.data;

  const [category, subcategory, assignee] = await Promise.all([
    prisma.ticketCategory.findUnique({ where: { id: categoryId }, select: { id: true } }),
    subcategoryId
      ? prisma.ticketSubcategory.findUnique({ where: { id: subcategoryId }, select: { id: true, categoryId: true } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } }),
  ]);

  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  if (subcategoryId) {
    if (!subcategory || subcategory.categoryId !== categoryId) {
      return NextResponse.json({ error: "Subcategory does not belong to this category" }, { status: 400 });
    }
  }
  if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.assignmentRule.update({
      where: { id },
      data: { categoryId, subcategoryId: subcategoryId ?? null, assigneeId },
    });

    await tx.assignmentSlot.deleteMany({ where: { ruleId: id } });
    await tx.assignmentSlot.createMany({
      data: [
        ...ticketSlots.map((slot) => ({
          ruleId: id,
          kind: "TICKET" as const,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
        ...visitSlots.map((slot) => ({
          ruleId: id,
          kind: "VISIT" as const,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
      ],
    });

    return tx.assignmentRule.findUniqueOrThrow({
      where: { id },
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        assignee: { select: { name: true } },
        slots: true,
      },
    });
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
  const rule = await prisma.assignmentRule.findUnique({ where: { id }, select: { id: true } });
  if (!rule) return NextResponse.json({ error: "Assignment rule not found" }, { status: 404 });

  await prisma.assignmentRule.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
