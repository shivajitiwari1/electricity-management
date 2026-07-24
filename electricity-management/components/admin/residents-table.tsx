"use client";

import { useState, useMemo, useCallback } from "react";
import { type FlatEntry } from "@/lib/flat-data";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks/use-debounce";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Search, Plus, Pencil, UserX, Trash2, ChevronsUpDown, Check, History, Download } from "lucide-react";


type Connection = {
  id: string;
  flatNo: string;
  tower: string;
  floor: string;
  unitType: string;
  unitArea: string | null;
  meterNo: string | null;
  sanctionedLoad: string;
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
  flatData: FlatEntry[];
  canWrite: boolean;
  canDelete: boolean;
}

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

export default function ResidentsTable({ initialData, flatData, canWrite, canDelete }: Props) {
  const towers = useMemo(() => [...new Set(flatData.map((f) => f.tower))].sort(), [flatData]);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editResident, setEditResident] = useState<Resident | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [historyResident, setHistoryResident] = useState<{ flatNo: string; name: string } | null>(null);
  const [historyData, setHistoryData] = useState<{ bills: any[]; payments: any[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Combobox open state + search
  const [addFlatOpen, setAddFlatOpen] = useState(false);
  const [editFlatOpen, setEditFlatOpen] = useState(false);
  const [addFlatSearch, setAddFlatSearch] = useState("");
  const [editFlatSearch, setEditFlatSearch] = useState("");

  // All occupied flat numbers
  const occupiedFlats = useMemo(
    () => new Set(initialData.flatMap((r) => r.connections.map((c) => c.flatNo))),
    [initialData]
  );

  // All XLS flats filtered by search (show all, mark occupied)
  const addFlats = useMemo(() => {
    const q = addFlatSearch.toLowerCase();
    return flatData.filter(
      (f) => !q || f.flatNo.toLowerCase().includes(q) || f.tower.toLowerCase().includes(q)
    );
  }, [flatData, addFlatSearch]);

  // Edit: all XLS flats filtered by search
  const editFlats = useCallback(
    (currentFlatNo: string) => {
      const q = editFlatSearch.toLowerCase();
      return flatData.filter(
        (f) => !q || f.flatNo.toLowerCase().includes(q) || f.tower.toLowerCase().includes(q)
      );
    },
    [flatData, editFlatSearch]
  );

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
    sanctionedLoad: "5",
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
    const q = debouncedSearch.toLowerCase().trim();
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
  }, [initialData, debouncedSearch]);

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
      unitArea: conn?.unitArea ?? "",
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
      sanctionedLoad: "5",
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

  async function handleDelete(resident: Resident) {
    const confirmed = window.confirm(
      `Permanently delete ${resident.user.name} (${resident.connections[0]?.flatNo ?? ""})?\n\nThis will remove all their data including bills, payments, and meter readings. This cannot be undone.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/residents/${resident.id}?hard=true`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete resident");
        return;
      }
      toast.success("Resident permanently deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete resident");
    }
  }

  async function openHistory(resident: Resident) {
    const flatNo = resident.connections[0]?.flatNo;
    if (!flatNo) return;
    setHistoryResident({ flatNo, name: resident.user.name });
    setHistoryData(null);
    setHistoryLoading(true);
    try {
      const [billsRes, paymentsRes] = await Promise.all([
        fetch(`/api/bills?flatNo=${encodeURIComponent(flatNo)}`),
        fetch(`/api/payments?flatNo=${encodeURIComponent(flatNo)}`),
      ]);
      const bills = billsRes.ok ? await billsRes.json() : [];
      const payments = paymentsRes.ok ? await paymentsRes.json() : [];
      setHistoryData({ bills, payments });
    } catch {
      toast.error("Failed to load history");
    } finally {
      setHistoryLoading(false);
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
        {canWrite && (
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Resident
          </Button>
        )}
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
                              onClick={() => openHistory(resident)}
                            >
                              <History className="h-3 w-3 mr-1" />
                              History
                            </Button>
                            {canWrite && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(resident)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {canWrite && isActive && (
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
                            {canDelete && !isActive && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => handleDelete(resident)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
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
                    {towers.map((t) => (
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
              <div className="col-span-2 space-y-1.5">
                <Label>Flat No *</Label>
                <Popover open={addFlatOpen} onOpenChange={(o) => { setAddFlatOpen(o); if (!o) setAddFlatSearch(""); }}>
                  <PopoverTrigger className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {addForm.flatNo || <span className="text-muted-foreground">Search flat no…</span>}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search flat no…"
                        value={addFlatSearch}
                        onValueChange={setAddFlatSearch}
                      />
                      <CommandList className="max-h-72">
                        <CommandEmpty>No flats found</CommandEmpty>
                        <CommandGroup heading={`${addFlats.length} flats`}>
                          {addFlats.map((f) => {
                            const isOccupied = occupiedFlats.has(f.flatNo);
                            return (
                            <CommandItem
                              key={f.flatNo}
                              value={f.flatNo}
                              disabled={isOccupied}
                              onSelect={() => {
                                if (isOccupied) return;
                                setAddForm((p) => ({
                                  ...p,
                                  flatNo: f.flatNo,
                                  tower: f.tower,
                                  floor: f.floor,
                                  unitType: f.unitType,
                                  unitArea: String(f.area),
                                }));
                                setAddFlatSearch("");
                                setAddFlatOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${addForm.flatNo === f.flatNo ? "opacity-100" : "opacity-0"}`} />
                              <span className={`font-medium ${isOccupied ? "text-muted-foreground line-through" : ""}`}>{f.flatNo}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{f.unitType}</span>
                              {isOccupied && <span className="ml-auto text-xs text-orange-500">occupied</span>}
                            </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-unitType">Unit Type</Label>
                <Input
                  id="add-unitType"
                  value={addForm.unitType}
                  readOnly
                  placeholder="Auto-filled on flat selection"
                  className="bg-muted/50 cursor-default"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-unitArea">Unit Area (sq ft)</Label>
                <Input
                  id="add-unitArea"
                  type="number"
                  value={addForm.unitArea}
                  readOnly
                  placeholder="Auto-filled on flat selection"
                  className="bg-muted/50 cursor-default"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
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
                          {towers.map((t) => (
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
                      <Label>Flat No *</Label>
                      <Popover open={editFlatOpen} onOpenChange={(o) => { setEditFlatOpen(o); if (!o) setEditFlatSearch(""); }}>
                        <PopoverTrigger className="inline-flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-normal whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {editForm.flatNo || <span className="text-muted-foreground">Search flat no…</span>}
                          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="start">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search flat no…"
                              value={editFlatSearch}
                              onValueChange={setEditFlatSearch}
                            />
                            <CommandList className="max-h-72">
                              <CommandEmpty>No flats found</CommandEmpty>
                              <CommandGroup heading="All flats">
                                {editFlats(editResident?.connections[0]?.flatNo ?? "").map((f) => {
                                  const isOccupied = occupiedFlats.has(f.flatNo) && f.flatNo !== editResident?.connections[0]?.flatNo;
                                  return (
                                  <CommandItem
                                    key={f.flatNo}
                                    value={f.flatNo}
                                    disabled={isOccupied}
                                    onSelect={() => {
                                      if (isOccupied) return;
                                      setEditForm((p) => ({
                                        ...p,
                                        flatNo: f.flatNo,
                                        tower: f.tower,
                                        floor: f.floor,
                                        unitType: f.unitType,
                                        unitArea: String(f.area),
                                      }));
                                      setEditFlatSearch("");
                                      setEditFlatOpen(false);
                                    }}
                                  >
                                    <Check className={`mr-2 h-4 w-4 ${editForm.flatNo === f.flatNo ? "opacity-100" : "opacity-0"}`} />
                                    <span className={`font-medium ${isOccupied ? "text-muted-foreground line-through" : ""}`}>{f.flatNo}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">{f.unitType}</span>
                                    {isOccupied && <span className="ml-auto text-xs text-orange-500">occupied</span>}
                                  </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
                      <Label htmlFor="edit-unitType">Unit Type</Label>
                      <Input
                        id="edit-unitType"
                        value={editForm.unitType}
                        readOnly
                        placeholder="Auto-filled on flat selection"
                        className="bg-muted/50 cursor-default"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-unitArea">Unit Area (sq ft)</Label>
                      <Input
                        id="edit-unitArea"
                        type="number"
                        value={editForm.unitArea}
                        readOnly
                        placeholder="Auto-filled on flat selection"
                        className="bg-muted/50 cursor-default"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="edit-sanctionedLoad">Sanctioned Load (kW) *</Label>
                      <Input
                        id="edit-sanctionedLoad"
                        type="number"
                        required
                        min={0.1}
                        step={0.1}
                        value={editForm.sanctionedLoad}
                        onChange={(e) => setEditForm((p) => ({ ...p, sanctionedLoad: e.target.value }))}
                        placeholder="e.g. 5"
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

      {/* History Modal */}
      <Dialog open={!!historyResident} onOpenChange={(open) => { if (!open) setHistoryResident(null); }}>
        <DialogContent className="w-full max-w-[98vw] sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>
                History — {historyResident?.name} ({historyResident?.flatNo})
              </DialogTitle>
              {historyData && (historyData.bills.length > 0 || historyData.payments.length > 0) && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={async () => {
                    if (!historyData || !historyResident) return;
                    const { Workbook } = await import("exceljs");
                    const wb = new Workbook();
                    wb.creator = "Oasis Venetia Heights";
                    wb.created = new Date();

                    const ws = wb.addWorksheet(historyResident.flatNo ?? "History");
                    const COLS = 7;
                    ws.columns = [
                      { key: "a", width: 22 }, { key: "b", width: 28 }, { key: "c", width: 14 },
                      { key: "d", width: 20 }, { key: "e", width: 16 }, { key: "f", width: 22 }, { key: "g", width: 10 },
                    ];

                    // Title
                    ws.mergeCells(1, 1, 1, COLS);
                    const t1 = ws.getCell("A1");
                    t1.value = "Oasis Venetia Heights";
                    t1.font = { bold: true, size: 14, color: { argb: "FF1D4ED8" } };
                    t1.alignment = { horizontal: "center", vertical: "middle" };
                    t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
                    ws.getRow(1).height = 26;

                    ws.mergeCells(2, 1, 2, COLS);
                    const t2 = ws.getCell("A2");
                    t2.value = `Flat: ${historyResident.flatNo}   |   ${historyResident.name}   |   ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`;
                    t2.font = { size: 9, italic: true, color: { argb: "FF374151" } };
                    t2.alignment = { horizontal: "center", vertical: "middle" };
                    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
                    ws.getRow(2).height = 14;
                    ws.getRow(3).height = 8;

                    let r = 4;

                    const mkSection = (text: string, color: string) => {
                      ws.mergeCells(r, 1, r, COLS);
                      const cell = ws.getCell(r, 1);
                      cell.value = text;
                      cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
                      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
                      cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
                      ws.getRow(r).height = 18;
                      r++;
                    };

                    const mkColHeaders = (labels: string[], color: string) => {
                      const row = ws.getRow(r);
                      labels.forEach((label, i) => {
                        const cell = row.getCell(i + 1);
                        cell.value = label;
                        cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
                        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
                        cell.alignment = { vertical: "middle" };
                        cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
                      });
                      row.height = 15;
                      r++;
                    };

                    // ---- BILLS ----
                    if (historyData.bills.length > 0) {
                      mkSection("ELECTRICITY BILLS", "FF1D4ED8");
                      mkColHeaders(["Bill #", "Billing Period", "Amount (₹)", "Units", "Due Date", "Status"], "FF1E3A8A");
                      historyData.bills.forEach((b: any, idx: number) => {
                        const period = `${new Date(b.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} – ${new Date(b.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`;
                        const bg = idx % 2 === 0 ? "FFEFF6FF" : "FFFFFFFF";
                        const row = ws.getRow(r);
                        [b.billNumber, period, Number(b.totalAmount), b.ncplUnits != null ? Number(b.ncplUnits) : "", new Date(b.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), b.status].forEach((v, i) => {
                          const cell = row.getCell(i + 1);
                          cell.value = v as any;
                          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
                          cell.font = { size: 9 };
                          cell.alignment = { vertical: "middle" };
                          if (i === 2 || i === 3) cell.alignment = { horizontal: "right", vertical: "middle" };
                        });
                        row.getCell(1).font = { size: 9, name: "Courier New" };
                        row.getCell(3).numFmt = "#,##0.00";
                        row.height = 15;
                        r++;
                      });
                      r++; // blank
                    }

                    // ---- PAYMENTS ----
                    if (historyData.payments.length > 0) {
                      mkSection("MAINTENANCE PAYMENTS", "FF059669");
                      mkColHeaders(["Receipt #", "Bill #", "Amount (₹)", "Date & Time", "Mode", "Transaction ID", "Status"], "FF064E3B");
                      historyData.payments.forEach((p: any, idx: number) => {
                        const pDate = new Date(p.paymentDate);
                        const dt = `${pDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${pDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
                        const txnId = p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : "";
                        const bg = idx % 2 === 0 ? "FFF0FDF4" : "FFFFFFFF";
                        const row = ws.getRow(r);
                        [p.receiptNumber ?? "", p.bill?.billNumber ?? "", Number(p.amount), dt, p.paymentMethod ?? p.method ?? "", txnId, p.status ?? "SUCCESS"].forEach((v, i) => {
                          const cell = row.getCell(i + 1);
                          cell.value = v as any;
                          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
                          cell.font = { size: 9 };
                          cell.alignment = { vertical: "middle" };
                          if (i === 2) cell.alignment = { horizontal: "right", vertical: "middle" };
                        });
                        row.getCell(1).font = { size: 9, name: "Courier New" };
                        row.getCell(2).font = { size: 9, name: "Courier New" };
                        row.getCell(3).numFmt = "#,##0.00";
                        row.height = 15;
                        r++;
                      });
                    }

                    const buffer = await wb.xlsx.writeBuffer();
                    const blob = new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `history-${historyResident.flatNo}-${historyResident.name.replace(/\s+/g, "-")}.xlsx`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-3 w-3" />Download Excel
                </Button>
              )}
            </div>
          </DialogHeader>
          {historyLoading && <p className="text-sm text-muted-foreground py-4 text-center">Loading…</p>}
          {historyData && (
            <div className="space-y-6">
              {/* Bills */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Electricity Bills ({historyData.bills.length})</h3>
                {historyData.bills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No bills found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium">Bill #</th>
                          <th className="text-left px-3 py-2 font-medium">Billing Period</th>
                          <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
                          <th className="text-right px-3 py-2 font-medium">Units</th>
                          <th className="text-left px-3 py-2 font-medium">Due Date</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.bills.map((b: any) => (
                          <tr key={b.id} className="border-b last:border-0">
                            <td className="px-3 py-2 font-mono">{b.billNumber}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(b.billingPeriodStart).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              {" – "}
                              {new Date(b.billingPeriodEnd).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{Number(b.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                            <td className="px-3 py-2 text-right text-gray-500">{b.ncplUnits ?? "—"}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{new Date(b.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
                            <td className="px-3 py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                b.status === "PAID" ? "bg-green-100 text-green-700" :
                                b.status === "OVERDUE" ? "bg-red-100 text-red-700" :
                                "bg-yellow-100 text-yellow-700"
                              }`}>{b.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Payments */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Payments ({historyData.payments.length})</h3>
                {historyData.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium">Receipt #</th>
                          <th className="text-left px-3 py-2 font-medium">Bill #</th>
                          <th className="text-right px-3 py-2 font-medium">Amount (₹)</th>
                          <th className="text-left px-3 py-2 font-medium">Date & Time</th>
                          <th className="text-left px-3 py-2 font-medium">Mode / Ref</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.payments.map((p: any) => {
                          const txnId = p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : null;
                          const pDate = new Date(p.paymentDate);
                          return (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="px-3 py-2 font-mono">{p.receiptNumber ?? "—"}</td>
                              <td className="px-3 py-2 font-mono">{p.bill?.billNumber ?? "—"}</td>
                              <td className="px-3 py-2 text-right font-medium">{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {pDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                <span className="text-gray-400 ml-1">{pDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{p.paymentMethod ?? p.method ?? "—"}</div>
                                {txnId && <div className="text-gray-500 font-mono text-xs mt-0.5">{txnId}</div>}
                              </td>
                              <td className="px-3 py-2">
                                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                  p.status === "SUCCESS" ? "bg-green-100 text-green-700" :
                                  p.status === "FAILED" ? "bg-red-100 text-red-700" :
                                  "bg-yellow-100 text-yellow-700"
                                }`}>{p.status ?? "SUCCESS"}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
