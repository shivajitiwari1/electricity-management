"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Download,
  Eye,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

type ResidentBill = {
  id: string;
  billNumber: string;
  flatNo: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  ncplUnits: number;
  totalAmount: number;
  dueDate: string;
  status: string;
  paymentId: string | null;
};

interface Props {
  bills: ResidentBill[];
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPeriod(start: string, end: string) {
  return `${formatDate(start)} – ${formatDate(end)}`;
}

function formatINR(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ResidentBillsList({ bills }: Props) {
  const router = useRouter();
  const [viewBill, setViewBill] = useState<ResidentBill | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold">
            {bills.length} Bill{bills.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 mt-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Bill #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Period
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    NPCL Units
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Amount (₹)
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Due Date
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="text-center py-10 text-gray-400"
                    >
                      No bills found
                    </td>
                  </tr>
                ) : (
                  bills.map((bill) => (
                    <tr
                      key={bill.id}
                      className="border-b last:border-0 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {bill.billNumber}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatPeriod(
                          bill.billingPeriodStart,
                          bill.billingPeriodEnd
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {bill.ncplUnits} kWh
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {bill.totalAmount.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {formatDate(bill.dueDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={bill.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              window.open(`/api/pdf/bill/${bill.id}`)
                            }
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewBill(bill)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Details
                          </Button>
                          {(bill.status === "PENDING" ||
                            bill.status === "OVERDUE") && (
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                              onClick={() =>
                                router.push(`/resident/bills/${bill.id}/pay`)
                              }
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pay Now
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bill Details Dialog */}
      <Dialog
        open={!!viewBill}
        onOpenChange={(open) => {
          if (!open) setViewBill(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bill Details</DialogTitle>
          </DialogHeader>
          {viewBill && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <span className="text-gray-500">Bill Number</span>
                <span className="font-mono font-medium">
                  {viewBill.billNumber}
                </span>

                <span className="text-gray-500">Flat No</span>
                <span className="font-mono">{viewBill.flatNo}</span>

                <span className="text-gray-500">Billing Period</span>
                <span>
                  {formatPeriod(
                    viewBill.billingPeriodStart,
                    viewBill.billingPeriodEnd
                  )}
                </span>

                <span className="text-gray-500">NPCL Units</span>
                <span>{viewBill.ncplUnits} kWh</span>

                <span className="text-gray-500">Due Date</span>
                <span>{formatDate(viewBill.dueDate)}</span>

                <span className="text-gray-500">Total Amount</span>
                <span className="font-semibold text-base">
                  {formatINR(viewBill.totalAmount)}
                </span>

                <span className="text-gray-500">Status</span>
                <span>
                  <StatusBadge status={viewBill.status} />
                </span>

                {viewBill.paymentId && (
                  <>
                    <span className="text-gray-500">Payment ID</span>
                    <span className="font-mono text-xs">
                      {viewBill.paymentId}
                    </span>
                  </>
                )}
              </div>
              <div className="flex justify-between pt-2 gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => window.open(`/api/pdf/bill/${viewBill.id}`)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download PDF
                </Button>
                {(viewBill.status === "PENDING" ||
                  viewBill.status === "OVERDUE") && (
                  <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => {
                      setViewBill(null);
                      router.push(`/resident/bills/${viewBill.id}/pay`);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Pay Now
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
