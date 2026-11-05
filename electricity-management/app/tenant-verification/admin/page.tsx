export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { guardPermission } from "@/lib/permissions";
import { guardTenantVerificationEnabled } from "@/lib/tenant-verification-config";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminTenantVerificationPage() {
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

  // Get stats
  const [total, pending, ownerPending, approved, rejected] = await Promise.all([
    prisma.tenantApplication.count(),
    prisma.tenantApplication.count({ where: { status: { in: ["PENDING", "DOCUMENTS_SUBMITTED"] } } }),
    prisma.tenantApplication.count({ where: { status: { in: ["OWNER_APPROVED", "POLICE_VERIFICATION_PENDING"] } } }),
    prisma.tenantApplication.count({ where: { status: { in: ["MANAGEMENT_APPROVED", "ACTIVE"] } } }),
    prisma.tenantApplication.count({ where: { status: { in: ["OWNER_REJECTED", "MANAGEMENT_REJECTED"] } } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tenant Verification</h1>
        <p className="text-muted-foreground">
          Manage tenant verification applications for the society.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600">{approved}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/tenant-verification/admin/applications">
            <Button className="w-full">Review Applications</Button>
          </Link>
          <Link href="/tenant-verification/admin/reports">
            <Button className="w-full">View Reports</Button>
          </Link>
          <Button variant="outline" className="w-full">Manage Flats</Button>
        </CardContent>
      </Card>
    </div>
  );
}
