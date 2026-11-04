import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceAdvancePaymentsTable from "@/components/admin/maintenance-advance-payments-table";
import type { MaintenanceAdvancePaymentRow } from "@/components/admin/maintenance-advance-payments-table";
import type { PermissionsMap } from "@/lib/permissions";
import { groupAdvancePaymentRuns, isAdvancePayment } from "@/lib/maintenance-billing";

export const dynamic = "force-dynamic";

export default async function MaintenanceAdvancePaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  const permissions = (session.user as any)?.permissions as PermissionsMap ?? {};
  if (role !== "ADMIN" && !permissions["maintenance"]?.canRead) redirect("/admin/dashboard");

  // Advance payments are ordinary MaintenancePayment rows on bills raised for a
  // future month, so they can only be told apart by comparing the payment date
  // with the billing period — which Prisma cannot do across columns. Load the
  // payments and filter here; the set is small (one row per flat per month).
  const payments = await prisma.maintenancePayment.findMany({
    where: { method: { not: "ADJUSTMENT" } },
    select: {
      id: true,
      receiptNumber: true,
      amount: true,
      method: true,
      paymentDate: true,
      razorpayPaymentId: true,
      bill: {
        select: {
          billNumber: true,
          billDate: true,
          connectionId: true,
          billingPeriodStart: true,
          billingPeriodEnd: true,
          connection: {
            select: {
              flatNo: true,
              tower: true,
              resident: { select: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
    orderBy: { paymentDate: "desc" },
  });

  const advance = payments.filter((p) =>
    isAdvancePayment(p.paymentDate, p.bill.billingPeriodStart)
  );

  // One row per advance taken, not per month: a 6-month advance is one payment
  // of the resident's money and one receipt, even though it is billed monthly.
  const initialData: MaintenanceAdvancePaymentRow[] = groupAdvancePaymentRuns(
    advance.map((p) => ({
      id: p.id,
      connectionId: p.bill.connectionId,
      billDate: p.bill.billDate,
      billingPeriodStart: p.bill.billingPeriodStart,
      billingPeriodEnd: p.bill.billingPeriodEnd,
      receiptNumber: p.receiptNumber,
      amount: p.amount,
      method: p.method,
      paymentDate: p.paymentDate,
      razorpayPaymentId: p.razorpayPaymentId,
      billNumber: p.bill.billNumber,
      connection: p.bill.connection,
    }))
  )
    .map((run) => {
      const first = run[0];
      const last = run[run.length - 1];
      return {
        id: first.id,
        receiptNumber: first.receiptNumber,
        receiptCount: run.length,
        flatNo: first.connection.flatNo,
        tower: first.connection.tower,
        residentName: first.connection.resident?.user?.name ?? "—",
        billNumber:
          run.length > 1 ? `${first.billNumber} to ${last.billNumber}` : first.billNumber,
        amount: run.reduce((sum, p) => sum + Math.round(Number(p.amount)), 0).toString(),
        method: first.method,
        referenceId:
          first.razorpayPaymentId && first.razorpayPaymentId !== "CASH"
            ? first.razorpayPaymentId
            : null,
        paymentDate: first.paymentDate.toISOString(),
        months: run.length,
        periodStart: first.billingPeriodStart.toISOString(),
        periodEnd: last.billingPeriodEnd.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Advance Payments</h1>
        <p className="text-muted-foreground">
          Maintenance charges paid in advance for future months. Download the receipt for any payment.
        </p>
      </div>
      <MaintenanceAdvancePaymentsTable initialData={initialData} />
    </main>
  );
}
