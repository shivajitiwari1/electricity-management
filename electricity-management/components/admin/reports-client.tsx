"use client";

import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IndianRupee, FileText, Users, AlertCircle, FileSpreadsheet, FileDown } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type SerializedPaidBill = {
  billDate: string;
  totalAmount: number;
  ncplUnits: number;
  tower: string;
  flatNo: string;
};

type SerializedOverdueBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  dueDate: string;
  totalAmount: number;
};

type SerializedAllBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  tower: string;
  residentName: string;
  billDate: string;
  dueDate: string;
  totalAmount: number;
  status: string;
};

type Stats = {
  totalRevenue: number;
  totalBills: number;
  totalResidents: number;
  overdueCount: number;
};

interface Props {
  paidBills: SerializedPaidBill[];
  overdueBills: SerializedOverdueBill[];
  allBills: SerializedAllBill[];
  stats: Stats;
}

// ─── Period config ────────────────────────────────────────────────────────────

const QUICK_PERIODS = [
  { key: "weekly" as const,      label: "Weekly",      days: 7   },
  { key: "monthly" as const,     label: "Monthly",     days: 30  },
  { key: "half-yearly" as const, label: "Half Yearly", days: 182 },
  { key: "yearly" as const,      label: "Yearly",      days: 365 },
];

type QuickPeriod = typeof QUICK_PERIODS[number]["key"];

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodStart(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── Chart data builder ───────────────────────────────────────────────────────

function getGroupBy(start: Date, end: Date): "day" | "week" | "month" {
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days <= 14)  return "day";
  if (days <= 90)  return "week";
  return "month";
}

function buildChartData(
  bills: SerializedPaidBill[],
  start: Date,
  end: Date
): { label: string; revenue: number }[] {
  const groupBy = getGroupBy(start, end);

  if (groupBy === "day") {
    const result: { label: string; revenue: number }[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const next = new Date(cursor);
      next.setDate(cursor.getDate() + 1);
      result.push({
        label: cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        revenue: bills
          .filter(b => { const bd = new Date(b.billDate); return bd >= cursor && bd < next; })
          .reduce((s, b) => s + b.totalAmount, 0),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  }

  if (groupBy === "week") {
    const result: { label: string; revenue: number }[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    while (cursor <= end) {
      const wEnd = new Date(cursor);
      wEnd.setDate(cursor.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);
      const actualEnd = wEnd > end ? new Date(end) : wEnd;
      result.push({
        label: `${cursor.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${actualEnd.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        revenue: bills
          .filter(b => { const bd = new Date(b.billDate); return bd >= cursor && bd <= actualEnd; })
          .reduce((s, b) => s + b.totalAmount, 0),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return result;
  }

  // monthly
  const result: { label: string; revenue: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    const mEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const actualEnd = mEnd > end ? new Date(end) : mEnd;
    result.push({
      label: cursor.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      revenue: bills
        .filter(b => { const bd = new Date(b.billDate); return bd >= cursor && bd <= actualEnd; })
        .reduce((s, b) => s + b.totalAmount, 0),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatINR(value: number): string {
  return value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function daysOverdue(dueDateIso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(dueDateIso).getTime()) / 86400000));
}


// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsClient({ paidBills, overdueBills, allBills, stats }: Props) {
  const today = toDateStr(new Date());
  const [activeTab, setActiveTab] = useState<QuickPeriod | "custom">("monthly");
  const [dateStart, setDateStart] = useState(() => toDateStr(periodStart(30)));
  const [dateEnd, setDateEnd] = useState(today);

  function selectPeriod(p: QuickPeriod) {
    const days = QUICK_PERIODS.find(x => x.key === p)!.days;
    setActiveTab(p);
    setDateStart(toDateStr(periodStart(days)));
    setDateEnd(today);
  }

  function handleStartChange(val: string) {
    setDateStart(val);
    setActiveTab("custom");
  }

  function handleEndChange(val: string) {
    setDateEnd(val);
    setActiveTab("custom");
  }

  const effectiveStart = useMemo(() => {
    const d = new Date(dateStart + "T00:00:00");
    return isNaN(d.getTime()) ? periodStart(30) : d;
  }, [dateStart]);

  const effectiveEnd = useMemo(() => {
    const d = new Date(dateEnd + "T23:59:59");
    return isNaN(d.getTime()) ? new Date() : d;
  }, [dateEnd]);

  const filteredPaidBills = useMemo(
    () => paidBills.filter(b => {
      const bd = new Date(b.billDate);
      return bd >= effectiveStart && bd <= effectiveEnd;
    }),
    [paidBills, effectiveStart, effectiveEnd]
  );

  const filteredAllBills = useMemo(
    () => allBills.filter(b => {
      const bd = new Date(b.billDate);
      return bd >= effectiveStart && bd <= effectiveEnd;
    }),
    [allBills, effectiveStart, effectiveEnd]
  );

  const chartData = useMemo(
    () => buildChartData(filteredPaidBills, effectiveStart, effectiveEnd),
    [filteredPaidBills, effectiveStart, effectiveEnd]
  );

  const revenueByTower = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of filteredPaidBills) {
      map[b.tower] = (map[b.tower] ?? 0) + b.totalAmount;
    }
    return Object.entries(map)
      .map(([tower, revenue]) => ({ tower: `Tower ${tower}`, revenue }))
      .sort((a, b) => a.tower.localeCompare(b.tower));
  }, [filteredPaidBills]);

  const periodRevenue = filteredPaidBills.reduce((s, b) => s + b.totalAmount, 0);

  const rangeLabelShort =
    activeTab === "custom"
      ? `${formatDate(dateStart + "T00:00:00")} – ${formatDate(dateEnd + "T00:00:00")}`
      : QUICK_PERIODS.find(p => p.key === activeTab)?.label ?? "";

  function downloadExcel() {
    window.location.href = `/api/reports/xlsx?start=${dateStart}&end=${dateEnd}`;
  }

  function downloadPdf() {
    window.location.href = `/api/reports/pdf?start=${dateStart}&end=${dateEnd}`;
  }

  const summaryCards = [
    {
      title: "Revenue",
      value: `₹${formatINR(periodRevenue)}`,
      sub: rangeLabelShort,
      icon: IndianRupee,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Bills Generated",
      value: filteredAllBills.length.toLocaleString("en-IN"),
      sub: rangeLabelShort,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Residents",
      value: stats.totalResidents.toLocaleString("en-IN"),
      sub: "All time",
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Overdue Bills",
      value: stats.overdueCount.toLocaleString("en-IN"),
      sub: "Current",
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Controls ── */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Quick period tabs */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
              {QUICK_PERIODS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => selectPeriod(p.key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    activeTab === p.key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadExcel}
                className="gap-2"
              >
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button size="sm" onClick={downloadPdf} className="gap-2">
                <FileDown className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-muted-foreground shrink-0">Date Range</span>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateStart}
                max={dateEnd}
                onChange={e => handleStartChange(e.target.value)}
                className="h-8 w-38 text-sm"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <Input
                type="date"
                value={dateEnd}
                min={dateStart}
                max={today}
                onChange={e => handleEndChange(e.target.value)}
                className="h-8 w-38 text-sm"
              />
            </div>
            {activeTab === "custom" && (
              <Badge variant="secondary" className="text-xs">Custom Range</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(({ title, value, sub, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
                <div className={`p-3 rounded-full ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Revenue Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Revenue — {rangeLabelShort} (Paid Bills)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.revenue === 0) ? (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No paid bill data for this period.
            </p>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
                        : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K`
                        : `₹${v}`
                    }
                  />
                  <Tooltip
                    cursor={false}
                    formatter={(value) => [`₹${formatINR(Number(value ?? 0))}`, "Revenue"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Revenue by Tower ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Revenue by Tower — {rangeLabelShort}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByTower.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No paid bills for this period.
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByTower} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="tower" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 100000 ? `₹${(v / 100000).toFixed(1)}L`
                        : v >= 1000 ? `₹${(v / 1000).toFixed(0)}K`
                        : `₹${v}`
                    }
                  />
                  <Tooltip
                    cursor={false}
                    formatter={(value) => [`₹${formatINR(Number(value ?? 0))}`, "Revenue"]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="revenue" name="Revenue (₹)" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Overdue Bills Table ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">
            Overdue Bills
            {overdueBills.length > 0 && (
              <Badge className="ml-2 bg-red-100 text-red-800 hover:bg-red-100">
                {overdueBills.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-1">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat No</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tower</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill #</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount (₹)</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Days Overdue</th>
                </tr>
              </thead>
              <tbody>
                {overdueBills.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">No overdue bills</td>
                  </tr>
                ) : (
                  overdueBills.map((bill) => {
                    const days = daysOverdue(bill.dueDate);
                    return (
                      <tr key={bill.id} className="border-b last:border-0 hover:bg-red-50/40">
                        <td className="px-4 py-3 font-mono text-xs">{bill.flatNo}</td>
                        <td className="px-4 py-3">{bill.tower}</td>
                        <td className="px-4 py-3 font-medium">{bill.residentName}</td>
                        <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(bill.dueDate)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatINR(bill.totalAmount)}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={days > 30 ? "bg-red-100 text-red-800 hover:bg-red-100" : "bg-orange-100 text-orange-800 hover:bg-orange-100"}>
                            {days}d
                          </Badge>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
