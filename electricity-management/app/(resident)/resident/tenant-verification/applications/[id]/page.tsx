export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DocumentUpload from "@/components/tenant-verification/document-upload";

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
  if (role !== "RESIDENT") {
    redirect("/login");
  }

  const userId = String((session.user as any).id ?? "");
  const userEmail = (session.user as any).email as string | undefined;

  const application = await prisma.tenantApplication.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          verified: true,
          createdAt: true,
        },
      },
      family: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          fullName: true,
          relation: true,
          age: true,
          idProof: true,
          createdAt: true,
        },
      },
      vehicles: {
        orderBy: { createdAt: "asc" as const },
        select: {
          id: true,
          vehicleType: true,
          registrationNo: true,
          stickerRfidNo: true,
          createdAt: true,
        },
      },
    },
  });

  if (!application) {
    redirect("/resident/tenant-verification/applications");
  }

  // Ownership check
  const ownsApplication =
    application.residentId === userId ||
    application.tenantEmail === userEmail ||
    application.tenantPhone === (application.tenantPhone || "");

  if (!ownsApplication) {
    redirect("/login");
  }

  const canDownloadPDF =
    application.status === "MANAGEMENT_APPROVED" ||
    application.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Application {application.applicationNumber}
          </h1>
          <p className="text-muted-foreground">
            View and manage your tenant verification application.
          </p>
        </div>
        <div className="flex gap-2">
          {canDownloadPDF && (
            <Link href={`/api/tenant-verification/applications/${id}/pdf`}>
              <Button>Download Certificate</Button>
            </Link>
          )}
          <Link href="/resident/tenant-verification/applications">
            <Button variant="outline">Back to Applications</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle>Application Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Tenant Name</p>
                <p className="font-medium">{application.tenantName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Flat</p>
                <p className="font-medium">{application.tower}-{application.flatNo}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="font-medium">{application.tenantPhone}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{application.tenantEmail || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Move-in Date</p>
                <p className="font-medium">
                  {application.moveInDate ? new Date(application.moveInDate).toLocaleDateString("en-IN") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tenancy From</p>
                <p className="font-medium">
                  {application.tenancyFrom ? new Date(application.tenancyFrom).toLocaleDateString("en-IN") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tenancy To</p>
                <p className="font-medium">
                  {application.tenancyTo ? new Date(application.tenancyTo).toLocaleDateString("en-IN") : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Permanent Address</p>
                <p className="font-medium">{application.permanentAddress || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Emergency Contact</p>
                <p className="font-medium">{application.emergencyContactName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Emergency Phone</p>
                <p className="font-medium">{application.emergencyContactMobile || "—"}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{formatStatus(application.status)}</Badge>
                <p className="text-sm text-muted-foreground">
                  {formatStatusDescription(application.status)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {application.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {application.documents.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{doc.documentType}</span>
                      <span className="text-xs">{doc.verified ? "✓ Verified" : "Pending"}</span>
                    </div>
                    <Link
                      href={`/api/tenant-verification/applications/${id}/documents/${doc.id}`}
                      className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
                    >
                      Download
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <DocumentUpload
          applicationId={id}
          existingDocuments={application.documents}
          phone={application.tenantPhone || undefined}
        />

        <Card>
          <CardHeader>
            <CardTitle>Family Members</CardTitle>
          </CardHeader>
          <CardContent>
            {application.family.length === 0 ? (
              <p className="text-sm text-muted-foreground">No family members added.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {application.family.map((member) => (
                  <li key={member.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{member.fullName}</p>
                      <p className="text-xs text-muted-foreground">{member.relation}</p>
                    </div>
                    <span className="text-xs">{member.age || "—"} years</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicles</CardTitle>
          </CardHeader>
          <CardContent>
            {application.vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No vehicles declared.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {application.vehicles.map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{v.vehicleType || "Vehicle"}</p>
                      <p className="text-xs text-muted-foreground">{v.registrationNo || "—"}</p>
                    </div>
                    <span className="text-xs">{v.stickerRfidNo || "Not assigned"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
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

function formatStatusDescription(status: string): string {
  const map: Record<string, string> = {
    PENDING: "Application is being drafted",
    DOCUMENTS_SUBMITTED: "Submitted for owner review",
    OWNER_APPROVED: "Approved by flat owner",
    OWNER_REJECTED: "Rejected by flat owner",
    POLICE_VERIFICATION_PENDING: "Awaiting police verification",
    POLICE_VERIFIED: "Police verification complete",
    POLICE_VERIFICATION_FAILED: "Police verification failed",
    MANAGEMENT_APPROVED: "Approved by management",
    MANAGEMENT_REJECTED: "Rejected by management",
    ACTIVE: "Verification active",
    INACTIVE: "Withdrawn",
  };
  return map[status] || "";
}
