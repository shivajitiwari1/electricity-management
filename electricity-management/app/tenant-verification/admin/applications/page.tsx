export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AdminApplicationsPage() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const role = (session.user as any).role as string;
  const guard = await guardPermission(session as any, "tenant-verification", "canRead");
  if (guard) {
    redirect("/admin/dashboard");
  }

  const disabled = await guardTenantVerificationEnabled();
  if (disabled) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Verification Disabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Tenant Verification module is disabled. Enable it from the admin settings to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const applications = await prisma.tenantApplication.findMany({
    include: {
      _count: {
        select: { documents: true, family: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Applications</h1>
          <p className="text-muted-foreground">
            Review and manage all tenant verification applications.
          </p>
        </div>
        <Link href="/tenant-verification/admin">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No applications found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application No.</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">{app.applicationNumber}</TableCell>
                    <TableCell>{app.tenantName}</TableCell>
                    <TableCell>{app.tower}-{app.flatNo}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{formatStatus(app.status)}</Badge>
                    </TableCell>
                    <TableCell>{app.createdAt?.toLocaleDateString("en-IN") || "—"}</TableCell>
                    <TableCell>
                      <Link
                        href={`/tenant-verification/admin/applications/${app.id}`}
                        className="text-sm text-primary underline underline-offset-4 hover:text-primary-foreground"
                      >
                        Review
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
