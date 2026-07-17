"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Banknote, AlertTriangle, Trash2 } from "lucide-react";

type SerializedPayment = {
  id: string;
  receiptNumber: string;
  flatNo: string;
  residentName: string;
  billNumber: string;
  amount: string;
  paymentDate: string;
  method: string;
  status: string;
  razorpayPaymentId: string | null;
};

type PendingBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  residentName: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string;
  status: string;
};

interface Props {
  initialData: SerializedPayment[];
  pendingBills: PendingBill[];
}

function MethodBadge({ method }: { method: string }) {
  if (method === "ONLINE") {
    return (
      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
        ONLINE
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
      CASH
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "SUCCESS") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
        SUCCESS
      </Badge>
    );
  }
  if (status === "FAILED") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
        FAILED
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
      INITIATED
    </Badge>
  );
}

function BillStatusBadge({ status }: { status: string }) {
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

function formatINR(amount: string) {
  return `₹${parseFloat(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function PaymentsTable({ initialData, pendingBills }: Props) {
  const router = useRouter();
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [deletingPayment, setDeletingPayment] = useState<string | null>(null);

  async function handleDeletePayment(id: string, receiptNumber: string) {
    const confirmed = window.confirm(
      `Delete payment ${receiptNumber}?\n\nThe linked bill's balance will be restored. This cannot be undone.`
    );
    if (!confirmed) return;
    setDeletingPayment(id);
    try {
      const res = await fetch(`/api/payments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to delete payment");
        return;
      }
      toast.success(`Payment ${receiptNumber} deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete payment");
    } finally {
      setDeletingPayment(null);
    }
  }

  // Cash payment dialog
  const [cashBill, setCashBill] = useState<PendingBill | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [isCashSubmitting, setIsCashSubmitting] = useState(false);

  const filtered = useMemo(() => {
    return initialData.filter((p) => {
      if (filterMethod !== "all" && p.method !== filterMethod) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [initialData, filterMethod, filterStatus]);

  function openCashDialog(bill: PendingBill) {
    const remaining = parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount ?? "0");
    setCashAmount(remaining.toFixed(2));
    setCashBill(bill);
  }

  async function handleCashPayment() {
    if (!cashBill) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setIsCashSubmitting(true);
    try {
      const res = await fetch("/api/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId: cashBill.id, amount }),
      });
      if (res.ok) {
        const data = await res.json();
        const msg = data.isFullyPaid
          ? `Full payment recorded — Receipt ${data.receiptNumber}`
          : `Partial payment recorded — Receipt ${data.receiptNumber} (₹${data.remaining.toFixed(2)} remaining)`;
        toast.success(msg);
        setCashBill(null);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error ?? "Failed to record payment");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsCashSubmitting(false);
    }
  }

  const overdueCount = pendingBills.filter((b) => b.status === "OVERDUE").length;

  return (
    <>
      {/* Pending Bills Requiring Payment */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {overdueCount > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            Bills Requiring Payment
            <span className="ml-auto text-sm font-normal text-muted-foreground">
              {pendingBills.length} pending
              {overdueCount > 0 && (
                <span className="text-red-600 font-medium ml-1">
                  ({overdueCount} overdue)
                </span>
              )}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance Due</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      No pending bills — all caught up!
                    </td>
                  </tr>
                ) : (
                  pendingBills.map((bill) => (
                    <tr
                      key={bill.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${bill.status === "OVERDUE" ? "bg-red-50/40" : bill.status === "PARTIAL" ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{bill.flatNo}</td>
                      <td className="px-4 py-3">{bill.residentName}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatINR((parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount ?? "0")).toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(bill.dueDate)}</td>
                      <td className="px-4 py-3">
                        <BillStatusBadge status={bill.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCashDialog(bill)}
                        >
                          <Banknote className="h-3 w-3 mr-1" />
                          Cash Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Method</span>
          <Select value={filterMethod} onValueChange={(val) => setFilterMethod(val ?? "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ONLINE">ONLINE</SelectItem>
              <SelectItem value="CASH">CASH</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val ?? "all")}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="SUCCESS">SUCCESS</SelectItem>
              <SelectItem value="FAILED">FAILED</SelectItem>
              <SelectItem value="INITIATED">INITIATED</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(filterMethod !== "all" || filterStatus !== "all") && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilterMethod("all");
              setFilterStatus("all");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            Payment History — {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Receipt #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill #</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount (₹)</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Transaction ID</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-10 text-muted-foreground">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filtered.map((payment) => (
                    <tr
                      key={payment.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {payment.receiptNumber}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{payment.flatNo}</td>
                      <td className="px-4 py-3 font-medium">{payment.residentName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{payment.billNumber}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {parseFloat(payment.amount).toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={payment.method} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {payment.razorpayPaymentId ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={payment.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/api/pdf/receipt/${payment.id}`)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Receipt
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            disabled={deletingPayment === payment.id}
                            onClick={() => handleDeletePayment(payment.id, payment.receiptNumber)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {deletingPayment === payment.id ? "..." : "Delete"}
                          </Button>
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

      {/* Cash Payment Dialog */}
      <Dialog open={!!cashBill} onOpenChange={(open) => { if (!open) setCashBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Cash Payment</DialogTitle>
          </DialogHeader>
          {cashBill && (() => {
            const total = parseFloat(cashBill.totalAmount);
            const alreadyPaid = parseFloat(cashBill.paidAmount ?? "0");
            const remaining = total - alreadyPaid;
            const entered = parseFloat(cashAmount) || 0;
            const isPartial = entered > 0 && entered < remaining - 0.005;
            return (
              <div className="space-y-4">
                {/* Bill info */}
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Flat No</span>
                    <span className="font-mono font-medium">{cashBill.flatNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resident</span>
                    <span className="font-medium">{cashBill.residentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bill #</span>
                    <span className="font-mono text-xs">{cashBill.billNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date</span>
                    <span>{formatDate(cashBill.dueDate)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground">Total Bill</span>
                    <span className="font-medium">{formatINR(cashBill.totalAmount)}</span>
                  </div>
                  {alreadyPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Already Paid</span>
                      <span className="text-green-600 font-medium">− {formatINR(cashBill.paidAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Balance Due</span>
                    <span className="text-lg text-foreground">{formatINR(remaining.toFixed(2))}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div className="space-y-1.5">
                  <Label htmlFor="cash-amount">Amount Received (₹)</Label>
                  <Input
                    id="cash-amount"
                    type="number"
                    min={1}
                    max={remaining}
                    step={0.01}
                    value={cashAmount}
                    onChange={e => setCashAmount(e.target.value)}
                    placeholder={`Enter amount (max ₹${remaining.toFixed(2)})`}
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setCashAmount(remaining.toFixed(2))}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Full amount
                    </button>
                    {[25, 50, 75].map(pct => {
                      const v = (remaining * pct / 100).toFixed(2);
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setCashAmount(v)}
                          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Indicator */}
                {entered > 0 && (
                  <div className={`rounded-md px-3 py-2 text-sm ${isPartial ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-green-50 text-green-800 border border-green-200"}`}>
                    {isPartial
                      ? `Partial payment — ₹${(remaining - entered).toFixed(2)} will remain outstanding`
                      : `Full payment — bill will be marked as PAID`}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashBill(null)} disabled={isCashSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleCashPayment}
              disabled={isCashSubmitting || !cashAmount || parseFloat(cashAmount) <= 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Banknote className="h-4 w-4 mr-2" />
              {isCashSubmitting ? "Recording..." : "Confirm Cash Received"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
