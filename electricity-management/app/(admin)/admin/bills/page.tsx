import { prisma } from "@/lib/prisma";
import BillsTable from "@/components/admin/bills-table";

export const dynamic = "force-dynamic";

interface SearchParams {
  tower?: string;
  month?: string;
  status?: string;
}

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tower = params.tower;
  const month = params.month;
  const status = params.status;

  const where: Record<string, unknown> = {};
  if (tower) where.connection = { tower };
  if (status) where.status = status;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    where.billDate = {
      gte: new Date(year, mon - 1, 1),
      lt: new Date(year, mon, 1),
    };
  }

  const bills = await prisma.bill.findMany({
    where,
    include: {
      connection: {
        include: {
          resident: { include: { user: { select: { name: true } } } },
        },
      },
      payment: { select: { id: true, status: true } },
    },
    orderBy: { billDate: "desc" },
    take: 100,
  });

  const serializedBills = bills.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    flatNo: b.connection.flatNo,
    tower: b.connection.tower,
    residentName: b.connection.resident.user.name,
    billDate: b.billDate.toISOString(),
    dueDate: b.dueDate.toISOString(),
    billingPeriodStart: b.billingPeriodStart.toISOString(),
    billingPeriodEnd: b.billingPeriodEnd.toISOString(),
    totalAmount: b.totalAmount.toString(),
    status: b.status,
    paymentId: b.payment?.id ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage electricity bills for Oasis Venetia Heights
        </p>
      </div>
      <BillsTable initialData={serializedBills} />
    </div>
  );
}
