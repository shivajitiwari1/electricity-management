export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const slotSchema = z.object({
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Time must be HH:MM"),
  day: z.string().trim().min(1).max(20).default("EVERYDAY"),
});

const ruleSchema = z.object({
  categoryId: z.string().min(1),
  subcategoryId: z.string().min(1).nullable().optional(),
  assigneeId: z.string().min(1),
  ticketSlots: z.array(slotSchema).min(1),
  visitSlots: z.array(slotSchema).optional().default([]),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) return guard;

  const rules = await prisma.assignmentRule.findMany({
    include: {
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true, email: true, role: true } },
      slots: { orderBy: [{ kind: "asc" }, { startTime: "asc" }] },
    },
    orderBy: [{ category: { name: "asc" } }, { subcategory: { name: "asc" } }, { updatedAt: "desc" }],
  });

  return NextResponse.json({
    rules: rules.map((rule) => ({
      id: rule.id,
      categoryId: rule.categoryId,
      categoryName: rule.category.name,
      subcategoryId: rule.subcategoryId,
      subcategoryName: rule.subcategory?.name ?? null,
      assigneeId: rule.assigneeId,
      assigneeName: rule.assignee.name,
      assigneeEmail: rule.assignee.email,
      assigneeRole: rule.assignee.role,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      ticketSlots: rule.slots
        .filter((slot) => slot.kind === "TICKET")
        .map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
      visitSlots: rule.slots
        .filter((slot) => slot.kind === "VISIT")
        .map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
    })),
  });
}

export async function POST(req: NextRequest) {
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

  const rule = await prisma.$transaction(async (tx) => {
    const created = await tx.assignmentRule.create({
      data: { categoryId, subcategoryId: subcategoryId ?? null, assigneeId },
    });

    await tx.assignmentSlot.createMany({
      data: [
        ...ticketSlots.map((slot) => ({
          ruleId: created.id,
          kind: "TICKET" as const,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
        ...visitSlots.map((slot) => ({
          ruleId: created.id,
          kind: "VISIT" as const,
          startTime: slot.startTime,
          endTime: slot.endTime,
          day: slot.day,
        })),
      ],
    });

    return tx.assignmentRule.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        category: { select: { name: true } },
        subcategory: { select: { name: true } },
        assignee: { select: { name: true } },
        slots: true,
      },
    });
  });

  return NextResponse.json({ rule }, { status: 201 });
}
