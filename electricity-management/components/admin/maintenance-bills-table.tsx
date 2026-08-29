"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileDown, FileSpreadsheet, Receipt, ChevronsUpDown, FilePlus2, Users, Trash2, Mail, ArrowUp, ArrowDown, ArrowUpDown, FileWarning } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

export interface MaintenanceBillRow {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  unitArea: number;
  amount: string;
  previousDue: string;
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
  `₹${Math.round(Number(v)).toLocaleString("en-IN")}`;

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function MaintenanceBillsTable({ initialData, canWrite, canDelete }: { initialData: MaintenanceBillRow[]; canWrite: boolean; canDelete: boolean }) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [bills, setBills] = useState(initialData);
  const [search, setSearch] = useState("");
  const [tower, setTower] = useState("all");
  const [status, setStatus] = useState("all");
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [payBill, setPayBill] = useState<MaintenanceBillRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payDate, setPayDate] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payRebate, setPayRebate] = useState("");
  const [paying, setPaying] = useState(false);
  const [detailBill, setDetailBill] = useState<MaintenanceBillRow | null>(null);
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
  function sortBills(rows: MaintenanceBillRow[]) {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (sortKey) {
        case "billNumber": aVal = a.billNumber; bVal = b.billNumber; break;
        case "flatNo": aVal = a.flatNo; bVal = b.flatNo; break;
        case "residentName": aVal = a.residentName.toLowerCase(); bVal = b.residentName.toLowerCase(); break;
        case "amount": aVal = Number(a.amount); bVal = Number(b.amount); break;
        case "paidAmount": aVal = Number(a.paidAmount); bVal = Number(b.paidAmount); break;
        case "dueAmount": aVal = Number(a.amount) + Number(a.interestCharge) - Number(a.paidAmount); bVal = Number(b.amount) + Number(b.interestCharge) - Number(b.paidAmount); break;
        case "dueDate": aVal = a.dueDate; bVal = b.dueDate; break;
        case "status": aVal = a.status; bVal = b.status; break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  // Generate Bills state
  const [genOpen, setGenOpen] = useState(false);
  const [genMode, setGenMode] = useState<"all" | "individual">("individual");
  const [genMonth, setGenMonth] = useState(currentMonth);
  const [genConnId, setGenConnId] = useState("");
  const [genConnOpen, setGenConnOpen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [genPreviousDue, setGenPreviousDue] = useState("");

  // Advance Payment state
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advConnections, setAdvConnections] = useState<{ id: string; flatNo: string; tower: string; unitArea: number; ratePerSqFt: number; residentName: string }[]>([]);
  const [advConnOpen, setAdvConnOpen] = useState(false);
  const [advConnId, setAdvConnId] = useState("");
  const [advMonths, setAdvMonths] = useState<6 | 12>(6);
  const [advStart, setAdvStart] = useState(() => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    return next.toISOString().slice(0, 7);
  });
  const [advAmount, setAdvAmount] = useState("");
  const [advCgstRate, setAdvCgstRate] = useState(0);
  const [advSgstRate, setAdvSgstRate] = useState(0);
  const [advMethod, setAdvMethod] = useState("CASH");
  const [advDate, setAdvDate] = useState(new Date().toISOString().slice(0, 10));
  const [advRef, setAdvRef] = useState("");
  const [advRebate, setAdvRebate] = useState("");
  const [advSubmitting, setAdvSubmitting] = useState(false);

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
        amount: b.amount, previousDue: b.previousDue ?? "0", paidAmount: b.paidAmount, interestCharge: b.interestCharge,
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
          rebateAmount: payRebate ? parseFloat(payRebate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Payment failed"); return; }
      toast.success(`Recorded. Receipt: ${data.receiptNumber}`);
      setPayBill(null); setPayAmount(""); setPayMethod("CASH"); setPayDate(""); setPayRef(""); setPayRebate("");
      await fetchBills();
    } finally { setPaying(false); }
  };

  const handleSendEmail = async (bill: MaintenanceBillRow) => {
    try {
      const res = await fetch(`/api/maintenance/bills/${bill.id}/email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to send email"); return; }
      toast.success(`Email sent to ${data.to ?? bill.flatNo}`);
    } catch { toast.error("Network error"); }
  };

  const handleDeleteBill = async (bill: MaintenanceBillRow) => {
    const hasPaid = Number(bill.paidAmount) > 0;
    const msg = hasPaid
      ? `Delete bill ${bill.billNumber} for ${bill.flatNo}?\n\nThis will also delete all payments recorded against this bill. This cannot be undone.`
      : `Delete bill ${bill.billNumber} for ${bill.flatNo}? This cannot be undone.`;
    if (!confirm(msg)) return;
    try {
      const res = await fetch(`/api/maintenance/bills/${bill.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to delete bill"); return; }
      toast.success(`Bill ${bill.billNumber} deleted${data.paymentsDeleted > 0 ? ` (${data.paymentsDeleted} payment(s) also removed)` : ""}`);
      await fetchBills();
    } catch { toast.error("Network error"); }
  };

  const q = search.trim().toLowerCase();
  const filteredBills = sortBills(
    q ? bills.filter((b) => b.flatNo.toLowerCase().includes(q) || b.residentName.toLowerCase().includes(q)) : bills
  );

  const totalAmt = filteredBills.reduce((s, b) => s + Number(b.amount) + Number(b.interestCharge) + Number(b.previousDue), 0);
  const totalCollected = filteredBills.reduce((s, b) => s + Number(b.paidAmount), 0);

  // Shared connection loader (used by both Advance Pay and Generate Bills)
  const loadConnections = async () => {
    if (advConnections.length > 0) return;
    try {
      const [connRes, rateRes, gstRes] = await Promise.all([
        fetch("/api/connections?status=ACTIVE"),
        fetch("/api/maintenance/rates"),
        fetch("/api/maintenance/gst-config"),
      ]);
      const conns = connRes.ok ? await connRes.json() : [];
      const rates = rateRes.ok ? await rateRes.json() : [];
      const gst = gstRes.ok ? await gstRes.json() : { cgstRate: 0, sgstRate: 0 };
      setAdvCgstRate(Number(gst.cgstRate ?? 0));
      setAdvSgstRate(Number(gst.sgstRate ?? 0));
      const currentRate = rates[0]?.ratePerSqFt ?? 0;
      setAdvConnections(
        conns.map((c: { id: string; flatNo: string; tower: string; unitArea: number; resident?: { user?: { name?: string } } }) => ({
          id: c.id,
          flatNo: c.flatNo,
          tower: c.tower,
          unitArea: Number(c.unitArea),
          ratePerSqFt: Number(currentRate),
          residentName: c.resident?.user?.name ?? "—",
        }))
      );
    } catch {
      toast.error("Failed to load connections");
    }
  };

  // Advance Payment helpers
  const openAdvanceDialog = async () => {
    setAdvanceOpen(true);
    await loadConnections();
  };

  // Generate Bills helpers
  const openGenDialog = async () => {
    setGenMode("individual");
    setGenMonth(currentMonth);
    setGenConnId("");
    setGenPreviousDue("");
    setGenOpen(true);
    await loadConnections();
  };

  const handleGenerateBills = async () => {
    setGenLoading(true);
    try {
      if (genMode === "all") {
        const res = await fetch(`/api/cron/generate-maintenance-bills?month=${genMonth}`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error ?? "Failed to generate bills"); return; }
        toast.success(`Generated ${data.created} bill(s). ${data.skipped} skipped (already existed).`);
        setGenOpen(false);
        await fetchBills();
      } else {
        if (!genConnId) { toast.error("Select a flat first"); return; }
        const res = await fetch("/api/maintenance/bills/generate-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: genConnId,
            month: genMonth,
            previousDue: genPreviousDue ? parseFloat(genPreviousDue) : 0,
          }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error ?? "Failed to generate bill"); return; }
        if (data.skipped) {
          toast.info(`Bill ${data.billNumber} already exists for this month.`);
        } else {
          toast.success(`Bill ${data.billNumber} generated successfully.`);
          setGenOpen(false);
          await fetchBills();
        }
      }
    } finally {
      setGenLoading(false);
    }
  };

  const advBase = Math.round(parseFloat(advAmount) || 0);
  const advCgst = Math.round(advBase * advCgstRate / 100);
  const advSgst = Math.round(advBase * advSgstRate / 100);
  const advMonthlyWithGst = advBase + advCgst + advSgst;
  const advTotal = advMonthlyWithGst > 0 ? String(Math.round(advMonthlyWithGst * advMonths)) : "0";

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!advConnId) return;
    const conn = advConnections.find((c) => c.id === advConnId);
    if (conn) setAdvAmount(String(Math.round(conn.unitArea * conn.ratePerSqFt)));
  }, [advConnId, advConnections]);

  const handleAdvancePayment = async () => {
    if (!advConnId || !advAmount) {
      toast.error("Select a flat and enter amount");
      return;
    }
    setAdvSubmitting(true);
    try {
      const res = await fetch("/api/maintenance/bills/advance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: advConnId,
          months: advMonths,
          startMonth: advStart,
          amountPerMonth: parseFloat(advAmount),
          method: advMethod,
          paymentDate: advDate,
          referenceId: advRef || null,
          rebateAmount: advRebate ? parseFloat(advRebate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed");
        return;
      }
      toast.success(
        `${data.generated} bill(s) generated and marked paid.${
          data.skipped > 0 ? ` ${data.skipped} month(s) skipped (already existed).` : ""
        }`
      );
      setAdvanceOpen(false);
      setAdvRebate("");
      await fetchBills();
    } finally {
      setAdvSubmitting(false);
    }
  };

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
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Flat or resident…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
        </div>
        <Button onClick={fetchBills} disabled={loading} variant="outline">
          {loading ? "Loading…" : "Apply Filter"}
        </Button>
        <Button onClick={downloadExcel} variant="outline" size="sm" className="gap-1">
          <FileSpreadsheet className="h-4 w-4" />
          Download Excel
        </Button>
        {canWrite && (
          <div className="ml-auto flex gap-2">
            <Button onClick={openGenDialog} variant="outline" size="sm" className="gap-1">
              <FilePlus2 className="h-4 w-4" />
              Generate Bills
            </Button>
            <Button onClick={openAdvanceDialog} variant="outline" size="sm" className="gap-1">
              <Receipt className="h-4 w-4" />
              Advance Pay
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span><strong>{filteredBills.length}</strong>{q ? ` of ${bills.length}` : ""} bills</span>
        <span>Total Due: <strong>{fmtINR(totalAmt)}</strong></span>
        <span>Collected: <strong className="text-green-700">{fmtINR(totalCollected)}</strong></span>
        <span>Outstanding: <strong className="text-red-600">{fmtINR(totalAmt - totalCollected)}</strong></span>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {[
                ["billNumber", "Bill No"],
                ["flatNo", "Flat / Resident"],
                [null, "Area"],
                ["amount", "Amount"],
                [null, "Interest"],
                ["dueAmount", "Due Amount"],
                ["dueDate", "Due Date"],
                ["status", "Status"],
              ].map(([key, label]) => (
                <th key={label as string} className="px-4 py-3 text-left font-medium text-gray-600">
                  {key ? (
                    <button onClick={() => handleSort(key as string)} className="flex items-center gap-0 hover:text-gray-900 whitespace-nowrap">
                      {label}<SortIcon col={key as string} />
                    </button>
                  ) : label}
                </th>
              ))}
              {canWrite && <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {filteredBills.map((bill) => (
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                        title="Send Email"
                        onClick={() => handleSendEmail(bill)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      {bill.status !== "PAID" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                          title="Download Demand Letter"
                          onClick={() => window.open(`/api/maintenance/bills/${bill.id}/demand-letter`, "_blank")}
                        >
                          <FileWarning className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {bill.status === "PAID" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50"
                          onClick={() => window.open(`/api/maintenance/bills/${bill.id}/pdf`, "_blank")}
                        >
                          <FileDown className="h-3.5 w-3.5 mr-1" />
                          Download Bill
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => {
                          setPayBill(bill);
                          const remaining = Number(bill.amount) + Number(bill.previousDue) + Number(bill.interestCharge) - Number(bill.paidAmount);
                          setPayAmount(String(Math.round(remaining)));
                        }}>
                          Record Payment
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Delete Bill"
                          onClick={() => handleDeleteBill(bill)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filteredBills.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                  {q ? `No bills match "${search}"` : "No maintenance bills found"}
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
                {Number(payBill.previousDue) > 0 && (
                  <p><span className="text-gray-500">Previous Due:</span> <span className="text-red-600">{fmtINR(payBill.previousDue)}</span></p>
                )}
                {Number(payBill.interestCharge) > 0 && (
                  <p><span className="text-gray-500">Interest (12% p.a.):</span> <span className="text-red-600">{fmtINR(payBill.interestCharge)}</span></p>
                )}
                <p><span className="text-gray-500">Outstanding:</span> <strong>
                  {fmtINR(Number(payBill.amount) + Number(payBill.previousDue) + Number(payBill.interestCharge) - Number(payBill.paidAmount))}
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
                    {[["CASH","Cash"],["UPI","UPI"],["NEFT","NEFT"],["RTGS","RTGS"],["CHEQUE","Cheque"],["CREDIT_CARD","Credit Card"]].map(([val,label]) => (
                      <SelectItem key={val} value={val}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rebate / Waiver (₹) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input
                  type="number" step="0.01" min="0"
                  value={payRebate}
                  onChange={(e) => {
                    setPayRebate(e.target.value);
                    if (payBill) {
                      const outstanding = Number(payBill.amount) + Number(payBill.previousDue) + Number(payBill.interestCharge) - Number(payBill.paidAmount);
                      const rebate = parseFloat(e.target.value) || 0;
                      setPayAmount(String(Math.round(outstanding - rebate)));
                    }
                  }}
                  placeholder="0.00"
                />
                {/* Live settlement preview. Mirrors the rounding and PAID/PARTIAL rule in
                    /api/maintenance/payments/cash so this can never disagree with what is saved. */}
                {(() => {
                  const totalDue = Math.round(Number(payBill.amount) + Number(payBill.previousDue) + Number(payBill.interestCharge));
                  const outstanding = totalDue - Math.round(Number(payBill.paidAmount));
                  const rebate = parseFloat(payRebate) || 0;
                  const entered = parseFloat(payAmount) || 0;
                  const applied = entered + rebate;
                  const settled = applied >= outstanding - 0.01;
                  const balanceAfter = Math.max(0, outstanding - applied);
                  const exceeds = applied > outstanding + 0.01;
                  const tone = exceeds
                    ? { bg: "bg-red-50 border-red-200", line: "border-red-200", text: "text-red-800", note: "text-red-700" }
                    : settled
                      ? { bg: "bg-green-50 border-green-200", line: "border-green-200", text: "text-green-800", note: "text-green-700" }
                      : { bg: "bg-amber-50 border-amber-200", line: "border-amber-200", text: "text-amber-800", note: "text-amber-700" };
                  return (
                    <div className={`text-xs border rounded px-2 py-1.5 space-y-0.5 mt-1 ${tone.bg}`}>
                      <div className="flex justify-between text-gray-500"><span>Outstanding</span><span>{fmtINR(outstanding)}</span></div>
                      <div className="flex justify-between text-gray-700"><span>This Payment</span><span>− {fmtINR(entered)}</span></div>
                      {rebate > 0 && (
                        <div className="flex justify-between text-green-700"><span>Rebate / Waiver</span><span>− {fmtINR(rebate)}</span></div>
                      )}
                      <div className={`flex justify-between font-semibold border-t pt-1 ${tone.line} ${tone.text}`}>
                        <span>Balance Due After Payment</span>
                        <span>{fmtINR(balanceAfter)}</span>
                      </div>
                      <p className={tone.note}>
                        {exceeds
                          ? `Payment + rebate exceeds outstanding by ${fmtINR(applied - outstanding)}.`
                          : settled
                            ? "Bill will be marked PAID."
                            : "Bill will be marked PARTIAL."}
                      </p>
                    </div>
                  );
                })()}
              </div>
              <div className="space-y-1">
                <Label>Reference / Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR, cheque no., rebate reason…" />
              </div>
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
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
              {Number(detailBill.previousDue) > 0 && (
                <>
                  <span className="text-gray-500">Previous Due</span>
                  <span className="text-red-600">{fmtINR(detailBill.previousDue)}</span>
                </>
              )}
              {/* Same figure the invoice PDF and receipt show, using the API's rounding. */}
              {(() => {
                const balance = Math.max(
                  0,
                  Math.round(Number(detailBill.amount) + Number(detailBill.previousDue) + Number(detailBill.interestCharge)) -
                    Math.round(Number(detailBill.paidAmount))
                );
                return (
                  <>
                    <span className="text-gray-500 font-medium">Balance Due</span>
                    <span className={balance > 0 ? "font-bold text-amber-700" : "font-bold text-green-700"}>
                      {fmtINR(balance)}
                    </span>
                  </>
                );
              })()}
              <span className="text-gray-500">Due Date</span><span>{fmtDate(detailBill.dueDate)}</span>
              <span className="text-gray-500">Status</span><span><StatusBadge status={detailBill.status} /></span>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Bills Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Maintenance Bills</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-3">
              {(["all", "individual"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setGenMode(m)}
                  className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                    genMode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m === "all" ? <><Users className="h-4 w-4" /> All Customers</> : <><FilePlus2 className="h-4 w-4" /> Individual Flat</>}
                </button>
              ))}
            </div>

            {genMode === "individual" && (
              <div className="space-y-1">
                <Label>Flat</Label>
                <Popover open={genConnOpen} onOpenChange={setGenConnOpen}>
                  <PopoverTrigger
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <span className={genConnId ? "" : "text-muted-foreground"}>
                      {genConnId
                        ? (() => {
                            const c = advConnections.find((x) => x.id === genConnId);
                            return c ? `${c.flatNo} — ${c.residentName}` : "Select flat…";
                          })()
                        : "Select flat…"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search flat or resident…" />
                      <CommandList>
                        <CommandEmpty>No flat found.</CommandEmpty>
                        <CommandGroup>
                          {advConnections.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={`${c.flatNo} ${c.residentName} ${c.tower}`}
                              data-checked={genConnId === c.id || undefined}
                              onSelect={() => { setGenConnId(c.id); setGenConnOpen(false); }}
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
              <Label>Month</Label>
              <Input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
            </div>

            {genMode === "individual" && (
              <div className="space-y-1">
                <Label>Previous Due (₹) <span className="text-muted-foreground font-normal text-xs">— outstanding from prior months</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={genPreviousDue}
                  onChange={(e) => setGenPreviousDue(e.target.value)}
                />
                {genPreviousDue && Number(genPreviousDue) > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    ₹{Number(genPreviousDue).toLocaleString("en-IN", { minimumFractionDigits: 2 })} will be added as previous due on this bill.
                  </p>
                )}
              </div>
            )}

            {genMode === "all" && (
              <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2">
                Generates bills for all active connections that don&apos;t yet have a bill for the selected month. Already-existing bills are skipped.
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
              <Button
                onClick={handleGenerateBills}
                disabled={genLoading || (genMode === "individual" && !genConnId)}
              >
                {genLoading ? "Generating…" : genMode === "all" ? "Generate All Bills" : "Generate Bill"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Advance Payment Dialog */}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Advance Payment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Flat</Label>
              <Popover open={advConnOpen} onOpenChange={setAdvConnOpen}>
                <PopoverTrigger
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={advConnId ? "" : "text-muted-foreground"}>
                    {advConnId
                      ? (() => {
                          const c = advConnections.find((x) => x.id === advConnId);
                          return c ? `${c.flatNo} — ${c.residentName}` : "Select flat…";
                        })()
                      : "Select flat…"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search flat or resident…" />
                    <CommandList>
                      <CommandEmpty>No flat found.</CommandEmpty>
                      <CommandGroup>
                        {advConnections.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={`${c.flatNo} ${c.residentName} ${c.tower}`}
                            data-checked={advConnId === c.id || undefined}
                            onSelect={() => {
                              setAdvConnId(c.id);
                              setAdvConnOpen(false);
                            }}
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
            <div className="space-y-1">
              <Label>Months</Label>
              <div className="flex gap-3">
                {([6, 12] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setAdvMonths(m)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      advMonths === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {m} Months
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Start From</Label>
              <Input type="month" value={advStart} onChange={(e) => setAdvStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Amount / Month (₹)</Label>
              <Input
                type="number"
                step="0.01"
                value={advAmount}
                onChange={(e) => setAdvAmount(e.target.value)}
              />
            </div>
            <div className="bg-gray-50 rounded-md px-3 py-2 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Amount / Month</span>
                <span>{fmtINR(advBase)}</span>
              </div>
              {advCgstRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">CGST ({advCgstRate}%)</span>
                  <span>{fmtINR(advCgst)}</span>
                </div>
              )}
              {advSgstRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-500">SGST ({advSgstRate}%)</span>
                  <span>{fmtINR(advSgst)}</span>
                </div>
              )}
              {(advCgstRate > 0 || advSgstRate > 0) && (
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="text-gray-500">Monthly Total (incl. GST)</span>
                  <span className="font-medium">{fmtINR(advMonthlyWithGst)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-200 pt-1.5">
                <span className="text-gray-500">Grand Total ({advMonths} months)</span>
                <strong>₹{Math.round(Number(advTotal)).toLocaleString("en-IN")}</strong>
              </div>
              {advRebate && parseFloat(advRebate) > 0 && (
                <>
                  <div className="flex justify-between text-green-700 border-t border-gray-200 pt-1.5">
                    <span>Rebate / Waiver</span>
                    <span>− {fmtINR(parseFloat(advRebate))}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-blue-800 border-t border-gray-200 pt-1.5">
                    <span>Net Payable</span>
                    <strong>{fmtINR(Math.max(0, Number(advTotal) - parseFloat(advRebate)))}</strong>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <Select value={advMethod} onValueChange={(val) => setAdvMethod(val ?? "CASH")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["CASH","Cash"],["UPI","UPI"],["NEFT","NEFT"],["RTGS","RTGS"],["CHEQUE","Cheque"],["CREDIT_CARD","Credit Card"]].map(([val,label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Rebate / Waiver (₹) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                type="number" step="0.01" min="0"
                value={advRebate}
                onChange={(e) => setAdvRebate(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>Reference / Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
              <Input
                value={advRef}
                onChange={(e) => setAdvRef(e.target.value)}
                placeholder="UTR, cheque no., rebate reason…"
              />
            </div>
            <div className="space-y-1">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={advDate}
                onChange={(e) => setAdvDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAdvanceOpen(false)}>Cancel</Button>
              <Button
                onClick={handleAdvancePayment}
                disabled={advSubmitting || !advConnId || !advAmount}
              >
                {advSubmitting ? "Processing…" : `Pay ${advMonths} Months`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
