"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatStatus } from "@/lib/tenant-verification-format";
import { toast } from "sonner";

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

type Props = {
  applications: Application[];
  canWrite?: boolean;
  canDelete?: boolean;
  isAdmin?: boolean;
};

export default function TenantVerificationList({
  applications,
  canWrite = false,
  canDelete = false,
  isAdmin = false,
}: Props) {
  const [updating, setUpdating] = useState<Record<string, boolean>>({});
  const router = useRouter();

  const isUpdating = (id: string) => !!updating[id];

  const handleApprove = async (id: string, currentStatus: string) => {
    setUpdating({ ...updating, [id]: true });
    try {
      const res = await fetch(`/api/tenant-verification/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MANAGEMENT_APPROVED" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to approve application");
      }
      toast.success("Application approved");
      setUpdating({ ...updating, [id]: false });
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to approve application");
      setUpdating({ ...updating, [id]: false });
    }
  };

  const handleDelete = async (id: string, applicationNumber: string) => {
    if (
      !window.confirm(
        `Are you sure you want to delete application ${applicationNumber}? This cannot be undone.`
      )
    ) {
      return;
    }
    setUpdating({ ...updating, [id]: true });
    try {
      const res = await fetch(`/api/tenant-verification/applications/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to delete application");
      }
      toast.success("Application deleted");
      setUpdating({ ...updating, [id]: false });
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to delete application");
      setUpdating({ ...updating, [id]: false });
    }
  };

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
            {canWrite || canDelete || isAdmin ? (
              <TableHead className="w-32">Actions</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {applications.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canWrite || canDelete || isAdmin ? 10 : 9}
                className="h-24 text-center text-muted-foreground"
              >
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
                {(canWrite || canDelete || isAdmin) && (
                  <TableCell className="flex items-center gap-1">
                    {app.status === "PENDING" && canWrite && (
                      <Link
                        href={`/admin/tenant-verification/${app.id}/edit`}
                        className="px-2 py-1 text-xs border rounded-md hover:bg-accent"
                      >
                        Edit
                      </Link>
                    )}
                    {app.status !== "PENDING" && isAdmin && (
                      <Link
                        href={`/admin/tenant-verification/${app.id}/edit`}
                        className="px-2 py-1 text-xs border rounded-md hover:bg-accent"
                      >
                        Edit
                      </Link>
                    )}
                    {app.status !== "MANAGEMENT_APPROVED" && app.status !== "ACTIVE" && app.status !== "OWNER_REJECTED" && app.status !== "MANAGEMENT_REJECTED" && (
                      <button
                        type="button"
                        onClick={() => handleApprove(app.id, app.status)}
                        disabled={isUpdating(app.id)}
                        className="px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 rounded border border-transparent"
                      >
                        {isUpdating(app.id) ? "Approving…" : "Approve"}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(app.id, app.applicationNumber)}
                        disabled={isUpdating(app.id)}
                        className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 rounded border border-transparent"
                      >
                        {isUpdating(app.id) ? "…" : "Delete"}
                      </button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
