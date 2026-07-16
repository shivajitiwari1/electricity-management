"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pencil } from "lucide-react";

// Use { toString(): string } to be compatible with Prisma Decimal
type Connection = {
  id: string;
  tower: string;
  floor: string;
  flatNo: string;
  unitType: string;
  unitArea: number;
  meterNo: string | null;
  sanctionedLoad: { toString(): string };
  status: string;
  connectedAt: Date | string;
  resident: {
    id: string;
    phone: string | null;
    user: {
      name: string;
      email: string;
    };
  };
};

interface Props {
  initialData: Connection[];
}

const TOWERS = ["A", "B", "C", "V"] as const;
const STATUSES = ["ACTIVE", "INACTIVE"] as const;

function StatusBadge({ status }: { status: string }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        ACTIVE
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
      INACTIVE
    </Badge>
  );
}

export default function ConnectionsTable({ initialData }: Props) {
  const router = useRouter();
  const [towerFilter, setTowerFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [editConnection, setEditConnection] = useState<Connection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editForm, setEditForm] = useState({
    meterNo: "",
    sanctionedLoad: "",
    status: "ACTIVE",
  });

  const filtered = useMemo(() => {
    return initialData.filter((c) => {
      const towerOk = towerFilter === "ALL" || c.tower === towerFilter;
      const statusOk = statusFilter === "ALL" || c.status === statusFilter;
      return towerOk && statusOk;
    });
  }, [initialData, towerFilter, statusFilter]);

  function openEditSheet(conn: Connection) {
    setEditConnection(conn);
    setEditForm({
      meterNo: conn.meterNo ?? "",
      sanctionedLoad: conn.sanctionedLoad.toString(),
      status: conn.status,
    });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editConnection) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/connections/${editConnection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meterNo: editForm.meterNo || undefined,
          sanctionedLoad: Number(editForm.sanctionedLoad),
          status: editForm.status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update connection");
        return;
      }
      toast.success("Connection updated successfully");
      setEditConnection(null);
      router.refresh();
    } catch {
      toast.error("Failed to update connection");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-tower" className="text-sm whitespace-nowrap">
            Tower:
          </Label>
          <Select
            value={towerFilter}
            onValueChange={(val) => setTowerFilter(val ?? "ALL")}
          >
            <SelectTrigger id="filter-tower" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Towers</SelectItem>
              {TOWERS.map((t) => (
                <SelectItem key={t} value={t}>
                  Tower {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="filter-status" className="text-sm whitespace-nowrap">
            Status:
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val ?? "ALL")}
          >
            <SelectTrigger id="filter-status" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(towerFilter !== "ALL" || statusFilter !== "ALL") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTowerFilter("ALL");
              setStatusFilter("ALL");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {filtered.length} Connection{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Floor</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Unit Type</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Sanctioned Load
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-gray-400">
                      No connections found
                    </td>
                  </tr>
                ) : (
                  filtered.map((conn) => (
                    <tr key={conn.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">{conn.flatNo}</td>
                      <td className="px-4 py-3">{conn.tower}</td>
                      <td className="px-4 py-3">{conn.floor}</td>
                      <td className="px-4 py-3">{conn.unitType}</td>
                      <td className="px-4 py-3 text-right">
                        {Number(conn.sanctionedLoad.toString()).toFixed(1)} kW
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={conn.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{conn.resident.user.name}</p>
                          <p className="text-xs text-gray-500">{conn.resident.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditSheet(conn)}
                        >
                          <Pencil className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Connection Sheet */}
      <Sheet
        open={!!editConnection}
        onOpenChange={(open) => {
          if (!open) setEditConnection(null);
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Edit Connection — {editConnection?.flatNo}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleEdit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="edit-meterNo">Meter Number</Label>
              <Input
                id="edit-meterNo"
                value={editForm.meterNo}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, meterNo: e.target.value }))
                }
                placeholder="e.g. MTR-00123"
              />
            </div>
            <div>
              <Label htmlFor="edit-load">Sanctioned Load (kW) *</Label>
              <Input
                id="edit-load"
                type="number"
                required
                min={0.1}
                step={0.1}
                value={editForm.sanctionedLoad}
                onChange={(e) =>
                  setEditForm((p) => ({ ...p, sanctionedLoad: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="edit-status">Status *</Label>
              <Select
                value={editForm.status}
                onValueChange={(val) =>
                  setEditForm((p) => ({ ...p, status: val ?? p.status }))
                }
              >
                <SelectTrigger id="edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SheetFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditConnection(null)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
