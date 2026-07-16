export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateBillPdf, BillData } from "@/lib/pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ billId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { billId } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      meterReading: true,
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
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  // RESIDENT: verify ownership
  if (session.user.role === "RESIDENT") {
    const resident = await prisma.resident.findUnique({
      where: { userId: session.user.id },
      include: { connections: { select: { id: true } } },
    });

    if (!resident) {
      return NextResponse.json(
        { error: "Resident record not found" },
        { status: 403 }
      );
    }

    const ownsConnection = resident.connections.some(
      (conn) => conn.id === bill.connectionId
    );

    if (!ownsConnection) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const billData: BillData = {
    flatNo: bill.connection.flatNo,
    residentName: bill.connection.resident.user.name ?? "Resident",
    billDate: bill.billDate,
    dueDate: bill.dueDate,
    billingPeriodStart: bill.billingPeriodStart,
    billingPeriodEnd: bill.billingPeriodEnd,
    sanctionedLoad: bill.connection.sanctionedLoad.toNumber(),
    unitArea: bill.connection.unitArea,
    ncplPrevious: bill.meterReading.ncplPrevious.toNumber(),
    ncplCurrent: bill.meterReading.ncplCurrent.toNumber(),
    ncplUnits: bill.ncplUnits.toNumber(),
    dgPrevious: bill.meterReading.dgPrevious.toNumber(),
    dgCurrent: bill.meterReading.dgCurrent.toNumber(),
    dgUnits: bill.meterReading.dgUnits.toNumber(),
    ratePerUnit: bill.ratePerUnit.toNumber(),
    ncplCharge: bill.ncplCharge.toNumber(),
    dgCharge: bill.dgCharge.toNumber(),
    fixedCharge: bill.fixedCharge.toNumber(),
    previousDues: bill.previousDues.toNumber(),
    totalAmount: bill.totalAmount.toNumber(),
    billNumber: bill.billNumber,
  };

  const buffer = await generateBillPdf(billData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="bill-${bill.billNumber}.pdf"`,
    },
  });
}
