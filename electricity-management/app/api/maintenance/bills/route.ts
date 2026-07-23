import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const { searchParams } = new URL(req.url);
  const tower = searchParams.get("tower");
  const flatNo = searchParams.get("flatNo");
  const month = searchParams.get("month"); // YYYY-MM
  const status = searchParams.get("status");

  const validStatuses = ["PENDING", "PAID", "OVERDUE", "PARTIAL"];
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  let dateFilter: { gte?: Date; lt?: Date } | undefined;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    if (!year || !mon || mon < 1 || mon > 12) {
      return NextResponse.json({ error: "Invalid month format. Use YYYY-MM" }, { status: 400 });
    }
    dateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
  }

  const bills = await prisma.maintenanceBill.findMany({
    where: {
      ...(status ? { status: status as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" } : {}),
      ...(dateFilter ? { billDate: dateFilter } : {}),
      ...(flatNo || tower ? {
        connection: {
          ...(flatNo ? { flatNo } : {}),
          ...(tower ? { tower } : {}),
        },
      } : {}),
    },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      payments: true,
    },
    orderBy: { billDate: "desc" },
    take: 200,
  });

  return NextResponse.json(bills);
}
