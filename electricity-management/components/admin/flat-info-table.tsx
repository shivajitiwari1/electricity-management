"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type FlatInfo = {
  id: string;
  flatNo: string;
  tower: string;
  floor: string;
  unitType: string;
  area: number;
};

const EMPTY_FORM = { flatNo: "", tower: "", floor: "", unitType: "", area: "" };

export default function FlatInfoTable({ initialData, canWrite, canDelete }: { initialData: FlatInfo[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const [flats, setFlats] = useState<FlatInfo[]>(initialData);
  const [search, setSearch] = useState("");
  const [towerFilter, setTowerFilter] = useState("all");

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<FlatInfo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const towers = useMemo(() => [...new Set(flats.map(f => f.tower))].sort(), [flats]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return flats.filter(f =>
      (towerFilter === "all" || f.tower === towerFilter) &&
      (!q || f.flatNo.toLowerCase().includes(q) || f.unitType.toLowerCase().includes(q) || f.floor.toLowerCase().includes(q))
    );
  }, [flats, search, towerFilter]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setAddOpen(true);
  }

  function openEdit(flat: FlatInfo) {
    setForm({ flatNo: flat.flatNo, tower: flat.tower, floor: flat.floor, unitType: flat.unitType, area: String(flat.area) });
    setEditTarget(flat);
  }

  function closeModals() {
    setAddOpen(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
  }

  function setField(key: keyof typeof EMPTY_FORM, value: string) {
    setForm(p => ({ ...p, [key]: value }));
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/flat-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, area: Number(form.area) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to add flat"); return; }
      setFlats(prev => [...prev, data].sort((a, b) => a.flatNo.localeCompare(b.flatNo)));
      toast.success("Flat added");
      closeModals();
      router.refresh();
    } catch { toast.error("Failed to add flat"); }
    finally { setSaving(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/flat-info/${editTarget.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, area: Number(form.area) }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to update flat"); return; }
      setFlats(prev => prev.map(f => f.id === editTarget.id ? data : f));
      toast.success("Flat updated");
      closeModals();
      router.refresh();
    } catch { toast.error("Failed to update flat"); }
    finally { setSaving(false); }
  }

  async function handleDelete(flat: FlatInfo) {
    const confirmed = window.confirm(`Delete flat ${flat.flatNo}?\n\nThis cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(flat.id);
    try {
      const res = await fetch(`/api/flat-info/${flat.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete");
        return;
      }
      setFlats(prev => prev.filter(f => f.id !== flat.id));
      toast.success("Flat deleted");
      router.refresh();
    } catch { toast.error("Failed to delete"); }
    finally { setDeletingId(null); }
  }

  const FormFields = () => (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="f-flatNo">Flat No *</Label>
        <Input id="f-flatNo" required value={form.flatNo} onChange={e => setField("flatNo", e.target.value)} placeholder="e.g. A-101" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-tower">Tower *</Label>
        <Input id="f-tower" required value={form.tower} onChange={e => setField("tower", e.target.value)} placeholder="e.g. A" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-floor">Floor *</Label>
        <Input id="f-floor" required value={form.floor} onChange={e => setField("floor", e.target.value)} placeholder="e.g. First" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="f-area">Area (Sq.Ft.) *</Label>
        <Input id="f-area" type="number" required min={1} value={form.area} onChange={e => setField("area", e.target.value)} placeholder="e.g. 1150" />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor="f-unitType">Unit Type *</Label>
        <Input id="f-unitType" required value={form.unitType} onChange={e => setField("unitType", e.target.value)} placeholder="e.g. 2 BHK+2T+Study (1150 Sq.Ft.)" />
      </div>
    </div>
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="flex items-center gap-4 flex-1">
            <CardTitle className="text-base font-semibold shrink-0">
              All Flats
              <Badge variant="secondary" className="ml-2">{filtered.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search flat no, type, floor…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <select
                value={towerFilter}
                onChange={e => setTowerFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All Towers</option>
                {towers.map(t => <option key={t} value={t}>Tower {t}</option>)}
              </select>
            </div>
          </div>
          {canWrite && (
            <Button size="sm" onClick={openAdd} className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Add Flat
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Floor</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Area (Sq.Ft.)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      {search || towerFilter !== "all" ? "No flats match the filter." : "No flats found."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(flat => (
                    <tr key={flat.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs font-semibold">{flat.flatNo}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">Tower {flat.tower}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{flat.floor}</td>
                      <td className="px-4 py-3 text-muted-foreground">{flat.unitType}</td>
                      <td className="px-4 py-3">{flat.area.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {canWrite && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => openEdit(flat)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === flat.id}
                              onClick={() => handleDelete(flat)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) closeModals(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Flat</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <FormFields />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModals}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Flat"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) closeModals(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Flat — {editTarget?.flatNo}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <FormFields />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModals}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
