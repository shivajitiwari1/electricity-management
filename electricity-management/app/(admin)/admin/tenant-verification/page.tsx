import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import TenantVerificationToggle from "@/components/admin/tenant-verification-toggle";
import TenantVerificationList from "@/components/admin/tenant-verification-list";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function TenantVerificationPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER") {
    redirect("/login");
  }

  const guard = await guardPermission(
    session as any,
    "tenant-verification",
    "canRead"
  );
  if (guard) {
    redirect("/admin/dashboard");
  }

  const canWrite =
    role === "ADMIN" ||
    ((session.user as any).permissions?.["tenant-verification"]?.canWrite === true);

  let siteConfig: { tenantVerificationEnabled: boolean } | null = null;
  try {
    siteConfig = await prisma.siteConfig.findUnique({
      where: { id: "singleton" },
      select: { tenantVerificationEnabled: true },
    });
  } catch {
    siteConfig = null;
  }

  let applications: any[] = [];
  let dbError: string | null = null;
  try {
    applications = await prisma.tenantApplication.findMany({
      include: {
        resident: { include: { user: { select: { name: true, email: true } } } },
        connection: { select: { flatNo: true, tower: true } },
        _count: { select: { documents: true, family: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      dbError =
        "The Tenant Verification database tables are not yet created. Apply the migration (prisma/migrations/20261105_add_tenant_verification) before using this module.";
    } else {
      dbError = `Could not load applications: ${error?.message ?? "unknown error"}`;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenant Verification</h1>
          <p className="text-muted-foreground">
            Manage tenant verification applications for flats in the society. Configure how
            tenants verify their contact details at Settings.
          </p>
        </div>
        {!dbError && canWrite && (
          <Link href="/admin/tenant-verification/new" className="flex items-center">
            <Button>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Register Tenant
            </Button>
          </Link>
        )}
      </div>

      {dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Tenant Verification is not fully set up yet</p>
          <p className="mt-1">{dbError}</p>
        </div>
      ) : null}

      <TenantVerificationToggle initialEnabled={siteConfig?.tenantVerificationEnabled ?? false} />

      {!dbError && <TenantVerificationList applications={applications} />}
    </div>
  );
}
