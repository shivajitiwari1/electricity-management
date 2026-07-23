import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceGenerator from "@/components/admin/maintenance-generator";

export const dynamic = "force-dynamic";

export default async function MaintenanceGeneratePage() {
  const session = await auth();
  const role = (session?.user as any)?.role as string;
  if (role !== "ADMIN") redirect("/admin/maintenance");

  const [currentRate, connections] = await Promise.all([
    prisma.maintenanceRate.findFirst({
      where: { effectiveFrom: { lte: new Date() } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.connection.findMany({
      where: { status: "ACTIVE" },
      include: {
        resident: { include: { user: { select: { name: true } } } },
      },
      orderBy: { flatNo: "asc" },
    }),
  ]);

  const connectionPreviews = connections.map((c) => ({
    flatNo: c.flatNo,
    residentName: c.resident.user.name ?? "—",
    unitArea: c.unitArea,
    projectedAmount: currentRate
      ? (c.unitArea * Number(currentRate.ratePerSqFt)).toFixed(2)
      : "0",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Maintenance Bill Scheduler</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raise monthly maintenance bills for all active connections. Bills are also auto-generated on the last day of each month.
        </p>
      </div>
      <MaintenanceGenerator
        currentRatePerSqFt={currentRate ? currentRate.ratePerSqFt.toString() : null}
        connections={connectionPreviews}
      />
    </div>
  );
}
