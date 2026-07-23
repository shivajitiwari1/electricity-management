"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface MaintenanceRate {
  id: string;
  ratePerSqFt: string;
  effectiveFrom: string;
  createdAt: string;
}

export default function MaintenanceRatesManager({ rates: initialRates }: { rates: MaintenanceRate[] }) {
  const router = useRouter();
  const [ratePerSqFt, setRatePerSqFt] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const rates = initialRates;

  const currentRate = rates[0] ?? null;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratePerSqFt || !effectiveFrom) { toast.error("Both fields are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/maintenance/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratePerSqFt: parseFloat(ratePerSqFt), effectiveFrom }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error ?? "Failed"); return; }
      toast.success("Rate added");
      setRatePerSqFt(""); setEffectiveFrom("");
      router.refresh();
    } catch { toast.error("Network error"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      {currentRate && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <p className="text-sm font-medium text-blue-700 mb-1">Current Rate</p>
            <p className="text-3xl font-bold text-blue-900">
              ₹{Number(currentRate.ratePerSqFt).toFixed(2)}{" "}
              <span className="text-base font-normal text-blue-700">per sq ft / month</span>
            </p>
            <p className="text-sm text-blue-600 mt-1">Effective from {fmt(currentRate.effectiveFrom)}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Add New Rate</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label htmlFor="rate">Rate (₹ per sq ft)</Label>
              <Input id="rate" type="number" step="0.01" min="0.01" placeholder="2.50"
                value={ratePerSqFt} onChange={(e) => setRatePerSqFt(e.target.value)} className="w-40" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="from">Effective From</Label>
              <Input id="from" type="date" value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)} className="w-44" />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adding…" : "Add Rate"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Rate History</CardTitle></CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Rate (₹/sq ft)</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Effective From</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Added On</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r, i) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">₹{Number(r.ratePerSqFt).toFixed(2)}</td>
                  <td className="px-4 py-3">{fmt(r.effectiveFrom)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {i === 0
                      ? <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Current</Badge>
                      : <Badge variant="secondary">Historical</Badge>}
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No rates yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
