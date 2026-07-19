import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Returns the total outstanding (unpaid) balance for a connection
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const bills = await prisma.bill.findMany({
    where: {
      connectionId: id,
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
    },
    select: { totalAmount: true, paidAmount: true },
  });

  const outstanding = bills.reduce(
    (sum, b) => sum + (Number(b.totalAmount) - Number(b.paidAmount)),
    0
  );

  return NextResponse.json({ outstanding: Math.max(0, outstanding) });
}
