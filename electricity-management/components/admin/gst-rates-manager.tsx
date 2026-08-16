"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Percent } from "lucide-react";

interface Props {
  initialCgst: number;
  initialSgst: number;
}

export default function GstRatesManager({ initialCgst, initialSgst }: Props) {
  const [cgst, setCgst] = useState(String(initialCgst));
  const [sgst, setSgst] = useState(String(initialSgst));
  const [saving, setSaving] = useState(false);

  const totalGst = (Number(cgst) || 0) + (Number(sgst) || 0);

  const handleSave = async () => {
    const c = parseFloat(cgst);
    const s = parseFloat(sgst);
    if (isNaN(c) || isNaN(s) || c < 0 || s < 0 || c > 100 || s > 100) {
      toast.error("Enter valid GST rates between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/maintenance/gst-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cgstRate: c, sgstRate: s }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
      setCgst(String(data.cgstRate));
      setSgst(String(data.sgstRate));
      toast.success("GST rates updated successfully");
    } catch { toast.error("Network error"); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          GST Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          These rates are applied to maintenance bills in the PDF and net payable calculation.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>CGST Rate (%)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={cgst}
                onChange={(e) => setCgst(e.target.value)}
                className="pr-7"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          <div className="space-y-1">
            <Label>SGST Rate (%)</Label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={sgst}
                onChange={(e) => setSgst(e.target.value)}
                className="pr-7"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-md px-4 py-3 flex justify-between items-center text-sm">
          <span className="text-blue-700">Total GST</span>
          <span className="font-bold text-blue-800 text-base">{totalGst.toFixed(2)}%</span>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save GST Rates"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
