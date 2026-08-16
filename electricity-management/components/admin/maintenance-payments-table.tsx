"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";

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
}

const fmtINR = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenancePaymentsTable({ initialData, canDelete = false }: { initialData: MaintenancePaymentRow[]; canDelete?: boolean }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [payments, setPayments] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [month, setMonth] = useState(currentMonth);
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

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
      setPayments(data.map((p: any) => ({
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
      })));
    } finally { setLoading(false); }
  };

  const q = search.trim().toLowerCase();
  const filteredPayments = q
    ? payments.filter((p) =>
        p.flatNo.toLowerCase().includes(q) || p.residentName.toLowerCase().includes(q)
      )
    : payments;

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
          <Label className="text-xs">Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
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
        <Button onClick={fetchPayments} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{filteredPayments.length}</strong>{q ? ` of ${payments.length}` : ""} payments</span>
        <span>Total Collected: <strong className="text-green-700">{fmtINR(total)}</strong></span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Receipt No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flat / Resident</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Bill No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Method</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Reference</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
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
                <td className="px-4 py-3 font-medium text-green-700">{fmtINR(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{p.method}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.referenceId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(p.paymentDate)}</td>
                <td className="px-4 py-3">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs">{p.status}</Badge>
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
                <td colSpan={canDelete ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
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
