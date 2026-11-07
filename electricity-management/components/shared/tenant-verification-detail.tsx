"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatStatus } from "@/lib/tenant-verification-format";
import { toast } from "sonner";

type Application = {
  id: string;
  applicationNumber: string;
  tenantName: string;
  tenantPhone: string;
  tenantEmail: string | null;
  tenantIdProof: string | null;
  moveInDate: string | null;
  moveOutDate: string | null;
  status: string;
  connection: { flatNo: string | null; tower: string | null } | null;
  resident: { user: { name: string | null; email: string | null; phone: string | null } } | null;
  documents: Array<{
    id: string;
    documentType: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    verified: boolean;
    createdAt: string;
  }>;
  family: Array<{
    id: string;
    fullName: string;
    relation: string;
    age: number | null;
    idProof: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string | null;
    createdAt: string;
    user: { name: string | null; email: string | null } | null;
  }>;
};

type Props = {
  application: Application;
  isResident?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
};

export default function TenantVerificationDetail({
  application,
  isResident = false,
  canWrite = false,
  canDelete = false,
}: Props) {
  const statusLabel = formatStatus(application.status as any);
  const [statusChanging, setStatusChanging] = useState<string | null>(null);

  const handleStatusChange = async (status: string) => {
    setStatusChanging(status);
    try {
      const res = await fetch(`/api/tenant-verification/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Failed to update status");
      }
      toast.success("Status updated");
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to update status");
      setStatusChanging(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>{application.applicationNumber}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Tenant Name</span>
              <p>{application.tenantName}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Phone</span>
              <p>{application.tenantPhone}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Email</span>
              <p>{application.tenantEmail ?? "—"}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">ID Proof</span>
              <p>{application.tenantIdProof ?? "—"}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Move In</span>
              <p>{application.moveInDate ? new Date(application.moveInDate).toLocaleDateString("en-IN") : "—"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Flat</span>
              <p>{application.connection?.flatNo ?? "—"}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Tower</span>
              <p>{application.connection?.tower ?? "—"}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Owner</span>
              <p>{application.resident?.user?.name ?? "—"}</p>
            </div>
            <div className="text-sm">
              <span className="font-medium text-muted-foreground">Owner Email</span>
              <p>{application.resident?.user?.email ?? "—"}</p>
            </div>
            <div className="text-sm flex items-center gap-2">
              <span className="font-medium text-muted-foreground">Status</span>
              <Badge className="w-fit">{statusLabel}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isResident && canWrite && (
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusChange("DOCUMENTS_SUBMITTED")}
            disabled={
              application.status !== "PENDING" || statusChanging === "DOCUMENTS_SUBMITTED"
            }
            className="px-3 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-50"
          >
            {statusChanging === "DOCUMENTS_SUBMITTED" ? "…" : "Mark Documents Submitted"}
          </button>
          <button
            onClick={() => handleStatusChange("OWNER_APPROVED")}
            disabled={
              application.status !== "DOCUMENTS_SUBMITTED" ||
              statusChanging === "OWNER_APPROVED"
            }
            className="px-3 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-50"
          >
            {statusChanging === "OWNER_APPROVED" ? "…" : "Owner Approve"}
          </button>
          <button
            onClick={() => handleStatusChange("MANAGEMENT_APPROVED")}
            disabled={
              application.status !== "POLICE_VERIFIED" ||
              statusChanging === "MANAGEMENT_APPROVED"
            }
            className="px-3 py-1.5 text-xs border rounded-md hover:bg-accent disabled:opacity-50"
          >
            {statusChanging === "MANAGEMENT_APPROVED" ? "…" : "Management Approve"}
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {application.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents uploaded.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {application.documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2">
                  <span className="w-8 text-muted-foreground">{doc.documentType}</span>
                  <span className="flex-1 truncate">{doc.fileName}</span>
                  <span className="w-16 text-xs text-muted-foreground">
                    {(doc.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                  {doc.verified ? (
                    <Badge variant="secondary" className="ml-2">Verified</Badge>
                  ) : (
                    <span className="ml-2 text-xs text-muted-foreground">Pending</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Family Members</CardTitle>
        </CardHeader>
        <CardContent>
          {application.family.length === 0 ? (
            <p className="text-sm text-muted-foreground">No family members added.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {application.family.map((member) => (
                <li key={member.id} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{member.fullName}</span>
                  <span className="w-16 text-muted-foreground">{member.relation}</span>
                  <span className="w-12 text-muted-foreground">{member.age ?? "—"}</span>
                  <span className="w-20 text-muted-foreground truncate">{member.idProof ?? "—"}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit History</CardTitle>
        </CardHeader>
        <CardContent>
          {application.auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit history.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {application.auditLogs.map((log) => (
                <li key={log.id} className="flex justify-between">
                  <span className="text-muted-foreground">{log.action}</span>
                  <span className="text-muted-foreground">
                    {new Date(log.createdAt).toLocaleDateString("en-IN")}
                  </span>
                  {log.fromStatus && log.toStatus && (
                    <span className="text-xs text-muted-foreground">
                      {log.fromStatus} → {log.toStatus}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
