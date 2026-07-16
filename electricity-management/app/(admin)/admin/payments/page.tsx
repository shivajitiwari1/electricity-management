import { prisma } from "@/lib/prisma";
import PaymentsTable from "@/components/admin/payments-table";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
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
    orderBy: { createdAt: "desc" },
    take: 100,
  });

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500 mt-1">
          View all payment transactions for Oasis Venetia Heights
        </p>
      </div>
      <PaymentsTable initialData={serializedPayments} />
    </div>
  );
}
