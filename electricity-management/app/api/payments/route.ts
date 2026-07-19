import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const method = searchParams.get("method");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const flatNo = searchParams.get("flatNo");

  const validMethods = ["ONLINE", "CASH"];
  const validStatuses = ["SUCCESS", "FAILED", "INITIATED"];

  if (method && !validMethods.includes(method)) {
    return NextResponse.json({ error: "Invalid method filter" }, { status: 400 });
  }
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
  }

  const payments = await prisma.payment.findMany({
    where: {
      ...(method ? { method: method as "ONLINE" | "CASH" } : {}),
      ...(status ? { status: status as "SUCCESS" | "FAILED" | "INITIATED" } : {}),
      ...(from || to
        ? {
            paymentDate: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(flatNo ? { bill: { connection: { flatNo } } } : {}),
    },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: {
                include: {
                  user: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });

  return NextResponse.json(payments);
}
