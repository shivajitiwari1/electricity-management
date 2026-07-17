import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import BillsTable from "@/components/admin/bills-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export const dynamic = "force-dynamic";

interface SearchParams { tower?: string; month?: string; status?: string }

async function BillsData({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const { tower, month, status } = params;

  let dateFilter: { gte: Date; lt: Date } | undefined;
  if (month) {
    const [year, mon] = month.split("-").map(Number);
    dateFilter = { gte: new Date(year, mon - 1, 1), lt: new Date(year, mon, 1) };
  }

  const bills = await prisma.bill.findMany({
    where: {
      ...(tower ? { connection: { tower } } : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(status ? { status: status as any } : {}),
      ...(dateFilter ? { billDate: dateFilter } : {}),
    },
    include: {
      connection: { include: { resident: { include: { user: { select: { name: true } } } } } },
      meterReading: true,
      payments: { select: { id: true, status: true }, orderBy: { paymentDate: "desc" as const }, take: 1 },
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
    meterNo: b.connection.meterNo ?? null,
    sanctionedLoad: b.connection.sanctionedLoad.toString(),
    unitArea: b.connection.unitArea,
    billDate: b.billDate.toISOString(),
    dueDate: b.dueDate.toISOString(),
    billingPeriodStart: b.billingPeriodStart.toISOString(),
    billingPeriodEnd: b.billingPeriodEnd.toISOString(),
    readingDate: b.meterReading?.readingDate?.toISOString() ?? null,
    ncplPrevious: b.meterReading?.ncplPrevious?.toString() ?? "0",
    ncplCurrent: b.meterReading?.ncplCurrent?.toString() ?? "0",
    ncplUnits: b.ncplUnits.toString(),
    dgPrevious: b.meterReading?.dgPrevious?.toString() ?? "0",
    dgCurrent: b.meterReading?.dgCurrent?.toString() ?? "0",
    dgUnits: b.meterReading?.dgUnits?.toString() ?? "0",
    ratePerUnit: b.ratePerUnit.toString(),
    ncplCharge: b.ncplCharge.toString(),
    dgCharge: b.dgCharge.toString(),
    fixedCharge: b.fixedCharge.toString(),
    previousDues: b.previousDues.toString(),
    totalAmount: b.totalAmount.toString(),
    status: b.status,
    paymentId: b.payments[0]?.id ?? null,
  }));

  return <BillsTable initialData={serializedBills} />;
}

export default function BillsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bills</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage electricity bills for Oasis Venetia Heights
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={10} cols={7} showSearch showFilters filterCount={3} />}>
        <BillsData searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
