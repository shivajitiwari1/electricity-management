"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

export default function MaintenancePaymentsTable({ initialData }: { initialData: MaintenancePaymentRow[] }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [payments, setPayments] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [month, setMonth] = useState(currentMonth);
  const [method, setMethod] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchPayments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const total = payments.reduce((s, p) => s + Number(p.amount), 0);

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
              {["all", "CASH", "UPI", "NEFT", "RTGS", "CHEQUE"].map((m) => (
                <SelectItem key={m} value={m}>{m === "all" ? "All" : m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchPayments} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{payments.length}</strong> payments</span>
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
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
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
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">No payments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
