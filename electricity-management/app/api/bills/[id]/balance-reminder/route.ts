import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { balanceDueEmail } from "@/lib/email-templates";
import { generatePaymentToken } from "@/lib/payment-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "bills", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  const bill = await prisma.bill.findUnique({
    where: { id },
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
  });

  if (!bill) {
    return NextResponse.json({ error: "Bill not found" }, { status: 404 });
  }

  if (bill.status !== "PARTIAL") {
    return NextResponse.json(
      { error: "Bill is not in PARTIAL status" },
      { status: 400 }
    );
  }

  const residentEmail = bill.connection.resident.user.email;
  const residentName = bill.connection.resident.user.name ?? "Resident";
  const flatNo = bill.connection.flatNo;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  const payToken = generatePaymentToken(bill.id);
  const payUrl = `${process.env.NEXTAUTH_URL}/pay/${payToken}`;

  const billingPeriod = `${fmtDate(bill.billingPeriodStart)} – ${fmtDate(bill.billingPeriodEnd)}`;
  const balanceDue = (
    Number(bill.totalAmount) - Number(bill.paidAmount)
  ).toFixed(2);

  try {
    await sendEmail(
      residentEmail,
      `Balance Due Notice — ${bill.billNumber} | Oasis Venetia Heights`,
      balanceDueEmail({
        residentName,
        flatNo,
        billNumber: bill.billNumber,
        billingPeriod,
        ncplCharge: bill.ncplCharge.toFixed(2),
        dgCharge: bill.dgCharge.toFixed(2),
        fixedCharge: bill.fixedCharge.toFixed(2),
        previousDues: bill.previousDues.toFixed(2),
        totalAmount: bill.totalAmount.toFixed(2),
        paidAmount: bill.paidAmount.toFixed(2),
        balanceDue,
        dueDate: fmtDate(bill.dueDate),
        payUrl,
      })
    );

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "BALANCE_REMINDER_SENT",
        entity: "Bill",
        entityId: bill.id,
        meta: {
          billNumber: bill.billNumber,
          sentTo: residentEmail,
          balanceDue,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Balance reminder email error:", err);
    return NextResponse.json(
      { error: "Failed to send balance reminder" },
      { status: 500 }
    );
  }
}
