"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  id: string;
  applicationNumber: string;
  canEdit: boolean;
  role: string;
  canDelete: boolean;
};

export default function TenantVerificationActions({
  id,
  applicationNumber,
  canEdit,
  role,
  canDelete,
}: Props) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (
      !window.confirm(
        `Are you sure you want to delete application ${applicationNumber}? This cannot be undone.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/tenant-verification/applications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/admin/tenant-verification");
      } else {
        alert("Failed to delete application");
      }
    } catch {
      alert("Failed to delete application");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      {canEdit && (
        <Link href={`/admin/tenant-verification/${id}/edit`}>
          <Button>Edit</Button>
        </Link>
      )}
      {role === "ADMIN" && canDelete && (
        <button
          type="button"
          disabled={deleting}
          onClick={handleDelete}
          className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded border border-transparent disabled:opacity-50"
        >
          {deleting ? "…" : "Delete"}
        </button>
      )}
      <Link href="/admin/tenant-verification">
        <Button variant="outline">Back to Applications</Button>
      </Link>
    </div>
  );
}
