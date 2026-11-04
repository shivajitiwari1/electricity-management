export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const stepSchema = z.object({
  level: z.number().int().min(0).max(9),
  timeValue: z.number().int().positive(),
  timeUnit: z.enum(["MINUTES", "HOURS", "DAYS"]).default("MINUTES"),
  contactName: z.string().trim().min(1).max(120),
  contactEmail: z.string().trim().email().max(191),
  contactPhone: z.string().trim().max(30).default(""),
});

const upsertSchema = z.object({
  categoryId: z.string().min(1),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  isActive: z.boolean().default(true),
  steps: z.array(stepSchema).min(1).max(10),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const guard = await guardPermission(session as any, "help-desk", "canRead");
  if (guard) return guard;

  const rules = await prisma.escalationRule.findMany({
    include: {
      category: { select: { id: true, name: true } },
      steps: { orderBy: { level: "asc" } },
    },
    orderBy: [{ category: { name: "asc" } }, { priority: "asc" }],
  });

  return NextResponse.json({
    rules: rules.map((rule) => ({
      id: rule.id,
      categoryId: rule.categoryId,
      categoryName: rule.category.name,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
      steps: rule.steps.map((step) => ({
        id: step.id,
        level: step.level,
        timeValue: step.timeValue,
        timeUnit: step.timeUnit,
        contactName: step.contactName,
        contactEmail: step.contactEmail,
        contactPhone: step.contactPhone,
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

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { categoryId, priority, isActive, steps } = parsed.data;
  const category = await prisma.ticketCategory.findUnique({ where: { id: categoryId }, select: { id: true } });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const levels = new Set(steps.map((step) => step.level));
  if (levels.size !== steps.length) {
    return NextResponse.json({ error: "Escalation steps must have unique levels" }, { status: 400 });
  }

  const rule = await prisma.$transaction(async (tx) => {
    const existing = await tx.escalationRule.findUnique({
      where: { categoryId_priority: { categoryId, priority } },
      select: { id: true },
    });

    const rule = await tx.escalationRule.upsert({
      where: { categoryId_priority: { categoryId, priority } },
      update: { isActive },
      create: { categoryId, priority, isActive },
    });

    await tx.escalationStep.deleteMany({ where: { ruleId: rule.id } });
    await tx.escalationStep.createMany({
      data: steps.map((step) => ({
        ruleId: rule.id,
        level: step.level,
        timeValue: step.timeValue,
        timeUnit: step.timeUnit,
        contactName: step.contactName,
        contactEmail: step.contactEmail,
        contactPhone: step.contactPhone,
      })),
    });

    return tx.escalationRule.findUniqueOrThrow({
      where: { id: rule.id },
      include: { steps: { orderBy: { level: "asc" } }, category: { select: { name: true } } },
    });
  });

  return NextResponse.json({ rule }, { status: 201 });
}
