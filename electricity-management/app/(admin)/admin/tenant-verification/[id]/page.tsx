import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { guardPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import TenantVerificationDetail from "@/components/shared/tenant-verification-detail";
import TenantVerificationActions from "@/components/admin/tenant-verification-actions";

export const dynamic = "force-dynamic";

export default async function TenantVerificationDetailPage({
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
    "canRead"
  );
  if (guard) {
    redirect("/admin/dashboard");
  }

  const canWrite =
    role === "ADMIN" ||
    ((session.user as any).permissions?.["tenant-verification"]?.canWrite === true);

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      resident: { include: { user: { select: { name: true, email: true } } } },
      connection: { select: { flatNo: true, tower: true } },
      documents: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          verified: true,
          verifiedBy: true,
          verifiedAt: true,
          createdAt: true,
          // `data` (binary blob) is excluded — it's passed to a client
          // component and cannot be serialized by RSC. Download fetches it
          // separately via /api/tenant-verification/applications/[id]/documents/[docId].
        },
      },
      family: { orderBy: { createdAt: "asc" as const } },
      auditLogs: {
        orderBy: { createdAt: "desc" as const },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!application) {
    redirect("/admin/tenant-verification");
  }

  const isDraft = application.status === "PENDING";
  const canEdit = isDraft ? canWrite : role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Application {application.applicationNumber}</h1>
          <p className="text-muted-foreground">
            View and manage this tenant verification application.
          </p>
        </div>
        <TenantVerificationActions
          id={id}
          applicationNumber={application.applicationNumber}
          canEdit={canEdit}
          role={role}
          canDelete={role === "ADMIN"}
        />
      </div>

      <TenantVerificationDetail
        application={application as any}
        isResident={false}
        canWrite={canWrite}
        canDelete={role === "ADMIN"}
      />
    </div>
  );
}
