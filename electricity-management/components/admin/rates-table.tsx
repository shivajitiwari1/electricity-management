"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Trash2 } from "lucide-react";

type SerializedRate = {
  id: string;
  ncplPerUnit: string;
  dgFixed: string;
  fixedPerKw: string;
  effectiveFrom: string;
};

interface Props {
  rates: SerializedRate[];
  canWrite: boolean;
}

export default function RatesTable({ rates, canWrite }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    ncplPerUnit: "",
    dgFixed: "",
    fixedPerKw: "",
  });

  const current = rates[0];
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(rate: SerializedRate) {
    const confirmed = window.confirm(
      `Delete rate effective from ${new Date(rate.effectiveFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingId(rate.id);
    try {
      const res = await fetch(`/api/rates/${rate.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete rate");
        return;
      }
      toast.success("Rate deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete rate");
    } finally {
      setDeletingId(null);
    }
  }

  function closeModal() {
    setShowModal(false);
    setForm({ ncplPerUnit: "", dgFixed: "", fixedPerKw: "" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ncplPerUnit: Number(form.ncplPerUnit),
          dgFixed: Number(form.dgFixed),
          fixedPerKw: Number(form.fixedPerKw),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update rates");
        return;
      }
      toast.success("Rates updated successfully");
      closeModal();
      router.refresh();
    } catch {
      toast.error("Failed to update rates");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {/* Current Rate Card */}
      {current ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold">Current Rate</CardTitle>
            {canWrite && (
              <Button size="sm" onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Update Rates
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">NPCL / Unit</p>
                <p className="text-2xl font-bold text-foreground">₹{current.ncplPerUnit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">DG Fixed Charge</p>
                <p className="text-2xl font-bold text-foreground">₹{current.dgFixed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Fixed / kW</p>
                <p className="text-2xl font-bold text-foreground">₹{current.fixedPerKw}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Effective From</p>
                <p className="text-sm font-medium text-foreground mt-1">
                  {new Date(current.effectiveFrom).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No rates configured yet.</p>
            {canWrite && (
              <Button onClick={() => setShowModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Set Initial Rates
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rate History Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">Rate History</CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Effective From</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">NPCL / Unit (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">DG Fixed (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fixed / kW (₹)</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      No rate history
                    </td>
                  </tr>
                ) : (
                  rates.map((rate, idx) => (
                    <tr key={rate.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {new Date(rate.effectiveFrom).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {idx === 0 && (
                          <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                            Current
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">₹{rate.ncplPerUnit}</td>
                      <td className="px-4 py-3">₹{rate.dgFixed}</td>
                      <td className="px-4 py-3">₹{rate.fixedPerKw}</td>
                      <td className="px-4 py-3 text-right">
                        {idx !== 0 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={deletingId === rate.id}
                            onClick={() => handleDelete(rate)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Update Rates Modal */}
      <Dialog open={showModal} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Electricity Rates</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ncplPerUnit">NPCL Per Unit (Rs.) *</Label>
              <Input
                id="ncplPerUnit"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.ncplPerUnit}
                onChange={(e) => setForm((p) => ({ ...p, ncplPerUnit: e.target.value }))}
                placeholder="e.g. 8.50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dgFixed">DG Fixed Charge (Rs.) *</Label>
              <Input
                id="dgFixed"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.dgFixed}
                onChange={(e) => setForm((p) => ({ ...p, dgFixed: e.target.value }))}
                placeholder="e.g. 1500"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fixedPerKw">Fixed Charge Per kW (Rs.) *</Label>
              <Input
                id="fixedPerKw"
                type="number"
                required
                min={0}
                step={0.01}
                value={form.fixedPerKw}
                onChange={(e) => setForm((p) => ({ ...p, fixedPerKw: e.target.value }))}
                placeholder="e.g. 250"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Saving..." : "Save Rates"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
