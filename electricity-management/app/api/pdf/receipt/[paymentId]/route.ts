export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf, ReceiptData } from "@/lib/pdf";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { paymentId } = await params;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
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
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
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
      (conn) => conn.id === payment.bill.connectionId
    );

    if (!ownsConnection) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const receiptData: ReceiptData = {
    receiptNumber: payment.receiptNumber,
    residentName:
      payment.bill.connection.resident.user.name ?? "Resident",
    flatNo: payment.bill.connection.flatNo,
    billNumber: payment.bill.billNumber,
    amount: payment.amount.toNumber(),
    paymentDate: payment.paymentDate,
    razorpayPaymentId: payment.razorpayPaymentId ?? undefined,
    method: payment.method,
  };

  const buffer = generateReceiptPdf(receiptData);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${payment.receiptNumber}.pdf"`,
    },
  });
}
