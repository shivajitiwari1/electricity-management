"use client";

import { useMemo } from "react";
import Papa from "papaparse";
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
import {
  IndianRupee,
  FileText,
  Users,
  AlertCircle,
  Download,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(value: number): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function daysOverdue(dueDateIso: string): number {
  const now = new Date();
  const due = new Date(dueDateIso);
  const diff = Math.floor(
    (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportToCSV(bills: SerializedAllBill[]) {
  const csv = Papa.unparse(
    bills.map((b) => ({
      "Bill Number": b.billNumber,
      "Flat No": b.flatNo,
      Tower: b.tower,
      Resident: b.residentName,
      Amount: b.totalAmount,
      Status: b.status,
      "Bill Date": formatDate(b.billDate),
      "Due Date": formatDate(b.dueDate),
    }))
  );
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bills-export.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsClient({
  paidBills,
  overdueBills,
  allBills,
  stats,
}: Props) {
  // A. Monthly revenue for the last 12 months
  const revenueByMonth = useMemo(() => {
    const now = new Date();
    // Build ordered list of last 12 months (oldest → newest)
    const months: { key: string; label: string; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: getMonthLabel(d),
        revenue: 0,
      });
    }
    for (const bill of paidBills) {
      const d = new Date(bill.billDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = months.find((m) => m.key === key);
      if (entry) entry.revenue += bill.totalAmount;
    }
    return months.map(({ label, revenue }) => ({ month: label, revenue }));
  }, [paidBills]);

  // C. Revenue by tower (current month)
  const revenueByTower = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
    const towerMap: Record<string, number> = {};
    for (const bill of paidBills) {
      const d = new Date(bill.billDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (key === currentMonth) {
        towerMap[bill.tower] = (towerMap[bill.tower] ?? 0) + bill.totalAmount;
      }
    }
    return Object.entries(towerMap)
      .map(([tower, revenue]) => ({ tower: `Tower ${tower}`, revenue }))
      .sort((a, b) => a.tower.localeCompare(b.tower));
  }, [paidBills]);

  const summaryCards = [
    {
      title: "Total Revenue",
      value: `₹${formatINR(stats.totalRevenue)}`,
      icon: IndianRupee,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      title: "Total Bills Generated",
      value: stats.totalBills.toLocaleString("en-IN"),
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Total Residents",
      value: stats.totalResidents.toLocaleString("en-IN"),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Overdue Bills",
      value: stats.overdueCount.toLocaleString("en-IN"),
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ];

  return (
    <div className="space-y-8">
      {/* ── A. Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── B. Monthly Revenue Bar Chart ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Monthly Revenue — Last 12 Months (Paid Bills)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByMonth.every((m) => m.revenue === 0) ? (
            <p className="text-sm text-gray-400 py-12 text-center">
              No paid bill data in the last 12 months.
            </p>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueByMonth}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 100000
                        ? `₹${(v / 100000).toFixed(1)}L`
                        : v >= 1000
                        ? `₹${(v / 1000).toFixed(0)}K`
                        : `₹${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value) => [
                      `₹${formatINR(Number(value ?? 0))}`,
                      "Revenue",
                    ]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar
                    dataKey="revenue"
                    name="Revenue (₹)"
                    fill="#2563eb"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── C. Revenue by Tower (current month) ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            Revenue by Tower — Current Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          {revenueByTower.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">
              No paid bills for the current month.
            </p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={revenueByTower}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="tower"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      v >= 100000
                        ? `₹${(v / 100000).toFixed(1)}L`
                        : v >= 1000
                        ? `₹${(v / 1000).toFixed(0)}K`
                        : `₹${v}`
                    }
                  />
                  <Tooltip
                    formatter={(value) => [
                      `₹${formatINR(Number(value ?? 0))}`,
                      "Revenue",
                    ]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue (₹)"
                    fill="#7c3aed"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── D. Overdue Bills Table ── */}
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
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Flat No
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Tower
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Resident
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Bill #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Due Date
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Amount (₹)
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Days Overdue
                  </th>
                </tr>
              </thead>
              <tbody>
                {overdueBills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-gray-400"
                    >
                      No overdue bills
                    </td>
                  </tr>
                ) : (
                  overdueBills.map((bill) => {
                    const days = daysOverdue(bill.dueDate);
                    return (
                      <tr
                        key={bill.id}
                        className="border-b last:border-0 hover:bg-red-50/40"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {bill.flatNo}
                        </td>
                        <td className="px-4 py-3">{bill.tower}</td>
                        <td className="px-4 py-3 font-medium">
                          {bill.residentName}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {bill.billNumber}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatDate(bill.dueDate)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {formatINR(bill.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            className={
                              days > 30
                                ? "bg-red-100 text-red-800 hover:bg-red-100"
                                : "bg-orange-100 text-orange-800 hover:bg-orange-100"
                            }
                          >
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

      {/* ── E. Export to CSV ── */}
      <div className="flex justify-end">
        <Button
          onClick={() => exportToCSV(allBills)}
          className="gap-2"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          Export Bills to CSV
        </Button>
      </div>
    </div>
  );
}
