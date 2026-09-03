"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthSelect, monthRange, monthKeyOf } from "@/components/ui/month-select";
import { Trash2, FileDown, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export interface MaintenancePaymentRow {
  id: string;
  receiptNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  billNumber: string;
  amount: string;
  method: string;
  referenceId: string | null;
  paymentDate: string;
  status: string;
  billStatus: string;
  billAmount: string;
  billPaidAmount: string;
  billDue: string;
}

const fmtINR = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash", UPI: "UPI", NEFT: "NEFT", RTGS: "RTGS",
  CHEQUE: "Cheque", CREDIT_CARD: "Credit Card", ADJUSTMENT: "Adjustment",
};
const fmtMethod = (m: string) => METHOD_LABELS[m] ?? m;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function BillStatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">PAID</Badge>;
  if (status === "PARTIAL")
    return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 text-xs">PARTIAL</Badge>;
  if (status === "OVERDUE")
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-xs">OVERDUE</Badge>;
  return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 text-xs">PENDING</Badge>;
}

export default function MaintenancePaymentsTable({ initialData, canDelete = false }: { initialData: MaintenancePaymentRow[]; canDelete?: boolean }) {
  // Bills are raised for the month just ended, so payments land against last
  // month's bills — open on that month, not the current one.
  const previousMonth = monthKeyOf(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1));
  const [payments, setPayments] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [month, setMonth] = useState(previousMonth);
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline ml-1 h-3 w-3" /> : <ArrowDown className="inline ml-1 h-3 w-3" />;
  }
  function sortPayments(rows: MaintenancePaymentRow[]) {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (sortKey) {
        case "receiptNumber": aVal = a.receiptNumber; bVal = b.receiptNumber; break;
        case "flatNo": aVal = a.flatNo; bVal = b.flatNo; break;
        case "residentName": aVal = a.residentName.toLowerCase(); bVal = b.residentName.toLowerCase(); break;
        case "billNumber": aVal = a.billNumber; bVal = b.billNumber; break;
        case "billStatus": aVal = a.billStatus; bVal = b.billStatus; break;
        case "billAmount": aVal = Number(a.billAmount); bVal = Number(b.billAmount); break;
        case "amount": aVal = Number(a.amount); bVal = Number(b.amount); break;
        case "billDue": aVal = Number(a.billDue); bVal = Number(b.billDue); break;
        case "method": aVal = a.method; bVal = b.method; break;
        case "paymentDate": aVal = a.paymentDate; bVal = b.paymentDate; break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (tower !== "all") p.set("tower", tower);
      if (month) p.set("month", month);
      if (method !== "all") p.set("method", method);
      const res = await fetch(`/api/maintenance/payments?${p}`);
      if (!res.ok) { toast.error("Failed to load payments"); return; }
      const data = await res.json();
      setPayments(data.map((p: any) => {
        const billAmount = Math.round(Number(p.bill?.amount ?? 0));
        const prevDue = Math.round(Number(p.bill?.previousDue ?? 0));
        const interest = Math.round(Number(p.bill?.interestCharge ?? 0));
        const grandTotal = billAmount + prevDue + interest;
        const billPaid = Math.round(Number(p.bill?.paidAmount ?? 0));
        const billDue = Math.max(0, grandTotal - billPaid);
        const effectiveStatus = billDue === 0 ? "PAID" : billPaid > 0 ? "PARTIAL" : "PENDING";
        return {
          id: p.id,
          receiptNumber: p.receiptNumber,
          flatNo: p.bill?.connection?.flatNo ?? "—",
          tower: p.bill?.connection?.tower ?? "—",
          residentName: p.bill?.connection?.resident?.user?.name ?? "—",
          billNumber: p.bill?.billNumber ?? "—",
          amount: p.amount,
          method: p.method,
          referenceId: p.razorpayPaymentId && p.razorpayPaymentId !== "CASH" ? p.razorpayPaymentId : null,
          paymentDate: p.paymentDate,
          status: p.status,
          billStatus: effectiveStatus,
          billAmount: grandTotal.toString(),
          billPaidAmount: billPaid.toString(),
          billDue: billDue.toString(),
        };
      }));
    } finally { setLoading(false); }
  };

  // Server-side filters apply on change — no Apply button. Search is
  // client-side, so it stays instant and does not refetch. The first run is
  // skipped because the page already server-rendered the current month.
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    fetchPayments();
  }, [tower, month, method]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = search.trim().toLowerCase();
  const filteredPayments = sortPayments(
    q ? payments.filter((p) => p.flatNo.toLowerCase().includes(q) || p.residentName.toLowerCase().includes(q)) : payments
  );

  const total = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);

  const handleDelete = async (p: MaintenancePaymentRow) => {
    if (!confirm(`Delete payment ${p.receiptNumber} of ${fmtINR(p.amount)}? This will revert the bill status.`)) return;
    try {
      const res = await fetch(`/api/maintenance/payments/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to delete"); return; }
      toast.success(`Payment ${p.receiptNumber} deleted`);
      setPayments((prev) => prev.filter((x) => x.id !== p.id));
    } catch { toast.error("Network error"); }
  };

  const colSpan = canDelete ? 12 : 11;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tower</Label>
          <Select value={tower} onValueChange={(v) => setTower(v ?? "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "A", "B", "C", "V"].map((t) => (
                <SelectItem key={t} value={t}>{t === "all" ? "All Towers" : `Tower ${t}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bill Month</Label>
          <MonthSelect
            value={month || "all"}
            onChange={(val) => setMonth(val === "all" ? "" : val)}
            options={monthRange({ back: 24, forward: 1 })}
            allowAll
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v ?? "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "CASH", "UPI", "NEFT", "RTGS", "CHEQUE", "CREDIT_CARD"].map((m) => (
                <SelectItem key={m} value={m}>{m === "all" ? "All" : m === "CREDIT_CARD" ? "Credit Card" : m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Flat or resident…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
        </div>
        {loading && <span className="text-xs text-muted-foreground pb-2">Loading…</span>}
      </div>

      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{filteredPayments.length}</strong>{q ? ` of ${payments.length}` : ""} payments</span>
        <span>Total Collected: <strong className="text-green-700">{fmtINR(total)}</strong></span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {[
                ["receiptNumber", "Receipt No"],
                ["flatNo", "Flat / Resident"],
                ["billNumber", "Bill No"],
                ["billStatus", "Bill Status"],
                ["billAmount", "Bill Total"],
                ["amount", "Paid Amount"],
                ["billDue", "Outstanding"],
                ["method", "Method"],
                [null, "Reference"],
                ["paymentDate", "Date"],
                [null, "Receipt"],
              ].map(([key, label]) => (
                <th key={label as string} className="px-4 py-3 text-left font-medium text-gray-600">
                  {key ? (
                    <button onClick={() => handleSort(key as string)} className="flex items-center gap-0 hover:text-gray-900 whitespace-nowrap">
                      {label}<SortIcon col={key as string} />
                    </button>
                  ) : label}
                </th>
              ))}
              {canDelete && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-blue-600">{p.receiptNumber}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{p.flatNo}</p>
                  <p className="text-xs text-gray-500">{p.residentName}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{p.billNumber}</td>
                <td className="px-4 py-3"><BillStatusBadge status={p.billStatus} /></td>
                <td className="px-4 py-3 font-medium">{fmtINR(p.billAmount)}</td>
                <td className="px-4 py-3 font-medium text-green-700">{fmtINR(p.amount)}</td>
                <td className="px-4 py-3">
                  {Number(p.billDue) > 0
                    ? <span className="font-medium text-red-600">{fmtINR(p.billDue)}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{fmtMethod(p.method)}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.referenceId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(p.paymentDate)}</td>
                <td className="px-4 py-3">
                  {p.method === "ADJUSTMENT" ? (
                    // A rebate / waiver is not money received - no receipt is issued for it.
                    // It appears as a deduction on the receipt of the payment it went with.
                    <span className="text-xs text-gray-400" title="No receipt is issued for a rebate / waiver">
                      &mdash;
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      title="Download Receipt"
                      onClick={() => window.open(`/api/maintenance/payments/${p.id}/receipt`, "_blank")}
                    >
                      <FileDown className="h-3.5 w-3.5 mr-1" />
                      Receipt
                    </Button>
                  )}
                </td>
                {canDelete && (
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      title="Delete Payment"
                      onClick={() => handleDelete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center text-gray-400">
                  {q ? `No payments match "${search}"` : "No payments found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
