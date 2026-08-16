import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ResidentMaintenanceBillsList from "@/components/resident/maintenance-bills-list";

export const dynamic = "force-dynamic";

export default async function ResidentMaintenancePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  if (!siteConfig?.maintenanceBillingEnabled) redirect("/resident/dashboard");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      connections: {
        include: {
          maintenanceBills: {
            orderBy: { billDate: "desc" },
            include: { payments: { orderBy: { paymentDate: "desc" }, take: 1 } },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  const bills = resident.connections.flatMap((conn) =>
    conn.maintenanceBills.map((bill) => ({
      id: bill.id,
      billNumber: bill.billNumber,
      flatNo: conn.flatNo,
      billingPeriodStart: bill.billingPeriodStart.toISOString(),
      billingPeriodEnd: bill.billingPeriodEnd.toISOString(),
      unitArea: Number(bill.unitArea),
      ratePerSqFt: Number(bill.ratePerSqFt),
      amount: Number(bill.amount),
      previousDue: Number(bill.previousDue),
      interestCharge: Number(bill.interestCharge),
      paidAmount: Number(bill.paidAmount),
      dueDate: bill.dueDate.toISOString(),
      billDate: bill.billDate.toISOString(),
      status: bill.status as string,
    }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
        <p className="text-gray-500 text-sm mt-1">Society maintenance charges for your flat</p>
      </div>
      <ResidentMaintenanceBillsList bills={bills} />
    </div>
  );
}
