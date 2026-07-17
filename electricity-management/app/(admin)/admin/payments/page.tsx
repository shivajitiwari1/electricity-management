import { Suspense } from "react";
import PaymentsTable from "@/components/admin/payments-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";
import { getCachedPaymentsData } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

async function PaymentsData() {
  const { payments, pendingBills } = await getCachedPaymentsData();

  const serializedPayments = payments.map((p) => ({
    id: p.id,
    receiptNumber: p.receiptNumber,
    flatNo: p.bill.connection.flatNo,
    residentName: p.bill.connection.resident.user.name,
    billNumber: p.bill.billNumber,
    amount: p.amount.toString(),
    paymentDate: p.paymentDate.toISOString(),
    method: p.method,
    status: p.status,
    razorpayPaymentId: p.razorpayPaymentId ?? null,
  }));

  const serializedPendingBills = pendingBills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    residentName: b.connection.resident.user.name,
    totalAmount: b.totalAmount.toString(),
    paidAmount: b.paidAmount.toString(),
    dueDate: b.dueDate.toISOString(),
    status: b.status,
  }));

  return <PaymentsTable initialData={serializedPayments} pendingBills={serializedPendingBills} />;
}

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          View all payment transactions for Oasis Venetia Heights
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={10} cols={6} showSearch showFilters filterCount={2} />}>
        <PaymentsData />
      </Suspense>
    </div>
  );
}
