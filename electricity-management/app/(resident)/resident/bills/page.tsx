import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import ResidentBillsList from "@/components/resident/bills-list";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export const dynamic = "force-dynamic";

async function ResidentBillsData() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      connections: {
        include: {
          bills: {
            orderBy: { billDate: "desc" },
            include: {
              meterReading: true,
              payments: { orderBy: { paymentDate: "desc" as const }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  const bills = resident.connections.flatMap((conn) =>
    conn.bills.map((bill) => ({
      id: bill.id,
      billNumber: bill.billNumber,
      flatNo: conn.flatNo,
      billingPeriodStart: bill.billingPeriodStart.toISOString(),
      billingPeriodEnd: bill.billingPeriodEnd.toISOString(),
      ncplUnits: Number(bill.ncplUnits),
      totalAmount: Number(bill.totalAmount),
      dueDate: bill.dueDate.toISOString(),
      status: bill.status,
      paymentId: bill.payments[0]?.id ?? null,
    }))
  );

  return <ResidentBillsList bills={bills} />;
}

export default function ResidentBillsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Bills</h1>
        <p className="text-gray-500 text-sm mt-1">View and pay your electricity bills</p>
      </div>
      <Suspense fallback={<TableSkeleton rows={8} cols={5} showSearch showFilters filterCount={1} />}>
        <ResidentBillsData />
      </Suspense>
    </div>
  );
}
