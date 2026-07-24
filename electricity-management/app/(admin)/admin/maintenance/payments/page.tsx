import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import MaintenancePaymentsTable from "@/components/admin/maintenance-payments-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function PaymentsData() {
  const session = await auth();
  const guard = await guardPermission(session as any, "maintenance", "canRead");
  if (guard) redirect("/admin/dashboard");

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const payments = await prisma.maintenancePayment.findMany({
    where: { paymentDate: { gte: monthStart, lt: monthEnd } },
    include: {
      bill: {
        include: {
          connection: {
            include: {
              resident: { include: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
    take: 500,
  });

  const serialized = payments.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    flatNo: p.bill?.connection?.flatNo ?? "—",
    tower: p.bill?.connection?.tower ?? "—",
    residentName: p.bill?.connection?.resident?.user?.name ?? "—",
    billNumber: p.bill?.billNumber ?? "—",
    amount: p.amount.toString(),
    method: p.method,
    referenceId: p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : null,
    paymentDate: p.paymentDate.toISOString(),
    status: p.status,
  }));

  return <MaintenancePaymentsTable initialData={serialized} />;
}

export default function MaintenancePaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Payment history for maintenance bills</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={8} />}>
        <PaymentsData />
      </Suspense>
    </div>
  );
}
