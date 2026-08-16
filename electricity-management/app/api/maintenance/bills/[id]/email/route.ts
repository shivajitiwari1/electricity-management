import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { maintenanceBillGeneratedEmail } from "@/lib/email-templates";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canWrite");
  if (guard) return guard;

  const { id } = await params;

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true, email: true } } } },
        },
      },
      rate: true,
    },
  });

  if (!bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

  const recipientEmail = bill.connection.resident.user.email;
  if (!recipientEmail) return NextResponse.json({ error: "Resident has no email address" }, { status: 422 });

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  const cgstRate = Number(siteConfig?.cgstRate ?? 0);
  const sgstRate = Number(siteConfig?.sgstRate ?? 0);
  const amount = Number(bill.amount);
  const cgst = parseFloat((amount * cgstRate / 100).toFixed(2));
  const sgst = parseFloat((amount * sgstRate / 100).toFixed(2));
  const currentMonthTotal = parseFloat((amount + cgst + sgst).toFixed(2));
  const previousDue = Number(bill.previousDue);
  const interestCharge = Number(bill.interestCharge);
  const paidAmount = Number(bill.paidAmount);
  const netPayable = parseFloat((currentMonthTotal + previousDue + interestCharge - paidAmount).toFixed(2));

  const fmt = (n: number) => n.toFixed(2);
  const billingPeriodStr = `${bill.billingPeriodStart.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${bill.billingPeriodEnd.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;

  try {
    await sendEmail(
      recipientEmail,
      `Maintenance Bill — ${bill.billingPeriodStart.toLocaleString("en-IN", { month: "long", year: "numeric" })} — ${bill.connection.flatNo}`,
      maintenanceBillGeneratedEmail({
        residentName: bill.connection.resident.user.name ?? "Resident",
        flatNo: bill.connection.flatNo,
        billNumber: bill.billNumber,
        billingPeriod: billingPeriodStr,
        unitArea: Number(bill.unitArea),
        ratePerSqFt: Number(bill.ratePerSqFt).toFixed(2),
        amount: fmt(amount),
        cgstRate: fmt(cgstRate),
        sgstRate: fmt(sgstRate),
        cgst: fmt(cgst),
        sgst: fmt(sgst),
        currentMonthTotal: fmt(currentMonthTotal),
        previousDue: fmt(previousDue),
        interestCharge: fmt(interestCharge),
        netPayable: fmt(netPayable),
        dueDate: bill.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      })
    );
  } catch (err: any) {
    console.error("[maintenance email]", err);
    return NextResponse.json({ error: err?.message ?? "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ sent: true, to: recipientEmail });
}
