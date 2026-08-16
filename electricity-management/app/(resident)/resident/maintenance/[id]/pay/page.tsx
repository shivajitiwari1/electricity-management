import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import MaintenancePaymentInfo from "@/components/resident/maintenance-payment-info";
import { generateUpiQrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export default async function MaintenancePayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: { connections: { select: { id: true } } },
  });
  if (!resident) redirect("/login");

  const connectionIds = resident.connections.map((c) => c.id);

  const bill = await prisma.maintenanceBill.findUnique({
    where: { id },
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
    },
  });

  if (!bill || !connectionIds.includes(bill.connectionId))
    redirect("/resident/maintenance");
  if (bill.status === "PAID") redirect("/resident/maintenance");

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  const cgstRate = Number(siteConfig?.cgstRate ?? 9);
  const sgstRate = Number(siteConfig?.sgstRate ?? 9);
  const cgst = Math.round(Number(bill.amount) * cgstRate) / 100;
  const sgst = Math.round(Number(bill.amount) * sgstRate) / 100;
  const currentMonthTotal = Math.round((Number(bill.amount) + cgst + sgst) * 100) / 100;
  const netPayable = Math.round((currentMonthTotal + Number(bill.previousDue) + Number(bill.interestCharge) - Number(bill.paidAmount)) * 100) / 100;

  const qrCodeDataUrl = await generateUpiQrDataUrl(netPayable);

  return (
    <MaintenancePaymentInfo
      bill={{
        id: bill.id,
        billNumber: bill.billNumber,
        flatNo: bill.connection.flatNo,
        residentName: bill.connection.resident.user.name ?? "Resident",
        billingPeriodStart: bill.billingPeriodStart.toISOString(),
        billingPeriodEnd: bill.billingPeriodEnd.toISOString(),
        unitArea: Number(bill.unitArea),
        ratePerSqFt: Number(bill.ratePerSqFt),
        amount: Number(bill.amount),
        cgstRate,
        sgstRate,
        cgst,
        sgst,
        currentMonthTotal,
        previousDue: Number(bill.previousDue),
        interestCharge: Number(bill.interestCharge),
        paidAmount: Number(bill.paidAmount),
        netPayable,
        dueDate: bill.dueDate.toISOString(),
        status: bill.status,
      }}
      qrCodeDataUrl={qrCodeDataUrl}
    />
  );
}
