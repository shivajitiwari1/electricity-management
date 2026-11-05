export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TenantVerificationApplicationsPage() {
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

  const applications = await prisma.tenantApplication.findMany({
    where: {
      OR: [
        { residentId: userId },
        { tenantEmail: userEmail },
      ],
    },
    include: {
      _count: {
        select: { documents: true, family: true, vehicles: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Applications</h1>
          <p className="text-muted-foreground">
            Track the status of your tenant verification applications.
          </p>
        </div>
        <Link href="/resident/tenant-verification/register">
          <Button>New Application</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No applications found.</p>
              <p className="text-sm mt-2">
                Start your first tenant verification application.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application No.</TableHead>
                  <TableHead>Flat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-medium">
                      {app.applicationNumber}
                    </TableCell>
                    <TableCell>
                      {app.tower}-{app.flatNo}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatStatus(app.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {app.createdAt?.toLocaleDateString("en-IN") || "—"}
                    </TableCell>
                    <TableCell className="text-center">{app._count.documents}</TableCell>
                    <TableCell className="text-center">{app._count.family}</TableCell>
                    <TableCell>
                      <Link
                        href={`/resident/tenant-verification/applications/${app.id}`}
                        className="text-sm text-primary underline underline-offset-4 hover:text-primary-foreground"
                      >
                        View Details
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
