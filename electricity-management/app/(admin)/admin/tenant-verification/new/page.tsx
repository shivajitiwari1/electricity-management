export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ApplicationWizard from "@/components/tenant-verification/application-wizard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEnforcedChannels, tenantVerificationEnabled } from "@/lib/tenant-verification-config";

export default async function AdminTenantVerificationNewPage() {
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
    "canWrite"
  );
  if (guard) {
    redirect("/admin/dashboard");
  }

  let enabled = false;
  try {
    enabled = await tenantVerificationEnabled();
  } catch {
    enabled = false;
  }

  let connections: Array<{ id: string; flatNo: string; tower: string; residentName: string | null }> = [];
  let dbError: string | null = null;
  if (enabled) {
    try {
      const rows = await prisma.connection.findMany({
        select: {
          id: true,
          flatNo: true,
          tower: true,
          resident: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ tower: "asc" }, { flatNo: "asc" }],
      });
      connections = rows.map((c) => ({
        id: c.id,
        flatNo: c.flatNo,
        tower: c.tower,
        residentName: c.resident?.user?.name ?? null,
      }));
    } catch (error: any) {
      if (error?.code === "P2021") {
        dbError =
          "The Tenant Verification database tables are not yet created. Apply the migration (prisma/migrations/20261105_add_tenant_verification) before using this module.";
      } else {
        dbError = `Could not load flats: ${error?.message ?? "unknown error"}`;
      }
    }
  }

  // Only require verification for channels the admin enabled *and* that can deliver.
  let verificationChannels = { email: false, phone: false };
  if (enabled && !dbError) {
    try {
      verificationChannels = await getEnforcedChannels();
    } catch {
      verificationChannels = { email: false, phone: false };
    }
  }

  return (
    <div className="space-y-6 px-5 py-4">
      <div>
        <Link
          href="/admin/tenant-verification"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Register Tenant</h1>
        <p className="text-muted-foreground">
          Create a tenant verification application on behalf of any resident or owner
          in the society. The application is recorded against the owner of the selected
          flat.
        </p>
      </div>

      {!enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Tenant Verification Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Tenant Verification module is disabled. Enable it from the admin{" "}
              <Link href="/admin/tenant-verification" className="text-primary hover:underline">
                Tenant Verification page
              </Link>{" "}
              before registering a tenant.
            </p>
          </CardContent>
        </Card>
      ) : dbError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Tenant Verification is not fully set up yet</p>
          <p className="mt-1">{dbError}</p>
        </div>
      ) : connections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Flats Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              No flats are registered in the society yet. Add a flat from Flat Info
              before registering a tenant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ApplicationWizard
          connections={connections}
          verificationChannels={verificationChannels}
          successRedirectBase="/admin/tenant-verification"
        />
      )}
    </div>
  );
}
