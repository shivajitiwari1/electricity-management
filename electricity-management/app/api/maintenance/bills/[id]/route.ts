import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = (session.user as any).role as string;

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      },
      payments: true,
      rate: true,
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  if (role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({ where: { userId: session.user.id } });
    if (!resident || bill.connection.residentId !== resident.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json(bill);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { status } = body as { status?: string };
  const validStatuses = ["PENDING", "PAID", "OVERDUE", "PARTIAL"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const bill = await prisma.maintenanceBill.update({
    where: { id },
    data: { status: status as "PENDING" | "PAID" | "OVERDUE" | "PARTIAL" },
  });
  return NextResponse.json(bill);
}
