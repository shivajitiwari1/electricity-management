import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { PermissionsMap } from "@/lib/permissions";
import MaintenanceRatesManager from "@/components/admin/maintenance-rates-manager";
import GstRatesManager from "@/components/admin/gst-rates-manager";
import MaintenanceBillingToggle from "@/components/admin/maintenance-billing-toggle";

export const dynamic = "force-dynamic";

export default async function MaintenanceRatesPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const role = (session.user as any)?.role as string;
  const permissions = (session.user as any)?.permissions as PermissionsMap ?? {};
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/login");
  if (role === "MANAGER" && !permissions["maintenance"]?.canRead) redirect("/admin/dashboard");

  const [rates, siteConfig] = await Promise.all([
    prisma.maintenanceRate.findMany({ orderBy: { effectiveFrom: "desc" } }),
    prisma.siteConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", maintenanceMode: false, maintenanceBillingEnabled: false, cgstRate: 9, sgstRate: 9 },
      update: {},
    }),
  ]);

  const serialized = rates.map((r) => ({
    id: r.id,
    ratePerSqFt: r.ratePerSqFt.toString(),
    effectiveFrom: r.effectiveFrom.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Maintenance Rates</h1>
        <p className="text-muted-foreground">Configure per sq.ft. charges and GST rates</p>
      </div>
      <MaintenanceBillingToggle initialEnabled={siteConfig.maintenanceBillingEnabled} />
      <MaintenanceRatesManager rates={serialized} />
      <GstRatesManager
        initialCgst={Number(siteConfig.cgstRate)}
        initialSgst={Number(siteConfig.sgstRate)}
      />
    </main>
  );
}
