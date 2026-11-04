"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { LifeBuoy, Plus, Save, Pencil, Trash2, X } from "lucide-react";

const EMPTY_CATEGORY = "";
const EMPTY_SUB = [""];

type Subcategory = { id?: string; name: string; sortOrder?: number };
type Category = {
  id: string;
  name: string;
  sortOrder: number;
  ticketCount: number;
  subcategories: Subcategory[];
};

export default function HelpDeskCategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [addName, setAddName] = useState(EMPTY_CATEGORY);
  const [addSubs, setAddSubs] = useState<string[]>([...EMPTY_SUB]);
  const [savingAdd, setSavingAdd] = useState(false);

  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editSubs, setEditSubs] = useState<Subcategory[]>([]);
  const [newSubName, setNewSubName] = useState("");

  async function load() {
    const res = await fetch("/api/help-desk/categories", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not load categories");
    setCategories(data.categories ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load categories");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function addCategory() {
    const name = addName.trim();
    if (!name) return toast.error("Enter a category name");
    const subcategories = addSubs.map((sub) => sub.trim()).filter(Boolean);
    setSavingAdd(true);
    try {
      const res = await fetch("/api/help-desk/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subcategories }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add category");
      toast.success("Category added");
      setShowAdd(false);
      setAddName(EMPTY_CATEGORY);
      setAddSubs([...EMPTY_SUB]);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add category");
    } finally {
      setSavingAdd(false);
    }
  }

  function openEdit(category: Category) {
    setEditing(category);
    setEditName(category.name);
    setEditSubs([...category.subcategories]);
    setNewSubName("");
  }

  async function saveCategoryName() {
    if (!editing) return;
    if (!editName.trim()) return toast.error("Enter a category name");
    try {
      const res = await fetch(`/api/help-desk/categories/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update category");
      toast.success("Category updated");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update category");
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Delete category "${category.name}"?`)) return;
    try {
      const res = await fetch(`/api/help-desk/categories/${category.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete category");
      toast.success("Category deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete category");
    }
  }

  async function renameSubcategory(subcategory: Subcategory) {
    if (!subcategory.id || !subcategory.name.trim()) return;
    try {
      const res = await fetch(`/api/help-desk/subcategories/${subcategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: subcategory.name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not rename subcategory");
      toast.success("Subcategory updated");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not rename subcategory");
    }
  }

  async function deleteSubcategory(subcategory: Subcategory) {
    if (!subcategory.id) return;
    if (!window.confirm(`Delete subcategory "${subcategory.name}"?`)) return;
    try {
      const res = await fetch(`/api/help-desk/subcategories/${subcategory.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete subcategory");
      setEditSubs((current) => current.filter((item) => item.id !== subcategory.id));
      toast.success("Subcategory deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete subcategory");
    }
  }

  async function addSubcategory() {
    if (!editing) return;
    const name = newSubName.trim();
    if (!name) return;
    try {
      const res = await fetch(`/api/help-desk/categories/${editing.id}/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add subcategory");
      setNewSubName("");
      await load();
      const updated = (await (await fetch("/api/help-desk/categories", { cache: "no-store" })).json()).categories?.find(
        (c: Category) => c.id === editing.id
      );
      if (updated) setEditSubs([...updated.subcategories]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add subcategory");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="outline">
          {categories.reduce((sum, c) => sum + c.subcategories.length, 0)} subcategories
        </Badge>
        <Button onClick={() => setShowAdd(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Category
        </Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading categories…</CardContent></Card>
      ) : (
        <div className="rounded-xl border overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-48 md:w-56">Category</th>
                <th className="text-left px-4 py-3 font-medium">Subcategory</th>
                <th className="text-right px-4 py-3 font-medium w-52">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((category) => (
                <tr key={category.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {category.subcategories.length > 0
                      ? category.subcategories.map((s) => s.name).join(", ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(category)} className="inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 hover:bg-accent">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => deleteCategory(category)} className="inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                    <LifeBuoy className="h-8 w-8 mx-auto mb-2" />
                    No categories yet. Add the first one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-xl rounded-xl shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Add Category</h2>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <Input autoFocus placeholder="e.g. Lifts" value={addName} onChange={(event) => setAddName(event.target.value)} />
              </div>
              <div className="space-y-2">
                <button type="button" className="text-sm text-primary" onClick={() => setAddSubs((current) => [...current, ""])}>
                  Add Sub Category
                </button>
                {addSubs.map((sub, index) => (
                  <Input
                    key={index}
                    placeholder="Sub category (optional)"
                    value={sub}
                    onChange={(event) => setAddSubs((current) => current.map((value, i) => (i === index ? event.target.value : value)))}
                  />
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={addCategory} disabled={savingAdd} className="gap-2">
                  <Save className="h-4 w-4" />{savingAdd ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-xl rounded-xl shadow-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">Edit Category</h2>
              <button onClick={() => setEditing(null)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <div className="flex gap-2">
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} />
                  <Button onClick={saveCategoryName} className="gap-2">
                    <Save className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Subcategories</label>
                  <button className="text-sm text-primary" onClick={() => setNewSubName("")}>{/* keep focus */}</button>
                </div>
                {editSubs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subcategories.</p>
                ) : (
                  editSubs.map((subcategory) => (
                    <div key={subcategory.id ?? subcategory.name} className="flex items-center gap-2">
                      <Input
                        value={subcategory.name}
                        onChange={(event) => setEditSubs((current) => current.map((value) => (value.id === subcategory.id ? { ...value, name: event.target.value } : value)))}
                      />
                      <Button onClick={() => renameSubcategory(subcategory)} className="shrink-0">
                        Save
                      </Button>
                      <Button onClick={() => deleteSubcategory(subcategory)} className="shrink-0">
                        Delete
                      </Button>
                    </div>
                  ))
                )}
                <div className="flex gap-2 pt-2">
                  <Input placeholder="Add new subcategory" value={newSubName} onChange={(event) => setNewSubName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addSubcategory(); }} />
                  <Button onClick={addSubcategory}>Add</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
