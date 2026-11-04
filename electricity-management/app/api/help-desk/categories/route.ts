export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Category is required").max(80),
  sortOrder: z.number().int().optional(),
  subcategories: z.array(z.string().trim().min(1).max(80)).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const categories = await prisma.ticketCategory.findMany({
    include: {
      subCategories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      _count: { select: { tickets: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
      ticketCount: category._count.tickets,
      subcategories: category.subCategories.map((subcategory) => ({
        id: subcategory.id,
        name: subcategory.name,
        sortOrder: subcategory.sortOrder,
        createdAt: subcategory.createdAt.toISOString(),
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, sortOrder, subcategories } = parsed.data;

  const existing = await prisma.ticketCategory.findFirst({
    where: { name: { equals: name } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }

  const category = await prisma.$transaction(async (tx) => {
    const created = await tx.ticketCategory.create({
      data: {
        name,
        sortOrder: sortOrder ?? 0,
      },
    });

    if (subcategories && subcategories.length > 0) {
      await tx.ticketSubcategory.createMany({
        data: subcategories.map((subName, index) => ({
          categoryId: created.id,
          name: subName,
          sortOrder: index + 1,
        })),
      });
    }

    return tx.ticketCategory.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        subCategories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
    });
  });

  return NextResponse.json({ category }, { status: 201 });
}
