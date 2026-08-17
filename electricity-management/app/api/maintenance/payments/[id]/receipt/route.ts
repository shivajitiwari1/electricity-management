export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf, ReceiptData } from "@/lib/pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const payment = await prisma.maintenancePayment.findUnique({
    where: { id },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: {
                include: {
                  user: { select: { name: true, email: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const receiptData: ReceiptData = {
    receiptNumber: payment.receiptNumber,
    residentName: payment.bill.connection.resident?.user?.name ?? "Resident",
    flatNo: payment.bill.connection.flatNo,
    billNumber: payment.bill.billNumber,
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate,
    razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
    method: payment.method,
  };

  const buffer = await generateReceiptPdf(receiptData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
    },
  });
}
