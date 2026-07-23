"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface ConnectionPreview {
  flatNo: string;
  residentName: string;
  unitArea: number;
  projectedAmount: string;
}

interface Props {
  currentRatePerSqFt: string | null;
  connections: ConnectionPreview[];
}

export default function MaintenanceGenerator({ currentRatePerSqFt, connections }: Props) {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(defaultMonth);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: number } | null>(null);

  const handleGenerate = async () => {
    if (!month) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/generate-maintenance-bills?month=${month}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setResult(data);
      if (data.created > 0) toast.success(`${data.created} bills raised`);
      else toast.info(`No new bills (${data.skipped} already exist)`);
    } catch { toast.error("Network error"); }
    finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader><CardTitle className="text-base">Raise Maintenance Bills</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {currentRatePerSqFt ? (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm">
              <span className="font-medium text-blue-800">Current rate: ₹{Number(currentRatePerSqFt).toFixed(2)} per sq ft</span>
              {" · "}
              <span className="text-blue-700">{connections.length} active connections</span>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              No maintenance rate configured. Add a rate first before generating bills.
            </div>
          )}

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>Billing Month</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <Button onClick={handleGenerate} disabled={generating || !currentRatePerSqFt || !month}>
              {generating ? "Generating…" : "Raise Bills for All Customers"}
            </Button>
          </div>

          {result && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 border">
              <p><Badge className="bg-green-100 text-green-800 mr-2">{result.created} created</Badge>New bills raised</p>
              <p><Badge variant="secondary" className="mr-2">{result.skipped} skipped</Badge>Already exist or no unit area</p>
              {result.errors > 0 && <p><Badge className="bg-red-100 text-red-800 mr-2">{result.errors} errors</Badge>Check server logs</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Connections Preview
              <span className="text-sm font-normal text-gray-500 ml-2">— amounts for selected month</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Flat</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Resident</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Area (sq ft)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Projected Amount</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.flatNo} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium">{c.flatNo}</td>
                    <td className="px-4 py-2 text-gray-600">{c.residentName}</td>
                    <td className="px-4 py-2">{c.unitArea}</td>
                    <td className="px-4 py-2 font-medium">
                      {currentRatePerSqFt
                        ? `₹${(c.unitArea * Number(currentRatePerSqFt)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
