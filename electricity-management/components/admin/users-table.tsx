"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, Trash2, UserCheck, UserX, Plus } from "lucide-react";

type ManagerUser = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
};

export default function UsersTable({ initialUsers }: { initialUsers: ManagerUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editUser, setEditUser] = useState<ManagerUser | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [editForm, setEditForm] = useState({ name: "", email: "" });

  async function handleAdd() {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to add manager"); return; }
      toast.success("Manager created — welcome email sent");
      setUsers((prev) => [data, ...prev]);
      setAddOpen(false);
      setForm({ name: "", email: "", password: "" });
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit() {
    if (!editUser) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to update"); return; }
      toast.success("Manager updated");
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...data } : u)));
      setEditUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(user: ManagerUser) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success(user.isActive ? "Manager deactivated" : "Manager reactivated");
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
  }

  async function handleDelete(user: ManagerUser) {
    if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
    const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed to delete"); return; }
    toast.success("Manager deleted");
    setUsers((prev) => prev.filter((u) => u.id !== user.id));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{users.length} manager{users.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Manager
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Email</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Created</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No managers yet</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <Badge variant={u.isActive ? "default" : "secondary"}>
                    {u.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditUser(u); setEditForm({ name: u.name, email: u.email }); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(u)} title={u.isActive ? "Deactivate" : "Reactivate"}>
                      {u.isActive ? <UserX className="h-3.5 w-3.5 text-amber-500" /> : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(u)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Manager Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Manager</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email *</Label><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
            <div><Label>Password *</Label><Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={loading || !form.name || !form.email || !form.password}>
              {loading ? "Creating…" : "Create Manager"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Manager Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Manager</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={loading}>
              {loading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
