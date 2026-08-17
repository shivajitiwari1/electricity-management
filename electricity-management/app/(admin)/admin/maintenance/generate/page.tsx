import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MaintenanceGenerator from "@/components/admin/maintenance-generator";
import type { PermissionsMap } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MaintenanceGeneratePage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  const permissions = (session.user as any)?.permissions as PermissionsMap ?? {};
  if (role !== "ADMIN" && !permissions["maintenance"]?.canWrite) redirect("/admin/dashboard");

  const [latestRate, connections] = await Promise.all([
    prisma.maintenanceRate.findFirst({ orderBy: { effectiveFrom: "desc" } }),
    prisma.connection.findMany({
      where: { status: "ACTIVE" },
      include: { resident: { include: { user: { select: { name: true } } } } },
      orderBy: [{ tower: "asc" }, { flatNo: "asc" }],
    }),
  ]);

  const connectionPreviews = connections.map((c) => ({
    id: c.id,
    flatNo: c.flatNo,
    tower: c.tower,
    residentName: c.resident?.user?.name ?? "—",
    unitArea: c.unitArea,
    projectedAmount: latestRate
      ? String(Math.round(Number(latestRate.ratePerSqFt) * c.unitArea))
      : "0",
  }));

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Generate Maintenance Bills</h1>
        <p className="text-muted-foreground">Generate bills for all or individual flats</p>
      </div>
      <MaintenanceGenerator
        currentRatePerSqFt={latestRate ? latestRate.ratePerSqFt.toString() : null}
        connections={connectionPreviews}
      />
    </main>
  );
}
