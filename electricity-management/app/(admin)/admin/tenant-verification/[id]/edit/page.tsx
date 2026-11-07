import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import TenantVerificationEditForm from "@/components/admin/tenant-verification-edit-form";

export const dynamic = "force-dynamic";

export default async function TenantVerificationEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  let application: any = null;
  let connections: Array<{ id: string; flatNo: string; tower: string; residentName: string | null }> = [];
  let dbError: string | null = null;

  try {
    application = await prisma.tenantApplication.findUnique({
      where: { id },
      include: {
        connection: { select: { id: true, flatNo: true, tower: true } },
      },
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
      dbError =
        "The Tenant Verification database tables are not yet created. Apply the migration (prisma/migrations/20261105_add_tenant_verification) before using this module.";
    } else {
      dbError = `Could not load application: ${error?.message ?? "unknown error"}`;
    }
  }

  if (!application && !dbError) {
    redirect("/admin/tenant-verification");
  }

  // Non-ADMIN users can only edit PENDING (draft) applications
  if (application && application.status !== "PENDING" && role !== "ADMIN") {
    redirect(`/admin/tenant-verification/${id}`);
  }

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
  } catch {
    // connections optional; form will show empty select
  }

  if (dbError) {
    return (
      <div className="space-y-6 px-5 py-4">
        <div className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          <Link
            href="/admin/tenant-verification"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to Applications
          </Link>
        </div>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Tenant Verification is not fully set up yet</p>
          <p className="mt-1">{dbError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-5 py-4">
      <TenantVerificationEditForm
        application={application as any}
        connections={connections}
      />
    </div>
  );
}
