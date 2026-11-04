"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleLeft, ToggleRight } from "lucide-react";

export default function HelpDeskModuleToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/help-desk/config", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      setEnabled(data.helpDeskEnabled);
      toast.success(
        data.helpDeskEnabled
          ? "Help Desk enabled — residents can raise complaints again"
          : "Help Desk disabled — residents can no longer use it"
      );
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={enabled ? "border-green-200" : "border-red-200"}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>Help Desk Module</span>
          <Badge className={enabled
            ? "bg-green-100 text-green-800 hover:bg-green-100"
            : "bg-red-100 text-red-800 hover:bg-red-100"
          }>
            {enabled ? "ENABLED" : "DISABLED"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          When disabled, residents cannot see or open Help Desk pages, and Help Desk write APIs are blocked. Admin/manager can still toggle the module back on.
        </p>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all ${
            enabled
              ? "border-green-300 bg-green-50 hover:bg-green-100"
              : "border-red-200 bg-red-50 hover:bg-red-100"
          } disabled:opacity-50`}
        >
          <div className="text-left">
            <p className={`font-semibold text-sm ${enabled ? "text-green-800" : "text-red-800"}`}>
              {enabled ? "Help Desk is ACTIVE" : "Help Desk is INACTIVE"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {enabled ? "Click to disable Help Desk" : "Click to enable Help Desk"}
            </p>
          </div>
          {enabled
            ? <ToggleRight className="h-8 w-8 text-green-600 shrink-0" />
            : <ToggleLeft className="h-8 w-8 text-red-400 shrink-0" />}
        </button>
      </CardContent>
    </Card>
  );
}
