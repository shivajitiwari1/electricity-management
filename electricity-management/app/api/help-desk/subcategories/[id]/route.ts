export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const updateSubcategorySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sortOrder: z.number().int().optional(),
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

  const parsed = updateSubcategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;
  const subcategory = await prisma.ticketSubcategory.findUnique({
    where: { id },
    select: { id: true, name: true, categoryId: true },
  });
  if (!subcategory) return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });

  const name = parsed.data.name ?? subcategory.name;
  if (name !== subcategory.name) {
    const duplicate = await prisma.ticketSubcategory.findFirst({
      where: { categoryId: subcategory.categoryId, name: { equals: name }, id: { not: id } },
      select: { id: true },
    });
    if (duplicate) return NextResponse.json({ error: "Subcategory already exists" }, { status: 409 });
  }

  const item = await prisma.ticketSubcategory.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });

  return NextResponse.json({ subcategory: item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const guard = await guardPermission(session as any, "help-desk", "canDelete");
  if (guard) return guard;

  const { id } = await params;
  const subcategory = await prisma.ticketSubcategory.findUnique({ where: { id }, select: { id: true } });
  if (!subcategory) return NextResponse.json({ error: "Subcategory not found" }, { status: 404 });

  const usage = await prisma.ticket.count({ where: { subcategoryId: id } });
  if (usage > 0) {
    return NextResponse.json(
      { error: `Cannot delete a subcategory used by ${usage} ticket(s).` },
      { status: 409 }
    );
  }

  await prisma.ticketSubcategory.delete({ where: { id } });
  return NextResponse.json({ deleted: id });
}
