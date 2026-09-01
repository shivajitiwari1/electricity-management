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
import { Download, Banknote, AlertTriangle, Trash2, CreditCard, Wifi, UserCheck, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

type SerializedPayment = {
  id: string;
  receiptNumber: string;
  flatNo: string;
  residentName: string;
  email: string;
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
  email: string;
  totalAmount: string;
  paidAmount: string;
  dueDate: string;
  status: string;
};

interface Props {
  initialData: SerializedPayment[];
  pendingBills: PendingBill[];
  canWrite: boolean;
  canDelete: boolean;
}

const MANUAL_METHODS = new Set(["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CREDIT_CARD"]);

const METHOD_STYLES: Record<string, string> = {
  ONLINE:      "bg-blue-100 text-blue-800",
  CASH:        "bg-gray-100 text-gray-700",
  UPI:         "bg-purple-100 text-purple-800",
  NEFT:        "bg-teal-100 text-teal-800",
  RTGS:        "bg-cyan-100 text-cyan-800",
  CHEQUE:      "bg-orange-100 text-orange-800",
  CREDIT_CARD: "bg-pink-100 text-pink-800",
};

function TypeBadge({ method }: { method: string }) {
  if (method === "ONLINE") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5">
        <Wifi className="h-3 w-3" /> Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
      <UserCheck className="h-3 w-3" /> Manual
    </span>
  );
}

const METHOD_LABELS: Record<string, string> = {
  ONLINE: "Online", CASH: "Cash", UPI: "UPI", NEFT: "NEFT",
  RTGS: "RTGS", CHEQUE: "Cheque", CREDIT_CARD: "Credit Card", ADJUSTMENT: "Adjustment",
};
const fmtMethod = (m: string) => METHOD_LABELS[m] ?? m;

function MethodBadge({ method }: { method: string }) {
  const cls = METHOD_STYLES[method] ?? "bg-gray-100 text-gray-700";
  return <Badge className={`${cls} hover:${cls}`}>{fmtMethod(method)}</Badge>;
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

function BillStatusBadge({ status, dueDate }: { status: string; dueDate?: string }) {
  const display = (status === "PENDING" && dueDate && new Date(dueDate) < new Date()) ? "OVERDUE" : status;
  if (display === "CARRIED_FORWARD") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">CARRIED FORWARD</Badge>;
  if (display === "OVERDUE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">OVERDUE</Badge>;
  if (display === "PARTIAL") return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">PARTIAL</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">PENDING</Badge>;
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

export default function PaymentsTable({ initialData, pendingBills, canWrite, canDelete }: Props) {
  const router = useRouter();
  const [filterMethod, setFilterMethod] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterName, setFilterName] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [deletingPayment, setDeletingPayment] = useState<string | null>(null);

  // Sorting for pending bills table
  const [pendingSortKey, setPendingSortKey] = useState<string>("");
  const [pendingSortDir, setPendingSortDir] = useState<"asc" | "desc">("asc");
  function handlePendingSort(key: string) {
    if (pendingSortKey === key) setPendingSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setPendingSortKey(key); setPendingSortDir("asc"); }
  }
  function PendingSortIcon({ col }: { col: string }) {
    if (pendingSortKey !== col) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
    return pendingSortDir === "asc" ? <ArrowUp className="inline ml-1 h-3 w-3" /> : <ArrowDown className="inline ml-1 h-3 w-3" />;
  }

  // Sorting for payment history table
  const [historySortKey, setHistorySortKey] = useState<string>("");
  const [historySortDir, setHistorySortDir] = useState<"asc" | "desc">("asc");
  function handleHistorySort(key: string) {
    if (historySortKey === key) setHistorySortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setHistorySortKey(key); setHistorySortDir("asc"); }
  }
  function HistorySortIcon({ col }: { col: string }) {
    if (historySortKey !== col) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
    return historySortDir === "asc" ? <ArrowUp className="inline ml-1 h-3 w-3" /> : <ArrowDown className="inline ml-1 h-3 w-3" />;
  }

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

  // Manual payment dialog
  const [cashBill, setCashBill] = useState<PendingBill | null>(null);
  const [cashAmount, setCashAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [referenceId, setReferenceId] = useState("");
  const [payDate, setPayDate] = useState("");
  const [isCashSubmitting, setIsCashSubmitting] = useState(false);


  const filteredPending = useMemo(() => {
    const q = pendingSearch.trim().toLowerCase();
    const base = q
      ? pendingBills.filter(
          (b) =>
            b.residentName.toLowerCase().includes(q) ||
            b.flatNo.toLowerCase().includes(q) ||
            b.email.toLowerCase().includes(q) ||
            b.billNumber.toLowerCase().includes(q)
        )
      : pendingBills;
    if (!pendingSortKey) return base;
    return [...base].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (pendingSortKey) {
        case "billNumber": aVal = a.billNumber; bVal = b.billNumber; break;
        case "flatNo": aVal = a.flatNo; bVal = b.flatNo; break;
        case "residentName": aVal = a.residentName.toLowerCase(); bVal = b.residentName.toLowerCase(); break;
        case "balanceDue": aVal = parseFloat(a.totalAmount) - parseFloat(a.paidAmount ?? "0"); bVal = parseFloat(b.totalAmount) - parseFloat(b.paidAmount ?? "0"); break;
        case "dueDate": aVal = a.dueDate; bVal = b.dueDate; break;
        case "status": aVal = a.status; bVal = b.status; break;
      }
      if (aVal < bVal) return pendingSortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return pendingSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [pendingBills, pendingSearch, pendingSortKey, pendingSortDir]);

  const filtered = useMemo(() => {
    const q = filterName.trim().toLowerCase();
    const base = initialData.filter((p) => {
      if (filterMethod === "MANUAL") {
        if (!MANUAL_METHODS.has(p.method)) return false;
      } else if (filterMethod !== "all" && p.method !== filterMethod) {
        return false;
      }
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (q && !p.residentName.toLowerCase().includes(q) && !p.flatNo.toLowerCase().includes(q) && !p.email.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!historySortKey) return base;
    return [...base].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (historySortKey) {
        case "receiptNumber": aVal = a.receiptNumber; bVal = b.receiptNumber; break;
        case "flatNo": aVal = a.flatNo; bVal = b.flatNo; break;
        case "residentName": aVal = a.residentName.toLowerCase(); bVal = b.residentName.toLowerCase(); break;
        case "billNumber": aVal = a.billNumber; bVal = b.billNumber; break;
        case "amount": aVal = parseFloat(a.amount); bVal = parseFloat(b.amount); break;
        case "paymentDate": aVal = a.paymentDate; bVal = b.paymentDate; break;
        case "method": aVal = a.method; bVal = b.method; break;
        case "status": aVal = a.status; bVal = b.status; break;
      }
      if (aVal < bVal) return historySortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return historySortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [initialData, filterMethod, filterStatus, filterName, historySortKey, historySortDir]);


  function openCashDialog(bill: PendingBill) {
    const remaining = parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount ?? "0");
    setCashAmount(remaining.toFixed(2));
    setPayMethod("CASH");
    setReferenceId("");
    setPayDate(new Date().toISOString().split("T")[0]);
    setCashBill(bill);
  }

  async function handleCashPayment() {
    if (!cashBill) return;
    const amount = parseFloat(cashAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (payMethod !== "CASH" && !referenceId.trim()) {
      toast.error("Enter a transaction / UTR reference number");
      return;
    }
    setIsCashSubmitting(true);
    try {
      const res = await fetch("/api/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billId: cashBill.id,
          amount,
          method: payMethod,
          referenceId: referenceId.trim() || null,
          paymentDate: payDate || null,
        }),
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

  const overdueCount = pendingBills.filter((b) => b.status === "OVERDUE" || (b.status === "PENDING" && new Date(b.dueDate) < new Date())).length;

  return (
    <>
      {/* Pending Bills Requiring Payment */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
            {overdueCount > 0 && (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            Bills Requiring Payment
            <span className="ml-auto flex items-center gap-3">
              <Input
                placeholder="Search name, flat, email…"
                value={pendingSearch}
                onChange={(e) => setPendingSearch(e.target.value)}
                className="w-52 h-8 text-sm font-normal"
              />
              <span className="text-sm font-normal text-muted-foreground whitespace-nowrap">
                {filteredPending.length !== pendingBills.length
                  ? `${filteredPending.length} of ${pendingBills.length} pending`
                  : `${pendingBills.length} pending`}
                {overdueCount > 0 && (
                  <span className="text-red-600 font-medium ml-1">
                    ({overdueCount} overdue)
                  </span>
                )}
              </span>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {([["billNumber","Bill #"],["flatNo","Flat No"],["residentName","Resident"],[null,"Email"],["balanceDue","Balance Due"],["dueDate","Due Date"],["status","Status"],[null,"Actions"]] as [string|null,string][]).map(([key,label]) => (
                    <th key={label} className={`px-4 py-3 font-medium text-muted-foreground ${key === "balanceDue" ? "text-right" : "text-left"}`}>
                      {key ? <button onClick={() => handlePendingSort(key)} className="flex items-center gap-0 hover:text-foreground whitespace-nowrap">{label}<PendingSortIcon col={key} /></button> : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPending.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">
                      {pendingBills.length === 0 ? "No pending bills — all caught up!" : "No bills match your search."}
                    </td>
                  </tr>
                ) : (
                  filteredPending.map((bill) => (
                    <tr
                      key={bill.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${(bill.status === "OVERDUE" || (bill.status === "PENDING" && new Date(bill.dueDate) < new Date())) ? "bg-red-50/40" : bill.status === "PARTIAL" ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium">{bill.flatNo}</td>
                      <td className="px-4 py-3">{bill.residentName}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{bill.email || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatINR((parseFloat(bill.totalAmount) - parseFloat(bill.paidAmount ?? "0")).toFixed(2))}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{formatDate(bill.dueDate)}</td>
                      <td className="px-4 py-3">
                        <BillStatusBadge status={bill.status} dueDate={bill.dueDate} />
                      </td>
                      <td className="px-4 py-3">
                        {canWrite && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCashDialog(bill)}
                          >
                            <CreditCard className="h-3 w-3 mr-1" />
                            Record Payment
                          </Button>
                        )}
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
              <SelectItem value="ONLINE">🌐 Online</SelectItem>
              <SelectItem value="MANUAL">✋ Manual (All)</SelectItem>
              <SelectItem value="CASH">— Cash</SelectItem>
              <SelectItem value="UPI">— UPI</SelectItem>
              <SelectItem value="NEFT">— NEFT</SelectItem>
              <SelectItem value="RTGS">— RTGS</SelectItem>
              <SelectItem value="CHEQUE">— Cheque</SelectItem>
              <SelectItem value="CREDIT_CARD">— Credit Card</SelectItem>
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

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Search</span>
          <Input
            placeholder="Name, flat or email…"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="w-48"
          />
        </div>

        {(filterMethod !== "all" || filterStatus !== "all" || filterName) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFilterMethod("all");
              setFilterStatus("all");
              setFilterName("");
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold flex items-center gap-3">
            {filtered.length > 0
              ? `Payment History — ${filtered.length} record${filtered.length !== 1 ? "s" : ""}`
              : "Payment History — 0 records"}
            {filtered.length > 0 && (
              <span className="flex gap-2 text-xs font-normal">
                <span className="inline-flex items-center gap-1 text-blue-700"><Wifi className="h-3 w-3" />{filtered.filter(p => p.method === "ONLINE").length} online</span>
                <span className="inline-flex items-center gap-1 text-amber-700"><UserCheck className="h-3 w-3" />{filtered.filter(p => MANUAL_METHODS.has(p.method)).length} manual</span>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {([["receiptNumber","Receipt #"],["flatNo","Flat No"],["residentName","Resident"],["billNumber","Bill #"],["amount","Amount (₹)"],["paymentDate","Date"],[null,"Type"],["method","Method"],[null,"Reference / Txn ID"],["status","Status"],[null,"Actions"]] as [string|null,string][]).map(([key,label]) => (
                    <th key={label} className={`px-4 py-3 font-medium text-muted-foreground ${key === "amount" ? "text-right" : "text-left"}`}>
                      {key ? <button onClick={() => handleHistorySort(key)} className="flex items-center gap-0 hover:text-foreground whitespace-nowrap">{label}<HistorySortIcon col={key} /></button> : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-muted-foreground">
                      No payments found
                    </td>
                  </tr>
                ) : (
                  filtered.map((payment) => (
                    <tr
                      key={payment.id}
                      className={`border-b last:border-0 hover:bg-muted/50 ${MANUAL_METHODS.has(payment.method) ? "bg-amber-50/20" : ""}`}
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
                        <TypeBadge method={payment.method} />
                      </td>
                      <td className="px-4 py-3">
                        <MethodBadge method={payment.method} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {payment.razorpayPaymentId && payment.razorpayPaymentId !== "CASH"
                          ? payment.razorpayPaymentId
                          : "—"}
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
                          {canDelete && (
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

      {/* Manual Payment Dialog */}
      <Dialog open={!!cashBill} onOpenChange={(open) => { if (!open) setCashBill(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {cashBill && (() => {
            const total = parseFloat(cashBill.totalAmount);
            const alreadyPaid = parseFloat(cashBill.paidAmount ?? "0");
            const remaining = total - alreadyPaid;
            const entered = parseFloat(cashAmount) || 0;
            const isPartial = entered > 0 && entered < remaining - 0.005;
            return (
              <div className="space-y-4">
                {/* Bill summary */}
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

                {/* Payment Method */}
                <div className="space-y-1.5">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CREDIT_CARD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          payMethod === m
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:bg-muted"
                        }`}
                      >
                        {m === "CREDIT_CARD" ? "Credit Card" : m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Transaction Reference (required for non-cash) */}
                {payMethod !== "CASH" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ref-id">
                      {payMethod === "CHEQUE" ? "Cheque Number" : payMethod === "CREDIT_CARD" ? "Card / Transaction Reference" : "UTR / Transaction Reference"}
                      <span className="text-red-500 ml-0.5">*</span>
                    </Label>
                    <Input
                      id="ref-id"
                      value={referenceId}
                      onChange={e => setReferenceId(e.target.value)}
                      placeholder={payMethod === "CHEQUE" ? "e.g. 123456" : payMethod === "CREDIT_CARD" ? "e.g. TXN123456" : "e.g. UTR123456789"}
                    />
                  </div>
                )}

                {/* Payment Date */}
                <div className="space-y-1.5">
                  <Label htmlFor="pay-date">Payment Date</Label>
                  <Input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    max={new Date().toISOString().split("T")[0]}
                    onChange={e => setPayDate(e.target.value)}
                  />
                </div>

                {/* Amount */}
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
                    placeholder={`Max ₹${remaining.toFixed(2)}`}
                  />
                  <div className="flex gap-2 mt-1">
                    <button type="button" onClick={() => setCashAmount(remaining.toFixed(2))} className="text-xs text-blue-600 hover:underline">Full amount</button>
                    {[25, 50, 75].map(pct => (
                      <button key={pct} type="button" onClick={() => setCashAmount((remaining * pct / 100).toFixed(2))} className="text-xs text-muted-foreground hover:text-foreground hover:underline">{pct}%</button>
                    ))}
                  </div>
                </div>

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
              {isCashSubmitting ? "Recording..." : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
