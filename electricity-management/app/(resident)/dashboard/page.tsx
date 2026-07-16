export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Home, FileText, CreditCard, AlertCircle, CheckCircle2, Clock } from "lucide-react";

function formatINR(amount: number | string | { toString(): string }): string {
  return `₹${Number(amount).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PAID") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 w-fit">
        <CheckCircle2 className="h-3 w-3" />
        PAID
      </Badge>
    );
  }
  if (status === "OVERDUE") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 w-fit">
        <AlertCircle className="h-3 w-3" />
        OVERDUE
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 w-fit">
      <Clock className="h-3 w-3" />
      PENDING
    </Badge>
  );
}

export default async function ResidentDashboard() {
  const session = await auth();
  if (!session) redirect("/login");

  // Get the resident's data
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
            include: { payment: true },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  // Primary connection (first active connection)
  const primaryConnection = resident.connections[0] ?? null;
  const latestBill = primaryConnection?.bills[0] ?? null;

  // Determine if there is a pending/overdue bill
  const pendingBill =
    latestBill && (latestBill.status === "PENDING" || latestBill.status === "OVERDUE")
      ? latestBill
      : null;

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome, {resident.user.name}!
              </h1>
              <p className="text-gray-500 mt-1 text-sm">
                Resident #{resident.residentNumber}
              </p>
              {primaryConnection && (
                <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
                  <span>
                    <span className="font-medium">Flat:</span> {primaryConnection.flatNo}
                  </span>
                  <span>
                    <span className="font-medium">Tower:</span> {primaryConnection.tower}
                  </span>
                  <span>
                    <span className="font-medium">Floor:</span> {primaryConnection.floor}
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 rounded-full bg-blue-50">
              <Home className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Bill Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Current Bill
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingBill ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-gray-900">
                    {formatINR(pendingBill.totalAmount)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Bill #{pendingBill.billNumber}
                  </p>
                </div>
                <StatusBadge status={pendingBill.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Bill Date</p>
                  <p className="font-medium">
                    {new Date(pendingBill.billDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div
                  className={`rounded-md p-3 ${
                    pendingBill.status === "OVERDUE" ? "bg-red-50" : "bg-gray-50"
                  }`}
                >
                  <p
                    className={`text-xs mb-0.5 ${
                      pendingBill.status === "OVERDUE" ? "text-red-500" : "text-gray-500"
                    }`}
                  >
                    Due Date
                  </p>
                  <p
                    className={`font-medium ${
                      pendingBill.status === "OVERDUE" ? "text-red-700" : ""
                    }`}
                  >
                    {new Date(pendingBill.dueDate).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-md p-3">
                  <p className="text-gray-500 text-xs mb-0.5">Units (NCPL)</p>
                  <p className="font-medium">{Number(pendingBill.ncplUnits)} kWh</p>
                </div>
              </div>

              <Link href={`/resident/bills/${pendingBill.id}/pay`}>
                <Button size="lg" className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white text-base py-3 px-8">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay Now — {formatINR(pendingBill.totalAmount)}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
              <div className="p-4 rounded-full bg-green-50">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-700">No outstanding bills</p>
                <p className="text-sm text-gray-500 mt-1">
                  You are all caught up! Your account is up to date.
                </p>
              </div>
              {latestBill && (
                <p className="text-xs text-gray-400">
                  Last bill{" "}
                  <span className="font-medium text-green-700">PAID</span> on{" "}
                  {latestBill.payment?.paymentDate
                    ? new Date(latestBill.payment.paymentDate).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link href="/resident/bills">
          <Card className="hover:shadow-md transition-shadow cursor-pointer group">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
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
              <div className="p-3 rounded-full bg-green-50 group-hover:bg-green-100 transition-colors">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Payment History</p>
                <p className="text-sm text-gray-500">View all your past payments</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
