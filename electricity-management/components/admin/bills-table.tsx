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
import { Download, Eye, CheckCircle } from "lucide-react";

type SerializedBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  billDate: string;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  totalAmount: string;
  status: string;
  paymentId: string | null;
};

interface Props {
  initialData: SerializedBill[];
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

export default function BillsTable({ initialData }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [viewBill, setViewBill] = useState<SerializedBill | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

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
          <span className="text-xs font-medium text-gray-600">Tower</span>
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
          <span className="text-xs font-medium text-gray-600">Month (YYYY-MM)</span>
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
          <span className="text-xs font-medium text-gray-600">Status</span>
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
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Bill #</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Period</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Amount (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {initialData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-gray-400">
                      No bills found
                    </td>
                  </tr>
                ) : (
                  initialData.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs">{bill.flatNo}</td>
                      <td className="px-4 py-3">{bill.tower}</td>
                      <td className="px-4 py-3 font-medium">{bill.residentName}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatPeriod(bill.billingPeriodStart, bill.billingPeriodEnd)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {parseFloat(bill.totalAmount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
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
                          {bill.status === "PENDING" && (
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
          </DialogHeader>
          {viewBill && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-gray-500">Bill Number</span>
                <span className="font-mono font-medium">{viewBill.billNumber}</span>

                <span className="text-gray-500">Flat No</span>
                <span className="font-mono">{viewBill.flatNo}</span>

                <span className="text-gray-500">Tower</span>
                <span>{viewBill.tower}</span>

                <span className="text-gray-500">Resident</span>
                <span>{viewBill.residentName}</span>

                <span className="text-gray-500">Bill Date</span>
                <span>{formatDate(viewBill.billDate)}</span>

                <span className="text-gray-500">Due Date</span>
                <span>{formatDate(viewBill.dueDate)}</span>

                <span className="text-gray-500">Billing Period</span>
                <span>{formatPeriod(viewBill.billingPeriodStart, viewBill.billingPeriodEnd)}</span>

                <span className="text-gray-500">Total Amount</span>
                <span className="font-semibold">
                  ₹{parseFloat(viewBill.totalAmount).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>

                <span className="text-gray-500">Status</span>
                <span><StatusBadge status={viewBill.status} /></span>

                {viewBill.paymentId && (
                  <>
                    <span className="text-gray-500">Payment ID</span>
                    <span className="font-mono text-xs">{viewBill.paymentId}</span>
                  </>
                )}
              </div>
              <div className="flex justify-end pt-2">
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
