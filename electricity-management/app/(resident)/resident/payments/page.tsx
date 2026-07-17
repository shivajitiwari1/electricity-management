import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PaymentHistoryTable from "@/components/resident/payment-history-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export const dynamic = "force-dynamic";

async function ResidentPaymentsData() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: { connections: { include: { bills: { include: { payments: true } } } } },
  });

  if (!resident) redirect("/login");

  const payments = resident.connections
    .flatMap((c) =>
      c.bills.flatMap((b) =>
        b.payments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          billNumber: b.billNumber,
          flatNo: c.flatNo,
          amount: Number(p.amount),
          paymentDate: p.paymentDate.toISOString(),
          method: p.method,
          razorpayPaymentId: p.razorpayPaymentId ?? null,
          status: p.status,
        }))
      )
    )
    .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());

  return <PaymentHistoryTable payments={payments} />;
}

export default function ResidentPaymentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="text-gray-500 text-sm mt-1">All your electricity bill payments</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={5} showSearch={false} />}>
        <ResidentPaymentsData />
      </Suspense>
    </div>
  );
}
