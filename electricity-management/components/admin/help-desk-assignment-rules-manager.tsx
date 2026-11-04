"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, ShieldCheck, X } from "lucide-react";

const DAYS = [
  "EVERYDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
] as const;

type Slot = {
  startTime: string;
  endTime: string;
  day: string;
};

type RuleSlot = Slot & { id: string };

type Rule = {
  id: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  assigneeId: string;
  assigneeName: string;
  assigneeEmail: string;
  createdAt: string;
  updatedAt: string;
  ticketSlots: RuleSlot[];
  visitSlots: RuleSlot[];
};

function slotArray(slots: RuleSlot[] = []): Slot[] {
  return slots.map(({ startTime, endTime, day }) => ({ startTime, endTime, day }));
}

export default function AssignmentRulesManager({
  canDelete = false,
}: {
  canDelete?: boolean;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Array<{
    id: string;
    name: string;
    subcategories: Array<{ id: string; name: string }>;
  }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<null | {
    id?: string;
    categoryId: string;
    subcategoryId: string | null;
    assigneeId: string;
    ticketSlots: Slot[];
    visitSlots: Slot[];
  }>(null);

  async function load() {
    const [rulesRes, optionsRes] = await Promise.all([
      fetch("/api/help-desk/assignment-rules", { cache: "no-store" }),
      fetch("/api/help-desk/form-options", { cache: "no-store" }),
    ]);
    const [rulesData, optionsData] = await Promise.all([rulesRes.json(), optionsRes.json()]);
    if (!rulesRes.ok) throw new Error(rulesData.error ?? "Could not load assignment rules");
    setRules(rulesData.rules ?? []);
    setCategories(optionsData.categories ?? []);
    setStaff(optionsData.staff ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load assignment rules");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function newDraft() {
    setDraft({
      categoryId: categories[0]?.id ?? "",
      subcategoryId: null,
      assigneeId: staff[0]?.id ?? "",
      ticketSlots: [{ startTime: "09:00", endTime: "18:00", day: "EVERYDAY" }],
      visitSlots: [],
    });
  }

  function editDraft(rule: Rule) {
    setDraft({
      id: rule.id,
      categoryId: rule.categoryId,
      subcategoryId: rule.subcategoryId,
      assigneeId: rule.assigneeId,
      ticketSlots: slotArray(rule.ticketSlots ?? []),
      visitSlots: slotArray(rule.visitSlots ?? []),
    });
  }

  function updateSlot(kind: "ticketSlots" | "visitSlots", index: number, patch: Partial<Slot>) {
    if (!draft) return;
    setDraft({
      ...draft,
      [kind]: draft[kind].map((slot, idx) => (idx === index ? { ...slot, ...patch } : slot)),
    } as typeof draft);
  }

  function addSlot(kind: "ticketSlots" | "visitSlots") {
    if (!draft) return;
    setDraft({
      ...draft,
      [kind]: [...draft[kind], { startTime: "09:00", endTime: "18:00", day: "EVERYDAY" }],
    } as typeof draft);
  }

  function removeSlot(kind: "ticketSlots" | "visitSlots", index: number) {
    if (!draft) return;
    setDraft({
      ...draft,
      [kind]: draft[kind].filter((_, idx) => idx !== index),
    } as typeof draft);
  }

  async function save() {
    if (!draft) return;
    if (!draft.categoryId) return toast.error("Select a category");
    if (!draft.assigneeId) return toast.error("Select an assignee");
    if (draft.ticketSlots.length === 0) return toast.error("Add at least one ticket assignment slot");

    setSaving(true);
    try {
      const method = draft.id ? "PATCH" : "POST";
      const url = draft.id ? `/api/help-desk/assignment-rules/${draft.id}` : "/api/help-desk/assignment-rules";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save assignment rule");
      toast.success("Assignment rule saved");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save assignment rule");
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule: Rule) {
    if (!window.confirm(`Delete assignment rule for ${rule.categoryName}?`)) return;
    try {
      const res = await fetch(`/api/help-desk/assignment-rules/${rule.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule");
      toast.success("Rule deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete rule");
    }
  }

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === draft?.categoryId),
    [categories, draft?.categoryId]
  );

  if (loading) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">Loading assignment rules…</CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={newDraft} className="gap-2">
          <Plus className="h-4 w-4" /> Add Rule
        </Button>
      </div>

      <div className="rounded-xl border overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Sub Category</th>
              <th className="text-left px-4 py-3 font-medium">Assignee</th>
              <th className="text-left px-4 py-3 font-medium">Assignment Slot Timings</th>
              <th className="text-left px-4 py-3 font-medium">Visit Slot Timings</th>
              <th className="text-right px-4 py-3 font-medium">Options</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{rule.categoryName}</td>
                <td className="px-4 py-3">{rule.subcategoryName ?? "—"}</td>
                <td className="px-4 py-3">{rule.assigneeName}</td>
                <td className="px-4 py-3 text-xs">
                  {rule.ticketSlots.length > 0
                    ? rule.ticketSlots.map((slot) => `${slot.startTime}–${slot.endTime} (${slot.day})`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-xs">
                  {rule.visitSlots.length > 0
                    ? rule.visitSlots.map((slot) => `${slot.startTime}–${slot.endTime} (${slot.day})`).join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => editDraft(rule)} className="inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 hover:bg-accent">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {canDelete && (
                      <button onClick={() => remove(rule)} className="inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1.5 text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  <ShieldCheck className="h-8 w-8 mx-auto mb-2" />
                  No assignment rules yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {draft && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-end md:items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card w-full max-w-3xl rounded-xl shadow-lg max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="text-lg font-semibold">{draft.id ? "Edit Assignment Rule" : "Add Assignment Rule"}</h2>
              <button onClick={() => setDraft(null)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Select Category *</span>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value, subcategoryId: null })}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Select Sub Category</span>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={draft.subcategoryId ?? ""} onChange={(event) => setDraft({ ...draft, subcategoryId: event.target.value || null })}>
                    <option value="">None</option>
                    {selectedCategory?.subcategories.map((subcategory) => (
                      <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium">Select Assignee *</span>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={draft.assigneeId} onChange={(event) => setDraft({ ...draft, assigneeId: event.target.value })}>
                    <option value="">Select assignee</option>
                    {staff.map((user) => (
                      <option key={user.id} value={user.id}>{user.name} ({user.role})</option>
                    ))}
                  </select>
                </label>
              </div>

              {([
                { kind: "ticketSlots" as const, title: "Ticket Assignment", required: true },
                { kind: "visitSlots" as const, title: "House Visit Slot", required: false },
              ]).map(({ kind, title }) => (
                <div key={kind} className="rounded-lg border p-3 bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{title}</p>
                    <Button variant="ghost" size="sm" onClick={() => addSlot(kind)} className="gap-1 text-xs">
                      <Plus className="h-4 w-4" /> Add Slot
                    </Button>
                  </div>
                  {draft[kind].length === 0 && (
                    <p className="text-sm text-muted-foreground">No slots added for this tab yet.</p>
                  )}
                  {draft[kind].map((slot, index) => (
                    <div key={`${kind}-${index}`} className="grid sm:grid-cols-4 gap-2 items-end">
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Start Time</span>
                        <Input type="time" value={slot.startTime} onChange={(event) => updateSlot(kind, index, { startTime: event.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">End Time</span>
                        <Input type="time" value={slot.endTime} onChange={(event) => updateSlot(kind, index, { endTime: event.target.value })} />
                      </label>
                      <label className="space-y-1">
                        <span className="text-xs text-muted-foreground">Day</span>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={slot.day} onChange={(event) => updateSlot(kind, index, { day: event.target.value })}>
                          {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                        </select>
                      </label>
                      <button onClick={() => removeSlot(kind, index)} className="h-10 rounded-md border px-3 text-sm text-destructive hover:bg-destructive/10">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Add / Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
