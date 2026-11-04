"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Save, ShieldCheck, X } from "lucide-react";

const UNIT_LABELS = ["MINUTES", "HOURS", "DAYS"] as const;

const STEP_LABELS = [
  "First Response",
  "First Escalation",
  "Second Escalation",
  "Third Escalation",
  "Fourth Escalation",
  "Fifth Escalation",
  "Sixth Escalation",
  "Seventh Escalation",
  "Eighth Escalation",
  "Ninth Escalation",
] as const;

type Step = {
  level: number;
  timeValue: number;
  timeUnit: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
};

type Rule = {
  id: string;
  categoryId: string;
  categoryName: string;
  priority: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  steps: Step[];
};

function formatStepTime(step?: Step) {
  if (!step) return "—";
  const unit =
    step.timeUnit === "DAYS" ? "d" : step.timeUnit === "HOURS" ? "hrs" : "min";
  return `${step.timeValue} ${unit}`;
}

export default function EscalationMatrixManager({
  canDelete = false,
}: {
  canDelete?: boolean;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<null | {
    id?: string;
    categoryId: string;
    priority: string;
    isActive: boolean;
    steps: Step[];
  }>(null);

  async function load() {
    const [rulesRes, categoriesRes] = await Promise.all([
      fetch("/api/help-desk/escalation", { cache: "no-store" }),
      fetch("/api/help-desk/categories", { cache: "no-store" }),
    ]);
    const [rulesData, categoriesData] = await Promise.all([
      rulesRes.json(),
      categoriesRes.json(),
    ]);
    if (!rulesRes.ok) throw new Error(rulesData.error ?? "Could not load escalation rules");
    setRules(rulesData.rules ?? []);
    setCategories(categoriesData.categories ?? []);
  }

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not load escalation matrix");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function newDraft() {
    setDraft({
      categoryId: categories[0]?.id ?? "",
      priority: "MEDIUM",
      isActive: true,
      steps: [
        {
          level: 0,
          timeValue: 30,
          timeUnit: "MINUTES",
          contactName: "",
          contactEmail: "",
          contactPhone: "",
        },
      ],
    });
  }

  function editDraft(rule: Rule) {
    setDraft({
      id: rule.id,
      categoryId: rule.categoryId,
      priority: rule.priority,
      isActive: rule.isActive,
      steps: [...rule.steps],
    });
  }

  function addStep() {
    if (!draft) return;
    const nextLevel = draft.steps.length;
    if (nextLevel >= 10) return toast.error("Up to nine escalation levels are supported");
    setDraft({
      ...draft,
      steps: [
        ...draft.steps,
        {
          level: nextLevel,
          timeValue: 15,
          timeUnit: "MINUTES",
          contactName: "",
          contactEmail: "",
          contactPhone: "",
        },
      ],
    });
  }

  function removeStep(level: number) {
    if (!draft) return;
    const steps = draft.steps
      .filter((step) => step.level !== level)
      .map((step, index) => ({ ...step, level: index }));
    setDraft({ ...draft, steps });
  }

  async function save() {
    if (!draft) return;
    if (!draft.categoryId) return toast.error("Select a category");
    if (draft.steps.length === 0) return toast.error("Add at least one step");
    for (const step of draft.steps) {
      if (!step.contactName.trim()) return toast.error("Every step needs a contact name");
      if (!step.contactEmail.trim()) return toast.error("Every step needs an email");
      if (!Number.isFinite(step.timeValue) || step.timeValue <= 0) {
        return toast.error("Time must be a positive number");
      }
    }

    setSaving(true);
    try {
      const res = await fetch("/api/help-desk/escalation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save escalation rule");
      toast.success("Escalation rule saved");
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save escalation rule");
    } finally {
      setSaving(false);
    }
  }

  async function remove(rule: Rule) {
    if (!window.confirm(`Delete escalation for ${rule.categoryName} (${rule.priority})?`)) return;
    try {
      const res = await fetch(`/api/help-desk/escalation/${rule.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not delete rule");
      toast.success("Rule deleted");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete rule");
    }
  }

  if (loading) {
    return (
      <Card><CardContent className="py-10 text-center text-muted-foreground">Loading escalation matrix…</CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={newDraft} className="gap-2">
          <Plus className="h-4 w-4" /> Add Escalation
        </Button>
      </div>

      <div className="rounded-xl border overflow-x-auto bg-card">
        <table className="w-full text-sm min-w-[980px]">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-left px-4 py-3 font-medium">Priority</th>
              <th className="text-left px-4 py-3 font-medium">First Response</th>
              <th className="text-left px-4 py-3 font-medium">Escalations</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-right px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{rule.categoryName}</td>
                <td className="px-4 py-3">{rule.priority}</td>
                <td className="px-4 py-3">{formatStepTime(rule.steps[0])}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {rule.steps.length > 1
                    ? rule.steps.slice(1).map((step) => STEP_LABELS[step.level] ?? `Level ${step.level}`).join(", ")
                    : "None"}
                </td>
                <td className="px-4 py-3">
                  <span className={rule.isActive ? "text-green-600" : "text-muted-foreground"}>
                    {rule.isActive ? "Active" : "Disabled"}
                  </span>
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
                  No escalation rules yet. Add one to route tickets by category and priority.
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
              <h2 className="text-lg font-semibold">{draft.id ? "Edit Escalation Matrix" : "Add Escalation Matrix"}</h2>
              <button onClick={() => setDraft(null)} className="rounded-md p-1 hover:bg-accent">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Category</span>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">Priority</span>
                  <select className="w-full h-10 rounded-md border border-input bg-background px-3" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </label>
                <label className="space-y-1.5 inline-flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={draft.isActive} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
                  <span className="text-sm font-medium">Active</span>
                </label>
              </div>

              {draft.steps.map((step) => (
                <div key={step.level} className="rounded-lg border p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{STEP_LABELS[step.level] ?? `Level ${step.level}`}</p>
                    {draft.steps.length > 1 && (
                      <button onClick={() => removeStep(step.level)} className="text-xs text-destructive inline-flex items-center gap-1">
                        <X className="h-4 w-4" /> Remove
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <label className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Time</span>
                      <Input type="number" min={1} value={step.timeValue} onChange={(event) => {
                        const next = { ...draft, steps: draft.steps.map((item) => item.level === step.level ? { ...item, timeValue: Number(event.target.value) } : item) };
                        setDraft(next);
                      }} />
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs text-muted-foreground">Type</span>
                      <select className="w-full h-10 rounded-md border border-input bg-background px-2" value={step.timeUnit} onChange={(event) => {
                        setDraft({ ...draft, steps: draft.steps.map((item) => item.level === step.level ? { ...item, timeUnit: event.target.value } : item) });
                      }}>
                        {UNIT_LABELS.map((unit) => <option key={unit} value={unit}>{unit.toLowerCase()}</option>)}
                      </select>
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-xs text-muted-foreground">Name</span>
                      <Input placeholder="Contact name" value={step.contactName} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item) => item.level === step.level ? { ...item, contactName: event.target.value } : item) })} />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-xs text-muted-foreground">Email</span>
                      <Input type="email" placeholder="email@example.com" value={step.contactEmail} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item) => item.level === step.level ? { ...item, contactEmail: event.target.value } : item) })} />
                    </label>
                    <label className="space-y-1.5 sm:col-span-2">
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <Input placeholder="Phone (optional)" value={step.contactPhone} onChange={(event) => setDraft({ ...draft, steps: draft.steps.map((item) => item.level === step.level ? { ...item, contactPhone: event.target.value } : item) })} />
                    </label>
                  </div>
                </div>
              ))}

              {draft.steps.length < 10 && (
                <Button variant="outline" onClick={addStep} className="gap-2">
                  <Plus className="h-4 w-4" /> Add More
                </Button>
              )}

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
