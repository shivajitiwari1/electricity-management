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
import { Plus } from "lucide-react";

type SerializedRate = {
  id: string;
  ncplPerUnit: string;
  dgFixed: string;
  fixedPerKw: string;
  effectiveFrom: string;
};

interface Props {
  rates: SerializedRate[];
}

export default function RatesTable({ rates }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    ncplPerUnit: "",
    dgFixed: "",
    fixedPerKw: "",
  });

  const current = rates[0];

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
            <Button size="sm" onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Update Rates
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">NPCL / Unit</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.ncplPerUnit}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">DG Fixed Charge</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.dgFixed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Fixed / kW</p>
                <p className="text-2xl font-bold text-gray-900">₹{current.fixedPerKw}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Effective From</p>
                <p className="text-sm font-medium text-gray-900 mt-1">
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
            <p className="text-gray-500 mb-4">No rates configured yet.</p>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Set Initial Rates
            </Button>
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
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Effective From</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">NPCL / Unit (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">DG Fixed (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fixed / kW (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-gray-400">
                      No rate history
                    </td>
                  </tr>
                ) : (
                  rates.map((rate, idx) => (
                    <tr key={rate.id} className="border-b last:border-0 hover:bg-gray-50">
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
            <div>
              <Label htmlFor="ncplPerUnit">NPCL Per Unit (₹) *</Label>
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
            <div>
              <Label htmlFor="dgFixed">DG Fixed Charge (₹) *</Label>
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
            <div>
              <Label htmlFor="fixedPerKw">Fixed Charge Per kW (₹) *</Label>
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
