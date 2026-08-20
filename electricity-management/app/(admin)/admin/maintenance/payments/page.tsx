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

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [year, mon] = currentMonth.split("-").map(Number);
  const billDateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };

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
    const billAmount = Number(p.bill.amount);
    const billPaid = Number(p.bill.paidAmount);
    const billDue = Math.max(0, billAmount - billPaid);
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
      billStatus: p.bill.status,
      billAmount: billAmount.toString(),
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
