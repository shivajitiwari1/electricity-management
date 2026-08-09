"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function MaintenanceToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/maintenance")
      .then((r) => r.json())
      .then((d) => setEnabled(d.maintenanceMode))
      .catch(() => toast.error("Failed to load maintenance status"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/maintenance", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to toggle");
      setEnabled(data.maintenanceMode);
      toast.success(
        data.maintenanceMode
          ? "Maintenance mode ON — site is now down for residents"
          : "Maintenance mode OFF — site is live"
      );
    } catch (err: any) {
      toast.error(err.message ?? "Failed to toggle maintenance mode");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">Site Maintenance Mode</span>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : enabled ? (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">SITE IS DOWN</Badge>
            ) : (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">SITE LIVE</Badge>
            )}
          </div>

          {/* Toggle switch */}
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={loading}
            onClick={toggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:cursor-not-allowed ${
              enabled ? "bg-red-500" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
