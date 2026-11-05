export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TenantVerificationPdfPage({
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
  const userId = String((session.user as any).id ?? "");
  const userEmail = (session.user as any).email as string | undefined;

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      tenantName: true,
      tenantPhone: true,
      tenantEmail: true,
      residentId: true,
    },
  });

  if (!application) {
    redirect("/resident/tenant-verification/applications");
  }

  // Ownership check
  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === application.tenantPhone;

  if (!ownsApplication) {
    redirect("/login");
  }

  const canDownload =
    application.status === "MANAGEMENT_APPROVED" ||
    application.status === "ACTIVE";

  if (!canDownload) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Certificate Not Available</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The verification certificate is only available after management approval.
              Current status: {formatStatus(application.status)}.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Please wait for management to review and approve your application.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Redirect to the PDF API endpoint which generates and serves the PDF
  redirect(`/api/tenant-verification/applications/${id}/pdf`);
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Draft",
    DOCUMENTS_SUBMITTED: "Submitted",
    OWNER_APPROVED: "Owner Approved",
    OWNER_REJECTED: "Owner Rejected",
    POLICE_VERIFICATION_PENDING: "Police Verification Pending",
    POLICE_VERIFIED: "Police Verified",
    POLICE_VERIFICATION_FAILED: "Police Verification Failed",
    MANAGEMENT_APPROVED: "Management Approved",
    MANAGEMENT_REJECTED: "Management Rejected",
    ACTIVE: "Active",
    INACTIVE: "Inactive",
  };
  return map[status] || status;
}
