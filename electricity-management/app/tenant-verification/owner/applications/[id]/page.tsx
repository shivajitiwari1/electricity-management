export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default async function OwnerApplicationDetailPage({
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
  if (role !== "ADMIN" && role !== "MANAGER" && role !== "RESIDENT") {
    redirect("/login");
  }

  const userId = String((session.user as any).id ?? "");

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
    redirect("/tenant-verification/owner");
  }

  // Owner authorization: must own the flat
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: {
      id: true,
      connections: {
        select: { id: true },
      },
    },
  });

  const ownsFlat = resident?.connections.some((c) => c.id === application.connectionId) || false;

  if (!ownsFlat) {
    redirect("/login");
  }

  const canDecide =
    application.status === "DOCUMENTS_SUBMITTED" ||
    application.status === "OWNER_APPROVED";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Application {application.applicationNumber}
          </h1>
          <p className="text-muted-foreground">
            Review and make a decision on this tenant verification application.
          </p>
        </div>
        <Link href="/tenant-verification/owner">
          <Button variant="outline">Back to Applications</Button>
        </Link>
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
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground font-medium">Status</p>
              <Badge variant="secondary">{formatStatus(application.status)}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner Decision</CardTitle>
          </CardHeader>
          <CardContent>
            {!canDecide ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>You cannot make a decision on this application at this stage.</p>
                <p className="text-sm mt-2">
                  Current status: {formatStatus(application.status)}
                </p>
              </div>
            ) : (
              <form className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Decision *</label>
                    <div className="flex gap-4 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="decision"
                          value="approve"
                          className="form-radio"
                        />
                        <span>Approve</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="decision"
                          value="reject"
                          className="form-radio"
                        />
                        <span>Reject</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Remarks *</label>
                    <Textarea
                      rows={4}
                      placeholder="Enter your reasons for this decision..."
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Submit Decision
                  </Button>
                </div>
              </form>
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
