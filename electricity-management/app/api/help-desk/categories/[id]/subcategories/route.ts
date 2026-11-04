export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const createSubcategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  sortOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = createSubcategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const category = await prisma.ticketCategory.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  const { name, sortOrder } = parsed.data;
  const duplicate = await prisma.ticketSubcategory.findFirst({
    where: { categoryId: id, name: { equals: name } },
    select: { id: true },
  });
  if (duplicate) return NextResponse.json({ error: "Subcategory already exists" }, { status: 409 });

  const item = await prisma.ticketSubcategory.create({
    data: { categoryId: id, name, sortOrder: sortOrder ?? 0 },
  });

  return NextResponse.json({ subcategory: item }, { status: 201 });
}
