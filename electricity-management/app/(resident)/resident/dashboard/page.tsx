import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCardsSkeleton, TableSkeleton } from "@/components/ui/page-skeleton";
import { Home, FileText, CreditCard, AlertCircle, CheckCircle2, Clock, Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

function formatINR(amount: number | string | { toString(): string }): string {
  return `₹${Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID")
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />PAID</Badge>;
  if (status === "OVERDUE")
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />OVERDUE</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PENDING</Badge>;
}

async function ResidentDashboardContent() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      user: { select: { name: true, email: true } },
      connections: {
        where: { status: "ACTIVE" },
        include: {
          bills: {
            orderBy: { billDate: "desc" },
            take: 1,
            include: { payments: { orderBy: { paymentDate: "desc" as const }, take: 1 } },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  const primaryConnection = resident.connections[0] ?? null;
  const latestBill = primaryConnection?.bills[0] ?? null;
  const pendingBill = latestBill && (latestBill.status === "PENDING" || latestBill.status === "OVERDUE") ? latestBill : null;

  const latestMaintenanceBill = await prisma.maintenanceBill.findFirst({
    where: {
      connectionId: { in: resident.connections.map((c) => c.id) },
      status: { in: ["PENDING", "OVERDUE", "PARTIAL"] },
    },
    orderBy: { billDate: "desc" },
  });

  return (
    <>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome, {resident.user.name}!</h1>
              <p className="text-gray-500 mt-1 text-sm">Resident #{resident.residentNumber}</p>
              {primaryConnection && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                  <span><span className="font-medium">Flat:</span> {primaryConnection.flatNo}</span>
                  <span><span className="font-medium">Tower:</span> {primaryConnection.tower}</span>
                  <span><span className="font-medium">Floor:</span> {primaryConnection.floor}</span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-full bg-blue-50"><Home className="h-6 w-6 text-blue-600" /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />Current Bill
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingBill ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">{formatINR(pendingBill.totalAmount)}</p>
                  <p className="text-sm text-gray-500">Bill #{pendingBill.billNumber}</p>
                </div>
                <StatusBadge status={pendingBill.status} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Bill Date</p>
                  <p className="font-medium">{new Date(pendingBill.billDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <div className={`rounded-md p-3 ${pendingBill.status === "OVERDUE" ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className={`text-xs mb-0.5 ${pendingBill.status === "OVERDUE" ? "text-red-500" : "text-gray-500"}`}>Due Date</p>
                  <p className={`font-medium ${pendingBill.status === "OVERDUE" ? "text-red-700" : ""}`}>
                    {new Date(pendingBill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Units (NCPL)</p>
                  <p className="font-medium">{Number(pendingBill.ncplUnits)} kWh</p>
                </div>
              </div>
              <Link href={`/resident/bills/${pendingBill.id}/pay`}>
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base py-3 px-8">
                  <CreditCard className="h-5 w-5 mr-2" />Pay Now — {formatINR(pendingBill.totalAmount)}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="p-4 rounded-full bg-green-50"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
              <div>
                <p className="font-semibold text-gray-700">No outstanding bills</p>
                <p className="text-sm text-gray-500 mt-1">You are all caught up! Your account is up to date.</p>
              </div>
              {latestBill && (
                <p className="text-xs text-gray-400">
                  Last bill <span className="font-medium text-green-700">PAID</span> on{" "}
                  {latestBill.payments[0]?.paymentDate ? new Date(latestBill.payments[0].paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Bill Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-orange-500" />Maintenance Bill
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestMaintenanceBill ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">{formatINR(latestMaintenanceBill.amount)}</p>
                  <p className="text-sm text-gray-500">Bill #{latestMaintenanceBill.billNumber}</p>
                  {Number(latestMaintenanceBill.interestCharge) > 0 && (
                    <p className="text-xs text-red-600">Interest: {formatINR(latestMaintenanceBill.interestCharge)}</p>
                  )}
                </div>
                <StatusBadge status={latestMaintenanceBill.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className={`rounded-md p-3 ${latestMaintenanceBill.status === "OVERDUE" ? "bg-red-50" : "bg-gray-50"}`}>
                  <p className={`text-xs mb-0.5 ${latestMaintenanceBill.status === "OVERDUE" ? "text-red-500" : "text-gray-500"}`}>Due Date</p>
                  <p className={`font-medium ${latestMaintenanceBill.status === "OVERDUE" ? "text-red-700" : ""}`}>
                    {new Date(latestMaintenanceBill.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Area</p>
                  <p className="font-medium">{latestMaintenanceBill.unitArea} sq ft</p>
                </div>
              </div>
              <Link href={`/resident/maintenance/${latestMaintenanceBill.id}/pay`}>
                <Button size="lg" className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white text-base py-3 px-8">
                  <CreditCard className="h-5 w-5 mr-2" />Pay Maintenance — {formatINR(Number(latestMaintenanceBill.amount) + Number(latestMaintenanceBill.interestCharge) - Number(latestMaintenanceBill.paidAmount))}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="p-4 rounded-full bg-green-50"><CheckCircle2 className="h-8 w-8 text-green-600" /></div>
              <div>
                <p className="font-semibold text-gray-700">No outstanding maintenance bills</p>
                <p className="text-sm text-gray-500 mt-1">All maintenance charges are up to date.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/resident/bills">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors"><FileText className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="font-semibold text-gray-800">View All Bills</p>
                <p className="text-sm text-gray-500">Browse your complete billing history</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/resident/payments">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors"><CreditCard className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="font-semibold text-gray-800">Payment History</p>
                <p className="text-sm text-gray-500">View all your past payments</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </>
  );
}

function ResidentDashboardSkeleton() {
  return (
    <>
      <StatCardsSkeleton count={1} />
      <StatCardsSkeleton count={1} />
      <TableSkeleton rows={2} cols={2} showSearch={false} />
    </>
  );
}

export default function ResidentDashboard() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<ResidentDashboardSkeleton />}>
        <ResidentDashboardContent />
      </Suspense>
    </div>
  );
}
