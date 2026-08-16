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
        amount: Number(bill.amount).toFixed(2),
        dueDate: bill.dueDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      })
    );
  } catch (err: any) {
    console.error("[maintenance email]", err);
    return NextResponse.json({ error: err?.message ?? "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ sent: true, to: recipientEmail });
}
