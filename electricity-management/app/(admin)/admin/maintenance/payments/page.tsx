import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenancePaymentsTable from "@/components/admin/maintenance-payments-table";
import type { MaintenancePaymentRow } from "@/components/admin/maintenance-payments-table";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MaintenancePaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  const permissions = (session.user as any)?.permissions as PermissionsMap ?? {};
  if (role !== "ADMIN" && !permissions["maintenance"]?.canRead) redirect("/admin/dashboard");

  // Matches the table's default filter: the month before the current one.
  const now = new Date();
  const billDateFilter = {
    gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
    lt: new Date(now.getFullYear(), now.getMonth(), 1),
  };

  const payments = await prisma.maintenancePayment.findMany({
    where: { bill: { billingPeriodStart: billDateFilter } },
    include: {
      bill: {
        include: {
          connection: {
            include: { resident: { include: { user: { select: { name: true } } } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const initialData: MaintenancePaymentRow[] = payments.map((p) => {
    const billAmount = Math.round(Number(p.bill.amount));
    const prevDue = Math.round(Number(p.bill.previousDue));
    const interest = Math.round(Number(p.bill.interestCharge));
    const grandTotal = billAmount + prevDue + interest;
    const billPaid = Math.round(Number(p.bill.paidAmount));
    const billDue = Math.max(0, grandTotal - billPaid);
    const effectiveStatus = billDue === 0 ? "PAID" : billPaid > 0 ? "PARTIAL" : "PENDING";
    return {
      id: p.id,
      receiptNumber: p.receiptNumber,
      flatNo: p.bill.connection.flatNo,
      tower: p.bill.connection.tower,
      residentName: p.bill.connection.resident?.user?.name ?? "—",
      billNumber: p.bill.billNumber,
      amount: p.amount.toString(),
      method: p.method,
      referenceId: p.razorpayPaymentId ?? null,
      paymentDate: p.paymentDate.toISOString(),
      status: p.status,
      billStatus: effectiveStatus,
      billAmount: grandTotal.toString(),
      billPaidAmount: billPaid.toString(),
      billDue: billDue.toString(),
    };
  });

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Maintenance Payments</h1>
        <p className="text-muted-foreground">Payments received for maintenance charges</p>
      </div>
      <MaintenancePaymentsTable initialData={initialData} canDelete={role === "ADMIN" || permissions["maintenance"]?.canDelete === true} />
    </main>
  );
}
