"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Save } from "lucide-react";

const PAGES = [
  { id: "dashboard",      label: "Dashboard",      hasWrite: false, hasDelete: false },
  { id: "residents",      label: "Residents",      hasWrite: true,  hasDelete: true },
  { id: "connections",    label: "Connections",    hasWrite: true,  hasDelete: true },
  { id: "meter-readings", label: "Meter Readings", hasWrite: true,  hasDelete: true },
  { id: "bills",          label: "Bills",          hasWrite: true,  hasDelete: true },
  { id: "payments",       label: "Payments",       hasWrite: true,  hasDelete: true },
  { id: "reports",        label: "Reports",        hasWrite: false, hasDelete: false },
  { id: "rates",          label: "Rates",          hasWrite: true,  hasDelete: true },
  { id: "flat-info",      label: "Flat Info",      hasWrite: true,  hasDelete: true },
];

type PermRow = { page: string; canRead: boolean; canWrite: boolean; canDelete: boolean };

export default function PermissionsMatrix({ initialPermissions }: { initialPermissions: PermRow[] }) {
  const [perms, setPerms] = useState<Record<string, PermRow>>(() =>
    Object.fromEntries(initialPermissions.filter((p) => (p as any).role === "MANAGER").map((p) => [p.page, p]))
  );
  const [saving, setSaving] = useState(false);

  function toggle(page: string, field: keyof Pick<PermRow, "canRead" | "canWrite" | "canDelete">) {
    setPerms((prev) => ({
      ...prev,
      [page]: { ...prev[page], [field]: !prev[page]?.[field] },
    }));
  }

  async function save() {
    setSaving(true);
    try {
      const permissions = PAGES.map(({ id }) => ({
        page: id,
        canRead: perms[id]?.canRead ?? false,
        canWrite: perms[id]?.canWrite ?? false,
        canDelete: perms[id]?.canDelete ?? false,
      }));

      const res = await fetch("/api/permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
      toast.success("Permissions saved — Manager must re-login to apply changes");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium w-48">Page</th>
              <th className="text-center px-4 py-3 font-medium">Read</th>
              <th className="text-center px-4 py-3 font-medium">Write</th>
              <th className="text-center px-4 py-3 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PAGES.map(({ id, label, hasWrite, hasDelete }) => (
              <tr key={id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{label}</td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={perms[id]?.canRead ?? false}
                    onChange={() => toggle(id, "canRead")}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {hasWrite ? (
                    <Checkbox
                      checked={perms[id]?.canWrite ?? false}
                      onChange={() => toggle(id, "canWrite")}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {hasDelete ? (
                    <Checkbox
                      checked={perms[id]?.canDelete ?? false}
                      onChange={() => toggle(id, "canDelete")}
                    />
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          <Save className="h-4 w-4 mr-1.5" />
          {saving ? "Saving…" : "Save Permissions"}
        </Button>
      </div>
    </div>
  );
}
