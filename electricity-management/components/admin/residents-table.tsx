"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Search, Plus, Pencil, UserX } from "lucide-react";

type Connection = {
  id: string;
  flatNo: string;
  tower: string;
  floor: string;
  unitType: string;
  unitArea: number;
  meterNo: string | null;
  sanctionedLoad: { toString(): string };
  status: string;
};

type Resident = {
  id: string;
  residentNumber: string;
  phone: string | null;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  connections: Connection[];
};

interface Props {
  initialData: Resident[];
}

const TOWERS = ["A", "B", "C", "V", "Plaza"] as const;

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

export default function ResidentsTable({ initialData }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editResident, setEditResident] = useState<Resident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add form state
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    phone: "",
    tower: "",
    floor: "",
    flatNo: "",
    unitType: "",
    unitArea: "",
    sanctionedLoad: "",
    password: "",
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    tower: "",
    floor: "",
    flatNo: "",
    unitType: "",
    unitArea: "",
    sanctionedLoad: "",
    meterNo: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initialData;
    return initialData.filter((r) => {
      const flatNos = r.connections.map((c) => c.flatNo.toLowerCase()).join(" ");
      const towers = r.connections.map((c) => c.tower.toLowerCase()).join(" ");
      return (
        r.user.name.toLowerCase().includes(q) ||
        r.user.email.toLowerCase().includes(q) ||
        (r.phone ?? "").toLowerCase().includes(q) ||
        flatNos.includes(q) ||
        towers.includes(q)
      );
    });
  }, [initialData, search]);

  function openEditModal(resident: Resident) {
    setEditResident(resident);
    const conn = resident.connections[0];
    setEditForm({
      name: resident.user.name,
      email: resident.user.email,
      phone: resident.phone ?? "",
      tower: conn?.tower ?? "",
      floor: conn?.floor ?? "",
      flatNo: conn?.flatNo ?? "",
      unitType: conn?.unitType ?? "",
      unitArea: conn ? String(conn.unitArea) : "",
      sanctionedLoad: conn ? conn.sanctionedLoad.toString() : "",
      meterNo: conn?.meterNo ?? "",
    });
  }

  function closeAddModal() {
    setShowAddModal(false);
    setAddForm({
      name: "",
      email: "",
      phone: "",
      tower: "",
      floor: "",
      flatNo: "",
      unitType: "",
      unitArea: "",
      sanctionedLoad: "",
      password: "",
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.tower) {
      toast.error("Please select a tower");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/residents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addForm.name,
          email: addForm.email,
          phone: addForm.phone || undefined,
          tower: addForm.tower,
          floor: addForm.floor,
          flatNo: addForm.flatNo,
          unitType: addForm.unitType,
          unitArea: Number(addForm.unitArea),
          sanctionedLoad: Number(addForm.sanctionedLoad),
          password: addForm.password,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to add resident");
        return;
      }
      toast.success("Resident added successfully");
      closeAddModal();
      router.refresh();
    } catch {
      toast.error("Failed to add resident");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editResident) return;
    setIsSubmitting(true);
    const conn = editResident.connections[0];
    try {
      const res = await fetch(`/api/residents/${editResident.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone || undefined,
          ...(conn ? {
            connectionId: conn.id,
            tower: editForm.tower || undefined,
            floor: editForm.floor || undefined,
            flatNo: editForm.flatNo || undefined,
            unitType: editForm.unitType || undefined,
            unitArea: editForm.unitArea ? Number(editForm.unitArea) : undefined,
            sanctionedLoad: editForm.sanctionedLoad ? Number(editForm.sanctionedLoad) : undefined,
            meterNo: editForm.meterNo,
          } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update resident");
        return;
      }
      toast.success("Resident updated successfully");
      setEditResident(null);
      router.refresh();
    } catch {
      toast.error("Failed to update resident");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeactivate(resident: Resident) {
    const confirmed = window.confirm(
      `Deactivate ${resident.user.name}? This will deactivate all their connections.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/residents/${resident.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to deactivate resident");
        return;
      }
      toast.success("Resident deactivated");
      router.refresh();
    } catch {
      toast.error("Failed to deactivate resident");
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, flat..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Resident
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {filtered.length} Resident{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      No residents found
                    </td>
                  </tr>
                ) : (
                  filtered.map((resident) => {
                    const conn = resident.connections[0];
                    const isActive =
                      resident.connections.some((c) => c.status === "ACTIVE");
                    return (
                      <tr key={resident.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {conn ? conn.flatNo : "—"}
                        </td>
                        <td className="px-4 py-3">{conn ? conn.tower : "—"}</td>
                        <td className="px-4 py-3 font-medium">{resident.user.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{resident.user.email}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {resident.phone ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={isActive ? "ACTIVE" : "INACTIVE"} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditModal(resident)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => handleDeactivate(resident)}
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                Deactivate
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Resident Modal */}
      <Dialog open={showAddModal} onOpenChange={(open) => { if (!open) closeAddModal(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Resident</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-name">Name *</Label>
                <Input
                  id="add-name"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Full name"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-email">Email *</Label>
                <Input
                  id="add-email"
                  type="email"
                  required
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@example.com"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-phone">Phone</Label>
                <Input
                  id="add-phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-tower">Tower *</Label>
                <Select
                  value={addForm.tower}
                  onValueChange={(val) => setAddForm((p) => ({ ...p, tower: val ?? p.tower }))}
                >
                  <SelectTrigger id="add-tower" className="w-full">
                    <SelectValue placeholder="Select tower" />
                  </SelectTrigger>
                  <SelectContent>
                    {TOWERS.map((t) => (
                      <SelectItem key={t} value={t}>
                        Tower {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-floor">Floor *</Label>
                <Input
                  id="add-floor"
                  required
                  value={addForm.floor}
                  onChange={(e) => setAddForm((p) => ({ ...p, floor: e.target.value }))}
                  placeholder="e.g. 3"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-flatNo">Flat No *</Label>
                <Input
                  id="add-flatNo"
                  required
                  value={addForm.flatNo}
                  onChange={(e) => setAddForm((p) => ({ ...p, flatNo: e.target.value }))}
                  placeholder="e.g. A-301"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-unitType">Unit Type *</Label>
                <Input
                  id="add-unitType"
                  required
                  value={addForm.unitType}
                  onChange={(e) => setAddForm((p) => ({ ...p, unitType: e.target.value }))}
                  placeholder="e.g. 2BHK"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-unitArea">Unit Area (sq ft) *</Label>
                <Input
                  id="add-unitArea"
                  type="number"
                  required
                  min={1}
                  value={addForm.unitArea}
                  onChange={(e) => setAddForm((p) => ({ ...p, unitArea: e.target.value }))}
                  placeholder="e.g. 1200"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-sanctionedLoad">Sanctioned Load (kW) *</Label>
                <Input
                  id="add-sanctionedLoad"
                  type="number"
                  required
                  min={0.1}
                  step={0.1}
                  value={addForm.sanctionedLoad}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, sanctionedLoad: e.target.value }))
                  }
                  placeholder="e.g. 5"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-password">Password *</Label>
                <Input
                  id="add-password"
                  type="password"
                  required
                  minLength={6}
                  value={addForm.password}
                  onChange={(e) =>
                    setAddForm((p) => ({ ...p, password: e.target.value }))
                  }
                  placeholder="Min. 6 characters"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeAddModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Resident"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Resident Modal */}
      <Dialog
        open={!!editResident}
        onOpenChange={(open) => { if (!open) setEditResident(null); }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Resident — {editResident?.connections[0]?.flatNo ?? ""}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="space-y-4 py-1">
              {/* Personal Info */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal Information</p>
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>

              {/* Connection Info */}
              {editResident?.connections[0] && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Connection Details</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-tower">Tower *</Label>
                      <Select
                        value={editForm.tower}
                        onValueChange={(val) => setEditForm((p) => ({ ...p, tower: val ?? p.tower }))}
                      >
                        <SelectTrigger id="edit-tower" className="w-full">
                          <SelectValue placeholder="Select tower" />
                        </SelectTrigger>
                        <SelectContent>
                          {TOWERS.map((t) => (
                            <SelectItem key={t} value={t}>Tower {t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-floor">Floor *</Label>
                      <Input
                        id="edit-floor"
                        required
                        value={editForm.floor}
                        onChange={(e) => setEditForm((p) => ({ ...p, floor: e.target.value }))}
                        placeholder="e.g. First"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-flatNo">Flat No *</Label>
                      <Input
                        id="edit-flatNo"
                        required
                        value={editForm.flatNo}
                        onChange={(e) => setEditForm((p) => ({ ...p, flatNo: e.target.value }))}
                        placeholder="e.g. A-101"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-meterNo">Meter No</Label>
                      <Input
                        id="edit-meterNo"
                        value={editForm.meterNo}
                        onChange={(e) => setEditForm((p) => ({ ...p, meterNo: e.target.value }))}
                        placeholder="e.g. MTR-00123"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="edit-unitType">Unit Type *</Label>
                      <Input
                        id="edit-unitType"
                        required
                        value={editForm.unitType}
                        onChange={(e) => setEditForm((p) => ({ ...p, unitType: e.target.value }))}
                        placeholder="e.g. 2BHK"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-unitArea">Unit Area (sq ft) *</Label>
                      <Input
                        id="edit-unitArea"
                        type="number"
                        required
                        min={1}
                        value={editForm.unitArea}
                        onChange={(e) => setEditForm((p) => ({ ...p, unitArea: e.target.value }))}
                        placeholder="e.g. 1150"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-sanctionedLoad">Sanctioned Load (kW) *</Label>
                      <Input
                        id="edit-sanctionedLoad"
                        type="number"
                        required
                        min={0.1}
                        step={0.1}
                        value={editForm.sanctionedLoad}
                        onChange={(e) => setEditForm((p) => ({ ...p, sanctionedLoad: e.target.value }))}
                        placeholder="e.g. 4"
                      />
                    </div>
                  </div>
                </>
              )}

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditResident(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
