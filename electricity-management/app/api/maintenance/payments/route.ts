import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const { searchParams } = req.nextUrl;
  const tower = searchParams.get("tower");
  const month = searchParams.get("month"); // YYYY-MM — filters by bill billing period start
  const method = searchParams.get("method");

  let billDateFilter: { gte?: Date; lt?: Date } | undefined;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    billDateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
  }

  const payments = await prisma.maintenancePayment.findMany({
    where: {
      ...(method ? { method: method as any } : {}),
      ...(tower || billDateFilter
        ? {
            bill: {
              ...(billDateFilter ? { billingPeriodStart: billDateFilter } : {}),
              ...(tower ? { connection: { tower } } : {}),
            },
          }
        : {}),
    },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 500,
  });
  return NextResponse.json(payments);
}
