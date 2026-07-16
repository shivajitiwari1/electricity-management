import { prisma } from "@/lib/prisma";
import ResidentsTable from "@/components/admin/residents-table";

export const dynamic = "force-dynamic";

export default async function ResidentsPage() {
  const residents = await prisma.resident.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      connections: { select: { id: true, flatNo: true, tower: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Residents</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage residents of Oasis Venetia Heights
        </p>
      </div>
      <ResidentsTable initialData={residents} />
    </div>
  );
}
