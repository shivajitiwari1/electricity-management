"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Users, FilePlus2, ChevronsUpDown } from "lucide-react";
import { MonthSelect, monthRange } from "@/components/ui/month-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface ConnectionPreview {
  id: string;
  flatNo: string;
  tower: string;
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
  const [result, setResult] = useState<{ created: number; skipped: number; errors?: number } | null>(null);

  const [mode, setMode] = useState<"all" | "individual">("all");
  const [selConnId, setSelConnId] = useState("");
  const [connOpen, setConnOpen] = useState(false);

  const selConn = connections.find((c) => c.id === selConnId);

  const handleGenerateAll = async () => {
    if (!month) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cron/generate-maintenance-bills?month=${month}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Generation failed"); return; }
      setResult(data);
      if (data.created > 0) toast.success(`${data.created} bills raised`);
      else toast.info(`No new bills — ${data.skipped} already exist`);
    } catch { toast.error("Network error"); }
    finally { setGenerating(false); }
  };

  const handleGenerateOne = async () => {
    if (!selConnId || !month) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/maintenance/bills/generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: selConnId, month }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
      if (data.skipped) {
        toast.info(`Bill ${data.billNumber} already exists for this month.`);
        setResult({ created: 0, skipped: 1 });
      } else {
        toast.success(`Bill ${data.billNumber} generated successfully.`);
        setResult({ created: 1, skipped: 0 });
      }
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
              <span className="font-medium text-blue-800">
                Current rate: ₹{Number(currentRatePerSqFt).toFixed(2)} per sq ft
              </span>
              {" · "}
              <span className="text-blue-700">{connections.length} active connections</span>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 text-sm text-yellow-800">
              No maintenance rate configured. Add a rate first before generating bills.
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex gap-3">
            {(["all", "individual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setResult(null); setSelConnId(""); }}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  mode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {m === "all"
                  ? <><Users className="h-4 w-4" /> All Customers</>
                  : <><FilePlus2 className="h-4 w-4" /> Individual Customer</>}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            {mode === "individual" && (
              <div className="space-y-1 flex-1 min-w-[220px]">
                <Label>Select Customer</Label>
                <Popover open={connOpen} onOpenChange={setConnOpen}>
                  <PopoverTrigger
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={selConnId ? "" : "text-muted-foreground"}>
                      {selConn ? `${selConn.flatNo} — ${selConn.residentName}` : "Search flat or name…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-[340px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Flat no or resident name…" />
                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                          {connections.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.flatNo} ${c.residentName} ${c.tower}`}
                              data-checked={selConnId === c.id || undefined}
                              onSelect={() => { setSelConnId(c.id); setConnOpen(false); }}
                            >
                              <div>
                                <p className="font-medium">{c.flatNo} — {c.residentName}</p>
                                <p className="text-xs text-muted-foreground">Tower {c.tower} · {c.unitArea} sq ft</p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="space-y-1">
              <Label>Billing Month</Label>
              <MonthSelect
                value={month}
                onChange={setMonth}
                options={monthRange({ back: 12, forward: 3 })}
                className="w-44"
              />
            </div>

            {mode === "all" ? (
              <Button onClick={handleGenerateAll} disabled={generating || !currentRatePerSqFt || !month}>
                {generating ? "Generating…" : "Raise Bills for All Customers"}
              </Button>
            ) : (
              <Button onClick={handleGenerateOne} disabled={generating || !currentRatePerSqFt || !month || !selConnId}>
                {generating ? "Generating…" : "Raise Bill"}
              </Button>
            )}
          </div>

          {result && (
            <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-1 border">
              <p><Badge className="bg-green-100 text-green-800 mr-2">{result.created} created</Badge>New bills raised</p>
              <p><Badge variant="secondary" className="mr-2">{result.skipped} skipped</Badge>Already exist or no unit area</p>
              {(result.errors ?? 0) > 0 && (
                <p><Badge className="bg-red-100 text-red-800 mr-2">{result.errors} errors</Badge>Check server logs</p>
              )}
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
                  <tr
                    key={c.flatNo}
                    className={`border-b last:border-0 hover:bg-gray-50 ${selConnId === c.id ? "bg-blue-50" : ""}`}
                  >
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
