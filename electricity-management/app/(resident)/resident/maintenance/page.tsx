import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wrench, CreditCard, AlertCircle, CheckCircle2, Clock, Receipt } from "lucide-react";
import { Decimal } from "@prisma/client/runtime/client";

export const dynamic = "force-dynamic";

type BillStatus = "PENDING" | "PAID" | "OVERDUE" | "PARTIAL";

function StatusBadge({ status }: { status: BillStatus }) {
  if (status === "PAID") return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 flex items-center gap-1 w-fit"><CheckCircle2 className="h-3 w-3" />PAID</Badge>;
  if (status === "OVERDUE") return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 flex items-center gap-1 w-fit"><AlertCircle className="h-3 w-3" />OVERDUE</Badge>;
  if (status === "PARTIAL") return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PARTIAL</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100 flex items-center gap-1 w-fit"><Clock className="h-3 w-3" />PENDING</Badge>;
}

const fmtINR = (v: number | string | Decimal) =>
  `₹${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

const fmtDate = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default async function ResidentMaintenancePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const resident = await prisma.resident.findUnique({
    where: { userId: session.user.id },
    include: {
      connections: {
        where: { status: "ACTIVE" },
        include: {
          maintenanceBills: {
            orderBy: { billDate: "desc" },
            take: 24,
            include: {
              payments: { orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  if (!resident) redirect("/login");

  const bills = resident.connections.flatMap((c) => c.maintenanceBills);
  bills.sort((a, b) => b.billDate.getTime() - a.billDate.getTime());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-50">
          <Wrench className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Maintenance Bills</h1>
          <p className="text-sm text-gray-500">Monthly maintenance charges for your flat</p>
        </div>
      </div>

      {bills.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No maintenance bills yet</p>
            <p className="text-sm text-gray-400 mt-1">Bills are generated at the end of each month</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bills.map((bill) => {
            const totalDue = Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount);
            const canPay = bill.status === "PENDING" || bill.status === "OVERDUE" || bill.status === "PARTIAL";
            return (
              <Card key={bill.id} className={bill.status === "OVERDUE" ? "border-red-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs text-gray-500">{bill.billNumber}</p>
                        <StatusBadge status={bill.status} />
                      </div>
                      <p className="text-sm text-gray-600">
                        {fmtDate(bill.billingPeriodStart)} – {fmtDate(bill.billingPeriodEnd)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {bill.unitArea} sq ft × ₹{Number(bill.ratePerSqFt).toFixed(2)}/sq ft
                      </p>
                      {Number(bill.interestCharge) > 0 && (
                        <p className="text-xs text-red-600">
                          Interest (24% p.a.): {fmtINR(bill.interestCharge)}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-2">
                      <p className="text-2xl font-bold text-gray-900">{fmtINR(bill.amount)}</p>
                      {Number(bill.interestCharge) > 0 && (
                        <p className="text-sm font-medium text-red-600">
                          Total due: {fmtINR(Number(bill.amount) + Number(bill.interestCharge) - Number(bill.paidAmount))}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">Due: {fmtDate(bill.dueDate)}</p>
                      {canPay && (
                        <Link href={`/resident/maintenance/${bill.id}/pay`}>
                          <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                            <CreditCard className="h-3.5 w-3.5 mr-1" />Pay Now
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                  {bill.payments.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                        <Receipt className="h-3 w-3" />Payment History
                      </p>
                      <div className="space-y-2">
                        {bill.payments.map((p) => {
                          const txnRef = p.razorpayPaymentId && p.razorpayPaymentId !== "CASH"
                            ? p.razorpayPaymentId
                            : null;
                          return (
                            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-xs bg-gray-50 rounded px-3 py-2">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-gray-700">{p.method}</span>
                                  <span className="text-gray-400">·</span>
                                  <span className="text-gray-500">{p.receiptNumber}</span>
                                </div>
                                {txnRef && (
                                  <p className="text-gray-500">Ref: <span className="font-mono">{txnRef}</span></p>
                                )}
                                <p className="text-gray-400">
                                  {new Date(p.paymentDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  {" "}&nbsp;
                                  {new Date(p.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              </div>
                              <span className="font-semibold text-green-700">{fmtINR(p.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
