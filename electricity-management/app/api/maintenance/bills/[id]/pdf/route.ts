import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { generateMaintenanceBillPdf } from "@/lib/pdf";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const role = (session.user as any).role;

  const [bill, siteConfig] = await Promise.all([
    prisma.maintenanceBill.findUnique({
      where: { id },
      include: {
        connection: {
          include: {
            resident: { include: { user: { select: { name: true, id: true } } } },
          },
        },
      },
    }),
    prisma.siteConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", maintenanceMode: false, cgstRate: 9, sgstRate: 9 },
      update: {},
    }),
  ]);

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  // Residents can only access their own bills; admins/managers pass through
  if (role === "RESIDENT") {
    if (bill.connection.resident.user.id !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const guard = await guardPermission(session as any, "maintenance", "canRead");
    if (guard) return guard;
  }

  const pdfBuffer = await generateMaintenanceBillPdf({
    billNumber: bill.billNumber,
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "Resident",
    billDate: bill.billDate,
    dueDate: bill.dueDate,
    billingPeriodStart: bill.billingPeriodStart,
    billingPeriodEnd: bill.billingPeriodEnd,
    unitArea: Number(bill.unitArea),
    ratePerSqFt: Number(bill.ratePerSqFt),
    amount: Number(bill.amount),
    previousDue: Number(bill.previousDue),
    interestCharge: Number(bill.interestCharge),
    paidAmount: Number(bill.paidAmount),
    status: bill.status,
    cgstRate: Number(siteConfig.cgstRate),
    sgstRate: Number(siteConfig.sgstRate),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="maintenance-bill-${bill.billNumber}.pdf"`,
    },
  });
}
