import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const payments = await prisma.maintenancePayment.findMany({
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
    take: 200,
  });
  return NextResponse.json(payments);
}
