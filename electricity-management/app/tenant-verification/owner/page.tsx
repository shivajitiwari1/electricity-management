export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function OwnerTenantVerificationPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  if (role !== "ADMIN" && role !== "MANAGER" && role !== "RESIDENT") {
    redirect("/login");
  }

  const userId = String((session.user as any).id ?? "");

  // Get owner's flats
  const resident = await prisma.resident.findUnique({
    where: { userId },
    select: {
      id: true,
      connections: {
        select: {
          id: true,
          flatNo: true,
          tower: true,
        },
      },
    },
  });

  const connections = resident?.connections || [];
  const flatIds = connections.map((c) => c.id);

  // Get applications for owner's flats
  const applications = await prisma.tenantApplication.findMany({
    where: {
      connectionId: { in: flatIds },
    },
    include: {
      _count: {
        select: { documents: true, family: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Calculate stats
  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "PENDING" || a.status === "DOCUMENTS_SUBMITTED").length,
    ownerPending: applications.filter((a) => a.status === "OWNER_APPROVED" || a.status === "POLICE_VERIFICATION_PENDING").length,
    approved: applications.filter((a) => a.status === "MANAGEMENT_APPROVED" || a.status === "ACTIVE").length,
    rejected: applications.filter((a) => a.status === "OWNER_REJECTED" || a.status === "MANAGEMENT_REJECTED").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tenant Verification</h1>
        <p className="text-muted-foreground">
          Manage tenant verification applications for your flats.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <p className="text-sm text-muted-foreground">
            Applications for your flats: {connections.map((c) => `${c.tower}-${c.flatNo}`).join(", ")}
          </p>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No applications found for your flats.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2 text-left">Application No.</th>
                    <th className="px-3 py-2 text-left">Tenant</th>
                    <th className="px-3 py-2 text-left">Flat</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr key={app.id} className="border-b hover:bg-muted/50">
                      <td className="px-3 py-2 font-medium">{app.applicationNumber}</td>
                      <td className="px-3 py-2">{app.tenantName}</td>
                      <td className="px-3 py-2">{app.tower}-{app.flatNo}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">{formatStatus(app.status)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/tenant-verification/owner/applications/${app.id}`}
                          className="text-sm text-primary underline underline-offset-4 hover:text-primary-foreground"
                        >
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
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
