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
    // meter reading details
    readingDate: b.meterReading?.readingDate?.toISOString() ?? null,
    ncplPrevious: b.meterReading?.ncplPrevious?.toString() ?? "0",
    ncplCurrent: b.meterReading?.ncplCurrent?.toString() ?? "0",
    ncplUnits: b.ncplUnits.toString(),
    dgPrevious: b.meterReading?.dgPrevious?.toString() ?? "0",
    dgCurrent: b.meterReading?.dgCurrent?.toString() ?? "0",
    dgUnits: b.meterReading?.dgUnits?.toString() ?? "0",
    // charges
    ratePerUnit: b.ratePerUnit.toString(),
    ncplCharge: b.ncplCharge.toString(),
    dgCharge: b.dgCharge.toString(),
    fixedCharge: b.fixedCharge.toString(),
    previousDues: b.previousDues.toString(),
    totalAmount: b.totalAmount.toString(),
    status: b.status,
    paymentId: b.payments[0]?.id ?? null,
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
