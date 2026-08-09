import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { billGeneratedEmail } from "@/lib/email-templates";
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

  const residentEmail = bill.connection.resident.user.email;
  const residentName = bill.connection.resident.user.name ?? "Resident";
  const flatNo = bill.connection.flatNo;

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const payToken = generatePaymentToken(bill.id);
  const payUrl = `${process.env.NEXTAUTH_URL}/pay/${payToken}`;

  const billingPeriod = `${fmtDate(bill.billingPeriodStart)} – ${fmtDate(bill.billingPeriodEnd)}`;
  const totalAmount = bill.totalAmount.toFixed(2);
  const dueDate = fmtDate(bill.dueDate);

  try {
    await sendEmail(
      residentEmail,
      `Electricity Bill - ${bill.billNumber}`,
      billGeneratedEmail({ residentName, flatNo, billNumber: bill.billNumber, billingPeriod, totalAmount, dueDate, payUrl })
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resend email error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
