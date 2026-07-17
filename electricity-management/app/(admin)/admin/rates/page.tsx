import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import RatesTable from "@/components/admin/rates-table";
import { TableSkeleton } from "@/components/ui/page-skeleton";

export const revalidate = 3600; // rates rarely change

async function RatesData() {
  const rates = await prisma.rate.findMany({ orderBy: { effectiveFrom: "desc" } });
  const serializedRates = rates.map((r) => ({
    id: r.id,
    ncplPerUnit: r.ncplPerUnit.toString(),
    dgFixed: r.dgFixed.toString(),
    fixedPerKw: r.fixedPerKw.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
  }));
  return <RatesTable rates={serializedRates} />;
}

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Electricity Rates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage NPCL and DG electricity rates
        </p>
      </div>
      <Suspense fallback={<TableSkeleton rows={4} cols={5} showSearch={false} />}>
        <RatesData />
      </Suspense>
    </div>
  );
}
