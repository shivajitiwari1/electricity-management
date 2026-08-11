import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Users, Plug, FileText, IndianRupee, AlertCircle, Download } from "lucide-react";
import { getCachedDashboardStats, getCachedRecentBills } from "@/lib/server-cache";
import { auth } from "@/auth";
import { MaintenanceToggle } from "@/components/admin/maintenance-toggle";

export const dynamic = "force-dynamic";

function effectiveStatus(status: string, dueDate: Date) {
  return status === "PENDING" && dueDate < new Date() ? "OVERDUE" : status;
}

function getBadgeClass(status: string) {
  switch (status) {
    case "PAID":    return "bg-green-100 text-green-800 hover:bg-green-100";
    case "OVERDUE": return "bg-red-100 text-red-800 hover:bg-red-100";
    default:        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
  }
}

async function DashboardStats() {
  const { totalResidents, activeConnections, billsThisMonth, revenueThisMonth, overdueBills } =
    await getCachedDashboardStats();

  const revenue = revenueThisMonth._sum.amount ?? 0;
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const statCards = [
    { title: "Total Residents",    value: totalResidents,    icon: Users,        color: "text-blue-600",   bg: "bg-blue-50",   href: "/admin/residents" },
    { title: "Active Connections", value: activeConnections, icon: Plug,         color: "text-green-600",  bg: "bg-green-50",  href: "/admin/connections" },
    { title: "Bills This Month",   value: billsThisMonth,    icon: FileText,     color: "text-purple-600", bg: "bg-purple-50", href: `/admin/bills?month=${currentMonth}` },
    { title: "Revenue This Month", value: `₹${Number(revenue).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: IndianRupee, color: "text-emerald-600", bg: "bg-emerald-50", href: "/admin/payments" },
    { title: "Overdue Bills",      value: overdueBills,      icon: AlertCircle,  color: "text-red-600",    bg: "bg-red-50",    href: "/admin/bills?status=OVERDUE" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      {statCards.map(({ title, value, icon: Icon, color, bg, href }) => (
        <Link key={title} href={href}>
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
                </div>
                <div className={`p-3 rounded-full ${bg} dark:opacity-80`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

async function RecentBillsSection() {
  const recentBills = await getCachedRecentBills();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Recent Bills</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bill #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flat</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Resident</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No bills found</td></tr>
              ) : (
                recentBills.map((bill) => (
                  <tr key={bill.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-3 font-mono text-xs">{bill.billNumber}</td>
                    <td className="px-4 py-3">{bill.connection.flatNo}</td>
                    <td className="px-4 py-3">{bill.connection.resident.user.name}</td>
                    <td className="px-4 py-3 text-right">
                      ₹{Number(bill.totalAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(bill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={getBadgeClass(effectiveStatus(bill.status, bill.dueDate))}>{effectiveStatus(bill.status, bill.dueDate)}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  const isAdmin = (session?.user as any)?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of Oasis Venetia Heights electricity management
        </p>
      </div>

      <Suspense fallback={<StatCardsSkeleton count={5} />}>
        <DashboardStats />
      </Suspense>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/residents"><Button>Add Resident</Button></Link>
        <Link href="/admin/meter-readings"><Button variant="outline">Enter Reading</Button></Link>
        <Link href="/admin/reports"><Button variant="outline">View Reports</Button></Link>
        {isAdmin && (
          <a href="/api/backup/csv" download>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Backup
            </Button>
          </a>
        )}
      </div>

      {isAdmin && <MaintenanceToggle />}

      <Suspense fallback={<TableSkeleton rows={6} cols={6} showSearch={false} />}>
        <RecentBillsSection />
      </Suspense>
    </div>
  );
}
