import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ResidentNav from "@/components/resident/top-nav";
import IdleTimeout from "@/components/idle-timeout";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user as any).role !== "RESIDENT") redirect("/login");

  const siteConfig = await prisma.siteConfig.findUnique({ where: { id: "singleton" } });
  const maintenanceEnabled = siteConfig?.maintenanceBillingEnabled ?? false;
  const helpDeskEnabled = siteConfig?.helpDeskEnabled ?? false;
  const tenantVerificationEnabled = siteConfig?.tenantVerificationEnabled ?? false;

  return (
    <div className="min-h-screen bg-background">
      <ResidentNav user={session.user} maintenanceEnabled={maintenanceEnabled} helpDeskEnabled={helpDeskEnabled} tenantVerificationEnabled={tenantVerificationEnabled} />
      <main className="px-5 py-4">
        {children}
      </main>
      <IdleTimeout />
    </div>
  );
}
