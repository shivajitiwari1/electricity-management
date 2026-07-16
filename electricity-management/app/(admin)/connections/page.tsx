import { prisma } from "@/lib/prisma";
import ConnectionsTable from "@/components/admin/connections-table";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const connections = await prisma.connection.findMany({
    include: {
      resident: { include: { user: { select: { name: true, email: true } } } },
    },
    orderBy: { tower: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Connections</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage electricity connections for all flats
        </p>
      </div>
      <ConnectionsTable initialData={connections} />
    </div>
  );
}
