export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import PaymentHistoryTable from "@/components/resident/payment-history-table";

export default async function ResidentPaymentsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      connections: {
        include: {
          bills: {
            include: { payment: true },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  // Serialize payments from all connections
  const payments = resident.connections
    .flatMap((c) =>
      c.bills
        .filter((b) => b.payment !== null)
        .map((b) => ({
          id: b.payment!.id,
          receiptNumber: b.payment!.receiptNumber,
          billNumber: b.billNumber,
          flatNo: c.flatNo,
          amount: Number(b.payment!.amount),
          paymentDate: b.payment!.paymentDate.toISOString(),
          method: b.payment!.method,
          razorpayPaymentId: b.payment!.razorpayPaymentId ?? null,
          status: b.payment!.status,
        }))
    )
    .sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
        <p className="text-gray-500 text-sm mt-1">
          All your electricity bill payments
        </p>
      </div>
      <PaymentHistoryTable payments={payments} />
    </div>
  );
}
