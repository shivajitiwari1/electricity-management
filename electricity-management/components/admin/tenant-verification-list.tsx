"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/tenant-verification-format";

type Application = {
  id: string;
  applicationNumber: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  status: string;
  connection: { flatNo: string | null; tower: string | null } | null;
  resident: { user: { name: string | null; email: string | null } } | null;
  _count: { documents: number; family: number };
  createdAt: Date;
};

export default function TenantVerificationList({ applications }: { applications: Application[] }) {
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Application No.</TableHead>
            <TableHead>Tenant Name</TableHead>
            <TableHead className="w-20">Phone</TableHead>
            <TableHead className="w-24">Flat / Tower</TableHead>
            <TableHead className="w-20">Owner</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-16">Docs</TableHead>
            <TableHead className="w-16">Family</TableHead>
            <TableHead className="w-24">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No applications found.
              </TableCell>
            </TableRow>
          ) : (
            applications.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/tenant-verification/${app.id}`}
                    className="text-primary hover:underline"
                  >
                    {app.applicationNumber}
                  </Link>
                </TableCell>
                <TableCell>{app.tenantName}</TableCell>
                <TableCell>{app.tenantPhone}</TableCell>
                <TableCell>
                  {app.connection?.flatNo ?? "—"} /{" "}
                  {app.connection?.tower ?? "—"}
                </TableCell>
                <TableCell>{app.resident?.user?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{formatStatus(app.status as any)}</Badge>
                </TableCell>
                <TableCell className="text-center">{app._count.documents}</TableCell>
                <TableCell className="text-center">{app._count.family}</TableCell>
                <TableCell>
                  {new Date(app.createdAt).toLocaleDateString("en-IN")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
