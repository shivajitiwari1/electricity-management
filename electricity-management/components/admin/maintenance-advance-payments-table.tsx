"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthSelect, monthKeyOf, monthOptionsFrom } from "@/components/ui/month-select";
import { FileDown, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export interface MaintenanceAdvancePaymentRow {
  /** First payment of the batch — the one the receipt is printed from. */
  id: string;
  receiptNumber: string;
  /** How many monthly bills the advance settled. */
  receiptCount: number;
  flatNo: string;
  tower: string;
  residentName: string;
  billNumber: string;
  /** Total of the whole advance, not one month. */
  amount: string;
  method: string;
  referenceId: string | null;
  paymentDate: string;
  months: number;
  periodStart: string;
  periodEnd: string;
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

const fmtMonth = (d: string) =>
  new Date(d).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export default function MaintenanceAdvancePaymentsTable({
  initialData,
}: {
  initialData: MaintenanceAdvancePaymentRow[];
}) {
  const [tower, setTower] = useState("all");
  const [month, setMonth] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // The month an advance starts in — the only month a batch can be picked by.
  const monthOptions = useMemo(
    () => monthOptionsFrom(initialData.map((r) => r.periodStart)),
    [initialData]
  );

  function handleSort(key: string) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortKey !== col) return <ArrowUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="inline ml-1 h-3 w-3" /> : <ArrowDown className="inline ml-1 h-3 w-3" />;
  }
  function sortRows(rows: MaintenanceAdvancePaymentRow[]) {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      let aVal: string | number = "", bVal: string | number = "";
      switch (sortKey) {
        case "receiptNumber": aVal = a.receiptNumber; bVal = b.receiptNumber; break;
        case "flatNo": aVal = a.flatNo; bVal = b.flatNo; break;
        case "residentName": aVal = a.residentName.toLowerCase(); bVal = b.residentName.toLowerCase(); break;
        case "billNumber": aVal = a.billNumber; bVal = b.billNumber; break;
        case "periodStart": aVal = a.periodStart; bVal = b.periodStart; break;
        case "months": aVal = a.months; bVal = b.months; break;
        case "amount": aVal = Number(a.amount); bVal = Number(b.amount); break;
        case "method": aVal = a.method; bVal = b.method; break;
        case "paymentDate": aVal = a.paymentDate; bVal = b.paymentDate; break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }

  const q = search.trim().toLowerCase();
  const filteredPayments = sortRows(
    initialData.filter((p) => {
      if (tower !== "all" && p.tower !== tower) return false;
      if (month !== "all" && monthKeyOf(p.periodStart) !== month) return false;
      if (!q) return true;
      return (
        p.flatNo.toLowerCase().includes(q) ||
        p.residentName.toLowerCase().includes(q) ||
        p.receiptNumber.toLowerCase().includes(q) ||
        p.billNumber.toLowerCase().includes(q)
      );
    })
  );

  const total = filteredPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalMonths = filteredPayments.reduce((s, p) => s + p.months, 0);

  const periodLabel = (p: MaintenanceAdvancePaymentRow) =>
    p.months > 1 ? `${fmtMonth(p.periodStart)} – ${fmtMonth(p.periodEnd)}` : fmtMonth(p.periodStart);

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
          <Label className="text-xs">Advance From</Label>
          <MonthSelect
            value={month}
            onChange={setMonth}
            options={monthOptions}
            allowAll
            allLabel="All months"
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Flat, resident, receipt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-56"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-6 text-sm bg-gray-50 rounded-lg p-3">
        <span>
          <strong>{filteredPayments.length}</strong>
          {q ? ` of ${initialData.length}` : ""} advance payments
        </span>
        <span>Months Covered: <strong>{totalMonths}</strong></span>
        <span>Total Received: <strong className="text-green-700">{fmtINR(total)}</strong></span>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              {[
                ["receiptNumber", "Receipt No"],
                ["flatNo", "Flat / Resident"],
                ["billNumber", "Bill No"],
                ["periodStart", "Period Covered"],
                ["months", "Duration"],
                ["amount", "Amount"],
                ["method", "Method"],
                [null, "Reference"],
                ["paymentDate", "Paid On"],
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
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{periodLabel(p)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                  {p.months} {p.months === 1 ? "month" : "months"}
                </td>
                <td className="px-4 py-3 font-medium text-green-700">{fmtINR(p.amount)}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="text-xs">{fmtMethod(p.method)}</Badge>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{p.referenceId ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{fmtDate(p.paymentDate)}</td>
                <td className="px-4 py-3">
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
                </td>
              </tr>
            ))}
            {filteredPayments.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                  {initialData.length === 0
                    ? "No advance payments recorded yet."
                    : "No advance payments match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
