"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, FileSpreadsheet } from "lucide-react";

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

export interface MaintenanceBillRow {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  unitArea: number;
  amount: string;
  paidAmount: string;
  interestCharge: string;
  dueDate: string;
  billDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  ratePerSqFt: string;
  status: BillStatus;
}

function StatusBadge({ status }: { status: BillStatus }) {
  const cls: Record<BillStatus, string> = {
    PAID: "bg-green-100 text-green-800",
    OVERDUE: "bg-red-100 text-red-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    PARTIAL: "bg-blue-100 text-blue-800",
  };
  return <Badge className={`${cls[status]} hover:${cls[status]}`}>{status}</Badge>;
}

const fmtINR = (v: string | number) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenanceBillsTable({ initialData, canWrite }: { initialData: MaintenanceBillRow[]; canWrite: boolean }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [bills, setBills] = useState(initialData);
  const [tower, setTower] = useState("all");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [payBill, setPayBill] = useState<MaintenanceBillRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payDate, setPayDate] = useState("");
  const [payRef, setPayRef] = useState("");
  const [paying, setPaying] = useState(false);
  const [detailBill, setDetailBill] = useState<MaintenanceBillRow | null>(null);

  useEffect(() => { fetchBills(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBills = async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (tower !== "all") p.set("tower", tower);
      if (status !== "all") p.set("status", status);
      if (month) p.set("month", month);
      const res = await fetch(`/api/maintenance/bills?${p}`);
      if (!res.ok) { toast.error("Failed to load bills"); return; }
      const data = await res.json();
      setBills(data.map((b: any) => ({
        id: b.id, billNumber: b.billNumber,
        flatNo: b.connection.flatNo, tower: b.connection.tower,
        residentName: b.connection.resident.user.name ?? "—",
        unitArea: b.connection.unitArea,
        amount: b.amount, paidAmount: b.paidAmount, interestCharge: b.interestCharge,
        dueDate: b.dueDate, billDate: b.billDate,
        billingPeriodStart: b.billingPeriodStart, billingPeriodEnd: b.billingPeriodEnd,
        ratePerSqFt: b.ratePerSqFt, status: b.status,
      })));
    } finally { setLoading(false); }
  };

  const handleRecordPayment = async () => {
    if (!payBill) return;
    setPaying(true);
    try {
      const res = await fetch("/api/maintenance/payments/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceBillId: payBill.id,
          amount: payAmount ? parseFloat(payAmount) : undefined,
          method: payMethod,
          referenceId: payRef || null,
          paymentDate: payDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Payment failed"); return; }
      toast.success(`Recorded. Receipt: ${data.receiptNumber}`);
      setPayBill(null); setPayAmount(""); setPayMethod("CASH"); setPayDate(""); setPayRef("");
      await fetchBills();
    } finally { setPaying(false); }
  };

  const totalAmt = bills.reduce((s, b) => s + Number(b.amount) + Number(b.interestCharge), 0);
  const totalCollected = bills.reduce((s, b) => s + Number(b.paidAmount), 0);

  const downloadExcel = async () => {
    const { Workbook } = await import("exceljs");
    const wb = new Workbook();
    wb.creator = "Oasis Venetia Heights";
    wb.created = new Date();

    const ws = wb.addWorksheet("Maintenance Bills");
    ws.columns = [
      { key: "billNumber",  width: 18 },
      { key: "flatNo",      width: 8  },
      { key: "tower",       width: 8  },
      { key: "resident",    width: 22 },
      { key: "area",        width: 10 },
      { key: "rate",        width: 12 },
      { key: "amount",      width: 14 },
      { key: "interest",    width: 12 },
      { key: "paid",        width: 12 },
      { key: "outstanding", width: 14 },
      { key: "dueDate",     width: 14 },
      { key: "status",      width: 10 },
    ];

    // Title row
    const COLS = 12;
    ws.mergeCells(1, 1, 1, COLS);
    const t1 = ws.getCell("A1");
    t1.value = "Oasis Venetia Heights — Maintenance Bills";
    t1.font = { bold: true, size: 13, color: { argb: "FFFFFFFF" } };
    t1.alignment = { horizontal: "center", vertical: "middle" };
    t1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
    ws.getRow(1).height = 24;

    ws.mergeCells(2, 1, 2, COLS);
    const t2 = ws.getCell("A2");
    t2.value = `Month: ${month || "All"}   |   Generated: ${new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`;
    t2.font = { size: 9, italic: true, color: { argb: "FF374151" } };
    t2.alignment = { horizontal: "center", vertical: "middle" };
    t2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF5" } };
    ws.getRow(2).height = 14;

    // Column headers
    const headers = ["Bill No", "Flat", "Tower", "Resident", "Area (sq ft)", "Rate/sq ft", "Maintenance ₹", "Interest ₹", "Paid ₹", "Outstanding ₹", "Due Date", "Status"];
    const hRow = ws.getRow(3);
    headers.forEach((h, i) => {
      const cell = hRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A5F" } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    ws.getRow(3).height = 16;

    // Data rows
    bills.forEach((b, idx) => {
      const outstanding = Number(b.amount) + Number(b.interestCharge) - Number(b.paidAmount);
      const bg = idx % 2 === 0 ? "FFF0F4FA" : "FFFFFFFF";
      const row = ws.getRow(idx + 4);
      const vals = [
        b.billNumber,
        b.flatNo,
        b.tower,
        b.residentName,
        b.unitArea,
        Number(b.ratePerSqFt),
        Number(b.amount),
        Number(b.interestCharge),
        Number(b.paidAmount),
        outstanding > 0 ? outstanding : 0,
        new Date(b.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        b.status,
      ];
      vals.forEach((v, i) => {
        const cell = row.getCell(i + 1);
        cell.value = v as any;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
        cell.font = { size: 9 };
        if ([6, 7, 8, 9].includes(i)) {
          cell.numFmt = "#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      });
      row.getCell(1).font = { size: 9, name: "Courier New" };
      row.height = 15;
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `maintenance-bills-${month || "all"}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Tower</Label>
          <Select value={tower} onValueChange={(val) => setTower(val ?? "all")}>
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
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(val) => setStatus(val ?? "all")}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["all", "PENDING", "PAID", "OVERDUE", "PARTIAL"].map((s) => (
                <SelectItem key={s} value={s}>{s === "all" ? "All" : s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={fetchBills} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
        <Button onClick={downloadExcel} variant="outline" size="sm" className="gap-1">
          <FileSpreadsheet className="h-4 w-4" />
          Download Excel
        </Button>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{bills.length}</strong> bills</span>
        <span>Total Due: <strong>{fmtINR(totalAmt)}</strong></span>
        <span>Collected: <strong className="text-green-700">{fmtINR(totalCollected)}</strong></span>
        <span>Outstanding: <strong className="text-red-600">{fmtINR(totalAmt - totalCollected)}</strong></span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Bill No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Flat / Resident</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Area</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Interest</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Due Amount</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Due Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              {canWrite && <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {bills.map((bill) => (
              <tr key={bill.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button className="font-mono text-xs text-blue-600 hover:underline"
                    onClick={() => setDetailBill(bill)}>
                    {bill.billNumber}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium">{bill.flatNo}</p>
                  <p className="text-xs text-gray-500">{bill.residentName}</p>
                </td>
                <td className="px-4 py-3 text-gray-600">{bill.unitArea} sq ft</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{fmtINR(bill.amount)}</p>
                  {Number(bill.paidAmount) > 0 && (
                    <p className="text-xs text-green-600">Paid: {fmtINR(bill.paidAmount)}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {Number(bill.interestCharge) > 0
                    ? <span className="text-red-600 text-xs">{fmtINR(bill.interestCharge)}</span>
                    : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  {bill.status === "PAID"
                    ? <span className="text-green-600 text-xs font-medium">Nil</span>
                    : (() => {
                        const due = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
                        return due > 0
                          ? <span className="font-semibold text-red-600">{fmtINR(due)}</span>
                          : <span className="text-green-600 text-xs font-medium">Nil</span>;
                      })()
                  }
                </td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(bill.dueDate)}</td>
                <td className="px-4 py-3"><StatusBadge status={bill.status} /></td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="Download PDF"
                        onClick={() => window.open(`/api/maintenance/bills/${bill.id}/pdf`, "_blank")}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </Button>
                      {bill.status !== "PAID" && (
                        <Button size="sm" variant="outline" onClick={() => {
                          setPayBill(bill);
                          const remaining = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
                          setPayAmount(remaining.toFixed(2));
                        }}>
                          Record Payment
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {bills.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                  No maintenance bills found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!payBill} onOpenChange={(open) => !open && setPayBill(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Maintenance Payment</DialogTitle></DialogHeader>
          {payBill && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-md p-3 text-sm space-y-1">
                <p><span className="text-gray-500">Bill:</span> <strong>{payBill.billNumber}</strong></p>
                <p><span className="text-gray-500">Flat:</span> {payBill.flatNo} — {payBill.residentName}</p>
                <p><span className="text-gray-500">Maintenance:</span> {fmtINR(payBill.amount)}</p>
                {Number(payBill.interestCharge) > 0 && (
                  <p><span className="text-gray-500">Interest (24% p.a.):</span> <span className="text-red-600">{fmtINR(payBill.interestCharge)}</span></p>
                )}
                <p><span className="text-gray-500">Outstanding:</span> <strong>
                  {fmtINR(Number(payBill.amount) + Number(payBill.interestCharge) - Number(payBill.paidAmount))}
                </strong></p>
              </div>
              <div className="space-y-1">
                <Label>Amount (₹)</Label>
                <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Method</Label>
                <Select value={payMethod} onValueChange={(val) => setPayMethod(val ?? "CASH")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"].map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Reference / Transaction ID (optional)</Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / cheque no." />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPayBill(null)}>Cancel</Button>
                <Button onClick={handleRecordPayment} disabled={paying}>
                  {paying ? "Recording…" : "Record Payment"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailBill} onOpenChange={(open) => !open && setDetailBill(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bill Details</DialogTitle></DialogHeader>
          {detailBill && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">Bill No</span><span className="font-mono font-medium">{detailBill.billNumber}</span>
              <span className="text-gray-500">Flat</span><span>{detailBill.flatNo} ({detailBill.residentName})</span>
              <span className="text-gray-500">Period</span><span>{fmtDate(detailBill.billingPeriodStart)} – {fmtDate(detailBill.billingPeriodEnd)}</span>
              <span className="text-gray-500">Area</span><span>{detailBill.unitArea} sq ft</span>
              <span className="text-gray-500">Rate</span><span>₹{Number(detailBill.ratePerSqFt).toFixed(2)}/sq ft</span>
              <span className="text-gray-500">Maintenance</span><span className="font-bold">{fmtINR(detailBill.amount)}</span>
              <span className="text-gray-500">Interest</span><span className={Number(detailBill.interestCharge) > 0 ? "text-red-600" : ""}>{fmtINR(detailBill.interestCharge)}</span>
              <span className="text-gray-500">Paid</span><span className="text-green-700">{fmtINR(detailBill.paidAmount)}</span>
              <span className="text-gray-500">Due Date</span><span>{fmtDate(detailBill.dueDate)}</span>
              <span className="text-gray-500">Status</span><span><StatusBadge status={detailBill.status} /></span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
