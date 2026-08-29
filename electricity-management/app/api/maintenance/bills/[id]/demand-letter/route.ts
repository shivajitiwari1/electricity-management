import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { generateMaintenanceDemandLetterPdf } from "@/lib/pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) return guard;

  const { id } = await params;

  const [bill, siteConfig] = await Promise.all([
    prisma.maintenanceBill.findUnique({
      where: { id },
      include: {
        connection: {
          include: {
            resident: { include: { user: { select: { name: true } } } },
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

  const pdfBuffer = await generateMaintenanceDemandLetterPdf({
    billNumber: bill.billNumber,
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "Resident",
    letterDate: new Date(),
    billingPeriodStart: bill.billingPeriodStart,
    billingPeriodEnd: bill.billingPeriodEnd,
    dueDate: bill.dueDate,
    unitArea: Number(bill.unitArea),
    ratePerSqFt: Number(bill.ratePerSqFt),
    amount: Number(bill.amount),
    previousDue: Number(bill.previousDue ?? 0),
    interestCharge: Number(bill.interestCharge ?? 0),
    paidAmount: Number(bill.paidAmount ?? 0),
    cgstRate: Number(siteConfig.cgstRate),
    sgstRate: Number(siteConfig.sgstRate),
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="demand-${bill.billNumber}.pdf"`,
    },
  });
}
