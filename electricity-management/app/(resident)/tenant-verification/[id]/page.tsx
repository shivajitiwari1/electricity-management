import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TenantVerificationDetail from "@/components/shared/tenant-verification-detail";

export const dynamic = "force-dynamic";

export default async function ResidentTenantVerificationDetailPage({
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
  if (role !== "RESIDENT") {
    redirect("/login");
  }

  const userId = String((session.user as any).id ?? "");
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: { id: true },
  });

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      resident: { include: { user: { select: { name: true, email: true } } } },
      connection: { select: { flatNo: true, tower: true } },
      documents: { orderBy: { createdAt: "asc" as const } },
      family: { orderBy: { createdAt: "asc" as const } },
      auditLogs: {
        orderBy: { createdAt: "desc" as const },
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!application) {
    redirect("/resident/tenant-verification");
  }

  if (!resident || resident.id !== application.residentId) {
    redirect("/login");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Application {application.applicationNumber}</h1>
        <p className="text-muted-foreground">
          View the status of your tenant verification application.
        </p>
      </div>

      <TenantVerificationDetail
        application={application as any}
        isResident={true}
        canWrite={false}
        canDelete={false}
      />
    </div>
  );
}
