"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Eye, CheckCircle, Trash2 } from "lucide-react";

type SerializedBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  meterNo: string | null;
  sanctionedLoad: string;
  unitArea: number;
  billDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  readingDate: string | null;
  ncplPrevious: string;
  ncplCurrent: string;
  ncplUnits: string;
  dgPrevious: string;
  dgCurrent: string;
  dgUnits: string;
  ratePerUnit: string;
  ncplCharge: string;
  dgCharge: string;
  fixedCharge: string;
  previousDues: string;
  totalAmount: string;
  status: string;
  paymentId: string | null;
};

interface Props {
  initialData: SerializedBill[];
  canWrite: boolean;
  canDelete: boolean;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        PAID
      </Badge>
    );
  }
  if (status === "OVERDUE") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        OVERDUE
      </Badge>
    );
  }
  if (status === "PARTIAL") {
    return (
      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
        PARTIAL
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
      PENDING
    </Badge>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default function BillsTable({ initialData, canWrite, canDelete }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [viewBill, setViewBill] = useState<SerializedBill | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deletingBill, setDeletingBill] = useState<string | null>(null);

  // Current filter values from URL
  const currentTower = searchParams.get("tower") ?? "";
  const currentMonth = searchParams.get("month") ?? "";
  const currentStatus = searchParams.get("status") ?? "";

  function pushFilters(overrides: Record<string, string>) {
    const params = new URLSearchParams();
    const merged = {
      tower: currentTower,
      month: currentMonth,
      status: currentStatus,
      ...overrides,
    };
    if (merged.tower) params.set("tower", merged.tower);
    if (merged.month) params.set("month", merged.month);
    if (merged.status) params.set("status", merged.status);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handleDeleteBill(bill: SerializedBill) {
    const confirmed = window.confirm(
      `Delete bill ${bill.billNumber} (Flat ${bill.flatNo})?\n\nThis will also delete all payments linked to this bill. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingBill(bill.id);
    try {
      const res = await fetch(`/api/bills/${bill.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete bill");
        return;
      }
      toast.success(`Bill ${bill.billNumber} deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete bill");
    } finally {
      setDeletingBill(null);
    }
  }

  async function handleMarkPaid(bill: SerializedBill) {
    const confirmed = window.confirm(
      `Mark bill ${bill.billNumber} as PAID (cash payment)?`
    );
    if (!confirmed) return;
    setMarkingPaid(bill.id);
    try {
      const res = await fetch(`/api/bills/${bill.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update bill");
        return;
      }
      toast.success(`Bill ${bill.billNumber} marked as PAID`);
      router.refresh();
    } catch {
      toast.error("Failed to update bill");
    } finally {
      setMarkingPaid(null);
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Tower</span>
          <Select
            value={currentTower || "all"}
            onValueChange={(val) =>
              pushFilters({ tower: !val || val === "all" ? "" : val })
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {["A", "B", "C", "V"].map((t) => (
                <SelectItem key={t} value={t}>
                  Tower {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Month (YYYY-MM)</span>
          <Input
            className="w-36"
            placeholder="e.g. 2026-07"
            defaultValue={currentMonth}
            onBlur={(e) => pushFilters({ month: e.target.value.trim() })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushFilters({ month: (e.target as HTMLInputElement).value.trim() });
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select
            value={currentStatus || "all"}
            onValueChange={(val) =>
              pushFilters({ status: !val || val === "all" ? "" : val })
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">PENDING</SelectItem>
              <SelectItem value="PAID">PAID</SelectItem>
              <SelectItem value="OVERDUE">OVERDUE</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(currentTower || currentMonth || currentStatus) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(pathname)}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {initialData.length} Bill{initialData.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  initialData.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs">{bill.flatNo}</td>
                      <td className="px-4 py-3">{bill.tower}</td>
                      <td className="px-4 py-3 font-medium">{bill.residentName}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatPeriod(bill.billingPeriodStart, bill.billingPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {parseFloat(bill.totalAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(bill.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(`/api/pdf/bill/${bill.id}`)
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewBill(bill)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          {canWrite && bill.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200"
                              disabled={markingPaid === bill.id}
                              onClick={() => handleMarkPaid(bill)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {markingPaid === bill.id ? "..." : "Mark Paid"}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              disabled={deletingBill === bill.id}
                              onClick={() => handleDeleteBill(bill)}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              {deletingBill === bill.id ? "..." : "Delete"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bill Details Dialog */}
      <Dialog open={!!viewBill} onOpenChange={(open) => { if (!open) setViewBill(null); }}>
        <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader className="shrink-0">
            <DialogTitle>Bill Details — {viewBill?.billNumber}</DialogTitle>
          </DialogHeader>
          {viewBill && (
            <div className="space-y-5 text-sm overflow-y-auto flex-1 pr-1">

              {/* Basic Info */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Basic Information</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-muted/40 rounded-lg p-3">
                  <span className="text-muted-foreground">Bill Number</span>
                  <span className="font-mono font-medium">{viewBill.billNumber}</span>
                  <span className="text-muted-foreground">Resident</span>
                  <span className="font-medium">{viewBill.residentName}</span>
                  <span className="text-muted-foreground">Flat / Tower</span>
                  <span>{viewBill.flatNo} &mdash; Tower {viewBill.tower}</span>
                  <span className="text-muted-foreground">Meter No</span>
                  <span className="font-mono">{viewBill.meterNo ?? "—"}</span>
                  <span className="text-muted-foreground">Sanctioned Load</span>
                  <span>{parseFloat(viewBill.sanctionedLoad).toFixed(1)} kW</span>
                  <span className="text-muted-foreground">Unit Area</span>
                  <span>{viewBill.unitArea} Sq.Ft.</span>
                  <span className="text-muted-foreground">Bill Date</span>
                  <span>{formatDate(viewBill.billDate)}</span>
                  <span className="text-muted-foreground">Due Date</span>
                  <span>{formatDate(viewBill.dueDate)}</span>
                  <span className="text-muted-foreground">Billing Period</span>
                  <span>{formatPeriod(viewBill.billingPeriodStart, viewBill.billingPeriodEnd)}</span>
                  <span className="text-muted-foreground">Status</span>
                  <span><StatusBadge status={viewBill.status} /></span>
                </div>
              </div>

              {/* Meter Readings */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Meter Reading Details</p>
                  {viewBill.readingDate && (
                    <p className="text-xs text-muted-foreground">Reading Date: <span className="font-medium text-foreground">{formatDate(viewBill.readingDate)}</span></p>
                  )}
                </div>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Source</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Previous</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Current</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="px-3 py-2 font-medium">NPCL Power</td>
                        <td className="px-3 py-2 text-right tabular-nums">{parseFloat(viewBill.ncplPrevious).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{parseFloat(viewBill.ncplCurrent).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{parseFloat(viewBill.ncplUnits).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 font-medium">DG Power</td>
                        <td className="px-3 py-2 text-right tabular-nums">{parseFloat(viewBill.dgPrevious).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{parseFloat(viewBill.dgCurrent).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{parseFloat(viewBill.dgUnits).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Charge Breakdown */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Charge Breakdown</p>
                <div className="space-y-1.5 rounded-lg border p-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">NPCL Energy Charges ({parseFloat(viewBill.ncplUnits).toFixed(2)} units × ₹{parseFloat(viewBill.ratePerUnit).toFixed(2)}/unit)</span>
                    <span className="tabular-nums">₹{parseFloat(viewBill.ncplCharge).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">DG Energy Charges (Fixed)</span>
                    <span className="tabular-nums">₹{parseFloat(viewBill.dgCharge).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fixed Charge (@ ₹115 per kW/month)</span>
                    <span className="tabular-nums">₹{parseFloat(viewBill.fixedCharge).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {parseFloat(viewBill.previousDues) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Previous Outstanding Balance</span>
                      <span className="tabular-nums text-red-600">₹{parseFloat(viewBill.previousDues).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
                    <span>Net Payable Amount</span>
                    <span className="tabular-nums text-foreground">₹{parseFloat(viewBill.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/pdf/bill/${viewBill.id}`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
