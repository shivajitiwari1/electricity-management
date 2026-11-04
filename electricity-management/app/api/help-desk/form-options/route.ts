export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { guardHelpDeskEnabled } from "@/lib/help-desk-config";

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const disabled = await guardHelpDeskEnabled();
  if (disabled) return disabled;

  const role = (session.user as any).role as string;
  const userId = String((session.user as any).id ?? "");

  let categories: any[];
  try {
    categories = await prisma.ticketCategory.findMany({
      include: {
        subCategories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  } catch (error: any) {
    console.error("Help Desk categories error:", error?.message ?? error);
    return NextResponse.json({ error: "Could not load categories: " + (error?.message ?? "unknown") }, { status: 500 });
  }

  const mappedCategories = categories.map((category: any) => ({
    id: category.id,
    name: category.name,
    sortOrder: category.sortOrder,
    subcategories: category.subCategories.map((subcategory: any) => ({
      id: subcategory.id,
      name: subcategory.name,
      sortOrder: subcategory.sortOrder,
    })),
  }));

  const payload: Record<string, unknown> = {
    role,
    categories: mappedCategories,
  };

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId },
      include: {
        user: { select: { name: true, email: true } },
        connections: { select: { id: true, flatNo: true, tower: true }, orderBy: { flatNo: "asc" } },
      },
    });
    payload.resident = resident
      ? {
          id: resident.id,
          name: resident.user.name,
          connections: resident.connections,
        }
      : null;
    return NextResponse.json(payload);
  }

  if (role === "ADMIN" || role === "MANAGER") {
    const guard = await guardPermission(session as any, "help-desk", "canRead");
    if (guard) return guard;

    let residents: any[];
    try {
      residents = await prisma.resident.findMany({
        include: {
          user: { select: { name: true, email: true } },
          connections: {
            select: { id: true, flatNo: true, tower: true, status: true },
            orderBy: { flatNo: "asc" },
          },
        },
        take: 1000,
        orderBy: [{ user: { name: "asc" } }],
      });
    } catch (error: any) {
      console.error("Help Desk residents error:", error?.message ?? error);
      return NextResponse.json({ error: "Could not load residents: " + (error?.message ?? "unknown") }, { status: 500 });
    }

    let staff: any[];
    try {
      staff = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      });
    } catch (error: any) {
      console.error("Help Desk staff error:", error?.message ?? error);
      return NextResponse.json({ error: "Could not load staff: " + (error?.message ?? "unknown") }, { status: 500 });
    }

    payload.residents = residents.map((resident) => ({
      id: resident.id,
      name: resident.user.name,
      email: resident.user.email,
      phone: resident.phone,
      connections: resident.connections,
    }));
    payload.staff = staff;
    return NextResponse.json(payload);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
