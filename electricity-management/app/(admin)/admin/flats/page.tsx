import { prisma } from "@/lib/prisma";
import FlatInfoTable from "@/components/admin/flat-info-table";

export const dynamic = "force-dynamic";

export default async function FlatsPage() {
  const flats = await prisma.flatInfo.findMany({
    orderBy: [{ tower: "asc" }, { flatNo: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Flat Info</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage flat master data for Oasis Venetia Heights
        </p>
      </div>
      <FlatInfoTable initialData={flats} />
    </div>
  );
}
